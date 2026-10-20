  const practiceSessions=new Map();
  function practiceSession(rec){const key=rec.bookId+'/'+rec.unitId;if(!practiceSessions.has(key))practiceSessions.set(key,{index:0,reveal:false});return practiceSessions.get(key);}
  function practiceCards(rec){return [...roleContextGuide(rec).recall.map(r=>({question:r.question,answer:r.answer,label:'Recall the idea'})),...(coordinatorExamplesEnabled()?[{question:'Picture yourself in this fictional example. What would you do first, and what would you check before acting?',context:rec.guide.application.scenario,answer:rec.guide.application.steps.join('\n\n'),label:'Apply it'}]:[])];}
  function practiceCheckKey(rec,index){return rec.unitId+' / Practice card '+index;}
  function practiceCardMarkup(rec){
    const cards=practiceCards(rec),session=practiceSession(rec),index=Math.min(session.index,cards.length-1),card=cards[index],ready=state.checks[activeBook.id]||{},total=cards.filter((_,i)=>ready[practiceCheckKey(rec,i)]===true).length;
    session.index=index;
    return `<div class="practice-card-meta"><span>${esc(card.label)}</span><span>Card ${index+1} / ${cards.length}</span></div><progress value="${total}" max="${cards.length}" aria-label="Recall cards you knew"></progress><p class="practice-status">${total} of ${cards.length} known</p><h3>${esc(card.question)}</h3>${card.context?`<p class="practice-context">${esc(card.context)}</p>`:''}<button class="${session.reveal?'text-button':'secondary'}" data-action="practice-reveal" aria-expanded="${session.reveal}">${session.reveal?'Hide the answer':'Show the answer'} ${readIcon(session.reveal?'layers':'compass')}</button>${session.reveal?`<div class="practice-explanation"><span class="eyebrow">The answer</span>${readingProse(card.answer)}<div class="button-row"><button class="secondary" data-action="practice-rate" data-ready="true" aria-pressed="${ready[practiceCheckKey(rec,index)]===true}">${readIcon('check')} I knew it</button><button class="text-button" data-action="practice-rate" data-ready="false" aria-pressed="${ready[practiceCheckKey(rec,index)]===false}">Not yet</button></div></div>`:''}<nav class="practice-navigation" aria-label="Recall cards"><button class="text-button" data-action="practice-card" data-index="${index-1}" ${index===0?'disabled':''}>${readIcon('back')} Previous</button><button class="text-button" data-action="practice-card" data-index="${index+1}" ${index===cards.length-1?'disabled':''}>Next card ${readIcon('arrow')}</button></nav>`;
  }
  function tapPractice(rec){
    const score=tapScore(rec),teach=tapSet(rec,'teach');
    return `<details class="chapter-practice" id="chapter-practice" ${practiceSession(rec).open?'open':''}><summary><span class="practice-summary-icon">${readIcon('practice')}</span><span><strong>Practice this chapter</strong><small>Tap your answers. Every question has a right answer. No typing.</small></span><span class="practice-summary-plus">+</span></summary><div class="practice-interior"><div class="practice-intro"><p class="eyebrow">Check what stuck</p><h2>${score.answered?`${score.right} of ${score.total} right on your last try`:`${score.total} questions, none answered yet`}</h2><p>The questions live in the Remember step. Wrong answers and guesses are worth a second pass.</p><button class="secondary" data-action="guide-step" data-step="5">Go to the questions ${readIcon('arrow')}</button></div>${teach}</div></details>`;
  }
  function chapterPractice(rec){
    if(typeof tapQuestions==='function'&&tapQuestions(rec).length)return tapPractice(rec);
    return `<details class="chapter-practice" id="chapter-practice" ${practiceSession(rec).open?'open':''}><summary><span class="practice-summary-icon">${readIcon('practice')}</span><span><strong>Practice this ${activeBook.sourceType==='article'?'article':'chapter'}</strong><small>Think of the answer, then tap to check. No typing.</small></span><span class="practice-summary-plus">+</span></summary><div class="practice-interior"><div class="practice-intro"><p class="eyebrow">Make the idea retrievable</p><h2>Do you remember it?</h2><p>Start from memory, then tap to see the answer.</p></div><div id="practice-card" class="practice-card" aria-live="polite">${practiceCardMarkup(rec)}</div></div></details>`;
  }
  function articleEvidenceItem(rec,item){
    if(!item)return '';
    const statuses={reported:'Reported in this source','not-reported':'Not reported in this text','not-applicable':'Not applicable',interpretation:'Companion interpretation'};
    if(!coordinatorExamplesEnabled()&&item.status==='interpretation'&&roleContextExplicitExample(item.text))return `<div class="evidence-item">${coordinatorExamplesNotice()}${refs(rec.chapterId,item.sourceRefs||[])}</div>`;
    return `<div class="evidence-item"><span class="evidence-status status-${esc(item.status)}">${esc(statuses[item.status]||item.status)}</span>${readingProse(item.text)}${refs(rec.chapterId,item.sourceRefs||[])}</div>`;
  }
  function articleStudyStages(a){
    const empirical=a.kind==='empirical-study',review=a.kind==='evidence-review',commentary=a.kind==='commentary';
    return [
      {label:'Question',title:commentary?'What question drives the argument?':'What question is being asked?',icon:'compass',fields:[['The question','researchQuestion']]},
      {label:empirical?'Design':commentary?'Argument':'Approach',title:empirical?'How was the study set up?':review?'How was the evidence examined?':'How does the source build its case?',icon:'layers',fields:empirical||review?[['Approach','studyDesign'],['Who or what','population'],['Comparison','comparator'],['Measures','outcomes']]:[['Approach','studyDesign']]},
      {label:empirical?'Results':commentary?'Claims':review?'Evidence':'Findings',title:empirical?'What did the study find?':commentary?'What does the source claim?':'What evidence is presented?',icon:'overview',fields:[[empirical?'Reported findings':'Findings or claims','results']]},
      {label:'Limits',title:'Where does confidence stop?',icon:'focus',fields:[['Limits and uncertainty','limitations']]},
      {label:empirical||review?'Decision':'Application',title:'What can this inform?',icon:'practice',fields:[['Implications and interpretation','implications']]},
    ];
  }
  function articleStudyMap(rec){
    const a=rec.guide.articleAnalysis,stages=articleStudyStages(a),index=Math.max(0,Math.min(stages.length-1,practiceSession(rec).evidenceStage||0)),stage=stages[index];
    return `<div class="article-study-map-header"><div><span class="eyebrow">${a.kind==='empirical-study'?'Map the study':a.kind==='commentary'?'Map the argument':'Map the evidence'}</span><h3>Follow the evidence, one step at a time</h3></div><p>Choose a step. Check the source before moving from a finding to a decision.</p></div><ol class="evidence-reading-route" aria-label="Interactive critical reading sequence">${stages.map((step,i)=>`<li><button type="button" data-action="practice-evidence-stage" data-evidence-stage="${i}" aria-pressed="${i===index}" aria-controls="article-study-map-detail"><span class="evidence-stage-number">${String(i+1).padStart(2,'0')}</span>${readIcon(step.icon)}<span>${step.label}</span></button>${i<stages.length-1?`<span class="evidence-stage-arrow" aria-hidden="true">${readIcon('arrow')}</span>`:''}</li>`).join('')}</ol><div class="article-study-map-detail" id="article-study-map-detail" role="region" aria-labelledby="article-study-stage-title" aria-live="polite"><div class="evidence-stage-heading"><span class="evidence-stage-count">Step ${index+1} of ${stages.length}</span><h4 id="article-study-stage-title">${stage.title}</h4></div><div class="evidence-stage-fields ${stage.fields.length>1?'has-multiple-fields':''}">${stage.fields.map(([label,key])=>{const items=(Array.isArray(a[key])?a[key]:[a[key]]).filter(Boolean).slice(0,2);return `<div class="evidence-stage-field">${stage.fields.length>1?`<h5>${label}</h5>`:''}${items.map(item=>articleEvidenceItem(rec,item)).join('')||'<p class="small">This detail is not available in the supplied guide.</p>'}</div>`;}).join('')}</div><p class="evidence-map-boundary">This map uses the article guide’s stated evidence. Open the sections below for the full appraisal and statistical detail.</p></div>`;
  }
  function articleAnalysis(rec){
    const a=rec.guide.articleAnalysis;if(!a)return '';
    const types={'empirical-study':'Empirical study','evidence-review':'Evidence review',commentary:'Commentary / perspective',unclear:'Source type unclear'};
    const sections=[['Start with the question','researchQuestion'],['Identify the design','studyDesign'],['Who or what was studied?','population'],['Compared with what?','comparator'],['What was measured?','outcomes'],['Read the results','results'],['Understand the statistics','statistics'],['Check the limitations','limitations'],['Decide what this can inform','implications']];
    return `<section class="article-analysis" aria-labelledby="article-analysis-title"><header><span class="eyebrow">Read the evidence with care</span><h2 id="article-analysis-title">A guide to understanding this article</h2><p class="article-kind">${readIcon('compass')} ${esc(types[a.kind]||'Reading guide')}</p><p class="small">${esc(a.scope)}</p></header>${articleStatisticsLab(rec)}<div class="article-study-map" id="article-study-map">${articleStudyMap(rec)}</div><div class="evidence-sections">${sections.map(([title,key],i)=>`<details><summary><span>${String(i+1).padStart(2,'0')}</span>${title}</summary>${(Array.isArray(a[key])?a[key]:[a[key]]).filter(Boolean).map(item=>articleEvidenceItem(rec,item)).join('')||'<p class="small">Not available in this guide.</p>'}</details>`).join('')}</div>${a.criticalQuestions?.length?`<div class="article-questions"><h3>Questions to test your understanding</h3>${a.criticalQuestions.map((q,i)=>!coordinatorExamplesEnabled()&&roleContextHasExample(q)?coordinatorExamplesNotice():`<p class="article-question">${esc(q)}</p>`).join('')}</div>`:''}<p class="small">Check the linked wording. A generated reading guide can miss details and does not independently validate the research.</p></section>`;
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]'),action=el?.dataset.action;if(!action?.startsWith('practice-'))return;
    const rec=bookGuides().find(r=>r.unitId===selectedUnit);if(!rec)return;
    if(action==='practice-open'){const panel=$('#chapter-practice');panel.open=true;panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});panel.querySelector('summary').focus({preventScroll:true});return;}
    const session=practiceSession(rec);
    if(action==='practice-evidence-stage'){
      const index=Number(el.dataset.evidenceStage);
      if(!rec.guide.articleAnalysis||!Number.isInteger(index)||index<0||index>=articleStudyStages(rec.guide.articleAnalysis).length)return;
      session.evidenceStage=index;const map=$('#article-study-map');map.innerHTML=articleStudyMap(rec);map.querySelector('[data-evidence-stage="'+index+'"]')?.focus({preventScroll:true});return;
    }
    if(action==='practice-reveal')session.reveal=!session.reveal;
    if(action==='practice-card'){session.index=Math.max(0,Math.min(practiceCards(rec).length-1,Number(el.dataset.index)||0));session.reveal=false;}
    if(action==='practice-rate'){state.checks[activeBook.id]||={};state.checks[activeBook.id][practiceCheckKey(rec,session.index)]=el.dataset.ready==='true';save();}
    $('#practice-card').innerHTML=practiceCardMarkup(rec);
    if(action==='practice-card'){$('#practice-card h3').tabIndex=-1;$('#practice-card h3').focus({preventScroll:true});}else $('#practice-card [data-action="'+action+'"]')?.focus({preventScroll:true});
  });
