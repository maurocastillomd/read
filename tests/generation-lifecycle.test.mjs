import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the real durable job controller with in-memory D1/R2 and provider
// boundaries. No network or paid model requests run in these tests.
const source = readFileSync(new URL('../lib/cloud-generation.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
const asUrl = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const storeUrl = asUrl(`const c=()=>globalThis.__marginGenerationTest; export const getBook=(u,b)=>Promise.resolve(c().book.id===b?c().book:null); export const getGuides=()=>Promise.resolve(c().guides); export const saveGuide=async(u,g)=>{if(!c().guides.some(x=>x.unitId===g.unitId))c().guides.push(g);};`);
const validationTs = readFileSync(new URL('../lib/cloud-validation.ts', import.meta.url), 'utf8');
const validationJs = ts.transpileModule(validationTs, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText.replace('"./guide-core.mjs"', JSON.stringify(new URL('../lib/guide-core.mjs', import.meta.url).href));
const moduleUrl = asUrl(js.replace("'cloudflare:workers'", JSON.stringify(asUrl('export const env = globalThis.__marginGenerationEnv;'))).replace("'./cloud-store'", JSON.stringify(storeUrl)).replace("'./cloud-validation'", JSON.stringify(asUrl(validationJs))).replace("'./generation-core.mjs'", JSON.stringify(new URL('../lib/generation-core.mjs', import.meta.url).href)).replace("'./guide-core.mjs'", JSON.stringify(new URL('../lib/guide-core.mjs', import.meta.url).href)));
const rows = new Map(), objects = new Map();
const env = globalThis.__marginGenerationEnv = {ANTHROPIC_API_KEY: 'synthetic-test-key', BUCKET: {put: async(k,v)=>{objects.set(k,v);}, get: async k=>objects.has(k)?{text:async()=>objects.get(k)}:null}};
env.DB = {prepare(sql) { return {bind(...v) { return {async first() {
  if (sql.startsWith('SELECT')) return rows.get(v[0]) || null;
  if (sql.startsWith('UPDATE generation_jobs SET lease_token = ?')) {const r=rows.get(v[2]); if(r.lease_until >= v[3])return null; r.lease_token=v[0];r.lease_until=v[1];return {...r};}
  throw new Error('Unexpected query: '+sql);
}, async run() {
  let changes=0;
  if(sql.startsWith('INSERT')) {if(!rows.has(v[0])){rows.set(v[0],{job_id:'',job_json:'{}',lease_token:'',lease_until:0});changes=1;}}
  else if(sql.startsWith('UPDATE generation_jobs SET job_id')) {const r=rows.get(v[4]);if(r?.lease_token===v[5]){Object.assign(r,{job_id:v[0],job_json:v[1],lease_until:v[3]});changes=1;}}
  else if(sql.startsWith("UPDATE generation_jobs SET lease_token = ''")) {const r=rows.get(v[0]);if(r?.lease_token===v[1]){r.lease_token='';r.lease_until=0;changes=1;}}
  else throw new Error('Unexpected query: '+sql);
  return {meta:{changes}};
}};}};}};
const api = await import(moduleUrl);
import {sampleChecks} from './check-fixture.mjs';
import {normalizeParagraphs} from '../lib/guide-core.mjs';
import {generationPlan} from '../lib/generation-core.mjs';
import {sampleEntry, sampleMnemonic} from './fixtures/sample-library.mjs';
// An invented book with prepared lessons stands in for bundled seed data.
const seed = sampleEntry();
const records=seed.guides.filter(g=>['c1','c2'].includes(g.chapterId));
const book = {...seed.book,id:'synthetic-job-book', chapters:seed.book.chapters.filter(c=>['c1','c2'].includes(c.id))};
function reset() {rows.clear();objects.clear();env.ANTHROPIC_API_KEY='synthetic-test-key';globalThis.__marginGenerationTest={book,guides:[]};}
function json(value) {return Response.json(value);}
function companion(guide) {const g=structuredClone(guide);g.application.scenario='Fictional example: '+g.application.scenario;const original=records.find(r=>r.guide.title===guide.title);g.checks=sampleChecks(normalizeParagraphs(seed.book.chapters.find(c=>c.id===original.chapterId)));g.mnemonic=sampleMnemonic();g.learningPath={previous:'Use the supplied preceding excerpt.',current:'Examine the current source claim.',next:'Check the next supplied excerpt.',thread:'Fictional volunteer reviews who owns each weekly task.'};g.chapterVisual={kind:'decision',title:'Task ownership',caption:'Companion illustration of a household decision.',labels:['Task','Owner','Review']};return g;}
function outputLine(i,guide) {const g=companion(guide);return JSON.stringify({custom_id:`unit-${i}`,result:{type:'succeeded',message:message(g)}});}
// A reply with no lesson in it: the one kind of section that fails.
function brokenLine(i) {return JSON.stringify({custom_id:`unit-${i}`,result:{type:'succeeded',message:{stop_reason:'end_turn',content:[{type:'text',text:'Sorry, I cannot help with that.'}]}}});}
function message(guide){return {stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(guide)}]};}
function expirePoll() {const row=rows.get('owner'),j=JSON.parse(row.job_json);j.lastCheckedAt=0;row.job_json=JSON.stringify(j);}

test('missing key never submits and fully prepared books need no key', async()=>{
 reset();env.ANTHROPIC_API_KEY='';let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Must not call provider');};
 await assert.rejects(api.startGeneration('owner',book.id), /Anthropic API key/);assert.equal(calls,0);
 globalThis.__marginGenerationTest.guides=records.map(g=>({...g,bookId:book.id}));
 const job=await api.startGeneration('owner',book.id);assert.equal(job.status,'completed');assert.equal(calls,0);
});
const RESULTS='https://api.anthropic.com/v1/messages/batches/results-file';
const counts=n=>({processing:0,succeeded:n,errored:0,canceled:0,expired:0});
test('concurrent starts submit one batch; later polling stores complete validated guides',async()=>{
 reset();let batches=0,complete=false,headers;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages/batches')&&init.method==='POST'){batches++;headers=init.headers;return json({id:'batch-one',processing_status:'in_progress'});}
  if(url.endsWith('/messages/batches/batch-one'))return json(complete?{processing_status:'ended',results_url:RESULTS,request_counts:counts(2)}:{processing_status:'in_progress',request_counts:{processing:2}});
  if(url===RESULTS)return new Response(records.map((g,i)=>outputLine(i,g.guide)).reverse().join('\n'));
  throw Error('Unexpected request '+url);
 };
 const results=await Promise.allSettled([api.startGeneration('owner',book.id),api.startGeneration('owner',book.id)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(batches,1);
 assert.equal(headers['x-api-key'],'synthetic-test-key');assert.equal(headers['anthropic-version'],'2023-06-01');
 assert.equal((await api.startGeneration('owner',book.id)).status,'running');assert.equal(batches,1);
 complete=true;const job=await api.refreshJob('owner',book.id);assert.equal(job.status,'completed');assert.equal(job.completed,2);assert.equal(job.completionWindow,'24h');
 assert.equal(globalThis.__marginGenerationTest.guides.length,2);
 for(const record of globalThis.__marginGenerationTest.guides)assert.ok(record.guide.mnemonic.cue);
 assert.equal((await api.refreshJob('owner',book.id)).completed,2);assert.equal(batches,1);
});
test('lost submission response recovers the existing paid batch without another POST',async()=>{
 reset();let batches=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages/batches')&&init.method==='POST'){batches++;throw Error('Synthetic lost response');}
  if(url.includes('/messages/batches?'))return json({data:[
   {id:'batch-recovered',created_at:new Date().toISOString(),processing_status:'in_progress',request_counts:{processing:2,succeeded:0,errored:0,canceled:0,expired:0}},
   {id:'batch-other-size',created_at:new Date().toISOString(),processing_status:'in_progress',request_counts:{processing:7}},
   {id:'batch-too-old',created_at:'2020-01-01T00:00:00Z',processing_status:'ended',request_counts:counts(2)}],has_more:false});
  if(url.endsWith('/messages/batches/batch-recovered'))return json({id:'batch-recovered',processing_status:'in_progress',request_counts:{processing:2}});
  throw Error('Unexpected request '+url);
 };
 assert.equal((await api.startGeneration('owner',book.id)).status,'submission_unknown');
 assert.equal((await api.refreshJob('owner',book.id)).status,'running');assert.equal(batches,1);
});
test('an ambiguous lost submission is never adopted or resent',async()=>{
 reset();let batches=0;const twin=id=>({id,created_at:new Date().toISOString(),processing_status:'in_progress',request_counts:{processing:2}});
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages/batches')&&init.method==='POST'){batches++;throw Error('Synthetic lost response');}
  if(url.includes('/messages/batches?'))return json({data:[twin('a'),twin('b')],has_more:false});
  throw Error('Unexpected request '+url);
 };
 await api.startGeneration('owner',book.id);
 const job=await api.refreshJob('owner',book.id);assert.equal(job.status,'submission_unknown');assert.equal(batches,1);
});
test('invalid section fails, explicit retry submits only that section, and retries are bounded',async()=>{
 reset();let submitted=0,phase=1,sent=[];
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages/batches')&&init.method==='POST'){submitted++;sent.push(JSON.parse(init.body).requests);return json({id:'batch-'+phase,processing_status:'in_progress'});}
  if(url.includes('/messages/batches/batch-'))return json({processing_status:'ended',results_url:RESULTS+phase,request_counts:counts(phase===1?2:1)});
  if(url.startsWith(RESULTS)){return new Response(phase===1?[outputLine(0,records[0].guide),brokenLine(1)].join('\n'):brokenLine(0));}
  throw Error('Unexpected request '+url);
 };
 const start=await api.startGeneration('owner',book.id),first=await api.refreshJob('owner',book.id);
 assert.equal(first.status,'completed_with_errors');assert.equal(first.completed,1);
 phase=2;await api.actOnJob('owner',start.id,'retry');expirePoll();const last=await api.refreshJob('owner',book.id);
 assert.equal(submitted,2);assert.equal(sent[0].length,2);assert.equal(sent[1].length,1);assert.equal(last.completed,1);
 await assert.rejects(api.actOnJob('owner',start.id,'retry'),/two-attempt limit/);
});
test('cancelling a batch collects finished sections and keeps the cancelled state',async()=>{
 reset();let cancelled=false;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages/batches')&&init.method==='POST')return json({id:'batch-c',processing_status:'in_progress'});
  if(url.endsWith('/messages/batches/batch-c/cancel')&&init.method==='POST'){cancelled=true;return json({id:'batch-c',processing_status:'canceling'});}
  if(url.endsWith('/messages/batches/batch-c'))return json({processing_status:'ended',cancel_initiated_at:new Date().toISOString(),results_url:RESULTS,request_counts:{succeeded:1,canceled:1}});
  if(url===RESULTS)return new Response([outputLine(0,records[0].guide),JSON.stringify({custom_id:'unit-1',result:{type:'canceled'}})].join('\n'));
  throw Error('Unexpected request '+url);
 };
 const start=await api.startGeneration('owner',book.id);
 assert.equal((await api.actOnJob('owner',start.id,'cancel')).status,'cancelling');assert.ok(cancelled);
 const job=await api.refreshJob('owner',book.id);assert.equal(job.status,'cancelled');assert.equal(job.completed,1);
});

