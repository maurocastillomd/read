import test from 'node:test';
import assert from 'node:assert/strict';
import {planBook, learningContext} from './guide-core.mjs';
import {loadValidation} from '../tests/fixtures/ts-modules.mjs';
import {bookHash, sampleEntry, sampleMnemonic, samplePdfEntry} from '../tests/fixtures/sample-library.mjs';

const {changesFromState, sourceHash, validateBook, validateGuideRecord, validateStateChange} = await loadValidation();
// An invented book with prepared lessons stands in for bundled seed data.
const seed = sampleEntry();

test('optional book organization survives validation without changing source identity',async()=>{
  const original={id:'organized',title:'A book',author:'Author',chapters:[{id:'foreword',title:'Foreword',text:'An introduction to the argument.'},{id:'c1',title:'The first chapter',text:'A substantive source idea.'},{id:'notes',title:'Notes',text:'Bibliographic details and citations.'}]};
  const input=structuredClone(original);
  Object.assign(input.chapters[0],{studyRole:'orientation'});
  Object.assign(input.chapters[1],{studyRole:'chapter',partTitle:'Beginnings',partNumber:1});
  Object.assign(input.chapters[2],{studyRole:'reference'});
  const book=validateBook(input);
  assert.deepEqual(book.chapters,input.chapters);
  assert.equal(await sourceHash(book),await sourceHash(validateBook(original)));
  const plan=planBook(book);
  assert.deepEqual(plan.units.map(u=>u.chapterId),['foreword','c1']);
  assert.deepEqual(plan.skipped.map(s=>s.chapterId),['notes']);
  assert.equal(planBook(book,{includeSkipped:true}).units.length,3);
  assert.equal(learningContext(book,plan.units[1]).nextChapter,null);
  assert.equal(planBook(validateBook(original)).units.length,3,'Legacy unclassified content is not silently excluded');
});
test('book organization metadata rejects malformed values instead of coercing them',()=>{
  const book={id:'organized',title:'A book',author:'Author',chapters:[{id:'c',title:'Chapter',text:'A substantive source idea.'}]};
  for(const metadata of [{partTitle:''},{partTitle:'x'.repeat(201)},{partTitle:1},{partNumber:0},{partNumber:100},{partNumber:1.5},{partNumber:'1'},{studyRole:'skip'},{studyRole:['reference']},{studyRole:null}])assert.throws(()=>validateBook({...book,chapters:[{...book.chapters[0],...metadata}]}),/Part title|Part number|Study role/);
});

test('prepared guides match their EPUB edition and exact source passages', async () => {
  const book = validateBook(seed.book);
  assert.equal(await sourceHash(book), bookHash(seed.book), 'the build script and the cloud compute the same edition hash');
  for (const guide of seed.guides) {
    const record = await validateGuideRecord(guide, book);
    assert.equal(record.prepared, true);
    assert.equal(record.sourceHash, guide.sourceHash);
  }
  const unhashed = structuredClone(seed.guides[0]); delete unhashed.sourceHash; delete unhashed.bookId;
  assert.equal((await validateGuideRecord(unhashed, book)).sourceHash, bookHash(seed.book), 'a portable guide without a hash gets one after its passages are checked');
  await assert.rejects(() => validateGuideRecord({...seed.guides[0], bookId: 'another-book'}, book), /different book/);
  await assert.rejects(() => validateGuideRecord({...seed.guides[0], chapterId: 'absent', unitId: 'absent:prepared'}, book), /absent chapter/);
  await assert.rejects(() => validateGuideRecord({...seed.guides[0], unitId: 'c1:u9', prepared: false}, book), /absent section/);
});
test('a stale edition or fabricated quote cannot be imported', async () => {
  const book = validateBook(seed.book);
  const guide = structuredClone(seed.guides[0]);
  guide.guide.concepts[0].sourceRefs[0].quote = 'This sentence is absent from the book.';
  await assert.rejects(() => validateGuideRecord(guide, book), /quote does not match/);
  const changed = structuredClone(book);
  changed.chapters[0].text += '\nChanged edition';
  assert.notEqual(await sourceHash(book), await sourceHash(changed));
  const hash = await sourceHash(book);
  await assert.rejects(() => validateGuideRecord({...seed.guides[0], sourceHash: hash}, changed), /does not match this EPUB edition/);
});
test('portable imports preserve generated mnemonics and reject malformed added fields', async () => {
  const book=validateBook(seed.book),record=structuredClone(seed.guides[0]);
  record.guide.mnemonic=sampleMnemonic();
  assert.deepEqual((await validateGuideRecord(record,book)).guide.mnemonic,record.guide.mnemonic);
  delete record.guide.mnemonic.meaning;
  await assert.rejects(()=>validateGuideRecord(record,book),/mnemonic.meaning is required/);
});
test('book IDs and state paths reject prototype pollution keys', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.throws(() => validateBook({...seed.book, id: key}), /Book ID is invalid/);
    assert.throws(() => validateStateChange({area: 'notes', bookId: 'book', key, value: 'text'}), /Field key is invalid/);
    assert.throws(() => changesFromState(JSON.parse(`{"notes":{"${key}":{"a":"text"}}}`)), /Book ID is invalid/);
  }
});
test('state is represented as individual fields, including explicit deletions', () => {
  const changes = changesFromState({notes: {book: {a: 'My idea', b: 'Second note'}}, last: {book: {chapter: 'c8', step: 2}}, checks: {book: {meaning: true}}, reviewed: {book: '2026-10-11T01:00:00Z'}, hiddenBooks: {book: true}});
  assert.equal(changes.length, 7);
  assert.deepEqual(changes[0], {area: 'notes', bookId: 'book', key: 'a', value: 'My idea'});
  assert.deepEqual(validateStateChange({area: 'hiddenBooks', bookId: 'book', value: null}), {area: 'hiddenBooks', bookId: 'book', key: '', value: null});
  assert.throws(() => validateStateChange({area: 'notes', bookId: 'book', key: 'a', value: {bad: true}}), /Note is invalid/);
});
test('duplicate chapters and oversized extracted text are rejected', () => {
  assert.throws(() => validateBook({...seed.book, chapters: [seed.book.chapters[0], seed.book.chapters[0]]}), /unique ID/);
  assert.throws(() => validateBook({...seed.book, chapters: [{id: 'c', title: 't', text: 'é'.repeat(7 * 1024 * 1024)}]}), /12 MB/);
});

