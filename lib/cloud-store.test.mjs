import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {doubleModule, loadValidation, tsModule, validationUrl} from '../tests/fixtures/ts-modules.mjs';
import {sampleLibrary} from '../tests/fixtures/sample-library.mjs';

// Run the real storage SQL against SQLite with the same API shape as D1; R2 and
// platform identity are isolated test doubles. No application auth bypass exists.
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE library_books (user_id TEXT, book_id TEXT, source_hash TEXT, object_key TEXT, updated_at TEXT, PRIMARY KEY(user_id,book_id));
CREATE TABLE library_guides (user_id TEXT, book_id TEXT, source_hash TEXT, unit_id TEXT, object_key TEXT, updated_at TEXT, PRIMARY KEY(user_id,book_id,source_hash,unit_id));
CREATE TABLE library_state (user_id TEXT, area TEXT, book_id TEXT, field_key TEXT, value_json TEXT, updated_at TEXT, PRIMARY KEY(user_id,area,book_id,field_key));`);
const objects = new Map();
const db = {prepare(query) { const statement = sql.prepare(query); let args = []; return {bind(...values) {args = values; return this;}, async first() {return statement.get(...args) || null;}, async all() {return {results: statement.all(...args)};}, async run() {return statement.run(...args);}}; }, async batch(statements) {return Promise.all(statements.map(s => s.run()));}};
const bucket = {async put(key, data) {objects.set(key, data);}, async get(key) {return objects.has(key) ? {async json() {return JSON.parse(objects.get(key));}} : null;}};
let signedIn = {userId: 'owner', email: 'owner@example.test'};
// The open edition bundles no books; an invented library stands in for lib/seed-library.json.
const library = sampleLibrary();
const [seed, ...additional] = library;
const validation = await loadValidation();
const store = await import(tsModule('../../lib/cloud-store.ts', {
  'cloudflare:workers': doubleModule({env: {DB: db, BUCKET: bucket}}),
  '@/app/auth': doubleModule({getUser: async () => signedIn}),
  './seed-library.json': doubleModule({default: library}),
  './cloud-validation': validationUrl,
}));
const plain = value => JSON.parse(JSON.stringify(value));

test('API rejects anonymous and cross-origin writes', async () => {
  signedIn = null;
  const anonymous = await store.apiRoute(new Request('https://margin.example/api/state'), async () => ({ok: true}));
  assert.equal(anonymous.status, 401);
  signedIn = {userId: 'owner', email: 'owner@example.test'};
  const crossOrigin = await store.apiRoute(new Request('https://margin.example/api/state', {method: 'PATCH', headers: {origin: 'https://other.example'}}), async () => ({ok: true}));
  assert.equal(crossOrigin.status, 403);
  const allowed = await store.apiRoute(new Request('https://margin.example/api/state', {method: 'PATCH', headers: {origin: 'https://margin.example'}}), async () => ({ok: true}));
  assert.equal(allowed.status, 200);
});
test('independent device fields merge and every user sees only their own notes', async () => {
  const patch = (key, value) => validation.validateStateChange({area: 'notes', bookId: 'b', key, value});
  await store.writeChanges('owner', [patch('from-phone', 'A'), patch('from-ipad', 'B')]);
  await store.writeChanges('owner', [patch('from-phone', 'Updated')]);
  await store.writeChanges('other', [patch('from-phone', 'Private')]);
  assert.deepEqual(plain((await store.getState('owner')).notes), {b: {'from-phone': 'Updated', 'from-ipad': 'B'}});
  assert.deepEqual(plain((await store.getState('other')).notes), {b: {'from-phone': 'Private'}});
  await store.writeChanges('owner', [patch('from-phone', null)]);
  await store.writeChanges('owner', [patch('from-phone', 'Old backup')], true);
  assert.deepEqual(plain((await store.getState('owner')).notes), {b: {'from-ipad': 'B'}});
});
test('books and guides persist by owner, and a conflicting edition cannot replace them', async () => {
  const book = validation.validateBook({id: 'new-book', title: 'Synthetic book', author: 'QA', chapters: [{id: 'c1', title: 'A chapter', text: 'A small source passage.'}]});
  await store.saveBook('owner', book);
  assert.equal((await store.getBook('owner', book.id)).title, book.title);
  assert.equal(await store.getBook('other', book.id), null);
  await assert.rejects(() => store.saveBook('owner', {...book, title: 'Different edition'}), /different edition/);
  assert.equal((await store.getBook('owner', book.id)).title, book.title);
  const guide = await validation.validateGuideRecord(seed.guides[0], seed.book);
  await store.saveGuide('owner', guide);
  const changed = {...guide, model: 'Later conflicting import'};
  await store.saveGuide('owner', changed);
  assert.equal((await store.getGuides('owner', seed.book.id)).find(g => g.unitId === guide.unitId).model, guide.model);
  assert.equal((await store.getGuides('other', seed.book.id)).length, seed.guides.length);
});

test('every bundled book remains available after another book is imported', async () => {
  assert.ok(additional.length);
  for(const entry of additional){
    assert.ok((await store.getBooks('owner')).some(b=>b.id===entry.book.id));
    assert.equal((await store.getBook('owner',entry.book.id)).sourcePdf,entry.book.sourcePdf);
    assert.equal((await store.getGuides('owner',entry.book.id)).length,entry.guides.length);
  }
});

const savedBookmark=(title='Saved idea')=>JSON.stringify({version:1,kind:'highlight',view:'reader',chapterId:'c1',unitId:'',step:0,title,quote:'A small source passage.',prefix:'',suffix:'',start:0,end:23,createdAt:'2026-10-12T20:00:00.000Z'});
test('bookmarks merge across devices, remain owner scoped, and keep deletion tombstones',async()=>{
  const patch=(key,value)=>validation.validateStateChange({area:'bookmarks',bookId:'saved-book',key,value});
  assert.deepEqual(plain((await store.getState('new-bookmark-user')).bookmarks),{});
  await Promise.all([
    store.writeChanges('bookmark-owner',[patch('phone',savedBookmark('Phone idea'))]),
    store.writeChanges('bookmark-owner',[patch('ipad',savedBookmark('iPad idea'))]),
    store.writeChanges('bookmark-other',[patch('phone',savedBookmark('Private idea'))]),
  ]);
  assert.deepEqual(plain((await store.getState('bookmark-owner')).bookmarks),{'saved-book':{phone:savedBookmark('Phone idea'),ipad:savedBookmark('iPad idea')}});
  assert.deepEqual(plain((await store.getState('bookmark-other')).bookmarks),{'saved-book':{phone:savedBookmark('Private idea')}});
  await store.writeChanges('bookmark-owner',[patch('phone',null)]);
  await store.writeChanges('bookmark-owner',[patch('phone',savedBookmark('Stale backup'))],true);
  assert.deepEqual(plain((await store.getState('bookmark-owner')).bookmarks),{'saved-book':{ipad:savedBookmark('iPad idea')}});
});

test('portable companion import preserves bookmarks alongside old state fields',async()=>{
  const book=validation.validateBook({id:'bookmark-import',title:'Synthetic import',author:'QA',chapters:[{id:'c1',title:'Chapter',text:'A small source passage.'}]});
  const body={books:[book],guides:[],state:{bookmarks:{[book.id]:{first:savedBookmark()}},notes:{[book.id]:{idea:'My note'}}}};
  const result=await store.importCompanion('bookmark-import-owner',body);
  assert.equal(result.imported.stateFields,2);
  assert.equal(result.state.bookmarks[book.id].first,savedBookmark());
  assert.equal(result.state.notes[book.id].idea,'My note');
  await assert.rejects(()=>store.importCompanion('rejected-bookmark-import',{...body,state:{bookmarks:{[book.id]:{first:'{}'}}}}),/Bookmark/);
  assert.equal(await store.getBook('rejected-bookmark-import',book.id),null);
});

test('revised bundled teaching replaces legacy prepared units only for the same source edition',async()=>{
  const user='prepared-refresh-owner',current=await validation.validateGuideRecord(seed.guides[0],seed.book);
  const legacy={...current,model:'Legacy prepared companion',guide:{...current.guide,gist:'An older explanation from this same book edition.'}};
  const generated={...current,unitId:current.chapterId+':generated-1',prepared:false,model:'User generated companion',guide:{...current.guide,gist:'A separately generated explanation to preserve.'}};
  await store.saveGuide(user,legacy);
  await store.saveGuide(user,generated);
  const before=plain(await store.getBook(user,seed.book.id));
  const result=await store.getGuides(user,seed.book.id);
  assert.deepEqual(plain(result.find(g=>g.unitId===current.unitId)),plain({...seed.guides[0],bookId:seed.book.id,sourceHash:current.sourceHash}));
  assert.deepEqual(plain(result.find(g=>g.unitId===generated.unitId)),plain(generated));
  assert.equal(result.length,seed.guides.length+1);
  assert.deepEqual(plain(await store.getBook(user,seed.book.id)),before);
  // Stored material remains immutable; the updated bundle is the read-time view.
  const row=sql.prepare('SELECT object_key FROM library_guides WHERE user_id=? AND unit_id=?').get(user,current.unitId);
  assert.equal(JSON.parse(objects.get(row.object_key)).guide.gist,legacy.guide.gist);
});

test('bundled teaching never replaces guides attached to a different stored edition',async()=>{
  const user='older-edition-owner',book={...seed.book,title:'Legacy edition title'},hash=await validation.sourceHash(book);
  const bookKey='test/legacy-edition-book',guideKey='test/legacy-edition-guide';
  const guide={...await validation.validateGuideRecord(seed.guides[0],seed.book),sourceHash:hash,model:'This edition companion'};
  await bucket.put(bookKey,JSON.stringify(book));await bucket.put(guideKey,JSON.stringify(guide));
  sql.prepare('INSERT INTO library_books (user_id,book_id,source_hash,object_key,updated_at) VALUES (?,?,?,?,?)').run(user,book.id,hash,bookKey,new Date().toISOString());
  sql.prepare('INSERT INTO library_guides (user_id,book_id,source_hash,unit_id,object_key,updated_at) VALUES (?,?,?,?,?,?)').run(user,book.id,hash,guide.unitId,guideKey,new Date().toISOString());
  assert.deepEqual(plain(await store.getGuides(user,book.id)),[plain(guide)]);
  assert.equal((await store.getBook(user,book.id)).title,'Legacy edition title');
});

test('the shipped edition bundles no books, so a new library starts empty',async()=>{
  const {readFile}=await import('node:fs/promises');
  const shipped=JSON.parse(await readFile(new URL('./seed-library.json',import.meta.url),'utf8'));
  assert.deepEqual(shipped,[]);
  const empty=await import(tsModule('../../lib/cloud-store.ts',{
    'cloudflare:workers':doubleModule({env:{DB:db,BUCKET:bucket}}),
    '@/app/auth':doubleModule({getUser:async()=>signedIn}),
    './seed-library.json':doubleModule({default:shipped}),
    './cloud-validation':validationUrl,
  },'shipped-seed-library'));
  assert.deepEqual(await empty.getBooks('brand-new-owner'),[]);
  assert.equal(await empty.getBook('brand-new-owner',seed.book.id),null);
  assert.deepEqual(await empty.getGuides('brand-new-owner',seed.book.id),[]);
});