// Same synthetic study as tests/generation.test.mjs, so its guide passes the article checks.
const article={id:'synthetic-article',title:'Synthetic study fixture',author:'QA',sourceType:'article',sourceFormat:'PDF',importWarnings:[],chapters:[{id:'article',title:'Article',text:'Researchers randomly assigned 40 teachers to two team-training formats.\n\nThe outcome was a prespecified communication score after six weeks. The mean difference was 2 points, with a 95% confidence interval from -1 to 5.\n\nThe authors reported that participants came from one organization and follow-up was short.'}]};
const articleUnit=generationPlan(article).units[0];
const reported=(text,index=0)=>({status:'reported',text,sourceRefs:[{paragraphId:articleUnit.paragraphs[index].id,quote:articleUnit.paragraphs[index].text}]});
const interpretation=text=>({status:'interpretation',text,sourceRefs:[]});
function articleGuide(){
 const g=companion(records[0].guide);g.checks=sampleChecks(articleUnit.paragraphs);
 g.concepts=[{title:'The reported comparison',explanation:'The supplied text reports a randomized comparison of team-training formats.',sourceRefs:reported('',0).sourceRefs}];
 g.principles=[{title:'Keep uncertainty visible',explanation:'The interval includes no difference and positive values.',origin:'interpretation',sourceRefs:reported('',1).sourceRefs}];
 g.articleAnalysis={kind:'empirical-study',statisticsLab:null,scope:'This appraisal uses the supplied article section.',researchQuestion:interpretation('Compare the reported team-training formats.'),studyDesign:reported('Random assignment to two formats.'),population:reported('40 teachers.'),comparator:reported('Two team-training formats.'),outcomes:reported('A prespecified communication score at six weeks.',1),results:[reported('The mean difference was 2 points.',1)],statistics:[reported('95% confidence interval: -1 to 5 points.',1)],limitations:[reported('One organization and short follow-up.',2)],implications:[interpretation('A school would need to examine local context first.')],criticalQuestions:['How was the communication score measured?','Were participants analyzed in their assigned groups?']};
 return g;
}
test('articles run directly in their own slot while a book batch is still running',async()=>{
 reset();const calls=[];
 globalThis.fetch=async(url,init={})=>{
  calls.push(url);
  if(url.endsWith('/messages/batches')&&init.method==='POST')return json({id:'book-batch',processing_status:'in_progress'});
  if(url.endsWith('/messages')&&init.method==='POST'){const body=JSON.parse(init.body);assert.equal(body.model,'claude-haiku-5-5');return json(message(articleGuide()));}
  throw Error('Unexpected request '+url);
 };
 assert.equal((await api.startGeneration('owner',book.id)).status,'running');
 globalThis.__marginGenerationTest.book=article;
 const job=await api.startGeneration('owner',article.id);
 assert.equal(job.completionWindow,'minutes');assert.equal(job.bookId,article.id);assert.equal(job.status,'completed');assert.equal(globalThis.__marginGenerationTest.guides.length,1);
 assert.ok(rows.has('owner#articles'));assert.equal(JSON.parse(rows.get('owner').job_json).status,'running');
 assert.equal(calls.filter(u=>u.endsWith('/messages/batches')).length,1);
 const polled=await api.refreshJob('owner',article.id);assert.equal(polled.id,job.id);assert.equal(polled.completionWindow,'minutes');
 assert.equal(calls.length,1+job.total);
});
test('an interrupted article request is released for retry instead of blocking forever',async()=>{
 reset();globalThis.__marginGenerationTest.book=article;let fail=true;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages')&&init.method==='POST'){if(fail)throw Error('connection dropped');return json(message(articleGuide()));}
  throw Error('Unexpected request '+url);
 };
 const failed=await api.startGeneration('owner',article.id);assert.equal(failed.status,'completed_with_errors');assert.ok(failed.retryAvailable);
 const row=rows.get('owner#articles'),j=JSON.parse(row.job_json);j.status='running';j.updatedAt='2020-01-01T00:00:00Z';row.job_json=JSON.stringify(j);
 const released=await api.refreshJob('owner',article.id);assert.equal(released.status,'completed_with_errors');
 fail=false;const retried=await api.actOnJob('owner',failed.id,'retry');assert.equal(retried.status,'completed');assert.equal(retried.completionWindow,'minutes');
});

