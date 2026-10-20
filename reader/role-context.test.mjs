import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const role=read('./role-context.js'),studio=read('./studio-icons.js'),lab=read('./lesson-lab.js'),journey=read('./chapter-journey.js'),practice=read('./chapter-practice.js');
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// An invented book: the open version bundles none, so every lesson here is synthetic.
const book={id:'synthetic-book',title:'An Invented Book',author:'Example Author',chapters:[1,2,3].map(n=>({id:'chapter-'+n,title:'Chapter '+n,text:'Source text for chapter '+n+'.'}))};
function lesson(n,{examples=true}={}){
 const ref={paragraphId:'p1',quote:'Source text for chapter '+n};
 const tail=examples?'\n\nFictional example: a teacher applies this to a weekly lesson plan.':'';
 return {bookId:book.id,unitId:'chapter-'+n+':u1',chapterId:'chapter-'+n,guide:{
  title:'Lesson '+n,
  gist:'The author argues that small routines shape a week.'+(examples?' Real-life example: a nurse reorganizes a shift handoff.':''),
  concepts:[1,2,3].map(i=>({title:'Concept '+n+'.'+i,explanation:'The author explains idea '+i+' of chapter '+n+'.'+tail,sourceRefs:[ref]})),
  principles:[{title:'Principle '+n,explanation:'Routines persist when their cues stay the same.'+tail,origin:'author',sourceRefs:[ref]}],
  analogy:{familiarSituation:'Fictional example: a small-business owner rearranges a shop.',mapping:'The shop layout is like the cue.',limit:'A shop is simpler than a habit.'},
  flow:{kind:'sequence',caption:'Arrows show the order of the argument.',nodes:[{id:'n1',label:'Cue',detail:'Something starts the routine.'},{id:'n2',label:'Action',detail:examples?'In the fictional example, the team lead acts.':'The routine runs.'},{id:'n3',label:'Reward',detail:'The routine pays off.'}],edges:[{from:'n1',to:'n2',label:'starts'},{from:'n2',to:'n3',label:'leads to'}],limit:'A simplified map.'},
  application:{scenario:'Fictional example: a team lead reviews a weekly routine.',steps:['Name the cue.','Check what the routine rewards.']},
  recall:[{question:'What starts a routine?',answer:'A cue.'},{question:examples?'How would this change your work?':'What keeps a routine going?',answer:'Its surroundings.'}],
  mnemonic:{cue:'CUE · ACT · PAY',meaning:'Cue, action and reward.',items:[{letter:'CUE',meaning:'What starts it.'},{letter:'ACT',meaning:'What happens.'},...(examples?[{letter:'USE',meaning:'Fictional example: a teacher moves the timetable.'}]:[])],caution:'Leaves out the qualifications.'},
  chapterVisual:{kind:'loop',title:'A routine loop',caption:'Companion image of the cue, action and reward.',labels:['Cue','Action','Reward']},
  learningPath:{previous:'Before this.',current:'This section asks one question.',next:'Next comes more.',thread:'Fictional thread: a team lead follows one routine across the book.'},
  cautions:['Only one chapter.','The fictional story is an illustration, not the author’s claim.'],
 }};
}
const guides=[1,2,3].map(n=>lesson(n));

