import { env } from "cloudflare:workers";
import { getUser } from "@/app/auth";
import seedLibrary from "./seed-library.json";
import { areas, changesFromState, digest, record, RequestError, safeKey, sourceHash, validateBook, validateGuideRecord, validateStateChange, type Book, type GuideRecord, type StateChange } from "./cloud-validation";

const MAX_BODY = 20 * 1024 * 1024;
// Books bundled with the app. The public edition ships none.
const seeds = seedLibrary as unknown as {book: Book; guides: GuideRecord[]}[];
type BookRow = {book_id: string; source_hash: string; object_key: string};
type GuideRow = {unit_id: string; object_key: string};
type StateRow = {area: typeof areas[number]; book_id: string; field_key: string; value_json: string};
const emptyState = () => ({notes: {}, reviewed: {}, last: {}, checks: {}, hiddenBooks: {}, bookmarks: {}}) as Record<string, Record<string, unknown>>;
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}});
function storage() {
  if (!env.DB || !env.BUCKET) throw new RequestError("Cloud storage is temporarily unavailable. Your device copy is still available.", 503);
  return {db: env.DB, bucket: env.BUCKET};
}
export async function apiRoute(request: Request, action: (userId: string) => Promise<unknown>) {
  try {
    const user = await getUser();
    if (!user) throw new RequestError("Sign in to open your private library.", 401);
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("origin");
      const site = request.headers.get("sec-fetch-site");
      if (origin !== new URL(request.url).origin || (site && !["same-origin", "none"].includes(site))) throw new RequestError("This change must come from your read. page.", 403);
    }
    const result = await action(user.userId);
    // A route may answer with its own response, such as a PDF for the device to read.
    return result instanceof Response ? result : json(result);
  } catch (error) {
    if (error instanceof RequestError) return json({error: error.message}, error.status);
    console.error("read. storage operation failed", error instanceof Error ? error.name : "UnknownError");
    return json({error: "Your cloud library could not be reached. Please retry; your device copy is kept."}, 503);
  }
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) throw new RequestError("Send application/json.", 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY) throw new RequestError("Import exceeds the 20 MB limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Request body is missing.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY) { await reader.cancel(); throw new RequestError("Import exceeds the 20 MB limit.", 413); }
    chunks.push(value);
  }
  const joined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(joined)); } catch { throw new RequestError("Request body must be valid JSON."); }
  if (!record(body)) throw new RequestError("Request body must be an object.");
  return body;
}
async function getObject<T>(key: string): Promise<T> {
  const object = await storage().bucket.get(key);
  if (!object) throw new RequestError("A saved library file is temporarily unavailable. Please retry.", 503);
  return object.json<T>();
}
async function userPrefix(userId: string) { return `library/${await digest(userId)}`; }
async function indexedBooks(userId: string) {
  return (await storage().db.prepare("SELECT book_id, source_hash, object_key FROM library_books WHERE user_id = ? ORDER BY updated_at DESC").bind(userId).all<BookRow>()).results;
}
export async function getBooks(userId: string) {
  const rows = await indexedBooks(userId), books: Book[] = [];
  // Bounded concurrency limits memory used by large book files in the Worker.
  for (const row of rows) books.push(await getObject<Book>(row.object_key));
  for (const entry of seeds) if (!books.some(b => b.id === entry.book.id)) books.push(entry.book);
  return books;
}
export async function getBook(userId: string, bookId: string): Promise<Book | null> {
  safeKey(bookId, "Book ID");
  const row = await storage().db.prepare("SELECT book_id, source_hash, object_key FROM library_books WHERE user_id = ? AND book_id = ?").bind(userId, bookId).first<BookRow>();
  return row ? getObject<Book>(row.object_key) : seeds.find(entry => entry.book.id === bookId)?.book || null;
}
async function ensureEdition(userId: string, book: Book) {
  const current = await getBook(userId, book.id);
  if (current && await sourceHash(current) !== await sourceHash(book)) throw new RequestError("A different edition uses this book ID in your library. Keep its existing notes and guides; import the other edition with a distinct EPUB identifier.", 409);
}
export async function saveBook(userId: string, book: Book) {
  await ensureEdition(userId, book);
  const {db, bucket} = storage(), hash = await sourceHash(book);
  const key = `${await userPrefix(userId)}/books/${await digest(book.id)}/${hash}.json`;
  await bucket.put(key, JSON.stringify(book), {httpMetadata: {contentType: "application/json"}});
  await db.prepare("INSERT INTO library_books (user_id, book_id, source_hash, object_key, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, book_id) DO UPDATE SET object_key = excluded.object_key, updated_at = excluded.updated_at WHERE library_books.source_hash = excluded.source_hash").bind(userId, book.id, hash, key, new Date().toISOString()).run();
  // Recheck handles concurrent imports with the same identifier but different text.
  await ensureEdition(userId, book);
  return book;
}
export async function getGuides(userId: string, bookId: string) {
  const book = await getBook(userId, bookId);
  if (!book) return [];
  const hash = await sourceHash(book);
  const rows = (await storage().db.prepare("SELECT unit_id, object_key FROM library_guides WHERE user_id = ? AND book_id = ? AND source_hash = ?").bind(userId, bookId, hash).all<GuideRow>()).results;
  const guides: GuideRecord[] = [];
  for (const row of rows) guides.push(await getObject<GuideRecord>(row.object_key));
  const matchingSeed = seeds.find(entry => entry.book.id === bookId);
  if (matchingSeed && await sourceHash(matchingSeed.book) === hash) {
    for (const guide of matchingSeed.guides) {
      const index = guides.findIndex(g => g.unitId === guide.unitId);
      const current = {...guide, bookId, sourceHash: hash};
      // Bundled teaching can be revised without changing the original book.
      // Refresh only those prepared units; personal/generated units stay intact.
      if (index < 0) guides.push(current);
      else if (guide.prepared && guide.unitId === `${guide.chapterId}:prepared`) guides[index] = current;
    }
  }
  return guides;
}
export async function saveGuide(userId: string, guide: GuideRecord) {
  const {db, bucket} = storage();
  const data = JSON.stringify(guide), key = `${await userPrefix(userId)}/guides/${await digest(guide.bookId)}/${guide.sourceHash}/${await digest(guide.unitId)}/${await digest(data)}.json`;
  await bucket.put(key, data, {httpMetadata: {contentType: "application/json"}});
  // Existing successful work wins same-section conflicts. R2 objects are immutable,
  // and the D1 insert is atomic, including when two devices import simultaneously.
  await db.prepare("INSERT INTO library_guides (user_id, book_id, source_hash, unit_id, object_key, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, book_id, source_hash, unit_id) DO NOTHING").bind(userId, guide.bookId, guide.sourceHash, guide.unitId, key, new Date().toISOString()).run();
}
export async function getState(userId: string) {
  const rows = (await storage().db.prepare("SELECT area, book_id, field_key, value_json FROM library_state WHERE user_id = ?").bind(userId).all<StateRow>()).results;
  const state = emptyState();
  for (const row of rows) {
    const value = JSON.parse(row.value_json);
    // Deleted fields remain tombstones so an old portable backup cannot resurrect them.
    if (value === null) continue;
    if (["notes", "last", "checks", "bookmarks"].includes(row.area)) {
      state[row.area][row.book_id] ||= {};
      (state[row.area][row.book_id] as Record<string, unknown>)[row.field_key] = value;
    } else state[row.area][row.book_id] = value;
  }
  return state;
}
export async function writeChanges(userId: string, changes: StateChange[], missingOnly = false) {
  const {db} = storage(), now = new Date().toISOString();
  const suffix = missingOnly ? "DO NOTHING" : "DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at";
  const statements = changes.map(c => db.prepare(`INSERT INTO library_state (user_id, area, book_id, field_key, value_json, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, area, book_id, field_key) ${suffix}`).bind(userId, c.area, c.bookId, c.key, JSON.stringify(c.value), now));
  for (let i = 0; i < statements.length; i += 80) await db.batch(statements.slice(i, i + 80));
}
export function stateChanges(body: Record<string, unknown>) {
  if (!Array.isArray(body.changes) || body.changes.length > 500) throw new RequestError("Send up to 500 individual changes at a time.");
  return body.changes.map(validateStateChange);
}
export async function importCompanion(userId: string, body: Record<string, unknown>) {
  if (!Array.isArray(body.books) || !body.books.length || body.books.length > 100 || !Array.isArray(body.guides) || body.guides.length > 10000) throw new RequestError("Choose a read. companion backup containing books and guides.");
  const books = body.books.map(validateBook), bookMap = new Map(books.map(b => [b.id, b]));
  if (bookMap.size !== books.length) throw new RequestError("This backup contains duplicate book IDs.");
  for (const book of books) await ensureEdition(userId, book);
  const guides: GuideRecord[] = [], ids = new Set<string>();
  for (const input of body.guides) {
    if (!record(input) || typeof input.bookId !== "string") throw new RequestError("Each guide needs its book ID.");
    const book = bookMap.get(input.bookId);
    if (!book) throw new RequestError("Each guide must include its original book in this backup.");
    const guide = await validateGuideRecord(input, book), id = `${guide.bookId}\n${guide.unitId}`;
    if (ids.has(id)) throw new RequestError("This backup contains duplicate section guides.");
    ids.add(id); guides.push(guide);
  }
  const changes = body.state === undefined ? [] : changesFromState(body.state);
  // Validate the entire archive before writing its contents. Retries are safe.
  for (const book of books) await saveBook(userId, book);
  for (const guide of guides) await saveGuide(userId, guide);
  await writeChanges(userId, changes, true);
  return {imported: {books: books.length, guides: guides.length, stateFields: changes.length}, books: await getBooks(userId), state: await getState(userId)};
}
