  // Bookmarks share the field-level cloud outbox. Text anchors contain plain text,
  // never saved HTML, and highlights are rebuilt without changing the source.
  const bookmarkViews = ['library','overview','guides','explore','reader','notes','learn','setup'];
  let bookmarkQuery='', bookmarkFilter='all', bookmarkBookFilter='', bookmarkSelection=null, bookmarkUndo=null, bookmarkUndoAt=0, bookmarkBarMode='', bookmarkJump=null, bookmarkSourceChapter='';
  let bookmarkObserver=null, bookmarkPaintTimer=null, bookmarkSelectionTimer=null;
  function parseBookmark(value) {
    try {
      const b=JSON.parse(value);
      if(!b || b.version!==1 || !['place','highlight'].includes(b.kind) || !bookmarkViews.includes(b.view))return null;
      if(!['chapterId','unitId','title','quote','prefix','suffix','createdAt'].every(k=>typeof b[k]==='string'))return null;
      if(b.quote.length>12000 || b.title.length>1000 || b.prefix.length>120 || b.suffix.length>120 || !Number.isInteger(b.step) || b.step<0 || b.step>5 || !Number.isInteger(b.start) || b.start<0 || !Number.isInteger(b.end) || b.end<b.start || Number.isNaN(Date.parse(b.createdAt)))return null;
      if(b.kind==='highlight'&&(!b.quote.trim()||b.end<=b.start))return null;
      if(b.scroll!==undefined&&(!Number.isInteger(b.scroll)||b.scroll<0||b.scroll>1000))return null;
      if(b.panel!==undefined){
        if(typeof b.panel!=='string'||b.panel.length>2000)return null;
        const panel=JSON.parse(b.panel);if(!panel||typeof panel!=='object'||Array.isArray(panel))return null;
        const numeric=['concept','path','level','inflow','outflow','feedback','gain','delay','attention','practiceIndex'];
        const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1000;
        for(const [key,value] of Object.entries(panel)){
          const valid=numeric.includes(key)?finite(value):key==='answer'?value===null||finite(value):['memory','practiceReveal','practiceOpen'].includes(key)?typeof value==='boolean':key==='mode'?['balance','reinforce'].includes(value):['history','feedbackHistory'].includes(key)?Array.isArray(value)&&value.length>0&&value.length<=100&&value.every(finite):false;
          if(!valid)return null;
        }
      }
      return b;
    } catch { return null; }
  }
  function bookmarkRecords() {
    return Object.entries(state.bookmarks||{}).flatMap(([bookId,items])=>Object.entries(items||{}).flatMap(([id,value])=>{const b=parseBookmark(value);return b?[{...b,id,bookId}]:[];})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  function bookmarkLocation(b) { return JSON.stringify([b.view,b.chapterId||'',b.unitId||'',b.step||0]); }
  function bookmarkContext(source=false) {
    const rec=view==='explore'?bookGuides().find(g=>g.unitId===selectedUnit):null;
    const ch=activeBook.chapters.find(c=>c.id===(source?bookmarkSourceChapter:chapterId));
    const page=view==='explore'?rec?.guide.title:view==='reader'?ch?.title:({library:'Your library',overview:'Book overview',guides:'Lesson collection',notes:'My notes',learn:guide.steps[step]?.title,setup:'Cloud settings'})[view];
    const session=rec?labSession(rec):null;
    const practice=rec&&typeof practiceSession==='function'?practiceSession(rec):null;
    const panel=session?JSON.stringify({...session,...(practice?{practiceIndex:practice.index,practiceReveal:practice.reveal,practiceOpen:!!$('#chapter-practice')?.open}:{}),history:session.history.slice(-30),feedbackHistory:session.feedbackHistory.slice(-30)}):'{}';
    return {version:1,kind:'place',view:source?'reader':view,chapterId:source?bookmarkSourceChapter:view==='reader'?chapterId:'',unitId:source?'':rec?.unitId||'',step:source?0:view==='explore'?guideStep:view==='learn'?step:0,title:String(source?ch?.title||'Original passage':page||activeBook.title).slice(0,1000),quote:'',prefix:'',suffix:'',start:0,end:0,createdAt:new Date().toISOString(),panel:source?'{}':panel,scroll:Math.round(Math.max(0,Math.min(1,window.scrollY/Math.max(1,document.documentElement.scrollHeight-window.innerHeight)))*1000)};
  }
  function bookmarkPageButton() {
    if(view==='bookmarks')return '<button class="text-button" data-action="library">Back to library</button>';
    const current=bookmarkLocation(bookmarkContext()),saved=bookmarkRecords().some(b=>b.bookId===activeBook.id&&!b.quote&&bookmarkLocation(b)===current);
    return `<button class="bookmark-page-button" data-action="bookmark-page" ${bookmarkPageLabel(saved)} aria-pressed="${saved}">${readIcon('bookmark',saved)}</button>`;
  }
  function bookmarkPageLabel(saved) { const label=saved?'Remove page bookmark':'Bookmark this page';return `aria-label="${label}" title="${label}"`; }
  function currentPageBookmark() { const here=bookmarkLocation(bookmarkContext());return bookmarkRecords().find(b=>b.bookId===activeBook.id&&!b.quote&&bookmarkLocation(b)===here); }
  // One undo step covers the latest save or removal. It keeps the exact stored
  // values it replaced, so undo also reverses a bookmark upgraded to a highlight.
  function setBookmarkValues(changes) {
    state.bookmarks ||= {};
    for(const c of changes){state.bookmarks[c.bookId] ||= {};if(c.value===undefined)delete state.bookmarks[c.bookId][c.id];else state.bookmarks[c.bookId][c.id]=c.value;}
    save();sidebar();applyBookmarkHighlights();updateBookmarkButtons();
  }
  function changeBookmarks(changes,message,removed=false) {
    const before=changes.map(c=>({bookId:c.bookId,id:c.id,value:state.bookmarks?.[c.bookId]?.[c.id]}));
    setBookmarkValues(changes);
    bookmarkUndo={before,removed};bookmarkUndoAt=Date.now();
    toast(message,{label:'Undo',run:undoBookmarkChange});
  }
  function undoBookmarkChange() {
    if(!bookmarkUndo)return false;
    const {before}=bookmarkUndo;bookmarkUndo=null;setBookmarkValues(before);
    if(view==='bookmarks')render();
    toast('Undone.');return true;
  }
  function saveBookmark(b) {
    const existing=bookmarkRecords().find(x=>x.bookId===activeBook.id&&bookmarkLocation(x)===bookmarkLocation(b)&&x.quote===b.quote&&(!b.quote||x.start===b.start));
    const id=existing?.id||crypto.randomUUID();
    bookmarkSelection=null;hideBookmarkSelection();window.getSelection()?.removeAllRanges();
    changeBookmarks([{bookId:activeBook.id,id,value:JSON.stringify({...b,kind:existing?.kind==='highlight'?'highlight':b.kind,createdAt:existing?.createdAt||b.createdAt})}],b.kind==='highlight'?'Highlighted.':'Saved.');
  }
  function removeBookmarks(items) {
    const present=items.filter(x=>state.bookmarks?.[x.bookId]?.[x.id]!==undefined);
    if(!present.length)return;
    hideBookmarkSelection();
    changeBookmarks(present.map(x=>({...x,value:undefined})),'Removed.',true);
    if(view==='bookmarks')render();
  }
  function updateBookmarkButtons() {
    const saved=bookmarkViews.includes(view)&&!!currentPageBookmark(),label=saved?'Remove page bookmark':'Bookmark this page';
    document.querySelectorAll('[data-action="bookmark-page"]').forEach(el=>{el.setAttribute('aria-pressed',String(saved));el.setAttribute('aria-label',label);el.title=label;el.innerHTML=readIcon('bookmark',saved);el.disabled=view==='bookmarks';});
  }
  function bookmarks() {
    const records=bookmarkRecords(),highlightCount=records.filter(b=>b.kind==='highlight').length;
    return `${topbar('Saved')}<header class="lesson-head"><p class="eyebrow">Your review shelf</p><h1>Keep the ideas<br><em>you want to use.</em></h1><p class="lead">${records.length} saved ${records.length===1?'item':'items'} · ${highlightCount} ${highlightCount===1?'highlight':'highlights'}. Return to a passage, an analogy, or a lesson.</p><p class="small bookmark-help">Select text, then tap ${readIcon('highlighter')} to highlight it or ${readIcon('bookmark')} to keep the passage. Tap ${readIcon('bookmark')} at the top of any page to save the page. Tap a highlight to remove it. Changed your mind? Tap Undo in the message that appears, or press ⌘Z / Ctrl+Z.</p></header><div class="bookmark-filters" data-bookmark-ui><label>Find a saved idea<input type="search" id="bookmark-search" value="${esc(bookmarkQuery)}" placeholder="Search text, lesson, or book"></label><label>Book<select id="bookmark-book"><option value="">All books</option>${[...new Set(records.map(b=>b.bookId))].map(id=>`<option value="${esc(id)}" ${bookmarkBookFilter===id?'selected':''}>${esc(books.find(b=>b.id===id)?.title||'Book not currently loaded')}</option>`).join('')}</select></label><div class="bookmark-filter-tabs" role="group" aria-label="Saved item type">${[['all','All saved','All'],['highlight','Highlights',readIcon('highlighter')],['place','Bookmarks',readIcon('bookmark')]].map(([id,label,content])=>`<button class="secondary" data-action="bookmark-filter" data-kind="${id}" aria-pressed="${bookmarkFilter===id}" aria-label="${label}" title="${label}">${content}</button>`).join('')}</div></div><p id="bookmark-count" class="small" role="status"></p><div id="bookmark-list">${bookmarkCards()}</div>${bookmarkUndo?.removed?'<div class="bookmark-undo" data-bookmark-ui>Removed. <button class="text-button" data-action="bookmark-undo">Undo</button></div>':''}<p class="small"><span data-cloud-sync>${esc(syncLabel())}</span>. Bookmarks and highlights are included in your library backup.</p>${footer()}`;
  }
  function bookmarkCards() {
    const q=bookmarkQuery.trim().toLocaleLowerCase();
    const records=bookmarkRecords().filter(b=>(bookmarkFilter==='all'||b.kind===bookmarkFilter)&&(!bookmarkBookFilter||b.bookId===bookmarkBookFilter)&&(!q||[b.title,b.quote,books.find(x=>x.id===b.bookId)?.title||''].join(' ').toLocaleLowerCase().includes(q)));
    return records.length?records.map(b=>`<article class="bookmark-card"><div class="bookmark-card-meta"><span class="bookmark-kind" title="${b.kind==='highlight'?'Highlighted passage':b.quote?'Saved passage':'Bookmarked page'}">${readIcon(b.kind==='highlight'?'highlighter':'bookmark')}<span class="sr-only">${b.kind==='highlight'?'Highlighted passage':b.quote?'Saved passage':'Bookmarked page'}</span></span><time datetime="${esc(b.createdAt)}">${esc(new Date(b.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</time></div><p class="eyebrow">${esc(books.find(x=>x.id===b.bookId)?.title||'Book not currently loaded')}</p><h2>${esc(b.title)}</h2>${b.quote?`<blockquote class="${b.kind==='highlight'?'bookmark-quote-highlight':''}">${esc(b.quote)}</blockquote>`:''}<div class="button-row" data-bookmark-ui><button class="secondary" data-action="bookmark-open" data-book="${esc(b.bookId)}" data-id="${esc(b.id)}">Return to ${b.quote?'passage':'page'} ↗</button><button class="icon-button" data-action="bookmark-remove" data-book="${esc(b.bookId)}" data-id="${esc(b.id)}" aria-label="Remove saved item: ${esc(b.title)}" title="Remove">${readIcon('trash')}</button></div></article>`).join(''):'<div class="empty bookmark-empty"><h2>No saved items here yet.</h2><p>Select a passage or bookmark a page as you read. Your saved ideas will collect here.</p><button class="secondary" data-action="library">Browse your books →</button></div>';
  }
  // Offsets plus surrounding words disambiguate repeated phrases. A moved quote
  // is restored only when its context is unique; never highlight a guessed match.
  function resolveBookmarkAnchor(text,b) {
    if(!b.quote)return null;
    const matches=[];let at=text.indexOf(b.quote);
    while(at!==-1){matches.push(at);at=text.indexOf(b.quote,at+1);}
    const contextual=matches.filter(i=>(!b.prefix||text.slice(Math.max(0,i-b.prefix.length),i)===b.prefix)&&(!b.suffix||text.slice(i+b.quote.length,i+b.quote.length+b.suffix.length)===b.suffix));
    const start=contextual.includes(b.start)?b.start:contextual.length===1?contextual[0]:matches.length===1?matches[0]:null;
    return start===null?null:{start,end:start+b.quote.length};
  }
  function bookmarkTextNodes(root,context) {
    const result=[];let text='',previousBlock=null;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode,p=node.parentElement;
      if(!p||p.closest('button,input,textarea,select,script,style,svg,nav,.topbar,.app-footer,.para-num,[data-bookmark-ui]'))continue;
      if(context.view==='reader'&&!p.closest('.reader-article > p,.source-p'))continue;
      if(!node.data.length)continue;
      const block=p.closest('p,li,h1,h2,h3,h4,h5,blockquote,figcaption')||p;
      if(previousBlock&&previousBlock!==block)text+='\n';previousBlock=block;
      result.push({node,start:text.length,end:text.length+node.data.length});text+=node.data;
    }
    return {nodes:result,text};
  }
  function bookmarkScope(source=false) { return source?$('#source-content'):$('#main'); }
  function selectionBookmark() {
    const selection=window.getSelection();
    if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
    const range=selection.getRangeAt(0),source=$('#source-dialog').open&&$('#source-content').contains(range.commonAncestorContainer);
    const root=bookmarkScope(source);if(!root.contains(range.commonAncestorContainer)||view==='bookmarks')return null;
    const context=bookmarkContext(source);if(!bookmarkViews.includes(context.view))return null;
    const map=bookmarkTextNodes(root,context),selected=map.nodes.filter(x=>range.intersectsNode(x.node));if(!selected.length)return null;
    const first=selected[0],last=selected[selected.length-1];
    const start=first.start+(range.startContainer===first.node?range.startOffset:0),end=last.start+(range.endContainer===last.node?range.endOffset:last.node.data.length);
    const quote=map.text.slice(start,end);if(!quote.trim()||quote.length>12000)return null;
    if(source){
      const chapter=activeBook.chapters.find(c=>c.id===bookmarkSourceChapter),paragraph=first.node.parentElement.closest('.source-p');
      const index=Number(paragraph?.dataset.sourceParagraph)-1;
      if(chapter&&Number.isInteger(index)&&index>=0){
        const all=readingParagraphs(chapter),full=all.join('\n'),firstInParagraph=map.nodes.find(item=>paragraph.contains(item.node));
        const absolute=all.slice(0,index).reduce((n,p)=>n+p.length+1,0)+start-(firstInParagraph?.start||0);
        if(full.slice(absolute,absolute+quote.length)===quote)return {...context,quote,start:absolute,end:absolute+quote.length,prefix:full.slice(Math.max(0,absolute-80),absolute),suffix:full.slice(absolute+quote.length,absolute+quote.length+80),_source:true};
      }
      return null;
    }
    return {...context,quote,start,end,prefix:map.text.slice(Math.max(0,start-80),start),suffix:map.text.slice(end,end+80),_source:source};
  }
  function hideBookmarkSelection(){bookmarkBarMode='';const bar=$('#bookmark-selection');if(bar)bar.hidden=true;}
  function captureBookmarkSelection() {
    if(document.activeElement?.closest('#bookmark-selection'))return;
    const next=selectionBookmark();
    if(!next){if(window.getSelection()?.isCollapsed&&bookmarkBarMode!=='remove'){bookmarkSelection=null;hideBookmarkSelection();}return;}
    bookmarkSelection=next;
    showBookmarkBar(`<button class="primary" data-action="bookmark-highlight" aria-label="Highlight" title="Highlight">${readIcon('highlighter')}</button><button class="secondary" data-action="bookmark-selection-save" aria-label="Bookmark passage" title="Bookmark passage">${readIcon('bookmark')}</button><button class="secondary" data-action="share-passage" data-quote="${esc(next.quote)}" aria-label="Share passage" title="Share passage">${readIcon('share')}</button>`,'Save selected text',next._source);
  }
  function showBookmarkBar(buttons,label,inSource,mode='select') {
    bookmarkBarMode=mode;
    let bar=$('#bookmark-selection');if(!bar){bar=document.createElement('div');bar.id='bookmark-selection';bar.dataset.bookmarkUi='';bar.setAttribute('role','region');bar.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault();});}
    bar.setAttribute('aria-label',label);
    bar.innerHTML=`${buttons}<button class="text-button" data-action="bookmark-dismiss" aria-label="Close" title="Close">${readIcon('close')}</button>`;
    const host=inSource?$('#source-dialog'):document.body;if(bar.parentElement!==host)host.append(bar);bar.hidden=false;
  }
  // Tapping a saved highlight offers removal in place, with the same undo.
  function offerHighlightRemoval(mark) {
    if(window.getSelection()?.isCollapsed===false)return;
    bookmarkSelection=null;
    showBookmarkBar(`<button class="secondary" data-action="bookmark-unhighlight" data-ids="${esc(mark.dataset.savedHighlight)}" aria-label="Remove highlight" title="Remove highlight">${readIcon('trash')}</button><button class="secondary" data-action="share-passage" data-quote="${esc(mark.textContent)}" aria-label="Share highlight" title="Share highlight">${readIcon('share')}</button>`,'Saved highlight',!!mark.closest('#source-dialog'),'remove');
  }
  function applyBookmarkHighlights() {
    bookmarkObserver?.disconnect();
    for(const source of [false,true]){
      if(source&&!$('#source-dialog').open)continue;
      const root=bookmarkScope(source);if(!root)continue;
      root.querySelectorAll('mark[data-saved-highlight]').forEach(mark=>mark.replaceWith(...mark.childNodes));root.normalize();
      if(view==='bookmarks')continue;
      const context=bookmarkContext(source),map=bookmarkTextNodes(root,context),matches=bookmarkRecords().filter(b=>b.bookId===activeBook.id&&b.kind==='highlight'&&bookmarkLocation(b)===bookmarkLocation(context));
      const sourceStart=source?Number(root.querySelector('.source-p')?.dataset.sourceParagraph)-1:0;
      const sourceChapter=source?activeBook.chapters.find(c=>c.id===bookmarkSourceChapter):null;
      const sourceOffset=sourceChapter&&sourceStart>0?readingParagraphs(sourceChapter).slice(0,sourceStart).reduce((n,p)=>n+p.length+1,0):0;
      const spans=matches.flatMap(b=>{
        if(source&&(b.start<sourceOffset||b.end>sourceOffset+map.text.length))return [];
        const anchor=source?{...b,start:b.start-sourceOffset,end:b.end-sourceOffset,prefix:b.prefix.slice(-Math.min(b.prefix.length,b.start-sourceOffset)),suffix:b.suffix.slice(0,Math.max(0,map.text.length-(b.end-sourceOffset)))}:b;
        if(source&&anchor.start===0)anchor.prefix='';
        const pos=resolveBookmarkAnchor(map.text,anchor);return pos?[{...pos,id:b.id}]:[];
      });
      for(const item of map.nodes){
        const hits=spans.filter(s=>s.start<item.end&&s.end>item.start);if(!hits.length)continue;
        const cuts=[...new Set([0,item.node.data.length,...hits.flatMap(s=>[Math.max(0,s.start-item.start),Math.min(item.node.data.length,s.end-item.start)])])].sort((a,b)=>a-b);
        const fragment=document.createDocumentFragment();
        for(let i=0;i<cuts.length-1;i++){const start=cuts[i],end=cuts[i+1],ids=hits.filter(s=>s.start<item.start+end&&s.end>item.start+start).map(s=>s.id),part=item.node.data.slice(start,end);if(!ids.length)fragment.append(document.createTextNode(part));else{const mark=document.createElement('mark');mark.dataset.savedHighlight=ids.join(' ');mark.textContent=part;mark.title='Highlight · tap to remove';fragment.append(mark);}}
        item.node.replaceWith(fragment);
      }
    }
    bookmarkObserver?.observe($('#main'),{childList:true,subtree:true,characterData:true});
    if($('#source-dialog').open)bookmarkObserver?.observe($('#source-content'),{childList:true,subtree:true,characterData:true});
  }
  function restoreBookmarkPanel(b) {
    if(b.view!=='explore'||!b.panel)return;
    const rec=bookGuides().find(g=>g.unitId===b.unitId);if(!rec)return;
    try{const v=JSON.parse(b.panel),s=labSession(rec);if(typeof practiceSession==='function'){const practice=practiceSession(rec);if(Number.isInteger(v.practiceIndex))practice.index=v.practiceIndex;if(typeof v.practiceReveal==='boolean')practice.reveal=v.practiceReveal;practice.open=v.practiceOpen===true;}for(const k of ['concept','path','answer','level','inflow','outflow','feedback','gain','delay','attention'])if(typeof v[k]==='number'&&Number.isFinite(v[k])&&v[k]>=0&&v[k]<=1000)s[k]=v[k];if(v.answer===null)s.answer=null;if(typeof v.memory==='boolean')s.memory=v.memory;if(['balance','reinforce'].includes(v.mode))s.mode=v.mode;for(const k of ['history','feedbackHistory'])if(Array.isArray(v[k])&&v[k].length>0&&v[k].length<=100&&v[k].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1000))s[k]=v[k];}catch{}
  }
  async function openBookmark(b) {
    const book=books.find(x=>x.id===b.bookId);if(!book){toast('This book is not loaded. Restore it to your library to reopen the passage.');return;}
    if(b.view==='explore'&&!bookGuides(book).some(g=>g.unitId===b.unitId)){
      try{toast('Opening your saved lesson…');const result=await api('/api/guides?bookId='+encodeURIComponent(book.id));mergeGuides(result.guides||[],book.id);}catch{toast('Reconnect to load this saved lesson. Your bookmark is kept.');return;}
      if(!bookGuides(book).some(g=>g.unitId===b.unitId)){toast('This lesson is not available yet. Your saved passage is kept.');return;}
    }
    const previousBook=activeBook;activeBook=book;restoreBookmarkPanel(b);activeBook=previousBook;bookmarkJump=b;go(b.view,{book:b.bookId,chapter:b.chapterId,unit:b.unitId,guideStep:b.step,step:b.step});
  }
  function bookmarkAfterRender() {
    hideBookmarkSelection();bookmarkSelection=null;applyBookmarkHighlights();updateBookmarkButtons();
    const jump=bookmarkJump;if(!jump)return;bookmarkJump=null;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(jump.quote){
        const root=$('#main'),map=bookmarkTextNodes(root,jump),pos=resolveBookmarkAnchor(map.text,jump);
        if(pos){const item=map.nodes.find(x=>x.end>pos.start),el=item?.node.parentElement;if(el){let p=el;while(p&&p!==root){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}el.scrollIntoView({block:'center',behavior:'instant'});progressBookmarkArrival();el.classList.add('bookmark-arrival');setTimeout(()=>el.classList.remove('bookmark-arrival'),2500);}}
        else toast('Saved passage kept. This lesson panel has changed; review the quotation in Bookmarks.');
      }else {window.scrollTo({top:(jump.scroll||0)/1000*Math.max(0,document.documentElement.scrollHeight-window.innerHeight),behavior:'instant'});progressBookmarkArrival();}
    }));
  }
  function handleBookmarkAction(action,el) {
    if(action==='bookmarks'){go('bookmarks');return true;}
    if(!action?.startsWith('bookmark-'))return false;
    if(action==='bookmark-page'){if(bookmarkViews.includes(view)){const saved=currentPageBookmark();if(saved)removeBookmarks([{bookId:saved.bookId,id:saved.id}]);else saveBookmark(bookmarkContext());}}
    else if(action==='bookmark-unhighlight')removeBookmarks(String(el.dataset.ids||'').split(' ').filter(Boolean).map(id=>({bookId:activeBook.id,id})));
    else if(action==='bookmark-source')saveBookmark(bookmarkContext(true));
    else if(action==='bookmark-highlight'||action==='bookmark-selection-save'){if(bookmarkSelection){const {_source,...value}=bookmarkSelection;saveBookmark({...value,kind:action==='bookmark-highlight'?'highlight':'place'});}else toast('Select a passage first.');}
    else if(action==='bookmark-dismiss'){bookmarkSelection=null;hideBookmarkSelection();window.getSelection()?.removeAllRanges();}
    else if(action==='bookmark-filter'){bookmarkFilter=el.dataset.kind;render();}
    else if(action==='bookmark-open'){const b=bookmarkRecords().find(x=>x.id===el.dataset.id&&x.bookId===el.dataset.book);if(b)openBookmark(b);}
    else if(action==='bookmark-remove')removeBookmarks([{bookId:el.dataset.book,id:el.dataset.id}]);
    else if(action==='bookmark-undo')undoBookmarkChange();
    return true;
  }
  document.addEventListener('selectionchange',()=>{clearTimeout(bookmarkSelectionTimer);bookmarkSelectionTimer=setTimeout(captureBookmarkSelection,200);});
  document.addEventListener('pointerup',()=>{clearTimeout(bookmarkSelectionTimer);bookmarkSelectionTimer=setTimeout(captureBookmarkSelection,50);});
  document.addEventListener('input',e=>{if(e.target.id==='bookmark-search'){bookmarkQuery=e.target.value;$('#bookmark-list').innerHTML=bookmarkCards();$('#bookmark-count').textContent=$('#bookmark-list').querySelectorAll('.bookmark-card').length+' matching saved items';}});
  document.addEventListener('change',e=>{if(e.target.id==='bookmark-book'){bookmarkBookFilter=e.target.value;$('#bookmark-list').innerHTML=bookmarkCards();$('#bookmark-count').textContent=$('#bookmark-list').querySelectorAll('.bookmark-card').length+' matching saved items';}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')hideBookmarkSelection();
    // Cmd/Ctrl+Z undoes a save or removal from the last two minutes; text fields keep their own undo.
    else if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='z'&&bookmarkUndo&&Date.now()-bookmarkUndoAt<120000&&!e.target.closest?.('input,textarea,select,[contenteditable]')){e.preventDefault();undoBookmarkChange();}
  });
  document.addEventListener('click',e=>{const mark=e.target.closest?.('mark[data-saved-highlight]');if(mark&&!e.target.closest('[data-action]'))offerHighlightRemoval(mark);else if(bookmarkBarMode==='remove'&&!e.target.closest?.('#bookmark-selection'))hideBookmarkSelection();});
  bookmarkObserver=new MutationObserver(()=>{clearTimeout(bookmarkPaintTimer);bookmarkPaintTimer=setTimeout(()=>{if(window.getSelection()?.isCollapsed!==false)applyBookmarkHighlights();},80);});
