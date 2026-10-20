  // A reading preference, never a change to the source or the saved guide.
  // Real-life examples are fictional everyday applications; they stay off until the reader opts in.
  const coordinatorExamplesStorageKey='read-real-life-examples';
  let coordinatorExamplesOn=false;
  try{coordinatorExamplesOn=localStorage.getItem(coordinatorExamplesStorageKey)==='true';}catch(_){}
  function coordinatorExamplesEnabled(){return coordinatorExamplesOn;}
  function setCoordinatorExamples(enabled){
    coordinatorExamplesOn=enabled===true;
    try{localStorage.setItem(coordinatorExamplesStorageKey,String(coordinatorExamplesOn));}catch(_){}
  }
  function coordinatorExamplesToggle(){
    return `<div class="role-context-control"><div><strong>Real-life examples</strong><span>Optional everyday cases and applications · Saved on this device</span></div><button type="button" class="role-context-switch" role="switch" aria-checked="${coordinatorExamplesEnabled()}" aria-label="Real-life examples" data-action="real-life-examples-toggle"><span aria-hidden="true"></span><b>${coordinatorExamplesEnabled()?'On':'Off'}</b></button></div>`;
  }
  function coordinatorExamplesNotice(){return '<aside class="role-context-notice"><p>Want to connect this idea to your work or life?</p><span>Turn on Real-life examples '+(activeBook?.sourceType==='article'?'above':'in the Aa menu')+' to add fictional cases, analogies, and everyday decisions. Your notes remain saved when examples are off.</span></aside>';}
  // Labelled companion material: explicit fictional or applied examples, never the source's own subject words.
  function roleContextHasExample(value){
    return /(?:\bfictional (?:example|case|scenario|illustration|application|thread|story|review)\b|\bfictional (?:leadership|real-life|everyday)\b|\bfictional\s*:|companion (?:leadership|example|illustration)|leadership (?:lens|transfer)|real-life (?:example|application|lens)|everyday (?:example|application)|\byour (?:work or life|own work|workplace|daily life|everyday life)\b)/i.test(String(value||''));
  }
  function roleContextExplicitExample(value){return /fictional|companion (?:leadership|example|illustration)|leadership (?:lens|transfer)|real-life (?:example|application|lens)|\byour (?:work|life|workplace|team|home)\b/i.test(String(value||''));}
  function roleContextText(value){
    if(coordinatorExamplesEnabled())return String(value||'');
    // These explicit labels identify added interpretation, not the author's text.
    const clean=String(value||'').replace(/\s*(?:(?:Leadership|Real-life|Everyday) (?:lens|transfer|example|application)(?: \(companion interpretation\))?:)[\s\S]*$/i,'').trim();
    return clean.split(/\n\s*\n/).map(paragraph=>paragraph.replace(/\s*(?:As a companion (?:illustration|example),|In the companion (?:leadership )?(?:transfer|example),|In (?:the|a|this) fictional [^,.;:]{1,40},|Fictional example:)[\s\S]*$/i,'').trim()).filter(paragraph=>{
      return !/^(?:Fictional (?:example|case|scenario|illustration|application|thread|story|review)\b|Fictional (?:leadership|real-life|everyday)\b|Fictional\s*:|Companion (?:leadership|example|illustration)\b|In (?:the|this|a) fictional (?:example|case|scenario|story|review|application|thread)\b)/i.test(paragraph.trim());
    }).filter(Boolean).join('\n\n');
  }
  function roleContextGuide(rec){
    const g=rec.guide;if(coordinatorExamplesEnabled())return g;
    const concepts=(g.concepts||[]).map(c=>({...c,explanation:roleContextText(c.explanation,rec)}));
    const principles=(g.principles||[]).map(p=>({...p,explanation:roleContextText(p.explanation,rec)}));
    const flow=roleContextExplicitExample(JSON.stringify(g.flow))?{kind:'concept review',caption:'Review the source ideas in order. These cards organize the explanation without implying a causal pathway.',nodes:concepts.map((c,i)=>({id:'concept-'+i,label:c.title,detail:c.explanation})),edges:[],limit:'Read the linked source and keep its qualifications. Turn on Real-life examples to see the separate applied scenario.'}:g.flow;
    const recall=(g.recall||[]).map((r,i)=>{
      if(!roleContextExplicitExample(r.question+' '+r.answer))return r;
      const c=concepts[i%Math.max(1,concepts.length)]||principles[i%Math.max(1,principles.length)];
      return c?{...r,question:'What does “'+c.title+'” mean in this chapter?',answer:c.explanation}:r;
    });
    const memoryHasRole=value=>roleContextHasExample(value);
    const roleMnemonic=memoryHasRole(JSON.stringify(g.mnemonic||{}))&&!g.articleAnalysis?.statisticsLab;
    const memorySummary=g.chapterVisual?.caption&&!memoryHasRole(g.chapterVisual.caption)?g.chapterVisual.caption:roleContextText(g.gist,rec);
    const mnemonic=roleMnemonic?{...g.mnemonic,
      cue:memoryHasRole(g.mnemonic.cue)?'Name it · Explain it · Check it':g.mnemonic.cue,
      meaning:memoryHasRole(g.mnemonic.meaning)?memorySummary:g.mnemonic.meaning,
      items:(g.mnemonic.items||[]).filter(item=>!memoryHasRole(item.letter+' '+item.meaning)),
      caution:memoryHasRole(g.mnemonic.caution)?'Use this cue to recall the idea; check the source for the full argument and its qualifications.':g.mnemonic.caution,
    }:g.mnemonic;
    const chapterVisual=g.chapterVisual?{...g.chapterVisual,caption:roleContextHasExample(g.chapterVisual.caption)?'A companion concept image. Follow the relationships, then check the explanations below.':g.chapterVisual.caption}:g.chapterVisual;
    return {...g,gist:roleContextText(g.gist,rec),concepts,principles,flow,recall,mnemonic,chapterVisual,cautions:(g.cautions||[]).filter(c=>!/^The (?:fictional|real-life) (?:story|example|thread)/i.test(c))};
  }
  // The lesson switch lives in the Aa sheet (settings belong in sheets, DESIGN.md).
  function syncLessonSettings(){
    const dialog=document.getElementById?.('reading-comfort-dialog');if(!dialog)return;
    let section=dialog.querySelector('.comfort-lessons');
    if(!section){section=document.createElement('section');section.className='comfort-section comfort-lessons';(dialog.querySelector('.comfort-content')||dialog).prepend(section);}
    section.innerHTML=`<h3>Lessons</h3>${coordinatorExamplesToggle()}`;
  }
  globalThis.addEventListener?.('ycaro-reading-settings-open',syncLessonSettings);
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-action="real-life-examples-toggle"]');if(!button)return;
    const inSheet=!!button.closest?.('#reading-comfort-dialog');
    const y=window.scrollY;setCoordinatorExamples(!coordinatorExamplesEnabled());render();syncLessonSettings();
    requestAnimationFrame(()=>{window.scrollTo({top:y,behavior:'instant'});document.querySelector(inSheet?'#reading-comfort-dialog [data-action="real-life-examples-toggle"]':'main [data-action="real-life-examples-toggle"]')?.focus({preventScroll:true});});
  });