async function savedOutputJob({status='completed_with_errors',completeFirst=false,lines}={}) {
 reset();
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages/batches')&&init.method==='POST')return json({id:'saved-batch',processing_status:'in_progress'});
  throw Error('Unexpected setup request '+url);
 };
 const started=await api.startGeneration('owner',book.id),row=rows.get('owner'),job=JSON.parse(row.job_json);
 job.status=status;job.providerStatus=status==='cancelled'?'cancelled':'completed';job.outputKey='synthetic/saved-output.jsonl';job.outputCursor=99;
 job.error='Previous validation failed.';
 for(const unit of job.units){unit.status='failed';unit.attempts=2;unit.error='Previous validation failed.';}
 if(completeFirst){job.units[0].status='completed';job.units[0].error='';globalThis.__marginGenerationTest.guides.push({...structuredClone(records[0]),bookId:book.id,unitId:job.units[0].id});}
 row.job_json=JSON.stringify(job);
 objects.set(job.outputKey,lines||records.map((g,i)=>outputLine(i,g.guide)).join('\n'));
 env.ANTHROPIC_API_KEY='';
 const providerCalls=[];globalThis.fetch=async(url,init={})=>{providerCalls.push({url,method:init.method||'GET'});throw Error('Saved output must not contact the provider');};
 return {id:started.id,job,providerCalls};
}

