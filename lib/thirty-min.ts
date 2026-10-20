// The 30-min version of an uploaded book, written in the cloud. One Message Batch
// holds a request per section; when it ends, a small direct request writes the
// thread, opening and closing, and the finished version is stored next to the
// book. Bundled books ship theirs in the reader, so they never come here.
import {getBook} from './cloud-store';
import {boundedText, providerJson, provider, requireProvider, runtime} from './cloud-generation';
import {digest, RequestError, safeKey, sourceHash, type Book} from './cloud-validation';
import {MODEL, batchRowText, messageText} from './generation-core.mjs';
import {TM_PLAN_VERSION, assembleThirtyMin, frameFromText, frameRequest, sectionFromText, sectionRequest, thirtyMinPlan} from './thirty-min-maker.mjs';

type Section = {index: number; status: 'running' | 'done' | 'failed'; section?: Record<string, unknown>; error?: string};
type Draft = {status: 'submitting' | 'running' | 'failed' | 'ready'; sourceHash: string; batchId?: string; submittedAt: string;
  attempts: number; sections: Section[]; error?: string; lastCheckedAt?: number; version?: Record<string, unknown>};
const now = () => new Date().toISOString();
// A submission that never confirmed its batch is retried after this long.
const SUBMIT_STALE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 2;

async function draftKey(userId: string, bookId: string, hash: string) {
  return `thirty-min/${await digest(userId)}/${await digest(bookId)}/${hash}.v${TM_PLAN_VERSION}.json`;
}
async function readDraft(key: string) {
  const object = await runtime().bucket.get(key);
  return object ? object.json<Draft>() : null;
}
async function writeDraft(key: string, draft: Draft) {
  await runtime().bucket.put(key, JSON.stringify(draft), {httpMetadata: {contentType: 'application/json'}});
}
function publicDraft(draft: Draft | null) {
  if (!draft) return {status: 'none'};
  const total = draft.sections.length, done = draft.sections.filter(s => s.status === 'done').length;
  if (draft.status === 'ready') return {status: 'ready', version: draft.version, total, done};
  return {status: draft.status === 'failed' ? 'failed' : 'running', error: draft.error || '', total, done};
}
async function loadBook(userId: string, bookId: string) {
  safeKey(bookId, 'Book ID');
  const book = await getBook(userId, bookId);
  if (!book) throw new RequestError('Import this book before asking for its 30-min version.', 404);
  if (book.sourceType === 'article') throw new RequestError('Articles have a breakdown instead of a 30-min version.', 400);
  return book;
}
async function submit(book: Book, draft: Draft, key: string) {
  const sections = thirtyMinPlan(book), pending = draft.sections.filter(s => s.status !== 'done');
  draft.status = 'submitting'; draft.submittedAt = now(); draft.attempts++; draft.error = ''; draft.batchId = undefined;
  for (const s of pending) { s.status = 'running'; s.error = ''; }
  await writeDraft(key, draft); // Durable marker before the billable batch.
  try {
    const batch = await providerJson('/messages/batches', {requests: pending.map(s => ({custom_id: `section-${s.index}`, params: sectionRequest(MODEL, book, sections, sections[s.index])}))}, 60000);
    if (!batch.id) throw new Error('The AI provider did not confirm the batch.');
    draft.batchId = batch.id; draft.status = 'running';
  } catch (error) {
    draft.status = 'failed'; draft.error = error instanceof Error ? error.message : 'The 30-min version could not be started.';
  }
  await writeDraft(key, draft);
}
function planOrNull(book: Book) {
  try { return thirtyMinPlan(book); } catch { return null; }
}
export async function startThirtyMin(userId: string, bookId: string) {
  const book = await loadBook(userId, bookId);
  requireProvider();
  const hash = await sourceHash(book), key = await draftKey(userId, bookId, hash);
  let draft = await readDraft(key);
  const stuck = draft?.status === 'submitting' && Date.parse(draft.submittedAt) < Date.now() - SUBMIT_STALE_MS;
  if (draft && draft.status !== 'failed' && !stuck) return publicDraft(draft);
  // A book the plan cannot cover is refused here, before any paid request.
  const plan = planOrNull(book);
  if (!plan) return {status: 'unavailable', error: 'This book is too short for a 30-min version.'};
  // Asking again after a failure starts over on the sections still missing.
  if (!draft || draft.sections.length !== plan.length) draft = {status: 'submitting', sourceHash: hash, submittedAt: now(), attempts: 0, sections: plan.map(s => ({index: s.index, status: 'running'}))};
  else draft.attempts = Math.min(draft.attempts, MAX_ATTEMPTS - 1);
  await submit(book, draft, key);
  return publicDraft(draft);
}
async function finish(book: Book, draft: Draft) {
  const sections = draft.sections.map(s => s.section!);
  let frameText = '';
  try { frameText = messageText(await providerJson('/messages', frameRequest(MODEL, book, sections), 90000)); } catch {}
  // A frame that could not be written falls back to plain framing from the sections.
  const frame = frameFromText(frameText, book, sections);
  try {
    draft.version = assembleThirtyMin(book, frame, sections, {model: MODEL});
    draft.status = 'ready'; draft.error = '';
  } catch (error) { draft.status = 'failed'; draft.error = error instanceof Error ? error.message : 'The 30-min version did not pass its check.'; }
}
export async function refreshThirtyMin(userId: string, bookId: string) {
  const book = await loadBook(userId, bookId);
  const hash = await sourceHash(book), key = await draftKey(userId, bookId, hash);
  const draft = await readDraft(key);
  if (!draft && !planOrNull(book)) return {status: 'unavailable', error: 'This book is too short for a 30-min version.'};
  if (!draft || draft.status !== 'running' || !draft.batchId) return publicDraft(draft);
  if ((draft.lastCheckedAt || 0) > Date.now() - 30000) return publicDraft(draft);
  draft.lastCheckedAt = Date.now();
  try {
    const batch = await providerJson(`/messages/batches/${encodeURIComponent(draft.batchId)}`);
    if (batch.processing_status !== 'ended') { await writeDraft(key, draft); return publicDraft(draft); }
    const plan = thirtyMinPlan(book);
    const text = batch.results_url ? await boundedText(await provider(batch.results_url, {}, 60000)) : '';
    for (const line of text.split('\n').filter(Boolean)) {
      let row; try { row = JSON.parse(line); } catch { continue; }
      const index = Number(String(row?.custom_id || '').replace(/^section-/, '')), slot = draft.sections.find(s => s.index === index);
      if (!slot || slot.status === 'done' || !plan[index]) continue;
      const {text: reply, error} = batchRowText(row);
      const parsed: {section?: Record<string, unknown>; error?: string} = error ? {error} : sectionFromText(reply, plan[index]);
      if (parsed.section) { slot.status = 'done'; slot.section = parsed.section; slot.error = ''; }
      else { slot.status = 'failed'; slot.error = parsed.error; }
    }
    for (const s of draft.sections) if (s.status === 'running') { s.status = 'failed'; s.error = 'No section came back.'; }
    if (draft.sections.every(s => s.status === 'done')) await finish(book, draft);
    else if (draft.attempts < MAX_ATTEMPTS) { await submit(book, draft, key); return publicDraft(draft); }
    else { draft.status = 'failed'; draft.error = draft.sections.find(s => s.error)?.error || 'Some sections could not be written.'; }
  } catch (error) { draft.error = error instanceof Error ? error.message : 'The 30-min version could not be checked.'; }
  await writeDraft(key, draft);
  return publicDraft(draft);
}
