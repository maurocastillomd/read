import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {normalizeParagraphs} from '../lib/guide-core.mjs';
import {sampleLibrary} from '../tests/fixtures/sample-library.mjs';

const source=await readFile(new URL('./source-reader.js',import.meta.url),'utf8');
const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
const generation=await readFile(new URL('./generation-ui.js',import.meta.url),'utf8');
const paragraphFunctions=(await import('node:fs')).readFileSync(new URL('./epub-structure.js',import.meta.url),'utf8')+app.slice(app.indexOf('  const cleanParagraphs ='),app.indexOf('  function topbar('));
const sourceButton=app.split('\n').find(line=>line.includes('function sourceButton('));
const refs=generation.split('\n').find(line=>line.includes('function refs('));
const sourceClick=app.match(/else if\(a==='source'\)(openSource\([^;]+\));/)[1];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function runtime(chapter){
  const {document}=parseHTML('<html><body><dialog id="source-dialog"><div class="dialog-bar"></div><div id="source-content"></div><div id="source-return"></div></dialog></body></html>');
  const dialog=document.querySelector('dialog');dialog.open=false;dialog.showModal=()=>{dialog.open=true;};
  const context=vm.createContext({document,activeBook:{title:'Source book',author:'Source author',sourceFormat:'EPUB',chapters:[chapter]},bookmarkSourceChapter:'',$:selector=>document.querySelector(selector),readIcon:()=>'',esc,originalPdfLink:()=>'',applyBookmarkHighlights:()=>{},hideBookmarkSelection:()=>{},requestAnimationFrame:()=>{},window:{getSelection:()=>null}});
  vm.runInContext(paragraphFunctions+sourceButton+refs+source+`\nthis.reader={entries:sourceParagraphEntries,citation:sourceCitation,paragraphs:readingParagraphs,refs,open:openSource,click:el=>${sourceClick},expand:()=>{sourceReading.expanded=true;paintSource();}};`,context);
  return {document,reader:context.reader};
}

const quote='Repeated idea, exact quote.';
const chapter={id:'c1',title:'Kitchen habits',text:['Kitchen habits','OceanofPDF.com','** **','First occurrence: '+quote,'Connecting paragraph.','The lead-in to the later occurrence.','Second occurrence: Repeated\t  idea, exact quote.','Third occurrence: '+quote,'The following context.'].join('\r\n\r\n')};

test('source links retain p7 and open the specified duplicate after title and noise filtering',()=>{
  const {document,reader}=runtime(chapter),link=document.createElement('div');
  link.innerHTML=reader.refs('c1',[{paragraphId:'p7',quote}]);
  const button=link.querySelector('button');
  assert.equal(button.dataset.paragraph,'p7');
  assert.equal(button.dataset.match,quote);
  reader.click(button);
  const cited=document.querySelectorAll('.is-cited');
  assert.equal(cited.length,1,'Other occurrences in the excerpt must not look like the cited paragraph');
  assert.equal(cited[0].dataset.sourceParagraph,'4','Bookmark indexing still uses the visible full-reader paragraph position');
  assert.match(cited[0].textContent,/Second occurrence/);
  assert.equal(cited[0].querySelector('.source-citation').textContent,'Repeated\t  idea, exact quote.','Whitespace normalization must not rewrite the displayed source');
  reader.expand();
  assert.equal(document.querySelectorAll('.is-cited').length,1);
  assert.match(document.querySelector('.is-cited').textContent,/Second occurrence/);
  assert.equal(reader.entries(chapter).map(p=>p.text).join('\n'),reader.paragraphs(chapter).join('\n'));
});

test('canonical source IDs follow normalization across blank lines, CR lines and horizontal whitespace',()=>{
  const input={id:'c2',title:'Garden notes',text:'\r\n Garden notes \r\n\nOceanofPDF.com\n** **\n\nFirst\t   source paragraph.\rSecond\u00a0\u00a0source paragraph.\n\nLast source paragraph.'};
  const {reader}=runtime(input),entries=reader.entries(input),canonical=normalizeParagraphs(input);
  assert.equal(entries.map(p=>p.text).join('\n'),reader.paragraphs(input).join('\n'));
  for(const paragraph of canonical.slice(3)){
    const result=reader.citation(entries,paragraph.text,paragraph.id);
    assert.ok(result,paragraph.id+' must map to its original reader characters');
    const original=entries[result.index].text.slice(result.start,result.end);
    assert.equal(original.replace(/[\t \f\v\u00a0]+/g,' ').trim(),paragraph.text);
  }
});

test('an unknown or mismatched paragraph ID never falls back to an earlier duplicate',()=>{
  const {reader,document}=runtime(chapter);
  for(const paragraphId of ['p99','p5','wrong-id']){
    reader.open('c1',quote,paragraphId);
    assert.equal(document.querySelector('.is-cited'),null);
    assert.equal(document.querySelector('.source-citation'),null);
  }
  reader.open('c1',quote,'p7.2');
  assert.match(document.querySelector('.is-cited').textContent,/Second occurrence/,'Split paragraph citations retain their original p7 identity');
  reader.open('c1',quote);
  assert.match(document.querySelector('.is-cited').textContent,/First occurrence/,'Older source links without IDs keep their quote lookup');
});

test('every prepared citation still resolves in its original numbered paragraph',()=>{
  // Lessons built by lib/lesson-maker.mjs for an invented library stand in for bundled books.
  const {reader}=runtime(chapter);let checked=0;
  for(const entry of sampleLibrary()){
    for(const record of entry.guides){
      const original=entry.book.chapters.find(c=>c.id===record.chapterId),entries=reader.entries(original);
      const walk=value=>{
        if(!value||typeof value!=='object')return;
        if(typeof value.paragraphId==='string'&&typeof value.quote==='string'){
          assert.ok(reader.citation(entries,value.quote,value.paragraphId),`${entry.book.title} / ${record.chapterId} / ${value.paragraphId}`);checked++;
        }
        for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);
      };
      walk(record.guide);
    }
  }
  assert.ok(checked>50,'Every sample lesson should be covered: '+checked);
});
