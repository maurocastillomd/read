import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {DOMParser} from 'linkedom';
import * as core from '../lib/document-import-core.mjs';
const source=await readFile(new URL('./document-import.js',import.meta.url),'utf8');
const zipSource=await readFile(new URL('../public/vendor/jszip.min.js',import.meta.url),'utf8');
const zipModule={exports:{}};Function('module','exports',zipSource)(zipModule,zipModule.exports);const JSZip=zipModule.exports;
function runtime(pdf){
  const context=vm.createContext({DOMParser,JSZip,TextEncoder,TextDecoder,Uint8Array,Promise});
  vm.runInContext(source+'\nthis.reader={read:readImportedDocument,xml:documentXml,pdfText:items=>documentPdfText(items,documentImportTestCore),setup:(core,pdf)=>{this.documentImportTestCore=core;documentImportCorePromise=Promise.resolve(core);documentPdfPromise=Promise.resolve(pdf);}};',context);
  context.reader.setup(core,pdf);return context.reader;
}
const file=(name,bytes)=>({name,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
const textFile=(name,text)=>file(name,new TextEncoder().encode(text));

test('TXT and Markdown imports preserve source content and chosen reading type',async()=>{
  const reader=runtime(),article=await reader.read(textFile('Staff_notes.md','# Why\nA source paragraph that explains the question.\n## How\nAnother paragraph with a concrete qualification.'));
  assert.equal(article.title,'Staff notes');assert.equal(article.sourceType,'article');assert.equal(article.sourceFormat,'MD');assert.equal(article.chapters.length,1);assert.match(article.chapters[0].text,/concrete qualification/);
  const book=await reader.read(textFile('Staff.txt','Chapter 1\nFirst substantive source paragraph.\nChapter 2\nSecond substantive source paragraph.'),{sourceType:'book'});assert.equal(book.chapters.length,2);
});
test('DOCX imports headings, accepted text, and notes while preserving XML text safely',async()=>{
  const zip=new JSZip();zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods</w:t></w:r></w:p><w:p><w:r><w:t>The source reports staff communication.</w:t></w:r><w:del><w:r><w:t>Removed claim.</w:t></w:r></w:del><w:ins><w:r><w:t> A retained qualification.</w:t></w:r></w:ins></w:p></w:body></w:document>');
  zip.file('docProps/core.xml','<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Document title</dc:title><dc:creator>Source author</dc:creator></cp:coreProperties>');
  zip.file('word/footnotes.xml','<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t>A limitation reported in a note.</w:t></w:r></w:p></w:footnote></w:footnotes>');
  const book=await runtime().read(file('source.docx',await zip.generateAsync({type:'uint8array'})));
  assert.equal(book.title,'Document title');assert.equal(book.author,'Source author');assert.match(book.chapters[0].text,/Methods/);assert.match(book.chapters[0].text,/retained qualification/);assert.match(book.chapters[0].text,/limitation reported in a note/);assert.doesNotMatch(book.chapters[0].text,/Removed claim/);assert.equal(book.sourceFormat,'DOCX');
});
test('PDF import reads pages sequentially, reports missing text, and destroys the parser',async()=>{
  const calls=[],options=[];let destroyed=0;
  const pdf={getDocument(input){options.push(input);return {promise:Promise.resolve({numPages:2,getMetadata:async()=>({info:{Title:'Source paper',Author:'Ada Author'}}),getPage:async n=>{calls.push(n);return {getTextContent:async()=>({items:n===1?[{str:'The reported method and result are described here.',hasEOL:true,transform:[1,0,0,1,0,100]}]:[]}),cleanup(){}};}}),destroy:async()=>{destroyed++;}};}};
  const book=await runtime(pdf).read(textFile('source.pdf','%PDF mock source'),{onProgress:()=>{}});
  assert.deepEqual(calls,[1,2]);assert.equal(destroyed,1);assert.equal(options[0].useWorkerFetch,false);assert.equal(options[0].isEvalSupported,false);assert.equal(book.sourceFormat,'PDF');assert.equal(book.chapters[0].sourcePageStart,1);assert.match(book.importWarnings.join(' '),/1 of 2 pages/);assert.match(book.chapters[0].text,/reported method/);
});
test('DOCX statistic rows retain cells and mark merged layouts without duplicating values',async()=>{
  const zip=new JSZip(),cell=value=>`<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`;
  zip.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Reported study table with actual named outcomes.</w:t></w:r></w:p><w:tbl><w:tr>${cell('Outcome')}${cell('Difference')}${cell('p')}</w:tr><w:tr>${cell('Sprint')}${cell('-0.12 s')}${cell('0.031')}</w:tr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>Adjusted analysis</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>The authors retain a measurement limitation.</w:t></w:r></w:p></w:body></w:document>`);
  const book=await runtime().read(file('table.docx',await zip.generateAsync({type:'uint8array'}))),text=book.chapters[0].text;
  assert.match(text,/Outcome \| Difference \| p\nSprint \| -0.12 s \| 0.031/);
  assert.match(text,/Adjusted analysis \[merged cell; check original layout\]/);
  assert.equal(text.match(/0\.031/g).length,1);
  assert.match(text,/measurement limitation/);
});
test('PDF lines join within paragraphs and preserve headings, gaps, lists, columns and exact word fragments',()=>{
  const item=(str,x,y,height=12,extra={})=>({str,transform:[height,0,0,height,x,y],height,width:str.length*6,hasEOL:true,...extra});
  const reader=runtime();
  assert.equal(reader.pdfText([item('A source paragraph wraps onto',50,700),item('another line with its qualifier.',50,686),item('A separate paragraph follows.',50,658)]),'A source paragraph wraps onto another line with its qualifier.\n\nA separate paragraph follows.');
  assert.equal(reader.pdfText([item('Methods',50,720,18),item('The method is explained here.',50,700),item('1. A source item.',50,686),item('2. Another source item.',50,672)]),'Methods\n\nThe method is explained here.\n\n1. A source item.\n\n2. Another source item.');
  assert.equal(reader.pdfText([item('Left column ends.',50,300),item('Right column begins.',300,700),item('It continues here.',300,686)]),'Left column ends.\n\nRight column begins. It continues here.');
  assert.equal(reader.pdfText([item('The left column sentence runs',50,300),item('on in the right column.',300,700)]),'The left column sentence runs on in the right column.');
  assert.equal(reader.pdfText([item('A',50,700,12,{hasEOL:false,width:6}),item('value',110,700),item('Next row',50,686)]),'A | value\n\nNext row');
  assert.equal(reader.pdfText([item('inter',50,700,12,{hasEOL:false,width:30}),item('pretation',80,700)]),'interpretation');
  assert.equal(reader.pdfText([item('A hyphen-',50,700),item('ated source word.',50,686)]),'A hyphen-ated source word.');
});
test('journal PDFs keep paragraphs and headings, drop running heads and page codes, and carry sentences over pages',async()=>{
  const it=(str,x,y,font='Body',height=10,width=str.length*5)=>({str,transform:[height,0,0,height,x,y],height,width,hasEOL:true,fontName:font});
  const line=(t,x=54,y)=>it(t,x,y,'Body',10,500-x);
  const page1=[it('Journal of Strength and Conditioning Research 1716',54,760,'Sans',7),
    it('Sleep and Sprint Speed in',54,700,'Title',17),it('Soccer Players',54,680,'Title',17),it('ANA LEE, BEN KIM, AND CY DIAZ',54,660,'Sans',10),
    it('INTRODUCTION',54,620,'Bold'),line('The first paragraph starts with an indent',64,606),line('and wraps across a full line of the column',54,594),it('and ends here.',54,582),
    line('A second paragraph begins and its last line runs',64,570),it('onto the next page without a full stop and a hyph-',54,558,'Body',10,236),
    it('VOLUME 22 | NUMBER 5 | SEPTEMBER 2008',54,30,'Sans',7),it('JSX-01-0001 1716..1722',54,18,'Sans',6)];
  const page2=[it('Journal of Strength and Conditioning Research 1717',54,760,'Sans',7),line('enated word, so the sentence continues here.',54,700),it('Experimental Approach',54,680,'Bold'),line('Players were tested twice in the same week.',54,668),it('RESULTS',54,640,'Bold'),line('Sprint time fell after extra sleep in season.',54,626),
    it('VOLUME 22 | NUMBER 5 | SEPTEMBER 2008',54,30,'Sans',7),it('JSX-01-0001 1716..1722',54,18,'Sans',6),it('2',300,40,'Sans',7)];
  const pdf={getDocument(){return {promise:Promise.resolve({numPages:2,getMetadata:async()=>({info:{Title:'JSX-01-0001 1716..1722'}}),getPage:async n=>({view:[0,0,612,792],getTextContent:async()=>({items:n===1?page1:page2}),cleanup(){}})}),destroy:async()=>{}};}};
  const book=await runtime(pdf).read(textFile('paper.pdf','%PDF mock'));
  assert.equal(book.title,'Sleep and Sprint Speed in Soccer Players');
  const text=book.chapters[0].text;
  assert.doesNotMatch(text,/Journal of Strength|VOLUME 22|JSX-01|1716|Sleep and Sprint Speed|ANA LEE|\n2$/);
  assert.match(text,/^## INTRODUCTION\n+The first paragraph starts with an indent/);
  assert.match(text,/and ends here\.\n\nA second paragraph begins/);
  assert.match(text,/a hyph-enated word, so the sentence continues here\./);
  assert.match(text,/## Experimental Approach\n+Players were tested/);
  assert.match(text,/## RESULTS\n+Sprint time fell/);
});
test('encrypted, image-only, oversized, invalid UTF-8 and unsupported files fail without partial books',async()=>{
  let destroyed=0;const encrypted={getDocument(){return {promise:Promise.reject(Object.assign(new Error('Password'),{name:'PasswordException'})),destroy:async()=>{destroyed++;}};}};
  await assert.rejects(()=>runtime(encrypted).read(textFile('locked.pdf','%PDF mock')),/password protected/);assert.equal(destroyed,1);
  const imageOnly={getDocument(){return {promise:Promise.resolve({numPages:1,getMetadata:async()=>({}),getPage:async()=>({getTextContent:async()=>({items:[]}),cleanup(){}})}),destroy:async()=>{destroyed++;}};}};
  await assert.rejects(()=>runtime(imageOnly).read(textFile('scan.pdf','%PDF mock')),/no readable text/);assert.equal(destroyed,2);
  await assert.rejects(()=>runtime().read({name:'large.pdf',size:61*1024*1024}),/60 MB/);
  await assert.rejects(()=>runtime().read(file('bad.txt',new Uint8Array([0xff,0xfe,0xff]))),/UTF-8/);
  await assert.rejects(()=>runtime().read(textFile('old.doc','Old document')),/Choose a PDF/);
  assert.throws(()=>runtime().xml('<!DOCTYPE x [<!ENTITY x "expanded">]><x>&x;</x>'),/XML entities/);
});