function runtime(values=new Map()){
 const listeners={},writes=[],frames=[],state={checks:{}},notes={'chapter-2:u1 / My application':'My existing note.'};let rendered=0,focus=0;
 const ctx=vm.createContext({
  activeBook:book,state,selectedUnit:guides[1].unitId,lessonEnrichment:{},esc:escape,note:key=>notes[key]||'',
  localStorage:{getItem:k=>values.get(k)||null,setItem(k,v){values.set(k,v);writes.push([k,v]);}},
  document:{addEventListener(type,fn){(listeners[type]??=[]).push(fn);},querySelector(){return{focus(){focus++;}};}},
  window:{scrollY:450,scrollTo(){}},requestAnimationFrame:fn=>frames.push(fn),render(){rendered++;},
  refs:()=>'<button data-action="source">Check passage</button>',bookGuides:()=>guides,articleStatisticsLab:()=>'',
 });
 vm.runInContext(role+'\n'+studio+'\n'+lab+'\n'+journey+'\n'+practice+'\nthis.h={on:coordinatorExamplesEnabled,set:setCoordinatorExamples,toggle:coordinatorExamplesToggle,notice:coordinatorExamplesNotice,guide:roleContextGuide,text:roleContextText,lab:renderLessonLab,story:chapterConnection,cards:practiceCards,practice:chapterPractice,session:practiceSession,article:articleAnalysis,setBook:b=>{activeBook=b;}};',ctx);
 return{h:ctx.h,ctx,values,writes,notes,state,get renders(){return rendered;},get focused(){return focus;},clickToggle(){listeners.click[0]({target:{closest:()=>({})}});frames.splice(0).forEach(fn=>fn());}};
}
test('real-life examples default off, opt in accessibly, persist per device and do not touch notes',()=>{
 const r=runtime();assert.equal(r.h.on(),false);assert.match(r.h.toggle(),/role="switch" aria-checked="false"/);
 assert.match(r.h.toggle(),/<strong>Real-life examples<\/strong><span>Optional everyday cases and applications · Saved on this device<\/span>/);
 assert.match(r.h.toggle(),/aria-label="Real-life examples"/);
 assert.match(r.h.notice(),/your work or life/);assert.match(r.h.notice(),/Turn on Real-life examples/);
 const before=JSON.stringify(r.notes);r.clickToggle();assert.equal(r.h.on(),true);assert.equal(r.renders,1);assert.equal(r.focused,1);
 assert.deepEqual(r.writes,[['read-real-life-examples','true']]);assert.equal(runtime(r.values).h.on(),true);
 r.clickToggle();assert.equal(r.h.on(),false);assert.equal(runtime(r.values).h.on(),false);assert.equal(JSON.stringify(r.notes),before);
});
test('the switch and its notice carry no job-specific persona',()=>{
 const r=runtime(),html=r.h.toggle()+r.h.notice();
 assert.doesNotMatch(html,/coordinator|department|athlete|player|baseball|affiliate|staff/i);
});
test('neutral lessons retain source explanations and references while separating labelled fictional examples',()=>{
 const r=runtime(),original=guides[1],before=JSON.stringify(original),neutral=r.h.guide(original);
 assert.equal(neutral.gist,'The author argues that small routines shape a week.');
 for(let i=0;i<original.guide.concepts.length;i++){
  const sourceParagraph=original.guide.concepts[i].explanation.split(/\n\s*\n/)[0];
  assert.equal(neutral.concepts[i].explanation,sourceParagraph);
  assert.equal(neutral.concepts[i].sourceRefs,original.guide.concepts[i].sourceRefs);
 }
 assert.doesNotMatch(JSON.stringify(neutral.concepts)+JSON.stringify(neutral.principles),/Fictional example/);
 assert.doesNotMatch(JSON.stringify(neutral.recall),/your work/);
 assert.equal(neutral.recall[0],original.guide.recall[0],'Source recall stays exactly as written');
 assert.equal(neutral.flow.kind,'concept review');assert.equal(neutral.flow.edges.length,0);
 assert.deepEqual(neutral.cautions,['Only one chapter.']);
 assert.equal(r.h.story(original,'story'),'');
 r.h.set(true);assert.equal(r.h.guide(original),original.guide);assert.match(r.h.story(original,'story'),/fictional continuing case/);
 assert.doesNotMatch(r.h.story(original,'story'),/coordinator|leadership/i);
 assert.equal(JSON.stringify(original),before,'Source guide is never mutated');
});
test('guides without labelled examples pass through unchanged when examples are off',()=>{
 const r=runtime(),rec=lesson(2,{examples:false}),neutral=r.h.guide(rec);
 assert.equal(neutral.gist,rec.guide.gist);assert.equal(neutral.flow,rec.guide.flow);
 assert.deepEqual(JSON.parse(JSON.stringify(neutral.concepts)),rec.guide.concepts);assert.deepEqual(neutral.recall,rec.guide.recall);
 assert.equal(neutral.mnemonic,rec.guide.mnemonic);
});
test('neutral lessons keep interactive concept navigation, source links, recall and notes across every lesson',()=>{
 const r=runtime();
 for(const rec of guides){
  const idea=r.h.lab(rec,'idea'),flow=r.h.lab(rec,'flow'),memory=r.h.lab(rec,'recall');
  assert.match(idea,/lab-concept-navigation/);assert.match(idea,/Check passage/);assert.doesNotMatch(memory,/<textarea|data-note=/);
  assert.doesNotMatch(idea,/Fictional example/);assert.doesNotMatch(flow,/fictional|data-lab-simulator=/i);
  assert.ok(r.h.cards(rec).length===rec.guide.recall.length);
  assert.doesNotMatch(r.h.practice(rec),/Apply it|practice-teachback/);
 }
});
test('turning examples off after the last practice card safely clamps its index without losing assessment',()=>{
 const r=runtime(),rec=guides[1];r.h.set(true);
 const cards=r.h.cards(rec);assert.equal(cards.at(-1).label,'Apply it');
 r.h.session(rec).index=cards.length-1;r.state.checks[book.id]={[rec.unitId+' / Practice card '+(cards.length-1)]:true};
 assert.doesNotMatch(r.h.practice(rec),/<textarea/);r.h.set(false);
 assert.doesNotMatch(r.h.practice(rec),/<textarea/);assert.equal(r.h.session(rec).index,rec.guide.recall.length-1);
 r.h.set(true);assert.doesNotMatch(r.h.practice(rec),/<textarea/);assert.equal(r.state.checks[book.id][rec.unitId+' / Practice card '+(cards.length-1)],true);
});
test('source-reported research about any profession remains visible while optional invented interpretation is gated',()=>{
 const r=runtime(),rec=structuredClone(lesson(1,{examples:false}));rec.bookId='new-article';
 rec.guide.gist='Researchers studied hospital nurses.\n\nThe ward reported 25 observations.';
 rec.guide.concepts=[{title:'Reported comparison',explanation:rec.guide.gist,sourceRefs:[{paragraphId:'p1',quote:'25 observations'}]}];
 assert.equal(r.h.guide(rec).gist,rec.guide.gist,'Unlabelled article evidence is never removed by subject keywords');
 rec.guide.articleAnalysis={kind:'empirical-study',scope:'The supplied source.',researchQuestion:{status:'reported',text:'Researchers studied hospital nurses.',sourceRefs:[]},implications:[{status:'interpretation',text:'A fictional nurse changes the handoff meeting.',sourceRefs:[]}],criticalQuestions:['What comparison supports the claim?','How would this apply to your work or life?']};
 const html=r.h.article(rec);assert.match(html,/Researchers studied hospital nurses/);assert.match(html,/What comparison supports the claim/);assert.doesNotMatch(html,/A fictional nurse changes|How would this apply to your work or life/);
 r.h.set(true);assert.match(r.h.article(rec),/A fictional nurse changes/);assert.match(r.h.article(rec),/How would this apply to your work or life/);
});

