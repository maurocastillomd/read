import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./keep.js', import.meta.url), 'utf8');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const shift = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const question = (id, n = 3) => ({id, format: 'pick', where: ['remember'], prompt: 'Q ' + id, choices: Array.from({length: n}, (_, i) => ({label: 'c' + i, feedback: 'f' + i})), correctIndex: 1});

function load({books, guides, state = {last: {}, checks: {}}, ideas = () => true}) {
  const context = {state, books, activeBook: books[0], esc, save() {}, isReplaced: () => false, view: 'library',
    bookGuides: book => guides.filter(g => g.bookId === (book || books[0]).id),
    tapQuestions: rec => rec.guide?.checks || [],
    tapChoices: q => q.choices,
    ideaApplies: rec => ideas(rec),
    ideaVisual: rec => ({kind: 'loop', title: 't', takeaway: 'Big idea of ' + rec.unitId, labels: ['A ' + rec.unitId, 'B ' + rec.unitId, 'C ' + rec.unitId], parts: ['pa', 'pb', 'pc']}),
    ideaDistractors: (rec, correct) => [correct, 'x', 'y'],
    ideaHash: () => 0, ideaSentence: t => t,
    ideaArt: () => '<svg></svg>', isoThumb: () => '<svg></svg>', isoForKind: () => '',
    lessonCode: rec => ({code: 'C1 · L1'}),
    labId: () => 'id', readIcon: () => '',
    isoDay: (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    document: {addEventListener() {}, getElementById: () => null, querySelector: () => null},
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.api={keepEntry,keepStart,keepReturn,keepDue,keepStatus,keepItems,keepDueItems,keepLessonStatus,keepCounts,keepMeter,todayCard,keepCopy,keepRecordTap};', context);
  return context.api;
}
const book = (id, units, extra = {}) => ({id, title: 'Book ' + id, author: 'A', chapters: units.map(u => ({id: 'ch' + u, title: 'Chapter ' + u})), ...extra});
const lesson = (bookId, u, checks = []) => ({bookId, unitId: 'u' + u, chapterId: 'ch' + u, guide: {title: 'L' + u, checks}});

test('first answers schedule the return: a miss tomorrow, a guess in 3 days, a sure answer in 7', () => {
  const api = load({books: [book('b', [1])], guides: [lesson('b', 1)]});
  const day = today();
  assert.equal(api.keepDue(api.keepStart('b', 'tap:u1:q1', false)), shift(day, 1));
  assert.equal(api.keepDue(api.keepStart('b', 'tap:u1:q2', true, false)), shift(day, 3));
  assert.equal(api.keepDue(api.keepStart('b', 'tap:u1:q3', true, true)), shift(day, 7));
  // A right answer in the lesson never restarts an existing schedule; a miss anywhere resets it to tomorrow.
  assert.equal(api.keepDue(api.keepStart('b', 'tap:u1:q3', true, false)), shift(day, 7));
  const missed = api.keepStart('b', 'tap:u1:q3', false);
  assert.equal(api.keepDue(missed), shift(day, 1));
  assert.equal(missed.misses, 1);
  assert.equal(api.keepStatus(missed), 'missed');
});

test('returns move an idea further apart only when sure, and hold it after two right answers 3 days apart', () => {
  const api = load({books: [book('b', [1])], guides: [lesson('b', 1)]});
  const e1 = api.keepStart('b', 'pic:u1', true, true, 0);
  assert.equal(api.keepStatus(e1), 'learning');
  const e2 = api.keepReturn('b', 'pic:u1', true);
  assert.equal(e2.stage, 1); assert.equal(e2.returns, 1);
  assert.equal(api.keepStatus(e2), 'learning', 'one day apart is not held yet');
  const e3 = api.keepReturn('b', 'pic:u1', true, false);
  assert.equal(e3.stage, 1, 'right but guessing keeps the same gap');
  const e4 = api.keepReturn('b', 'pic:u1', true, true);
  assert.equal(e4.stage, 2);
  assert.equal(api.keepStatus(e4), 'held');
  // Past the last return it never comes back.
  assert.equal(api.keepDue({...e4, stage: 4}), null);
  assert.equal(api.keepStatus({...e4, stage: 4}), 'held');
});

test('what is due comes back misses first and one reading at a time, across books and articles', () => {
  const b1 = book('b1', [1, 2]), b2 = book('b2', [1]), art = book('a1', [1], {sourceType: 'article'});
  const guides = [lesson('b1', 1, [question('q1')]), lesson('b1', 2), lesson('b2', 1), {...lesson('a1', 1, [question('q9')]), guide: {title: 'Paper', checks: [question('q9')], articleAnalysis: {studyVisual: {headline: {measure: 'Sprint time', direction: 'decrease', magnitude: '0.1 s faster'}}}}}];
  const day = today(), old = shift(day, -5);
  const state = {checks: {}, last: {
    b1: {'pic:u1': old + '|0|1|0|0', 'tap:u1:q1': old + '|1|0|0|1', 'pic:u2': day + '|2|1|2|0'},
    b2: {'pic:u1': old + '|1|1|1|0'},
    a1: {'predict:u1': old + '|1|1|0|0', 'tap:u1:q9': day + '|2|1|1|0'},
  }};
  const api = load({books: [b1, b2, art], guides, state, ideas: rec => rec.bookId !== 'a1'});
  const {due, later} = api.keepDueItems();
  assert.equal(due.map(i => i.book.id + ':' + i.key).join(), 'b1:tap:u1:q1,b2:pic:u1,a1:predict:u1,b1:pic:u1');
  assert.equal(later.length, 2);
  assert.equal(api.keepDueItems(b2).due.length, 1);
  const card = api.todayCard();
  assert.match(card, /4 things are ready/);
  assert.match(card, /1 you missed/);
  assert.match(card, /1 article result/);
  assert.match(card, /data-action="today-open"/);
});

test('a lesson is held, fading, missed or new from its own items; the meter counts ideas, not lessons opened', () => {
  const b = book('b', [1, 2, 3, 4]);
  const guides = [lesson('b', 1, [question('q1')]), lesson('b', 2), lesson('b', 3), lesson('b', 4)];
  const day = today(), old = shift(day, -10);
  const state = {checks: {'b': {'seen:u4:5': true}}, last: {b: {'pic:u1': day + '|2|1|2|0', 'tap:u1:q1': old + '|0|0|0|2', 'pic:u2': old + '|1|1|1|0', 'pic:u3': day + '|3|1|3|0'}}};
  const api = load({books: [b], guides, state});
  assert.equal(api.keepLessonStatus(b, guides[0]), 'missed', 'a missed question outweighs a held picture');
  assert.equal(api.keepLessonStatus(b, guides[1]), 'fading');
  assert.equal(api.keepLessonStatus(b, guides[2]), 'held');
  assert.equal(api.keepLessonStatus(b, guides[3]), 'new', 'opening a lesson counts for nothing');
  const c = api.keepCounts(b);
  assert.deepEqual([c.held, c.fading, c.missed, c.new, c.total], [1, 1, 1, 1, 4]);
  const meter = api.keepMeter(b, {note: '1 lesson to go'});
  assert.match(meter, /1 held/); assert.match(meter, /1 fading/); assert.match(meter, /1 missed/); assert.match(meter, /1 lesson to go/);
  assert.equal(api.keepMeter(book('empty', [])), '');
  const copy = api.keepCopy(b, {recs: guides});
  assert.match(copy, /1 of 4 ideas held/);
  assert.match(copy, /Kept slipping/);
  assert.match(copy, /missed 2×/);
  assert.doesNotMatch(copy, /textarea/);
});

test('the lesson hook records only tap formats it can ask again', () => {
  const api = load({books: [book('b', [1])], guides: [lesson('b', 1)]});
  api.keepRecordTap({bookId: 'b', unitId: 'u1'}, {id: 'q1', format: 'pick'}, true, true);
  api.keepRecordTap({bookId: 'b', unitId: 'u1'}, {id: 'q2', format: 'scale'}, true, true);
  assert.ok(api.keepEntry('b', 'tap:u1:q1'));
  assert.equal(api.keepEntry('b', 'tap:u1:q2'), null);
});
