import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const contract=(await readFile(new URL('../lib/statistics-contract.mjs',import.meta.url),'utf8')).replaceAll('export ','');
const core=(await readFile(new URL('./epub-structure.js',import.meta.url),'utf8'))+(await readFile(new URL('./statistics-core.js',import.meta.url),'utf8')).replace('/*STATISTICS_CONTRACT*/','const StatisticsContract=(()=>{'+contract+';return {validateStatisticsLab,statisticsNumbers};})();');
const lab=await readFile(new URL('./statistics-lab.js',import.meta.url),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function runtime({savedNote='',roleEnabled=true,articleFixture=genericArticle()}={}){
  const {document,window}=parseHTML('<!doctype html><html><body></body></html>');
  const {book,rec}=articleFixture,focused=[];
  window.HTMLElement.prototype.focus=function(options){focused.push({action:this.dataset.action,tab:this.dataset.tab,index:this.dataset.index,options});};
  const ctx=vm.createContext({document,URL,Map,Set,Number,Math,activeBook:book,selectedUnit:rec.unitId,
    coordinatorExamplesEnabled:()=>roleEnabled,setCoordinatorExamples:value=>roleEnabled=value,bookGuides:()=>[rec],esc:escape,refs:(chapter,items)=>items.map(ref=>`<button data-action="source" data-chapter="${escape(chapter)}" data-paragraph="${escape(ref.paragraphId)}" data-match="${escape(ref.quote)}">Check passage</button>`).join(''),note:()=>savedNote,readIcon:name=>`<svg data-icon="${escape(name)}"></svg>`});
  vm.runInContext(core+'\n'+lab+'\nthis.statistics={render:articleStatisticsLab,session:articleStatsSession,profile:statsArticleProfile};',ctx);
  document.body.innerHTML=ctx.statistics.render(rec);
  const query=selector=>document.querySelector(selector);
  function click(selector){const element=query(selector);assert.ok(element,`Control exists: ${selector}`);element.dispatchEvent(new window.Event('click',{bubbles:true}));}
  return {book,rec,ctx,document,window,focused,query,click,
    tab:id=>click(`[data-action="stats-tab"][data-tab="${id}"]`),
    text:selector=>query(selector)?.textContent.replace(/\s+/g,' ').trim(),
    session:()=>ctx.statistics.session(rec)};
}

test('the statistics decision tab asks for taps, never a written briefing',()=>{
  const savedNote='</textarea><script>alert("note")</script>',r=runtime({savedNote});r.tab('decision');
  assert.equal(r.query('script'),null);
  assert.equal(r.query('textarea'),null);
  assert.equal(r.query('#stats-teachback'),null);
});

function genericArticle(selected=['p','effect','icc','sem','cv','r','or','mean']){
  const definitions={
    p:{kind:'p-value',measure:'p',value:.001,operator:'<',quote:'The between-group sprint result was p < 0.001.'},
    effect:{kind:'effect-size',measure:'Hedges g',value:-.45,quote:'Sprint Hedges g = −0.45, 95% CI −0.70 to −0.20.',interval:{low:-.7,high:-.2,level:95,type:'confidence'}},
    icc:{kind:'reliability',measure:'ICC',value:.91,quote:'Repeated jump height ICC = 0.91, 95% CI 0.80 to 0.97.',interval:{low:.8,high:.97,level:95,type:'confidence'}},
    sem:{kind:'reliability',measure:'SEM',value:1.2,unit:'cm',quote:'Jump height SEM = 1.2 cm within the session.'},
    cv:{kind:'reliability',measure:'CV',value:4.5,unit:'%',quote:'Jump height CV = 4.5% within the session.'},
    r:{kind:'association',measure:'Pearson r',value:-.6,quote:'Strength and sprint time: Pearson r = −0.60.'},
    or:{kind:'association',measure:'OR',value:1.8,quote:'The adjusted OR = 1.8, 95% CI 1.1 to 2.9.',interval:{low:1.1,high:2.9,level:95,type:'confidence'}},
    mean:{kind:'estimate',measure:'Mean',value:32,unit:'cm',quote:'The sample mean jump height was 32 cm.'}
  };
  const metrics=selected.map((id,i)=>{const d=definitions[id];return {id,kind:d.kind,label:id+' reported outcome',measure:d.measure,value:d.value,operator:d.operator||'=',unit:d.unit||'',comparison:'Reported comparison for '+id,timepoint:'Reported follow-up',context:'An explicitly synthetic test fixture.',interval:d.interval||null,sourceRefs:[{paragraphId:'p'+(i+1),quote:d.quote}],interpretation:'Interpret '+id+' in the source context.',caution:'The sample and analysis limit the inference.',coordinatorQuestion:'Would '+id+' answer the question you need answered?'};});
  const book={id:'generic-research',sourceType:'article',title:'Synthetic validation fixture',sourceUrl:'https://example.test/research',chapters:[{id:'results',text:selected.map(id=>definitions[id].quote).join('\n\n')}]};
  const rec={bookId:book.id,chapterId:'results',unitId:'results:u1',guide:{articleAnalysis:{kind:'empirical-study',statisticsLab:{version:1,scope:'Numbers reported in this imported section.',metrics}}}};
  return {book,rec};
}

test('generic lab exposes only available statistics and keeps real-life examples off by default',()=>{
  const r=runtime({roleEnabled:false,articleFixture:genericArticle(['p','effect'])});
  assert.deepEqual([...r.document.querySelectorAll('[data-action="stats-tab"]')].map(el=>el.dataset.tab),['p','effect']);
  assert.equal(r.text('#stats-progress-label'),'1 of 2 explored');
  assert.equal(r.query('.stats-apply-note'),null);assert.equal(r.query('[data-tab="decision"]'),null);
  assert.match(r.text('.stats-actual-value'),/p < 0\.001/);
  assert.match(r.text('.stats-chart-caption'),/exact value is unknown/);
  assert.match(r.text('.stats-chart-caption'),/not a null distribution/);
  assert.equal(r.query('#stats-f-slider'),null,'No F distribution is invented from a p value alone');
  r.click('[data-action="stats-answer"][data-index="1"]');
  assert.match(r.text('.stats-decision-feedback'),/Revisit.*cannot tell you the probability of no effect/);
  r.click('[data-action="stats-answer"][data-index="0"]');
  assert.match(r.text('.stats-decision-feedback'),/preserves the distinction/);
  const source=r.query('[data-action="source"]');assert.equal(source.dataset.paragraph,'p1');assert.equal(source.dataset.chapter,'results');
  assert.match(source.dataset.match,/p < 0\.001/);
});

test('generic effects preserve signed numbers and reported intervals without universal size grades',()=>{
  const r=runtime({roleEnabled:false,articleFixture:genericArticle(['effect'])});
  assert.equal(r.session().tab,'effect');assert.equal(r.text('#stats-progress-label'),'1 of 1 explored');
  assert.match(r.text('.stats-actual-value'),/Hedges g = -0\.45/);
  assert.match(r.text('.stats-interval-label'),/95% confidence interval: -0\.7 to -0\.2/);
  assert.ok(r.query('.stats-interval-line'));assert.match(r.text('.stats-panel-heading'),/does not apply universal size labels/);
  assert.equal(r.query('.stats-es-ruler'),null);assert.equal(r.query('.stats-apply-note'),null);
  r.click('[data-action="stats-answer"][data-index="0"]');assert.match(r.text('.stats-decision-feedback'),/percent change use different scales/);
});

test('generic reliability selector distinguishes ICC from SEM and CV while restoring each result',()=>{
  const r=runtime({roleEnabled:false,articleFixture:genericArticle(['icc','sem','cv'])});
  function select(id){const control=r.query('[data-action="stats-generic-metric"]');for(const option of control.querySelectorAll('option'))option.removeAttribute('selected');control.querySelector(`[value="${id}"]`).setAttribute('selected','');control.dispatchEvent(new r.window.Event('change',{bubbles:true}));}
  assert.match(r.text('.stats-panel-heading'),/ICC.*not percent accuracy/);
  assert.match(r.text('.stats-interval-label'),/95% confidence interval: 0\.8 to 0\.97/);
  select('sem');assert.match(r.text('.stats-actual-value'),/SEM = 1\.2 cm/);assert.match(r.text('.stats-panel-heading'),/Error in the measurement units/);
  assert.equal(r.query('.stats-interval-line'),null);assert.match(r.text('.stats-interval-label'),/No uncertainty interval/);
  assert.equal(r.focused.at(-1).action,'stats-generic-metric');
  select('cv');assert.match(r.text('.stats-actual-value'),/CV = 4\.5 %/);assert.match(r.text('.stats-panel-heading'),/Relative variability/);
  select('icc');assert.match(r.text('.stats-actual-value'),/ICC = 0\.91/);
});

test('association charts distinguish a signed correlation from a ratio and exclude irrelevant statistics',()=>{
  const r=runtime({roleEnabled:false,articleFixture:genericArticle(['r','or'])});
  assert.equal(r.document.querySelectorAll('[data-action="stats-tab"]').length,1);
  assert.match(r.text('.stats-actual-value'),/Pearson r = -0\.6/);assert.match(r.text('.stats-panel-heading'),/does not establish causation/);
  assert.match(r.text('.stats-reference-key'),/Zero reference/);
  const select=r.query('[data-action="stats-generic-metric"]');for(const opt of select.querySelectorAll('option'))opt.removeAttribute('selected');select.querySelector('[value="or"]').setAttribute('selected','');select.dispatchEvent(new r.window.Event('change',{bubbles:true}));
  assert.match(r.text('.stats-actual-value'),/OR = 1\.8/);assert.match(r.text('.stats-reference-key'),/Ratio of 1/);
  assert.match(r.text('.stats-panel-heading'),/Odds, risks, rates, and hazards have different meanings/);
  assert.match(r.text('.stats-interval-label'),/1\.1 to 2\.9/);
});

test('turning real-life examples off removes the optional Apply it lens and its notes without deleting saved state',()=>{
  const r=runtime({savedNote:'Saved reasoning.',roleEnabled:true,articleFixture:genericArticle(['mean'])});
  assert.ok(r.query('.stats-apply-note'));r.tab('decision');
  assert.equal(r.query('#stats-teachback'),null);
  r.ctx.setCoordinatorExamples(false);r.document.body.innerHTML=r.ctx.statistics.render(r.rec);
  assert.equal(r.session().tab,'estimate');assert.equal(r.query('#stats-teachback'),null);assert.equal(r.query('[data-tab="decision"]'),null);
  assert.equal(r.text('#stats-progress-label'),'1 of 1 explored');
  r.ctx.setCoordinatorExamples(true);r.document.body.innerHTML=r.ctx.statistics.render(r.rec);r.tab('decision');
  assert.ok(r.query('[data-tab="decision"]'));assert.equal(r.query('textarea'),null);
});

test('generic chart labels stay in readable HTML and long units remain on a secondary line',()=>{
  const article=genericArticle(['p']);
  article.rec.guide.articleAnalysis.statisticsLab.metrics[0].unit='probability under the tested null model';
  const r=runtime({roleEnabled:false,articleFixture:article});
  assert.equal(r.text('.stats-reported-number'),'p < 0.001');
  assert.equal(r.text('.stats-reported-unit'),'probability under the tested null model');
  assert.equal(r.query('.stats-reported-unit').parentElement,r.query('.stats-actual-value'));
  assert.equal(r.query('.stats-value-chart text'),null,'SVG scaling cannot shrink the axis labels');
  assert.deepEqual([...r.document.querySelectorAll('.stats-value-ticks span')].map(node=>node.textContent),['0','0.5','1']);
  assert.equal(r.query('.stats-value-ticks').namespaceURI,'http://www.w3.org/1999/xhtml');
  assert.match(r.query('.stats-value-chart').getAttribute('aria-label'),/p < 0\.001 probability under the tested null model/,'The full reported value and unit remain available to assistive technology');
});

test('standard error of the mean explains precision without teaching measurement reliability',()=>{
  const article=genericArticle(['mean']),metric=article.rec.guide.articleAnalysis.statisticsLab.metrics[0],quote='Standard error of the mean = 1.2 cm.';
  Object.assign(metric,{measure:'Standard error of the mean',value:1.2,sourceRefs:[{paragraphId:'p1',quote}]});article.book.chapters[0].text=quote;
  const r=runtime({roleEnabled:false,articleFixture:article});
  assert.match(r.text('.stats-panel-heading'),/Precision of an estimated mean/);
  assert.match(r.text('.stats-panel-heading'),/sampling variability of the mean/);
  assert.doesNotMatch(r.text('.stats-panel-heading'),/This estimate describes measurement error/);
  assert.match(r.text('.stats-reported-number'),/Standard error of the mean = 1\.2/);
});

test('the optional Apply it tab is generic and appears only when real-life examples are on',()=>{
  const r=runtime({roleEnabled:true,articleFixture:genericArticle(['p','effect'])});
  const tabs=[...r.document.querySelectorAll('[data-action="stats-tab"]')].map(el=>[el.dataset.tab,el.textContent.trim()]);
  assert.deepEqual(tabs.map(([id])=>id),['p','effect','decision']);assert.equal(tabs.at(-1)[1],'Apply it');
  assert.match(r.text('.stats-apply-note'),/Optional · Apply it/);
  r.tab('decision');
  assert.match(r.text('#stats-lab-panel'),/Turn the findings into questions for your work or life/);
  assert.match(r.text('#stats-lab-panel'),/Would p answer the question you need answered/);
  assert.equal(r.text('#stats-progress-label'),'2 of 3 explored');
  assert.doesNotMatch(r.text('#stats-lab-panel')+r.text('.stats-lab-header'),/coordinator|department|athlete|player|baseball|tennis|staff/i);
});

test('articles without an anchored statistics lab show no hand-built supplement',()=>{
  const article=genericArticle(['p']);
  const r=runtime({roleEnabled:false,articleFixture:article});
  delete article.rec.guide.articleAnalysis.statisticsLab;assert.equal(r.ctx.statistics.render(article.rec),'');
  article.rec.guide.articleAnalysis.statisticsLab=null;assert.equal(r.ctx.statistics.render(article.rec),'');
  article.rec.guide.articleAnalysis={kind:'commentary',statisticsLab:{version:1,scope:'x',metrics:[]}};assert.equal(r.ctx.statistics.render(article.rec),'');
  const before=r.query('#stats-lab-panel').innerHTML;
  r.click('[data-action="stats-tab"][data-tab="p"]');
  assert.equal(r.query('#stats-lab-panel').innerHTML,before,'A source without a lab cannot activate another lab');
});
