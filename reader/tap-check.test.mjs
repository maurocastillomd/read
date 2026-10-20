import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {normalizeParagraphs} from '../lib/guide-core.mjs';
import {sampleEntry, sampleTapBank} from '../tests/fixtures/sample-library.mjs';

const shipped = JSON.parse(await readFile(new URL('./tap-checks.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('./tap-check.js', import.meta.url), 'utf8');
// The open edition bundles no books or question bank; an invented book, its
// prepared lessons and a small hand-written bank stand in.
const seed = sampleEntry();
const bank = sampleTapBank(seed.book);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Bank questions apply only to guides without checks of their own (the older bundled shape).
const withoutChecks = rec => ({...rec, guide: {...rec.guide, checks: []}});
const guides = seed.guides.map(withoutChecks);

test('the shipped edition has no question bank, and the sample bank quotes its chapter exactly', () => {
  assert.deepEqual(shipped, {});
  for (const [unitId, questions] of Object.entries(bank[seed.book.id])) {
    const rec = seed.guides.find(g => g.unitId === unitId);
    const paragraphs = Object.fromEntries(normalizeParagraphs(seed.book.chapters.find(c => c.id === rec.chapterId)).map(p => [p.id, p.text]));
    for (const q of questions) {
      assert.ok(paragraphs[q.source.paragraphId]?.includes(q.source.quote), q.id + ' quote');
      if (q.format === 'order') assert.notDeepEqual(q.display, q.steps.map((_, i) => i), q.id + ' starts shuffled');
    }
  }
});

function runtime() {
  const listeners = {}, state = {checks: {}}, nodes = [];
  let saves = 0;
  const rec = guides.find(g => g.unitId === 'c1:prepared');
  const others = guides.filter(g => g !== rec);
  const context = vm.createContext({
    state, esc: escape, activeBook: {id: rec.bookId}, selectedUnit: rec.unitId, save() { saves++; },
    sourceButton: () => '<button data-action="source">See it in the book</button>',
    bookGuides: () => [rec, ...others],
    document: {
      getElementById: () => ({textContent: JSON.stringify(bank)}),
      addEventListener(type, listener) { listeners[type] = listener; },
      querySelectorAll: () => nodes, querySelector: () => null,
    },
  });
  vm.runInContext(source + '\nthis.tap={set:tapSet,questions:tapQuestions,score:tapScore};', context);
  return {tap: context.tap, rec, state, get saves() { return saves; },
    click(action, data) { listeners.click({target: {closest: () => ({dataset: {action, ...data}})}}); }};
}

test('a tap answer is hidden until confidence is chosen, then saved as booleans', () => {
  const r = runtime();
  assert.equal(r.tap.questions(r.rec, 'remember').length, 3);
  assert.doesNotMatch(r.tap.set(r.rec, 'remember'), /<textarea/);
  r.click('tap-pick', {tap: 'cue-first', index: '0'});
  assert.match(r.tap.set(r.rec, 'remember'), /How sure are you\?/);
  assert.doesNotMatch(r.tap.set(r.rec, 'remember'), /tap-feedback/);
  assert.equal(r.saves, 0);
  r.click('tap-sure', {tap: 'cue-first', sure: 'false'});
  assert.equal(r.state.checks[r.rec.bookId]['tap:c1:prepared:cue-first'], true);
  assert.equal(r.state.checks[r.rec.bookId]['tap-sure:c1:prepared:cue-first'], false);
  assert.match(r.tap.set(r.rec, 'remember'), /even though you were guessing/);
  assert.deepEqual({...r.tap.score(r.rec)}, {right: 1, answered: 1, total: 4});
  r.click('tap-pick', {tap: 'cue-first', index: '2'});
  assert.equal(r.state.checks[r.rec.bookId]['tap:c1:prepared:cue-first'], true, 'locked after reveal');
});

test('order questions score by sequence and other chapters have no tap questions', () => {
  const r = runtime();
  for (const index of [0, 1, 3, 2, 4]) r.click('tap-order', {tap: 'routine-order', index: String(index)});
  r.click('tap-sure', {tap: 'routine-order', sure: 'true'});
  assert.equal(r.state.checks[r.rec.bookId]['tap:c1:prepared:routine-order'], false);
  assert.match(r.tap.set(r.rec, 'remember'), /real mix-up/);
});

test('chapters without written checks get tap questions built from their own recall answers', () => {
  const r = runtime();
  for (const rec of guides.filter(g => g.unitId !== 'c1:prepared')) {
    const list = r.tap.questions(rec);
    assert.equal(list.length, rec.guide.recall.length, rec.unitId);
    list.forEach((q, i) => {
      assert.equal(q.format, 'pick');
      assert.equal(q.choices.length, 3);
      assert.equal(q.prompt, rec.guide.recall[i].question);
      assert.match(q.choices[q.correctIndex].feedback, /^Right\. /);
      assert.equal(new Set(q.choices.map(c => c.label)).size, 3, 'distinct choices');
    });
    assert.doesNotMatch(r.tap.set(rec, 'remember'), /<textarea|data-note=/);
  }
});

test('checks written with a guide take priority and accept array feedback', () => {
  const r = runtime();
  const rec = structuredClone(guides.find(g => g.unitId === 'c2:prepared'));
  rec.guide.checks = [{id: 'own', format: 'order', where: ['remember'], prompt: 'Order it.', choices: [], steps: ['A', 'B', 'C'], display: [2, 0, 1], feedback: ['A, then B, then C.'], correctIndex: 0, source: {paragraphId: 'p1', quote: 'x'}}];
  assert.deepEqual(r.tap.questions(rec).map(q => q.id), ['own']);
});
