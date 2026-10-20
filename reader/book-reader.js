  // The original-text reader: a quiet page with the book's own structure,
  // tappable endnotes, figures, and controls that stay out of the way.
  const bookReaderIcons={
    back:'<path d="M15 5l-7 7 7 7"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    next:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
  };
  const brIcon=name=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${bookReaderIcons[name]}</svg>`;
  const BR_WPM=230;
  let bookReaderKey='',bookReaderJump=null,bookReaderChromeHidden=false,bookReaderLastY=0,bookReaderAutoRead='';
  function bookReaderWords(chapter){return cleanParagraphs(chapter).join(' ').split(/\s+/).filter(Boolean).length;}
  function bookReaderMinutes(chapter,ratio=0){return Math.max(1,Math.round(bookReaderWords(chapter)*(1-ratio)/BR_WPM));}
  function bookReaderLabel(chapter){return chapter.label||'';}
  function bookReaderNotes(text,chapter){
    // Superscript note numbers open the chapter's own endnote in place.
    return esc(text).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,sup=>{
      const n=EpubStructure.fromSuperscript(sup);
      return chapter.notes?.[n]?`<button class="br-note-ref" data-action="br-note" data-note="${n}" aria-label="Note ${n}">${n}</button>`:`<sup>${n}</sup>`;
    });
  }
  function bookReaderLead(html){
    // Many books open a chapter with its first words in capitals.
    const m=html.match(/^([“"]?[A-Z][A-Z’'.,-]*(?:\s+[A-Z][A-Z’'.,-]*)*)(?=\s+[A-Za-z])/);
    return m&&m[1].replace(/[^A-Z]/g,'').length>=3?`<span class="br-lead">${m[1]}</span>${html.slice(m[1].length)}`:html;
  }
  function bookReaderBlocks(chapter){
    const lines=String(activeBook?.sourceType==='article'?articleDisplayText(chapter.text,activeBook):chapter.text||'').split(/\n+/).map(l=>l.trim()).filter(Boolean).map(EpubStructure.structuredLine);
    const normal=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
    const title=normal(chapter.title);
    while(lines.length&&lines[0].kind!=='figure'&&normal(lines[0].text)===title)lines.shift();
    const out=[];let i=0,first=true,headingIndex=0;
    // Opening quotes: a part's dictionary definition, then the chapter's epigraph.
    const opening=[];while(i<lines.length&&lines[i].kind==='quote'&&opening.length<12)opening.push(lines[i++].text);
    if(opening.length){
      const part=normal(chapter.partTitle);
      if(part&&normal(opening[0]).startsWith(part)){
        const term=opening.shift(),split=term.match(/^(.*?\))\s+(.+)$/);
        const head=split?split[1]:term,definition=split?split[2]:opening.length&&!/^[A-Z][^,]{0,40},\s/.test(opening[0])&&opening.length>2?opening.shift():'';
        const word=head.match(/^(\S+)(.*)$/);
        out.push(`<div class="br-definition"><p class="br-definition-term"><dfn>${esc(word?word[1]:head)}</dfn>${esc(word?word[2]:'')}</p>${definition?`<p class="br-definition-text">${esc(definition)}</p>`:''}</div>`);
      }
      if(opening.length){
        const last=opening[opening.length-1],attribution=opening.length>1&&last.length<90&&(/^[—–-]/.test(last)||/^[A-Z][^.!?]{0,60},\s+\S/.test(last)||/^[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3}$/.test(last));
        const verse=attribution?opening.slice(0,-1):opening;
        out.push(`<div class="br-epigraph">${verse.map(t=>`<p class="br-epigraph-line">${bookReaderNotes(t,chapter)}</p>`).join('')}${attribution?`<p class="br-attribution">${esc(last.replace(/^[—–-]\s*/,''))}</p>`:''}</div>`);
      }
    }
    let afterBreak=true,refs=false;const article=activeBook?.sourceType==='article';
    for(;i<lines.length;i++){
      const b=lines[i];
      // Research tables arrive as rows with | between columns. Show them as a table.
      if(b.kind==='text'&&/^\[Table rows; columns separated by \|\]$/.test(b.text)){
        const rows=[];while(lines[i+1]?.kind==='text'&&lines[i+1].text.includes(' | '))rows.push(lines[++i].text.split(' | ').map(cell=>cell.trim()));
        if(rows.length){const [head,...body]=rows;out.push(`<div class="br-table" role="region" aria-label="Table" tabindex="0"><table><thead><tr>${head.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);afterBreak=true;}
        continue;
      }
      if(b.kind==='figure'){
        const src=chapter.figures?.[b.key];if(!src)continue;
        const caption=lines[i+1]?.kind==='caption'?lines[++i].text:'';
        out.push(`<figure class="br-figure"><button class="br-figure-open" data-action="br-figure" data-src="${esc(src)}" data-caption="${esc(caption)}" aria-label="Enlarge figure${caption?': '+esc(caption):''}"><img src="${esc(src)}" alt="${esc(caption)}" loading="lazy" decoding="async"></button>${caption?`<figcaption>${esc(caption)}</figcaption>`:''}</figure>`);
        afterBreak=true;continue;
      }
      if(b.kind==='heading'){
        if(refs){out.push('</div></details>');refs=false;}
        const text=article?articleHeadingText(b.text):b.text;
        // A paper's reference list folds away so the reading ends at its conclusions.
        if(article&&/^(?:\d+\.?\s*)?(?:references|bibliography|literature cited|works cited|reference list)$/i.test(text)){
          let n=0;for(let j=i+1;j<lines.length&&lines[j].kind!=='heading';j++)if(lines[j].kind==='text')n++;
          out.push(`<details class="br-refs"><summary><h2 class="br-heading" id="br-h-${headingIndex++}">${esc(text)}</h2><span class="br-refs-count">${n} ${n===1?'entry':'entries'} · Tap to show</span></summary><div class="br-refs-body">`);refs=true;afterBreak=true;continue;
        }
        out.push(`<h2 class="br-heading" id="br-h-${headingIndex++}">${esc(text)}</h2>`);afterBreak=true;continue;
      }
      if(b.kind==='caption'){out.push(`<p class="br-caption">${esc(b.text)}</p>`);afterBreak=true;continue;}
      if(b.kind==='quote'){out.push(`<p class="br-quote">${bookReaderNotes(b.text,chapter)}</p>`);afterBreak=true;continue;}
      const bullet=/^[•▪●◦]\s/.test(b.text);
      let html=bookReaderNotes(b.text,chapter);
      const classes=[];
      if(bullet)classes.push('br-bullet');
      else if(first){classes.push('br-first');html=bookReaderLead(html);first=false;}
      else if(afterBreak)classes.push('br-noindent');
      out.push(`<p${classes.length?` class="${classes.join(' ')}"`:''}>${html}</p>`);
      afterBreak=bullet;
    }
    if(refs)out.push('</div></details>');
    return out.join('');
  }
  function bookReaderPartLine(chapter){
    if(!chapter.partTitle)return '';
    return `<p class="br-part">${esc(chapter.partLabel||(chapter.partNumber?'Part '+chapter.partNumber:'Part'))}<span aria-hidden="true"> · </span>${esc(chapter.partTitle)}</p>`;
  }
  function bookReaderView(){
    if(typeof THIRTY_MIN_ID!=='undefined'&&chapterId===THIRTY_MIN_ID)return thirtyMinView();
    const c=activeBook.chapters.find(c=>c.id===chapterId)||activeBook.chapters[0];chapterId=c.id;
    const idx=activeBook.chapters.indexOf(c),prev=activeBook.chapters[idx-1],next=activeBook.chapters[idx+1];
    const ratio=readingPosition(state,activeBook.id,c.id),percent=Math.round(ratio*100),read=state.checks[activeBook.id]?.[progressKey('read',c.id)]===true;
    const rec=bookGuides().find(g=>g.chapterId===c.id),checks=rec?tapQuestions(rec,'remember').length:0;
    const label=bookReaderLabel(c);
    if(activeBook.sourceType==='article')return articleReaderView(c,{ratio,percent,read,rec,checks});
    return `<div class="book-reader${bookReaderChromeHidden?' br-chrome-hidden':''}" data-book-reader>
      <header class="br-bar" data-br-bar>
        <button class="br-icon" data-action="overview" aria-label="Back to ${esc(activeBook.title)}" title="Back to the book">${brIcon('back')}</button>
        <button class="br-title" data-action="br-contents" aria-haspopup="dialog" aria-label="Contents. Now reading ${esc((label?label+', ':'')+c.title)}"><span class="br-title-book">${esc(activeBook.title)}</span><span class="br-title-chapter">${esc(label?label+' · ':'')}${esc(c.title)}</span></button>
        <div class="br-actions">
          <button class="br-icon" data-action="br-contents" aria-label="Contents" title="Contents">${brIcon('list')}</button>
          ${raButton()}
          <button class="br-icon" data-action="br-search" aria-label="Search this book" title="Search">${brIcon('search')}</button>
          ${bookmarkPageButton()}
          <button class="br-icon br-aa" data-action="reading-settings" aria-label="Text and page appearance" title="Text and page">Aa</button>
          <button class="br-icon" data-action="br-more" aria-label="More" title="More">${brIcon('more')}</button>
        </div>
      </header>
      <article class="reader-article br-page" lang="en">
        <header class="br-opener">${bookReaderPartLine(c)}${label?`<p class="br-chapter-label">${esc(label)}</p>`:''}<h1>${esc(c.title)}</h1><p class="br-meta">${bookReaderMinutes(c)} min read${activeBook.author?' · '+esc(activeBook.author):''}</p></header>
        ${bookReaderBlocks(c)}
      </article>
      <section class="br-end" aria-label="End of ${esc(c.title)}">
        <p class="br-end-mark" aria-hidden="true">❦</p>
        <p class="br-end-status" data-br-read-status>${read?`${brIcon('check')} Finished`:`End of ${esc(label||c.title)}`}</p>
        ${checks?`<button class="br-card br-card-check" data-action="br-check" data-chapter="${esc(c.id)}"><span class="br-card-kicker">Check what stuck</span><strong>${checks} quick questions</strong><span>Tap to answer. No typing.</span></button>`:''}
        ${next?`<button class="br-card br-card-next" data-action="reader" data-chapter="${esc(next.id)}"><span class="br-card-kicker">Next${next.label?' · '+esc(next.label):''}</span><strong>${esc(next.title)}</strong><span>${bookReaderMinutes(next)} min read ${brIcon('next')}</span></button>`:`<button class="br-card" data-action="overview"><span class="br-card-kicker">You reached the end</span><strong>Back to the book</strong></button>`}
        <div class="br-end-links">${prev?`<button class="text-button" data-action="reader" data-chapter="${esc(prev.id)}">← ${esc(prev.title)}</button>`:''}<button class="text-button" data-action="mark-section-read" aria-pressed="${read}">${read?'Section read ✓':'Mark section read'}</button></div>
      </section>
      <footer class="br-progress" aria-label="Reading progress">
        <progress data-reading-position value="${percent}" max="100" aria-label="Position in this chapter"></progress>
        <div class="br-progress-text"><span data-br-left>${bookReaderMinutes(c,ratio)} min left in chapter</span><span><span data-reading-percent>${percent}%</span><span class="br-progress-of"> · ${idx+1} of ${activeBook.chapters.length}</span></span></div>
      </footer>
    </div>`;
  }
  // An article reads on the same page as a book, with an article's opener and ending.
  // PDF headings often arrive in capitals; show them the way a magazine would.
  function articleHeadingText(text){
    const t=String(text||'').trim(),letters=t.replace(/[^A-Za-z]/g,'');
    if(letters.length<4||letters!==letters.toUpperCase())return t;
    const small=new Set(['a','an','and','as','at','by','for','in','of','on','or','the','to','vs','with']);
    return t.toLowerCase().replace(/[a-z][a-z'’]*/g,(w,at)=>at>0&&small.has(w)?w:w[0].toUpperCase()+w.slice(1));
  }
  function articleHeadings(c){return articleDisplayText(c.text,activeBook).split(/\n+/).map(l=>EpubStructure.structuredLine(l.trim())).filter(l=>l.kind==='heading').map(l=>articleHeadingText(l.text));}
  // The bar shows which section you are in while you scroll a long paper.
  function articleCurrentSection(){
    const label=document.querySelector('.br-article .br-title-book');if(!label)return;
    let current='';for(const h of document.querySelectorAll('.br-article .br-page .br-heading')){if(h.getBoundingClientRect().top>140)break;current=h.textContent;}
    const text=current||label.dataset.host||'Article';if(label.textContent!==text)label.textContent=text;
  }
  function articleReaderView(c,{ratio,percent,read,rec,checks}){
    const host=articleHost(),hasBreakdown=bookGuides().some(g=>g.guide?.articleAnalysis);
    return `<div class="book-reader br-article${bookReaderChromeHidden?' br-chrome-hidden':''}" data-book-reader>
      <header class="br-bar" data-br-bar>
        <button class="br-icon" data-action="overview" aria-label="Back to the breakdown" title="Back to the breakdown">${brIcon('back')}</button>
        <button class="br-title" data-action="br-contents" aria-haspopup="dialog" aria-label="Sections of this article"><span class="br-title-book" data-host="${esc(host||'Article')}">${esc(host||'Article')}</span><span class="br-title-chapter">${esc(activeBook.title)}</span></button>
        <div class="br-actions">
          <button class="br-icon" data-action="br-contents" aria-label="Sections" title="Sections">${brIcon('list')}</button>
          ${raButton()}
          <button class="br-icon" data-action="br-search" aria-label="Search this article" title="Search">${brIcon('search')}</button>
          ${shareButton('br-icon','Share this paper')}
          ${bookmarkPageButton()}
          <button class="br-icon br-aa" data-action="reading-settings" aria-label="Text and page appearance" title="Text and page">Aa</button>
          <button class="br-icon" data-action="br-more" aria-label="More" title="More">${brIcon('more')}</button>
        </div>
      </header>
      <article class="reader-article br-page" lang="en">
        <header class="br-opener"><p class="br-chapter-label">${esc(host?'Article · '+host:'Article')}</p><h1>${esc(activeBook.title)}</h1><p class="br-meta">${bookReaderMinutes(c)} min read${activeBook.author?' · '+esc(activeBook.author):''}</p></header>
        ${bookReaderBlocks(c)}
      </article>
      <section class="br-end" aria-label="End of the article">
        <p class="br-end-mark" aria-hidden="true">❦</p>
        <p class="br-end-status" data-br-read-status>${read?`${brIcon('check')} Finished`:'End of the article'}</p>
        <button class="br-card br-card-breakdown" data-action="overview"><span class="br-card-kicker">${hasBreakdown?'Research breakdown':'Breakdown'}</span><strong>${hasBreakdown?'Question, study, findings, limits':'See the breakdown'}</strong><span>Each point links back to the exact words. ${brIcon('next')}</span></button>
        ${checks?`<button class="br-card br-card-check" data-action="br-check" data-chapter="${esc(c.id)}"><span class="br-card-kicker">Check what stuck</span><strong>${checks} quick questions</strong><span>Tap to answer. No typing.</span></button>`:''}
        <div class="br-end-links"><button class="text-button" data-action="mark-section-read" aria-pressed="${read}">${read?'Section read ✓':'Mark section read'}</button></div>
      </section>
      <footer class="br-progress" aria-label="Reading progress">
        <progress data-reading-position value="${percent}" max="100" aria-label="Position in this article"></progress>
        <div class="br-progress-text"><span data-br-left>${bookReaderMinutes(c,ratio)} min left</span><span data-reading-percent>${percent}%</span></div>
      </footer>
    </div>`;
  }
  function openArticleSections(){
    const c=activeBook.chapters.find(c=>c.id===chapterId)||activeBook.chapters[0],headings=articleHeadings(c);
    const d=bookReaderSheet('br-contents','Sections');
    d.innerHTML=`${bookReaderSheetHead('br-contents','Sections')}<p class="br-sheet-sub">${esc(activeBook.title)}</p><div class="br-toc"><ol><li><button class="br-toc-row" data-action="br-heading" data-heading="top"><span class="br-toc-label"></span><span class="br-toc-title">Start of the article</span><span class="br-toc-state">${bookReaderMinutes(c)} min</span></button></li>${headings.map((h,i)=>`<li><button class="br-toc-row" data-action="br-heading" data-heading="${i}"><span class="br-toc-label"></span><span class="br-toc-title">${esc(h)}</span><span class="br-toc-state"></span></button></li>`).join('')}</ol>${headings.length?'':'<p class="br-sheet-sub">This article has no section headings.</p>'}</div>`;
    d.showModal();
  }
  // Called by the reading meter whenever the position changes.
  function bookReaderProgress(ratio){
    if(view!=='reader')return;
    if(typeof tmIsOpen==='function'&&tmIsOpen()){thirtyMinProgress(ratio);return;}
    const c=activeBook.chapters.find(c=>c.id===chapterId);if(!c)return;
    const left=document.querySelector('[data-br-left]');
    const unit=activeBook.sourceType==='article'?'':' in chapter';
    if(!unit)articleCurrentSection();
    if(left)left.textContent=ratio>.985?(unit?'Chapter finished':'Finished'):bookReaderMinutes(c,ratio)+' min left'+unit;
    const key=progressKey('read',c.id),checks=state.checks[activeBook.id]||={};
    // Reaching the end of a chapter marks it read once; the reader can undo it below.
    if(ratio>.985&&progressReaderMoved&&!checks[key]&&bookReaderAutoRead!==activeBook.id+'/'+c.id){
      bookReaderAutoRead=activeBook.id+'/'+c.id;checks[key]=true;save();sidebar();
      document.querySelectorAll('[data-action="mark-section-read"]').forEach(b=>{b.setAttribute('aria-pressed','true');b.textContent='Section read ✓';});
      const status=document.querySelector('[data-br-read-status]');if(status)status.innerHTML=brIcon('check')+' Finished';
    }
  }
  function bookReaderSheet(id,title){
    let d=document.getElementById(id);
    if(!d){
      d=document.createElement('dialog');d.id=id;d.className='br-sheet';d.setAttribute('aria-labelledby',id+'-title');
      d.addEventListener('click',e=>{if(e.target===d)d.close();});
      document.body.append(d);
    }
    d.dataset.title=title;return d;
  }
  function bookReaderSheetHead(id,title,extra=''){return `<div class="br-sheet-head"><h2 id="${id}-title">${esc(title)}</h2>${extra}<button class="br-icon" data-action="br-close" aria-label="Close">${brIcon('close')}</button></div>`;}
  function openBookReaderContents(){
    const d=bookReaderSheet('br-contents','Contents');
    const checks=state.checks[activeBook.id]||{};
    const groups=hasBookStructure(activeBook)?bookStructureGroups(activeBook):[{label:'',chapters:activeBook.chapters}];
    const row=c=>{const done=checks[progressKey('read',c.id)]===true,here=c.id===chapterId,pct=Math.round(readingPosition(state,activeBook.id,c.id)*100);
      return `<li><button class="br-toc-row${here?' is-current':''}" data-action="reader" data-chapter="${esc(c.id)}" ${here?'aria-current="true"':''}><span class="br-toc-label">${esc(c.label||'')}</span><span class="br-toc-title">${esc(c.title)}</span><span class="br-toc-state">${done?brIcon('check'):here||pct?pct+'%':bookReaderMinutes(c)+' min'}</span></button></li>`;};
    const read=activeBook.chapters.filter(c=>checks[progressKey('read',c.id)]===true).length;
    d.innerHTML=`${bookReaderSheetHead('br-contents',activeBook.title)}<p class="br-sheet-sub">${esc(activeBook.author||'')}${activeBook.author?' · ':''}${read} of ${activeBook.chapters.length} sections read</p><div class="br-toc">${groups.map(g=>`${g.label?`<h3>${esc(g.label)}</h3>`:''}<ol>${g.chapters.map(row).join('')}</ol>`).join('')}</div>`;
    d.showModal();const current=d.querySelector('.is-current');if(current){d.scrollTop=Math.max(0,current.offsetTop-d.clientHeight/2);current.focus({preventScroll:true});}
  }
  function bookReaderSearch(query){
    const target=document.getElementById('br-search-results');if(!target)return;
    const q=query.trim().toLocaleLowerCase();if(q.length<2){target.innerHTML=`<p class="br-sheet-sub">${activeBook.sourceType==='article'?'Search the whole article.':'Search every chapter of this book.'}</p>`;return;}
    const hits=[];
    for(const c of activeBook.chapters){
      const paras=cleanParagraphs(c);
      paras.forEach((p,pi)=>{const at=p.toLocaleLowerCase().indexOf(q);if(at>=0&&hits.length<60)hits.push({c,pi,p,at});});
    }
    const snippet=({p,at})=>{const s=Math.max(0,at-60),e=Math.min(p.length,at+q.length+90);return (s?'…':'')+esc(p.slice(s,at))+'<mark>'+esc(p.slice(at,at+q.length))+'</mark>'+esc(p.slice(at+q.length,e))+(e<p.length?'…':'');};
    target.innerHTML=hits.length?`<p class="br-sheet-sub">${hits.length>=60?'First 60 matches':hits.length+' match'+(hits.length===1?'':'es')}</p><ol class="br-results">${hits.map(h=>`<li><button data-action="br-search-go" data-chapter="${esc(h.c.id)}" data-paragraph="${h.pi}" data-query="${esc(query.trim())}"><span class="br-result-where">${esc(h.c.label?h.c.label+' · ':'')}${esc(h.c.title)}</span><span class="br-result-text">${snippet(h)}</span></button></li>`).join('')}</ol>`:`<p class="br-sheet-sub">No matches for “${esc(query.trim())}”.</p>`;
  }
  function openBookReaderSearch(){
    const d=bookReaderSheet('br-search','Search');
    if(!d.querySelector('input')){
      const what=activeBook.sourceType==='article'?'article':'book';d.innerHTML=`${bookReaderSheetHead('br-search','Search this '+what)}<input type="search" id="br-search-input" placeholder="A word or phrase" autocomplete="off" enterkeyhint="search" aria-label="Search this ${what}"><div id="br-search-results" aria-live="polite"></div>`;
      d.querySelector('input').addEventListener('input',e=>bookReaderSearch(e.target.value));
    }
    bookReaderSearch(d.querySelector('input').value);d.showModal();d.querySelector('input').focus();
  }
  function openBookReaderMore(){
    const c=activeBook.chapters.find(c=>c.id===chapterId),rec=bookGuides().find(g=>g.chapterId===chapterId);
    const d=bookReaderSheet('br-more','More');
    const article=activeBook.sourceType==='article';
    d.innerHTML=`${bookReaderSheetHead('br-more',article?'This article':'This chapter')}<div class="br-menu">${article?'<button data-action="overview">See the research breakdown</button>':''}${rec?`<button data-action="chapter-guide" data-chapter="${esc(c.id)}">${article?'Open the full lesson':'Open the guide for this chapter'}</button>`:''}${originalPdfLink(c,'See the printed pages (PDF)')}${documentSourceLink(activeBook)}<button data-action="reader-start">Go to the start of the ${article?'article':'chapter'}</button><button data-action="packet">Export learning packet ↓</button><button data-action="toggle-sidebar">Show or hide the sidebar</button></div>`;
    d.showModal();
  }
  function openBookReaderNote(n){
    const c=activeBook.chapters.find(c=>c.id===chapterId),text=c?.notes?.[n];if(!text)return;
    const d=bookReaderSheet('br-note','Note');d.classList.add('br-note-sheet');
    d.innerHTML=`${bookReaderSheetHead('br-note','Note '+n)}<p class="br-note-text">${esc(text)}</p>`;
    d.showModal();
  }
  function openBookReaderFigure(src,caption){
    const d=bookReaderSheet('br-figure','Figure');d.classList.add('br-figure-sheet');
    d.innerHTML=`${bookReaderSheetHead('br-figure',caption||'Figure')}<img src="${esc(src)}" alt="${esc(caption)}">`;
    d.showModal();
  }
  function closeBookReaderSheets(){document.querySelectorAll('dialog.br-sheet[open]').forEach(d=>d.close());}
  function bookReaderShowChrome(show){
    bookReaderChromeHidden=!show;document.querySelector('[data-book-reader]')?.classList.toggle('br-chrome-hidden',!show);
  }
  function handleBookReaderAction(action,el){
    if(action==='br-contents'){if(activeBook.sourceType==='article')openArticleSections();else openBookReaderContents();return true;}
    if(action==='br-heading'){
      closeBookReaderSheets();progressReaderMoved=true;
      const target=el.dataset.heading==='top'?document.querySelector('.br-opener'):document.getElementById('br-h-'+el.dataset.heading);
      if(target){const y=target.getBoundingClientRect().top+window.scrollY-(el.dataset.heading==='top'?100:80);window.scrollTo({top:Math.max(0,y),behavior:'instant'});}
      return true;
    }
    if(action==='br-search'){openBookReaderSearch();return true;}
    if(action==='br-more'){openBookReaderMore();return true;}
    if(action==='br-note'){openBookReaderNote(el.dataset.note);return true;}
    if(action==='br-figure'){openBookReaderFigure(el.dataset.src,el.dataset.caption);return true;}
    if(action==='br-close'){el.closest('dialog')?.close();return true;}
    if(action==='br-check'){const rec=bookGuides().find(g=>g.chapterId===el.dataset.chapter);if(rec){closeBookReaderSheets();go('explore',{unit:rec.unitId,guideStep:5});}return true;}
    if(action==='br-search-go'){
      bookReaderJump={chapter:el.dataset.chapter,paragraph:Number(el.dataset.paragraph),query:el.dataset.query};closeBookReaderSheets();
      if(el.dataset.chapter===chapterId&&view==='reader')bookReaderAfterRender();else go('reader',{chapter:el.dataset.chapter});
      return true;
    }
    // Every other action leaves the reader's sheets closed behind it.
    if(['reader','overview','chapter-guide','reader-start','packet','toggle-sidebar'].includes(action))closeBookReaderSheets();
    return false;
  }
  function bookReaderAfterRender(){
    document.documentElement.dataset.view=view;
    if(view!=='reader'){closeBookReaderSheets();return;}
    bookReaderLastY=window.scrollY;
    // A new chapter opens with its controls showing.
    const key=activeBook.id+'/'+chapterId;if(key!==bookReaderKey){bookReaderKey=key;bookReaderShowChrome(true);}
    const jump=bookReaderJump;bookReaderJump=null;
    if(!jump||jump.chapter!==chapterId)return;
    // Wait for the saved-position restore, then move to the search match.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const c=activeBook.chapters.find(c=>c.id===chapterId),wanted=cleanParagraphs(c)[jump.paragraph]||'';
      const q=jump.query.toLocaleLowerCase();
      const ps=[...document.querySelectorAll('.reader-article p')];
      const target=ps.find(p=>p.textContent.replace(/\s+/g,' ').includes(wanted.slice(0,60)))||ps.find(p=>p.textContent.toLocaleLowerCase().includes(q));
      if(!target)return;target.closest('details')?.setAttribute('open','');
      target.scrollIntoView({block:'center',behavior:'instant'});
      target.classList.add('br-found');setTimeout(()=>target.classList.remove('br-found'),2400);
      progressBookmarkArrival();
    }));
  }
  // Tap the page edges to turn a screen; tap the middle to show or hide the controls.
  document.addEventListener('click',event=>{
    if(view!=='reader')return;
    const page=event.target.closest?.('.br-page');if(!page)return;
    if(event.target.closest('button,a,mark,figure,input,select,summary,[data-bookmark-ui]'))return;
    if(window.getSelection&&!window.getSelection().isCollapsed)return;
    const x=event.clientX/(document.documentElement.clientWidth||window.innerWidth);
    if(x>.72||x<.28){
      progressReaderMoved=true;
      const step=(window.innerHeight-140)*(x>.72?1:-1);
      window.scrollBy({top:step,behavior:'smooth'});bookReaderShowChrome(false);
    }else bookReaderShowChrome(bookReaderChromeHidden);
  });
  window.addEventListener('scroll',()=>{
    if(view!=='reader')return;
    const y=window.scrollY,delta=y-bookReaderLastY;bookReaderLastY=y;
    if(y<80)bookReaderShowChrome(true);
    else if(delta>12)bookReaderShowChrome(false);
    else if(delta<-24)bookReaderShowChrome(true);
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(view!=='reader'||document.querySelector('dialog[open]')||event.target.closest?.('input,textarea,select'))return;
    const c=activeBook.chapters.findIndex(c=>c.id===chapterId);
    if(event.key==='ArrowRight'&&event.altKey&&activeBook.chapters[c+1])go('reader',{chapter:activeBook.chapters[c+1].id});
    if(event.key==='ArrowLeft'&&event.altKey&&activeBook.chapters[c-1])go('reader',{chapter:activeBook.chapters[c-1].id});
  });
