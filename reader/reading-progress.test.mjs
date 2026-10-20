import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./reading-progress.js',import.meta.url),'utf8');
const blank=()=>({notes:{},reviewed:{},last:{},checks:{},hiddenBooks:{}});
const book={id:'book-a',chapters:[{id:'c1'},{id:'c2'}]};
const records=[{bookId:book.id,unitId:'u1'},{bookId:book.id,unitId:'u2'}];
function runtime(data=blank()){
  const listeners={},frames=[],timeouts=new Map(),positions=[],dom={meter:{value:0},label:{textContent:''}};
  let saved=0,timer=0;
  const add=(name,fn)=>(listeners[name]??=[]).push(fn);
  const window={scrollY:0,innerHeight:1000,addEventListener:add,scrollTo({top}){this.scrollY=top;positions.push(top);}};
  const document={fonts:{status:'loaded'},visibilityState:'visible',addEventListener:add,querySelectorAll:()=>[]};
  const article={offsetHeight:1700,getBoundingClientRect:()=>({top:300-window.scrollY})};
  const context=vm.createContext({state:data,activeBook:book,guide:{chapterId:'c1'},view:'reader',chapterId:'c1',guideStep:0,step:0,selectedUnit:'u1',window,document,
    bookGuides:()=>records,save(){saved++;},sidebar(){},toast(){},esc:value=>String(value),
    $:selector=>selector==='.reader-article'?article:selector==='[data-reading-position]'?dom.meter:selector==='[data-reading-percent]'?dom.label:null,
    requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>{timeouts.set(++timer,fn);return timer;},clearTimeout:id=>timeouts.delete(id)});
  vm.runInContext(source+`\nthis.progress={key:progressKey,lesson:lessonProgressModel,book:bookProgressModel,visit:visitLesson,position:readingPosition,store:storeReadingPosition,render:progressAfterRender,flush:flushReadingProgress,act:handleReadingProgressAction,record:recordLessonVisit,lessonMarkup:lessonProgress,bookmarkArrival:progressBookmarkArrival,set:(name,value)=>{if(name==='view')view=value;if(name==='chapter')chapterId=value;if(name==='book')activeBook=value;if(name==='unit')selectedUnit=value;if(name==='step')guideStep=value;}};`,context);
  return {progress:context.progress,state:data,positions,dom,window,document,article,get saves(){return saved;},frames(){while(frames.length)frames.shift()();},emit(name,event={}){for(const fn of listeners[name]||[])fn({type:name,...event});},timers(){for(const [id,fn]of timeouts){timeouts.delete(id);fn();}}};
}

