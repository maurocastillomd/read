  function chapterVisualData(rec){
    if(roleContextGuide(rec).chapterVisual)return roleContextGuide(rec).chapterVisual;
    const labels=(rec.guide.concepts||[]).slice(0,3).map(c=>c.title).filter(Boolean);
    return {kind:'network',title:rec.guide.title,caption:'Companion concept overview. Read each explanation for the relationship and its qualifications.',labels:labels.length?labels:[rec.guide.title],legacy:true};
  }
  function chapterArtwork(rec,thumbnail=false){
    if(typeof ideaApplies==='function'&&ideaApplies(rec))return ideaArt(ideaVisual(rec),{id:labId(rec,thumbnail?'iv-thumb':'iv-art'),thumb:thumbnail,interactive:false});
    const v=chapterVisualData(rec),id=labId(rec,thumbnail?'chapter-thumb':'chapter-image'),labels=v.labels;
    let positions={handoff:[[105,165],[300,165],[495,165]],loop:[[145,115],[455,115],[300,270]],capacity:[[110,158],[300,158],[490,158]],decision:[[300,85],[135,235],[465,235]],layers:[[300,78],[300,175],[300,272]],compass:[[120,215],[300,88],[480,215]],release:[[115,155],[300,155],[485,155]],network:[[130,130],[470,130],[300,260]]}[v.kind]||[[105,165],[300,165],[495,165]];
    let lines={handoff:'M180 165H222M378 165H412',loop:'M220 94Q355 30 406 73M457 156Q450 260 374 271M225 271Q123 265 133 158',capacity:'M40 245H560M40 245V77M40 77H560M200 77V245M400 77V245',decision:'M267 128L163 195M333 128L437 195',layers:'M300 111V134M300 207V231',compass:'M172 192L263 117M337 117L428 192',release:'M190 155H222M378 155H410',network:'M203 145L251 225M349 225L397 145M206 130H390'}[v.kind]||'M180 165H222M378 165H412';
    if(labels.length===1){positions=[[300,175]];lines='';}
    else if(labels.length===2){positions=[[170,175],[430,175]];lines='M246 175H354';}
    const text=(value,x,y)=>{
      const words=String(value||'').split(/\s+/),rows=[];let row='';
      for(const word of words){if(row.length+word.length>18&&row){rows.push(row);row=word;}else row+=(row?' ':'')+word;}if(row)rows.push(row);
      return `<text x="${x}" y="${y-(Math.min(3,rows.length)-1)*11}" class="chapter-art-label" text-anchor="middle">${rows.slice(0,3).map((line,i)=>`<tspan x="${x}" dy="${i?23:0}">${esc(line)}</tspan>`).join('')}</text>`;
    };
    const nodes=positions.map(([x,y],i)=>`<rect x="${x-76}" y="${y-42}" width="152" height="84" rx="${v.kind==='loop'?42:12}" class="chapter-art-node node-${i}"/>${thumbnail?'':text(labels[i],x,y+6)}`).join('');
    const diagram=`${lines?`<path d="${lines}" class="chapter-art-link" ${v.kind==='capacity'||v.legacy?'':`marker-end="url(#${id}-arrow)"`}/>`:''}${nodes}${v.kind==='release'?'<path d="M75 225H155M455 225H515" class="chapter-art-emphasis"/>':''}`;
    const titleWords=String(v.title||'').split(/\s+/),titleRows=[];let titleRow='';
    for(const word of titleWords){if(titleRow&&(titleRow.length+word.length+1)>18){titleRows.push(titleRow);titleRow=word;}else titleRow+=(titleRow?' ':'')+word;}if(titleRow)titleRows.push(titleRow);
    const visibleTitle=titleRows.slice(0,2);if(titleRows.length>2)visibleTitle[1]+='…';
    const thumbTitle=`<text x="300" y="${visibleTitle.length>1?278:304}" class="chapter-thumb-title" text-anchor="middle">${visibleTitle.map((line,i)=>`<tspan x="300" dy="${i?46:0}">${esc(line)}</tspan>`).join('')}</text>`;
    return `<svg class="chapter-art ${thumbnail?'is-thumbnail':''}" viewBox="0 0 600 350" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${esc(v.title)}</title><desc id="${id}-desc">${esc(labels.join('; ')+'. '+v.caption)}</desc><defs><marker id="${id}-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="currentColor" stroke-width="1.4"/></marker><pattern id="${id}-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor" opacity=".12"/></pattern></defs><rect x="10" y="10" width="580" height="330" rx="22" fill="url(#${id}-grid)"/>${thumbnail?`<g class="chapter-thumb-motif" transform="translate(90 4) scale(.7)">${diagram}</g>${thumbTitle}`:diagram}<text x="300" y="337" text-anchor="middle" class="chapter-art-note">${thumbnail?'':v.legacy?'A companion concept overview':'A companion concept image · follow the relationships'}</text></svg>`;
  }
  function chapterConnection(rec,position,closing=''){
    const path=roleContextGuide(rec).learningPath;if(!path)return position==='closing'&&closing?`<section class="chapter-connection chapter-next has-review">${closing}</section>`:'';
    const all=bookGuides(),index=all.findIndex(r=>r.unitId===rec.unitId),previous=all[index-1],next=all[index+1];
    if(position==='opening')return `<section class="chapter-connection"><p class="eyebrow">Where this lesson takes you</p><div class="chapter-connection-grid"><div><span class="connection-label">The connection so far</span><p>${esc(path.previous)}</p>${previous?`<div class="chapter-available-navigation"><span>${previous.chapterId===rec.chapterId?'Previous available part':'Previous available lesson'}</span><button class="text-button" data-action="chapter-return" data-unit="${esc(previous.unitId)}">← ${esc(roleContextGuide(previous).title)}</button></div>`:''}</div><div><span class="connection-label">This lesson adds</span><p>${esc(path.current)}</p></div></div></section>`;
    if(position==='story'&&!coordinatorExamplesEnabled())return '';
    if(position==='story')return `<aside class="example-story"><p class="eyebrow">Real-life example · fictional continuing case</p><p>${esc(path.thread)}</p><small>This fictional example applies the idea. The linked source passages establish what the author says.</small></aside>`;
    return `<section class="chapter-connection chapter-next${closing?' has-review':''}">${closing||`<span class="connection-label">Carry the idea forward</span><p>${esc(path.next)}</p>`}${next?`<div class="chapter-available-navigation"><span>${next.chapterId===rec.chapterId?'Next available part':'Next available lesson'}</span><button class="text-button" data-action="chapter-return" data-unit="${esc(next.unitId)}">${esc(roleContextGuide(next).title)} →</button></div>`:''}</section>`;
  }
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-action="chapter-return"]');if(button)go('explore',{unit:button.dataset.unit,guideStep:0});});
