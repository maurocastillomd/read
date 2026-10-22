  // Visual-first lessons. Every book lesson opens with one picture of its main idea
  // (tap each part to learn it), and "Picture it" draws the whole chapter as a
  // tappable map. Both end in a tap-only check built from the picture itself.
  // Works for prepared guides (idea-visuals.json overlay) and generated ones
  // (chapterVisual.takeaway/parts), with a fallback from the guide's own concepts.
  const ideaVisualData = JSON.parse(document.getElementById('idea-visuals-data')?.textContent || '{}');
  const ideaSessions = new Map(), ideaRecords = new Map();
  const IDEA_KINDS = {handoff:'A handoff',loop:'A loop',capacity:'A limit',decision:'A choice',layers:'Layers',compass:'A direction',release:'A fading response',network:'A web'};
  function ideaKey(rec){return (rec.bookId||activeBook.id)+'::'+rec.unitId;}
  function ideaSession(rec){const k=ideaKey(rec);ideaRecords.set(k,rec);if(!ideaSessions.has(k))ideaSessions.set(k,{part:-1,seen:[],check:null,node:-1,gap:null,gapOpen:false,nodesSeen:[]});return ideaSessions.get(k);}
  function ideaHash(text){let h=7;for(const c of String(text))h=(Math.imul(h,31)+c.codePointAt(0))|0;return Math.abs(h);}
  function ideaSentence(text,limit=180){
    const clean=String(text||'').replace(/\s+/g,' ').trim(),m=clean.match(/^.*?[.!?](?=\s|$)/);
    const first=m?m[0]:clean;if(first.length<=limit)return first;
    return first.slice(0,limit).replace(/\s+\S*$/,'')+'…';
  }
  function ideaApplies(rec){
    const book=books.find(b=>b.id===(rec?.bookId||activeBook.id))||activeBook;
    return !!rec?.guide&&book.sourceType!=='article'&&!rec.guide.articleAnalysis&&ideaVisual(rec).labels.filter(Boolean).length===3;
  }
  function ideaWords(text){return new Set(String(text||'').toLowerCase().match(/[a-z]{4,}/g)||[]);}
  function ideaVisual(rec){
    const g=roleContextGuide(rec),cv=g.chapterVisual||{},over=ideaVisualData[rec.bookId||activeBook.id]?.[rec.unitId]||{};
    const concepts=g.concepts||[];
    let labels=Array.isArray(over.labels)&&over.labels.length===3?over.labels:Array.isArray(cv.labels)&&cv.labels.length?cv.labels.slice(0,3):concepts.slice(0,3).map(c=>c.title);
    // Older guides may lack a visual and have one or two concepts: pad from the guide's own ideas.
    if(labels.length<3){const seen=new Set(labels.map(l=>String(l).toLowerCase()));for(const extra of [...concepts.map(c=>c.title),...(g.principles||[]).map(p=>p.title),...(g.flow?.nodes||[]).map(n=>n.label)]){if(labels.length>=3)break;if(extra&&!seen.has(String(extra).toLowerCase())){seen.add(String(extra).toLowerCase());labels=[...labels,extra];}}}
    const parts=labels.map((label,i)=>{
      const given=(Array.isArray(over.parts)?over.parts:Array.isArray(cv.parts)?cv.parts:[])[i];
      if(given)return given;
      const words=ideaWords(label);let best=concepts[i],score=-1;
      for(const c of concepts){let s=0;for(const w of ideaWords(c.title+' '+c.explanation))if(words.has(w))s++;if(s>score){score=s;best=c;}}
      return best?ideaSentence(best.explanation,200):ideaSentence(cv.caption||g.gist,200);
    });
    const kind=Object.hasOwn(IDEA_KINDS,over.kind||cv.kind)?(over.kind||cv.kind):'network';
    return {key:'idea:'+ideaKey(rec),kind,title:cv.title||g.title,takeaway:over.takeaway||cv.takeaway||ideaSentence(g.gist,170),labels,parts,caption:cv.caption||'',scene:over.scene||cv.scene||null};
  }
  // Every picture in the library, in a fixed order, so no two share a machine
  // (reader/iso-compose.js): all lessons first, then 30-min figures, then the one-off art.
  const ideaBundled=new Set(books.map(b=>b.id));
  function ideaLibraryOrder(){const bundled=ideaBundled;return [...books].filter(b=>!state.hiddenBooks?.[b.id]).sort((a,b)=>(bundled.has(b.id)-bundled.has(a.id))||(bundled.has(a.id)?0:String(a.id).localeCompare(String(b.id))));}
  isoSetKeys({
    token:()=>ideaLibraryOrder().map(b=>b.id+':'+(b.sourceType==='article'?'a':bookGuides(b).length+'/'+(typeof thirtyMinFor==='function'&&thirtyMinFor(b)?1:0))).join(','),
    keys(){
      const list=ideaLibraryOrder(),out=[];
      for(const b of list)if(b.sourceType!=='article')for(const r of bookGuides(b)){const rec={...r,bookId:b.id};if(ideaApplies(rec)){const v=ideaVisual(rec);out.push(['idea:'+ideaKey(rec),v.kind,3,{scene:v.scene}]);}}
      for(const b of list){const v=typeof thirtyMinFor==='function'?thirtyMinFor(b):null;if(v)tmFigureKeys(b,v).forEach(k=>out.push(k));}
      for(const b of list)out.push(b.sourceType==='article'?['glance:'+b.id,'glance',4]:['book:'+b.id,'release',3]);
      out.push(['today','network',3]);
      return out;
    }});
  // ---------- Reading ----------
  // A short page of real prose under the picture, so a lesson still reads like the book.
  // Prepared lessons carry it in the overlay; generated ones in guide.reading; older ones show the gist.
  function ideaReadingText(rec){
    const g=roleContextGuide(rec),over=ideaVisualData[rec.bookId||activeBook.id]?.[rec.unitId]?.reading,own=g.reading;
    const clean=list=>(Array.isArray(list)?list:[]).map(p=>String(p||'').trim()).filter(Boolean);
    const passage=clean(over?.passage).length?clean(over.passage):clean(own?.passage).length?clean(own.passage):clean(String(g.gist||'').split(/\n\s*\n/));
    return {passage,connect:String(over?.connect||own?.connect||'').trim(),forward:String(over?.forward||own?.forward||'').trim()};
  }
  function ideaReading(rec){
    if(!ideaApplies(rec))return '';
    const {passage}=ideaReadingText(rec);if(!passage.length)return '';
    return `<section class="idea-reading" aria-label="The chapter in brief"><p class="eyebrow">The chapter in brief</p>${passage.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`;
  }
  // The chapter in review: closes the lesson and carries the idea into the next chapter.
  function ideaForward(rec){
    if(!ideaApplies(rec))return '';
    const {forward}=ideaReadingText(rec);
    return forward?`<span class="connection-label">The chapter in review</span><div class="idea-reading is-closing"><p>${esc(forward)}</p></div>`:'';
  }
  function ideaConnect(rec){
    const {connect}=ideaReadingText(rec);
    return connect?`<p class="idea-connect">${esc(connect)}</p>`:'';
  }
  // ---------- Drawing ----------
  function ideaText(value,x,y,max=16,cls='iv-label'){
    const words=String(value||'').split(/\s+/),rows=[];let row='';
    for(const w of words){if(row&&row.length+w.length+1>max){rows.push(row);row=w;}else row+=(row?' ':'')+w;}
    if(row)rows.push(row);
    const shown=rows.slice(0,3);if(rows.length>3)shown[2]=shown[2].replace(/\W*$/,'')+'…';
    return `<text x="${x}" y="${y-(shown.length-1)*11+6}" text-anchor="middle" class="${cls}">${shown.map((r,i)=>`<tspan x="${x}" dy="${i?22:0}">${esc(r)}</tspan>`).join('')}</text>`;
  }
  // The picture is a machine whose working is the idea (reader/iso-machines.js);
  // the three labels sit under it as chips that select the matching part.
  function ideaArt(v,{id='iv',selected=-1,seen=[],hidden=-1,thumb=false,interactive=true}={}){
    const tap=interactive&&!thumb&&hidden<0;
    const svg=isoPick(v.key||'idea:'+v.title,v.kind,3,{scene:v.scene});
    if(thumb)return `<div class="ivm idea-art is-thumb">${isoThumb(svg,v.title+': '+v.labels.join(', '))}</div>`;
    const fig=isoFigure(svg,{selected,hidden,parts:3,interactive:tap,labels:v.labels,cls:'idea-art'});
    const chip=(l,i)=>{const cls=`ivm-chip${i===selected?' is-selected':''}${seen.includes(i)?' is-seen':''}${i===hidden?' is-gap':''}`,label=i===hidden?'?':l;
      return tap?`<button type="button" class="${cls}" data-action="iv-part" data-index="${i}" aria-pressed="${i===selected}"><i>${i+1}</i>${esc(label)}</button>`:`<span class="${cls}"><i>${i+1}</i>${esc(label)}</span>`;};
    return `<div class="ivm-wrap" id="${esc(id)}">${fig}<div class="ivm-chips" role="group" aria-label="${esc(v.title)}: the three parts">${v.labels.map(chip).join('')}</div></div>`;
  }
  // ---------- Big idea hero ----------
  function ideaDistractors(rec,correct,exclude,pick,book){
    const own=new Set(exclude.map(x=>String(x).toLowerCase()));
    const pool=[...new Set((book?bookGuides(book):bookGuides()).filter(r=>r.unitId!==rec.unitId&&r.guide).flatMap(pick))].filter(x=>x&&!own.has(String(x).toLowerCase()));
    pool.sort((a,b)=>ideaHash(a+rec.unitId)-ideaHash(b+rec.unitId));
    const choices=[correct,...pool.slice(0,2)];
    return choices.sort((a,b)=>ideaHash(a+'c'+rec.unitId)-ideaHash(b+'c'+rec.unitId));
  }
  function ideaCheck(rec,v,s){
    const hidden=ideaHash(rec.unitId)%3,correct=v.labels[hidden];
    const choices=ideaDistractors(rec,correct,v.labels,r=>ideaVisual(r).labels);
    if(choices.length<2)return '';
    const picked=s.check,right=picked!==null&&choices[picked]===correct;
    return `<div class="idea-check"><div class="idea-check-head"><p class="lab-kicker">Quick check</p><h3>One part is missing. Which belongs in the gap?</h3></div><figure class="idea-figure is-small">${ideaArt(v,{id:labId(rec,'iv-check'),hidden:right?-1:hidden,selected:right?hidden:-1,interactive:false})}</figure><div class="idea-choices" role="group" aria-label="Choose the missing part">${choices.map((c,i)=>`<button type="button" class="idea-choice${picked===i?(right?' is-right':' is-wrong'):''}" data-action="iv-check" data-index="${i}" ${right?'disabled':''} aria-pressed="${picked===i}">${esc(c)}</button>`).join('')}</div>${picked===null?'':right?`<p class="idea-feedback is-right" role="status"><strong>Right.</strong> ${esc(v.parts[hidden])}</p>`:`<p class="idea-feedback" role="status"><strong>Not this one.</strong> That piece comes from another chapter. Look at what sits next to the gap and try again.</p>`}</div>`;
  }
  function ideaHero(rec){
    if(!ideaApplies(rec))return '';
    const v=ideaVisual(rec),s=ideaSession(rec),i=s.part,done=s.seen.length>=3;
    const detail=i<0?`<p class="idea-hint">Tap each part of the picture to see what it means.</p>`:`<p class="idea-detail-kicker"><span>${i+1}</span>${esc(v.labels[i])}</p><p class="idea-detail-text">${esc(v.parts[i])}</p>`;
    const next=i<0?0:(i+1)%3;
    return `<section class="idea-hero" data-idea="${esc(ideaKey(rec))}" data-idea-stage="hero" aria-label="The big idea"><div class="idea-head"><p class="eyebrow">The big idea</p><span class="idea-kind">${esc(IDEA_KINDS[v.kind])}</span></div><h2 class="idea-takeaway">${esc(v.takeaway)}</h2><figure class="idea-figure">${ideaArt(v,{id:labId(rec,'iv-hero'),selected:i,seen:s.seen})}</figure><div class="idea-detail" role="status">${detail}</div><div class="idea-progress"><span class="idea-dots" aria-hidden="true">${[0,1,2].map(n=>`<i class="${s.seen.includes(n)?'is-on':''}"></i>`).join('')}</span><span>${done?'All three parts explored':`${s.seen.length} of 3 parts explored`}</span><button type="button" class="secondary idea-next" data-action="iv-part" data-index="${next}">${i<0?'Start with part 1':done&&i===2?'Back to part 1':'Next part'} →</button></div>${done?ideaCheck(rec,v,s):''}<p class="idea-note">A companion picture of the chapter, not the author’s figure.</p></section>`;
  }
  // ---------- Chapter map ----------
  function ideaLayout(flow){
    const nodes=flow.nodes||[],ids=nodes.map(n=>n.id),edges=(flow.edges||[]).filter(e=>ids.includes(e.from)&&ids.includes(e.to)&&e.from!==e.to);
    const out=new Map(ids.map(id=>[id,[]]));edges.forEach(e=>out.get(e.from).push(e));
    // Drop back edges so the rest is a DAG, then layer by longest path.
    const state=new Map(),back=new Set();
    const visit=id=>{state.set(id,1);for(const e of out.get(id)){if(state.get(e.to)===1)back.add(e);else if(!state.get(e.to))visit(e.to);}state.set(id,2);};
    ids.forEach(id=>{if(!state.get(id))visit(id);});
    const layer=new Map(ids.map(id=>[id,0]));
    if(edges.length){for(let k=0;k<ids.length;k++)for(const e of edges)if(!back.has(e))layer.set(e.to,Math.max(layer.get(e.to),layer.get(e.from)+1));}
    else ids.forEach((id,i)=>layer.set(id,i));
    const groups=[];ids.forEach(id=>{const l=layer.get(id);(groups[l]=groups[l]||[]).push(id);});
    const rows=[];groups.filter(Boolean).forEach(g=>{for(let k=0;k<g.length;k+=3)rows.push(g.slice(k,k+3));});
    const W=640,H=74,gap=58,pos=new Map();
    rows.forEach((row,r)=>{const w=Math.min(196,(W-(row.length+1)*14)/row.length);row.forEach((id,c)=>{const x=W/2+(c-(row.length-1)/2)*(w+14);pos.set(id,{x,y:24+H/2+r*(H+gap),w,h:H,row:r});});});
    return {nodes,edges,back,pos,height:24*2+rows.length*H+(rows.length-1)*gap,sequence:!edges.length};
  }
  function ideaMapSvg(rec,flow,{id,selected=-1,hidden=-1,interactive=true}){
    const L=ideaLayout(flow),sel=selected>=0?L.nodes[selected]?.id:null;
    const linked=new Set(sel?L.edges.filter(e=>e.from===sel||e.to===sel).flatMap(e=>[e.from,e.to]):[]);
    let paths='';
    const link=(a,b,on,dashed=false)=>{const p=L.pos.get(a),q=L.pos.get(b);let d;
      if(q.row>p.row){const y1=p.y+p.h/2,y2=q.y-q.h/2-4,m=(y1+y2)/2;d=`M${p.x} ${y1}C${p.x} ${m} ${q.x} ${m} ${q.x} ${y2}`;}
      else if(q.row===p.row){const s=q.x>p.x?1:-1;d=`M${p.x+s*p.w/2} ${p.y}H${q.x-s*(q.w/2+4)}`;}
      else{const x1=p.x+p.w/2,x2=q.x+q.w/2+4,cx=Math.max(x1,x2)+40;d=`M${x1} ${p.y}C${cx} ${p.y} ${cx} ${q.y} ${x2} ${q.y}`;}
      return `<path d="${d}" class="iv-line${on?' is-on':''}${sel&&!on?' is-dim':''}${dashed?' iv-dashed':''}" marker-end="url(#${id}-arrow)"/>`;};
    if(L.sequence)for(let k=0;k<L.nodes.length-1;k++)paths+=link(L.nodes[k].id,L.nodes[k+1].id,false,true);
    else for(const e of L.edges)paths+=link(e.from,e.to,sel&&(e.from===sel||e.to===sel));
    const nodes=L.nodes.map((n,i)=>{const p=L.pos.get(n.id),gap=i===hidden;
      const cls=`iv-part iv-node${i===selected?' is-selected':''}${sel&&i!==selected&&!linked.has(n.id)?' is-dim':''}${sel&&linked.has(n.id)&&i!==selected?' is-linked':''}${gap?' is-gap':''}`;
      const attrs=interactive&&hidden<0?` data-action="iv-node" data-index="${i}" role="button" tabindex="0" aria-pressed="${i===selected}" aria-label="${esc(n.label)}"`:'';
      return `<g class="${cls}"${attrs}><rect x="${p.x-p.w/2}" y="${p.y-p.h/2}" width="${p.w}" height="${p.h}" rx="20" class="iv-shape"/>${ideaText(gap?'?':n.label,p.x,p.y+2,Math.max(12,Math.floor(p.w/9.4)),'iv-label iv-node-label')}</g>`;}).join('');
    return `<svg class="idea-map-art" viewBox="0 0 640 ${Math.round(L.height)}" role="img" aria-labelledby="${id}-t"><title id="${id}-t">Map of ${L.nodes.length} ideas in this chapter</title><defs><marker id="${id}-arrow" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="currentColor" stroke-width="1.6"/></marker></defs>${paths}${nodes}</svg>`;
  }
  function ideaGap(rec,flow,s){
    const nodes=flow.nodes||[];if(nodes.length<3)return '';
    const deg=nodes.map(n=>(flow.edges||[]).filter(e=>e.from===n.id||e.to===n.id).length);
    const hidden=flow.edges?.length?deg.indexOf(Math.max(...deg)):ideaHash(rec.unitId)%nodes.length,correct=nodes[hidden].label;
    const choices=ideaDistractors(rec,correct,nodes.map(n=>n.label),r=>(roleContextGuide(r).flow?.nodes||[]).map(n=>n.label));
    if(choices.length<2)return '';
    const picked=s.gap,right=picked!==null&&choices[picked]===correct;
    return `<div class="idea-check"><div class="idea-check-head"><p class="lab-kicker">Fill the gap</p><h3>Which idea completes this map?</h3></div><figure class="idea-figure is-map is-small">${ideaMapSvg(rec,flow,{id:labId(rec,'iv-gap'),hidden:right?-1:hidden,selected:right?hidden:-1,interactive:false})}</figure><div class="idea-choices" role="group" aria-label="Choose the missing idea">${choices.map((c,i)=>`<button type="button" class="idea-choice${picked===i?(right?' is-right':' is-wrong'):''}" data-action="iv-gap" data-index="${i}" ${right?'disabled':''} aria-pressed="${picked===i}">${esc(c)}</button>`).join('')}</div>${picked===null?'':right?`<p class="idea-feedback is-right" role="status"><strong>Right.</strong> ${esc(nodes[hidden].detail)}</p>`:`<p class="idea-feedback" role="status"><strong>Not this one.</strong> That idea belongs to another chapter. Follow the arrows into the gap and try again.</p>`}</div>`;
  }
  function ideaMap(rec){
    if(!ideaApplies(rec))return '';
    const flow=roleContextGuide(rec).flow||{},nodes=flow.nodes||[];if(nodes.length<2)return '';
    const s=ideaSession(rec),i=s.node>=0&&s.node<nodes.length?s.node:-1,n=nodes[i];
    const conn=n?(flow.edges||[]).filter(e=>e.from===n.id||e.to===n.id).map(e=>{const out=e.from===n.id,j=nodes.findIndex(x=>x.id===(out?e.to:e.from));return j<0?'':`<button type="button" class="idea-link" data-action="iv-node" data-index="${j}"><span>${out?esc(e.label||'leads to')+' →':'← '+esc(e.label||'comes from')}</span><strong>${esc(nodes[j].label)}</strong></button>`;}).join(''):'';
    const detail=n?`<p class="idea-detail-kicker"><span>${i+1}</span>${esc(n.label)}</p><p class="idea-detail-text">${esc(n.detail)}</p>${conn?`<div class="idea-links">${conn}</div>`:''}`:`<p class="idea-hint">${flow.edges?.length?'Tap any idea. Its connections light up.':'Tap any idea to read it. The cards follow the chapter’s order.'}</p>`;
    return `<section class="idea-map" data-idea="${esc(ideaKey(rec))}" data-idea-stage="map" aria-label="The chapter map"><div class="idea-head"><p class="eyebrow">The chapter map</p><span class="idea-kind">${nodes.length} ideas${flow.edges?.length?` · ${flow.edges.length} links`:''}</span></div><h2 class="idea-takeaway is-quiet">See how the whole chapter fits together.</h2>${ideaConnect(rec)}<figure class="idea-figure is-map">${ideaMapSvg(rec,flow,{id:labId(rec,'iv-map'),selected:i})}</figure><div class="idea-detail" role="status">${detail}</div><div class="idea-progress"><span>${s.nodesSeen.length} of ${nodes.length} ideas opened</span>${s.gapOpen?'':`<button type="button" class="secondary idea-next" data-action="iv-gap-open">Test yourself: fill the gap →</button>`}</div>${s.gapOpen?ideaGap(rec,flow,s):''}${flow.limit?`<p class="idea-note">${esc(flow.limit)}</p>`:''}</section>`;
  }
  // ---------- Interaction ----------
  function ideaRefresh(section,rec,el){
    const stage=section.dataset.ideaStage,action=el?.dataset.action,index=el?.dataset.index,y=window.scrollY;
    const holder=document.createElement('div');holder.innerHTML=stage==='map'?ideaMap(rec):ideaHero(rec);
    const next=holder.firstElementChild;if(!next)return;section.replaceWith(next);
    const target=[...next.querySelectorAll('[data-action]')].find(x=>x.dataset.action===action&&x.dataset.index===index&&!x.disabled)||next.querySelector('.idea-choice.is-right,.idea-choice,.idea-next');
    target?.focus({preventScroll:true});window.scrollTo({top:y,behavior:'instant'});
  }
  function handleIdeaAction(action,el){
    if(!action?.startsWith('iv-'))return false;
    const section=el.closest('[data-idea]'),rec=ideaRecords.get(section?.dataset.idea);if(!rec)return true;
    const s=ideaSession(rec),i=Number(el.dataset.index);
    if(action==='iv-part'&&i>=0&&i<3){s.part=i;if(!s.seen.includes(i))s.seen.push(i);}
    else if(action==='iv-check'){s.check=i;const v=ideaVisual(rec),hidden=ideaHash(rec.unitId)%3,choices=ideaDistractors(rec,v.labels[hidden],v.labels,r=>ideaVisual(r).labels);if(choices[i]===v.labels[hidden]&&typeof startPictureReview==='function')startPictureReview(rec);}
    else if(action==='iv-node'){s.node=i;if(!s.nodesSeen.includes(i))s.nodesSeen.push(i);}
    else if(action==='iv-gap-open')s.gapOpen=true;
    else if(action==='iv-gap')s.gap=i;
    ideaRefresh(section,rec,el);return true;
  }
  document.addEventListener('click',event=>{const el=event.target.closest?.('[data-action^="iv-"]');if(el&&handleIdeaAction(el.dataset.action,el)){event.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',event=>{const el=event.target.closest?.('g[role="button"][data-action^="iv-"]');if(el&&(event.key==='Enter'||event.key===' ')){event.preventDefault();handleIdeaAction(el.dataset.action,el);}});
