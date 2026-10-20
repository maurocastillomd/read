import test from 'node:test';
import assert from 'node:assert/strict';
import {statisticsNumbers} from './statistics-contract.mjs';
import {sampleChecks} from '../tests/check-fixture.mjs';
import {schema,validateGuide} from './guide-core.mjs';
import {lessonRequest,parseBatchResult} from './generation-core.mjs';

const source=[
 'Reported results: p<.001 for the between-group comparison after six weeks.',
 "Reported ES = -0.42, with 95% confidence interval -0.68 to -0.16. The authors did not specify the ES denominator.",
 'The adjusted odds ratio was 0.78 (95% CI 0.48–1.30). The model adjusted for baseline status.',
 'Intrasession ICC = 0.82; SEM = 1.2 kg; CV = 2.5%. These are separate measurement properties.',
 'The reported correlation was r = -0.30. The study did not establish causation.',
 'The mean score was 4.5 points (SD 0.8). No uncertainty interval was reported.',
 'The reported range was 2.0 to 6.0 points, with a mean of 4.5 points.',
];
const unit={id:'section-1:u1',chapterId:'section-1',chapterTitle:'Synthetic research fixture',part:1,totalParts:1,sourceType:'article',paragraphs:source.map((text,i)=>({id:`p${i+1}`,text}))};
const ref=i=>({paragraphId:`p${i+1}`,quote:source[i]});
const evidence=(text='Only the supplied fixture is described.')=>({status:'interpretation',text,sourceRefs:[]});
function metric(overrides={}){return {id:'p-main',kind:'p-value',label:'Group comparison at six weeks',measure:'p value',value:.001,operator:'<',unit:'',comparison:'Between groups',timepoint:'Six weeks',context:'The current supplied research result.',interval:null,sourceRefs:[ref(0)],interpretation:'This is a threshold for a probability under the tested null model, not the probability the null is true.',caution:'The effect magnitude requires a separate estimate.',coordinatorQuestion:'Which outcome and uncertainty should a reader examine before acting on this result?',...overrides};}
// An invented guide body; the fields below it are replaced for each statistics case.
const baseGuide={
 title:'Reading a reported comparison',
 gist:'The section reports one comparison between two groups and the uncertainty around it.',
 concepts:[],principles:[],
 analogy:{familiarSituation:'Fictional example: two queues at a shop are compared over one afternoon.',mapping:'Comparing the queues is like comparing the groups.',limit:'A shop queue has no measurement protocol.'},
 flow:{kind:'sequence',caption:'Arrows show reading order.',nodes:[{id:'n1',label:'Question',detail:'What was compared.'},{id:'n2',label:'Result',detail:'What was reported.'},{id:'n3',label:'Limit',detail:'What remains uncertain.'}],edges:[{from:'n1',to:'n2',label:''},{from:'n2',to:'n3',label:''}],limit:'A simplified map.'},
 application:{scenario:'',steps:['Compare the reported result with its stated limits.']},
 recall:[{question:'What did the section compare?',answer:'Two groups after six weeks.'}],
 cautions:[],
};
function guide(metrics=[metric()]){
 const g=structuredClone(baseGuide);g.concepts=[{title:'Read the result',explanation:'The source reports a statistical comparison.',sourceRefs:[ref(0)]}];g.principles=[{title:'Keep uncertainty',explanation:'A probability does not establish practical importance.',origin:'interpretation',sourceRefs:[]}];
 g.application.scenario='Fictional example: a team lead asks colleagues to examine the same comparison.';
 g.checks=sampleChecks(unit.paragraphs);
 g.learningPath={previous:'Read the question.',current:'Interpret the reported result.',next:'Examine its limits.',thread:'Fictional example: the team lead reviews evidence with colleagues.'};
 g.chapterVisual={kind:'decision',title:'Interpret the comparison',caption:'Companion illustration of the reported reasoning.',labels:['Question','Result','Limit']};
 g.mnemonic={cue:'Ask, estimate, qualify',meaning:'Connect the statistical estimate to its question and uncertainty.',items:[{letter:'Ask',meaning:'Name the research question.'}],caution:'The cue omits method details.'};
 g.articleAnalysis={kind:'empirical-study',scope:'Synthetic extracted section for validation tests.',researchQuestion:evidence(),studyDesign:evidence(),population:evidence(),comparator:evidence(),outcomes:evidence(),results:[evidence()],statistics:[evidence()],limitations:[evidence()],implications:[evidence()],criticalQuestions:['What was measured?','What remains uncertain?'],statisticsLab:metrics===null?null:{version:1,scope:'Reported metrics from the supplied section only.',metrics}};
 return g;
}
const result=g=>({custom_id:'unit-0',result:{type:'succeeded',message:{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(g)}]}}});
const validate=g=>validateGuide(g,unit,{requireArticleAnalysis:true,requireStatisticsLab:true});

