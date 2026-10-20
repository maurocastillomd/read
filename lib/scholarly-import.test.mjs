import test from 'node:test';
import assert from 'node:assert/strict';
import {jatsToReading,scholarlyId} from './scholarly-import.mjs';
import {importReadingLink} from './document-import-url.mjs';
import {markResearchHeadings,normalizeImportedText} from './document-import-core.mjs';

const para=n=>`Participants completed the protocol and the authors report outcome ${n} with its denominator, units and time point so the comparison stays readable.`;
const jats=`<?xml version="1.0"?><article><front><article-meta><title-group><article-title>Sleep extension and sprint speed in collegiate athletes</article-title></title-group>
<abstract><sec><title>Purpose</title><p>To test whether extra sleep changes sprint time.</p></sec><sec><title>Results</title><p>Sprint time fell by 0.1 s (p = 0.03).</p></sec></abstract></article-meta></front>
<body><sec><title>Introduction</title><p>${para(1)}</p></sec><sec><title>Methods</title><sec><title>Participants</title><p>${para(2)}<fig><label>Figure 1</label><caption><p>Study flow.</p></caption></fig></p></sec>
<table-wrap><label>Table 1</label><caption><p>Baseline characteristics.</p></caption><table><tr><th>Group</th><th>n</th></tr><tr><td>Sleep</td><td>12</td></tr></table></table-wrap></sec>
<sec><title>Results</title><p>${para(3)}</p><list><list-item><p>First finding.</p></list-item></list></sec><sec><title>Discussion</title><p>${para(4)}</p></sec></body><back><ref-list><ref>Should not appear.</ref></ref-list></back></article>`;

function epmc({record,xml=jats,pages={}}){
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push(url);const u=new URL(url);
    if(u.hostname==='www.ebi.ac.uk'&&u.pathname.endsWith('/search'))return Response.json({resultList:{result:record?[record]:[]}});
    if(u.hostname==='www.ebi.ac.uk'&&u.pathname.endsWith('/fullTextXML'))return xml?new Response(xml,{headers:{'content-type':'application/xml'}}):new Response('',{status:404});
    if(u.hostname==='cloudflare-dns.com')return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
    const page=pages[u.href];if(page)return typeof page==='function'?page(url,options):page.clone();
    return new Response('Forbidden',{status:403});
  };
  return {fetchImpl,calls};
}

test('research identifiers are found in pasted DOIs, DOI links, publisher paths and PubMed links',()=>{
  assert.deepEqual(scholarlyId('10.1371/journal.pone.0228659'),{doi:'10.1371/journal.pone.0228659',bare:true});
  assert.deepEqual(scholarlyId('doi: 10.1080/02640414.2020.1234567.'),{doi:'10.1080/02640414.2020.1234567',bare:true});
  assert.deepEqual(scholarlyId('https://doi.org/10.1007/s40279-019-01234-5'),{doi:'10.1007/s40279-019-01234-5',bare:true});
  assert.deepEqual(scholarlyId('https://www.tandfonline.com/doi/full/10.1080/02640414.2020.1234567'),{doi:'10.1080/02640414.2020.1234567'});
  assert.deepEqual(scholarlyId('https://onlinelibrary.wiley.com/doi/abs/10.1111/sms.13000'),{doi:'10.1111/sms.13000'});
  assert.deepEqual(scholarlyId('https://pubmed.ncbi.nlm.nih.gov/31234567/'),{pmid:'31234567'});
  assert.deepEqual(scholarlyId('https://pmc.ncbi.nlm.nih.gov/articles/PMC7012345/'),{pmcid:'PMC7012345'});
  assert.deepEqual(scholarlyId('pmc7012345'),{pmcid:'PMC7012345'});
  assert.equal(scholarlyId('https://www.nytimes.com/2026/10/01/well/sleep.html'),null);
});

