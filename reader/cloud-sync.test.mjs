import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./cloud-sync.js',import.meta.url),'utf8');
const blank=()=>({notes:{},reviewed:{},last:{},checks:{},hiddenBooks:{},bookmarks:{}});
const plain=value=>JSON.parse(JSON.stringify(value));
function runtime({initial=blank(),outbox=null,api=async()=>({state:blank()}),storageFails=false,focused=false,selected=false}={}) {
  const storage=new Map([['test-state',JSON.stringify(initial)]]);
  if(outbox)storage.set('test-state:cloud-outbox-v1',JSON.stringify({version:1,entries:outbox}));
  let paints=0, intervals=0, selectionActive=selected;
  const events=new Map(), timers=[];
  const context=vm.createContext({
    state:plain(initial), STORE:'test-state', api,
    render(){paints++;},
    localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){if(storageFails)throw Error('quota');storage.set(key,value);}},
    document:{querySelectorAll:()=>[],activeElement:{matches:()=>focused},visibilityState:'visible',addEventListener(name,callback){events.set(name,callback);}},
    window:{addEventListener(){},getSelection:()=>({isCollapsed:!selectionActive})},
    setTimeout:callback=>{timers.push(callback);return timers.length;},clearTimeout(){},setInterval(){intervals++;return 2;},console,
  });
  vm.runInContext(source+`\nthis.sync={cloudDiffState,cloudMergeState,queueCloudState,initializeCloudSync,cloudRunSync,syncLabel,getPending:()=>[...cloudOutbox.values()],getState:()=>state,setState:v=>{state=v;},getSnapshot:()=>cloudSnapshot};`,context);
  return {sync:context.sync,storage,get paints(){return paints;},get intervals(){return intervals;},setSelection(value){selectionActive=value;events.get("selectionchange")?.();},flushTimers(){for(const callback of timers.splice(0))callback();}};
}

test('diffs and deletions are individual fields, never entire book state',()=>{
  const {sync}=runtime(),before={...blank(),notes:{book:{a:'first',b:'keep'}},last:{book:{chapter:'c1',step:2}},hiddenBooks:{old:true}};
  const after={...blank(),notes:{book:{a:'changed',b:'keep'}},last:{book:{chapter:'c2',step:2}},checks:{book:{understood:false}}};
  assert.deepEqual(plain(sync.cloudDiffState(before,after)),[
    {area:'notes',bookId:'book',key:'a',value:'changed'},
    {area:'last',bookId:'book',key:'chapter',value:'c2'},
    {area:'checks',bookId:'book',key:'understood',value:false},
    {area:'hiddenBooks',bookId:'old',key:'',value:null},
  ]);
});

test('remote fields and local pending edits merge, including pending deletion',()=>{
  const {sync}=runtime(),remote={...blank(),notes:{book:{a:'remote',b:'other device',c:'delete me'}}};
  const pending=[{change:{area:'notes',bookId:'book',key:'a',value:'local'}},{change:{area:'notes',bookId:'book',key:'c',value:null}}];
  assert.deepEqual(plain(sync.cloudMergeState(remote,pending).notes),{book:{a:'local',b:'other device'}});
});

test('initial cached state is not silently uploaded over newer cloud state',async()=>{
  const calls=[],r=runtime({initial:{...blank(),notes:{book:{a:'old device'}}},api:async(path,method)=>{calls.push(method||'GET');return {state:{...blank(),notes:{book:{a:'new cloud',b:'new field'}}}};}});
  await r.sync.initializeCloudSync();
  assert.deepEqual(calls,['GET']);
  assert.deepEqual(plain(r.sync.getState().notes),{book:{a:'new cloud',b:'new field'}});
  assert.equal(r.sync.getPending().length,0);
});

test('edits made during PATCH stay pending until their own acknowledgement',async()=>{
  let resolveFirst;const first=new Promise(resolve=>{resolveFirst=resolve;}),calls=[];
  const r=runtime({api:async(path,method,data)=>{if(data)calls.push(plain(data));if(calls.length===1&&data)return first;return {state:{...blank(),notes:{book:{a:'second',remote:'preserved'}}}};}});
  r.sync.setState({...blank(),notes:{book:{a:'first'}}});r.sync.queueCloudState();
  const syncing=r.sync.initializeCloudSync();
  r.sync.setState({...blank(),notes:{book:{a:'second'}}});r.sync.queueCloudState();
  resolveFirst({state:{...blank(),notes:{book:{a:'first',remote:'preserved'}}}});
  await syncing;
  assert.deepEqual(calls.map(x=>x.changes[0].value),['first','second']);
  assert.deepEqual(plain(r.sync.getState().notes),{book:{a:'second',remote:'preserved'}});
  assert.equal(r.sync.getPending().length,0);
});

test('failed request persists pending writes and a reload restores them',async()=>{
  const r=runtime({api:async()=>{throw Error('offline');}});
  r.sync.setState({...blank(),notes:{book:{a:'offline note'}}});r.sync.queueCloudState();
  await r.sync.initializeCloudSync();
  const saved=JSON.parse(r.storage.get('test-state:cloud-outbox-v1'));
  assert.equal(saved.entries[0].change.value,'offline note');
  assert.match(r.sync.syncLabel(),/cloud sync will retry/);
  const reloaded=runtime({outbox:saved.entries});
  assert.equal(reloaded.sync.getState().notes.book.a,'offline note');
});

