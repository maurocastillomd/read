import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const source=await readFile(new URL('./reading-habit.js',import.meta.url),'utf8');
const blank=()=>({last:{},checks:{},hiddenBooks:{}});
const sampleBook={id:'book-a',chapters:[{id:'one',text:'word '.repeat(12000).trim()},{id:'two',text:'word '.repeat(18000).trim()}]};
function runtime({data=blank(),library=[sampleBook],storage=new Map(),start=new Date(2026,9,13,12).getTime()}={}) {
  const listeners={},timers=[],nodes=[],calls=[];let now=start,saves=0,dialog=false;
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const document={visibilityState:'visible',querySelector:()=>dialog?{}:null,querySelectorAll:()=>nodes,getElementById:()=>null,addEventListener:(name,fn)=>(listeners[name]||=[]).push(fn)};
  const context=vm.createContext({Date:Clock,state:data,books:library,activeBook:library[0],view:'reader',STORE:'test',document,
    window:{addEventListener:(name,fn)=>(listeners[name]||=[]).push(fn)},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    save(){saves++;},go:value=>calls.push(value),requestAnimationFrame:fn=>fn(),setInterval:fn=>{timers.push(fn);return timers.length;},esc:value=>String(value).replace(/[<>]/g,'')});
  vm.runInContext(source+`\nthis.habit={day:readingHabitDay,date:readingHabitDate,shift:readingHabitShift,streak:readingHabitStreak,preferences:readingHabitPreferences,words:readingHabitWords,book:readingHabitBookModel,pace:readingHabitPace,intervals:readingHabitActivityIntervals,credit:readingHabitCredit,record:readingHabitActivityRecord,initialize:initializeReadingHabit,tick:readingHabitTick,dashboard:readingHabitDashboard,summary:readingHabitSummary,estimate:readingHabitBookEstimate,afterRender:readingHabitAfterRender,setView:value=>view=value,setBook:value=>activeBook=value};`,context);
  return {habit:context.habit,data,storage,document,calls, get saves(){return saves;},get now(){return now;},set now(value){now=value;},set dialog(value){dialog=value;},
    advance(ms){now+=ms;for(const timer of timers)timer();},emit(name,event={}){for(const handler of listeners[name]||[])handler({type:name,isTrusted:true,...event});}};
}
test('streak deduplicates days across books and remains alive until the following midnight',()=>{
  const r=runtime(),key=day=>'reading-day:'+day;
  r.data.checks.a={[key('2026-10-10')]:true,[key('2026-10-11')]:true,[key('2026-10-12')]:true};
  r.data.checks.b={[key('2026-10-12')]:true,[key('2026-10-09')]:false,'lesson:x':true,'reading-day:2026-02-30':true};
  assert.equal(r.habit.streak(r.data,'2026-10-13').streak,3);
  assert.equal(r.habit.streak(r.data,'2026-10-13').completed,false);
  assert.equal(r.habit.streak(r.data,'2026-10-14').streak,0);
  r.data.checks.b[key('2026-10-13')]=true;
  assert.equal(r.habit.streak(r.data,'2026-10-13').streak,4);
  assert.equal(r.habit.streak(r.data,'2026-10-13').week.filter(day=>day.read).length,4);
});
test('calendar shifts cross both DST changes without skipping or repeating a day',()=>{
  const script=source+`\nfor(const day of ['2026-03-07','2026-03-08','2026-03-09','2026-10-31','2026-11-01','2026-11-02']){const next=readingHabitShift(day,1);if(readingHabitShift(next,-1)!==day)throw Error(day);}if(readingHabitShift('2026-03-08',1)!=='2026-03-09'||readingHabitShift('2026-11-01',1)!=='2026-11-02')throw Error('DST');`;
  const result=spawnSync(process.execPath,['--input-type=commonjs','-e',`const STORE='test';${script}`],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const r=runtime();assert.equal(r.habit.shift('2026-12-31',1),'2027-01-01');assert.equal(r.habit.shift('2024-02-28',1),'2024-02-29');assert.equal(r.habit.date('2026-02-29'),null);
});
test('pace uses actual extracted words and excludes hidden books from its annual average',()=>{
  const second={id:'book-b',chapters:[{id:'one',text:'word '.repeat(60000)}]},r=runtime({library:[sampleBook,second]});
  assert.equal(r.habit.pace().average,45000);assert.equal(r.habit.pace().annual,24);
  r.data.hiddenBooks['book-b']=true;assert.equal(r.habit.pace().average,30000);assert.equal(r.habit.pace().annual,36);
  r.data.last['__reading-habit__']={minutes:30,wordsPerMinute:250};assert.equal(r.habit.pace().annual,91);
  assert.equal(r.habit.pace([],r.data).annual,0);
});
test('book remaining estimate changes only with explicit original-section read markers',()=>{
  const r=runtime();r.data.checks['book-a']={'lesson:one':true,'seen:one:5':true,'read:removed':true};
  assert.equal(r.habit.book(sampleBook).remaining,30000);assert.equal(r.habit.book(sampleBook).days,10);
  r.data.checks['book-a']['read:one']=true;
  assert.equal(r.habit.book(sampleBook).remaining,18000);assert.equal(r.habit.book(sampleBook).days,6);assert.equal(r.habit.book(sampleBook).minutes,90);
  r.data.checks['book-a']['read:two']=true;assert.equal(r.habit.book(sampleBook).complete,true);assert.equal(r.habit.book(sampleBook).days,0);
  r.data.checks['book-a']['read:one']=false;assert.equal(r.habit.book(sampleBook).complete,false);assert.equal(r.habit.book(sampleBook).remaining,12000);
});
test('invalid preferences fall back or clamp to safe meaningful planning assumptions',()=>{
  const r=runtime();r.data.last['__reading-habit__']={minutes:'30',wordsPerMinute:NaN};
  assert.equal(r.habit.preferences().minutes,15);assert.equal(r.habit.preferences().wordsPerMinute,200);
  r.data.last['__reading-habit__']={minutes:500,wordsPerMinute:12};assert.equal(r.habit.preferences().minutes,120);assert.equal(r.habit.preferences().wordsPerMinute,100);
});
test('pace controls persist through the shared save contract and preserve unrelated resume state',()=>{
  const r=runtime();r.habit.initialize();r.data.last['book-a']={chapter:'two'};
  const input={value:'30',dataset:{habitSetting:'minutes'}};r.emit('change',{target:{closest:()=>input}});
  assert.equal(r.data.last['__reading-habit__'].minutes,30);assert.equal(r.saves,1);assert.equal(r.data.last['book-a'].chapter,'two');
  input.value='';r.emit('change',{target:{closest:()=>input}});assert.equal(input.value,'30');assert.equal(r.saves,1);
  input.value='1000';r.emit('change',{target:{closest:()=>input}});assert.equal(input.value,'120');assert.equal(r.saves,2);
});
test('live valid pace updates immediately while partial typing waits for commit',()=>{
  const r=runtime();r.habit.initialize();const input={value:'30',dataset:{habitSetting:'minutes'}},target={closest:()=>input};
  r.emit('input',{target});assert.equal(r.data.last['__reading-habit__'].minutes,30);assert.equal(r.saves,1);assert.equal(r.habit.pace().annual,73);
  r.emit('change',{target});assert.equal(r.saves,1,'Committing an unchanged valid value does not save twice');
  input.value='3';r.emit('input',{target});assert.equal(input.value,'3');assert.equal(r.data.last['__reading-habit__'].minutes,30);assert.equal(r.saves,1);
  input.value='';r.emit('input',{target});assert.equal(input.value,'');assert.equal(r.saves,1);
  input.value='3';r.emit('change',{target});assert.equal(input.value,'5');assert.equal(r.data.last['__reading-habit__'].minutes,5);assert.equal(r.saves,2);
});
test('opening the app and programmatic scrolling do not create a reading day',()=>{
  const r=runtime();r.habit.initialize();r.habit.initialize();for(let i=0;i<20;i++)r.advance(5000);
  assert.deepEqual(r.data.checks,{});assert.equal(r.saves,0);
  r.emit('pointerdown',{isTrusted:false});for(let i=0;i<20;i++)r.advance(5000);assert.deepEqual(r.data.checks,{});
  r.emit('pointerdown');for(let i=0;i<11;i++)r.advance(5000);assert.deepEqual(r.data.checks,{});
  r.advance(5000);assert.equal(r.data.checks['book-a']['reading-day:2026-10-13'],true);assert.equal(r.saves,1);
  for(let i=0;i<30;i++)r.advance(5000);assert.equal(r.saves,1);
});
test('active time persists across reload without counting the closed interval',()=>{
  const r=runtime();r.habit.initialize();r.emit('keydown');for(let i=0;i<6;i++)r.advance(5000);
  const second=runtime({data:r.data,storage:r.storage,start:r.now+3600000});second.habit.initialize();
  for(let i=0;i<10;i++)second.advance(5000);assert.equal(second.saves,0);
  second.emit('pointerdown');for(let i=0;i<6;i++)second.advance(5000);
  assert.equal(second.data.checks['book-a']['reading-day:2026-10-13'],true);assert.equal(second.saves,1);
});
test('hidden, library and open-dialog intervals never earn credit',()=>{
  const r=runtime();r.habit.initialize();r.emit('pointerdown');r.advance(10000);
  r.document.visibilityState='hidden';r.emit('visibilitychange');for(let i=0;i<10;i++)r.advance(5000);
  r.document.visibilityState='visible';r.emit('visibilitychange');r.emit('pointerdown');r.habit.setView('library');r.habit.afterRender();for(let i=0;i<10;i++)r.advance(5000);
  r.habit.setView('reader');r.habit.afterRender();r.dialog=true;for(let i=0;i<10;i++)r.advance(5000);
  assert.equal(r.saves,0);const value=JSON.parse(r.storage.get('test:reading-activity-v1'));assert.equal(value.seconds,10);
  r.dialog=false;r.emit('pointerdown');for(let i=0;i<10;i++)r.advance(5000);assert.equal(r.saves,1);
});
test('idle cutoff, timer gaps and backward clocks do not inflate activity',()=>{
  const r=runtime(),at=new Date(2026,9,13,12).getTime();
  const sample={at:at+118000,interactedAt:at,eligible:true,bookId:'a'};
  assert.equal(r.habit.intervals(sample,at+123000)[0].seconds,2);
  assert.equal(r.habit.intervals({...sample,at:at+125000},at+130000).length,0);
  assert.equal(r.habit.intervals({...sample,at},at+60000).length,0);
  assert.equal(r.habit.intervals({...sample,at},at-1000).length,0);
});
test('a blurred app waits for another interaction before crediting reading again',()=>{
  const r=runtime();r.habit.initialize();r.emit('pointerdown');for(let i=0;i<6;i++)r.advance(5000);
  r.emit('blur');for(let i=0;i<6;i++)r.advance(5000);r.emit('focus');for(let i=0;i<6;i++)r.advance(5000);assert.equal(r.saves,0);
  r.emit('wheel');for(let i=0;i<6;i++)r.advance(5000);assert.equal(r.saves,1);
});
test('an interval crossing local midnight credits each date separately',()=>{
  const r=runtime(),at=new Date(2026,9,13,23,59,58).getTime();
  const intervals=r.habit.intervals({at,interactedAt:at,eligible:true,bookId:'a'},at+5000);
  assert.equal(intervals.length,2);assert.equal(intervals[0].day,'2026-10-13');assert.equal(intervals[0].seconds,2);assert.equal(intervals[1].day,'2026-10-14');assert.equal(intervals[1].seconds,3);
  const old=r.habit.record({version:1,day:'2026-10-13',seconds:59,through:at},'2026-10-13');
  assert.equal(r.habit.credit(old,intervals[0]).seconds,60);
  assert.equal(r.habit.credit(old,intervals[1]).seconds,3);
});
test('overlapping tab intervals count time once while separate reading sessions accumulate',()=>{
  const r=runtime(),at=r.now,first={day:'2026-10-13',start:at,end:at+10000};
  const one=r.habit.credit(null,first),duplicate=r.habit.credit(one,first);assert.equal(one.seconds,10);assert.equal(duplicate.seconds,10);
  const overlap=r.habit.credit(duplicate,{...first,start:at+5000,end:at+15000});assert.equal(overlap.seconds,15);
  const separate=r.habit.credit(overlap,{...first,start:at+30000,end:at+35000});assert.equal(separate.seconds,20);
});
test('empty history stays honest in dashboard and does not infer activity from old lesson progress',()=>{
  const r=runtime();r.data.checks['book-a']={'lesson:one':true};
  const html=r.habit.dashboard();assert.match(html,/Read for one active minute/);assert.match(html,/Tracking starts now/);assert.match(html,/planning estimate, not a measured reading speed/);
  assert.match(r.habit.summary(),/0 days in a row/);assert.match(r.habit.estimate(sampleBook),/30,000 extracted words/);
});
