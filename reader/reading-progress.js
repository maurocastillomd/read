  // Visited steps, deliberate review, and reading position are different signals.
  const progressKey = (kind,id,index) => kind+':'+id+(index===undefined?'':':'+index);
  const progressStep = value => Math.max(0,Math.min(5,Math.floor(Number(value)||0)));
  function lessonProgressModel(data,bookId,unitId,legacy=false) {
    const checks=data.checks?.[bookId]||{};
    const visited=Array.from({length:6},(_,i)=>checks[progressKey('seen',unitId,i)]===true);
    return {visited,count:visited.filter(Boolean).length,reviewed:checks['lesson:'+unitId]===true||!!(legacy&&data.reviewed?.[bookId])};
  }
  function bookProgressModel(data,book,records) {
    const unique=[...new Map(records.map(rec=>[rec.unitId,rec])).values()];
    const reviewed=unique.filter(rec=>data.checks?.[book.id]?.['lesson:'+rec.unitId]===true).length;
    const read=book.chapters.filter(ch=>data.checks?.[book.id]?.[progressKey('read',ch.id)]===true).length;
    return {reviewed,lessons:unique.length,read,sections:book.chapters.length};
  }
  function visitLesson(data,bookId,unitId,value) {
    const current=progressStep(value),checks=data.checks[bookId]||={},last=data.last[bookId]||={};
    const seen=progressKey('seen',unitId,current),key=progressKey('lesson-step',unitId);
    const changed=checks[seen]!==true||last[key]!==current;
    checks[seen]=true;last[key]=current;return changed;
  }
  function readingPosition(data,bookId,chapter) {
    const value=Number(data.last?.[bookId]?.[progressKey('reader',chapter)]);
    return Number.isFinite(value)?Math.max(0,Math.min(1000,value))/1000:0;
  }
  function storeReadingPosition(data,bookId,chapter,ratio) {
    if(!Number.isFinite(ratio))return false;
    const last=data.last[bookId]||={},key=progressKey('reader',chapter),value=Math.round(Math.max(0,Math.min(1,ratio))*1000);
    if(last[key]===value&&last.chapter===chapter)return false;
    last[key]=value;last.chapter=chapter;return true;
  }
  function progressMeter(label,value,total,extra='') {
    const max=Math.max(1,total),percent=total?Math.round(value/total*100):0;
    return `<div class="reading-progress-meter ${extra}"><div class="progress-caption"><span>${esc(label)}</span><span>${value} / ${total}</span></div><progress value="${value}" max="${max}" aria-label="${esc(label)}: ${value} of ${total}"></progress><span class="sr-only">${percent}%</span></div>`;
  }
  function bookProgress(book=activeBook,compact=false) {
    const p=bookProgressModel(state,book,bookGuides(book));
    return `<div class="book-reading-progress ${compact?'progress-compact':''}">${p.lessons?progressMeter('Lessons done',bookGuides(book).filter(rec=>lessonDone(rec,book)).length,p.lessons):''}${!p.lessons||!compact?progressMeter('Original sections read',p.read,p.sections):''}</div>`;
  }
  function lessonProgress(unitId,current,legacy=false) {
    const p=lessonProgressModel(state,activeBook.id,unitId,legacy);
    return `<div class="lesson-reading-progress" aria-label="Lesson progress"><div class="lesson-progress-position"><strong>Step ${progressStep(current)+1} of 6</strong><span>${p.count} of 6 steps visited</span></div><div class="lesson-progress-dots" aria-hidden="true">${p.visited.map((seen,i)=>`<span class="${seen?'visited ':''}${i===current?'current':''}"></span>`).join('')}</div><span class="lesson-review-status">${p.reviewed?'Reviewed ✓':'Review at your own pace'}</span></div>`;
  }
  function sectionProgress(chapter) {
    const percent=Math.round(readingPosition(state,activeBook.id,chapter.id)*100),read=state.checks[activeBook.id]?.[progressKey('read',chapter.id)]===true;
    return `<div class="reader-position-bar"><div><span>Reading position</span><div class="reader-position-actions"><strong data-reading-percent>${percent}%</strong><button class="reading-settings-button" data-action="reading-settings" aria-label="Reading appearance and night light">Aa · Reading</button></div></div><progress data-reading-position value="${percent}" max="100" aria-label="Position in this section"></progress><span class="small">Your place is saved. Mark the section read when you finish.</span></div><div class="reader-completion"><button class="secondary" data-action="mark-section-read" aria-pressed="${read}">${read?'Section read ✓':'Mark section read'}</button><button class="text-button" data-action="reader-start">Back to the start ↑</button></div>`;
  }
  function recordLessonVisit() {
    if(view==='explore'){
      const rec=bookGuides().find(g=>g.unitId===selectedUnit)||bookGuides()[0];
      if(rec){
        const changed=visitLesson(state,activeBook.id,rec.unitId,guideStep),last=state.last[activeBook.id];
        const moved=last.unit!==rec.unitId||last.guideStep!==progressStep(guideStep);
        last.unit=rec.unitId;last.guideStep=progressStep(guideStep);if(changed||moved){last.at=new Date().toISOString();save();}
      }
    }else if(view==='learn'){
      const changed=visitLesson(state,activeBook.id,'legacy:'+guide.chapterId,step),last=state.last[activeBook.id],moved=last.step!==progressStep(step);
      last.step=progressStep(step);if(changed||moved)save();
    }
  }
  let progressReaderKey='',progressReady=false,progressSaveTimer=null,progressPending=null;
  let progressReaderMoved=false,progressRestoredRatio=-1,progressRestoreRevision=0,progressLiveRatio=0,progressSettingsOpen=false;
  function readerGeometry() {
    const article=$('.reader-article');
    if(!article)return null;
    return {top:article.getBoundingClientRect().top+window.scrollY,span:Math.max(1,article.offsetHeight-window.innerHeight*.7)};
  }
  function updateReadingMeter(ratio) {
    const percent=Math.round(ratio*100),meter=$('[data-reading-position]'),label=$('[data-reading-percent]');
    if(meter)meter.value=percent;if(label)label.textContent=percent+'%';
    if(typeof bookReaderProgress==='function')bookReaderProgress(ratio);
  }
  function flushReadingProgress() {
    clearTimeout(progressSaveTimer);progressSaveTimer=null;
    if(progressPending){const {bookId,chapter,ratio}=progressPending;progressPending=null;if(storeReadingPosition(state,bookId,chapter,ratio))save();}
  }
  function restoreReadingPlace(ratio) {
    progressReady=false;progressLiveRatio=ratio;progressRestoredRatio=ratio;
    const key=progressReaderKey,revision=++progressRestoreRevision;
    const restore=()=>{
      if(view!=='reader'||progressReaderKey!==key||revision!==progressRestoreRevision)return;
      requestAnimationFrame(()=>{
        if(view!=='reader'||progressReaderKey!==key||revision!==progressRestoreRevision)return;
        const geometry=readerGeometry();
        window.scrollTo({top:geometry&&ratio>0?geometry.top+geometry.span*ratio:0,behavior:'instant'});
        updateReadingMeter(ratio);
        requestAnimationFrame(()=>{if(progressReaderKey===key&&revision===progressRestoreRevision)progressReady=!progressSettingsOpen;});
      });
    };
    restore();
    // Web fonts may arrive after the first paint and change line wrapping.
    if(document.fonts?.status==='loading')document.fonts.ready.then(()=>{if(!progressReaderMoved)restore();});
  }
  function progressAfterRender(focus=false) {
    if(view!=='reader'){progressReaderKey='';progressReady=false;progressRestoreRevision++;return;}
    const key=activeBook.id+'/'+chapterId,isNew=progressReaderKey!==key;progressReaderKey=key;
    if(isNew){progressReaderMoved=false;progressRestoredRatio=-1;}
    const ratio=readingPosition(state,activeBook.id,chapterId);
    // The first remote state may arrive after the local page has rendered.
    // Resume it only while the reader has not started moving through the text.
    if(isNew||focus||(!progressReaderMoved&&ratio!==progressRestoredRatio))restoreReadingPlace(ratio);
    else updateReadingMeter(progressLiveRatio);
  }
  function progressBookmarkArrival() {
    if(view!=='reader')return;
    const geometry=readerGeometry();if(!geometry)return;
    const ratio=Math.max(0,Math.min(1,(window.scrollY-geometry.top)/geometry.span));
    if(!Number.isFinite(ratio))return;
    // A deliberate bookmark jump supersedes any queued resume/font restoration
    // and becomes the position used by later cloud refreshes and layout changes.
    clearTimeout(progressSaveTimer);progressSaveTimer=null;progressPending=null;
    progressReaderKey=activeBook.id+'/'+chapterId;progressRestoreRevision++;
    progressReaderMoved=true;progressLiveRatio=ratio;progressRestoredRatio=ratio;progressReady=!progressSettingsOpen;
    if(storeReadingPosition(state,activeBook.id,chapterId,ratio))save();
    updateReadingMeter(ratio);
  }
  function handleReadingProgressAction(action,el) {
    if(action==='mark-section-read'){
      const checks=state.checks[activeBook.id]||={},key=progressKey('read',chapterId);checks[key]=!checks[key];save();sidebar();
      document.querySelectorAll('[data-action="mark-section-read"]').forEach(button=>{button.setAttribute('aria-pressed',String(checks[key]));button.textContent=checks[key]?'Section read ✓':'Mark section read';});
      toast(checks[key]?'Section marked read.':'Section marked unread.');return true;
    }
    if(action==='reader-start'){
      progressPending=null;clearTimeout(progressSaveTimer);progressReady=false;progressReaderMoved=true;progressLiveRatio=0;progressRestoredRatio=0;progressRestoreRevision++;
      if(storeReadingPosition(state,activeBook.id,chapterId,0))save();
      window.scrollTo({top:0,behavior:'instant'});updateReadingMeter(0);
      requestAnimationFrame(()=>{progressReady=true;});return true;
    }
    return false;
  }
  function readingIntent(event) {
    if(view!=='reader'||!progressReady||progressSettingsOpen||event.target?.closest?.('dialog,textarea,input,select'))return;
    if(event.type==='pointerdown'&&(!Number.isFinite(event.clientX)||event.clientX<(document.documentElement?.clientWidth||window.innerWidth||Infinity)))return;
    if(event.type==='keydown'&&!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))return;
    progressReaderMoved=true;
  }
  for(const name of ['wheel','touchmove','pointerdown','keydown'])window.addEventListener(name,readingIntent,{passive:true});
  window.addEventListener('ycaro-reading-settings-open',()=>{
    if(view!=='reader')return;
    flushReadingProgress();progressSettingsOpen=true;progressReady=false;
  });
  window.addEventListener('ycaro-reading-settings-close',()=>{
    if(!progressSettingsOpen)return;
    progressSettingsOpen=false;
    if(view==='reader')restoreReadingPlace(progressLiveRatio);
  });
  window.addEventListener('ycaro-reading-layout-change',()=>{
    if(view!=='reader')return;
    flushReadingProgress();restoreReadingPlace(progressLiveRatio);
  });
  window.addEventListener('resize',()=>{if(view==='reader')restoreReadingPlace(progressLiveRatio);});
  window.addEventListener('scroll',()=>{
    if(view!=='reader'||!progressReady||progressSettingsOpen)return;
    const geometry=readerGeometry();if(!geometry)return;
    const ratio=Math.max(0,Math.min(1,(window.scrollY-geometry.top)/geometry.span));
    // Find-in-page and selection can move the viewport without reading intent.
    // Keep layout restoration current without treating those jumps as a save.
    progressLiveRatio=ratio;updateReadingMeter(ratio);
    if(!progressReaderMoved)return;
    progressPending={bookId:activeBook.id,chapter:chapterId,ratio};
    clearTimeout(progressSaveTimer);progressSaveTimer=setTimeout(flushReadingProgress,700);
  },{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushReadingProgress();});
  window.addEventListener('pagehide',flushReadingProgress);
