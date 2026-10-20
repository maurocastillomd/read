import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const source=await readFile(new URL('./generation-ui.js',import.meta.url),'utf8');
function runtime(book,records=[]){
  const context=vm.createContext({activeBook:book,lessonCode:()=>({code:''}),esc:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),state:{},guideReviewed:()=>false,lessonProgressModel:()=>({count:0}),chapterPreview:record=>record.guide.title,bookGuides:()=>records,currentGenerationJob:()=>null});
  const block=source.slice(source.indexOf('  function hasBookStructure('),source.indexOf('  function guides()'));
  vm.runInContext(block+'\nthis.structure={groups:bookStructureGroups,options:readerChapterOptions,list:chapterList};',context);
  return context.structure;
}
const chapter=(id,title,metadata={})=>({id,title,text:'Original source text.',...metadata});
test('chapter and lesson hierarchy follows source order and keeps reference sections consultable',()=>{
  const book={id:'book',chapters:[chapter('foreword','Foreword',{studyRole:'orientation'}),chapter('c1','Chapter 1',{studyRole:'chapter',partTitle:'Prospection',partNumber:1}),chapter('c2','Chapter 2',{studyRole:'chapter',partTitle:'Subjectivity',partNumber:2}),chapter('c3','Chapter 3',{studyRole:'chapter',partTitle:'Subjectivity',partNumber:2}),chapter('afterword','Afterword',{studyRole:'orientation'}),chapter('notes','Notes',{studyRole:'reference'})]};
  const records=[{bookId:'book',chapterId:'c1',unitId:'c1:u1',guide:{title:'First idea'}},{bookId:'book',chapterId:'c1',unitId:'c1:u2',guide:{title:'Next idea'}}];
  const api=runtime(book,records),{document}=parseHTML('<html><body>'+api.list()+'</body></html>');
  assert.deepEqual([...document.querySelectorAll('.book-structure-part>h3')].map(el=>el.textContent),['Orientation & closing','Part 1 · Prospection','Part 2 · Subjectivity','Orientation & closing']);
  assert.deepEqual([...document.querySelectorAll('.book-structure-chapter h4')].map(el=>el.textContent),book.chapters.map(c=>c.title));
  assert.deepEqual([...document.querySelectorAll('[data-action="explore"]')].map(el=>el.dataset.unit),['c1:u1','c1:u2']);
  assert.equal(document.querySelectorAll('.book-structure-reference').length,1);
  assert.equal(document.querySelector('.book-structure-reference [data-chapter="notes"]').textContent,'Read original ↗');
  assert.match(document.querySelector('.book-structure-intro').textContent,/2 parts · 3 chapters · 2 lessons/);
  const options=parseHTML('<select>'+api.options(book,'c2')+'</select>').document;
  assert.equal(options.querySelector('[selected]').getAttribute('value'),'c2');
  assert.equal(options.querySelector('option[value="c2"]').parentElement.getAttribute('label'),'Part 2 · Subjectivity');
  assert.deepEqual([...options.querySelectorAll('option')].map(el=>el.getAttribute('value')),book.chapters.map(c=>c.id));
});
test('legacy source selectors retain numbering and chapter titles are safely escaped',()=>{
  const book={id:'legacy',chapters:[chapter('c1','A <source> & title'),chapter('c2','Later')]};
  const api=runtime(book),{document}=parseHTML('<select>'+api.options(book,'c1')+'</select>');
  assert.equal(document.querySelectorAll('optgroup').length,0);
  assert.equal(document.querySelector('option').textContent,'1. A <source> & title');
  assert.equal(document.querySelectorAll('source').length,0);
  assert.equal(document.querySelector('[selected]').getAttribute('value'),'c1');
});
