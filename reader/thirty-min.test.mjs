import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {isoSource} from '../scripts/iso-source.mjs';
import {sampleBook, sampleThirtyMin} from '../tests/fixtures/sample-library.mjs';

const core = (await readFile(new URL('../lib/thirty-min-core.mjs', import.meta.url), 'utf8')).replace(/^export /gm, '');
const source = await isoSource() + await readFile(new URL('./thirty-min.js', import.meta.url), 'utf8');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// The open edition bundles no 30-min versions; an invented one stands in.
const version = sampleThirtyMin();
function load({prepared = {[version.bookId]: version}, position = 0} = {}) {
  const book = {id: version.bookId, title: sampleBook.title, author: sampleBook.author, chapters: []};
  const context = {esc, activeBook: book, view: 'reader', chapterId: '30-min', state: {last: {}, checks: {}}, bookReaderChromeHidden: false,
    document: {getElementById: id => id === 'thirty-min-data' ? {textContent: JSON.stringify(prepared)} : null, createElement: () => ({}), head: {appendChild() {}}},
    bookGuides: () => [], ideaApplies: () => true, ideaVisual: () => ({}), ideaArt: () => '<svg></svg>', ideaSentence: s => s, brIcon: () => '', topbar: () => '',
    readingPosition: () => position, localAI: {available: false}, raButton: () => ''};
  vm.createContext(context);
  vm.runInContext(core + source + ';this.api={thirtyMinView,thirtyMinCard,thirtyMinFor};', context);
  return {api: context.api, book};
}

test('the 30-min version reads as one page: thread, every section with pictures, a closing spine, no questions', () => {
  const {api} = load(), html = api.thirtyMinView();
  assert.equal((html.match(/class="tm-section"/g) || []).length, version.sections.length);
  assert.equal((html.match(/class="tm-fig tm-fig-/g) || []).length, version.sections.reduce((n, s) => n + s.blocks.filter(b => b.fig).length, 0));
  assert.match(html, /The whole book, one page/);
  assert.match(html, /30 min read/);
  assert.doesNotMatch(html, /<textarea|<input|tap-choice|data-action="br-check"/);
});

test('the book home card shows the version and picks up where reading stopped', () => {
  assert.match(load().api.thirtyMinCard(), /Start reading/);
  assert.match(load({position: .4}).api.thirtyMinCard(), /40% read[\s\S]*Continue reading/);
});

test('a book without a version and without the cloud shows no card', () => {
  const {api, book} = load({prepared: {}});
  assert.equal(api.thirtyMinFor(book), null);
  assert.equal(api.thirtyMinCard(book), '');
});