test('PDF chapters keep their original page links and every new guide cites this PDF', async () => {
  const entry=samplePdfEntry();
  const book=validateBook(entry.book);
  assert.equal(book.sourceFormat,'PDF');
  assert.equal(book.sourcePdf,'/books/sample-routines-pdf.pdf');
  assert.equal(book.chapters.filter(c=>/^chapter-[1-3]$/.test(c.id)).length,3);
  assert.deepEqual(book.chapters.map(c=>[c.sourcePageStart,c.sourcePageEnd]),entry.book.chapters.map(c=>[c.sourcePageStart,c.sourcePageEnd]));
  assert.equal(entry.guides.length,3);
  for(const guide of entry.guides) await validateGuideRecord(guide,book);
  assert.equal(validateBook({...entry.book,sourcePdf:'https://external.invalid/book.pdf'}).sourcePdf,undefined);
  assert.equal(validateBook({...entry.book,sourcePdf:'/books/../../bad.pdf'}).sourcePdf,undefined);
});

const bookmark = (overrides={}) => ({version:1,kind:'highlight',view:'reader',chapterId:'c1',unitId:'',step:0,title:'A routine idea',quote:'Progress happens gradually.',prefix:'Remember: ',suffix:' Keep observing.',start:10,end:37,createdAt:'2026-10-12T20:00:00.000Z',...overrides});
const bookmarkChange = value => ({area:'bookmarks',bookId:'book',key:'saved-1',value:typeof value==='object'&&value!==null?JSON.stringify(value):value});

test('bookmarks validate as separate strings and old backups remain valid',()=>{
  const saved=bookmarkChange(bookmark());
  assert.deepEqual(validateStateChange(saved),saved);
  assert.deepEqual(changesFromState({bookmarks:{book:{'saved-1':saved.value}}}),[saved]);
  assert.deepEqual(changesFromState({notes:{book:{note:'Older backup'}}}),[{area:'notes',bookId:'book',key:'note',value:'Older backup'}]);
  assert.deepEqual(validateStateChange(bookmarkChange(null)),bookmarkChange(null));
  const place=bookmarkChange(bookmark({kind:'place',view:'library',chapterId:'',quote:'',prefix:'',suffix:'',start:0,end:0}));
  assert.deepEqual(validateStateChange(place),place);
});

test('bookmark validation rejects incomplete, oversized, and malformed selections',()=>{
  const invalids=[
    '{bad json', '{}', JSON.stringify({...bookmark(),extra:'unexpected'}),
    JSON.stringify({...bookmark(),quote:undefined}),
    bookmark({version:2}),bookmark({kind:['highlight']}),bookmark({view:['reader']}),bookmark({view:'arbitrary-route'}),
    bookmark({step:-1}),bookmark({step:6}),bookmark({step:1.5}),
    bookmark({title:'x'.repeat(1001)}),bookmark({quote:'x'.repeat(12001)}),bookmark({prefix:'x'.repeat(121)}),bookmark({suffix:'x'.repeat(121)}),
    bookmark({quote:''}),bookmark({quote:'  '}),bookmark({start:38}),bookmark({end:10}),bookmark({start:-1}),bookmark({end:20000001}),bookmark({start:1.5}),
    bookmark({chapterId:'__proto__'}),bookmark({unitId:'constructor'}),bookmark({chapterId:null}),
    bookmark({createdAt:'yesterday'}),bookmark({createdAt:'2026-02-30T20:00:00.000Z'}),
  ];
  for(const value of invalids) assert.throws(()=>validateStateChange(bookmarkChange(value)),/Bookmark/);
  assert.throws(()=>validateStateChange({...bookmarkChange(bookmark()),key:'__proto__'}),/Field key/);
  assert.throws(()=>validateStateChange({...bookmarkChange(bookmark()),value:bookmark()}),/Bookmark/);
});

