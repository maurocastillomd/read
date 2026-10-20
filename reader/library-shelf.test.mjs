import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./library-shelf.js', import.meta.url), 'utf8');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(books, store = {}) {
  const context = {books, state: {hiddenBooks: {}}, esc, isReplaced: () => false, libraryQuery: '', shelfTiles: list => list.map(b => b.id).join(','),
    localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }}};
  vm.createContext(context);
  vm.runInContext(source + ';this.api={coverObject,shelfGroup,shelfOpen};', context);
  return context.api;
}
const article = (id, title, extra = {}) => ({id, title, author: 'A. Author', sourceType: 'article', cover: '', chapters: [], ...extra});

test('a book with its own cover shows that cover', () => {
  const {coverObject} = load([{id: 'b', title: 'B', author: 'X', cover: 'data:image/jpeg;base64,AAAA', chapters: []}]);
  assert.match(coverObject({id: 'b', title: 'B', author: 'X', cover: 'data:image/jpeg;base64,AAAA'}), /book-cover-photo" src="data:image\/jpeg/);
});

test('readings without a picture get covers drawn from their own title, never the same one twice', () => {
  const list = Array.from({length: 40}, (_, i) => article('document-' + i, 'Paper number ' + i));
  const {coverObject} = load(list);
  const art = list.map(b => coverObject(b).replace(/<span class="book-cover-title.*$/s, ''));
  assert.equal(new Set(art).size, list.length);
});

test('a picture shared by two readings is not used as either one\'s cover', () => {
  const same = 'data:image/png;base64,QUJD';
  const list = [article('a', 'One', {cover: same}), article('b', 'Two', {cover: same}), article('c', 'Three', {cover: 'data:image/png;base64,WFla'})];
  const {coverObject} = load(list);
  assert.doesNotMatch(coverObject(list[0]), /QUJD/);
  assert.doesNotMatch(coverObject(list[1]), /QUJD/);
  assert.match(coverObject(list[2]), /cover-photo-band"><img src="data:image\/png;base64,WFla/);
});

test('a hidden shelf stays hidden on this device', () => {
  const store = {'read.shelves.v1': JSON.stringify({articles: false})};
  const {shelfGroup, shelfOpen} = load([], store);
  assert.equal(shelfOpen('books'), true);
  assert.equal(shelfOpen('articles'), false);
  assert.match(shelfGroup('articles', 'Articles & papers', [article('a', 'A')]), /shelf-closed.*aria-expanded="false".*inert/s);
});
