import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./lessons-first.js', import.meta.url), 'utf8');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(book, guides, state = {checks: {}, last: {}}) {
  const context = {books: [book], activeBook: book, state, esc,
    bookGuides: () => guides,
    lessonProgressModel: (data, bookId, unitId) => { const c = data.checks[bookId] || {}; return {reviewed: c['lesson:' + unitId] === true, visited: Array.from({length: 6}, (_, i) => c['seen:' + unitId + ':' + i] === true)}; },
    reviewEntry: () => null, progressKey: (k, id) => k + ':' + id};
  vm.createContext(context);
  vm.runInContext(source + ';this.api={lessonCode,lessonDone,bookLessonState};', context);
  return context.api;
}
const chapter = (id, title, extra = {}) => ({id, title, text: '', ...extra});
const lesson = (chapterId, n = 1) => ({unitId: chapterId + ':' + n, chapterId, guide: {title: 'Lesson ' + n}});

test('chapters number in order, front and back matter read Intro and End', () => {
  const book = {id: 'b', chapters: [chapter('f', 'Foreword'), chapter('c1', 'One'), chapter('c2', 'Two'), chapter('a', 'Afterword')]};
  const guides = [lesson('f'), lesson('c1'), lesson('c2'), lesson('a')];
  const {lessonCode} = load(book, guides);
  assert.deepEqual(guides.map(g => lessonCode(g).code), ['Intro · L1', 'C1 · L1', 'C2 · L1', 'End · L1']);
});

test('a chapter split into several lessons counts L1, L2 under one chapter number', () => {
  const book = {id: 'b', chapters: [chapter('c1', 'Basics'), chapter('c2', 'Zoo')]};
  const guides = [lesson('c1', 1), lesson('c1', 2), lesson('c1', 3), lesson('c2', 1)];
  const {lessonCode} = load(book, guides);
  assert.deepEqual(guides.map(g => lessonCode(g).code), ['C1 · L1', 'C1 · L2', 'C1 · L3', 'C2 · L1']);
  assert.equal(lessonCode(guides[1]).spoken, 'Chapter 1, lesson 2');
});

test('sections before the introduction are front matter too', () => {
  const book = {id: 'b', chapters: [chapter('q', 'Notable Quotables'), chapter('i', 'Introduction'), chapter('c1', 'What You Will Learn')]};
  const guides = [lesson('q'), lesson('i'), lesson('c1')];
  const {lessonCode} = load(book, guides);
  assert.deepEqual(guides.map(g => lessonCode(g).code), ['Intro · L1', 'Intro · L2', 'C1 · L1']);
});

test('the next lesson is the saved one, then the first one not done; a book is finished when every lesson is done', () => {
  const book = {id: 'b', chapters: [chapter('c1', 'One'), chapter('c2', 'Two'), chapter('c3', 'Three')]};
  const guides = [lesson('c1'), lesson('c2'), lesson('c3')];
  const state = {checks: {b: {'seen:c1:1:5': true}}, last: {b: {unit: 'c2:1'}}};
  const api = load(book, guides, state);
  let s = api.bookLessonState(book);
  assert.equal(s.next.unitId, 'c2:1');
  assert.equal(s.done, 1);
  state.checks.b['lesson:c2:1'] = true;
  s = api.bookLessonState(book);
  assert.equal(s.next.unitId, 'c3:1');
  state.checks.b['seen:c3:1:5'] = true;
  s = api.bookLessonState(book);
  assert.equal(s.finished, true);
  assert.equal(s.next, null);
});
