import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const role=await readFile(new URL('./role-context.js',import.meta.url),'utf8');
const studio=await readFile(new URL('./studio-icons.js',import.meta.url),'utf8');
const source=await readFile(new URL('./lesson-lab.js',import.meta.url),'utf8');
const generationUI=await readFile(new URL('./generation-ui.js',import.meta.url),'utf8');
const chapterJourney=await readFile(new URL('./chapter-journey.js',import.meta.url),'utf8');
// The open version bundles no books: every lesson below is an invented fixture.
const kinds=['handoff','loop','capacity','decision','layers','compass','release','network'];
function syntheticEntry(id,count){
  const book={id,title:'Invented book '+id,author:'Example Author',chapters:Array.from({length:count},(_,i)=>({id:'chapter-'+(i+1),title:'Chapter '+(i+1),text:'Source text '+(i+1)+'.'}))};
  const guides=book.chapters.map((chapter,i)=>({bookId:id,unitId:chapter.id+':u1',chapterId:chapter.id,guide:{
    title:'Lesson '+(i+1),gist:'The chapter argues that small routines shape a week, step '+(i+1)+'.',
    concepts:[1,2,3].map(n=>({title:'Idea '+(i+1)+'.'+n,explanation:'The author develops idea '+n+' in this chapter.',sourceRefs:[{paragraphId:'p1',quote:'Source text '+(i+1)}]})),
    principles:[{title:'Principle '+(i+1),explanation:'Routines persist when their cues stay the same.',origin:'author',sourceRefs:[{paragraphId:'p1',quote:'Source text '+(i+1)}]}],
    analogy:{familiarSituation:'Fictional example: a teacher rearranges a classroom.',mapping:'The room layout is like the cue.',limit:'A classroom is simpler than a habit.'},
    flow:{kind:'sequence',caption:'Arrows show the order of the argument.',nodes:[{id:'n1',label:'Cue',detail:'Something starts the routine.'},{id:'n2',label:'Action',detail:'The routine runs.'},{id:'n3',label:'Reward',detail:'The routine pays off.'}],edges:[{from:'n1',to:'n2',label:'starts'},{from:'n2',to:'n3',label:'leads to'}],limit:'A simplified map.'},
    application:{scenario:'Fictional example: a team lead reviews a weekly routine.',steps:['Name the cue.','Check what the routine rewards.']},
    recall:[{question:'What starts a routine?',answer:'A cue.'},{question:'What keeps it going?',answer:'Its surroundings.'}],
    mnemonic:{cue:'CUE · ACT · PAY',meaning:'Cue, action and reward.',items:[{letter:'CUE',meaning:'What starts it.'},{letter:'ACT',meaning:'What happens.'}],caution:'Leaves out the qualifications.'},
    chapterVisual:{kind:kinds[i%kinds.length],title:'Routine picture '+(i+1),caption:'Companion image of chapter '+(i+1)+'.',labels:['Cue '+(i+1),'Action '+(i+1),'Reward '+(i+1)]},
    learningPath:{previous:'Before this.',current:'This section asks one question.',next:'Next comes more.',thread:'Fictional thread: a team lead follows one routine.'},
    cautions:[],
  }}));
  return {book,guides};
}
const seed=syntheticEntry('synthetic-a',8),systems=syntheticEntry('synthetic-b',4);
const entries=[seed,systems],all=entries.flatMap(entry=>entry.guides);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=value=>JSON.parse(JSON.stringify(value));
const fixture={visual:{kind:'reservoir',caption:'What accumulates changes with net flow.'},mnemonic:{cue:'IN − OUT',meaning:'Compare both flows.',items:[{letter:'IN',meaning:'What enters.'},{letter:'OUT',meaning:'What leaves.'}],caution:'A companion memory cue.'},prediction:{question:'With equal flows, what happens to the stock?',choices:[{label:'It stays level.',feedback:'Equal flows produce no net change.'},{label:'It must be empty.',feedback:'A steady level can be high or low.'}],correctIndex:0}};
// Prepared enrichment names a toy model per lesson; a visual metaphor alone never starts one.
const unit=chapter=>systems.guides.find(g=>g.chapterId===chapter).unitId;
const actualEnrichment={[systems.book.id]:{[unit('chapter-1')]:{simulator:'reservoir'},[unit('chapter-2')]:{simulator:'feedback'},[unit('chapter-3')]:{simulator:'attention'},[unit('chapter-4')]:{visual:{kind:'feedback',caption:'A loop metaphor only.'}}}};