test('jumping to the last step records only one visited step and no reviewed lesson',()=>{
  const r=runtime();r.progress.visit(r.state,'book-a','u1',5);
  const result=r.progress.lesson(r.state,'book-a','u1');
  assert.equal(result.count,1);assert.equal(result.reviewed,false);assert.equal(r.progress.book(r.state,book,records).reviewed,0);
  assert.deepEqual(Array.from(result.visited),[false,false,false,false,false,true]);
});
test('visited steps and last position persist separately for each lesson and book',()=>{
  const r=runtime();r.progress.visit(r.state,'book-a','u1',2);r.progress.visit(r.state,'book-a','u2',4);r.progress.visit(r.state,'book-b','u1',1);
  const restored=runtime(JSON.parse(JSON.stringify(r.state)));
  assert.equal(restored.state.last['book-a'][r.progress.key('lesson-step','u1')],2);
  assert.equal(restored.state.last['book-a'][r.progress.key('lesson-step','u2')],4);
  assert.equal(restored.state.last['book-b'][r.progress.key('lesson-step','u1')],1);
  assert.equal(restored.progress.lesson(restored.state,'book-a','u1').count,1);
  assert.equal(r.progress.visit(r.state,'book-a','u1',2),false);
});
test('book counts use explicit true markers and only current distinct lessons/sections',()=>{
  const r=runtime();r.state.checks['book-a']={'lesson:u1':true,'lesson:u2':false,'lesson:removed':true,[r.progress.key('read','c2')]:true,'read:removed':true};
  const count=r.progress.book(r.state,book,[...records,records[0]]);
  assert.equal(count.reviewed,1);assert.equal(count.lessons,2);assert.equal(count.read,1);assert.equal(count.sections,2);
});
test('reading position is bounded, section-specific, JSON compatible and never marks a section read',()=>{
  const r=runtime();r.progress.store(r.state,'book-a','c1',.4276);r.progress.store(r.state,'book-a','c2',2);r.progress.store(r.state,'book-b','c1',.2);
  const data=JSON.parse(JSON.stringify(r.state));
  assert.equal(r.progress.position(data,'book-a','c1'),.428);assert.equal(r.progress.position(data,'book-a','c2'),1);assert.equal(r.progress.position(data,'book-b','c1'),.2);
  assert.equal(r.progress.book(data,book,records).read,0);assert.equal(r.progress.store(r.state,'book-a','c1',NaN),false);
});
test('startup and programmatic scrolling do not create reading progress or completion',()=>{
  const r=runtime();r.progress.render();r.frames();r.window.scrollY=400;r.emit('scroll');r.timers();
  assert.equal(r.saves,0);assert.deepEqual(r.state.last,{});assert.deepEqual(r.state.checks,{});
});
test('late cloud position is restored before intentional reading, then remote updates do not move the reader',()=>{
  const r=runtime();r.progress.render();r.frames();assert.equal(r.window.scrollY,0);
  r.progress.store(r.state,book.id,'c1',.5);r.progress.render();r.frames();assert.equal(r.window.scrollY,800);
  r.emit('wheel');r.window.scrollY=950;r.emit('scroll');r.timers();assert.equal(r.progress.position(r.state,book.id,'c1'),.65);
  r.progress.store(r.state,book.id,'c1',.8);r.progress.render();r.frames();assert.equal(r.window.scrollY,950);
});
test('scroll writes debounce and flush before a section changes, preserving both places',()=>{
  const r=runtime();r.progress.render();r.frames();r.emit('touchmove');r.window.scrollY=550;r.emit('scroll');r.window.scrollY=700;r.emit('scroll');assert.equal(r.saves,0);
  r.progress.flush();assert.equal(r.saves,1);assert.equal(r.progress.position(r.state,book.id,'c1'),.4);
  r.progress.set('chapter','c2');r.progress.render(true);r.frames();assert.equal(r.window.scrollY,0);
  r.emit('wheel');r.window.scrollY=900;r.emit('scroll');r.timers();assert.equal(r.progress.position(r.state,book.id,'c2'),.6);assert.equal(r.progress.position(r.state,book.id,'c1'),.4);
});
test('text-size layout change preserves the live relative reading position without saving a bogus move',()=>{
  const r=runtime();r.progress.store(r.state,book.id,'c1',.4);r.progress.render();r.frames();
  r.emit('ycaro-reading-layout-change');r.article.offsetHeight=2700;r.frames();assert.equal(r.window.scrollY,1100);r.emit('scroll');r.timers();assert.equal(r.saves,0);
});
test('explicit read toggle is reversible and legacy review markers stay separate from visited steps',()=>{
  const r=runtime();r.progress.act('mark-section-read',{});assert.equal(r.progress.book(r.state,book,records).read,1);
  r.progress.act('mark-section-read',{});assert.equal(r.progress.book(r.state,book,records).read,0);
  r.state.reviewed[book.id]='2026-10-12T00:00:00.000Z';assert.equal(r.progress.lesson(r.state,book.id,'legacy:c1',true).reviewed,true);assert.equal(r.progress.lesson(r.state,book.id,'legacy:c1',true).count,0);
});

test('direct lesson routes persist a resumable unit as well as its individual step',()=>{
  const r=runtime();r.progress.set('view','explore');r.progress.set('unit','u2');r.progress.set('step',4);r.progress.record();
  assert.equal(r.state.last[book.id].unit,'u2');assert.equal(r.state.last[book.id].guideStep,4);assert.equal(r.state.last[book.id][r.progress.key('lesson-step','u2')],4);
  assert.equal(r.progress.book(r.state,book,records).reviewed,0);
});

test('long Unicode IDs produce cloud-compatible keys and section saves record the resume chapter',()=>{
  const r=runtime(),id='章'.repeat(500);
  r.progress.visit(r.state,book.id,id,3);r.progress.store(r.state,book.id,id,.75);
  for(const area of ['last','checks'])for(const key of Object.keys(r.state[area][book.id]))assert.ok(key.length<=700);
  assert.equal(r.state.last[book.id].chapter,id);assert.equal(r.progress.position(r.state,book.id,id),.75);
});