test('open-access full text keeps its sections, captions and tables, and leaves the references at the source',()=>{
  const reading=jatsToReading(jats,{authorString:'Lee A, Kim B, Diaz C, Moss D.'});
  assert.equal(reading.title,'Sleep extension and sprint speed in collegiate athletes');
  assert.equal(reading.author,'Lee A, Kim B, Diaz C et al.');
  assert.match(reading.text,/^## Abstract\n\nPurpose: To test whether extra sleep changes sprint time\.\n\nResults: Sprint time fell/);
  for(const part of ['## Introduction','## Methods','## Participants','~ Figure 1. Study flow.','~ Table 1. Baseline characteristics.','Group | n','Sleep | 12','## Results','• First finding.','## Discussion'])assert.ok(reading.text.includes(part),part);
  assert.ok(reading.text.indexOf(para(2))<reading.text.indexOf('~ Figure 1'),'a figure inside a paragraph follows its words');
  assert.doesNotMatch(reading.text,/Should not appear/);
});

test('a DOI resolves to Europe PMC full text and becomes one article with headings',async()=>{
  const mocked=epmc({record:{doi:'10.1234/x',pmcid:'PMC1',isOpenAccess:'Y',authorString:'Lee A.',journalInfo:{journal:{title:'J Sports Sci'}},pubYear:'2024'}});
  const {book}=await importReadingLink('10.1234/x',mocked);
  assert.equal(book.sourceType,'article');assert.equal(book.chapters.length,1);assert.equal(book.sourceUrl,'https://doi.org/10.1234/x');
  assert.match(book.chapters[0].text,/## Methods/);assert.match(book.importWarnings[0],/Europe PMC \(J Sports Sci · 2024\)/);
  assert.ok(!mocked.calls.some(url=>new URL(url).hostname==='cloudflare-dns.com'),'no page fetch was needed');
});

test('a closed paper with no readable page falls back to its abstract and says to upload the PDF',async()=>{
  const mocked=epmc({record:{doi:'10.1234/closed',isOpenAccess:'N',title:'A closed trial.',abstractText:'<p>'+'We randomized 40 athletes and measured jump height after four weeks of training. '.repeat(3)+'</p>'}});
  const result=await importReadingLink('https://doi.org/10.1234/closed',mocked);
  assert.equal(result.abstractOnly,true);assert.match(result.book.chapters[0].text,/^## Abstract\n\nWe randomized 40 athletes/);
  assert.match(result.book.importWarnings[0],/Only the abstract.*upload it here/);
});

test('an unknown closed DOI explains that the PDF needs an upload',async()=>{
  await assert.rejects(()=>importReadingLink('10.1234/nothing',epmc({record:null})),/not openly available.*Upload file/);
});

test('PDF links come back as bytes for the device to read, and are checked',async()=>{
  const pdf=new Response('%PDF-1.7 synthetic',{headers:{'content-type':'application/pdf'}});
  const mocked=epmc({pages:{'https://journal.org/paper.pdf':pdf}});
  const result=await importReadingLink('https://journal.org/paper.pdf',mocked);
  assert.equal(new TextDecoder().decode(result.pdf),'%PDF-1.7 synthetic');assert.equal(result.sourceUrl,'https://journal.org/paper.pdf');
  const fake=epmc({pages:{'https://journal.org/fake.pdf':new Response('<html>login</html>',{headers:{'content-type':'application/pdf'}})}});
  await assert.rejects(()=>importReadingLink('https://journal.org/fake.pdf',fake),/readable PDF/);
});

test('a research PDF or text file shows its section headings and drops page labels',async()=>{
  assert.equal(markResearchHeadings('Methods\nWe measured.\n2. Results:\nINTRODUCTION\nMethods were standard and are described below in full.'),'## Methods\nWe measured.\n## 2. Results\n## INTRODUCTION\nMethods were standard and are described below in full.');
  const book=await normalizeImportedText({title:'Paper',sourceFormat:'PDF',sourceType:'article',sections:[{title:'Page 1',text:'Abstract\nWe studied sleep in athletes for a full season.'},{title:'Page 2',text:'Results\nSleep rose by 40 minutes on average.'}]});
  assert.equal(book.chapters[0].text,'## Abstract\nWe studied sleep in athletes for a full season.\n\n## Results\nSleep rose by 40 minutes on average.');
});

test('a paywalled DOI with a free copy elsewhere (author manuscript, repository) is read from that copy',async()=>{
  const page=`<!doctype html><html><head><title>Sleep extension trial (accepted manuscript)</title></head><body><article><h1>Sleep extension trial</h1><h2>Methods</h2>${Array.from({length:25},(_,n)=>`<p>${para(n)}</p>`).join('')}</article></body></html>`;
  const mocked=epmc({record:{doi:'10.1234/paywalled',isOpenAccess:'N',title:'Sleep extension trial',abstractText:'<p>Short.</p>'},pages:{
    'https://api.openalex.org/works/doi:10.1234%2Fpaywalled?select=best_oa_location,locations':Response.json({best_oa_location:{is_oa:true,landing_page_url:'https://repository.example.edu/sleep-trial',pdf_url:null},locations:[{is_oa:false,landing_page_url:'https://publisher.example.com/paywall'}]}),
    'https://repository.example.edu/sleep-trial':new Response(page,{headers:{'content-type':'text/html'}}),
  }});
  const result=await importReadingLink('10.1234/paywalled',mocked);
  assert.ok(!result.abstractOnly);
  assert.match(result.book.chapters[0].text,/## Methods/);
  assert.ok(mocked.calls.includes('https://repository.example.edu/sleep-trial'));
  assert.ok(!mocked.calls.includes('https://publisher.example.com/paywall'),'closed locations are skipped');
});
