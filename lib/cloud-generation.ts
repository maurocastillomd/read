import {env} from 'cloudflare:workers';
import {getBook, getGuides, saveGuide} from './cloud-store';
import {digest, RequestError, safeKey, sourceHash, type Book, type GuideRecord} from './cloud-validation';
import {batchRequests, generationPlan, lessonRequest, MODEL, MAX_ATTEMPTS, MAX_UNITS, parseBatchResult, publicJob} from './generation-core.mjs';
import {planBook} from './guide-core.mjs';

type Unit = {id: string; chapterId: string; chapterTitle: string; part: number; totalParts: number; status: string; attempts: number; error?: string};
type Job = {
  id: string; bookId: string; bookTitle: string; sourceHash: string; model: string; status: string;
  units: Unit[]; skipped: {chapterId: string; title: string; reason: string}[];
  createdAt: string; updatedAt: string; error?: string; providerStatus?: string; processed?: number;
  mode?: 'batch' | 'direct'; batchId?: string; submissionId?: string; submissionStartedAt?: string;
  batchUnits?: string[]; outputKey?: string; outputCursor?: number; lastCheckedAt?: number;
};
type Row = {job_id: string; job_json: string};
const ACTIVE = new Set(['queued', 'submitting', 'submission_unknown', 'running', 'collecting', 'cancelling']);
const MAX_FILE = 24 * 1024 * 1024;
const API = 'https://api.anthropic.com/v1';
// A direct article request that has not finished by then was interrupted.
const DIRECT_STALE_MS = 6 * 60 * 1000;
const now = () => new Date().toISOString();
export function runtime() {
  if (!env.DB || !env.BUCKET) throw new RequestError('Cloud storage is temporarily unavailable.', 503);
  return {db: env.DB, bucket: env.BUCKET, key: apiKey()};
}
const apiKey = () => ((env as typeof env & {ANTHROPIC_API_KEY?: string}).ANTHROPIC_API_KEY || '').trim();
// Keys that are not tied to a workspace must name one on every request.
const workspaceId = () => ((env as typeof env & {ANTHROPIC_WORKSPACE_ID?: string}).ANTHROPIC_WORKSPACE_ID || '').trim();
// Articles get their own job slot so a day-long book batch never blocks them.
const slotFor = (userId: string, book: {sourceType?: string}) => book.sourceType === 'article' ? `${userId}#articles` : userId;
export function generationStatus() {
  const keyConfigured = !!apiKey();
  return {available: true, cloud: true, provider: 'anthropic-batch', connected: keyConfigured, keyConfigured,
    modelInstalled: keyConfigured, model: MODEL, autoGenerate: keyConfigured, completionWindow: '24h', maxUnits: MAX_UNITS,
    connectionState: keyConfigured ? 'configured' : 'needs_setup',
    message: keyConfigured ? 'Cloud AI is configured. Whole-book jobs can take up to 24 hours. Provider access is checked when a job is submitted.' : 'Cloud reading is ready. Add an Anthropic API key to the site to generate explanations.'};
}
export function requireProvider() {
  if (!runtime().key) throw new RequestError('Cloud AI needs its Anthropic API key. Your book is saved and ready to read.', 503);
}
class ProviderError extends Error {
  constructor(message: string, public uncertain = false, public status = 0, public reason = '') { super(message); }
}
/** Anthropic's short error reason. Article text is never echoed in these, but keep it brief anyway. */
async function errorReason(response: Response) {
  try {
    const text = (await response.text()).slice(0, 4000);
    const message = JSON.parse(text)?.error?.message;
    return typeof message === 'string' ? message.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  } catch { return ''; }
}
const outOfCredit = (reason: string) => /credit balance|billing|purchase credits/i.test(reason);
const noWorkspace = (reason: string) => /anthropic-workspace-id|not scoped to a workspace/i.test(reason);
export async function provider(path: string, init: RequestInit = {}, timeoutMs = 20000) {
  requireProvider();
  // The API key only ever goes to the Anthropic API, including for result links it returns.
  const target = path.startsWith('https://') ? path : `${API}${path}`;
  if (new URL(target).origin !== new URL(API).origin) throw new ProviderError('The AI provider returned an unexpected link.');
  let response: Response;
  try {
    response = await fetch(target, {...init, signal: AbortSignal.timeout(timeoutMs), headers: {'x-api-key': runtime().key, 'anthropic-version': '2023-06-01', ...(workspaceId() ? {'anthropic-workspace-id': workspaceId()} : {}), ...init.headers}});
  } catch { throw new ProviderError('The AI connection timed out. Existing progress is saved.', true); }
  if (!response.ok) {
    // Only the provider's short error reason is kept, never a response body.
    const reason = response.status === 400 ? await errorReason(response) : (await response.body?.cancel(), '');
    const message = response.status === 401 || response.status === 403 ? 'The Anthropic API key was not accepted. Check the key saved on the site.'
      : response.status === 429 ? 'The AI provider reached a rate limit. Retry later.'
      : response.status === 400 && outOfCredit(reason) ? 'The Anthropic account is out of credits. Add credits at console.anthropic.com, then retry.'
      : response.status === 400 && noWorkspace(reason) ? 'The Anthropic key is not linked to a workspace. Create a new key inside a workspace at console.anthropic.com, save it in Cloudflare as ANTHROPIC_API_KEY, then retry.'
      : response.status === 400 ? `The AI provider could not accept this request (HTTP 400)${reason ? `: ${reason}` : '.'}`
      : `The AI provider could not accept this request (HTTP ${response.status}).`;
    throw new ProviderError(message, response.status >= 500 || response.status === 529, response.status, reason);
  }
  return response;
}
export async function providerJson(path: string, body?: unknown, timeoutMs?: number) {
  const r = await provider(path, body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}, timeoutMs);
  return r.json() as Promise<Record<string, any>>;
}
export async function boundedText(response: Response) {
  if (Number(response.headers.get('content-length')) > MAX_FILE) throw new ProviderError('The generated file exceeds the supported size. Your source is safe.');
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError('The generated file is empty.');
  let length = 0, result = ''; const decoder = new TextDecoder();
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    length += value.length;
    if (length > MAX_FILE) { await reader.cancel(); throw new ProviderError('The generated file exceeds the supported size.'); }
    result += decoder.decode(value, {stream: true});
  }
  return result + decoder.decode();
}
async function readJob(slot: string) {
  const row = await runtime().db.prepare('SELECT job_id, job_json FROM generation_jobs WHERE user_id = ?').bind(slot).first<Row>();
  return row && row.job_json !== '{}' ? JSON.parse(row.job_json) as Job : null;
}
async function withLease<T>(userId: string, action: (job: Job | null, save: (job: Job) => Promise<void>) => Promise<T>): Promise<T> {
  const {db} = runtime(), token = crypto.randomUUID(), until = Date.now() + 180000;
  await db.prepare("INSERT INTO generation_jobs (user_id, job_id, job_json, lease_token, lease_until, updated_at) VALUES (?, '', '{}', '', 0, ?) ON CONFLICT(user_id) DO NOTHING").bind(userId, now()).run();
  const locked = await db.prepare('UPDATE generation_jobs SET lease_token = ?, lease_until = ? WHERE user_id = ? AND lease_until < ? RETURNING job_id, job_json').bind(token, until, userId, Date.now()).first<Row>();
  if (!locked) throw new RequestError('This book is already being updated. Retry in a moment.', 409);
  const save = async (job: Job) => {
    job.updatedAt = now();
    const result = await db.prepare('UPDATE generation_jobs SET job_id = ?, job_json = ?, updated_at = ?, lease_until = ? WHERE user_id = ? AND lease_token = ?').bind(job.id, JSON.stringify(job), job.updatedAt, Date.now() + 180000, userId, token).run();
    if (result.meta.changes !== 1) throw new RequestError('The generation update was interrupted. Please refresh.', 409);
  };
  try { return await action(locked.job_json === '{}' ? null : JSON.parse(locked.job_json) as Job, save); }
  finally { await db.prepare("UPDATE generation_jobs SET lease_token = '', lease_until = 0 WHERE user_id = ? AND lease_token = ?").bind(userId, token).run(); }
}
function sourceUnits(book: Book, job: Job) {
  const units = new Map(planBook(book).units.map((u: any) => [u.id, u]));
  return (job.batchUnits || []).map(id => {
    const unit = units.get(id);
    if (!unit) throw new RequestError('This job no longer matches its original EPUB.', 409);
    return unit as any;
  });
}
async function submit(userId: string, book: Book, job: Job, save: (j: Job) => Promise<void>) {
  const pending = job.units.filter(u => u.status !== 'completed' && u.attempts < MAX_ATTEMPTS);
  if (!pending.length) { job.status = job.units.every(u => u.status === 'completed') ? 'completed' : 'completed_with_errors'; await save(job); return; }
  requireProvider();
  job.batchUnits = pending.map(u => u.id); job.submissionId = crypto.randomUUID(); job.batchId = undefined;
  job.outputKey = undefined; job.outputCursor = 0; job.processed = 0; job.error = '';
  if (job.mode === 'direct') return submitDirect(userId, book, job, pending, save);
  const requests = batchRequests(book, sourceUnits(book, job));
  job.status = 'submitting'; job.submissionStartedAt = now();
  for (const unit of pending) { unit.attempts++; unit.status = 'queued'; unit.error = ''; }
  await save(job); // Durable marker precedes any billable batch creation.
  try {
    const batch = await providerJson('/messages/batches', {requests}, 60000);
    if (!batch.id) throw new ProviderError('The AI provider did not confirm the batch ID.', true);
    job.batchId = batch.id; job.providerStatus = batch.processing_status; job.status = 'running';
    for (const unit of pending) unit.status = 'running';
  } catch (error) {
    const uncertain = error instanceof ProviderError && error.uncertain;
    job.status = uncertain ? 'submission_unknown' : 'failed';
    job.error = uncertain ? 'The provider may have accepted this book. read. will check for that existing job before sending anything again.' : error instanceof Error ? error.message : 'The job could not be submitted.';
    if (!uncertain) for (const unit of pending) { unit.status = 'failed'; unit.error = job.error; }
  }
  await save(job);
}
/** Articles are short: one full-price request per section, ready in minutes instead of a day. */
async function submitDirect(userId: string, book: Book, job: Job, pending: Unit[], save: (j: Job) => Promise<void>) {
  const units = sourceUnits(book, job);
  job.status = 'running'; job.submissionStartedAt = now();
  for (const unit of pending) { unit.attempts++; unit.status = 'running'; unit.error = ''; }
  await save(job);
  for (const [i, source] of units.entries()) {
    const unit = job.units.find(u => u.id === source.id)!;
    try {
      // A reply the code cannot build a lesson from (cut off, or core content missing)
      // gets one fresh request. Provider errors (key, credit, rate limit) are not retried.
      let parsed: {unitId: string; guide?: GuideRecord['guide']; error?: string} = {unitId: unit.id};
      for (let attempt = 0; attempt < 2 && !parsed.guide; attempt++) {
        const message = await providerJson('/messages', lessonRequest(book, source), 170000);
        parsed = parseBatchResult({custom_id: `unit-${i}`, result: {type: 'succeeded', message}}, units);
      }
      if (parsed.guide) {
        await saveGuide(userId, {bookId: job.bookId, chapterId: unit.chapterId, unitId: unit.id, sourceHash: job.sourceHash, prepared: false, model: MODEL, createdAt: now(), guide: parsed.guide});
        unit.status = 'completed'; unit.error = '';
      } else { unit.status = 'failed'; unit.error = parsed.error; }
    } catch (error) { unit.status = 'failed'; unit.error = error instanceof Error ? error.message : 'The AI provider could not complete this section.'; }
    job.processed = (job.processed || 0) + 1;
    await save(job); // Also renews the lease between sections.
  }
  job.status = job.units.every(u => u.status === 'completed') ? 'completed' : 'completed_with_errors';
  // The panel shows job.error, so a failure carries the provider's own reason, not a generic line.
  const reason = job.units.find(u => u.status === 'failed' && u.error)?.error;
  job.error = job.status === 'completed' ? '' : reason || 'Completed guides are saved. Some sections need a retry.';
  await save(job);
}
export async function startGeneration(userId: string, bookId: string) {
  safeKey(bookId, 'Book ID');
  const book = await getBook(userId, bookId);
  if (!book) throw new RequestError('Import this EPUB before generating its explanations.', 404);
  return withLease(slotFor(userId, book), async (existing, save) => {
    const hash = await sourceHash(book);
    // A failed article costs cents to redo, so asking again starts it fresh instead of returning the failure.
    const failedArticle = existing?.mode === 'direct' && ['completed_with_errors', 'failed'].includes(existing.status);
    if (existing?.bookId === bookId && existing.sourceHash === hash && !failedArticle) return publicJob(existing);
    let plan;
    try { plan = generationPlan(book, await getGuides(userId, bookId)); } catch (error) { throw new RequestError(error instanceof Error ? error.message : 'This book cannot be prepared.'); }
    const job: Job = {id: crypto.randomUUID(), bookId, bookTitle: book.title, sourceHash: hash, model: MODEL, mode: book.sourceType === 'article' ? 'direct' : 'batch', status: 'queued', createdAt: now(), updatedAt: now(), skipped: plan.skipped,
      units: plan.units.map(({id, chapterId, chapterTitle, part, totalParts, status, attempts}: any) => ({id, chapterId, chapterTitle, part, totalParts, status, attempts}))};
    // Fully covered imports do not need a new provider job or disturb another book.
    if (job.units.every(u => u.status === 'completed')) return publicJob({...job, status: 'completed'});
    if (existing && ACTIVE.has(existing.status) && !directStale(existing)) throw new RequestError(book.sourceType === 'article' ? `Your article is saved. Its explanation starts once ${existing.bookTitle} finishes, in a few minutes.` : `Your EPUB is saved. Finish or cancel the current book, ${existing.bookTitle}, then choose Generate whole book for this one.`, 409);
    requireProvider();
    await save(job); await submit(userId, book, job, save); return publicJob(job);
  });
}
function directStale(job: Job) {
  return job.mode === 'direct' && job.status === 'running' && Date.parse(job.updatedAt) < Date.now() - DIRECT_STALE_MS;
}
async function recoverSubmission(job: Job) {
  // A lost POST response must never silently create a second paid job. Message
  // batches carry no metadata, so adopt a batch only when exactly one was created
  // after this submission started with exactly this many requests.
  const since = Date.parse(job.submissionStartedAt || '') - 60000, size = job.batchUnits?.length || 0;
  const matches: Record<string, any>[] = []; let after = '';
  for (let page = 0; page < 5; page++) {
    const list = await providerJson(`/messages/batches?limit=100${after ? `&after_id=${encodeURIComponent(after)}` : ''}`);
    const data: Record<string, any>[] = list.data || [];
    for (const b of data) {
      const c = b.request_counts || {};
      const total = ['processing', 'succeeded', 'errored', 'canceled', 'expired'].reduce((n, k) => n + Number(c[k] || 0), 0);
      if (Date.parse(b.created_at) >= since && total === size) matches.push(b);
    }
    // Newest batches come first; older pages cannot hold this submission.
    if (!list.has_more || !list.last_id || data.some(b => Date.parse(b.created_at) < since)) break;
    after = list.last_id;
  }
  if (matches.length === 1) { const found = matches[0]; job.batchId = found.id; job.status = 'running'; job.providerStatus = found.processing_status; job.error = ''; return; }
  job.status = 'submission_unknown';
  job.error = 'Submission is unconfirmed. Recheck later; read. will not send a duplicate paid job. If this persists, inspect this job in the Anthropic Console.';
}
async function collect(userId: string, book: Book, job: Job, batch: Record<string, any>, save: (j: Job) => Promise<void>) {
  const {bucket} = runtime();
  if (!job.outputKey) {
    if (!batch.results_url) throw new ProviderError('The AI provider did not return a results link.');
    const text = await boundedText(await provider(batch.results_url, {}, 60000));
    if (new TextEncoder().encode(text).length > MAX_FILE) throw new ProviderError('The generated output exceeds the supported size.');
    job.outputKey = `generation/${await digest(userId)}/${job.id}/${job.submissionId}.jsonl`;
    await bucket.put(job.outputKey, text, {httpMetadata: {contentType: 'application/jsonl'}});
    job.status = 'collecting'; job.outputCursor = 0; await save(job);
  }
  const object = await bucket.get(job.outputKey);
  if (!object) throw new ProviderError('The generated output is temporarily unavailable.');
  const lines = (await object.text()).split('\n').filter(Boolean), units = sourceUnits(book, job);
  const end = Math.min(lines.length, (job.outputCursor || 0) + 12);
  for (let i = job.outputCursor || 0; i < end; i++) {
    let parsed;
    try { parsed = parseBatchResult(JSON.parse(lines[i]), units); }
    catch { continue; } // Unknown provider rows never enter a book's guide store.
    const unit = job.units.find(u => u.id === parsed.unitId);
    if (!unit || unit.status === 'completed') continue;
    if (parsed.guide) {
      const guide: GuideRecord = {bookId: job.bookId, chapterId: unit.chapterId, unitId: unit.id, sourceHash: job.sourceHash, prepared: false, model: MODEL, createdAt: now(), guide: parsed.guide};
      await saveGuide(userId, guide); unit.status = 'completed'; unit.error = '';
    } else {
      unit.status = 'failed'; unit.error = parsed.error;
    }
  }
  job.outputCursor = end;
  if (end >= lines.length) {
    for (const unit of job.units) if (unit.status !== 'completed' && job.batchUnits?.includes(unit.id)) { unit.status = 'failed'; unit.error ||= batch.status === 'cancelled' ? 'This section was cancelled before completion.' : 'No valid explanation was returned for this section.'; }
    job.status = job.units.every(u => u.status === 'completed') ? 'completed' : batch.status === 'cancelled' ? 'cancelled' : 'completed_with_errors';
    job.error = job.status === 'completed' ? '' : 'Completed guides are saved. Some sections need a retry.';
  }
  await save(job);
}
async function findJob(userId: string, match: (job: Job) => boolean) {
  for (const slot of [userId, `${userId}#articles`]) {
    const job = await readJob(slot);
    if (job && match(job)) return {slot, job};
  }
  return null;
}
export async function refreshJob(userId: string, bookId?: string) {
  const found = await findJob(userId, job => !bookId || job.bookId === bookId);
  if (!found) return null;
  const {slot, job: initial} = found;
  if (initial.mode === 'direct') {
    // The submitting request does the work; polling only reads, except to release an interrupted one.
    if (!directStale(initial)) return publicJob(initial);
    return withLease(slot, async (job, save) => {
      if (!job || job.id !== initial.id || !directStale(job)) return job ? publicJob(job) : null;
      for (const unit of job.units) if (unit.status !== 'completed') { unit.status = 'failed'; unit.error = 'The explanation was interrupted. Retry this section.'; }
      job.status = 'completed_with_errors'; job.error = 'Completed guides are saved. Some sections need a retry.';
      await save(job); return publicJob(job);
    });
  }
  const hasSavedOutput = initial.status === 'collecting' && !!initial.outputKey;
  if (!ACTIVE.has(initial.status) || (!generationStatus().keyConfigured && !hasSavedOutput)) return publicJob(initial);
  if (initial.status !== 'collecting' && (initial.lastCheckedAt || 0) > Date.now() - 15000) return publicJob(initial);
  return withLease(slot, async (job, save) => {
    if (!job || (bookId && job.bookId !== bookId)) return null;
    if (!ACTIVE.has(job.status)) return publicJob(job);
    const book = await getBook(userId, job.bookId);
    if (!book || await sourceHash(book) !== job.sourceHash) throw new RequestError('The saved job does not match this EPUB.', 409);
    try {
      if (job.status === 'collecting' && job.outputKey) {
        // Saved terminal output can be validated without an API key or another provider request.
        await collect(userId, book, job, {status: job.providerStatus === 'cancelled' ? 'cancelled' : 'completed'}, save);
      } else {
        if (['submitting', 'submission_unknown'].includes(job.status)) await recoverSubmission(job);
        if (job.batchId) {
          const batch = await providerJson(`/messages/batches/${encodeURIComponent(job.batchId)}`);
          const c = batch.request_counts || {};
          job.processed = ['succeeded', 'errored', 'canceled', 'expired'].reduce((n, k) => n + Number(c[k] || 0), 0);
          if (batch.processing_status === 'ended') {
            const cancelled = job.status === 'cancelling' || !!batch.cancel_initiated_at;
            job.providerStatus = cancelled ? 'cancelled' : 'completed';
            await collect(userId, book, job, {status: job.providerStatus, results_url: batch.results_url}, save);
          } else if (batch.processing_status === 'canceling') { job.providerStatus = 'cancelling'; job.status = 'cancelling'; }
          else { job.providerStatus = 'in_progress'; job.status = 'running'; }
        } else if (job.status === 'queued') {
          job.status = 'failed'; job.error = 'The upload was interrupted before a batch was submitted. Retry to start it.';
          for (const unit of job.units) if (unit.status !== 'completed') { unit.status = 'failed'; unit.error = job.error; }
        }
      }
    } catch (error) { job.error = error instanceof Error ? error.message : 'The job status could not be refreshed.'; }
    job.lastCheckedAt = Date.now(); await save(job); return publicJob(job);
  });
}
export async function actOnJob(userId: string, jobId: string, action: string) {
  const found = await findJob(userId, job => job.id === jobId);
  return withLease(found?.slot || userId, async (job, save) => {
    if (!job || job.id !== jobId) throw new RequestError('This generation job was not found.', 404);
    if (action === 'cancel') {
      if (!job.batchId && ['submission_unknown', 'submitting'].includes(job.status)) await recoverSubmission(job);
      if (job.batchId && ACTIVE.has(job.status)) {
        await providerJson(`/messages/batches/${encodeURIComponent(job.batchId)}/cancel`, {});
        job.status = 'cancelling'; job.error = 'Cancellation requested. Sections already finished can still be charged.';
        await save(job);
      }
    } else if (action === 'recheck') {
      if (!['completed_with_errors', 'failed', 'cancelled'].includes(job.status)) throw new RequestError('Wait for the current batch before rechecking saved output.', 409);
      if (!job.outputKey) throw new RequestError('This job has no saved output to recheck.', 409);
      const book = await getBook(userId, job.bookId);
      if (!book || await sourceHash(book) !== job.sourceHash) throw new RequestError('This job no longer matches its source EPUB.', 409);
      // Revalidate the original output only. Completed guides and paid-attempt counts stay intact.
      if (job.status === 'cancelled') job.providerStatus = 'cancelled';
      job.status = 'collecting'; job.outputCursor = 0; job.error = '';
      await collect(userId, book, job, {status: job.providerStatus === 'cancelled' ? 'cancelled' : 'completed'}, save);
    } else if (action === 'retry') {
      if (!['completed_with_errors', 'failed', 'cancelled'].includes(job.status)) throw new RequestError('Wait for the current batch before retrying sections.', 409);
      const book = await getBook(userId, job.bookId);
      if (!book || await sourceHash(book) !== job.sourceHash) throw new RequestError('This job no longer matches its source EPUB.', 409);
      // Articles are cheap direct requests, so their retry limit resets on each explicit retry.
      if (job.mode === 'direct') for (const unit of job.units) if (unit.status !== 'completed') unit.attempts = 0;
      if (!job.units.some(u => u.status !== 'completed' && u.attempts < MAX_ATTEMPTS)) throw new RequestError('These sections reached the two-attempt limit. Your completed guides and original text remain available.', 409);
      await submit(userId, book, job, save);
    } else throw new RequestError('Unknown generation action.', 400);
    return publicJob(job);
  });
}
