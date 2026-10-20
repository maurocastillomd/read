import {env} from 'cloudflare:workers';
import {getBook} from './cloud-store';
import {digest, RequestError, safeKey, sourceHash, type Book} from './cloud-validation';
import {MODEL} from './generation-core.mjs';
import {providerJson} from './cloud-generation';
import catalog from './reading-catalog.json';
import {curatedRecommendations, parseRecommendationResponse, recommendationRequest, resolvePicks} from './reading-recommendations-core.mjs';

type Recommendation = {id: string; title: string; author: string; url: string; connection: string; application: string; readingOrderReason: string};
type Ready = {status: 'ready'; recommendations: Recommendation[]; basis: 'curated' | 'sampled'; basisLabel: string; sourceHash: string; createdAt?: string};
type Failure = {status: 'error'; error: string; retryAt: string; sourceHash: string};
type Pending = {status: 'generating'; retryAt: string; sourceHash: string};
type Cached = Ready | Failure | Pending;
type Rate = {lastAttemptAt: number; windowStartedAt: number; windowAttempts: number};
const RETRY_DELAY = 10 * 60 * 1000, LEASE_MS = 120000, HOUR = 60 * 60 * 1000, MAX_HOURLY = 10;
const sampledLabel = 'AI suggestions from this book’s title, chapter titles, and short excerpts, selected from a verified reading catalog. Connections are suggestions based on a sample.';
const curatedLabel = 'A curated path connecting this book’s main themes to related reading.';
function runtime() {
  if (!env.DB || !env.BUCKET) throw new RequestError('Your reading path could not reach cloud storage. Please retry later.', 503);
  // The same Anthropic key the lessons use; no second AI account is needed.
  return {db: env.DB, bucket: env.BUCKET, key: ((env as typeof env & {ANTHROPIC_API_KEY?: string}).ANTHROPIC_API_KEY || '').trim()};
}
async function context(userId: string, bookId: string) {
  safeKey(bookId, 'Book ID');
  const book = await getBook(userId, bookId);
  if (!book) throw new RequestError('Save this book in your library before finding its next reads.', 404);
  const hash = await sourceHash(book), owner = await digest(userId);
  return {book, hash, lockId: `recommendations:${owner}`, key: `recommendations/v3/${owner}/${hash}.json`};
}
async function cached(key: string, hash: string, book: Book): Promise<Cached | null> {
  const object = await runtime().bucket.get(key);
  if (!object) return null;
  try {
    const result = await object.json<Cached>();
    if (result.sourceHash !== hash) return null;
    if (result.status === 'ready' && ['curated', 'sampled'].includes(result.basis)) return {...result, recommendations: resolvePicks(result.recommendations, catalog, book)};
    if (result.status === 'error' && typeof result.error === 'string' && Number.isFinite(Date.parse(result.retryAt))) return result;
    if (result.status === 'generating' && Number.isFinite(Date.parse(result.retryAt))) {
      if (Date.parse(result.retryAt) > Date.now()) return result;
      return {status: 'error', error: 'The previous request was interrupted. You can retry manually; an earlier AI request may have been processed.', retryAt: result.retryAt, sourceHash: hash};
    }
  } catch { /* Invalid records never become book recommendations. */ }
  return null;
}
async function save(key: string, value: Cached) {
  await runtime().bucket.put(key, JSON.stringify(value), {httpMetadata: {contentType: 'application/json'}});
}
function curated(book: Book, hash: string): Ready | null {
  const recommendations = curatedRecommendations(catalog, book);
  return recommendations ? {status: 'ready', recommendations, basis: 'curated', basisLabel: curatedLabel, sourceHash: hash} : null;
}
export async function getRecommendations(userId: string, bookId: string) {
  const ctx = await context(userId, bookId);
  return curated(ctx.book, ctx.hash) || await cached(ctx.key, ctx.hash, ctx.book) || {
    status: 'missing', available: !!runtime().key,
    message: runtime().key ? 'Build a complementary reading path for this book.' : 'Connect cloud AI to build a reading path. Your book remains available.',
  };
}
export async function createRecommendations(userId: string, bookId: string) {
  const ctx = await context(userId, bookId), prepared = curated(ctx.book, ctx.hash);
  if (prepared) return prepared;
  const initial = await cached(ctx.key, ctx.hash, ctx.book);
  if (initial && (initial.status === 'ready' || Date.parse(initial.retryAt) > Date.now())) return initial;
  const {db, key} = runtime();
  if (!key) throw new RequestError('Cloud AI needs its secure connection before creating a reading path.', 503);
  const token = crypto.randomUUID(), now = Date.now();
  // An isolated row reuses the existing D1 lease primitive. Whole-book job rows
  // retain their original owner ID and are never read or changed here.
  await db.prepare("INSERT INTO generation_jobs (user_id, job_id, job_json, lease_token, lease_until, updated_at) VALUES (?, '', '{}', '', 0, ?) ON CONFLICT(user_id) DO NOTHING").bind(ctx.lockId, new Date(now).toISOString()).run();
  const locked = await db.prepare('UPDATE generation_jobs SET lease_token = ?, lease_until = ? WHERE user_id = ? AND lease_until < ? RETURNING job_json').bind(token, now + LEASE_MS, ctx.lockId, now).first<{job_json: string}>();
  if (!locked) throw new RequestError('A reading path is already being prepared. Retry in a moment.', 409);
  try {
    const existing = await cached(ctx.key, ctx.hash, ctx.book);
    if (existing && (existing.status === 'ready' || Date.parse(existing.retryAt) > Date.now())) return existing;
    let rate: Rate; try {rate = JSON.parse(locked.job_json);} catch {rate = {lastAttemptAt: 0, windowStartedAt: now, windowAttempts: 0};}
    if (!rate.windowStartedAt || now - rate.windowStartedAt >= HOUR) rate = {lastAttemptAt: rate.lastAttemptAt || 0, windowStartedAt: now, windowAttempts: 0};
    const nextAllowed = Math.max((rate.lastAttemptAt || 0) + 60000, (rate.windowAttempts || 0) >= MAX_HOURLY ? rate.windowStartedAt + HOUR : 0);
    if (nextAllowed > now) {
      const limited: Failure = {status: 'error', error: 'Reading paths are limited to one new request per minute and ten per hour. Please try again after the time shown.', retryAt: new Date(nextAllowed).toISOString(), sourceHash: ctx.hash};
      await save(ctx.key, limited); return limited;
    }
    const request = recommendationRequest(ctx.book, catalog, MODEL);
    rate.lastAttemptAt = now; rate.windowAttempts = (rate.windowAttempts || 0) + 1;
    await db.prepare('UPDATE generation_jobs SET job_json = ?, updated_at = ? WHERE user_id = ? AND lease_token = ?').bind(JSON.stringify(rate), new Date(now).toISOString(), ctx.lockId, token).run();
    const retryAt = new Date(now + RETRY_DELAY).toISOString();
    await save(ctx.key, {status: 'generating', retryAt, sourceHash: ctx.hash});
    try {
      let body: Record<string, unknown>;
      try {
        body = await providerJson('/messages', request, 40000);
      } catch (error) {
        throw new Error(error instanceof Error && error.message.startsWith('The ') ? error.message : 'The AI provider could not finish this reading path. Please retry later.');
      }
      const recommendations = parseRecommendationResponse(body, catalog, ctx.book);
      const result: Ready = {status: 'ready', recommendations, basis: 'sampled', basisLabel: sampledLabel, sourceHash: ctx.hash, createdAt: new Date().toISOString()};
      await save(ctx.key, result); return result;
    } catch (error) {
      const result: Failure = {status: 'error', error: error instanceof Error && error.message.startsWith('The ') ? error.message : 'The AI returned a reading path that could not be verified. Your book is unchanged; please retry later.', retryAt, sourceHash: ctx.hash};
      await save(ctx.key, result); return result;
    }
  } finally {
    await db.prepare("UPDATE generation_jobs SET lease_token = '', lease_until = 0 WHERE user_id = ? AND lease_token = ?").bind(ctx.lockId, token).run();
  }
}