test('bookmark boundaries accept complete text without interpreting markup',()=>{
  const data=bookmark({quote:'<script>not executable</script>',start:0,end:32,title:'<img src=x onerror=alert(1)>',createdAt:'2026-10-12T20:00:00Z'});
  const validated=validateStateChange(bookmarkChange(data));
  assert.deepEqual(JSON.parse(validated.value),data);
  assert.doesNotThrow(()=>validateStateChange(bookmarkChange(bookmark({quote:'x'.repeat(12000),prefix:'x'.repeat(120),suffix:'x'.repeat(120),title:'x'.repeat(1000),start:19988000,end:20000000,step:5}))));
});

test('passage bookmarks keep their quote without requiring a highlight',()=>{
  const change=bookmarkChange(bookmark({kind:'place'}));
  assert.deepEqual(validateStateChange(change),change);
});

test('bookmark panel and page positions are optional and validate only known lesson state',()=>{
  const panel={concept:1,path:0,answer:null,memory:true,level:50,inflow:6,outflow:4,history:[50],feedback:20,gain:50,delay:0,mode:'balance',feedbackHistory:[20],attention:5,practiceIndex:2,practiceReveal:true,practiceOpen:false};
  assert.doesNotThrow(()=>validateStateChange(bookmarkChange(bookmark({panel:JSON.stringify(panel),scroll:1000}))));
  assert.doesNotThrow(()=>validateStateChange(bookmarkChange(bookmark({panel:'{}',scroll:0}))));
  for(const value of [
    bookmark({scroll:-1}),bookmark({scroll:1001}),bookmark({scroll:1.5}),bookmark({scroll:'100'}),
    bookmark({panel:''}),bookmark({panel:'[]'}),bookmark({panel:'null'}),bookmark({panel:'x'.repeat(2001)}),
    bookmark({panel:JSON.stringify({concept:-1})}),bookmark({panel:JSON.stringify({attention:1001})}),
    bookmark({panel:JSON.stringify({answer:'yes'})}),bookmark({panel:JSON.stringify({memory:'true'})}),
    bookmark({panel:JSON.stringify({practiceIndex:-1})}),bookmark({panel:JSON.stringify({practiceIndex:1001})}),bookmark({panel:JSON.stringify({practiceIndex:'1'})}),
    bookmark({panel:JSON.stringify({practiceReveal:'true'})}),bookmark({panel:JSON.stringify({practiceOpen:1})}),
    bookmark({panel:JSON.stringify({mode:'anything'})}),bookmark({panel:JSON.stringify({history:[]})}),
    bookmark({panel:JSON.stringify({history:Array(101).fill(50)})}),bookmark({panel:JSON.stringify({history:[50,'1']})}),
    bookmark({panel:'{"__proto__":{"polluted":true}}'}),bookmark({panel:JSON.stringify({arbitrary:'state'})}),
  ])assert.throws(()=>validateStateChange(bookmarkChange(value)),/Bookmark/);
});


test('document imports preserve bounded format, reading type, source link, and extraction caveats',()=>{
  for(const format of ['EPUB','PDF','DOCX','TXT','MD','HTML']){
    const book=validateBook({...seed.book,sourceFormat:format,sourceType:'article',sourceUrl:'https://example.org/article#methods',importWarnings:['Figures are not included in the extracted text.']});
    assert.equal(book.sourceFormat,format);assert.equal(book.sourceType,'article');assert.equal(book.sourceUrl,'https://example.org/article');assert.equal(book.importWarnings.length,1);
  }
  for(const extra of [{sourceFormat:'EXE'},{sourceType:'research-study'},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'file:///etc/passwd'},{sourceUrl:'https://user:secret@example.org/article'},{sourceUrl:'x'.repeat(4001)},{importWarnings:['x'.repeat(601)]},{importWarnings:Array(7).fill('Text')},{importWarnings:'Text'}])assert.throws(()=>validateBook({...seed.book,...extra}));
});
test('article metadata does not invalidate existing source hashes or completion identities',async()=>{
  const original=validateBook(seed.book),article=validateBook({...seed.book,sourceFormat:'DOCX',sourceType:'article'});
  assert.equal(await sourceHash(original),await sourceHash(article));assert.deepEqual(original.chapters,article.chapters);
});
