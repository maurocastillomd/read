  // Catalog metadata is verified against publisher/author pages; AI chooses IDs, not titles or URLs.
  const readingCatalog=JSON.parse(document.getElementById('reading-catalog-data')?.textContent||'{"books":[],"curated":[]}');
  const nextBooksCache=new Map(),nextBooksPending=new Set(),nextBooksPollTimers=new Map(),nextBooksWaitingForSave=new Set();
  const nextBookIdentity=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function curatedNextBooks(book) {
    const match=readingCatalog.curated.find(entry=>nextBookIdentity(entry.sourceTitle)===nextBookIdentity(book.title)&&nextBookIdentity(entry.sourceAuthor)===nextBookIdentity(book.author));
    if(!match)return null;
    const recommendations=match.picks.map(pick=>({...readingCatalog.books.find(item=>item.id===pick.id),...pick}));
    return recommendations.length===5&&recommendations.every(item=>item.title)?{status:'ready',basis:'curated',recommendations}:null;
  }
  function nextBooksContent(book,result) {
    if(result?.status==='ready'){
      const label=result.basis==='curated'?'A curated path through related ideas.':'AI-selected from a verified reading list, using this book’s chapter titles and sampled passages.';
      return `<p class="next-books-basis">${esc(label)} ${coordinatorExamplesEnabled()?'The connections to your field are companion interpretations.':'The connections between books are companion interpretations.'}</p><ol class="next-books-list">${result.recommendations.map((item,index)=>`<li><details class="next-book" ${index===0?'open':''}><summary><span class="next-book-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="next-book-title"><strong>${esc(item.title)}</strong><small>${esc(item.author)}</small></span><span class="next-book-expand" aria-hidden="true">+</span></summary><div class="next-book-body">${coordinatorExamplesEnabled()||!roleContextHasExample(item.readingOrderReason)?`<p class="next-book-order">${esc(item.readingOrderReason)}</p>`:''}<dl><div><dt>What it adds</dt><dd>${esc(item.connection)}</dd></div>${coordinatorExamplesEnabled()?`<div><dt>Bring it to your field</dt><dd>${esc(item.application)}</dd></div>`:''}</dl><a class="text-button" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">About the book <span aria-hidden="true">↗</span></a></div></details></li>`).join('')}</ol><p class="small next-books-note">${coordinatorExamplesEnabled()?'Follow the sequence, or start with the question most relevant to you.':'Follow the sequence, or start with the question you want to explore next.'}</p>`;
    }
    if(result?.status==='error')return `<div class="next-books-message"><div><p>${esc(result.error||'The reading list could not be prepared yet. Your book is still ready to read.')}</p>${Number.isFinite(Date.parse(result.retryAt))&&Date.parse(result.retryAt)>Date.now()?`<p class="small">Try again after ${esc(new Date(result.retryAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}.</p>`:''}</div><button class="secondary" data-action="next-books-retry" data-book="${esc(book.id)}">Try again</button></div>`;
    return '<div class="next-books-message" role="status"><span class="next-books-loading" aria-hidden="true"></span><p>Finding five complementary reads for this book…</p></div>';
  }
  function nextBooksPanel(book=activeBook) {
    const result=curatedNextBooks(book)||nextBooksCache.get(book.id);
    return `<section class="section next-books-section" id="next-books-panel" data-book="${esc(book.id)}" tabindex="-1" aria-labelledby="next-books-title"><header class="section-head"><p class="eyebrow">Keep the ideas moving</p><h2 id="next-books-title">Your next 5 books.</h2><p>Build on <em>${esc(book.title)}</em>. ${coordinatorExamplesEnabled()?'Follow the ideas into everyday work and life.':'Explore complementary ideas, useful distinctions, and new questions.'}</p></header><div data-next-books-content>${nextBooksContent(book,result)}</div></section>`;
  }
  function refreshNextBooksPanel(bookId) {
    const panel=document.getElementById('next-books-panel');
    if(!panel||panel.dataset.book!==bookId)return;
    // Let the reader finish a text selection before replacing the list.
    const selection=window.getSelection?.();
    if(selection&&!selection.isCollapsed){setTimeout(()=>refreshNextBooksPanel(bookId),800);return;}
    const book=books.find(item=>item.id===bookId);if(!book)return;
    panel.querySelector('[data-next-books-content]').innerHTML=nextBooksContent(book,curatedNextBooks(book)||nextBooksCache.get(bookId));
    applyBookmarkHighlights();
  }
  async function nextBooksRequest(bookId,method='GET') {
    const response=await fetch('/api/recommendations'+(method==='GET'?'?bookId='+encodeURIComponent(bookId):''),{method,headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body:method==='POST'?JSON.stringify({bookId}):undefined,signal:AbortSignal.timeout(60000)});
    const value=await response.json().catch(()=>({error:'The reading list could not be loaded. Please try again.'}));
    if(!response.ok)throw new Error(value.error||'The reading list could not be loaded. Please try again.');
    return value;
  }
  function verifiedNextBooksResponse(value) {
    if(value?.status!=='ready')return value;
    if(!Array.isArray(value.recommendations)||value.recommendations.length!==5||new Set(value.recommendations.map(item=>item.id)).size!==5)throw new Error('The reading list was incomplete. Please try again.');
    return {...value,recommendations:value.recommendations.map(item=>{
      const metadata=readingCatalog.books.find(book=>book.id===item.id);
      if(!metadata||!['connection','application','readingOrderReason'].every(key=>typeof item[key]==='string'&&item[key].trim()&&item[key].length<=2000))throw new Error('The reading list could not be verified. Please try again.');
      return {...item,...metadata};
    })};
  }
  async function loadNextBooks(book=activeBook,retry=false) {
    const polling=nextBooksCache.get(book.id)?.status==='generating';
    if(curatedNextBooks(book)||nextBooksWaitingForSave.has(book.id)||nextBooksPending.has(book.id)||(!retry&&nextBooksCache.has(book.id)&&!polling))return;
    let requiresSave=nextBooksCache.get(book.id)?.requiresSave===true;
    clearTimeout(nextBooksPollTimers.get(book.id));nextBooksPollTimers.delete(book.id);
    nextBooksPending.add(book.id);nextBooksCache.set(book.id,{status:'loading'});refreshNextBooksPanel(book.id);
    try{
      if(requiresSave){await persistBook(book);requiresSave=false;}
      let result=await nextBooksRequest(book.id);
      if(result.status==='missing'){
        if(polling)throw new Error('The reading list could not be completed. Try again to prepare it.');
        if(result.available===false)throw new Error(result.message||'Connect cloud AI to prepare this book’s reading list.');
        result=await nextBooksRequest(book.id,'POST');
      }else if(retry&&result.status==='error')result=await nextBooksRequest(book.id,'POST');
      if(result.status==='error'){nextBooksCache.set(book.id,result);return;}
      if(result.status==='generating'){
        nextBooksCache.set(book.id,result);
        nextBooksPollTimers.set(book.id,setTimeout(()=>{nextBooksPollTimers.delete(book.id);if(view==='overview'&&activeBook.id===book.id&&document.visibilityState==='visible')loadNextBooks(book);},10000));
      }else{
        if(result.status!=='ready')throw new Error(result.error||result.message||'The reading list could not be prepared. Please try again shortly.');
        nextBooksCache.set(book.id,verifiedNextBooksResponse(result));
      }
    }catch(error){nextBooksCache.set(book.id,{status:'error',requiresSave,error:requiresSave?'Your book could not be saved to the cloud. Try again to save it and prepare your reading list.':error.name==='TimeoutError'?'This is taking longer than expected. Try again to check for the saved reading list.':error.message||'The reading list could not be prepared. Please try again.'});}
    finally{nextBooksPending.delete(book.id);refreshNextBooksPanel(book.id);}
  }
  function nextBooksAfterRender() {if(view==='overview')loadNextBooks(activeBook);}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')nextBooksAfterRender();});
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');if(!el)return;
    if(el.dataset.action==='next-books-open'){
      if(view!=='overview')go('overview');
      const panel=document.getElementById('next-books-panel');panel?.scrollIntoView({block:'start',behavior:'instant'});panel?.focus({preventScroll:true});
    }
    if(el.dataset.action==='next-books-retry'){const book=books.find(item=>item.id===el.dataset.book);if(book)loadNextBooks(book,true);}
  });