function runtime(enrichment=actualEnrichment){
  const listeners={},dom={addEventListener(type,listener){listeners[type]=listener;}},context=vm.createContext({
    lessonEnrichment:enrichment,activeBook:seed.book,esc:escape,note:()=>'',
    refs:()=>'<button type="button" data-action="source">Check passage</button>',
    document:dom,
  });
  vm.runInContext(role+'\nsetCoordinatorExamples(true);\n'+studio+'\n'+source+'\n'+chapterJourney+`\nthis.lab={refresh:labRefresh,render:renderLessonLab,act:handleLessonLabAction,input:handleLessonLabInput,session:labSession,key:labKey,illustration:labIllustration,memory:labMemory,prediction:labPrediction,feedback:labFeedbackResult,artwork:chapterArtwork,setBook:v=>{activeBook=v;}};`,context);
  const lab=context.lab;
  return {lab,context,listeners,dom,click(rec,action,data={}){lab.session(rec);const section={dataset:{lessonLab:lab.key(rec)},isConnected:false};return lab.act(action,{dataset:{action,...data},closest:()=>section});}};
}
function assertMarkup(html){
  assert.doesNotMatch(html,/\b(?:undefined|NaN)\b/);
  const voidTags=new Set(['input','br','hr','img','meta','link','source','wbr']),stack=[];
  for(const match of html.matchAll(/<(\/?)([a-z][\w:-]*)\b[^>]*>/gi)){
    const [tag,close,nameRaw]=match,name=nameRaw.toLowerCase();
    if(close)assert.equal(stack.pop(),name,`Closing ${name} must match the open element in ${html.slice(Math.max(0,match.index-80),match.index+80)}`);
    else if(!voidTags.has(name)&&!tag.endsWith('/>'))stack.push(name);
  }
  assert.equal(stack.length,0,`Unclosed elements ${stack.join(',')}`);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'IDs are unique within a learning activity');
  for(const match of html.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g))for(const id of match[1].split(' '))assert.ok(ids.includes(id),`Accessible reference ${id} exists`);
  assert.doesNotMatch(html,/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/,'Interactive controls are never nested');
}

