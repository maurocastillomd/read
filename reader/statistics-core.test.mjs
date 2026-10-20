import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {planBook} from '../lib/guide-core.mjs';
import {readFileSync} from 'node:fs';
const contract=readFileSync(new URL('../lib/statistics-contract.mjs',import.meta.url),'utf8').replaceAll('export ','');
const embedContract=source=>source.replace('/*STATISTICS_CONTRACT*/','const StatisticsContract=(()=>{'+contract+';return {validateStatisticsLab,statisticsNumbers};})();');
const ctx=vm.createContext({URL});
vm.runInContext(readFileSync(new URL('./epub-structure.js',import.meta.url),'utf8')+embedContract(readFileSync(new URL('./statistics-core.js',import.meta.url),'utf8'))+'\nthis.stats={profile:statsArticleProfile};',ctx);
const {stats}=ctx;
function genericFixture(overrides={}){
  const text='Sprint change: p < 0.001; Hedges g = −0.45, 95% CI −0.70 to −0.20. ICC = 0.91, 95% CI 0.80 to 0.97. SEM = 1.2 cm.';
  const book={id:'another-study',title:'A different research article',sourceType:'article',chapters:[{id:'results',text}],sourceUrl:'https://example.test/study'};
  const metric={id:'sprint-p',kind:'p-value',label:'Sprint change',measure:'p',value:.001,operator:'<',unit:'',comparison:'Training versus comparison group',timepoint:'After training',context:'The reported test of group change.',interval:null,sourceRefs:[{paragraphId:'p1',quote:text}],interpretation:'An upper bound, not an exact p value.',caution:'The result does not describe practical size.',coordinatorQuestion:'Does the protocol match the question you need answered?',...overrides};
  const rec={bookId:book.id,chapterId:'results',unitId:'results:u1',guide:{articleAnalysis:{kind:'empirical-study',statisticsLab:{version:1,scope:'Reported results from this section.',metrics:[metric]}}}};
  return {book,rec,metric};
}
test('generic article profiles use anchored actual values without a known DOI or study-specific template',()=>{
  const f=genericFixture(),profile=stats.profile(f.book,f.rec);
  assert.equal(profile.generic,true);assert.equal(profile.metrics[0].value,.001);assert.equal(profile.metrics[0].operator,'<');
  f.rec.guide.articleAnalysis.kind='evidence-review';assert.ok(stats.profile(f.book,f.rec),'Reviews with actual quantitative results are supported');
  const g=genericFixture({id:'effect',kind:'effect-size',measure:'Hedges g',value:-.45,operator:'=',interval:{low:-.70,high:-.20,level:95,type:'confidence'}});
  const effect=stats.profile(g.book,g.rec).metrics[0];assert.equal(effect.flavor,'standardized');assert.equal(effect.interval.high,-.20);
});
test('generic profile rejects unsupported numbers, reversed signs and p bounds, invented intervals, and missing evidence',()=>{
  for(const patch of [{value:.002},{value:-.001},{operator:'='},{operator:'>'},{sourceRefs:[]},{sourceRefs:[{paragraphId:'p2',quote:'Sprint change: p < 0.001'}]},{interval:{low:.0001,high:.003,level:95,type:'confidence'}},{value:NaN}]){
    const f=genericFixture(patch);assert.equal(stats.profile(f.book,f.rec),null,JSON.stringify(patch));
  }
  const f=genericFixture({kind:'effect-size',measure:'Hedges g',value:.45,operator:'='});assert.equal(stats.profile(f.book,f.rec),null,'A negative reported effect cannot become positive');
  const empty=genericFixture();empty.rec.guide.articleAnalysis.statisticsLab.metrics=[];assert.equal(stats.profile(empty.book,empty.rec),null);
});
test('generic profiles enforce current-unit evidence and keep reliability error units distinct from ICC',()=>{
  const f=genericFixture({id:'sem',kind:'reliability',measure:'SEM',value:1.2,operator:'=',unit:'cm'});
  assert.equal(stats.profile(f.book,f.rec).metrics[0].flavor,'error');
  f.rec.unitId='results:u2';assert.equal(stats.profile(f.book,f.rec),null);
  const icc=genericFixture({id:'icc',kind:'reliability',measure:'ICC',value:.91,operator:'=',interval:{low:.8,high:.97,level:95,type:'confidence'}});
  assert.equal(stats.profile(icc.book,icc.rec).metrics[0].flavor,'icc');
  icc.rec.guide.articleAnalysis.statisticsLab.metrics[0].interval.level=90;assert.equal(stats.profile(icc.book,icc.rec),null,'An unreported confidence level cannot be added');
});
test('a malformed or missing structured lab never falls back to hand-built statistics',()=>{
  const f=genericFixture();f.rec.guide.articleAnalysis.statisticsLab.metrics[0].value=.8;
  assert.equal(stats.profile(f.book,f.rec),null);
  const empty=genericFixture();empty.rec.guide.articleAnalysis.statisticsLab={version:1,scope:'Empty section',metrics:[]};
  assert.equal(stats.profile(empty.book,empty.rec),null,'An explicit empty lab shows nothing');
  empty.rec.guide.articleAnalysis.statisticsLab=null;assert.equal(stats.profile(empty.book,empty.rec),null,'Explicit null means no statistics lab');
  delete empty.rec.guide.articleAnalysis.statisticsLab;assert.equal(stats.profile(empty.book,empty.rec),null,'An appraisal without a lab has no hand-built fallback');
  const other=genericFixture();assert.equal(stats.profile({...other.book,sourceType:'book'},other.rec),null,'Books never show an article lab');
  assert.equal(stats.profile(other.book,{...other.rec,bookId:'another'}),null,'A lab never attaches to a different source');
  assert.equal(stats.profile(other.book,{...other.rec,guide:{articleAnalysis:{...other.rec.guide.articleAnalysis,kind:'commentary'}}}),null,'Commentary carries no numeric lab');
});