test('modal focus and font reflow cannot overwrite reading position, including delayed close scroll',()=>{
  const r=runtime();r.progress.render();r.frames();r.emit('wheel');r.window.scrollY=350;r.emit('scroll');r.timers();
  assert.equal(r.progress.position(r.state,book.id,'c1'),.05);const saved=r.saves;
  r.emit('ycaro-reading-settings-open');r.window.scrollY=0;r.emit('scroll');r.emit('wheel',{target:{closest:()=>({})}});r.timers();
  r.emit('ycaro-reading-layout-change');r.article.offsetHeight=2700;r.frames();assert.equal(r.window.scrollY,400);
  r.window.scrollY=360;r.emit('scroll');r.timers();assert.equal(r.progress.position(r.state,book.id,'c1'),.05);
  r.emit('ycaro-reading-settings-close');r.window.scrollY=0;r.emit('scroll');r.frames();
  assert.equal(r.window.scrollY,400);assert.equal(r.dom.label.textContent,'5%');assert.equal(r.saves,saved);
  r.emit('scroll');r.timers();assert.equal(r.progress.position(r.state,book.id,'c1'),.05);assert.equal(r.saves,saved);
});


test('bookmark arrival supersedes queued resume, late fonts, cloud position and orientation restoration',async()=>{
  const r=runtime();let fontsReady;
  r.document.fonts={status:'loading',ready:new Promise(resolve=>{fontsReady=resolve;})};
  r.progress.store(r.state,book.id,'c1',.2);r.progress.render();
  // A bookmark jump lands before the old resume animation frame has executed.
  r.window.scrollY=900;r.progress.bookmarkArrival();r.frames();
  assert.equal(r.window.scrollY,900);
  assert.equal(r.progress.position(r.state,book.id,'c1'),.6);
  assert.equal(r.dom.meter.value,60);assert.equal(r.dom.label.textContent,'60%');
  assert.equal(r.saves,1);assert.equal(r.progress.book(r.state,book,records).read,0);
  fontsReady();await Promise.resolve();r.frames();
  assert.equal(r.window.scrollY,900,'A late font callback must not restore the old saved position');
  r.progress.store(r.state,book.id,'c1',.1);r.progress.render();r.frames();
  assert.equal(r.window.scrollY,900,'A cloud refresh must not interrupt an intentional bookmark jump');
  assert.equal(r.dom.meter.value,60);
  r.article.offsetHeight=2700;r.emit('resize');r.frames();
  assert.equal(r.window.scrollY,1500,'Orientation changes preserve the bookmark arrival ratio');
});

test('bookmark arrival replaces a pending scroll write and is a no-op outside original reading',()=>{
  const r=runtime();r.progress.render();r.frames();r.emit('wheel');
  r.window.scrollY=400;r.emit('scroll');
  r.window.scrollY=1000;r.progress.bookmarkArrival();r.timers();
  assert.equal(r.progress.position(r.state,book.id,'c1'),.7);
  assert.equal(r.saves,1,'The earlier debounced scroll must not overwrite the bookmark position');
  r.progress.bookmarkArrival();assert.equal(r.saves,1,'Repeated arrival at the same position does not write again');
  r.progress.set('view','explore');r.window.scrollY=300;r.progress.bookmarkArrival();
  assert.equal(r.progress.position(r.state,book.id,'c1'),.7);assert.equal(r.saves,1);
});


test('resize follows a find or selection jump without saving it as intentional reading',()=>{
  const r=runtime();r.progress.store(r.state,book.id,'c1',.2);r.progress.render();r.frames();
  r.window.scrollY=700;r.emit('scroll');r.timers();
  assert.equal(r.dom.label.textContent,'40%','The meter describes the visible location');
  assert.equal(r.saves,0);assert.equal(r.progress.position(r.state,book.id,'c1'),.2);
  r.article.offsetHeight=2700;r.emit('resize');r.frames();
  assert.equal(r.window.scrollY,1100,'The new layout restores the visible ratio rather than the stale saved ratio');
  r.emit('scroll');r.timers();assert.equal(r.saves,0);
  assert.equal(r.progress.position(r.state,book.id,'c1'),.2);assert.equal(r.progress.book(r.state,book,records).read,0);
  r.emit('wheel');r.window.scrollY=1300;r.emit('scroll');r.timers();
  assert.equal(r.saves,1);assert.equal(r.progress.position(r.state,book.id,'c1'),.5,'Subsequent intentional reading still saves normally');
});
test('appearance changes follow an unsaved visible jump while modal scrolling remains excluded',()=>{
  const r=runtime();r.progress.render();r.frames();
  r.window.scrollY=800;r.emit('scroll');
  r.emit('ycaro-reading-settings-open');r.window.scrollY=0;r.emit('scroll');
  r.emit('ycaro-reading-layout-change');r.article.offsetHeight=2700;r.frames();
  r.emit('ycaro-reading-settings-close');r.frames();
  assert.equal(r.window.scrollY,1300);assert.equal(r.dom.label.textContent,'50%');
  r.timers();assert.equal(r.saves,0);assert.deepEqual(r.state.last,{});assert.deepEqual(r.state.checks,{});
});
