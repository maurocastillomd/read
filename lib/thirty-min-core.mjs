// The 30-min version of a book: an expanded summary that reads like the book,
// one section per chapter (or group of short chapters), with pictures that
// repeat the main ideas. No questions and no typing. Shared by the reader,
// the build check and the generator.
export const TM_WPM = 230;
export const TM_FIGURES = {
  contrast: f => side(f.left) && side(f.right),
  chain: f => steps(f.steps, 3, 5),
  cycle: f => steps(f.steps, 3, 5),
  stack: f => steps(f.layers, 3, 5),
  scale: f => short(f.from, 40) && short(f.to, 40) && Array.isArray(f.marks) && f.marks.length >= 2 && f.marks.length <= 4 && f.marks.every(m => Number.isFinite(m?.at) && m.at >= 0 && m.at <= 100 && short(m.label, 60)),
  stat: f => short(f.value, 12) && short(f.label, 200),
  terms: f => Array.isArray(f.items) && f.items.length >= 2 && f.items.length <= 4 && f.items.every(i => short(i?.term, 60) && short(i?.meaning, 200))
};
function short(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
function side(s) { return s && short(s.label, 50) && Array.isArray(s.points) && s.points.length >= 2 && s.points.length <= 4 && s.points.every(p => short(p, 140)); }
function steps(list, min, max) { return Array.isArray(list) && list.length >= min && list.length <= max && list.every(s => short(s?.label, 48) && (s.note === undefined || short(s.note, 140))); }
const tmWords = text => (String(text || '').match(/\S+/g) || []).length;
function figureWords(f) {
  return tmWords([f.title, f.left?.label, ...(f.left?.points || []), f.right?.label, ...(f.right?.points || []), ...(f.steps || f.layers || []).flatMap(s => [s.label, s.note]), f.from, f.to, ...(f.marks || []).map(m => m.label), f.value, f.label, ...(f.items || []).flatMap(i => [i.term, i.meaning])].filter(Boolean).join(' '));
}
// Words a reader actually reads, so "30 min" is honest.
export function thirtyMinWords(v) {
  let n = tmWords(v.thread) + (v.opening || []).reduce((a, p) => a + tmWords(p), 0) + (v.closing || []).reduce((a, p) => a + tmWords(p), 0);
  for (const s of v.sections || []) {
    n += tmWords(s.title) + tmWords(s.idea) + tmWords(s.carry);
    for (const b of s.blocks || []) n += b.p ? tmWords(b.p) : b.pull ? tmWords(b.pull) : b.h ? tmWords(b.h) : b.fig ? figureWords(b.fig) : 0;
  }
  return n;
}
export const thirtyMinMinutes = v => Math.max(1, Math.round(thirtyMinWords(v) / TM_WPM));
// A writing prompt or a question to the reader has no place here.
const TM_ASKS = /\b(write down|jot|journal about|in your own words|take a moment to|ask yourself|answer the|quiz)\b/i;
export function checkThirtyMin(v, {strict = false, chapterIds = null} = {}) {
  const errors = [];
  if (!v || typeof v !== 'object') return {errors: ['not an object'], words: 0, minutes: 0, figures: 0, sections: 0};
  if (!short(v.thread, 260)) errors.push('thread: one sentence of up to 260 characters');
  for (const key of ['opening', 'closing']) if (!Array.isArray(v[key]) || !v[key].length || v[key].length > 4 || !v[key].every(p => short(p, 2000))) errors.push(key + ': 1 to 4 paragraphs');
  const sections = Array.isArray(v.sections) ? v.sections : [];
  if (sections.length < 3 || sections.length > 24) errors.push('sections: 3 to 24');
  let figures = 0;
  const seen = new Set();
  sections.forEach((s, i) => {
    const at = `section ${i + 1}`;
    if (!short(s?.title, 140)) errors.push(at + ': title');
    if (!short(s?.label, 40)) errors.push(at + ': label');
    if (!short(s?.idea, 260)) errors.push(at + ': idea (one sentence)');
    if (!short(s?.carry, 900)) errors.push(at + ': carry');
    if (!Array.isArray(s?.covers) || !s.covers.length || !s.covers.every(c => typeof c === 'string')) errors.push(at + ': covers');
    else for (const c of s.covers) { if (chapterIds && !chapterIds.includes(c)) errors.push(at + ': unknown chapter ' + c); if (seen.has(c) && !(s.part && sections[i - 1]?.covers?.includes(c))) errors.push(at + ': chapter covered twice ' + c); seen.add(c); }
    const blocks = Array.isArray(s?.blocks) ? s.blocks : [];
    let paragraphs = 0, figs = 0, kinds = new Set();
    for (const b of blocks) {
      if (b?.p !== undefined) { if (!short(b.p, 2400)) errors.push(at + ': paragraph too long or empty'); else paragraphs++; }
      else if (b?.pull !== undefined) { if (!short(b.pull, 260)) errors.push(at + ': pull line'); }
      else if (b?.h !== undefined) { if (!short(b.h, 100)) errors.push(at + ': subheading'); }
      else if (b?.fig !== undefined) {
        const f = b.fig, ok = f && TM_FIGURES[f.kind];
        if (!ok || !ok(f) || (f.title !== undefined && !short(f.title, 120))) errors.push(`${at}: figure ${f?.kind || '?'} is malformed`);
        else { figs++; kinds.add(f.kind); }
      } else errors.push(at + ': unknown block');
    }
    for (const text of [s?.idea, s?.carry, ...blocks.map(b => b?.p || b?.pull || '')]) if (TM_ASKS.test(String(text || ''))) errors.push(at + ': reads like a question or writing prompt: ' + String(text).slice(0, 60));
    if (paragraphs < 2) errors.push(at + ': at least 2 paragraphs');
    if (strict && figs < 2) errors.push(at + ': at least 2 figures');
    if (!figs) errors.push(at + ': at least 1 figure');
    figures += figs;
  });
  const words = thirtyMinWords(v), minutes = thirtyMinMinutes(v);
  if (strict && (words < 5800 || words > 7600)) errors.push(`length: ${words} words; aim for 6,300 to 7,000 (about 30 minutes)`);
  return {errors, words, minutes, figures, sections: sections.length};
}