test('remote refresh never repaints a focused editor and repeat init has one interval',async()=>{
  let counter=0;
  const r=runtime({focused:true,api:async()=>({state:{...blank(),notes:{book:{remote:String(++counter)}}}})});
  await r.sync.initializeCloudSync();await r.sync.initializeCloudSync();
  assert.equal(r.paints,0);assert.equal(r.intervals,1);assert.equal(counter,2);
});

test('unsafe property names cannot pollute prototypes',()=>{
  const {sync}=runtime(),input=JSON.parse('{"notes":{"__proto__":{"polluted":"yes"},"book":{"constructor":"x","ok":"fine"}}}');
  assert.deepEqual(plain(sync.cloudMergeState(input,[]).notes),{book:{ok:'fine'}});
  assert.equal({}.polluted,undefined);
});

test('unavailable local storage reports session-only pending edits truthfully',async()=>{
  const r=runtime({storageFails:true,api:async()=>{throw Error('offline');}});
  r.sync.setState({...blank(),notes:{book:{a:'session note'}}});r.sync.queueCloudState();
  await r.sync.initializeCloudSync();
  assert.equal(r.sync.syncLabel(),'Unsynced changes in this session');
});

test('refresh requested during PATCH still fetches updates made by an import',async()=>{
  let resolvePatch;const patch=new Promise(resolve=>{resolvePatch=resolve;}),calls=[];
  const r=runtime({api:async(path,method)=>{calls.push(method||'GET');if(method==='PATCH')return patch;return {state:{...blank(),notes:{book:{a:'mine',imported:'from archive'}}}};}});
  r.sync.setState({...blank(),notes:{book:{a:'mine'}}});r.sync.queueCloudState();
  const syncing=r.sync.initializeCloudSync();
  await r.sync.initializeCloudSync();
  resolvePatch({state:{...blank(),notes:{book:{a:'mine'}}}});
  await syncing;
  assert.deepEqual(calls,['PATCH','GET']);
  assert.equal(r.sync.getState().notes.book.imported,'from archive');
});

const savedBookmark=(title='Saved idea')=>JSON.stringify({version:1,kind:'highlight',view:'reader',chapterId:'c1',unitId:'',step:0,title,quote:'A coaching idea.',prefix:'',suffix:'',start:0,end:16,createdAt:'2026-10-12T20:00:00.000Z'});
test('bookmark sync merges concurrent devices and sends only the deleted bookmark',()=>{
  const {sync}=runtime(),a=savedBookmark('Phone'),b=savedBookmark('iPad');
  const before={...blank(),bookmarks:{book:{phone:a,ipad:b}}},after={...blank(),bookmarks:{book:{ipad:b}}};
  const changes=sync.cloudDiffState(before,after);
  assert.deepEqual(plain(changes),[{area:'bookmarks',bookId:'book',key:'phone',value:null}]);
  const remote={...blank(),bookmarks:{book:{phone:a,ipad:b,new:savedBookmark('Other device')}}};
  assert.deepEqual(plain(sync.cloudMergeState(remote,changes).bookmarks),{book:{ipad:b,new:savedBookmark('Other device')}});
});

test('a bookmark deleted while its creation saves stays deleted after acknowledgement and reload',async()=>{
  let resolveFirst;const first=new Promise(resolve=>{resolveFirst=resolve;}),calls=[];
  const value=savedBookmark(),other=savedBookmark('Other device');
  const r=runtime({api:async(path,method,data)=>{
    if(data)calls.push(plain(data));
    if(data&&calls.length===1)return first;
    return {state:{...blank(),bookmarks:{book:{other}}}};
  }});
  r.sync.setState({...blank(),bookmarks:{book:{saved:value}}});r.sync.queueCloudState();
  const syncing=r.sync.initializeCloudSync();
  r.sync.setState(blank());r.sync.queueCloudState();
  const pending=JSON.parse(r.storage.get('test-state:cloud-outbox-v1')).entries;
  assert.equal(pending[0].change.value,null);
  const reloaded=runtime({initial:{...blank(),bookmarks:{book:{saved:value}}},outbox:pending});
  assert.deepEqual(plain(reloaded.sync.getState().bookmarks),{});
  resolveFirst({state:{...blank(),bookmarks:{book:{saved:value,other}}}});
  await syncing;
  assert.deepEqual(calls.map(call=>call.changes[0].value),[value,null]);
  assert.deepEqual(plain(r.sync.getState().bookmarks),{book:{other}});
  assert.equal(r.sync.getPending().length,0);
});

test('cloud refresh preserves a text selection until the user clears it',async()=>{
  const r=runtime({selected:true,api:async()=>({state:{...blank(),bookmarks:{book:{remote:savedBookmark()}}}})});
  await r.sync.initializeCloudSync();
  assert.equal(r.paints,0);
  assert.equal(r.sync.getState().bookmarks.book.remote,savedBookmark());
  r.setSelection(false);r.flushTimers();
  assert.equal(r.paints,1);
});