test('strict new article schema requires a nullable lab while stored older appraisal remains valid',()=>{
 const appraisal=schema.properties.articleAnalysis.anyOf.find(x=>x.type==='object');assert.ok(appraisal.required.includes('statisticsLab'));
 assert.ok(appraisal.properties.statisticsLab.anyOf.some(x=>x.type==='null'));
 const old=guide();delete old.articleAnalysis.statisticsLab;
 assert.equal(validateGuide(old,unit),old);
 assert.equal(parseBatchResult(result(old),[unit]).guide.articleAnalysis.statisticsLab,null,'a new lesson always carries the lab field, empty when no number checks out');
 const empty=guide(null);assert.equal(validate(empty),empty);assert.ok(parseBatchResult(result(empty),[unit]).guide);
});
test('threshold p values retain their comparator and exact source value',()=>{
 assert.ok(validate(guide()));
 for(const overrides of [{operator:'='},{operator:'≤'},{value:0},{value:.01}])assert.throws(()=>validate(guide([metric(overrides)])),/value and comparator/);
 const bounded={...unit,paragraphs:[{id:'p1',text:'The reported result was p≤.05 for the overall comparison.'}]};
 const g=guide([metric({value:.05,operator:'≤',sourceRefs:[{paragraphId:'p1',quote:bounded.paragraphs[0].text}]})]);g.concepts[0].sourceRefs=g.articleAnalysis.statisticsLab.metrics[0].sourceRefs;g.checks=sampleChecks(bounded.paragraphs);
 assert.ok(validateGuide(g,bounded));
});
test('signed ES and confidence intervals are copied without guessing a Cohen d formula',()=>{
 const es=metric({id:'es',kind:'effect-size',measure:'Reported ES',value:-.42,operator:'=',sourceRefs:[ref(1)],interval:{low:-.68,high:-.16,level:95,type:'confidence'}});
 assert.ok(validate(guide([es])));
 assert.throws(()=>validate(guide([{...es,value:.42}])),/value and comparator/);
 assert.throws(()=>validate(guide([{...es,measure:"Cohen's d"}])),/measure name/);
 for(const interval of [{...es.interval,low:-.8},{...es.interval,level:90},{...es.interval,type:'credible'},{...es.interval,low:-.16,high:-.68}])assert.throws(()=>validate(guide([{...es,interval}])),/interval/);
});
test('reported ratio and its confidence interval retain units, scale, and adjustment context',()=>{
 const ratio=metric({id:'or',kind:'effect-size',measure:'odds ratio',value:.78,operator:'=',sourceRefs:[ref(2)],interval:{low:.48,high:1.30,level:95,type:'confidence'},context:'Adjusted for baseline status.'});
 assert.ok(validate(guide([ratio])));assert.equal(validate(guide([ratio])).articleAnalysis.statisticsLab.metrics[0].interval.high,1.30);
 assert.throws(()=>validate(guide([{...ratio,measure:'hazard ratio'}])),/measure name/);
});
test('ICC, SEM, and CV remain distinct measured properties rather than fabricated percentage accuracy',()=>{
 const values=[['icc','ICC',.82,''],['sem','SEM',1.2,'kg'],['cv','CV',2.5,'%']].map(([id,measure,value,unit])=>metric({id,kind:'reliability',measure,value,unit,operator:'=',sourceRefs:[ref(3)]}));
 const actual=validate(guide(values)).articleAnalysis.statisticsLab.metrics;
 assert.deepEqual(actual.map(x=>[x.measure,x.value,x.unit]),[['ICC',.82,''],['SEM',1.2,'kg'],['CV',2.5,'%']]);
 assert.throws(()=>validate(guide([{...values[0],value:1.2}])),/valid range/);
 assert.throws(()=>validate(guide([{...values[0],measure:'CV',sourceRefs:[ref(1)],value:-.42}])),/measure name|negative/);
});
test('correlation retains its sign and a mean with SD does not acquire a fabricated CI',()=>{
 assert.ok(validate(guide([metric({id:'r',kind:'association',measure:'r',value:-.30,operator:'=',sourceRefs:[ref(4)]})])));
 const mean=metric({id:'mean',kind:'estimate',measure:'Mean score',unit:'points',value:4.5,operator:'=',sourceRefs:[ref(5)]});
 assert.ok(validate(guide([mean])));
 assert.throws(()=>validate(guide([{...mean,interval:{low:.8,high:4.5,level:null,type:'confidence'}}])),/interval type/);
 assert.ok(validate(guide([{...mean,sourceRefs:[ref(6)],interval:{low:2,high:6,level:null,type:'range'}}])));
});
test('commentary and unclear text cannot publish a lab by quoting somebody else’s study',()=>{
 for(const kind of ['commentary','unclear']){
  const g=guide();g.articleAnalysis.kind=kind;assert.throws(()=>validate(g),/original research|review/);
  g.articleAnalysis.statisticsLab=null;assert.ok(validate(g));
 }
 const review=guide();review.articleAnalysis.kind='evidence-review';review.articleAnalysis.statisticsLab.metrics[0].context='Reported synthesis in the supplied review.';assert.ok(validate(review));
});
test('every metric must carry exact source references; a wrong paragraph id or loose quote snaps to the real sentence',()=>{
 const g=guide();g.articleAnalysis.statisticsLab.metrics[0].sourceRefs[0].paragraphId='wrong';
 assert.throws(()=>validate(g),/unknown source paragraph/);
 const snapped=parseBatchResult(result(g),[unit]).guide.articleAnalysis.statisticsLab.metrics[0];
 assert.deepEqual(snapped.sourceRefs,[ref(0)]);assert.equal(g.articleAnalysis.statisticsLab.metrics[0].sourceRefs[0].paragraphId,'wrong','the reply itself is not changed');
 g.articleAnalysis.statisticsLab.metrics[0].sourceRefs[0].quote='A fabricated p<.001 result.';
 const rebuilt=parseBatchResult(result(g),[unit]).guide.articleAnalysis.statisticsLab;
 assert.deepEqual(rebuilt.metrics[0].sourceRefs,[ref(0)],'only text that really contains the number is quoted');
 const invented=guide([metric({value:.0042,sourceRefs:[{paragraphId:'p1',quote:'p<.0042 in a study that does not exist'}]})]);
 assert.equal(parseBatchResult(result(invented),[unit]).guide.articleAnalysis.statisticsLab,null,'a number the text never prints is left out');
});
test('supplied enhancements reject unknown fields, nonfinite numbers, empty metrics, duplicate IDs, and missing fields',()=>{
 for(const patch of [{value:NaN},{value:Infinity},{value:'0.001'},{interval:{low:NaN,high:1,level:95,type:'confidence'}},{script:'x'}])assert.throws(()=>validate(guide([metric(patch)])),/finite number|allowed field/);
 assert.throws(()=>validate(guide([])),/must contain 1 to 12/);
 assert.throws(()=>validate(guide([metric(),metric()])),/IDs must be unique/);
 const incomplete=guide();delete incomplete.articleAnalysis.statisticsLab.metrics[0].caution;assert.throws(()=>validate(incomplete),/caution is required/);
});
test('number matching preserves compact comparisons, signed values, scientific notation, and decimal sentence endings',()=>{
 assert.deepEqual(statisticsNumbers('p<.001; p≤0.05; ES=−0.42.').map(x=>[x.value,x.operator]),[[.001,'<'],[.05,'≤'],[-.42,'=']]);
 assert.deepEqual(statisticsNumbers('Value 1.2e-3 and 1,200.5.').map(x=>x.value),[.0012,1200.5]);
 assert.deepEqual(statisticsNumbers('95% CI 0.48–1.30.').map(x=>x.value),[95,.48,1.3]);
});
test('generation prompt separates neutral source teaching and optional real-life examples and copies numbers exactly',()=>{
 const request=lessonRequest({title:'Synthetic article',sourceType:'article',chapters:[]},unit);
 for(const phrase of [/Only analogy, application and path\.thread/,/Everything else stays in the source's own domain/,/p<\.001 is value 0\.001 with operator "<"/,/Never calculate, guess or round/,/A p value and its effect size are separate entries/,/its quote must contain that number/,/interval is .* only when printed/,/not the chance the idea is true/,/A non-significant result is not proof of no effect/])assert.match(request.system[0].text,phrase);
});


test('reported zero ratios and negative Cronbach alpha retain legitimate scale boundaries',()=>{
 function validateWithQuote(value,quote){
  const sourceUnit={...unit,paragraphs:[{id:'p1',text:quote}]};
  const g=guide([metric({...value,sourceRefs:[{paragraphId:'p1',quote}]})]);g.concepts[0].sourceRefs=[{paragraphId:'p1',quote}];g.checks=sampleChecks(sourceUnit.paragraphs);return validateGuide(g,sourceUnit);
 }
 assert.ok(validateWithQuote({id:'or-zero',kind:'effect-size',measure:'odds ratio',value:0,operator:'=',interval:{low:0,high:1.4,level:95,type:'confidence'}},'The reported odds ratio was 0.00 (95% confidence interval 0.00 to 1.40).'));
 assert.throws(()=>validateWithQuote({id:'rr-negative',kind:'effect-size',measure:'risk ratio',value:-.2,operator:'='},'The claimed risk ratio was -0.20 in this deliberately invalid fixture.'),/ratio must not be negative/);
 assert.throws(()=>validateWithQuote({id:'rr-interval',kind:'effect-size',measure:'risk ratio',value:.5,operator:'=',interval:{low:-.2,high:1,level:95,type:'confidence'}},'The claimed risk ratio was 0.50 (95% CI -0.20 to 1.00).'),/ratio interval must not be negative/);
 assert.ok(validateWithQuote({id:'alpha-negative',kind:'reliability',measure:'Cronbach alpha',value:-1.4,operator:'=',interval:{low:-2,high:-.5,level:95,type:'confidence'}},'Cronbach alpha = -1.40 (95% confidence interval -2.00 to -0.50).'));
 assert.throws(()=>validateWithQuote({id:'alpha-invalid',kind:'reliability',measure:'Cronbach alpha',value:1.1,operator:'='},'Cronbach alpha = 1.10 in this deliberately invalid fixture.'),/must not exceed 1/);
 assert.throws(()=>validateWithQuote({id:'alpha-ci-invalid',kind:'reliability',measure:'Cronbach alpha',value:.8,operator:'=',interval:{low:.5,high:1.1,level:95,type:'confidence'}},'Cronbach alpha = 0.80 (95% CI 0.50 to 1.10).'),/must not exceed 1/);
});


test('article and book generation keep low effort, no thinking and the same cached instructions',()=>{
 const article=lessonRequest({title:'Synthetic article',sourceType:'article',chapters:[]},unit);
 const book=lessonRequest({title:'Synthetic book',sourceType:'book',chapters:[]},{...unit,sourceType:'book'});
 assert.equal(article.output_config.effort,'low');assert.equal(book.output_config.effort,'low');
 assert.deepEqual(article.thinking,{type:'disabled'});assert.equal(article.system[0].text,book.system[0].text);
 assert.match(article.system[0].text,/Copy 6 to 25 consecutive words exactly as printed/);
});


test('provider parsing keeps verified metrics, leaves out unverified ones and says so',()=>{
 const valid=metric(),invalid=metric({id:'unverified',value:.02,sourceRefs:[ref(0)]});
 const g=guide([valid,invalid]);
 assert.throws(()=>validate(g),/value and comparator/);
 const parsed=parseBatchResult(result(g),[unit]);assert.ok(parsed.guide);
 const lab=parsed.guide.articleAnalysis.statisticsLab;
 assert.deepEqual(lab.metrics,[{...valid,id:'m1'}]);assert.match(lab.scope,/1 statistic was left out/);
 assert.equal(g.articleAnalysis.statisticsLab.metrics.length,2,'Original provider output is never silently repaired');
 assert.equal(validate(parsed.guide),parsed.guide);
 const empty=parseBatchResult(result(guide([invalid])),[unit]).guide;
 assert.equal(empty.articleAnalysis.statisticsLab,null);
 const badCore=guide([valid,invalid]);badCore.concepts[0].sourceRefs[0].quote='An invented main concept source.';
 assert.deepEqual(parseBatchResult(result(badCore),[unit]).guide.concepts[0].sourceRefs,[ref(0)],'an invented concept quote is replaced by the closest real sentence');
});
test('unknown lab fields never reach storage and cautions stay as written',()=>{
 const g=guide([metric()]);g.articleAnalysis.statisticsLab.script='unexpected';g.articleAnalysis.statisticsLab.metrics[0].script='x';
 const built=parseBatchResult(result(g),[unit]).guide;
 assert.equal(built.articleAnalysis.statisticsLab.script,undefined);assert.equal(built.articleAnalysis.statisticsLab.metrics[0].script,undefined);
 const full=guide([metric({value:.02})]);full.cautions=Array(6).fill('Existing caution.');
 assert.deepEqual(parseBatchResult(result(full),[unit]).guide.cautions,full.cautions);
});