test('every synthetic guide renders every learning stage with balanced markup and accessible references',()=>{
  assert.equal(all.length,12);
  const {lab}=runtime();
  for(const entry of entries){
    lab.setBook(entry.book);
    for(const rec of entry.guides)for(const stage of ['idea','analogy','flow','apply','recall']){
      const html=lab.render(rec,stage);assert.ok(html.includes('data-lesson-lab='));assertMarkup(html);
      if(stage==='idea'){assert.match(html,/<svg class="chapter-art /);assert.doesNotMatch(html,/story-scenes|scene-reveals/);}
      if(stage==='recall')assert.doesNotMatch(html,/<textarea|data-note=/);
    }
  }
});
test('each illustration family has a named SVG and valid marker references',()=>{
  const {lab}=runtime(),rec=systems.guides[0];
  for(const kind of ['reservoir','capacity','feedback','iceberg','leverage','garden','release','compass','attention','connections']){
    const html=lab.illustration(rec,kind,'A diagram to explore.');assertMarkup(html);
    for(const marker of html.matchAll(/marker-end="url\(#([^)]+)\)"/g))assert.ok(html.includes(`id="${marker[1]}"`));
  }
});
test('simulations are tied to prepared lesson enrichment, never selected only from a metaphor kind',()=>{
  const {lab}=runtime();
  for(const [chapter,kind] of [['chapter-1','reservoir'],['chapter-2','feedback'],['chapter-3','attention']]){
    const html=lab.render(systems.guides.find(g=>g.chapterId===chapter),'flow');assert.ok(html.includes(`data-lab-simulator="${kind}"`));
  }
  const metaphorOnly=lab.render(systems.guides.find(g=>g.chapterId==='chapter-4'),'flow');assert.doesNotMatch(metaphorOnly,/data-lab-simulator=/);assert.match(metaphorOnly,/lab-connected-flow/);
  const unprepared=lab.render(seed.guides[0],'flow');assert.doesNotMatch(unprepared,/data-lab-simulator=/);assert.match(unprepared,/lab-connected-flow/);
  const otherBook={...systems.guides[0],bookId:'another-book'};assert.doesNotMatch(lab.render(otherBook,'flow'),/data-lab-simulator=/,'A book id alone never selects a model');
});
test('new-book fallback shows the selected concepts without inventing flow relationships',()=>{
  const {lab}=runtime({}),rec=structuredClone(systems.guides[0]);
  rec.guide.concepts=[{title:'Concept alpha'},{title:'Concept beta'},{title:'Concept gamma'},{title:'Concept delta'}];
  rec.guide.flow.nodes=[{id:'x',label:'Wrong flow label'}];
  const html=lab.illustration(rec,'connections','A concept overview.');
  assert.match(html,/Concept alpha/);assert.doesNotMatch(html,/Wrong flow label|marker-end=/);
  lab.session(rec).concept=3;const next=lab.illustration(rec,'connections','A concept overview.');
  assert.match(next,/Concept delta/);assert.doesNotMatch(next,/Concept alpha/);assertMarkup(next);
});
test('stock changes by net flow; equal flows preserve stock and physical boundaries hold',()=>{
  const r=runtime(),rec=systems.guides[1],s=r.lab.session(rec);
  s.inflow=6;s.outflow=4;r.click(rec,'lab-tank-step',{count:'10'});assert.equal(s.level,70);assert.equal(s.history.length,11);
  s.inflow=7;s.outflow=7;r.click(rec,'lab-tank-step',{count:'10'});assert.equal(s.level,70);
  s.inflow=12;s.outflow=0;r.click(rec,'lab-tank-step',{count:'10'});assert.equal(s.level,100);
  s.inflow=0;s.outflow=12;r.click(rec,'lab-tank-step',{count:'10'});assert.equal(s.level,0);
  assert.ok(s.history.every(n=>n>=0&&n<=100));
  r.click(rec,'lab-tank-reset');assert.equal(s.level,50);assert.deepEqual(plain(s.history),[50]);
});
test('balancing feedback approaches its target without delay; delayed observations can overshoot',()=>{
  const r=runtime(),rec=systems.guides[2],s=r.lab.session(rec);
  s.gain=80;s.delay=0;r.click(rec,'lab-loop-step',{count:'12'});
  assert.ok(Math.abs(s.feedback-50)<.001);assert.ok(s.feedbackHistory.every(n=>n<=50));
  r.click(rec,'lab-loop-reset');s.delay=3;r.click(rec,'lab-loop-step',{count:'12'});
  assert.ok(s.feedbackHistory.some(n=>n>50),'Delayed correction overshoots the same target');
  assert.ok(s.feedbackHistory.every(n=>n>=0&&n<=100));
});
test('reinforcing feedback compounds from the level and reset keeps the chosen parameters',()=>{
  const r=runtime(),rec=systems.guides[2],s=r.lab.session(rec);
  r.click(rec,'lab-loop-mode',{mode:'reinforce'});s.gain=100;s.delay=0;
  r.click(rec,'lab-loop-step',{count:'1'});assert.equal(s.feedback,22);
  r.click(rec,'lab-loop-step',{count:'1'});assert.ok(Math.abs(s.feedback-24.2)<1e-9);
  r.click(rec,'lab-loop-reset');assert.equal(s.feedback,20);assert.equal(s.gain,100);assert.equal(s.mode,'reinforce');
  assert.match(r.lab.feedback(rec,s),/10\.0%/);
});
test('model and quiz state remain isolated between books and units',()=>{
  const r=runtime(),first=systems.guides[0],second=systems.guides[1];
  r.click(first,'lab-tank-step',{count:'10'});r.click(first,'lab-memory');
  assert.equal(r.lab.session(first).level,70);assert.equal(r.lab.session(second).level,50);
  assert.equal(r.lab.session(first).memory,true);assert.equal(r.lab.session(second).memory,false);
  const other={...first,bookId:'another-book'};assert.equal(r.lab.session(other).level,50);
});
test('prepared predictions reveal feedback only after a choice; unprepared guides never invent scored answers',()=>{
  const rec=systems.guides[0],enrichment={[rec.bookId]:{[rec.unitId]:fixture}},r=runtime(enrichment);
  assert.doesNotMatch(r.lab.render(rec,'apply'),/Equal flows produce no net change\./);
  r.click(rec,'lab-predict',{index:'0'});assert.match(r.lab.render(rec,'apply'),/Equal flows produce no net change\./);
  assert.match(r.lab.render(rec,'apply'),/That fits the idea/);
  r.click(rec,'lab-retry');assert.equal(r.lab.session(rec).answer,null);
  const unprepared=runtime({}),html=unprepared.lab.render(rec,'apply');
  assert.match(html,/Make a prediction/);assert.doesNotMatch(html,/data-action="lab-predict"|That fits the idea/);
  const invalid=runtime({[rec.bookId]:{[rec.unitId]:{...fixture,prediction:{...fixture.prediction,correctIndex:8}}}});
  assert.doesNotMatch(invalid.lab.render(rec,'apply'),/data-action="lab-predict"/);
});
test('memory cards reveal their meaning and preserve accessible hidden state',()=>{
  const rec=systems.guides[0],r=runtime({[rec.bookId]:{[rec.unitId]:fixture}});
  const closed=r.lab.render(rec,'recall');assert.match(closed,/aria-expanded="false"/);assert.match(closed,/hidden class="lab-memory-back"/);
  r.click(rec,'lab-memory');const open=r.lab.render(rec,'recall');assert.match(open,/aria-expanded="true"/);assert.doesNotMatch(open,/hidden class="lab-memory-back"/);assertMarkup(open);
});
test('new EPUB guides use their generated mnemonic in the reveal card without prepared enrichment',()=>{
  const rec=structuredClone(systems.guides[0]);rec.bookId='new-epub';rec.guide.mnemonic=structuredClone(fixture.mnemonic);
  const r=runtime({}),closed=r.lab.render(rec,'recall');
  assert.match(closed,/IN − OUT/);assert.match(closed,/Compare both flows/);
  assert.match(closed,/What enters/);assert.match(closed,/What leaves/);
  assert.match(closed,/A companion memory cue/);assert.doesNotMatch(closed,/Picture a familiar decision/);
  assert.match(closed,/aria-expanded="false"/);assertMarkup(closed);
  r.click(rec,'lab-memory');assert.match(r.lab.render(rec,'recall'),/aria-expanded="true"/);
  delete rec.guide.mnemonic;
  assert.match(r.lab.render(rec,'recall'),/Recall how the chapter’s main ideas connect/,'Legacy guides still offer a neutral cue card without typing');
});
test('canonical guide memory aids replace stale enrichment while legacy guides retain enrichment',()=>{
  const rec=structuredClone(systems.guides[0]);rec.guide.mnemonic={...fixture.mnemonic,cue:'Current leadership cue',meaning:'Current guide meaning.'};
  const r=runtime({[rec.bookId]:{[rec.unitId]:fixture}}),html=r.lab.render(rec,'recall');
  assert.match(html,/Current leadership cue/);assert.match(html,/Current guide meaning/);assert.doesNotMatch(html,/IN − OUT|Compare both flows/);
  delete rec.guide.mnemonic;
  const legacy=r.lab.render(rec,'recall');assert.match(legacy,/IN − OUT/);assert.match(legacy,/Compare both flows/);assert.doesNotMatch(legacy,/Current leadership cue/);
});
test('generated mnemonic text is escaped in both memory cards and chapter previews',()=>{
  const rec=structuredClone(systems.guides[0]);rec.bookId='new-epub';rec.guide.mnemonic={
    cue:'<img src=x onerror=alert(1)>',meaning:'<script>alert(2)</script>',
    items:[{letter:'<svg onload=alert(3)>',meaning:'<iframe src=x></iframe>'}],caution:'<button onclick=alert(4)>Caution</button>',
  };
  const html=runtime({}).lab.render(rec,'recall');assertMarkup(html);
  assert.doesNotMatch(html,/<img src=x|<script>|<svg onload|<iframe|<button onclick/);
  for(const escaped of ['&lt;img','&lt;script&gt;','&lt;svg','&lt;iframe','&lt;button'])assert.ok(html.includes(escaped));
  const context=vm.createContext({lessonEnrichment:{},activeBook:seed.book,esc:escape,short:t=>t,bookIllustration:()=>'',document:{addEventListener(){}}});
  vm.runInContext(role+'\nsetCoordinatorExamples(true);\n'+studio+'\n'+source+'\n'+chapterJourney+'\n'+generationUI+'\nthis.preview=chapterPreview;',context);
  const preview=context.preview(rec);assert.match(preview,/Remember: &lt;img/);assert.doesNotMatch(preview,/<img src=x/);assertMarkup(preview);
  delete rec.guide.mnemonic;assert.match(context.preview(rec),new RegExp(escape(rec.guide.gist).slice(0,20).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('untrusted guide text is escaped in concept captions, labels and data attributes',()=>{
  const rec=structuredClone(systems.guides[0]);rec.unitId='bad" onmouseover="alert(1)';rec.guide.concepts[0].title='<img src=x onerror=alert(1)>';delete rec.guide.chapterVisual;
  rec.guide.learningPath.current='<script>alert(1)</script>';
  const enrichment={[rec.bookId]:{[rec.unitId]:{...fixture,visual:{kind:'reservoir',caption:'<script>alert(1)</script>'}}}},r=runtime(enrichment);
  const html=r.lab.render(rec,'idea');assertMarkup(html);assert.doesNotMatch(html,/<script>|<img src=x|data-lesson-lab="[^"]*" onmouseover=/);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img src=x/);
});
test('range input updates its result without replacing the focused slider and ignores invalid values',()=>{
  const r=runtime(),rec=systems.guides[1],s=r.lab.session(rec),result={innerHTML:''},output={textContent:''};
  const section={dataset:{lessonLab:r.lab.key(rec)},querySelector(selector){return selector==='[data-lab-result]'?result:selector==='[data-lab-simulator]'?{dataset:{labSimulator:'reservoir'}}:output;}};
  const el={dataset:{labControl:'inflow'},value:'12',closest:()=>section};
  assert.equal(r.lab.input(el),true);assert.equal(s.inflow,12);assert.equal(output.textContent,'12');assert.match(result.innerHTML,/Requested net flow/);
  el.value='oops';r.lab.input(el);assert.equal(s.inflow,12);
  el.value='1000';r.lab.input(el);assert.equal(s.inflow,12);
  assert.equal(r.lab.input({dataset:{}}),false);
});
test('rerender restores focus to the same run button, including its step count',()=>{
  const r=runtime(),rec=systems.guides[1];let focused=null,replaced=false;
  const buttons=['1','10'].map(count=>({dataset:{action:'lab-tank-step',count},focus(){focused=count;}}));
  const next={querySelectorAll:()=>buttons},section={isConnected:true,dataset:{labStage:'flow'},replaceWith(value){assert.equal(value,next);replaced=true;}};
  r.dom.createElement=()=>({firstElementChild:next});
  r.lab.refresh(section,rec,{dataset:{action:'lab-tank-step',count:'10'}});
  assert.equal(replaced,true);assert.equal(focused,'10');
});

test('interactive numeric models use fictional everyday resource decisions with explicit limits',()=>{
  const {lab}=runtime();
  const inventory=lab.render(systems.guides.find(g=>g.chapterId==='chapter-1'),'flow');
  assert.match(inventory,/Items returned \/ round/);assert.match(inventory,/Fictional example: a team lead reviews a shared supply shelf/);
  assert.match(inventory,/not a model of anyone’s energy, health, or wellbeing/);
  const feedbackRec=systems.guides.find(g=>g.chapterId==='chapter-2');
  const balance=lab.render(feedbackRec,'flow');
  assert.match(balance,/A fictional team lead reviews the shared-supply process/);assert.match(balance,/These equations are not forecasts for any real person or organization/);
  lab.session(feedbackRec).mode='reinforce';
  assert.match(lab.render(feedbackRec,'flow'),/A fictional community organizer opens a workshop/);
  const attention=lab.render(systems.guides.find(g=>g.chapterId==='chapter-3'),'flow');
  assert.match(attention,/A fictional reflection exercise, not a model of mental health/);
  for(const html of [inventory,balance,attention])assert.doesNotMatch(html,/coordinator|athlete|baseball|S&C|staff|department|bibs/i);
});
test('simulations stay hidden while real-life examples are off',()=>{
  const {lab,context}=runtime();vm.runInContext('setCoordinatorExamples(false);',context);
  for(const chapter of ['chapter-1','chapter-2','chapter-3'])assert.doesNotMatch(lab.render(systems.guides.find(g=>g.chapterId===chapter),'flow'),/data-lab-simulator=/);
});

test('every chapter retains its own accessible concept graphics and thumbnails',()=>{
  const {lab}=runtime();
  const html=all.map(rec=>lab.artwork(rec)+lab.artwork(rec,true)).join('');
  assertMarkup(html);
  assert.equal([...html.matchAll(/<svg\b/g)].length,all.length*2);
  assert.doesNotMatch(html,/<img\b|story-scenes|scene-reveals/);
  for(const rec of all){
    const visual=rec.guide.chapterVisual;
    const image=lab.artwork(rec),thumbnail=lab.artwork(rec,true);
    for(const output of [image,thumbnail]){
      assert.match(output,/role="img" aria-labelledby="[^"<>]+"/);
      assert.ok(output.includes(escape(visual.title)),'The graphic is named for this chapter');
      assert.ok(output.includes(escape(visual.caption)),'The description explains this chapter’s relationship');
      for(const label of visual.labels)assert.ok(output.includes(escape(label)),'Every chapter label is available to assistive technology');
      for(const marker of output.matchAll(/marker-end="url\(#([^)]+)\)"/g))assert.ok(output.includes(`id="${marker[1]}"`));
    }
    assert.match(thumbnail,/class="chapter-thumb-title"/);
  }
});
test('newly generated guides use their own concept structure and labels with no raster scene dependency',()=>{
  const {lab}=runtime(),rec=structuredClone(systems.guides[0]);
  rec.bookId='new-article';rec.unitId='study-design';
  for(const kind of ['handoff','loop','capacity','decision','layers','compass','release','network']){
    rec.guide.chapterVisual={kind,title:'What the comparison can tell us',caption:'Companion image: follow the relationship, then inspect the source.',labels:['Training groups','Group difference','Uncertainty']};
    const html=lab.artwork(rec);assertMarkup(html);
    assert.match(html,/What the comparison can tell us/);assert.match(html,/Training groups/);assert.match(html,/Group difference/);assert.match(html,/Uncertainty/);
    assert.doesNotMatch(html,/<img\b|story-scenes|Notice the moment/);
  }
});
test('concept rendering escapes generated text and supports legacy guides without inventing causal arrows',()=>{
  const {lab}=runtime(),rec=structuredClone(systems.guides[0]);
  rec.bookId='book" onload="alert(1)';rec.unitId='unit"><script>alert(2)</script>';
  rec.guide.title='<img src=x onerror=alert(3)>';
  rec.guide.chapterVisual={kind:'network',title:'<script>image title</script>',caption:'<iframe src=x>Caption & context</iframe>',labels:['<svg/onload=alert(4)>','Two','Three']};
  for(const thumbnail of [false,true]){
    const html=lab.artwork(rec,thumbnail);assertMarkup(html);
    assert.doesNotMatch(html,/<img src=x|<script>|<iframe|<svg\/onload|" onload=/);
    for(const escaped of ['&lt;script&gt;','&lt;iframe','&lt;svg/','Caption &amp; context'])assert.ok(html.includes(escaped),`Escaped concept text is present: ${escaped}`);
  }
  delete rec.guide.chapterVisual;delete rec.guide.learningPath;delete rec.guide.mnemonic;
  for(const count of [1,2,3]){
    rec.guide.concepts=Array.from({length:count},(_,i)=>({title:'Legacy concept '+(i+1)}));
    const legacy=lab.artwork(rec);assertMarkup(legacy);
    assert.match(legacy,/Companion concept overview/);assert.match(legacy,/Legacy concept 1/);
    assert.doesNotMatch(legacy,/marker-end=|story-scenes/);
    assert.equal([...legacy.matchAll(/class="chapter-art-node /g)].length,count);
  }
});
