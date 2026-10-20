import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const role=await readFile(new URL('./role-context.js',import.meta.url),'utf8');
const studio=await readFile(new URL('./studio-icons.js',import.meta.url),'utf8');
const source=await readFile(new URL('./chapter-practice.js',import.meta.url),'utf8');
// The open version bundles no books: these lessons are invented fixtures.
function syntheticEntry(id,count){
  const book={id,title:'Invented book '+id,author:'Example Author',chapters:Array.from({length:count},(_,i)=>({id:'chapter-'+(i+1),title:'Chapter '+(i+1)}))};
  const guides=book.chapters.map((chapter,i)=>({bookId:id,unitId:chapter.id+':u1',chapterId:chapter.id,guide:{
    title:'Lesson '+(i+1),gist:'The chapter argues one idea.',concepts:[{title:'Idea '+(i+1),explanation:'The author develops the idea.',sourceRefs:[{paragraphId:'p1',quote:'Source text'}]}],
    application:{scenario:'Fictional example: a teacher tries idea '+(i+1)+' in a weekly plan.',steps:['Name what changes.','Check the passage before deciding.'].concat(i%2?['Review it after a week.']:[])},
    recall:Array.from({length:2+i%3},(_,n)=>({question:'Question '+(n+1)+' about chapter '+(i+1)+'?',answer:'Answer '+(n+1)+' from chapter '+(i+1)+'.'})),
    cautions:[],
  }}));
  return {book,guides};
}
const seed=syntheticEntry('synthetic-a',6),additional=[syntheticEntry('synthetic-b',3)];
const entries=[seed,...additional],all=entries.flatMap(entry=>entry.guides);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=value=>JSON.parse(JSON.stringify(value));

function runtime({notes={},reducedMotion=false}={}){
  const listeners={},focused=[],sourceCalls=[],state={checks:{}},card={innerHTML:''};
  let saves=0,scroll;
  const panel={open:false,scrollIntoView(options){scroll=options;},querySelector(){return {focus(options){focused.push({target:'summary',options});}};}};
  const heading={focus(options){focused.push({target:'heading',options});}};
  const studyMap={innerHTML:'',querySelector(selector){return {focus(options){focused.push({target:selector,options});}};}};
  const context=vm.createContext({
    articleStatisticsLab:()=>'',activeBook:seed.book,selectedUnit:seed.guides[0].unitId,state,esc:escape,
    note:key=>notes[key]??'',save(){saves++;},
    refs(chapterId,sourceRefs){sourceCalls.push({chapterId,sourceRefs:plain(sourceRefs)});return sourceRefs.length?'<button type="button" data-action="source">Check source passage</button>':'';},
    document:{addEventListener(type,listener){listeners[type]=listener;}},
    matchMedia:()=>({matches:reducedMotion}),
    $(selector){if(selector==='#article-study-map')return studyMap;if(selector==='#chapter-practice')return panel;if(selector==='#practice-card')return card;if(selector==='#practice-card h3')return heading;return {focus(options){focused.push({target:selector,options});}};},
  });
  vm.runInContext(role+'\nsetCoordinatorExamples(true);\n'+studio+'\n'+source+`\nlet currentGuides=[];
    function bookGuides(){return currentGuides;}
    this.practice={render:chapterPractice,card:practiceCardMarkup,cards:practiceCards,session:practiceSession,checkKey:practiceCheckKey,article:articleAnalysis,
      select(rec){activeBook={id:rec.bookId};selectedUnit=rec.unitId;currentGuides=[rec];}};`,context);
  return {practice:context.practice,state,card,panel,studyMap,focused,sourceCalls,get saves(){return saves;},get scroll(){return scroll;},
    click(action,data={}){listeners.click({target:{closest:()=>({dataset:{action,...data}})}});},
  };
}

