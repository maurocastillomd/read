  let sourceReading={chapterId:'',match:'',paragraphId:'',expanded:false};
  function sourceParagraphs(chapter){return readingParagraphs(chapter);}
  function sourceParagraphEntries(chapter){
    // Keep the reader's original characters and filtering, but count pN IDs
    // before filtering exactly as the generation normalizer does.
    let number=0;
    const entries=String(chapter.text||'').split(/\n+/).filter(line=>EpubStructure.structuredLine(line.trim()).kind!=='figure').map(line=>{
      const text=EpubStructure.structuredLine(line.trim()).text.trim(),pieces=[];let cursor=0;
      for(const raw of text.split(/\r+/)){
        const part=raw.trim();if(!part)continue;
        const start=text.indexOf(part,cursor);cursor=start+part.length;
        pieces.push({id:'p'+(++number),text:part,start});
      }
      return {text,pieces};
    }).filter(p=>p.text&&!/^OceanofPDF\.com$/i.test(p.text)&&!/^\*\s*\*/.test(p.text));
    const normal=s=>s.toLowerCase().replace(/[^a-z0-9]/g,''),title=normal(chapter.title);
    return entries.filter((p,i)=>!(i<3&&normal(p.text)===title));
  }
  function sourceQuoteRange(text,quote){
    if(!quote)return null;
    const exact=text.indexOf(quote);if(exact>=0)return {start:exact,end:exact+quote.length};
    // References collapse horizontal whitespace. Match that normalization
    // while highlighting the untouched source characters, including tabs.
    const pattern=quote.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'[\\t \\f\\v\\u00a0]+');
    const match=new RegExp(pattern).exec(text);return match?{start:match.index,end:match.index+match[0].length}:null;
  }
  function sourceCitation(entries,quote,paragraphId=''){
    const id=paragraphId.match(/^p([1-9]\d*)(?:\.\d+)?$/)?.[1];
    if(paragraphId&&!id)return null;
    for(let index=0;index<entries.length;index++){
      for(const piece of entries[index].pieces){
        if(id&&piece.id!=='p'+id)continue;
        const range=sourceQuoteRange(piece.text,quote);
        if(range)return {index,start:piece.start+range.start,end:piece.start+range.end};
      }
    }
    return null;
  }
  function openSource(id,match='',paragraphId=''){
    if(!activeBook.chapters.some(c=>c.id===id))return;
    bookmarkSourceChapter=id;sourceReading={chapterId:id,match:match||'',paragraphId:paragraphId||'',expanded:false};paintSource();
    const dialog=$('#source-dialog');if(!dialog.open)dialog.showModal();
    $('#source-content').scrollTop=0;applyBookmarkHighlights();
    requestAnimationFrame(()=>{const hit=$('#source-content .is-cited'),body=$('#source-content');if(!hit)return;const relative=hit.getBoundingClientRect().top-body.getBoundingClientRect().top;if(relative+hit.offsetHeight>body.clientHeight-24)body.scrollTop+=Math.max(0,relative-20);});
  }
  function paintSource(){
    const chapter=activeBook.chapters.find(c=>c.id===sourceReading.chapterId);if(!chapter)return;
    const entries=sourceParagraphEntries(chapter),paragraphs=entries.map(p=>p.text),citation=sourceCitation(entries,sourceReading.match,sourceReading.paragraphId),hit=citation?.index??-1;
    const start=sourceReading.expanded?0:hit>=0?Math.max(0,hit-1):0,end=sourceReading.expanded?paragraphs.length:hit>=0?Math.min(paragraphs.length,hit+3):Math.min(5,paragraphs.length);
    const subset=paragraphs.slice(start,end),format=activeBook.sourceFormat||'EPUB';
    $('#source-dialog .dialog-bar').innerHTML=`<span class="source-bar-label">${readIcon('book')} Original source</span><div><button class="icon-button" data-action="bookmark-source" aria-label="Bookmark original section" title="Bookmark original section">${readIcon('bookmark')}</button><button class="icon-button" data-action="close-source" aria-label="Close original passage">${readIcon('close')}</button></div>`;
    $('#source-content').innerHTML=`<header class="source-heading"><p class="eyebrow">${esc(activeBook.title)}</p><h2 id="source-title">${esc(chapter.title)}</h2><p class="source-origin">${esc(activeBook.author||'Imported reading')} · ${esc(format)}</p><p class="source-context-label">${hit>=0?'The cited passage, with surrounding context.':'Original wording, with paragraph spacing for reading.'} ${format==='PDF'?'PDF layout and figures may differ from this extracted text.':''}</p>${originalPdfLink(chapter)}</header><div class="source-reading-text">${start>0?'<p class="source-omission" aria-label="Earlier paragraphs omitted">Earlier context above ···</p>':''}${subset.map((p,i)=>{const at=citation&&start+i===hit?citation.start:-1,endAt=at>=0?citation.end:0;return `<p class="source-p ${at>=0?'is-cited':''}" data-source-paragraph="${start+i+1}"><span class="para-num" aria-label="Paragraph ${start+i+1}">${String(start+i+1).padStart(2,'0')}</span>${at<0?esc(p):esc(p.slice(0,at))+'<mark class="source-citation">'+esc(p.slice(at,endAt))+'</mark>'+esc(p.slice(endAt))}</p>`;}).join('')}${end<paragraphs.length?'<p class="source-omission">More context below ···</p>':''}</div><div class="source-context-actions">${!sourceReading.expanded&&(start>0||end<paragraphs.length)?'<button class="secondary" data-action="source-expand">Read the full section here</button>':''}<button class="text-button" data-action="source-to-reader" data-chapter="${esc(chapter.id)}">Open in the source reader ${readIcon('arrow')}</button></div>`;
    $('#source-return').innerHTML=`<span>${hit>=0?'Highlighted text is the exact linked wording.':'Your place in the lesson is kept.'}</span><button class="primary" data-action="close-source">${readIcon('back')} Back to lesson</button>`;
  }
  function setupDismissibleDialog(dialog){
    let beganOutside=false;
    const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    dialog.addEventListener('pointerdown',e=>{beganOutside=e.target===dialog&&outside(e);});
    dialog.addEventListener('pointerup',e=>{if(beganOutside&&e.target===dialog&&outside(e))dialog.close();beganOutside=false;});
  }
  setupDismissibleDialog($('#source-dialog'));
  $('#source-dialog').addEventListener('close',()=>{hideBookmarkSelection();window.getSelection()?.removeAllRanges();});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-action="source-expand"]');if(!button)return;sourceReading.expanded=true;paintSource();applyBookmarkHighlights();$('#source-content .is-cited')?.scrollIntoView({block:'center',behavior:'instant'});});
