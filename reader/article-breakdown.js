  // An article opens on its research breakdown: question, study, findings, limits,
  // each tied to the exact passage. Reading the article itself is one tap away.
  const AB_KINDS={'empirical-study':'Original study','evidence-review':'Evidence review',commentary:'Commentary',unclear:'Article'};
  const AB_STATUS={reported:'Reported','not-reported':'Not reported',interpretation:'Our reading','not-applicable':'Not applicable'};
  // doi.org is a redirect, not a source worth naming.
  function articleHost(book=activeBook){try{const h=new URL(book.sourceUrl).hostname.replace(/^www\./,'');return /(?:^|\.)doi\.org$/.test(h)?'':h;}catch{return '';}}
  function articleMinutes(book=activeBook){return Math.max(1,Math.round(book.chapters.reduce((n,c)=>n+cleanParagraphs(c).join(' ').split(/\s+/).filter(Boolean).length,0)/230));}
  // Long articles can span a few guide parts. Single fields take the first reported
  // answer; lists join every part without repeating the same line.
  function articleBreakdownData(records){
    const parts=records.map(r=>({rec:r,a:r.guide.articleAnalysis})).filter(p=>p.a);
    if(!parts.length)return null;
    const pick=key=>{const all=parts.map(p=>({rec:p.rec,item:p.a[key]})).filter(x=>x.item);return all.find(x=>x.item.status==='reported')||all.find(x=>x.item.status==='interpretation')||all[0]||null;};
    const list=(key,max=8)=>{const seen=new Set(),out=[];for(const p of parts)for(const item of p.a[key]||[]){const k=typeof item==='string'?item:item.text;if(!k||seen.has(k))continue;seen.add(k);out.push({rec:p.rec,item});if(out.length>=max)return out;}return out;};
    const kind=(parts.find(p=>p.a.kind!=='unclear')||parts[0]).a.kind;
    const visual=parts.map(p=>p.a.studyVisual).find(Boolean)||null;
    return {kind,visual,rec:parts[0].rec,scope:parts.map(p=>p.a.scope).filter(Boolean)[0]||'',question:pick('researchQuestion'),design:pick('studyDesign'),population:pick('population'),comparator:pick('comparator'),outcomes:pick('outcomes'),
      results:list('results'),statistics:list('statistics',6),limitations:list('limitations'),implications:list('implications',6),questions:list('criticalQuestions',5)};
  }
  function articleEvidence({rec,item}){
    if(!item)return '';
    if(item.status==='interpretation'&&!coordinatorExamplesEnabled()&&roleContextExplicitExample(item.text))return '';
    const refs=(item.sourceRefs||[]).slice(0,2).map((r,i,all)=>sourceButton(rec.chapterId,all.length>1?`See passage ${i+1}`:'See it in the article',r.quote,r.paragraphId)).join('');
    return `<div class="ab-item ab-${esc(item.status)}"><span class="ab-status">${esc(AB_STATUS[item.status]||item.status)}</span>${readingProse(item.text)}${refs?`<div class="ab-refs">${refs}</div>`:''}</div>`;
  }
  function articleCard(n,label,title,entries,{wide=false,extra=''}={}){
    const items=(Array.isArray(entries)?entries:[entries]).filter(e=>e?.item&&e.item.status!=='not-applicable');
    if(!items.length&&!extra)return '';
    return `<section class="ab-card${wide?' ab-wide':''}" aria-labelledby="ab-card-${n}"><header><span class="ab-num" aria-hidden="true">${String(n).padStart(2,'0')}</span><div><p class="ab-label">${esc(label)}</p><h2 id="ab-card-${n}">${esc(title)}</h2></div></header>${items.map(articleEvidence).join('')}${extra}</section>`;
  }
  function articleWaiting(){
    const j=currentGenerationJob(),working=j&&['queued','submitting','submission_unknown','running','collecting','cancelling'].includes(j.status);
    if(working)return `<section class="ab-waiting" aria-live="polite"><span class="ab-pulse" aria-hidden="true"></span><div><p class="ab-label">Writing your breakdown</p><h2>Reading the methods, results and limits…</h2><p>${j.completionWindow==='24h'?'This can take a while. You can close read.; the breakdown appears here on its own.':'You can start reading while you wait. The breakdown appears here on its own.'}</p></div></section>`;
    if(j&&!working&&j.status!=='completed')return `<section class="ab-waiting is-stalled"><div><p class="ab-label">Breakdown paused</p><h2>${esc(j.units?.find(u=>u.status==='failed'&&u.error)?.error||j.error||'The breakdown did not finish.')}</h2>${j.retryAvailable?'<button class="primary" data-action="retry-generation">Try again</button>':''}</div></section>`;
    if(localAI.available&&!localAI.connected)return `<section class="ab-waiting is-stalled"><div><p class="ab-label">Breakdown not started</p><h2>The AI connection isn't set up on this site yet.</h2><p>Your article is saved and ready to read. Its breakdown starts on its own once the connection is on.</p></div></section>`;
    return `<section class="ab-waiting"><div><p class="ab-label">Research breakdown</p><h2>Break this article down.</h2><p>Question, study, findings and limits, each linked to the exact words in the article.</p><button class="primary" data-action="generate" ${busy||!localAI.connected?'disabled':''}>Create the breakdown</button></div></section>`;
  }
  function articleOverview(){
    const records=bookGuides(),data=articleBreakdownData(records),host=articleHost(),rec=data?.rec||records[0];
    const checks=rec&&typeof tapQuestions==='function'?records.reduce((n,r)=>n+tapQuestions(r,'remember').length,0):0;
    const empirical=data?.kind==='empirical-study',review=data?.kind==='evidence-review',commentary=data?.kind==='commentary';
    const original=(()=>{try{const u=new URL(activeBook.sourceUrl);return ['http:','https:'].includes(u.protocol)?`<a class="ab-original" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(host||'Open original')} ${readIcon('source')}</a>`:'';}catch{return '';}})();
    const abstractOnly=(activeBook.importWarnings||[]).some(w=>/Only the abstract/.test(w));
    const stats=rec&&typeof statsArticleProfile==='function'&&statsArticleProfile(activeBook,rec)?`<button class="secondary ab-stats" data-action="article-stats" data-unit="${esc(rec.unitId)}">${readIcon('overview')} Explore the numbers</button>`:'';
    abChapter=rec?.chapterId||'';
    if(data)loadNextReads(activeBook);
    const plots=data?intervalPlot(records):'';
    const cards=data?[
      studyGlance(data.visual),
      articleCard(1,'The question',commentary?'What is the argument?':'What did they want to know?',data.question,{wide:!data.visual||!evidenceLadder(data.visual.design)}),
      data.visual?evidenceLadder(data.visual.design):'',
      articleCard(2,'The study',empirical?'How was it done?':review?'How was the evidence gathered?':'How is the case built?',data.design),
      articleCard(3,'Who',empirical?'Who took part?':'Who or what was looked at?',data.population),
      articleCard(4,'Compared with','Against what?',data.comparator),
      articleCard(5,'Measured','What did they measure?',data.outcomes),
      predictCard(data.visual,rec),
      articleCard(6,'Findings',commentary?'What does it claim?':'What did they find?',data.results,{wide:true}),
      articleCard(7,'The numbers','What the statistics say',data.statistics,{wide:true,extra:plots+stats}),
      articleCard(8,'Limitations','Where confidence stops',data.limitations,{wide:true}),
      articleCard(9,'So what','What it can and can’t inform',data.implications,{wide:true}),
    ].join(''):'';
    const questions=data?.questions.length?`<section class="ab-card ab-wide ab-questions"><header><span class="ab-num" aria-hidden="true">10</span><div><p class="ab-label">Read it like a scientist</p><h2>Questions worth asking</h2></div></header><ul>${data.questions.map(q=>`<li>${esc(q.item)}</li>`).join('')}</ul></section>`:'';
    return `${topbar(activeBook.title)}<article class="article-breakdown">
      <header class="ab-hero">
        <p class="ab-kicker"><span class="ab-chip">${esc(data?AB_KINDS[data.kind]||'Article':'Article')}</span>${host?`<span>${esc(host)}</span>`:''}${activeBook.citation?`<span>${esc(activeBook.citation)}</span>`:''}<span>${articleMinutes()} min read</span></p>
        <h1>${esc(activeBook.title)}</h1>
        ${activeBook.author?`<p class="ab-byline">${esc(activeBook.author)}</p>`:''}
        <div class="ab-actions"><button class="primary" data-action="reader">${readIcon('book')} Read the article</button>${checks?`<button class="secondary" data-action="article-check" data-unit="${esc(rec.unitId)}">${readIcon('practice')} ${checks} quick questions</button>`:''}${original}${shareButton('ab-share','Share')}</div>
        ${abstractOnly?`<p class="ab-note">${readIcon('compass')} Only the abstract is free to read. For the full methods and results, download the PDF and add it with Upload file.</p>`:''}
      </header>
      ${data?`${rec?.guide?.gist?`<section class="ab-gist"><p class="ab-label">In plain language</p>${readingProse(rec.guide.gist)}</section>`:''}<div class="ab-grid">${cards}${questions}</div>
      <nav class="ab-next" aria-label="Keep going">${checks?`<button class="ab-next-card" data-action="article-check" data-unit="${esc(rec.unitId)}"><span class="ab-label">Check what stuck</span><strong>${checks} quick questions</strong><span>Tap to answer. No typing.</span></button>`:''}<button class="ab-next-card" data-action="explore" data-unit="${esc(rec.unitId)}"><span class="ab-label">Go deeper</span><strong>The full lesson</strong><span>The reasoning, a visual map and memory cues.</span></button></nav>
      ${nextReadsSection()}
      <p class="ab-provenance">Companion breakdown of the text in your library${data.scope?'. '+esc(data.scope):''}. Tap any passage link to check the exact words.</p>`:articleWaiting()}
      ${documentImportNotice(activeBook)}
      <button class="text-button remove-book" data-action="remove-book">Remove from library</button>
    </article>${footer()}`;
  }
  function handleArticleBreakdownAction(action,el){
    if(action==='ab-predict'){
      const key='predict:'+el.dataset.unit;state.checks[activeBook.id]||={};
      if(['increase','decrease','no-clear-difference'].some(value=>state.checks[activeBook.id][key+':'+value]===true))return true;
      const rec=bookGuides().find(r=>r.unitId===el.dataset.unit),v=rec?.guide?.articleAnalysis?.studyVisual;
      state.checks[activeBook.id][key+':'+el.dataset.value]=true;state.checks[activeBook.id][key]=el.dataset.value===v?.headline?.direction;save();if(rec&&typeof keepRecordPredict==='function')keepRecordPredict(rec,state.checks[activeBook.id][key]);
      const card=el.closest('.ab-predict');if(card&&rec)card.outerHTML=predictCard(v,rec);
      document.querySelector('.ab-predict .ab-predict-result')?.focus?.();return true;
    }
    if(action==='next-read-add'){importReadingLinkNow(el.dataset.link);return true;}
    if(action==='article-check'){go('explore',{unit:el.dataset.unit,guideStep:5});return true;}
    if(action==='article-stats'){go('explore',{unit:el.dataset.unit,guideStep:0});requestAnimationFrame(()=>document.querySelector('#article-statistics-lab')?.scrollIntoView({block:'start',behavior:'instant'}));return true;}
    return false;
  }

  // ---------- Visuals: the study as a picture ----------
  const AB_LADDER=[
    {key:'synthesis',label:'Reviews of many studies',designs:['meta-analysis','systematic-review']},
    {key:'trial',label:'Controlled experiments',designs:['randomized-trial','crossover-trial','non-randomized-trial']},
    {key:'observational',label:'Observing groups',designs:['cohort','case-control','cross-sectional','single-group']},
    {key:'cases',label:'Case reports and interviews',designs:['case-series','qualitative']},
    {key:'opinion',label:'Expert opinion and narrative reviews',designs:['narrative-review','commentary']},
  ];
  const AB_DESIGN_NAMES={'randomized-trial':'Randomized trial','crossover-trial':'Crossover trial','non-randomized-trial':'Controlled trial, not randomized','single-group':'One group, before and after',cohort:'Cohort study','case-control':'Case-control study','cross-sectional':'Snapshot (cross-sectional) study','case-series':'Case series',qualitative:'Interview study','systematic-review':'Systematic review','meta-analysis':'Meta-analysis','narrative-review':'Narrative review',commentary:'Commentary',other:'Study'};
  const abCount=n=>Number.isInteger(n)?n.toLocaleString('en-US'):'';
  function abPeople(count){
    // Each dot is a person (or a study, for a review). Large studies scale down.
    if(!Number.isInteger(count)||count<1)return '';
    const per=count<=48?1:Math.ceil(count/48),dots=Math.max(1,Math.round(count/per));
    return `<div class="ab-dots" role="img" aria-label="${abCount(count)} ${per>1?'(each dot about '+abCount(per)+')':''}">${'<i></i>'.repeat(dots)}</div>${per>1?`<p class="ab-dots-key">Each dot ≈ ${abCount(per)}</p>`:''}`;
  }
  function abArrow(label=''){return `<div class="ab-flow-arrow" aria-hidden="true"><span></span>${label?`<em>${esc(label)}</em>`:''}</div>`;}
  function studyGlance(v){
    if(!v)return '';
    const randomized=['randomized-trial','crossover-trial'].includes(v.design);
    const review=['systematic-review','meta-analysis','narrative-review'].includes(v.design);
    const dir={increase:['up','Went up'],decrease:['down','Went down'],'no-clear-difference':['flat','No clear difference'],mixed:['mixed','Mixed results']}[v.headline.direction];
    const groups=v.groups.length?`${abArrow(v.design==='crossover-trial'?'Each person tries both':randomized?'Randomly assigned':'Split into')}<div class="ab-groups" style="--n:${v.groups.length}">${v.groups.map((g,i)=>`<div class="ab-group ab-group-${i}"><span class="ab-group-n">${g.count?'n = '+abCount(g.count):'n not reported'}</span><strong>${esc(g.label)}</strong>${g.receives?`<span>${esc(g.receives)}</span>`:''}</div>`).join('')}</div>`:'';
    const time=v.duration?`${abArrow()}<div class="ab-timeline"><span class="ab-timeline-start">Start</span><span class="ab-timeline-bar" aria-hidden="true"></span><span class="ab-timeline-end">${esc(v.duration)}</span></div>`:'';
    const measured=v.outcomes.length?`${abArrow('Measured')}<div class="ab-chips">${v.outcomes.map(o=>`<span>${esc(o)}</span>`).join('')}</div>`:'';
    const result=dir&&v.headline.measure?`${abArrow('Main result')}<div class="ab-headline ab-dir-${dir[0]}"><span class="ab-headline-icon" aria-hidden="true">${{up:'↑',down:'↓',flat:'=',mixed:'↕'}[dir[0]]}</span><div><p class="ab-label">${esc(v.headline.measure)}</p><strong>${esc(v.headline.magnitude||dir[1])}</strong>${v.headline.favors?`<span>Favored: ${esc(v.headline.favors)}</span>`:''}</div></div>`:'';
    return `<section class="ab-card ab-wide ab-glance" aria-labelledby="ab-glance-title"><header><span class="ab-num" aria-hidden="true">${readIcon('overview')}</span><div><p class="ab-label">The study at a glance</p><h2 id="ab-glance-title">${esc(AB_DESIGN_NAMES[v.design]||'Study')}</h2></div></header>
      <div class="ab-machine" aria-hidden="true">${isoFigure(isoPick('glance:'+activeBook.id,'glance',Math.max(1,Math.min(4,v.groups.length)),{dir:dir?.[0]||'flat'}))}</div>
      <div class="ab-flow"><div class="ab-who"><p class="ab-label">${review?'What was reviewed':'Who took part'}</p><strong>${v.participants.count?abCount(v.participants.count)+' ':''}${esc(v.participants.count&&/^[A-Z][a-z]/.test(v.participants.label)?v.participants.label.charAt(0).toLowerCase()+v.participants.label.slice(1):v.participants.label)}</strong>${abPeople(v.participants.count)}</div>${groups}${time}${measured}${result}</div>
      <div class="ab-refs">${(v.sourceRefs||[]).slice(0,2).map((r,i,a)=>sourceButton(currentBreakdownChapter(),a.length>1?'See passage '+(i+1):'See it in the article',r.quote,r.paragraphId)).join('')}</div>
      <p class="ab-figure-note">Drawn by read. from what the article reports. Not a figure from the paper.</p></section>`;
  }
  let abChapter='';
  function currentBreakdownChapter(){return abChapter;}
  function evidenceLadder(design){
    const at=AB_LADDER.findIndex(r=>r.designs.includes(design));
    if(at<0)return '';
    return `<section class="ab-card ab-ladder-card" aria-labelledby="ab-ladder-title"><header><span class="ab-num" aria-hidden="true">${readIcon('layers')}</span><div><p class="ab-label">Kind of evidence</p><h2 id="ab-ladder-title">Where this sits</h2></div></header>
      <ol class="ab-ladder">${AB_LADDER.map((r,i)=>`<li class="${i===at?'is-here':''}" ${i===at?'aria-current="true"':''}><span class="ab-rung" aria-hidden="true"></span><span>${esc(r.label)}</span>${i===at?'<em>This article</em>':''}</li>`).join('')}</ol>
      <p class="ab-figure-note">Higher rungs can answer cause-and-effect questions more directly. This is the type of study, not a score of how well it was done. Check the limitations card.</p></section>`;
  }
  // Effects with an uncertainty interval, drawn on one line with the "no effect" mark.
  function intervalPlot(records){
    const metrics=records.flatMap(r=>(r.guide.articleAnalysis?.statisticsLab?.metrics||[]).filter(m=>m.interval&&['effect-size','estimate','association'].includes(m.kind)&&Number.isFinite(m.value)).map(m=>({m,rec:r}))).slice(0,4);
    if(!metrics.length)return '';
    const rows=metrics.map(({m})=>{
      const ratio=/ratio|\bOR\b|\bRR\b|\bHR\b/i.test(m.measure+' '+m.label),none=ratio?1:0;
      const lo=Math.min(m.interval.low,none,m.value),hi=Math.max(m.interval.high,none,m.value),pad=(hi-lo||1)*.12,min=lo-pad,max=hi+pad,x=v=>((v-min)/(max-min)*100).toFixed(2);
      const crosses=m.interval.low<=none&&m.interval.high>=none;
      return `<li><p class="ab-plot-label">${esc(m.label)}</p><div class="ab-plot" role="img" aria-label="${esc(`${m.measure} ${m.value}${m.unit?' '+m.unit:''}, interval ${m.interval.low} to ${m.interval.high}. ${crosses?'The interval includes no effect.':'The interval does not include no effect.'}`)}"><span class="ab-plot-zero" style="left:${x(none)}%"><em>${ratio?'1 = no difference':'0 = no difference'}</em></span><span class="ab-plot-range${crosses?' is-crossing':''}" style="left:${x(m.interval.low)}%;width:${(x(m.interval.high)-x(m.interval.low)).toFixed(2)}%"></span><span class="ab-plot-dot" style="left:${x(m.value)}%"></span></div><p class="ab-plot-values"><strong>${esc(String(m.value))}${m.unit?' '+esc(m.unit):''}</strong> <span>${m.interval.level?esc(String(m.interval.level))+'% ':''}${m.interval.type==='confidence'?'CI':m.interval.type} ${esc(String(m.interval.low))} to ${esc(String(m.interval.high))}</span></p><p class="ab-plot-read">${crosses?'The range includes “no difference”, so the result could be zero.':'The whole range sits on one side of “no difference”.'} Wider bar, less certainty.</p></li>`;
    }).join('');
    return `<div class="ab-plots"><p class="ab-label">How sure is the result?</p><ul>${rows}</ul></div>`;
  }
  // Tap a guess before seeing the result. Prediction makes the finding stick.
  function predictCard(v,rec){
    const d=v?.headline?.direction;
    if(!v||!v.headline.measure||!['increase','decrease','no-clear-difference'].includes(d))return '';
    // Saved as true/false check markers so the guess syncs like every other tap.
    const key='predict:'+rec.unitId,saved=state.checks[activeBook.id]||{};
    const options=[['increase','It went up','↑'],['decrease','It went down','↓'],['no-clear-difference','No clear difference','=']];
    const chosen=options.find(([value])=>saved[key+':'+value]===true)?.[0]||'';
    return `<section class="ab-card ab-wide ab-predict" aria-labelledby="ab-predict-title"><header><span class="ab-num" aria-hidden="true">${readIcon('practice')}</span><div><p class="ab-label">Predict first</p><h2 id="ab-predict-title">What happened to ${esc(v.headline.measure.charAt(0).toLowerCase()+v.headline.measure.slice(1))}?</h2></div></header>
      <div class="ab-predict-options" role="group" aria-label="Your prediction">${options.map(([value,label,icon])=>`<button class="ab-predict-option${chosen?value===d?' is-right':value===chosen?' is-wrong':'':''}" data-action="ab-predict" data-unit="${esc(rec.unitId)}" data-value="${value}" ${chosen?'disabled':''} aria-pressed="${value===chosen}"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div>
      ${chosen?`<p class="ab-predict-result" role="status">${chosen===d?'You called it.':'Not this time.'} ${esc(v.headline.measure)}: <strong>${esc(v.headline.magnitude||options.find(o=>o[0]===d)[1])}</strong>${v.headline.favors?` (favored ${esc(v.headline.favors)})`:''}.</p>`:'<p class="ab-figure-note">Tap your guess. The answer appears right here.</p>'}</section>`;
  }

  // ---------- Read next: 3 to 5 articles from OpenAlex ----------
  const abNextReads=new Map();
  function loadNextReads(book){
    if(abNextReads.has(book.id))return;
    abNextReads.set(book.id,{status:'loading',items:[]});
    fetch('/api/next-articles?bookId='+encodeURIComponent(book.id),{signal:AbortSignal.timeout(25000)}).then(r=>r.ok?r.json():Promise.reject()).then(value=>{
      const shelf=new Set(books.map(b=>String(b.title).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()));
      abNextReads.set(book.id,{status:'ready',items:(value.articles||[]).filter(a=>!shelf.has(String(a.title).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim())).slice(0,5)});
    }).catch(()=>abNextReads.set(book.id,{status:'error',items:[]})).finally(()=>{
      const target=document.getElementById('ab-next-reads');if(target&&view==='overview'&&activeBook.id===book.id)target.outerHTML=nextReadsSection(book);
    });
  }
  function nextReadsSection(book=activeBook){
    const entry=abNextReads.get(book.id);
    if(!entry||entry.status==='loading')return `<section class="ab-reads" id="ab-next-reads" aria-busy="true"><header><p class="ab-label">Read next</p><h2>Finding the best next papers…</h2></header><div class="ab-reads-grid">${'<div class="ab-read is-skeleton"></div>'.repeat(3)}</div></section>`;
    if(entry.status==='error'||entry.items.length<1)return `<section class="ab-reads" id="ab-next-reads" hidden></section>`;
    return `<section class="ab-reads" id="ab-next-reads" aria-labelledby="ab-reads-title"><header><p class="ab-label">Read next</p><h2 id="ab-reads-title">${entry.items.length} papers to read after this one</h2><p>Newer studies that build on it and close relatives, from OpenAlex. Free full text first.</p></header><div class="ab-reads-grid">${entry.items.map(a=>`<article class="ab-read"><p class="ab-read-why">${esc(a.why)}</p><h3>${esc(a.title)}</h3><p class="ab-read-meta">${[a.authors,a.year,a.venue].filter(Boolean).map(esc).join(' · ')}</p><div class="ab-read-badges">${a.openAccess?'<span class="is-free">Free full text</span>':'<span>Abstract only</span>'}${a.citedBy?`<span>Cited ${abCount(a.citedBy)}×</span>`:''}</div><div class="ab-read-actions">${a.doi||a.link?`<button class="primary" data-action="next-read-add" data-link="${esc(a.doi||a.link)}">${readIcon('plus')} Add</button>`:''}${a.link?`<a class="ab-original" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">Open ${readIcon('source')}</a>`:''}</div></article>`).join('')}</div></section>`;
  }
