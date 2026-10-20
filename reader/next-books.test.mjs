import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./next-books.js', import.meta.url), 'utf8');
function runtime({ saveFails = false } = {}) {
  const book = { id: 'synthetic' }, events = [], cache = new Map([[book.id, { status: 'error', requiresSave: true }]]);
  const context = vm.createContext({
    activeBook: book, nextBooksCache: cache, nextBooksWaitingForSave: new Set(), nextBooksPending: new Set(), nextBooksPollTimers: new Map(),
    curatedNextBooks: () => null, refreshNextBooksPanel: () => {}, clearTimeout,
    persistBook: async () => { events.push('save'); if (saveFails) throw Error('offline'); },
    nextBooksRequest: async (_, method = 'GET') => { events.push(method); return method === 'GET' ? { status: 'missing', available: true } : { status: 'ready', recommendations: [] }; },
    verifiedNextBooksResponse: value => value,
  });
  vm.runInContext(source.slice(source.indexOf('  async function loadNextBooks('), source.indexOf('  function nextBooksAfterRender(')) + '\nthis.run = retry => loadNextBooks(activeBook, retry);', context);
  return { events, cache, run: context.run };
}
test('recommendation retry saves a failed upload before requesting its reading list', async () => {
  const r = runtime(); await r.run(false); assert.deepEqual(r.events, []);
  await r.run(true); assert.deepEqual(r.events, ['save', 'GET', 'POST']);
  assert.equal(r.cache.get('synthetic').status, 'ready');
});
test('failed recommendation retry keeps a recoverable save error and never submits AI', async () => {
  const r = runtime({ saveFails: true }); await r.run(true);
  assert.deepEqual(r.events, ['save']);
  assert.equal(r.cache.get('synthetic').requiresSave, true);
  assert.equal(r.cache.get('synthetic').status, 'error');
});