test('saved output recheck needs no key or provider call, keeps paid attempts and completed guides intact',async()=>{
 for(const status of ['failed','completed_with_errors','cancelled']) {
  const fixture=await savedOutputJob({status,completeFirst:true});
  const completedGuide=structuredClone(globalThis.__marginGenerationTest.guides[0]);
  const result=await api.actOnJob('owner',fixture.id,'recheck');
  assert.equal(result.status,'completed');assert.equal(result.completed,2);
  assert.deepEqual(fixture.providerCalls,[]);
  const saved=JSON.parse(rows.get('owner').job_json);
  assert.deepEqual(saved.units.map(u=>u.attempts),[2,2]);
  assert.equal(saved.outputKey,fixture.job.outputKey);assert.equal(saved.outputCursor,2);
  assert.equal(saved.batchId,fixture.job.batchId);assert.equal(saved.sourceHash,fixture.job.sourceHash);
  assert.deepEqual(globalThis.__marginGenerationTest.guides[0],completedGuide);
  assert.equal(globalThis.__marginGenerationTest.guides.length,2);
 }
});

test('saved output recheck rejects source changes and missing output without mutating the job',async()=>{
 const fixture=await savedOutputJob();
 const unchanged=rows.get('owner').job_json;
 globalThis.__marginGenerationTest.book={...book,chapters:book.chapters.map((c,i)=>i?c:{...c,text:c.text+'\nChanged source.'})};
 await assert.rejects(api.actOnJob('owner',fixture.id,'recheck'),/no longer matches its source/);
 assert.equal(rows.get('owner').job_json,unchanged);assert.deepEqual(fixture.providerCalls,[]);
 globalThis.__marginGenerationTest.book=book;
 objects.delete(fixture.job.outputKey);
 await assert.rejects(api.actOnJob('owner',fixture.id,'recheck'),/output is temporarily unavailable/);
 assert.equal(rows.get('owner').job_json,unchanged);
 const job=JSON.parse(unchanged);delete job.outputKey;rows.get('owner').job_json=JSON.stringify(job);
 await assert.rejects(api.actOnJob('owner',fixture.id,'recheck'),/no saved output/);
 assert.deepEqual(fixture.providerCalls,[]);
});