test('client evidence guard uses the same long-paragraph split and current-unit boundaries as the generation planner',()=>{
  const f=genericFixture(),quote='The reported p value was p < 0.001 for the comparison.';
  f.book.chapters[0]={id:'results',title:'Results',text:'A long source paragraph. '.repeat(1800)+quote+'\n\nAnother source paragraph.'};
  const units=planBook(f.book).units,unit=units.find(u=>u.paragraphs.some(p=>p.text.includes(quote))),paragraph=unit.paragraphs.find(p=>p.text.includes(quote));
  assert.ok(paragraph.id.includes('.'),'The source paragraph is split by the planner');
  f.rec.unitId=unit.id;f.metric.sourceRefs=[{paragraphId:paragraph.id,quote}];
  assert.ok(stats.profile(f.book,f.rec),'The exact split ID and current unit are accepted');
  f.rec.unitId=units.find(u=>u.id!==unit.id).id;assert.equal(stats.profile(f.book,f.rec),null,'A quote from another unit is not borrowed');
});

test('variance labels, agreement bounds, and internal-consistency reliability retain distinct meanings',()=>{
  const cases=[
    ['reliability',"McDonald's omega",.83,"McDonald's omega = 0.83.",'consistency'],
    ['reliability','Limits of agreement',-2.3,'Lower limits of agreement = −2.3 cm.','estimate'],
    ['effect-size','eta squared',.12,'The eta squared = 0.12.','variance'],
    ['estimate','R²',.36,'The model R² = 0.36.','variance']
  ];
  for(const [kind,measure,value,quote,flavor] of cases){const f=genericFixture({kind,measure,value,operator:'=',sourceRefs:[{paragraphId:'p1',quote}]});f.book.chapters[0].text=quote;assert.equal(stats.profile(f.book,f.rec)?.metrics[0].flavor,flavor,measure);}
});

test('SEM distinguishes mean precision from reliability measurement error',()=>{
  for(const [kind,measure,flavor] of [
    ['estimate','SEM (standard error of the mean)','precision'],
    ['reliability','Standard error of mean','precision'],
    ['estimate','SEM','estimate'],
    ['reliability','SEM','error'],
    ['estimate','Standard error of measurement','error']
  ]){
    const quote=measure+' = 1.2 cm.',f=genericFixture({kind,measure,value:1.2,operator:'=',unit:'cm',sourceRefs:[{paragraphId:'p1',quote}]});
    f.book.chapters[0].text=quote;assert.equal(stats.profile(f.book,f.rec)?.metrics[0].flavor,flavor,kind+' / '+measure);
  }
});
