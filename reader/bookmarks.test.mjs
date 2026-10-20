import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML,NodeFilter} from 'linkedom';
const source=await readFile(new URL('./bookmarks.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('./app.js',import.meta.url),'utf8');
const paragraphSource=(await import('node:fs')).readFileSync(new URL('./epub-structure.js',import.meta.url),'utf8')+appSource.slice(appSource.indexOf('  const cleanParagraphs ='),appSource.indexOf('  function topbar('));
const sample={version:1,kind:'highlight',view:'explore',chapterId:'',unitId:'c1:prepared',step:2,title:'A coaching analogy',quote:'Compare the pattern',prefix:'',suffix:'',start:0,end:19,createdAt:'2026-10-13T02:00:00.000Z',panel:'{}',scroll:0};
function runtime(state={bookmarks:{}},overrides={}){
  const context=vm.createContext({state,books:[{id:'one',title:'Book One'},{id:'two',title:'Book Two'}],document:{addEventListener(){}},MutationObserver:class{observe(){}disconnect(){}},readIcon:name=>`<svg data-icon="${name}"></svg>`,esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),...overrides});
  vm.runInContext(paragraphSource+source+'\nthis.helpers={parseBookmark,resolveBookmarkAnchor,bookmarkLocation,bookmarkRecords,bookmarkCards,selectionBookmark,applyBookmarkHighlights,restoreBookmarkPanel,bookmarkTextNodes,saveBookmark,removeBookmarks,undoBookmarkChange,setSourceChapter:id=>bookmarkSourceChapter=id,filter:(q,kind,book)=>{bookmarkQuery=q;bookmarkFilter=kind;bookmarkBookFilter=book;}};',context);
  return context.helpers;
}
test('text anchors distinguish a repeated quote using its context',()=>{
  const h=runtime(),text='First: use the plan. Later: use the plan.';
  const b={...sample,quote:'use the plan',start:28,prefix:'Later: ',suffix:'.'};
  assert.equal(h.resolveBookmarkAnchor(text,b).start,28);
  assert.equal(h.resolveBookmarkAnchor('Added words. '+text,b).start,41);
  assert.equal(h.resolveBookmarkAnchor(text,{...b,prefix:'missing',suffix:'missing'}),null);
});
test('a unique quote can move and Unicode uses matching DOM offsets',()=>{
  const h=runtime(),quote='Coach 🏋️: compare, then decide.';
  assert.equal(h.resolveBookmarkAnchor('New introduction. '+quote,{...sample,quote,start:0,prefix:'old words'}).start,18);
  assert.equal(h.resolveBookmarkAnchor('The wording changed completely.',sample),null);
});
test('saved locations separate books at record level and separate lesson steps and source chapters',()=>{
  const h=runtime();
  assert.notEqual(h.bookmarkLocation(sample),h.bookmarkLocation({...sample,step:4}));
  assert.notEqual(h.bookmarkLocation({...sample,view:'reader',chapterId:'c1'}),h.bookmarkLocation({...sample,view:'reader',chapterId:'c2'}));
  const r=runtime({bookmarks:{one:{a:JSON.stringify(sample)},two:{a:JSON.stringify({...sample,title:'Other book'})}}});
  assert.equal(r.bookmarkRecords().length,2);
});
test('review cards escape passages and titles, preserve searchable plain text and filter by book/type',()=>{
  const payload={...sample,title:'<img src=x onerror=alert(1)>',quote:'<script>bad()</script>'};
  const h=runtime({bookmarks:{one:{a:JSON.stringify(payload)},two:{b:JSON.stringify({...sample,kind:'place',quote:''})}}});
  const html=h.bookmarkCards();assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
  h.filter('bad','highlight','one');assert.equal((h.bookmarkCards().match(/class="bookmark-card"/g)||[]).length,1);
  h.filter('bad','highlight','two');assert.ok(h.bookmarkCards().includes('No saved items'));
});
test('malformed cached items never reach the review renderer',()=>{
  const h=runtime();
  for(const data of [null,{}, {...sample,view:'javascript:alert(1)'},{...sample,quote:'x'.repeat(12001)},{...sample,start:-2},{...sample,end:0},{...sample,createdAt:'bad'},{...sample,step:10}])assert.equal(h.parseBookmark(JSON.stringify(data)),null);
  assert.equal(h.parseBookmark('not json'),null);
  assert.equal(h.parseBookmark(JSON.stringify({...sample,kind:'place',quote:'Saved without highlighting'})).kind,'place');
});

function excerptFixture({targetIndex=5,quoteAtEnd=false}={}){
  // Every occurrence has the same surrounding words. Context alone cannot
  // distinguish the selected occurrence from earlier paragraphs in the book.
  const quote='Staff members need context';
  const paragraph=quoteAtEnd?'The staff discussion begins with the same question. '.repeat(4)+quote:('The staff discussion begins with the same question. '.repeat(2)+quote+' before deciding what belongs in their report. '.repeat(3)).trim();
  const paragraphs=Array(10).fill(paragraph),firstExcerptIndex=4;
  const chapter={id:'c1',title:'Staff culture',text:['Staff culture','OceanofPDF.com',...paragraphs].join('\n\n')};
  const {document}=parseHTML('<html><body><main id="main"><article class="reader-article"></article></main><dialog id="source-dialog"><div id="source-content"></div></dialog></body></html>');
  document.documentElement.scrollHeight=2000;
  document.querySelector('.reader-article').innerHTML=paragraphs.map(p=>`<p>${p}</p>`).join('');
  document.querySelector('#source-content').innerHTML=paragraphs.slice(firstExcerptIndex,firstExcerptIndex+4).map((p,i)=>`<p class="source-p" data-source-paragraph="${firstExcerptIndex+i+1}"><span class="para-num">${firstExcerptIndex+i+1}</span>${p.replace(quote,`<mark class="source-citation">${quote}</mark>`)}</p>`).join('');
  const dialog=document.querySelector('#source-dialog');dialog.open=true;
  const target=document.querySelectorAll('.source-citation')[targetIndex-firstExcerptIndex].firstChild;
  // Linkedom provides the DOM; the browser Selection/Range boundary is mocked.
  const range={commonAncestorContainer:target,startContainer:target,endContainer:target,startOffset:0,endOffset:quote.length,intersectsNode:node=>node===target};
  const state={bookmarks:{one:{}}},book={id:'one',title:'Book One',chapters:[chapter]};
  const h=runtime(state,{document,NodeFilter,$:selector=>document.querySelector(selector),window:{scrollY:0,innerHeight:800,getSelection:()=>({isCollapsed:false,rangeCount:1,getRangeAt:()=>range})},activeBook:book,chapterId:'c1',view:'reader'});
  h.setSourceChapter('c1');
  return {h,state,document,dialog,quote,paragraphs,targetIndex,expectedStart:paragraphs.slice(0,targetIndex).join('\n').length+1+paragraph.indexOf(quote)};
}

test('saving a repeated passage from a source excerpt reopens the exact full-reader occurrence',()=>{
  const {h,state,document,dialog,quote,paragraphs,targetIndex,expectedStart}=excerptFixture();
  const captured=h.selectionBookmark();
  assert.ok(captured,'A valid source selection should create a bookmark');
  assert.equal(captured.start,expectedStart);
  assert.equal(captured.end,expectedStart+quote.length);
  assert.equal(captured.quote,quote);
  assert.equal(captured.prefix,paragraphs.join('\n').slice(expectedStart-80,expectedStart));
  assert.equal(captured.view,'reader');
  assert.equal(captured.chapterId,'c1');
  const {_source,...saved}=captured;
  state.bookmarks.one.saved=JSON.stringify({...saved,kind:'highlight'});
  const restored=h.parseBookmark(state.bookmarks.one.saved);
  assert.equal(h.resolveBookmarkAnchor(paragraphs.join('\n'),restored).start,expectedStart);
  dialog.open=false;
  h.applyBookmarkHighlights();
  const highlighted=[...document.querySelectorAll('.reader-article > p')].flatMap((p,i)=>p.querySelector('mark[data-saved-highlight]')?[i]:[]);
  assert.deepEqual(highlighted,[targetIndex]);
  assert.equal(document.querySelector('mark[data-saved-highlight]').textContent,quote);
  assert.equal(h.bookmarkTextNodes(document.querySelector('#main'),{view:'reader'}).text,paragraphs.join('\n'),'Highlight markup must preserve the original source text');
});

test('an excerpt selection with invalid paragraph identity is not anchored to a guessed occurrence',()=>{
  const {h,document}=excerptFixture();
  document.querySelectorAll('.source-p')[1].dataset.sourceParagraph='999';
  assert.equal(h.selectionBookmark(),null);
});

test('source excerpt painting converts canonical offsets and excludes matching passages outside the excerpt',()=>{
  const {h,state,document,paragraphs,quote}=excerptFixture();
  const {_source,...saved}=h.selectionBookmark();
  const full=paragraphs.join('\n'),outsideStart=paragraphs[0].length+1+paragraphs[1].indexOf(quote);
  state.bookmarks.one.inside=JSON.stringify({...saved,kind:'highlight'});
  state.bookmarks.one.outside=JSON.stringify({...saved,kind:'highlight',start:outsideStart,end:outsideStart+quote.length,prefix:full.slice(outsideStart-80,outsideStart),suffix:full.slice(outsideStart+quote.length,outsideStart+quote.length+80)});
  h.applyBookmarkHighlights();
  const marks=[...document.querySelectorAll('#source-content mark[data-saved-highlight]')];
  assert.equal(marks.length,1);
  assert.equal(marks[0].dataset.savedHighlight,'inside');
  assert.equal(marks[0].closest('.source-p').dataset.sourceParagraph,'6');
  assert.equal(marks[0].textContent,quote);
  h.applyBookmarkHighlights();
  assert.equal(document.querySelectorAll('#source-content mark[data-saved-highlight]').length,1,'Repainting should not nest or duplicate saved highlights');
});

test('a repeated quote ending at the excerpt boundary retains its highlight',()=>{
  const {h,state,document,quote}=excerptFixture({targetIndex:7,quoteAtEnd:true});
  const {_source,...saved}=h.selectionBookmark();
  assert.ok(saved.suffix.length,'The canonical anchor includes following paragraphs outside this excerpt');
  state.bookmarks.one.saved=JSON.stringify({...saved,kind:'highlight'});
  h.applyBookmarkHighlights();
  const marks=[...document.querySelectorAll('#source-content mark[data-saved-highlight]')];
  assert.equal(marks.length,1);
  assert.equal(marks[0].closest('.source-p').dataset.sourceParagraph,'8');
  assert.equal(marks[0].textContent,quote);
});

test('practice bookmarks preserve the revealed card and open panel through parsing and restoration',()=>{
  const rec={unitId:sample.unitId},practice={index:0,reveal:false,open:false},lab={};
  const h=runtime(undefined,{bookGuides:()=>[rec],practiceSession:()=>practice,labSession:()=>lab});
  const bookmark=h.parseBookmark(JSON.stringify({...sample,panel:JSON.stringify({concept:1,practiceIndex:2,practiceReveal:true,practiceOpen:true})}));
  assert.ok(bookmark);
  h.restoreBookmarkPanel(bookmark);
  assert.deepEqual(practice,{index:2,reveal:true,open:true});
  assert.equal(lab.concept,1);
  for(const panel of [{practiceIndex:-1},{practiceIndex:1001},{practiceIndex:'2'},{practiceReveal:'true'},{practiceOpen:1}]){
    assert.equal(h.parseBookmark(JSON.stringify({...sample,panel:JSON.stringify(panel)})),null);
  }
  const hidden=h.parseBookmark(JSON.stringify({...sample,panel:JSON.stringify({practiceIndex:0,practiceReveal:false,practiceOpen:false})}));
  h.restoreBookmarkPanel(hidden);
  assert.deepEqual(practice,{index:0,reveal:false,open:false});
});
test('undo reverses a new highlight, an upgrade from bookmark to highlight, and a removal',()=>{
  const toasts=[],state={bookmarks:{}},place={...sample,kind:'place'};
  const h=runtime(state,{$:selector=>selector==='#source-dialog'?{open:false}:null,document:{addEventListener(){},querySelectorAll:()=>[]},window:{getSelection:()=>null},activeBook:{id:'one'},view:'bookmarks',crypto,save(){},sidebar(){},render(){},toast:(message,action)=>toasts.push({message,action})});
  h.saveBookmark(sample);
  assert.equal(h.bookmarkRecords().length,1);
  assert.equal(toasts.at(-1).action.label,'Undo');
  toasts.at(-1).action.run();
  assert.equal(h.bookmarkRecords().length,0);
  h.saveBookmark(place);const original=JSON.stringify(state.bookmarks);
  h.saveBookmark(sample);
  assert.equal(h.bookmarkRecords()[0].kind,'highlight');
  assert.equal(h.undoBookmarkChange(),true);
  assert.equal(JSON.stringify(state.bookmarks),original);
  const id=h.bookmarkRecords()[0].id;
  h.removeBookmarks([{bookId:'one',id}]);
  assert.equal(h.bookmarkRecords().length,0);
  h.undoBookmarkChange();
  assert.equal(JSON.stringify(state.bookmarks),original);
  assert.equal(h.undoBookmarkChange(),false);
});
