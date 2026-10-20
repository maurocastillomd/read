  // Share a paper or a passage through the device's own share sheet. The site is
  // private, so a read. link is never shared: the public source (DOI or original
  // page) goes instead, and anything without one is shared as a citation.
  function shareSourceLink(book=activeBook){
    const own=location.host;
    const url=String(book?.sourceUrl||'');
    if(/^https?:\/\//i.test(url)){try{const u=new URL(url);if(u.host!==own&&!/\.workers\.dev$/i.test(u.host))return u.href;}catch{/* not a link */}}
    if(book?.sourceType!=='article')return '';
    // Uploaded papers usually print their DOI on the first page.
    const text=String(book.chapters?.[0]?.text||'').slice(0,20000);
    const doi=text.match(/\b(10\.\d{4,9}\/[^\s"'<>]+)/)?.[1]?.replace(/[.,;:)\]]+$/,'');
    return doi?'https://doi.org/'+doi:'';
  }
  function shareCitation(book=activeBook){return [book?.title,book?.author].filter(Boolean).join(' · ');}
  function sharePayload({book=activeBook,quote=''}={}){
    const url=shareSourceLink(book),citation=shareCitation(book);
    const findIt=!url&&book?.sourceType==='article'?'https://scholar.google.com/scholar?q='+encodeURIComponent(book.title||''):'';
    const text=quote?`“${quote.replace(/\s+/g,' ').trim()}”\n— ${citation}`:citation;
    return {title:book?.title||'Reading',text,url:url||findIt};
  }
  async function shareReading(payload){
    const body=payload.text+(payload.url?'\n'+payload.url:'');
    if(navigator.share){
      try{await navigator.share(payload.url?{title:payload.title,text:payload.text,url:payload.url}:{title:payload.title,text:payload.text});return;}
      catch(error){if(error?.name==='AbortError')return;}
    }
    try{await navigator.clipboard.writeText(body);toast('Copied. Paste it anywhere to share.');}
    catch{toast('Sharing is not available here.');}
  }
  function shareButton(cls='br-icon',label='Share'){return `<button class="${cls}" data-action="share-reading" aria-label="${esc(label)}" title="${esc(label)}">${readIcon('share')}${cls==='br-icon'?'':' <span>'+esc(label)+'</span>'}</button>`;}
  function handleShareAction(action,el){
    if(action==='share-reading'){shareReading(sharePayload());return true;}
    if(action==='share-passage'){const quote=el.dataset.quote||window.getSelection()?.toString()||'';if(quote.trim())shareReading(sharePayload({quote:quote.slice(0,1200)}));return true;}
    return false;
  }