function evidence(status,text,sourceRefs=[]){return {status,text,sourceRefs};}
function articleFixture(){return {
  kind:'empirical-study',scope:'Guide based on the supplied article text.',
  researchQuestion:evidence('reported','Does a peer-review process change reporting consistency?',['p2']),
  studyDesign:evidence('reported','A comparison of reporting processes.',['p3']),
  population:evidence('not-reported','The supplied text does not give a sample size.'),
  comparator:evidence('not-applicable','This source has no separate comparator.'),
  outcomes:evidence('reported','The recorded outcome is reporting consistency.',['p4']),
  results:[evidence('reported','The supplied result is a difference of 2 points.',['p5'])],
  statistics:[evidence('reported','The source reports a 95% confidence interval of 1 to 3.',['p5']),evidence('not-reported','A p value is not reported in this text.')],
  limitations:[evidence('interpretation','The comparison alone cannot establish the cause.')],
  implications:[evidence('interpretation','Check whether the reporting process fits your own setting.')],
  criticalQuestions:['What other process could explain the difference?'],
};}

test('every chapter provides its exact recall questions and an Apply it card with source-specific reasoning',()=>{
  assert.equal(all.length,9);
  const r=runtime();
  for(const rec of all){
    r.practice.select(rec);
    const cards=r.practice.cards(rec);
    assert.equal(cards.length,rec.guide.recall.length+1);
    assert.deepEqual(plain(cards.slice(0,-1).map(({question,answer})=>({question,answer}))),rec.guide.recall.map(({question,answer})=>({question,answer})));
    const decision=cards.at(-1);
    assert.equal(decision.context,rec.guide.application.scenario);
    assert.equal(decision.answer,rec.guide.application.steps.join('\n\n'));
    const html=r.practice.render(rec);
    assert.match(html,/Practice this chapter/);assert.match(html,/No typing/);
    assert.match(html,/aria-live="polite"/);assert.doesNotMatch(html,/<textarea|data-note=/);
    assert.ok(html.includes(escape(rec.guide.recall[0].question)));
    r.click('practice-card',{index:String(cards.length-1)});
    assert.match(r.card.innerHTML,/Apply it/);assert.doesNotMatch(r.card.innerHTML,/coordinator|affiliate|S&amp;C|staff/i);
    assert.ok(r.card.innerHTML.includes(escape(rec.guide.application.scenario)));
    assert.doesNotMatch(r.card.innerHTML,/class="practice-explanation"/);
    r.click('practice-reveal');
    assert.match(r.card.innerHTML,/class="practice-explanation"/);
    for(const step of rec.guide.application.steps)assert.ok(r.card.innerHTML.includes(escape(step)),`Decision reasoning retained for ${rec.unitId}`);
  }
});

test('reveal, navigation, and self-assessment update the real session without treating confidence as a scored result',()=>{
  const rec=seed.guides[0],r=runtime();r.practice.select(rec);
  const count=r.practice.cards(rec).length,session=r.practice.session(rec);
  assert.equal(session.reveal,false);assert.equal(session.index,0);
  assert.doesNotMatch(r.practice.card(rec),/data-action="practice-rate"/);
  r.click('practice-reveal');assert.equal(session.reveal,true);
  assert.match(r.card.innerHTML,/aria-expanded="true"/);
  r.click('practice-rate',{ready:'true'});
  assert.equal(r.state.checks[rec.bookId][r.practice.checkKey(rec,0)],true);
  assert.equal(r.saves,1);assert.match(r.card.innerHTML,new RegExp(`<progress value="1" max="${count}"`));
  assert.match(r.card.innerHTML,/data-ready="true" aria-pressed="true"/);
  r.click('practice-rate',{ready:'false'});
  assert.equal(r.state.checks[rec.bookId][r.practice.checkKey(rec,0)],false);
  assert.equal(r.saves,2);assert.match(r.card.innerHTML,/<progress value="0"/);
  assert.match(r.card.innerHTML,/data-ready="false" aria-pressed="true"/);
  r.click('practice-card',{index:'1'});
  assert.equal(session.index,1);assert.equal(session.reveal,false);
  assert.doesNotMatch(r.card.innerHTML,/class="practice-explanation"/);
  assert.equal(r.focused.at(-1).target,'heading');
  r.click('practice-card',{index:'999'});assert.equal(session.index,count-1);
  assert.match(r.card.innerHTML,/data-index="\d+" disabled>Next card/);
  r.click('practice-card',{index:'-50'});assert.equal(session.index,0);
  assert.match(r.card.innerHTML,/data-index="-1" disabled>/);
  r.click('practice-reveal');r.click('practice-reveal');assert.equal(session.reveal,false);
  assert.match(r.card.innerHTML,/aria-expanded="false"/);
});

