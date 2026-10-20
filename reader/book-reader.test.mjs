import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const structure = await readFile(new URL('./epub-structure.js', import.meta.url), 'utf8');
const reader = await readFile(new URL('./book-reader.js', import.meta.url), 'utf8');
const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chapters = [
  {id: 'c1', title: 'Small Routines', label: 'Chapter 1', partTitle: 'Routines', partLabel: 'Part I', notes: {1: 'An invented note for the test (2026).'}, figures: {f1: '/books/x/f1.jpg'},
    text: ['> routines (roo•teenz)', '> A sequence of actions followed regularly.', '> Little by little, the day takes its shape', '> An invented proverb, Example Collection', 'SMALL ACTIONS REPEATED DAILY, and not the rare big ones, shape a week.¹', 'A second paragraph.', '## Onward', '![f1]', '~ Fig. 1. A kettle.', 'After the figure.'].join('\n\n')},
  {id: 'c2', title: 'Notes That Get Used', label: 'Chapter 2', text: 'A gardener keeps one card per bed.'},
];
function runtime() {
  const {document} = parseHTML('<html><body><main id="main"></main></body></html>');
  const context = vm.createContext({document, window: {scrollY: 0, addEventListener() {}, innerHeight: 900}, esc, view: 'reader', chapterId: 'c1',
    activeBook: {id: 'b', title: 'Synthetic', author: 'A. Author', chapters}, state: {checks: {}, last: {}},
    progressKey: (kind, id) => kind + ':' + id, readingPosition: () => 0, bookGuides: () => [{chapterId: 'c1', unitId: 'c1:prepared'}], tapQuestions: () => [1, 2, 3],
    bookmarkPageButton: () => '<button data-action="bookmark-page"></button>', raButton: () => '', cleanParagraphs: c => c.text.split(/\n+/).filter(l => !/^!\[/.test(l)).map(l => l.replace(/^(?:## |> |~ )/, '')),
    hasBookStructure: () => false, bookStructureGroups: () => [], originalPdfLink: () => '', documentSourceLink: () => ''});
  vm.runInContext(structure + reader + '\nthis.view_=bookReaderView;', context);
  return {context, document};
}

test('the reader shows the book’s own structure as a page', () => {
  const {context, document} = runtime();
  document.querySelector('main').innerHTML = context.view_();
  const article = document.querySelector('.reader-article');
  assert.equal(article.querySelector('.br-part').textContent, 'Part I · Routines');
  assert.equal(article.querySelector('h1').textContent, 'Small Routines');
  assert.equal(article.querySelector('.br-definition dfn').textContent, 'routines');
  assert.equal(article.querySelector('.br-attribution').textContent, 'An invented proverb, Example Collection');
  const first = article.querySelector(':scope > p.br-first');
  assert.equal(first.querySelector('.br-lead').textContent, 'SMALL ACTIONS REPEATED DAILY,');
  assert.equal(first.querySelector('[data-action="br-note"]').dataset.note, '1');
  assert.equal(article.querySelector('h2').textContent, 'Onward');
  assert.equal(article.querySelector('figure img').getAttribute('src'), '/books/x/f1.jpg');
  assert.equal(article.querySelector('figcaption').textContent, 'Fig. 1. A kettle.');
  // Body paragraphs stay direct children so highlights and progress keep working.
  assert.equal(article.querySelectorAll(':scope > p').length, 3);
  assert.ok(document.querySelector('progress[data-reading-position]'));
  assert.ok(document.querySelector('[data-reading-percent]'));
  assert.match(document.querySelector('.br-card-check').textContent, /3 quick questions.*No typing/s);
  assert.equal(document.querySelector('.br-card-next').dataset.chapter, 'c2');
  assert.equal(document.querySelector('textarea'), null);
});

test('a bundled edition hides the uploads it replaces, and a new upload replaces an older copy', () => {
  const block = app.slice(app.indexOf('  function isReplaced('), app.indexOf('  async function importFile('));
  const books = [{id: 'new', title: 'An Invented Book About Routines', author: 'Example Author', replaces: ['document-invented-routines']}, {id: 'document-invented-routines-abc', title: 'Invented Routines', author: 'x'}, {id: 'other', title: 'Other', author: 'y'}, {id: 'old-upload', title: 'Other', author: 'Y'}];
  const toasts = [];
  const context = vm.createContext({books, state: {hiddenBooks: {}}, save() {}, render() {}, hasGuide: () => false, bookGuides: () => [], toast: (m, a) => toasts.push([m, a]), setTimeout: f => f()});
  vm.runInContext(block + '\nthis.isReplaced=isReplaced;this.replace=replaceOlderCopies;', context);
  assert.equal(context.isReplaced(books[1]), true);
  assert.equal(context.isReplaced(books[0]), false);
  assert.equal(context.isReplaced(books[2]), false);
  context.replace(books[2]);
  assert.deepEqual(Object.keys(context.state.hiddenBooks), ['old-upload']);
  toasts[0][1].run();
  assert.deepEqual(Object.keys(context.state.hiddenBooks), []);
});