test('saved output cannot be rechecked while a batch is active or after full completion',async()=>{
 const fixture=await savedOutputJob();
 for(const status of ['queued','submitting','submission_unknown','running','collecting','cancelling','completed']) {
  const job={...fixture.job,status};rows.get('owner').job_json=JSON.stringify(job);
  await assert.rejects(api.actOnJob('owner',fixture.id,'recheck'),/Wait for the current batch/);
  assert.equal(JSON.parse(rows.get('owner').job_json).status,status);
 }
 assert.deepEqual(fixture.providerCalls,[]);
});

test('saved output recheck continues later chunks offline and preserves cancelled status for failed units',async()=>{
  // Unknown rows still advance the cursor but never enter the guide store.
 const lines=[...Array.from({length:12},(_,i)=>JSON.stringify({custom_id:'unknown-'+i})),outputLine(0,records[0].guide),brokenLine(1)].join('\n');
 const fixture=await savedOutputJob({status:'cancelled',lines});
 const first=await api.actOnJob('owner',fixture.id,'recheck');assert.equal(first.status,'collecting');
 assert.equal(JSON.parse(rows.get('owner').job_json).outputCursor,12);
 const finished=await api.refreshJob('owner',book.id);assert.equal(finished.status,'cancelled');assert.equal(finished.completed,1);
 assert.deepEqual(fixture.providerCalls,[]);
 assert.deepEqual(JSON.parse(rows.get('owner').job_json).units.map(u=>u.attempts),[2,2]);
 assert.equal(globalThis.__marginGenerationTest.guides.length,1);
});