test('practice state is isolated by book and opening the activity respects reduced motion and restores keyboard focus',()=>{
  const first=seed.guides[0],second=structuredClone(first);second.bookId='another-book';
  const r=runtime({reducedMotion:true});r.practice.select(first);
  r.click('practice-reveal');r.click('practice-rate',{ready:'true'});
  r.practice.select(second);
  assert.equal(r.practice.session(second).reveal,false);
  assert.match(r.practice.card(second),/<progress value="0"/);
  assert.equal(r.practice.session(first).reveal,true);
  r.click('practice-open');assert.equal(r.panel.open,true);
  assert.equal(r.scroll.behavior,'instant');assert.equal(r.scroll.block,'start');
  assert.equal(r.focused.at(-1).target,'summary');assert.equal(r.focused.at(-1).options.preventScroll,true);
});

test('practice escapes guide questions, answers, scenarios, note keys, and saved note text',()=>{
  const rec=structuredClone(seed.guides[0]);rec.unitId='unit" onfocus="alert(1)';
  rec.guide.recall=[{question:'<img src=x onerror=alert(2)>',answer:'<script>answer</script>'}];
  rec.guide.application={scenario:'<iframe src=x>scenario</iframe>',steps:['<svg onload=alert(3)>']};
  const injection='</textarea><script>saved note</script>',notes={
    [rec.unitId+' / Practice response 1']:injection,
    [rec.unitId+' / Practice response 2']:injection,
  },r=runtime({notes});r.practice.select(rec);
  const outputs=[r.practice.render(rec)];
  r.click('practice-reveal');outputs.push(r.card.innerHTML);
  r.click('practice-card',{index:'1'});r.click('practice-reveal');outputs.push(r.card.innerHTML);
  for(const html of outputs){
    assert.doesNotMatch(html,/<script>|<img src=x|<iframe|<svg onload|" onfocus=/);
    assert.doesNotMatch(html,/<textarea|saved note/);
  }
  for(const escaped of ['&lt;img','&lt;script&gt;answer','&lt;iframe','&lt;svg onload'])assert.ok(outputs.join('').includes(escaped));
});

test('article analysis preserves supplied reporting status, statistical detail, and source references',()=>{
  const rec=structuredClone(seed.guides[0]);rec.guide.articleAnalysis=articleFixture();
  const r=runtime(),html=r.practice.article(rec);
  for(const label of ['Empirical study','Reported in this source','Not reported in this text','Not applicable','Companion interpretation','Understand the statistics'])assert.ok(html.includes(label));
  for(const text of ['95% confidence interval of 1 to 3','A p value is not reported in this text','difference of 2 points','cannot establish the cause'])assert.ok(html.includes(text));
  assert.equal([...html.matchAll(/<details>/g)].length,9);
  assert.equal([...html.matchAll(/<details open>/g)].length,0,'Detailed appraisal starts closed to avoid duplicating the active map stage');
  assert.match(html,/does not independently validate the research/);
  assert.deepEqual(r.sourceCalls.find(call=>call.sourceRefs.includes('p5')),{chapterId:rec.chapterId,sourceRefs:['p5']});
  assert.equal(r.sourceCalls.length,11,'Every supplied evidence item retains its source lookup, plus the active question stage');
  delete rec.guide.articleAnalysis;assert.equal(r.practice.article(rec),'');
  rec.guide.articleAnalysis=null;assert.equal(r.practice.article(rec),'');
});

test('article analysis escapes untrusted scope, evidence, labels, questions, and saved note content',()=>{
  const rec=structuredClone(seed.guides[0]);rec.unitId='unit" autofocus onfocus="alert(1)';
  const a=articleFixture();rec.guide.articleAnalysis=a;
  a.scope='<iframe src=x>scope</iframe>';
  a.researchQuestion=evidence('reported" onclick="alert(2)','<img src=x onerror=alert(3)>');
  a.statistics=[evidence('not-reported','<script>statistical detail</script>')];
  a.criticalQuestions=['<svg onload=alert(4)>'];
  const note='</textarea><script>saved evidence note</script>';
  const r=runtime({notes:{[rec.unitId+' / Article question 1']:note}}),html=r.practice.article(rec);
  assert.doesNotMatch(html,/<iframe|<img src=x|<script>|<svg onload|" onclick=|" autofocus/);
  assert.doesNotMatch(html,/<textarea|saved evidence note/);
  for(const value of [a.scope,a.researchQuestion.status,a.researchQuestion.text,a.statistics[0].text,a.criticalQuestions[0]])assert.ok(html.includes(escape(value)),`Escaped article value is preserved: ${value}`);
});


test('interactive article map reveals only source-grounded stages and preserves keyboard focus',()=>{
  const rec=structuredClone(seed.guides[0]);rec.guide.articleAnalysis=articleFixture();
  const r=runtime();r.practice.select(rec);
  const initial=r.practice.article(rec);
  assert.equal([...initial.matchAll(/data-action="practice-evidence-stage"/g)].length,5);
  assert.match(initial,/data-evidence-stage="0" aria-pressed="true"/);
  assert.match(initial,/aria-controls="article-study-map-detail"/);
  assert.match(initial,/role="region" aria-labelledby="article-study-stage-title" aria-live="polite"/);
  const cases=[
    [1,['A comparison of reporting processes.','does not give a sample size','no separate comparator','reporting consistency.']],
    [2,['difference of 2 points']],
    [3,['cannot establish the cause']],
    [4,['fits your own setting']],
  ];
  for(const [index,phrases] of cases){
    const before=r.sourceCalls.length;
    r.click('practice-evidence-stage',{evidenceStage:String(index)});
    assert.equal(r.practice.session(rec).evidenceStage,index);
    assert.match(r.studyMap.innerHTML,new RegExp(`data-evidence-stage="${index}" aria-pressed="true"`));
    for(const phrase of phrases)assert.ok(r.studyMap.innerHTML.includes(phrase));
    assert.ok(r.sourceCalls.length>before,'Displayed evidence uses the existing source-link renderer');
    assert.equal(r.focused.at(-1).target,`[data-evidence-stage="${index}"]`);
    assert.equal(r.focused.at(-1).options.preventScroll,true);
    assert.doesNotMatch(r.studyMap.innerHTML,/fictional|95% confidence interval/,'Map neither inserts fictional content nor duplicates the full statistics section');
  }
  assert.equal(r.saves,0,'Exploration is not a completion or confidence claim');
  const previous=r.studyMap.innerHTML;
  for(const value of ['-1','5','NaN','1.5'])r.click('practice-evidence-stage',{evidenceStage:value});
  assert.equal(r.studyMap.innerHTML,previous);
  const another=structuredClone(rec);another.bookId='another-article';r.practice.select(another);
  assert.match(r.practice.article(another),/data-evidence-stage="0" aria-pressed="true"/);
});

test('article map changes study labels for commentary and handles missing evidence without inventing a study',()=>{
  const rec=structuredClone(seed.guides[0]);rec.guide.articleAnalysis={...articleFixture(),kind:'commentary'};
  const r=runtime();r.practice.select(rec);
  let html=r.practice.article(rec);
  for(const label of ['Map the argument','Argument','Claims','Application'])assert.ok(html.includes(label));
  r.click('practice-evidence-stage',{evidenceStage:'1'});
  assert.match(r.studyMap.innerHTML,/How does the source build its case/);
  assert.doesNotMatch(r.studyMap.innerHTML,/Who or what|Measures|no separate comparator/);
  rec.guide.articleAnalysis.results=[];
  r.click('practice-evidence-stage',{evidenceStage:'2'});
  assert.match(r.studyMap.innerHTML,/This detail is not available in the supplied guide/);
  assert.doesNotMatch(r.studyMap.innerHTML,/difference of 2 points/);
  rec.guide.articleAnalysis.kind='evidence-review';r.practice.session(rec).evidenceStage=1;
  html=r.practice.article(rec);assert.match(html,/Map the evidence/);assert.match(html,/How was the evidence examined/);
});
