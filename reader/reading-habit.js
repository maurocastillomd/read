  // Calendar days are local to the reading device. Cloud state contains only
  // deliberate day markers and pace preferences, never fabricated history.
  const readingHabitPreferenceId='__reading-habit__';
  const readingHabitActivityKey=STORE+':reading-activity-v1';
  const readingHabitDayPrefix='reading-day:';
  const readingHabitWordCache=new WeakMap();
  function readingHabitDay(date=new Date()) {
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function readingHabitDate(day) {
    if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
    const [year,month,date]=day.split('-').map(Number),result=new Date(year,month-1,date,12);
    return readingHabitDay(result)===day?result:null;
  }
  function readingHabitShift(day,amount) {
    const date=readingHabitDate(day);if(!date)return '';
    date.setDate(date.getDate()+amount);return readingHabitDay(date);
  }
  function readingHabitDays(data) {
    const days=new Set();
    for(const checks of Object.values(data.checks||{}))for(const [key,value]of Object.entries(checks||{})) {
      if(value===true&&key.startsWith(readingHabitDayPrefix)&&readingHabitDate(key.slice(readingHabitDayPrefix.length)))days.add(key.slice(readingHabitDayPrefix.length));
    }
    return days;
  }
  function readingHabitStreak(data,today=readingHabitDay()) {
    const days=readingHabitDays(data),completed=days.has(today);
    let day=completed?today:readingHabitShift(today,-1),streak=0;
    while(days.has(day)){streak++;day=readingHabitShift(day,-1);}
    return {streak,completed,week:Array.from({length:7},(_,index)=>{const day=readingHabitShift(today,index-6);return {day,read:days.has(day),today:day===today};})};
  }
  function readingHabitPreferences(data=state) {
    const saved=data.last?.[readingHabitPreferenceId]||{};
    const bounded=(value,min,max,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.round(Math.max(min,Math.min(max,value))):fallback;
    return {minutes:bounded(saved.minutes,5,120,15),wordsPerMinute:bounded(saved.wordsPerMinute,100,600,200)};
  }
  function readingHabitWords(book) {
    if(readingHabitWordCache.has(book))return readingHabitWordCache.get(book);
    const sections=(book.chapters||[]).map(chapter=>({id:chapter.id,words:(String(chapter.text||'').match(/\S+/gu)||[]).length}));
    const result={sections,total:sections.reduce((sum,section)=>sum+section.words,0)};readingHabitWordCache.set(book,result);return result;
  }
  function readingHabitBookModel(book,data=state,preferences=readingHabitPreferences(data)) {
    const words=readingHabitWords(book),checks=data.checks?.[book.id]||{};
    const completed=words.sections.filter(section=>checks['read:'+section.id]===true);
    const remaining=Math.max(0,words.total-completed.reduce((sum,section)=>sum+section.words,0));
    return {words:words.total,remaining,sections:words.sections.length,sectionsRead:completed.length,
      minutes:remaining/preferences.wordsPerMinute,days:remaining?Math.ceil(remaining/(preferences.minutes*preferences.wordsPerMinute)):0,
      complete:words.sections.length>0&&completed.length===words.sections.length};
  }
  function readingHabitPace(library=books,data=state) {
    const preferences=readingHabitPreferences(data),visible=library.filter(book=>book.sourceType!=='article'&&!data.hiddenBooks?.[book.id]&&!(typeof isReplaced==='function'&&isReplaced(book,library)));
    const counts=visible.map(book=>readingHabitWords(book).total).filter(count=>count>0);
    const average=counts.length?counts.reduce((sum,count)=>sum+count,0)/counts.length:0;
    return {...preferences,average,books:counts.length,annual:average?Math.floor(preferences.minutes*preferences.wordsPerMinute*365/average):0};
  }
  // Credit only a short observed interval. A sleeping device or delayed timer
  // cannot turn elapsed wall-clock time into reading time.
  function readingHabitActivityIntervals(previous,now) {
    if(!previous||!previous.eligible||!previous.bookId||!Number.isFinite(previous.interactedAt)||previous.interactedAt<=0)return [];
    const elapsed=now-previous.at;
    if(elapsed<=0||elapsed>15000)return [];
    const end=Math.min(now,previous.interactedAt+120000);
    let start=previous.at;const intervals=[];
    while(start<end){
      const date=new Date(start),midnight=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime(),stop=Math.min(end,midnight);
      intervals.push({day:readingHabitDay(date),start,end:stop,seconds:(stop-start)/1000,bookId:previous.bookId});start=stop;
    }
    return intervals;
  }
  function readingHabitActivityRecord(value,day) {
    if(value?.version!==1||value.day!==day)return {version:1,day,seconds:0,through:0};
    return {version:1,day,seconds:Number.isFinite(value.seconds)?Math.max(0,Math.min(60,value.seconds)):0,through:Number.isFinite(value.through)?Math.max(0,value.through):0};
  }
  function readingHabitCredit(record,interval) {
    const result=readingHabitActivityRecord(record,interval.day);
    // Shared local storage de-duplicates overlapping intervals in multiple tabs.
    const start=Math.max(interval.start,result.through);
    if(interval.end>start){result.seconds=Math.min(60,result.seconds+(interval.end-start)/1000);result.through=interval.end;}
    return result;
  }
  let readingHabitStarted=false,readingHabitPrevious=null,readingHabitInteractedAt=0,readingHabitTimer=null;
  let readingHabitLocal={version:1,day:'',seconds:0,through:0};
  function readingHabitLoad(day) {
    let stored=null;try{stored=JSON.parse(localStorage.getItem(readingHabitActivityKey)||'null');}catch(_){}
    const local=readingHabitActivityRecord(readingHabitLocal,day),remote=readingHabitActivityRecord(stored,day);
    // The newer checkpoint owns its cumulative value. A blocked-storage browser
    // still retains the current session's credit in memory.
    return remote.through>local.through?remote:local;
  }
  function readingHabitSnapshot(now) {
    return {at:now,bookId:activeBook?.id||'',interactedAt:readingHabitInteractedAt,
      eligible:document.visibilityState==='visible'&&['reader','explore','learn'].includes(view)&&!document.querySelector('dialog[open]')};
  }
  function readingHabitTick(now=Date.now()) {
    const current=readingHabitSnapshot(now);
    const intervals=current.eligible?readingHabitActivityIntervals(readingHabitPrevious,now):[];
    let changed=false;
    for(const interval of intervals){
      if(readingHabitDays(state).has(interval.day))continue;
      readingHabitLocal=readingHabitCredit(readingHabitLoad(interval.day),interval);
      try{localStorage.setItem(readingHabitActivityKey,JSON.stringify(readingHabitLocal));}catch(_){}
      if(readingHabitLocal.seconds>=60){
        state.checks[interval.bookId]||={};state.checks[interval.bookId][readingHabitDayPrefix+interval.day]=true;changed=true;
      }
    }
    readingHabitPrevious=current;
    if(changed)save();
    readingHabitUpdate();
  }
  function readingHabitDayStatus(streak) {
    if(streak.completed)return 'Today counts. Your reading day is saved.';
    const seconds=Math.floor(readingHabitLoad(readingHabitDay()).seconds);
    return seconds?`${seconds} of 60 active seconds toward today.`:'Read for one active minute to count today.';
  }
  function readingHabitSummaryLabel() {
    const streak=readingHabitStreak(state),pace=readingHabitPreferences();
    return `${streak.streak} ${streak.streak===1?'day':'days'} in a row · ${pace.minutes} min/day plan`;
  }
  function readingHabitSummary() {
    return `<div class="reading-habit-strip"><button class="reading-habit-summary" data-action="reading-habit-open" aria-label="Open your reading streak and pace"><span class="habit-summary-mark" aria-hidden="true">◷</span><span data-habit-summary>${esc(readingHabitSummaryLabel())}</span><span class="habit-summary-link">Your pace <span aria-hidden="true">↗</span></span></button></div>`;
  }
  function readingHabitWeekMarkup(streak) {
    return streak.week.map(day=>`<li class="${day.read?'is-read ':''}${day.today?'is-today':''}" data-habit-day="${day.day}" aria-label="${esc(readingHabitDate(day.day).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}))}: ${day.read?'reading day saved':'not recorded'}"><span>${esc(readingHabitDate(day.day).toLocaleDateString(undefined,{weekday:'narrow'}))}</span><i aria-hidden="true">${day.read?'✓':''}</i></li>`).join('');
  }
  function readingHabitDashboard() {
    const pace=readingHabitPace(),streak=readingHabitStreak(state);
    return `<section id="reading-habit-dashboard" class="reading-habit-dashboard" tabindex="-1" aria-labelledby="reading-habit-title"><div class="habit-heading"><div><p class="eyebrow">Small sessions, more books</p><h2 id="reading-habit-title">Your reading rhythm.</h2></div><p class="habit-heading-note">A plan you can adjust.</p></div><div class="habit-grid"><div class="habit-streak"><p class="habit-stat"><strong data-habit-streak>${streak.streak}</strong><span>day streak</span></p><ol class="habit-week" aria-label="Reading days in the last seven days" data-habit-week>${readingHabitWeekMarkup(streak)}</ol><p class="habit-status" data-habit-status>${esc(readingHabitDayStatus(streak))}</p></div><div class="habit-projection"><p class="habit-stat"><strong data-habit-annual>${pace.average?pace.annual:'—'}</strong><span>books / year, estimated</span></p><p class="habit-assumption" data-habit-assumption>${esc(readingHabitAssumption(pace))}</p><div class="habit-controls"><label>Daily reading <span><input data-habit-setting="minutes" type="number" inputmode="numeric" min="5" max="120" step="1" value="${pace.minutes}" aria-label="Daily reading minutes"><span>min/day</span></span></label><label>Reading speed <span><input data-habit-setting="wordsPerMinute" type="number" inputmode="numeric" min="100" max="600" step="10" value="${pace.wordsPerMinute}" aria-label="Assumed reading speed in words per minute"><span>words/min</span></span></label></div></div></div><details class="habit-method"><summary>How the streak and estimate work</summary><p>A day counts after 60 cumulative seconds in the original reader or a lesson, following an interaction. Timing pauses when the page is hidden, a dialog is open, or you have been idle for two minutes. Days use your device’s local calendar. A streak remains available the next day until midnight. Tracking starts now; earlier visits are not backfilled.</p><p>The projection assumes you read every day at your chosen speed. It uses the average extracted word count of books on your shelf; articles are excluded from this estimate. Lesson practice and reflection take extra time. This is a planning estimate, not a measured reading speed. Only sections you explicitly mark read reduce a book’s remaining estimate.</p></details></section>`;
  }
  function readingHabitAssumption(pace) {
    return pace.average?`${pace.minutes} minutes every day × ${pace.wordsPerMinute} words/min. Based on ${Math.round(pace.average).toLocaleString()} words per book, the average of ${pace.books} ${pace.books===1?'book':'books'} on your shelf.`:'Add a readable book to estimate how many you could finish.';
  }
  function readingHabitEstimateText(model,preferences) {
    if(model.complete)return 'All original sections marked read.';
    if(!model.words)return 'A reading estimate will appear when this book has extracted text.';
    const time=Math.ceil(model.minutes),duration=time<60?`${time} min`:`${Math.floor(time/60)} hr${time%60?' '+time%60+' min':''}`;
    return `About ${model.days} ${model.days===1?'day':'days'} remaining at ${preferences.minutes} min/day · ${duration} of original text.`;
  }
  function readingHabitBookEstimate(book) {
    const preferences=readingHabitPreferences(),model=readingHabitBookModel(book,state,preferences);
    return `<div class="reading-habit-book" data-habit-book="${esc(book.id)}"><span class="habit-book-label">Your reading plan</span><p data-habit-book-estimate>${esc(readingHabitEstimateText(model,preferences))}</p><small data-habit-book-note>${model.words.toLocaleString()} extracted words · ${model.sectionsRead}/${model.sections} original sections marked read · assumes ${preferences.wordsPerMinute} words/min.</small><button class="text-button" data-action="reading-habit-open">Adjust your pace ↗</button></div>`;
  }
  function readingHabitUpdate() {
    const streak=readingHabitStreak(state),pace=readingHabitPace();
    const put=(selector,text)=>document.querySelectorAll(selector).forEach(node=>{if(node.textContent!==String(text))node.textContent=text;});
    put('[data-habit-summary]',readingHabitSummaryLabel());put('[data-habit-streak]',streak.streak);put('[data-habit-annual]',pace.average?pace.annual:'—');
    put('[data-habit-status]',readingHabitDayStatus(streak));put('[data-habit-assumption]',readingHabitAssumption(pace));
    document.querySelectorAll('[data-habit-week]').forEach(node=>{const html=readingHabitWeekMarkup(streak);if(node.dataset.habitRevision!==html){node.innerHTML=html;node.dataset.habitRevision=html;}});
    document.querySelectorAll('[data-habit-book]').forEach(node=>{
      const book=books.find(book=>book.id===node.dataset.habitBook);if(!book)return;
      const model=readingHabitBookModel(book,state,pace),estimate=node.querySelector('[data-habit-book-estimate]'),note=node.querySelector('[data-habit-book-note]');
      if(estimate)estimate.textContent=readingHabitEstimateText(model,pace);
      if(note)note.textContent=`${model.words.toLocaleString()} extracted words · ${model.sectionsRead}/${model.sections} original sections marked read · assumes ${pace.wordsPerMinute} words/min.`;
    });
  }
  function readingHabitAfterRender() {
    if(readingHabitStarted)readingHabitTick();else readingHabitUpdate();
  }
  function initializeReadingHabit() {
    if(readingHabitStarted)return;readingHabitStarted=true;readingHabitPrevious=readingHabitSnapshot(Date.now());
    const interact=event=>{
      if(event.isTrusted===false)return;
      const now=Date.now();readingHabitTick(now);readingHabitInteractedAt=now;readingHabitPrevious=readingHabitSnapshot(now);
    };
    for(const name of ['pointerdown','touchstart','wheel','keydown'])window.addEventListener(name,interact,{passive:true,capture:true});
    document.addEventListener('visibilitychange',()=>{readingHabitTick();if(document.visibilityState!=='visible')readingHabitInteractedAt=0;readingHabitPrevious=readingHabitSnapshot(Date.now());});
    window.addEventListener('blur',()=>{readingHabitTick();readingHabitPrevious=null;readingHabitInteractedAt=0;});
    window.addEventListener('focus',()=>{readingHabitPrevious=readingHabitSnapshot(Date.now());readingHabitUpdate();});
    window.addEventListener('pagehide',()=>{readingHabitTick();readingHabitPrevious=null;readingHabitInteractedAt=0;});
    window.addEventListener('pageshow',()=>{readingHabitPrevious=readingHabitSnapshot(Date.now());readingHabitUpdate();});
    window.addEventListener('storage',event=>{if(event.key===readingHabitActivityKey)readingHabitUpdate();});
    document.addEventListener('click',event=>{
      if(!event.target.closest?.('[data-action="reading-habit-open"]'))return;
      go('library');requestAnimationFrame(()=>{const dashboard=document.getElementById('reading-habit-dashboard');dashboard?.scrollIntoView({behavior:'instant',block:'start'});dashboard?.focus({preventScroll:true});});
    });
    const updatePreference=event=>{
      const input=event.target.closest?.('[data-habit-setting]');if(!input)return;
      const key=input.dataset.habitSetting;if(!['minutes','wordsPerMinute'].includes(key))return;
      const min=key==='minutes'?5:100,max=key==='minutes'?120:600;
      const number=Number(input.value),live=event.type==='input';
      // Let readers type a multi-digit value without turning an intermediate
      // "3" into "5". Valid values update the estimate immediately.
      if(!Number.isFinite(number)||input.value.trim()===''){if(!live)input.value=String(readingHabitPreferences()[key]);return;}
      if(live&&(number<min||number>max||!Number.isInteger(number)))return;
      const value=Math.round(Math.max(min,Math.min(max,number))),changed=readingHabitPreferences()[key]!==value;
      if(!live)input.value=String(value);
      if(changed){state.last[readingHabitPreferenceId]||={};state.last[readingHabitPreferenceId][key]=value;save();readingHabitUpdate();}
    };
    document.addEventListener('input',updatePreference);
    document.addEventListener('change',updatePreference);
    readingHabitTimer=setInterval(()=>readingHabitTick(),5000);
  }