test('lessons come from a plain draft request; an unusable reply gets one fresh try; account errors are named plainly',async()=>{
 reset();globalThis.__marginGenerationTest.book=article;const bodies=[];
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/messages')&&init.method==='POST'){const body=JSON.parse(init.body);bodies.push(body);
   const guide=articleGuide();guide.checks=guide.checks.slice(0,3);
   return json(message(guide));}
  throw Error('Unexpected request '+url);
 };
 const job=await api.startGeneration('owner',article.id);
 assert.equal(job.status,'completed');assert.equal(bodies.length,1,'a near miss is topped up by the code, not sent back');
 assert.equal(bodies[0].output_config.format,undefined);assert.equal(bodies[0].output_config.effort,'low');assert.deepEqual(bodies[0].thinking,{type:'disabled'});
 assert.deepEqual(bodies[0].messages.map(m=>m.role),['user']);
 // A reply the code cannot use gets one fresh request, then its plain reason is shown.
 reset();globalThis.__marginGenerationTest.book=article;let tries=0;
 globalThis.fetch=async()=>{tries++;return json({stop_reason:'end_turn',content:[{type:'text',text:'Sorry, I cannot help with that.'}]});};
 const stuck=await api.startGeneration('owner',article.id);
 assert.equal(tries,2);assert.match(stuck.units[0].error,/could not be built: the reply contained no lesson/);assert.match(stuck.error,/could not be built/);
 // A cut-off first reply is followed by a fresh one that completes the lesson.
 reset();globalThis.__marginGenerationTest.book=article;let attempt=0;
 globalThis.fetch=async()=>{attempt++;return json(attempt===1?{stop_reason:'max_tokens',content:[{type:'text',text:'{"title":'}]}:message(articleGuide()));};
 assert.equal((await api.startGeneration('owner',article.id)).status,'completed');assert.equal(attempt,2);
 // One broken check is dropped or tidied instead of failing the whole lesson.
 reset();globalThis.__marginGenerationTest.book=article;let once=0;
 globalThis.fetch=async()=>{once++;const guide=articleGuide();
  const book=guide.checks.find(q=>q.format==='book');if(book)book.choices=[{label:'Agree',feedback:'a'},{label:'Unsure',feedback:'b'},{label:'Disagree',feedback:'c'}];
  guide.checks.push({...structuredClone(guide.checks[0]),id:'broken-quote',source:{...guide.checks[0].source,quote:'words that are not in the article at all'}});
  return json(message(guide));};
 const tidy=await api.startGeneration('owner',article.id);
 assert.equal(tidy.status,'completed');assert.equal(once,1,'no repair turn needed');
 // A wrapped, fenced answer is still accepted.
 reset();globalThis.__marginGenerationTest.book=article;
 globalThis.fetch=async()=>{const m=message(articleGuide());m.content[0].text='```json\n'+JSON.stringify({guide:JSON.parse(m.content[0].text)})+'\n```';return json(m);};
 assert.equal((await api.startGeneration('owner',article.id)).status,'completed');
 reset();globalThis.__marginGenerationTest.book=article;let calls=0;
 globalThis.fetch=async(url,init={})=>{calls++;return new Response(JSON.stringify({type:'error',error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API.'}}),{status:400});};
 const broke=await api.startGeneration('owner',article.id);
 assert.equal(broke.status,'completed_with_errors');assert.equal(calls,1,'No fallback request when the account has no credit');
 assert.match(broke.units[0].error,/out of credits/);
 reset();globalThis.__marginGenerationTest.book=article;calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({type:'error',error:{type:'invalid_request_error',message:'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use.'}}),{status:400});};
 const unscoped=await api.startGeneration('owner',article.id);
 assert.equal(calls,1);assert.match(unscoped.units[0].error,/not linked to a workspace/);
});
test('a failed article can always be retried and asking again starts it fresh',async()=>{
 reset();globalThis.__marginGenerationTest.book=article;let fail=true;
 globalThis.fetch=async(url,init={})=>{if(fail)return new Response('{}',{status:500});return json(message(articleGuide()));};
 const first=await api.startGeneration('owner',article.id);assert.equal(first.status,'completed_with_errors');
 await api.actOnJob('owner',first.id,'retry');const exhausted=await api.refreshJob('owner',article.id);
 assert.ok(exhausted.retryAvailable,'Article retry stays available after two attempts');
 fail=false;const fresh=await api.startGeneration('owner',article.id);
 assert.notEqual(fresh.id,first.id);assert.equal(fresh.status,'completed');
});
