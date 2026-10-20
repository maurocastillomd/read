  let readingImportTab='link',readingImportBusy=false,readingImportPrefill='';
  function documentSourceLink(book){
    try{const url=new URL(book.sourceUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';return `<a class="text-button" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Visit original article ${readIcon('source')}</a>`;}catch{return '';}
  }
  function documentImportNotice(book){return book.importWarnings?.length?`<details class="method-note"><summary>About the imported text</summary>${book.importWarnings.map(w=>`<p>${esc(w)}</p>`).join('')}${documentSourceLink(book)}</details>`:documentSourceLink(book);}
  function openReadingImport(){
    let dialog=$('#reading-import-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='reading-import-dialog';dialog.setAttribute('aria-labelledby','reading-import-title');document.body.append(dialog);setupDismissibleDialog(dialog);}
    if(!readingImportBusy)paintReadingImport();if(!dialog.open)dialog.showModal();
  }
  function paintReadingImport(){
    const dialog=$('#reading-import-dialog');
    dialog.innerHTML=`<header class="import-modal-head"><div><span class="eyebrow">Your learning library</span><h2 id="reading-import-title">Bring an idea in.</h2></div><button class="icon-button" data-action="import-close" aria-label="Close add reading">${readIcon('close')}</button></header><p class="import-modal-intro">A book, a paper, or an article. Keep the original text, understand its ideas, and explore the reported evidence. Add only readings you own or have the right to use.</p><div class="import-tabs" role="group" aria-label="Import method">${[['link','link','Article link'],['file','upload','Upload file'],['text','notes','Paste text']].map(([id,icon,label])=>`<button data-action="import-tab" data-tab="${id}" aria-pressed="${readingImportTab===id}">${readIcon(icon)} ${label}</button>`).join('')}</div><form id="reading-import-form"><div class="import-fields">${readingImportTab==='file'?`<label class="import-file-zone" for="reading-document-file">${readIcon('upload')}<strong>Choose a file from your device</strong><span>EPUB · PDF · DOCX · TXT · Markdown</span><input id="reading-document-file" type="file" accept=".epub,.pdf,.docx,.txt,.md,.markdown" required></label><p class="small">EPUB up to 25 MB. Documents up to 60 MB, with 12 MB of extracted text. Text-based files work best.</p>`:readingImportTab==='link'?`<label for="reading-article-url">Article, PDF or DOI link</label><div class="import-link-row"><input id="reading-article-url" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://… or 10.xxxx/…" required autocomplete="url" value="${esc(readingImportPrefill)}"><button type="button" class="primary import-paste" data-action="import-paste">${readIcon('link')} Paste link</button></div><p class="small">Copy the link, then tap Paste link. Works with web articles, PDF links, DOIs and PubMed links. Open-access papers come in with their full methods and results. If a paper is behind a paywall, download its PDF and use Upload file.</p>`:'<label for="reading-text-title">Title</label><input id="reading-text-title" maxlength="500" required placeholder="Give this reading a title"><label for="reading-pasted-text">Article or document text</label><textarea id="reading-pasted-text" rows="7" required placeholder="Paste the complete text you want to study…"></textarea>'}${readingImportTab!=='link'?'<label for="reading-document-type">Read this as</label><select id="reading-document-type"><option value="article">Article / research paper / blog</option><option value="book">Book / long document</option></select><p class="small">EPUBs use the book structure. Articles get a critical reading guide and an automatic statistics lab using the numbers available in the extracted text.</p>':'<div class="import-article-note">'+readIcon('compass')+'<p>Your guide covers the question, study type, findings, and limitations. Research articles also get interactive statistics drawn from their reported numbers. Opinion pieces are identified as commentary.</p></div>'}</div><p id="reading-import-status" role="status" aria-live="polite"></p><footer class="import-modal-footer"><p>Extracted text is saved to your private library and sent to Claude for learning guides. Articles are ready in minutes; books can take up to 24 hours.</p><button class="primary" type="submit">Add to my library ${readIcon('arrow')}</button></footer></form>`;
    $('#reading-import-form').addEventListener('submit',submitReadingImport);
  }
  function setImportStatus(text,error=false){const target=$('#reading-import-status');if(target){target.textContent=text;target.classList.toggle('is-error',error);}}
  async function addImportedReading(book,{cloudSaved=false}={}){
    delete state.hiddenBooks?.[book.id];save();if(!books.some(b=>b.id===book.id))books.push(book);
    if(typeof replaceOlderCopies==="function")replaceOlderCopies(book);
    if(db)try{await dbPut(book);}catch{toast('Device storage is unavailable. Saving to your cloud library.');}
    if(!cloudSaved)await persistBook(book);
    $('#reading-import-dialog')?.close();go('overview',{book:book.id});await refreshGeneration(false,book);
    if(localAI.available&&localAI.connected&&localAI.autoGenerate){await startGeneration(book);}else toast('Your reading is ready. Open its lessons to generate the learning guide.');
  }
  // The cloud fetches the link. A PDF comes back as the file itself and is read
  // here on the device, exactly like an uploaded PDF.
  async function importReadingLinkFromCloud(url){
    const response=await fetch('/api/import-document',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:AbortSignal.timeout(60000)});
    if(response.ok&&/^application\/pdf/i.test(response.headers.get('content-type')||'')){
      setImportStatus('Reading the PDF on this device…');
      let sourceUrl=url;try{sourceUrl=decodeURI(response.headers.get('x-read-source-url')||url);}catch{}
      const name=(new URL(sourceUrl,location.href).pathname.split('/').pop()||'article').replace(/\.pdf$/i,'')+'.pdf';
      const book=await readImportedDocument(new File([await response.blob()],name,{type:'application/pdf'}),{sourceType:'article',onProgress:message=>setImportStatus(message)});
      try{const link=new URL(sourceUrl);if(['http:','https:'].includes(link.protocol))book.sourceUrl=link.href;}catch{}
      return {book,cloudSaved:false};
    }
    const value=await response.json().catch(()=>({error:response.status===401?'Sign in again to add readings.':'The cloud service could not be reached.'}));
    if(!response.ok)throw new Error(value.error||'This link could not be imported.');
    if(value.abstractOnly)toast('Only the abstract is free. Upload the PDF for the full breakdown.');
    return {book:value.book,cloudSaved:true};
  }
  async function pasteReadingLink(){
    const input=$('#reading-article-url');if(!input)return;
    try{
      const text=(await navigator.clipboard.readText()).trim();
      const link=text.match(/https?:\/\/\S+|\b10\.\d{4,9}\/\S+|\bPMC\d+\b/i)?.[0]||text;
      if(!link){setImportStatus('Your clipboard is empty. Copy the article link first.',true);return;}
      input.value=link.slice(0,4000);$('#reading-import-form').requestSubmit();
    }catch{setImportStatus('Tap the box, then choose Paste.',true);input.focus();}
  }
  // read.…/read?add=<link> opens Add reading with the link already in, so a share-sheet
  // shortcut can send an article here in one tap.
  function readingImportFromAddress(){
    let link='';try{const params=new URLSearchParams(location.search);link=(params.get('add')||'').trim();if(!link)return;params.delete('add');history.replaceState(null,'',location.pathname+(params.toString()?'?'+params:'')+location.hash);}catch{return;}
    importReadingLinkNow(link);
  }
  // Opens Add reading with the link in place and starts the import: one tap from a suggestion.
  function importReadingLinkNow(link){
    if(readingImportBusy)return;
    readingImportTab='link';readingImportPrefill=String(link||'').slice(0,4000);openReadingImport();readingImportPrefill='';
    setTimeout(()=>$('#reading-import-form')?.requestSubmit(),0);
  }
  async function submitReadingImport(event){
    event.preventDefault();if(readingImportBusy||importing)return;
    const mode=readingImportTab,type=$('#reading-document-type')?.value||'article',file=$('#reading-document-file')?.files[0],url=$('#reading-article-url')?.value.trim(),title=$('#reading-text-title')?.value.trim(),text=$('#reading-pasted-text')?.value;
    if(mode==='file'&&!file)return;
    readingImportBusy=true;const dialog=$('#reading-import-dialog');dialog.setAttribute('aria-busy','true');dialog.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
    try{
      let book,cloudSaved=false;setImportStatus(mode==='link'?'Fetching the readable article…':'Opening your reading…');
      if(mode==='link'){const result=await importReadingLinkFromCloud(url);book=result.book;cloudSaved=result.cloudSaved;}
      else if(mode==='text'){const core=await documentImportCore();book=await core.normalizeImportedText({text,title,sourceType:type,sourceFormat:'TXT'});}
      else book=/\.epub$/i.test(file.name)?{...await readEPUB(file),sourceFormat:'EPUB',sourceType:'book'}:await readImportedDocument(file,{sourceType:type,onProgress:message=>setImportStatus(message)});
      setImportStatus('Saving to your private library…');await addImportedReading(book,{cloudSaved});
    }catch(error){setImportStatus(error?.message||'This reading could not be imported. Try a text copy.',true);if(!dialog.open)toast(error?.message||'Your guide could not be started. Try again from the reading overview.');}
    finally{readingImportBusy=false;dialog.removeAttribute('aria-busy');dialog.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=false);}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    if(button.dataset.action==='import-close')$('#reading-import-dialog')?.close();
    if(button.dataset.action==='import-paste'&&!readingImportBusy)pasteReadingLink();
    if(button.dataset.action==='import-tab'&&!readingImportBusy){readingImportTab=button.dataset.tab;paintReadingImport();$(`[data-action="import-tab"][data-tab="${readingImportTab}"]`)?.focus();}
  });
