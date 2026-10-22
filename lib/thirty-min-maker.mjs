// Writes the 30-min version of an uploaded book with Claude, one request per section
// (a chapter, or a run of short chapters), then one small request that frames the
// whole: the thread, the opening and the closing. Claude returns a small JSON draft;
// this code fixes the shape, trims what is too long, drops broken pictures and
// checks the result with lib/thirty-min-core.mjs. Book lessons are untouched.
import {normalizeParagraphs, planBook} from './guide-core.mjs';
import {fit, readDraft} from './lesson-maker.mjs';
import {cleanScene, SCENE_HELP} from './scene-objects.mjs';
import {checkThirtyMin, TM_FIGURES, TM_WPM, thirtyMinWords} from './thirty-min-core.mjs';

export const TM_TARGET_WORDS = 6600;
export const TM_MAX_SECTIONS = 18;
export const TM_SECTION_TOKENS = 8000;
export const TM_FRAME_TOKENS = 3000;
const INTRO = /^(foreword|preface|prologue|introduction|intro\b|a note)/i;
const END = /^(afterword|epilogue|conclusion|final thoughts|closing|coda)/i;
// Bumped when the plan changes, so versions built under an older plan are rebuilt.
export const TM_PLAN_VERSION = 3;
// Front and back matter with no ideas of its own. planBook keeps some of these
// (a bare "Cover", "A Note about the Author") because lessons may still use them.
const MATTER = /^(?:(?:the )?cover|(?:half[- ])?title(?: page)?|copyright(?: page)?|dedication|epigraph|(?:table of )?contents|acknowledg(?:e)?ments?|(?:editor['’]s )?acknowledg(?:e)?ments?|(?:a )?note (?:about|on) the authors?|about the authors?|also by .+|(?:other|more) books(?: by .+)?|praise for .+|(?:end ?)?notes(?: and .+)?|index|bibliography(?: .+)?|references|permissions(?: acknowledg(?:e)?ments)?|credits|your free gift|did you enjoy .+)$/i;
export function thirtyMinSkips(chapter) {
  const title = String(chapter?.title || '').trim().replace(/[.:]+$/, '');
  return chapter?.studyRole === 'reference' || MATTER.test(title);
}

const words = text => (String(text || '').match(/\S+/g) || []).length;
const str = v => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
const list = v => Array.isArray(v) ? v : [];

/**
 * Sections in reading order. Chapters planBook would skip (contents, ads, notes,
 * about the author) stay out. Short chapters join their neighbours so no section
 * is thinner than about a fourteenth of the book, and there are never more than
 * TM_MAX_SECTIONS. A book with fewer than 3 sections has its longest ones split at
 * paragraph breaks (C5 · 1 of 2, 2 of 2); one that still cannot reach 3 is too short.
 * Each section gets its share of the 30 minutes.
 */
export function thirtyMinPlan(book) {
  const plan = planBook(book);
  const included = new Set(plan.units.map(u => u.chapterId));
  const chapters = book.chapters.filter(c => included.has(c.id) && !thirtyMinSkips(c)).map(c => {
    const paragraphs = normalizeParagraphs(c).map(p => p.text);
    return {chapter: c, paragraphs, words: paragraphs.reduce((n, p) => n + words(p), 0)};
  });
  const total = chapters.reduce((n, c) => n + c.words, 0);
  if (!chapters.length || total < 1500) throw new Error(TOO_SHORT);
  const floor = total / 14, groups = [], sectionsSoFar = [];
  const share = g => Math.round(Math.max(260, Math.min(2600, TM_TARGET_WORDS * g.words / total)));
  for (const c of chapters) {
    const last = groups[groups.length - 1], alone = INTRO.test(c.chapter.title) || END.test(c.chapter.title);
    if (last && !alone && !last.alone && last.words < floor && c.words < floor) { last.items.push(c); last.words += c.words; }
    else groups.push({items: [c], words: c.words, alone});
  }
  // Too many sections still: join the two smallest neighbours until it fits.
  while (groups.length > TM_MAX_SECTIONS) {
    let best = 0;
    for (let i = 1; i < groups.length - 1; i++) if (groups[i].words + groups[i + 1].words < groups[best].words + groups[best + 1].words) best = i;
    groups[best].items.push(...groups[best + 1].items); groups[best].words += groups[best + 1].words; groups.splice(best + 1, 1);
  }
  // Too few sections: split the longest at paragraph breaks.
  while (groups.length < TM_MIN_SECTIONS) {
    const at = groups.reduce((best, g, i) => g.words > groups[best].words ? i : best, 0), g = groups[at];
    const halves = g.items.length > 1 ? splitItems(g.items) : splitParagraphs(g.items[0]);
    if (!halves) break;
    groups.splice(at, 1, ...halves.map(items => ({items, words: items.reduce((n, c) => n + c.words, 0), alone: g.alone})));
  }
  if (groups.length < TM_MIN_SECTIONS) throw new Error(TOO_SHORT);
  // Pieces of one chapter read "1 of 3", "2 of 3"…
  for (let i = 0; i < groups.length; i++) {
    const item = groups[i].items[0];
    if (!item.piece || item.piece.n) continue;
    let k = i; while (groups[k + 1]?.items[0].chapter === item.chapter) k++;
    for (let j = i; j <= k; j++) groups[j].items[0].piece = {n: j - i + 1, of: k - i + 1};
  }
  let n = 0;
  return groups.map((g, i) => {
    const first = g.items[0].chapter, last = g.items[g.items.length - 1].chapter, piece = g.items[0].piece;
    const prev = groups[i - 1]?.items[0];
    if (piece && piece.n > 1 && prev?.chapter === first) {
      const base = sectionsSoFar[sectionsSoFar.length - 1];
      return keep({...base, index: i, label: fit(base.label.replace(/ · \d+ of \d+$/, '') + ` · ${piece.n} of ${piece.of}`, 40), title: fit(`${first.title} (${piece.n} of ${piece.of})`, 140), target: share(g), parts: g.items, part: [piece.n, piece.of]});
    }
    const label = g.items.length === 1 && first.label ? first.label
      : g.items.length === 1 && /^(?:chapter|part|book|section)\s+[\divxlc]+$/i.test(first.title.trim()) ? first.title.trim()
      : INTRO.test(first.title) && g.items.length === 1 ? 'Introduction'
      : END.test(first.title) && g.items.length === 1 ? 'Closing'
      : g.items.length === 1 ? 'Chapter ' + (++n) : `Chapters ${n + 1}–${(n += g.items.length)}`;
    const title = g.items.length === 1 ? first.title : `${first.title} to ${last.title}`;
    return keep({index: i, covers: g.items.map(c => c.chapter.id), label: fit(piece ? `${label} · ${piece.n} of ${piece.of}` : label, 40), title: fit(piece ? `${title} (${piece.n} of ${piece.of})` : title, 140), target: share(g), parts: g.items, ...(piece ? {part: [piece.n, piece.of]} : {})});
  });
  function keep(section) { sectionsSoFar.push(section); return section; }
}
export const TM_MIN_SECTIONS = 3;
const TOO_SHORT = 'This book is too short for a 30-min version.';
// Two halves of a run of chapters, split where the words balance best.
function splitItems(items) {
  const total = items.reduce((n, c) => n + c.words, 0);
  let acc = 0, cut = 1, best = Infinity;
  for (let i = 1; i < items.length; i++) { acc += items[i - 1].words; if (Math.abs(total / 2 - acc) < best) { best = Math.abs(total / 2 - acc); cut = i; } }
  return [items.slice(0, cut), items.slice(cut)];
}
// Two halves of one chapter (or of a piece of one), at the paragraph break nearest the middle.
function splitParagraphs(item) {
  const paragraphs = item.paragraphs;
  if (paragraphs.length < 2 || item.words < 600) return null;
  let acc = 0, cut = 1, best = Infinity;
  for (let i = 1; i < paragraphs.length; i++) { acc += words(paragraphs[i - 1]); if (Math.abs(item.words / 2 - acc) < best) { best = Math.abs(item.words / 2 - acc); cut = i; } }
  const half = list => ({chapter: item.chapter, paragraphs: list, words: list.reduce((n, p) => n + words(p), 0), piece: {}});
  return [[half(paragraphs.slice(0, cut))], [half(paragraphs.slice(cut))]];
}

const FIGURE_HELP = `Figure kinds (put each inside {"fig": ...}; every text is short; "title" is optional and says what the picture shows):
- {"kind":"contrast","title":"…","left":{"label":"≤50 chars","points":["≤140 chars", 2 to 4 items]},"right":{same}}  two sides: expected vs real, before vs after, myth vs fact
- {"kind":"chain","title":"…","steps":[{"label":"≤48 chars","note":"≤140 chars"}, 3 to 5 items]}  a sequence, or cause then effect
- {"kind":"cycle","title":"…","steps":[same as chain]}  a loop that feeds back to its start
- {"kind":"stack","title":"…","layers":[{"label":"…","note":"…"}, 3 to 5 items, top layer first]}  levels, surface to deep
- {"kind":"scale","title":"…","from":"≤40 chars","to":"≤40 chars","marks":[{"at":0 to 100,"label":"≤60 chars"}, 2 to 4 items]}  a spectrum with points placed on it
- {"kind":"stat","value":"≤12 chars","label":"≤200 chars"}  only a real number that is in the text
- {"kind":"terms","title":"…","items":[{"term":"≤60 chars","meaning":"≤200 chars"}, 2 to 4 items]}  the key words
Every contrast, chain, cycle, stack and terms figure also gets "objects": one name from the picture set below per side, step, layer or item, in the same order, each the thing that best shows that part of this book's own subject (a sunk cost is a sealed jar of coins). Different names within a figure, copied exactly.
Picture set (name: what it shows):
${SCENE_HELP}`;

export const SECTION_INSTRUCTIONS = `You write one section of the "30-min version" of a book: an expanded summary that reads like the book itself, for a reader who will not read the full text. All sections together take about 30 minutes to read, in order, and carry the book's meaning through every chapter.

Rules:
- Faithful to the author: their claims, their examples, studies and stories by name, in the order they matter. Never invent facts, numbers or quotes.
- Real prose: paragraphs of 110 to 190 words, warm and plain, present tense ("The author shows…"). No bullet lists in paragraphs.
- The reader learns visually: add 2 or 3 figures of different kinds that nail this section's main points, and one "pull" line that restates the big idea. Put the first figure after the first or second paragraph.
- No questions to the reader, no quizzes, no exercises, no "ask yourself", no "write down". Exercises the book offers can be described in one plain sentence as something the book offers.
- Quote the author only in short phrases (under 15 words), rarely.
- Write about the target number of words given, counting figure text.

${FIGURE_HELP}

Reply with only this JSON object:
{"idea":"one plain sentence: this section's big idea","blocks":[{"p":"paragraph"},{"fig":{…}},{"p":"paragraph"},{"pull":"one line"},{"h":"optional subheading"},{"p":"paragraph"}],"carry":"2 or 3 sentences that restate this section's idea and hand it to the next section by name (or, for the last section, to the book's close)"}`;

export function sectionPrompt(book, sections, section) {
  const next = sections[section.index + 1];
  const input = JSON.stringify({
    book: {title: String(book.title || '').slice(0, 400), author: String(book.author || '').slice(0, 300)},
    contents: sections.map(s => `${s.label} · ${s.title}`),
    write: {section: `${section.label} · ${section.title}`, number: section.index + 1, of: sections.length, targetWords: section.target, next: next ? `${next.label} · ${next.title}` : 'the close of the book'},
    text: section.parts.map(p => `# ${p.chapter.title}${p.piece?.of ? ` (part ${p.piece.n} of ${p.piece.of})` : ''}\n\n${p.paragraphs.join('\n\n')}`).join('\n\n'),
  });
  return {instructions: SECTION_INSTRUCTIONS, input};
}

export const FRAME_INSTRUCTIONS = `You frame the "30-min version" of a book. You get the book's sections, each with its big idea. Write:
- "thread": one sentence, the book's core argument, that every section's idea serves (at most 240 characters).
- "opening": 2 paragraphs (110 to 170 words each) that say what the book argues and why it matters, in plain warm prose.
- "closing": 2 paragraphs (110 to 170 words each) that pull every section's idea together, naming the sections, and land the thread.
No questions to the reader, no exercises. Reply with only this JSON object: {"thread":"…","opening":["…","…"],"closing":["…","…"]}`;

export function framePrompt(book, sections) {
  const input = JSON.stringify({
    book: {title: String(book.title || '').slice(0, 400), author: String(book.author || '').slice(0, 300)},
    sections: sections.map(s => ({section: `${s.label} · ${s.title}`, idea: s.idea})),
  });
  return {instructions: FRAME_INSTRUCTIONS, input};
}

function request(model, maxTokens, {instructions, input}) {
  return {model, max_tokens: maxTokens, thinking: {type: 'disabled'}, output_config: {effort: 'low'},
    system: [{type: 'text', text: instructions, cache_control: {type: 'ephemeral'}}], messages: [{role: 'user', content: input}]};
}
export const sectionRequest = (model, book, sections, section) => request(model, TM_SECTION_TOKENS, sectionPrompt(book, sections, section));
export const frameRequest = (model, book, sections) => request(model, TM_FRAME_TOKENS, framePrompt(book, sections));

// Pictures: keep what fits, trim what is a little long, drop what is broken.
function cleanFigure(f) {
  if (!f || typeof f !== 'object') return null;
  const kind = str(f.kind).toLowerCase();
  const steps = (v, max) => list(v).map(s => ({label: fit(s?.label ?? s, 48), ...(str(s?.note) ? {note: fit(s.note, 140)} : {})})).filter(s => s.label).slice(0, max);
  const side = s => ({label: fit(s?.label, 50), points: list(s?.points).map(p => fit(p, 140)).filter(Boolean).slice(0, 4)});
  const out = {kind, ...(str(f.title) ? {title: fit(f.title, 120)} : {})};
  if (kind === 'contrast') Object.assign(out, {left: side(f.left), right: side(f.right)});
  else if (kind === 'chain' || kind === 'cycle') out.steps = steps(f.steps, 5);
  else if (kind === 'stack') out.layers = steps(f.layers ?? f.steps, 5);
  else if (kind === 'scale') Object.assign(out, {from: fit(f.from, 40), to: fit(f.to, 40), marks: list(f.marks).map(m => ({at: Math.max(0, Math.min(100, Math.round(Number(m?.at)))), label: fit(m?.label, 60)})).filter(m => Number.isFinite(m.at) && m.label).slice(0, 4)});
  else if (kind === 'stat') Object.assign(out, {value: fit(f.value, 12), label: fit(f.label, 200)});
  else if (kind === 'terms') out.items = list(f.items).map(i => ({term: fit(i?.term, 60), meaning: fit(i?.meaning, 200)})).filter(i => i.term && i.meaning).slice(0, 4);
  else return null;
  if (!TM_FIGURES[kind](out)) return null;
  // The picture plan: one drawn object per part, kept only when it lines up with the parts.
  const parts = kind === 'contrast' ? 2 : (out.steps || out.layers || out.items || []).length;
  const scene = parts ? cleanScene({objects: list(f.objects ?? f.scene?.objects).slice(0, parts), link: kind === 'chain' || kind === 'cycle' ? 'path' : 'none'}, parts) : null;
  return scene ? {...out, scene} : out;
}
const ASKS = /\b(write down|jot|journal about|in your own words|take a moment to|ask yourself|answer the|quiz)\b/i;

/** A section from Claude's reply, or {error}. */
export function sectionFromText(text, section) {
  let draft;
  try { draft = readDraft(text); } catch (error) { return {error: 'The section could not be read: ' + (error?.message || 'invalid reply') + '.'}; }
  const blocks = [];
  for (const b of list(draft.blocks)) {
    if (str(b?.p)) { const p = fit(b.p, 2400); if (!ASKS.test(p)) blocks.push({p}); }
    else if (str(b?.pull)) { const pull = fit(b.pull, 260); if (!ASKS.test(pull)) blocks.push({pull}); }
    else if (str(b?.h)) blocks.push({h: fit(b.h, 100)});
    else if (b?.fig) { const fig = cleanFigure(b.fig); if (fig) blocks.push({fig}); }
  }
  // A subheading with nothing after it reads as a mistake.
  while (blocks.length && blocks[blocks.length - 1].h) blocks.pop();
  const idea = fit(draft.idea, 260), carry = fit(draft.carry, 900);
  if (!idea) return {error: 'The section had no big idea.'};
  if (blocks.filter(b => b.p).length < 2) return {error: 'The section had too little text.'};
  if (!blocks.some(b => b.fig)) return {error: 'The section had no picture.'};
  return {section: {covers: section.covers, ...(section.part ? {part: section.part} : {}), label: section.label, title: section.title, idea, blocks, carry: carry || idea}};
}

/** The thread, opening and closing from Claude's reply. Falls back to plain framing built from the sections. */
export function frameFromText(text, book, sections) {
  let draft = {};
  try { draft = readDraft(text); } catch {}
  const paras = v => list(v).map(p => fit(p, 2000)).filter(p => p && !ASKS.test(p)).slice(0, 3);
  const thread = fit(draft.thread, 260) || fit(sections[0]?.idea, 260);
  const opening = paras(draft.opening), closing = paras(draft.closing);
  return {
    thread,
    opening: opening.length ? opening : [fit(`This is the 30-min version of ${book.title}${book.author ? ' by ' + book.author : ''}: the whole book, chapter by chapter, with pictures of its main ideas. ${thread}`, 2000)],
    closing: closing.length ? closing : [fit(sections.map(s => s.idea).join(' '), 2000)],
  };
}

/** The finished version, checked. Throws when it does not pass. */
export function assembleThirtyMin(book, frame, sections, {model = '', createdAt = new Date().toISOString()} = {}) {
  const version = {bookId: book.id, thread: frame.thread, opening: frame.opening, sections, closing: frame.closing, model, createdAt};
  const {errors} = checkThirtyMin(version, {chapterIds: book.chapters.map(c => c.id)});
  if (errors.length) throw new Error('The 30-min version did not pass its check: ' + errors[0]);
  return {...version, minutes: Math.max(1, Math.round(thirtyMinWords(version) / TM_WPM))};
}
