import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {WRITING_PROMPT} from '../lib/guide-core.mjs';
import {isoSource} from '../scripts/iso-source.mjs';
import {sampleLibrary} from '../tests/fixtures/sample-library.mjs';

const overlay = JSON.parse(await readFile(new URL('./idea-visuals.json', import.meta.url), 'utf8'));
const source = await isoSource() + await readFile(new URL('./idea-visual.js', import.meta.url), 'utf8');
// The open edition bundles no books; an invented library with lessons built by lib/lesson-maker.mjs stands in.
const seeds = sampleLibrary();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function load(book, guides, visuals = overlay) {
  const context = {
    document: {getElementById: () => ({textContent: JSON.stringify(visuals)}), addEventListener() {}},
    books: [book], activeBook: book, esc: escape,
    roleContextGuide: rec => rec.guide, bookGuides: () => guides,
    labId: (rec, suffix) => 'id-' + suffix,
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.api={ideaVisual,ideaHero,ideaMap,ideaArt,ideaApplies,ideaReading,ideaConnect,ideaForward};', context);
  return context.api;
}

test('the shipped edition carries no picture overlay; lessons bring their own big idea, labels and parts', () => {
  assert.deepEqual(overlay, {});
  for (const seed of seeds) {
    const guides = seed.guides.map(g => ({...g, bookId: seed.book.id})), api = load(seed.book, guides);
    for (const rec of guides) {
      const v = api.ideaVisual(rec), cv = rec.guide.chapterVisual;
      assert.equal(v.takeaway, cv.takeaway, rec.unitId + ' takeaway');
      assert.equal(JSON.stringify(v.labels), JSON.stringify(cv.labels), rec.unitId);
      assert.equal(JSON.stringify(v.parts), JSON.stringify(cv.parts), rec.unitId);
      for (const text of [v.takeaway, ...v.labels, ...v.parts]) {
        assert.ok(text.trim(), rec.unitId);
        assert.doesNotMatch(text, WRITING_PROMPT, `${rec.unitId}: no writing prompts`);
      }
    }
  }
});

test('an overlay entry, when one is supplied, takes the place of the lesson’s own picture text', () => {
  const seed = seeds[0], rec = {...seed.guides[0], bookId: seed.book.id};
  const visuals = {[seed.book.id]: {[rec.unitId]: {takeaway: 'An overlay takeaway that replaces the lesson text.', labels: ['One', 'Two', 'Three'], parts: ['First part.', 'Second part.', 'Third part.'], reading: {passage: ['Overlay page one.', 'Overlay page two.'], connect: 'Overlay links.', forward: 'Overlay review.'}}}};
  const api = load(seed.book, [rec], visuals), v = api.ideaVisual(rec);
  assert.equal(v.takeaway, 'An overlay takeaway that replaces the lesson text.');
  assert.equal(JSON.stringify(v.labels), JSON.stringify(['One', 'Two', 'Three']));
  assert.match(api.ideaReading(rec), /<p>Overlay page one\.<\/p><p>Overlay page two\.<\/p>/);
  assert.match(api.ideaConnect(rec), /Overlay links\./);
  assert.match(api.ideaForward(rec), /Overlay review\./);
});

test('every prepared lesson carries a short page of source prose, a map paragraph and a closing review', () => {
  const api = load(seeds[0].book, []);
  for (const seed of seeds) {
    for (const rec of seed.guides.map(g => ({...g, bookId: seed.book.id}))) {
      const r = rec.guide.reading;
      assert.equal(r.passage.length, 2, rec.unitId);
      assert.equal((api.ideaReading(rec).match(/<p>/g) || []).length, 2, rec.unitId);
      assert.match(api.ideaConnect(rec), /class="idea-connect"/, rec.unitId);
      assert.match(api.ideaForward(rec), /The chapter in review/, rec.unitId);
      for (const text of [...r.passage, r.connect, r.forward]) {
        assert.doesNotMatch(text, WRITING_PROMPT, rec.unitId);
        assert.doesNotMatch(text, /\?/, rec.unitId + ': no questions to the reader');
      }
    }
  }
});

test('the reading page shows under the picture, and older guides show their gist instead', () => {
  const seed = seeds[1], guides = seed.guides.map(g => ({...g, bookId: seed.book.id})), api = load(seed.book, guides);
  const html = api.ideaReading(guides[0]);
  assert.equal((html.match(/<p>/g) || []).length, 2);
  assert.match(api.ideaMap(guides[0]), /class="idea-connect"/);
  assert.match(api.ideaForward(guides[0]), /The chapter in review/);
  const book = {id: 'old', chapters: [{id: 'c1', title: 'One'}]}, old = load(book, []);
  const guide = {gist: 'First part.\n\nSecond part.', concepts: [{title: 'A', explanation: 'x'}, {title: 'B', explanation: 'y'}, {title: 'C', explanation: 'z'}], principles: [], flow: {nodes: [{id: 'a', label: 'A', detail: 'd'}, {id: 'b', label: 'B', detail: 'd'}], edges: []}};
  assert.equal((old.ideaReading({bookId: 'old', unitId: 'u', guide}).match(/<p>/g) || []).length, 2);
  assert.equal(old.ideaConnect({bookId: 'old', unitId: 'u', guide}), '');
  assert.equal(old.ideaForward({bookId: 'old', unitId: 'u', guide}), '', 'no closing review without one');
  const made = {...guide, reading: {passage: ['One.', 'Two.'], connect: 'Links.'}};
  assert.match(old.ideaReading({bookId: 'old', unitId: 'u', guide: made}), /<p>One\.<\/p><p>Two\.<\/p>/);
  assert.match(old.ideaConnect({bookId: 'old', unitId: 'u', guide: made}), /Links\./);
});

test('every lesson opens with a tappable picture and every map can be explored', () => {
  for (const seed of seeds) {
    const guides = seed.guides.map(g => ({...g, bookId: seed.book.id}));
    const api = load(seed.book, guides);
    for (const rec of guides) {
      const hero = api.ideaHero(rec);
      assert.match(hero, /class="idea-takeaway"/);
      assert.equal((hero.match(/<button type="button" class="ivm-chip[^"]*" data-action="iv-part" data-index="\d"/g) || []).length, 3, rec.unitId);
      for (const i of [0, 1, 2]) assert.match(hero, new RegExp(`<g data-p="${i}" data-action="iv-part" data-index="${i}" role="button"`), rec.unitId + ' part on the machine');
      assert.doesNotMatch(hero, /<textarea|<input/);
      const map = api.ideaMap(rec);
      assert.equal((map.match(/data-action="iv-node"/g) || []).length, rec.guide.flow.nodes.length, rec.unitId);
    }
  }
});

test('all eight picture kinds draw a machine, and a gap hides the right part', () => {
  const seed = seeds[0], api = load(seed.book, seed.guides);
  for (const kind of ['handoff', 'loop', 'capacity', 'decision', 'layers', 'compass', 'release', 'network']) {
    const svg = api.ideaArt({kind, title: 'T', labels: ['Alpha', 'Beta', 'Gamma'], parts: ['a', 'b', 'c']}, {hidden: 1, interactive: false});
    assert.match(svg, /^<div class="ivm-wrap"/, kind);
    assert.match(svg, /<div class="ivm idea-art" data-gap="1"><svg /, kind);
    for (const i of [0, 1, 2]) assert.match(svg, new RegExp(`<g data-p="${i}">`), kind + ' has part ' + i);
    assert.doesNotMatch(svg, /data-action/, kind + ' is not tappable in a check');
    assert.match(svg, />Alpha</, kind);
    assert.doesNotMatch(svg, />Beta</, kind + ' hides the gap');
    assert.match(svg, />\?</, kind);
  }
});

test('older guides with few ideas still get three parts, or keep the old screen', () => {
  const book = {id: 'old', chapters: [{id: 'c1', title: 'One'}]}, api = load(book, []);
  const base = {gist: 'A gist. More.', concepts: [{title: 'Only idea', explanation: 'It matters.'}], principles: [{title: 'A rule', explanation: 'x'}], flow: {nodes: [{id: 'a', label: 'Start', detail: 'd'}, {id: 'b', label: 'End', detail: 'd'}], edges: []}};
  const v = api.ideaVisual({bookId: 'old', unitId: 'u', guide: base});
  assert.equal(JSON.stringify(v.labels), JSON.stringify(['Only idea', 'A rule', 'Start']));
  assert.equal(v.parts.filter(Boolean).length, 3);
  const thin = {...base, principles: [], flow: {nodes: [], edges: []}};
  assert.equal(api.ideaApplies({bookId: 'old', unitId: 'u', guide: thin}), false);
  assert.equal(api.ideaHero({bookId: 'old', unitId: 'u', guide: thin}), '');
});

test('articles keep their own screens', () => {
  const article = {id: 'a1', sourceType: 'article', chapters: []};
  const api = load(article, []);
  assert.equal(api.ideaApplies({bookId: 'a1', unitId: 'u', guide: {}}), false);
  assert.equal(api.ideaHero({bookId: 'a1', unitId: 'u', guide: {}}), '');
});

test('a passed picture check joins the memory and returns on day 1, 3, 7 and 21', async () => {
  const glance = await readFile(new URL('./book-glance.js', import.meta.url), 'utf8') + await readFile(new URL('./keep.js', import.meta.url), 'utf8');
  const state = {last: {b: {}}, checks: {}}, ctx = {state, activeBook: {id: 'b'}, books: [], save() {}, localStorage: {getItem: () => null, setItem() {}}, document: {addEventListener() {}}};
  vm.createContext(ctx);
  vm.runInContext(glance + '\nthis.api={reviewEntry,keepDue,keepReturn,startPictureReview};', ctx);
  const rec = {bookId: 'b', unitId: 'u1'};
  ctx.api.startPictureReview(rec);
  const first = ctx.api.reviewEntry(rec);
  assert.equal(first.stage, 0);
  assert.equal(first.right, true);
  const plus = n => { const d = new Date(first.day + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  assert.equal(ctx.api.keepDue(first), plus(1));
  assert.equal(ctx.api.keepDue({...first, stage: 1}), plus(3));
  assert.equal(ctx.api.keepDue({...first, stage: 2}), plus(7));
  assert.equal(ctx.api.keepDue({...first, stage: 3}), plus(21));
  assert.equal(ctx.api.keepDue({...first, stage: 4}), null);
  ctx.api.startPictureReview(rec);
  assert.equal(state.last.b['pic:u1'], first.day + '|0|1|0|0', 'a second pass does not restart the schedule');
  // Older entries ("day|stage") still read, with one return per stage passed.
  state.last.b['pic:u3'] = first.day + '|2';
  assert.equal(JSON.stringify(ctx.api.reviewEntry({bookId: 'b', unitId: 'u3'})), JSON.stringify({day: first.day, stage: 2, right: true, returns: 2, misses: 0}));
  // A missed return comes back tomorrow.
  ctx.api.keepReturn('b', 'pic:u1', false);
  assert.equal(ctx.api.keepDue(ctx.api.reviewEntry(rec)), plus(1));
  state.last.b['pic:u2'] = 'not a date';
  assert.equal(ctx.api.reviewEntry({bookId: 'b', unitId: 'u2'}), null);
});
