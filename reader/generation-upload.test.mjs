import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
const ui=await readFile(new URL('./generation-ui.js',import.meta.url),'utf8');
function importRuntime({connected=true,guides=[{unitId:'c1:u1'}],saveFails=false}={}){
 const waiting=new Set(),cache=new Map(),book={id:'upload',title:'Synthetic upload',chapters:[{id:'c1'},{id:'c2'}]},events=[],input={value:'file'},context=vm.createContext({
 importing:false,state:{hiddenBooks:{}},books:[],db:null,localAI:{available:true,connected,autoGenerate:true},
 toast:message=>events.push(['toast',message]),readEPUB:async()=>book,save(){},go:(...args)=>{assert.equal(waiting.has(book.id),true);events.push(['go',...args]);},
 nextBooksWaitingForSave:waiting,nextBooksCache:cache,refreshNextBooksPanel:()=>events.push(['recommendation-error']),nextBooksAfterRender:()=>{assert.equal(waiting.has(book.id),false);events.push(['recommendations']);},
 persistBook:async()=>{assert.equal(waiting.has(book.id),true);events.push(['saved']);if(saveFails)throw Error('Save failed');},
 refreshGeneration:async()=>events.push(['refresh']),bookGuides:()=>guides,startGeneration:async b=>events.push(['generate',b.id]),$:()=>input,
 });
 vm.runInContext(app.slice(app.indexOf('  async function importFile('),app.indexOf('  function route()'))+'\nthis.importBook=importFile;',context);
 return {run:()=>context.importBook({name:'synthetic.epub'}),events,input,waiting,cache};
}
test('partly prepared EPUB imports automatically request missing guides after cloud save',async()=>{
 const r=importRuntime();await r.run();assert.deepEqual(r.events.filter(e=>['saved','recommendations','refresh','generate'].includes(e[0])),[['saved'],['recommendations'],['refresh'],['generate','upload']]);assert.equal(r.input.value,'');
});
test('missing AI key and failed cloud saves do not submit generation',async()=>{
 for(const options of [{connected:false},{saveFails:true}]){const r=importRuntime(options);await r.run();assert.equal(r.events.some(e=>e[0]==='generate'),false);assert.equal(r.waiting.size,0);if(options.saveFails){assert.equal(r.cache.get('upload').requiresSave,true);assert.equal(r.events.some(e=>e[0]==='recommendation-error'),true);assert.equal(r.events.some(e=>e[0]==='recommendations'),false);}}
});
test('library refresh collects the active batch even while reading another book',async()=>{
 const calls=[],context=vm.createContext({activeBook:{id:'book-b'},localAI:{},generationJob:null,view:'reader',bookGuides:()=>[],mergeGuides(){},render(){},document:{activeElement:{matches:()=>false}},
 api:async path=>{calls.push(path);if(path==='/api/jobs')return {job:{bookId:'book-a',status:'completed'}};return path==='/api/status'?{connected:true}:{guides:[]};}});
 const slice=ui.slice(ui.indexOf('  function currentGenerationJob()'),ui.indexOf('  async function initializeGeneration()'));
 vm.runInContext(slice+'\nthis.refresh=refreshGeneration;this.job=()=>generationJob;',context);
 await context.refresh(false);assert.ok(calls.includes('/api/jobs'));assert.equal(context.job(),null);
});

function lessonRefreshRuntime({editing=false,selectedText=false}={}){
 const book={id:'article'},guides=new Map([[book.id,[]]]),renders=[],incoming=[{bookId:book.id,unitId:'results:u1'}];
 let job={bookId:book.id,status:'completed'};
 const context=vm.createContext({activeBook:book,localAI:{available:true,connected:true},generationJob:null,view:'explore',
  bookGuides:(target=book)=>guides.get(target.id)||[],mergeGuides:(records,bookId)=>guides.set(bookId,records),
  render:()=>renders.push(guides.get(book.id).map(record=>record.unitId)),
  document:{activeElement:{matches:()=>editing}},window:{getSelection:()=>({isCollapsed:!selectedText})},
  api:async path=>path==='/api/status'?{connected:true}:path==='/api/jobs'?{job}:{guides:incoming},
 });
 const slice=ui.slice(ui.indexOf('  function currentGenerationJob()'),ui.indexOf('  async function initializeGeneration()'));
 vm.runInContext(slice+'\nthis.refresh=refreshGeneration;',context);
 return {context,renders,refresh:context.refresh,changeStatus:status=>{job={...job,status};}};
}

test('an open lesson deep link repaints after its cloud guide arrives, without refreshing on status-only polling',async()=>{
 const r=lessonRefreshRuntime();
 await r.refresh();
 assert.deepEqual(r.renders,[['results:u1']],'The previously empty lesson is rendered with its fetched guide');
 r.changeStatus('in_progress');
 await r.refresh();
 assert.equal(r.renders.length,1,'Background job-status changes preserve the current lesson interaction');
});

test('guide arrival does not replace a lesson while the reader edits a note or selects source text',async()=>{
 for(const options of [{editing:true},{selectedText:true}]){
  const r=lessonRefreshRuntime(options);await r.refresh();
  assert.equal(r.renders.length,0);
  assert.equal(r.context.bookGuides().length,1,'The guide still merges while the active reading interaction is protected');
 }
});