test('explicit companion-example tails are removed without altering statistical statements or source text about fiction',()=>{
 const r=runtime(),rec={bookId:'new-article',guide:{}};
 const text='The sample included 10 participants. The p value was .056. As a companion illustration, a fictional teacher changes a handoff.';
 assert.equal(r.h.text(text,rec),'The sample included 10 participants. The p value was .056.');
 assert.equal(r.h.text('The author reports one finding. Fictional example: a nurse reorganizes a shift.',rec),'The author reports one finding.');
 assert.equal(r.h.text('The author reports one finding.\n\nFictional example: a nurse reorganizes a shift.',rec),'The author reports one finding.');
 assert.equal(r.h.text('The chapter has two parts.\n\nIn the fictional example, a shop owner moves a shelf.',rec),'The chapter has two parts.');
 const fiction='Fictional characters reveal the author’s argument about memory.\n\nThe novel returns to the same kitchen.';assert.equal(r.h.text(fiction,rec),fiction,'Source text about fiction is not mistaken for a label');
 const source='The researchers studied team leads.\n\nTeams supplied the study data.';assert.equal(r.h.text(source,rec),source);
 rec.guide={title:'Team survey',gist:source,concepts:[],principles:[],recall:[],flow:{kind:'sequence',caption:'The study recruits team leads.',nodes:[],edges:[]},articleAnalysis:{statisticsLab:{version:1}}};
 assert.equal(r.h.guide(rec).flow,rec.guide.flow,'A source-grounded flow stays intact');
 r.h.set(true);assert.equal(r.h.text(text,rec),text,'Opt in restores the full text');
});

test('neutral memory cues stay chapter-specific while only labelled example items are withheld',()=>{
 const r=runtime();
 for(const rec of guides){
  const neutral=r.h.guide(rec).mnemonic;
  assert.equal(neutral.cue,rec.guide.mnemonic.cue,'The source-concept cue survives: '+rec.unitId);
  assert.deepEqual(neutral.items.map(item=>item.letter),['CUE','ACT']);
  assert.doesNotMatch(JSON.stringify(neutral),/Fictional example/);
 }
 const clone=structuredClone(guides[0]);clone.guide.mnemonic.cue='A real-life example cue';
 assert.equal(r.h.guide(clone).mnemonic.cue,'Name it · Explain it · Check it','Fallback is reserved for an example-specific cue');
 r.h.set(true);assert.equal(r.h.guide(guides[0]).mnemonic,guides[0].guide.mnemonic,'Opt in restores the exact original memory aid');
});

test('next-book recommendations stay intact while optional field applications follow the switch',()=>{
 const r=runtime();
 const recommendations=[1,2,3,4,5].map(n=>({id:'pick-'+n,title:'Invented title '+n,author:'Example Author '+n,url:'https://example.test/book-'+n,connection:'It extends idea '+n+'.',application:'Fictional example: a teacher tries idea '+n+'.',readingOrderReason:'Read it after the previous pick.'}));
 const result={status:'ready',basis:'curated',recommendations};
 r.ctx.curatedNextBooks=()=>result;r.ctx.nextBooksCache=new Map();
 const source=read('./next-books.js');
 vm.runInContext(source.slice(source.indexOf('  function nextBooksContent('),source.indexOf('  function refreshNextBooksPanel('))+'\nthis.nextPanel=nextBooksPanel;',r.ctx);
 const neutral=r.ctx.nextPanel(book);
 for(const item of recommendations){assert.ok(neutral.includes(escape(item.title)));assert.ok(neutral.includes(escape(item.url)));assert.ok(neutral.includes(escape(item.connection)));assert.ok(!neutral.includes(escape(item.application)));}
 r.h.set(true);const applied=r.ctx.nextPanel(book);
 for(const item of recommendations)assert.ok(applied.includes(escape(item.application)));
});
