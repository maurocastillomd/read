import { normalizeParagraphs, planBook, validateGuide } from "./guide-core.mjs";

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Chapter = {id: string; title: string; text: string; label?: string; sourcePageStart?: number; sourcePageEnd?: number; partTitle?: string; partNumber?: number; partLabel?: string; studyRole?: 'orientation'|'chapter'|'reference'; notes?: Record<string, string>; figures?: Record<string, string>};
export type Book = {id: string; title: string; author: string; fullTitle: string; cover: string; chapters: Chapter[]; sourceFormat?: 'EPUB'|'PDF'|'DOCX'|'TXT'|'MD'|'HTML'; sourceType?: 'book'|'article'; sourceUrl?: string; importWarnings?: string[]; sourcePdf?: string};
export type GuideRecord = {bookId: string; unitId: string; chapterId: string; sourceHash: string; prepared: boolean; model: string; createdAt: string; guide: ReturnType<typeof validateGuide>};
export const areas = ["notes", "reviewed", "last", "checks", "hiddenBooks", "bookmarks"] as const;
export type Area = typeof areas[number];
export type StateChange = {area: Area; bookId: string; key: string; value: string | number | boolean | null};
const blocked = new Set(["__proto__", "prototype", "constructor"]);
export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
export function safeKey(value: unknown, name: string, limit = 500): string {
  if (typeof value !== "string" || !value.length || value.length > limit || blocked.has(value) || /[\u0000-\u001f]/.test(value)) throw new RequestError(`${name} is invalid.`);
  return value;
}
function text(value: unknown, name: string, limit: number, empty = true): string {
  if (typeof value !== "string" || value.length > limit || (!empty && !value.trim())) throw new RequestError(`${name} is invalid.`);
  return value;
}
// Endnotes keyed by their printed number, and figures keyed by the "![key]" line
// that places them. Figures are inline images or files bundled under /books/.
function chapterNotes(value: unknown): Record<string, string> {
  if (!record(value) || Object.keys(value).length > 1000) throw new RequestError("Chapter notes are invalid.");
  return Object.fromEntries(Object.entries(value).map(([key, note]) => {
    if (!/^\d{1,4}$/.test(key)) throw new RequestError("Chapter notes are invalid.");
    return [key, text(note, "Chapter note", 6000, false)];
  }));
}
function chapterFigures(value: unknown): Record<string, string> {
  if (!record(value) || Object.keys(value).length > 200) throw new RequestError("Chapter figures are invalid.");
  return Object.fromEntries(Object.entries(value).map(([key, src]) => {
    if (!/^[\w.-]{1,60}$/.test(key) || typeof src !== "string" || src.length > 700 * 1024 || !(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(src) || /^\/books\/[a-z0-9-]+\/[\w.-]+\.(?:jpe?g|png|webp|gif)$/.test(src))) throw new RequestError("Chapter figure is invalid.");
    return [key, src];
  }));
}
export function validateBook(value: unknown): Book {
  if (!record(value) || !Array.isArray(value.chapters) || !value.chapters.length || value.chapters.length > 5000) throw new RequestError("Choose a readable document with sections.");
  const book: Book = {
    id: safeKey(value.id, "Book ID"), title: text(value.title, "Book title", 2000, false), author: text(value.author, "Author", 2000),
    fullTitle: typeof value.fullTitle === "string" ? text(value.fullTitle, "Full title", 3000) : String(value.title),
    cover: typeof value.cover === "string" && /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(value.cover) && value.cover.length < 3 * 1024 * 1024 ? value.cover : "",
    chapters: value.chapters.map(c => {
      if (!record(c)) throw new RequestError("Chapter is invalid.");
      if (c.partTitle !== undefined) text(c.partTitle, "Part title", 200, false);
      if (c.partNumber !== undefined && (!Number.isInteger(c.partNumber) || Number(c.partNumber) < 1 || Number(c.partNumber) > 99)) throw new RequestError("Part number is invalid.");
      if (c.studyRole !== undefined && (typeof c.studyRole !== 'string' || !['orientation','chapter','reference'].includes(c.studyRole))) throw new RequestError("Study role is invalid.");
      return {id: safeKey(c.id, "Chapter ID"), title: text(c.title, "Chapter title", 3000), text: text(c.text, "Chapter text", 12 * 1024 * 1024),
        ...(c.label !== undefined ? {label: text(c.label, "Chapter label", 200, false)} : {}),
        ...(c.partLabel !== undefined ? {partLabel: text(c.partLabel, "Part label", 200, false)} : {}),
        ...(c.notes !== undefined ? {notes: chapterNotes(c.notes)} : {}),
        ...(c.figures !== undefined ? {figures: chapterFigures(c.figures)} : {}),
        ...(c.partTitle !== undefined ? {partTitle: c.partTitle as string} : {}),
        ...(c.partNumber !== undefined ? {partNumber: c.partNumber as number} : {}),
        ...(c.studyRole !== undefined ? {studyRole: c.studyRole as Chapter['studyRole']} : {}),
        ...(Number.isSafeInteger(c.sourcePageStart) && Number(c.sourcePageStart) > 0 && Number(c.sourcePageStart) < 10000 ? {sourcePageStart: Number(c.sourcePageStart)} : {}),
        ...(Number.isSafeInteger(c.sourcePageEnd) && Number(c.sourcePageEnd) > 0 && Number(c.sourcePageEnd) < 10000 ? {sourcePageEnd: Number(c.sourcePageEnd)} : {})};
    }),
  };
  if (value.sourceFormat !== undefined) {
    if (typeof value.sourceFormat !== 'string' || !['EPUB','PDF','DOCX','TXT','MD','HTML'].includes(value.sourceFormat)) throw new RequestError('Source format is invalid.');
    book.sourceFormat = value.sourceFormat as Book['sourceFormat'];
  }
  if (value.sourceType !== undefined) {
    if (value.sourceType !== 'book' && value.sourceType !== 'article') throw new RequestError('Source type is invalid.');
    book.sourceType = value.sourceType;
  }
  if (value.sourceUrl !== undefined) {
    const sourceUrl = text(value.sourceUrl, 'Source URL', 4000, false);
    let url: URL;
    try { url = new URL(sourceUrl); } catch { throw new RequestError('Source URL is invalid.'); }
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new RequestError('Source URL must use HTTP or HTTPS without credentials.');
    url.hash = ''; book.sourceUrl = url.href;
  }
  if (value.importWarnings !== undefined) {
    if (!Array.isArray(value.importWarnings) || value.importWarnings.length > 6) throw new RequestError('Import warnings are invalid.');
    book.importWarnings = value.importWarnings.map(warning => text(warning, 'Import warning', 600, false));
  }
  if (typeof value.sourcePdf === 'string' && /^\/books\/[a-z0-9-]+\.pdf$/.test(value.sourcePdf)) book.sourcePdf = value.sourcePdf;
  if (book.chapters.reduce((sum, c) => sum + new TextEncoder().encode(c.text).length, 0) > 12 * 1024 * 1024) throw new RequestError("This document exceeds the 12 MB extracted-text limit.", 413);
  try { planBook(book); } catch { throw new RequestError("Every chapter needs a unique ID and readable text."); }
  return book;
}
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, "0")).join("");
}
export async function sourceHash(book: Book) {
  return digest(JSON.stringify({id: book.id, title: book.title, author: book.author, chapters: book.chapters.map(({id, title, text}) => ({id, title, text}))}));
}
export async function validateGuideRecord(value: unknown, book: Book): Promise<GuideRecord> {
  if (!record(value)) throw new RequestError("Guide record is invalid.");
  if (value.bookId !== undefined && value.bookId !== book.id) throw new RequestError("A guide belongs to a different book.");
  const chapterId = safeKey(value.chapterId, "Guide chapter"), unitId = safeKey(value.unitId, "Guide unit");
  const hash = await sourceHash(book);
  // The first portable edition omitted hashes on its bundled guides. Its full
  // schema and every cited passage are still checked below before a hash is added.
  if (value.sourceHash !== undefined && value.sourceHash !== hash) throw new RequestError("A guide does not match this EPUB edition. Export it together with its original book.");
  const chapter = book.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new RequestError("A guide references an absent chapter.");
  const prepared = unitId === `${chapterId}:prepared`;
  const unit = prepared && unitId === `${chapterId}:prepared`
    ? {paragraphs: normalizeParagraphs(chapter)}
    : planBook(book, {includeSkipped: true}).units.find((u: {id: string; chapterId: string}) => u.id === unitId && u.chapterId === chapterId);
  if (!unit) throw new RequestError("A guide references an absent section.");
  let guide;
  try { guide = validateGuide(value.guide, unit); } catch (error) { throw new RequestError(`Guide validation failed: ${error instanceof Error ? error.message : "invalid structure"}`); }
  return {bookId: book.id, chapterId, unitId, sourceHash: hash, guide, prepared, model: typeof value.model === "string" ? text(value.model, "Guide model", 200) : "Imported companion", createdAt: typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt)) ? new Date(value.createdAt).toISOString() : new Date().toISOString()};
}
const bookmarkFields = ["version", "kind", "view", "chapterId", "unitId", "step", "title", "quote", "prefix", "suffix", "start", "end", "createdAt"];
const bookmarkViews = ["library", "overview", "guides", "explore", "reader", "notes", "learn", "setup"];
function validateBookmark(value: unknown): string {
  // Keep one JSON string per bookmark so existing field-level conflict handling,
  // portable backups, and deletion tombstones work without a schema migration.
  const serialized = text(value, "Bookmark", 100000, false);
  let bookmark: unknown;
  try { bookmark = JSON.parse(serialized); } catch { throw new RequestError("Bookmark must be valid JSON."); }
  if (!record(bookmark) || Object.keys(bookmark).some(field => !bookmarkFields.includes(field) && !["panel", "scroll"].includes(field)) || bookmarkFields.some(field => !Object.hasOwn(bookmark, field))) throw new RequestError("Bookmark fields are incomplete or invalid.");
  if (bookmark.version !== 1 || (typeof bookmark.kind !== "string" || !["place", "highlight"].includes(bookmark.kind)) || (typeof bookmark.view !== "string" || !bookmarkViews.includes(bookmark.view))) throw new RequestError("Bookmark type or location is invalid.");
  for (const field of ["chapterId", "unitId"]) {
    const id = text(bookmark[field], `Bookmark ${field}`, 700);
    if (id) safeKey(id, `Bookmark ${field}`, 700);
  }
  if (!Number.isInteger(bookmark.step) || Number(bookmark.step) < 0 || Number(bookmark.step) > 5) throw new RequestError("Bookmark lesson step is invalid.");
  if (Object.hasOwn(bookmark, "scroll") && (!Number.isInteger(bookmark.scroll) || Number(bookmark.scroll) < 0 || Number(bookmark.scroll) > 1000)) throw new RequestError("Bookmark scroll position is invalid.");
  if (Object.hasOwn(bookmark, "panel")) {
    const panelText = text(bookmark.panel, "Bookmark panel", 2000);
    let panel: unknown;
    try { panel = JSON.parse(panelText); } catch { throw new RequestError("Bookmark panel must be valid JSON."); }
    if (!record(panel)) throw new RequestError("Bookmark panel fields are invalid.");
    const numeric = ["concept", "path", "level", "inflow", "outflow", "feedback", "gain", "delay", "attention", "practiceIndex"];
    const boundedNumber = (item: unknown) => typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= 1000;
    for (const [key, item] of Object.entries(panel)) {
      const valid = numeric.includes(key) ? boundedNumber(item)
        : key === "answer" ? item === null || boundedNumber(item)
        : ["memory", "practiceReveal", "practiceOpen"].includes(key) ? typeof item === "boolean"
        : key === "mode" ? item === "balance" || item === "reinforce"
        : ["history", "feedbackHistory"].includes(key) ? Array.isArray(item) && item.length > 0 && item.length <= 100 && item.every(boundedNumber)
        : false;
      if (!valid) throw new RequestError("Bookmark panel fields are invalid.");
    }
  }
  text(bookmark.title, "Bookmark title", 1000);
  const quote = text(bookmark.quote, "Bookmark quote", 12000);
  text(bookmark.prefix, "Bookmark prefix", 120);
  text(bookmark.suffix, "Bookmark suffix", 120);
  for (const field of ["start", "end"]) if (!Number.isSafeInteger(bookmark[field]) || Number(bookmark[field]) < 0 || Number(bookmark[field]) > 20000000) throw new RequestError("Bookmark text position is invalid.");
  if (Number(bookmark.end) < Number(bookmark.start) || (bookmark.kind === "highlight" && !quote.trim()) || (quote !== "" && (!quote.trim() || Number(bookmark.end) === Number(bookmark.start)))) throw new RequestError("Bookmark selection is invalid.");
  if (typeof bookmark.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(bookmark.createdAt) || Number.isNaN(Date.parse(bookmark.createdAt))) throw new RequestError("Bookmark date is invalid.");
  const date = new Date(bookmark.createdAt);
  // Reject normalized invalid dates such as February 30 while accepting ISO UTC
  // timestamps with or without milliseconds.
  if (date.toISOString().slice(0, 19) !== bookmark.createdAt.slice(0, 19)) throw new RequestError("Bookmark date is invalid.");
  return serialized;
}
export function validateStateChange(value: unknown): StateChange {
  if (!record(value) || !areas.includes(value.area as Area)) throw new RequestError("Unknown state area.");
  const area = value.area as Area, bookId = safeKey(value.bookId, "Book ID");
  const nested = ["notes", "last", "checks", "bookmarks"].includes(area);
  const key = nested ? safeKey(value.key, "Field key", 700) : "";
  const v = value.value;
  if (v === null) return {area, bookId, key, value: null};
  if (area === "bookmarks") return {area, bookId, key, value: validateBookmark(v)};
  if (area === "notes") return {area, bookId, key, value: text(v, "Note", 100000)};
  if (area === "reviewed") {
    if (v !== false && (typeof v !== "string" || Number.isNaN(Date.parse(v)))) throw new RequestError("Review marker is invalid.");
  } else if (area === "checks" || area === "hiddenBooks") {
    if (typeof v !== "boolean") throw new RequestError("Check marker is invalid.");
  } else if (area === "last") {
    if (typeof v !== "string" && !(typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100000)) throw new RequestError("Reading position is invalid.");
    if (typeof v === "string") text(v, "Reading position", 1000);
  }
  return {area, bookId, key, value: v as string | number | boolean};
}
export function changesFromState(value: unknown): StateChange[] {
  if (!record(value)) throw new RequestError("Companion state is invalid.");
  const changes: StateChange[] = [];
  for (const area of areas) {
    const books = value[area];
    if (books === undefined) continue;
    if (!record(books)) throw new RequestError("Companion state area is invalid.");
    for (const [bookId, fields] of Object.entries(books)) {
      if (["notes", "last", "checks", "bookmarks"].includes(area)) {
        if (!record(fields)) throw new RequestError("Companion state fields are invalid.");
        for (const [key, fieldValue] of Object.entries(fields)) changes.push(validateStateChange({area, bookId, key, value: fieldValue}));
      } else changes.push(validateStateChange({area, bookId, value: fields}));
    }
  }
  if (changes.length > 10000) throw new RequestError("This backup has too many state fields.", 413);
  return changes;
}
