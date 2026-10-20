import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDocumentText,cleanTitle,groupPdfPages,isWeakAuthor,isWeakTitle,normalizeImportedText,pdfAuthorFromLines,pdfTitleFromLines,pickTitle,splitDocumentSections} from './document-import-core.mjs';
import {planBook} from './guide-core.mjs';

test('article normalization keeps all section text together and creates stable source identity',async()=>{
  const input={title:'An article',author:'A. Author',sourceFormat:'MD',sourceType:'article',sourceUrl:'https://example.org/read#results',text:'# Introduction\nThe question concerns staff communication.\n\n## Results\nThe source reports its result with uncertainty.'};
  const first=await normalizeImportedText(input),second=await normalizeImportedText(input);
  assert.equal(first.id,second.id);assert.equal(first.chapters.length,1);assert.match(first.chapters[0].text,/## Introduction\n+The question/);assert.match(first.chapters[0].text,/## Results\n+The source/);assert.equal(first.sourceUrl,'https://example.org/read');
  assert.notEqual((await normalizeImportedText({...input,text:input.text+'\nAdditional source detail.'})).id,first.id);
  assert.notEqual((await normalizeImportedText({...input,sourceType:'book'})).id,first.id);
});
test('book normalization preserves chapter boundaries and PDF page metadata',async()=>{
  const sections=[{title:'Beginning',text:'An opening paragraph with useful source detail.',sourcePageStart:2,sourcePageEnd:3},{title:'Next idea',text:'The next paragraph develops a different distinction.',sourcePageStart:4,sourcePageEnd:5}];
  const book=await normalizeImportedText({title:'PDF book',sourceFormat:'PDF',sourceType:'book',sections,importWarnings:['Some figures are unavailable.']});
  assert.equal(book.chapters.length,2);assert.deepEqual(book.chapters.map(c=>[c.sourcePageStart,c.sourcePageEnd]),[[2,3],[4,5]]);assert.deepEqual(book.importWarnings,['Some figures are unavailable.']);
});
test('PDF book page grouping preserves all text and page ranges without making a lesson for each page',async()=>{
  const pages=Array.from({length:300},(_,i)=>({title:`Page ${i+1}`,text:`Source page ${i+1}. `+'A source sentence with a qualification. '.repeat(40),sourcePageStart:i+1,sourcePageEnd:i+1}));
  const grouped=groupPdfPages(pages),book=await normalizeImportedText({title:'Long PDF book',sourceFormat:'PDF',sourceType:'book',sections:grouped});
  assert.ok(grouped.length<100);assert.equal(grouped.map(p=>p.text).join('\n\n'),pages.map(p=>p.text).join('\n\n'));
  assert.equal(grouped[0].sourcePageStart,1);assert.equal(grouped.at(-1).sourcePageEnd,300);assert.ok(grouped.every(p=>p.text.length<=12000));
  assert.ok(planBook(book).units.length<250);
  const giant={title:'Page 1',text:'Source text. '.repeat(2000),sourcePageStart:1,sourcePageEnd:1};
  assert.equal(groupPdfPages([giant])[0].text,giant.text);
});
test('plain-text cleanup keeps source wording and headings without interpreting markup',()=>{
  assert.equal(cleanDocumentText('One\r\n\r\nTwo\t words.\u0000'),'One\n\nTwo words.');
  assert.deepEqual(splitDocumentSections('# Start\n<script>source text</script>\n\n## Next\nSecond paragraph.'),[{title:'Start',text:'<script>source text</script>'},{title:'Next',text:'Second paragraph.'}]);
});
test('empty, oversized, unsafe, and unsupported imported sources fail clearly',async()=>{
  for(const input of [{text:''},{text:'image only'}, {text:'x'.repeat(12*1024*1024+1)}, {text:'A valid source paragraph of sufficient length.',sourceFormat:'EXE'}, {text:'A valid source paragraph of sufficient length.',sourceType:'unknown'}, {text:'A valid source paragraph of sufficient length.',sourceUrl:'file:///secret'}, {text:'A valid source paragraph of sufficient length.',sourceUrl:'https://user:secret@example.org'}])await assert.rejects(()=>normalizeImportedText(input));
});

test('typesetting codes and file names never become the title when the page has a real one',()=>{
  for(const weak of ['JSX-01-0001 1716..1722','Microsoft Word - draft3.docx','ms_2023_0412','untitled','paper.pdf',''])assert.equal(isWeakTitle(weak),true,weak);
  for(const real of ['Dune','COVID-19 Vaccines','The Quiet Garden','Effects of Creatine on Sprint Performance'])assert.equal(isWeakTitle(real),false,real);
  assert.equal(cleanTitle('THE EFFECTS OF SLEEP ON RECOVERY'),'The Effects of Sleep on Recovery');
  assert.equal(cleanTitle('Creatine and sprinting - PubMed'),'Creatine and sprinting');
  assert.equal(cleanTitle('Sleep and performance | Nature'),'Sleep and performance');
  const lines=[['Journal of Strength and Conditioning Research',8],['ORIGINAL RESEARCH',9],['EFFECTS OF HEAVY RESISTANCE TRAINING ON',16],['SPRINT PERFORMANCE IN ADOLESCENTS',16],['John A. Smith,1 Maria Lopez,2 and Wei Chen1',10],['1Department of Kinesiology, State University',8],['The abstract body text continues in a smaller font.',9],['More body text in the same smaller font.',9]].map(([text,height])=>({text,height}));
  const title=pdfTitleFromLines(lines);
  assert.equal(title,'Effects of Heavy Resistance Training on Sprint Performance in Adolescents');
  assert.equal(pdfAuthorFromLines(lines,title),'John A. Smith, Maria Lopez, Wei Chen');
  assert.equal(pickTitle('JSX-01-0001 1716..1722',title,'JSX-01-0001'),title);
  assert.equal(pickTitle('A good embedded title',title),'A good embedded title');
  assert.equal(pdfTitleFromLines([{text:'Same size body text one',height:9},{text:'Same size body text two',height:9}]),'');
  assert.equal(isWeakAuthor('jsmith'),true);assert.equal(isWeakAuthor('Windows User'),true);assert.equal(isWeakAuthor('Jane Example'),false);
});
