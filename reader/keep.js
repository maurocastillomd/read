  // Keep what you read. One memory for everything read. asks you to recall: a
  // lesson's picture, a tap question, an article's main result. Each one has a
  // return schedule (1, 3, 7, then 21 days). "Today" gathers what is due across
  // every book and article; "Before you start" asks one thing from the last
  // lesson; the holding meter and "Your copy" read the same entries.
  // Tap-only. Entries live in state.last[bookId] as 'YYYY-MM-DD|stage|right|returns|misses'
  // (older picture entries are 'YYYY-MM-DD|stage').
  const KEEP_DAYS = [1, 3, 7, 21];
  const KEEP_FORMATS = ['pick', 'book', 'mistake', 'order'];
  const KEEP_BATCH = 8;
  function keepEntry(bookId, key) {
    const raw = state.last[bookId]?.[key];
    const m = typeof raw === 'string' && raw.match(/^(\d{4}-\d{2}-\d{2})\|(\d)(?:\|([01])(?:\|(\d+)(?:\|(\d+))?)?)?$/);
    if (!m) return null;
    const stage = Number(m[2]);
    return {day: m[1], stage, right: m[3] !== '0', returns: m[4] === undefined ? stage : Number(m[4]), misses: Number(m[5] || 0)};
  }
  function keepWrite(bookId, key, e) {
    state.last[bookId] ||= {};
    state.last[bookId][key] = [e.day, e.stage, e.right ? 1 : 0, e.returns, e.misses].join('|');
    save();
  }
  // The day an entry comes back; null once it has passed every return.
  function keepDue(e) {
    if (!e || e.stage >= KEEP_DAYS.length) return null;
    const d = new Date(e.day + 'T12:00:00'); d.setDate(d.getDate() + KEEP_DAYS[e.stage]); return isoDay(d);
  }
  // held: right twice, at least 3 days apart. fading: due back. missed: last answer wrong.
  function keepStatus(e) {
    if (!e) return 'new';
    if (!e.right) return 'missed';
    const due = keepDue(e);
    if (due && due <= isoDay()) return 'fading';
    return e.stage >= 2 && e.returns >= 1 ? 'held' : 'learning';
  }
  // The first answer, in a lesson or an article. A miss comes back tomorrow; a
  // right answer waits 3 days when it was a guess, 7 when sure (pictures: 1 day).
  function keepStart(bookId, key, right, sure = true, firstStage = sure ? 2 : 1) {
    const old = keepEntry(bookId, key), today = isoDay();
    if (!right) keepWrite(bookId, key, {day: today, stage: 0, right: false, returns: old?.returns || 0, misses: (old?.misses || 0) + 1});
    else if (!old) keepWrite(bookId, key, {day: today, stage: firstStage, right: true, returns: 0, misses: 0});
    return keepEntry(bookId, key);
  }
  // A return, answered in Today or before a lesson. Right and sure moves it one
  // step further apart; right but guessing keeps the same gap; a miss resets to tomorrow.
  function keepReturn(bookId, key, right, sure = true) {
    const old = keepEntry(bookId, key) || {day: isoDay(), stage: 0, right: true, returns: 0, misses: 0}, today = isoDay();
    if (!right) keepWrite(bookId, key, {day: today, stage: 0, right: false, returns: old.returns, misses: old.misses + 1});
    else keepWrite(bookId, key, {day: today, stage: sure ? old.stage + 1 : old.stage, right: true, returns: old.returns + 1, misses: old.misses});
    return keepEntry(bookId, key);
  }
  function keepAnswer(bookId, key, right, sure, firstStage) {
    return keepEntry(bookId, key) ? keepReturn(bookId, key, right, sure) : keepStart(bookId, key, right, sure, firstStage);
  }
  function keepWhen(e) {
    const day = keepDue(e);
    if (!day) return 'Held. It will not come back.';
    const diff = Math.round((new Date(day + 'T12:00:00') - new Date(isoDay() + 'T12:00:00')) / 86400000);
    return diff <= 0 ? 'Comes back today' : diff === 1 ? 'Comes back tomorrow' : 'Comes back in ' + diff + ' days';
  }
  // Hooks from the lesson and the article.
  function keepRecordTap(rec, q, right, sure) { if (KEEP_FORMATS.includes(q.format)) keepStart(rec.bookId || activeBook.id, 'tap:' + rec.unitId + ':' + q.id, right, sure); }
  function keepRecordPredict(rec, right) { keepStart(rec.bookId || activeBook.id, 'predict:' + rec.unitId, right, true); }
  // ---------- What can be recalled ----------
  function keepBooks(book) { return book ? [book] : books.filter(b => !state.hiddenBooks?.[b.id] && !isReplaced(b)); }
  function keepResultVisual(rec) {
    const v = rec.guide?.articleAnalysis?.studyVisual;
    return v?.headline?.measure && ['increase', 'decrease', 'no-clear-difference'].includes(v.headline.direction) ? v : null;
  }
  function keepItems(book, rec) {
    const r = {...rec, bookId: book.id}, out = [];
    if (ideaApplies(r)) out.push({kind: 'picture', key: 'pic:' + rec.unitId, book, rec: r});
    for (const q of tapQuestions(r)) if (KEEP_FORMATS.includes(q.format) && q.id) out.push({kind: 'question', key: 'tap:' + rec.unitId + ':' + q.id, book, rec: r, q});
    const v = keepResultVisual(rec); if (v) out.push({kind: 'result', key: 'predict:' + rec.unitId, book, rec: r, v});
    return out.map(item => ({...item, entry: keepEntry(book.id, item.key)}));
  }
  function keepDueItems(book) {
    const today = isoDay(), due = [], later = [];
    for (const b of keepBooks(book)) for (const rec of bookGuides(b)) for (const it of keepItems(b, rec)) {
      if (!it.entry) continue;
      const day = keepDue(it.entry); if (!day) continue;
      (day <= today ? due : later).push({...it, day});
    }
    // Misses first, then the oldest; then one book at a time in turn, so no two in a row come from the same reading.
    due.sort((a, b) => (Number(a.entry.right) - Number(b.entry.right)) || a.day.localeCompare(b.day));
    const byBook = new Map();
    for (const it of due) { if (!byBook.has(it.book.id)) byBook.set(it.book.id, []); byBook.get(it.book.id).push(it); }
    const mixed = [];
    while (mixed.length < due.length) for (const q of byBook.values()) if (q.length) mixed.push(q.shift());
    later.sort((a, b) => a.day.localeCompare(b.day));
    return {due: mixed, later};
  }
  // ---------- The holding meter ----------
  function keepLessonStatus(book, rec) {
    const items = keepItems(book, rec), met = items.filter(i => i.entry);
    if (!items.length) return '';
    if (!met.length) return 'new';
    const st = met.map(i => keepStatus(i.entry));
    if (st.includes('missed')) return 'missed';
    if (st.includes('fading')) return 'fading';
    const main = met.find(i => i.kind === 'picture') || met.find(i => i.kind === 'result');
    return (main ? keepStatus(main.entry) === 'held' : st.every(s => s === 'held')) ? 'held' : 'learning';
  }
  function keepCounts(book) {
    const c = {held: 0, fading: 0, missed: 0, learning: 0, new: 0, total: 0, readings: 0};
    for (const b of keepBooks(book)) {
      let any = false;
      for (const rec of bookGuides(b)) { const s = keepLessonStatus(b, rec); if (!s) continue; c[s]++; c.total++; any = true; }
      if (any) c.readings++;
    }
    return c;
  }
  function keepCaption(c, compact) {
    const parts = [['held', 'held', c.held], ['fading', 'fading', c.fading], ['missed', 'missed', c.missed]].filter(p => p[2]);
    if (!parts.length) return compact ? 'Nothing held yet' : 'Nothing held yet. An idea counts once you recall it.';
    return parts.map(([k, l, n]) => `<span class="keep-${k}">${n} ${l}</span>`).join('<i aria-hidden="true">·</i>');
  }
  function keepMeter(book, {compact = false, note = '', quiet = false} = {}) {
    const c = keepCounts(book);
    if (!c.total || (quiet && c.total === c.new)) return '';
    const pct = n => (n / c.total * 100).toFixed(1) + '%';
    const label = `${c.held} of ${c.total} ideas held, ${c.fading} fading, ${c.missed} missed`;
    return `<div class="keep-meter${compact ? ' is-compact' : ''}"><div class="keep-bar" role="img" aria-label="${esc(label)}">${[['held', c.held], ['fading', c.fading], ['missed', c.missed]].map(([k, n]) => n ? `<span class="keep-${k}" style="width:${pct(n)}"></span>` : '').join('')}</div><div class="keep-caption"><span>${keepCaption(c, compact)}</span>${note ? `<span>${note}</span>` : ''}</div></div>`;
  }
  // ---------- Today ----------
  function keepChips(items) {
    const n = (label, count) => count ? `<span class="keep-chip is-${label[0]}"><i></i>${count} ${label[1]}${count === 1 ? '' : label[2] ?? 's'}</span>` : '';
    const missed = items.filter(i => !i.entry.right), rest = items.filter(i => i.entry.right);
    const guessed = rest.filter(i => i.kind === 'question' && state.checks[i.book.id]?.['tap-sure:' + i.rec.unitId + ':' + i.q.id] === false);
    return `<div class="keep-chips">${n(['missed', 'you missed', ''], missed.length)}${n(['picture', 'picture'], rest.filter(i => i.kind === 'picture').length)}${n(['question', 'question'], rest.filter(i => i.kind === 'question').length - guessed.length)}${n(['guess', 'you guessed right', ''], guessed.length)}${n(['result', 'article result'], rest.filter(i => i.kind === 'result').length)}</div>`;
  }
  function todayCard(book) {
    const {due, later} = keepDueItems(book);
    if (!due.length && !later.length) return '';
    const art = (due.find(i => i.kind === 'picture') || later.find(i => i.kind === 'picture'));
    const readings = new Set(due.map(i => i.book.id)).size, minutes = Math.max(1, Math.round(due.length / 3));
    const next = later[0], same = next ? later.filter(x => x.day === next.day).length : 0;
    const body = due.length
      ? `<h2>${due.length} ${due.length === 1 ? 'thing is' : 'things are'} ready to come back</h2>${keepChips(due)}<p>${readings > 1 ? `Mixed across ${readings} readings. ` : ''}Hold one and it comes back further apart. Miss it and it is back tomorrow.</p>`
      : `<h2>Nothing due today</h2><p>${same > 1 ? same + ' things return' : 'The next one returns'} ${keepWhen(next.entry).replace('Comes back ', '')}.</p>`;
    return `<section class="review-card today-card" aria-label="Today"><div class="review-card-art" aria-hidden="true">${art ? ideaArt(ideaVisual(art.rec), {id: 'today-art', thumb: true, interactive: false}) : `<div class="ivm idea-art is-thumb">${isoThumb(isoPick('today', 'network'), '')}</div>`}</div><div class="review-card-text"><p class="eyebrow">Today${due.length ? ` · about ${minutes} min` : ''}</p>${body}${keepMeter(book, {compact: true})}${due.length ? `<div class="button-row"><button class="primary" data-action="today-open" data-book="${esc(book?.id || '')}">Start today’s review →</button></div>` : ''}</div></section>`;
  }
  // ---------- One question, three kinds ----------
  const keepSessions = new Map();
  function keepSession(scope, item) {
    const key = scope + ':' + item.book.id + ':' + item.key;
    if (!keepSessions.has(key)) keepSessions.set(key, {pick: null, order: [], sure: null, revealed: false, right: false});
    return keepSessions.get(key);
  }
  function keepHidden(item) { return (ideaHash(item.rec.unitId) + (item.entry?.returns || 0) + (item.scope === 'before' ? 2 : 1)) % 3; }
  function keepPictureChoices(item) {
    const v = ideaVisual(item.rec), hidden = keepHidden(item);
    return {v, hidden, choices: ideaDistractors(item.rec, v.labels[hidden], v.labels, r => ideaVisual(r).labels, item.book)};
  }
  const KEEP_RESULTS = [['increase', 'It went up', '↑'], ['decrease', 'It went down', '↓'], ['no-clear-difference', 'No clear difference', '=']];
  function keepChoices(item) {
    if (item.kind === 'picture') { const {v, hidden, choices} = keepPictureChoices(item); return {list: choices.map(c => ({label: c})), correct: choices.indexOf(v.labels[hidden])}; }
    if (item.kind === 'result') return {list: KEEP_RESULTS.map(([value, label, icon]) => ({label, icon, value})), correct: KEEP_RESULTS.findIndex(r => r[0] === item.v.headline.direction)};
    if (item.q.format === 'order') return {list: [], correct: -1};
    return {list: tapChoices(item.q), correct: item.q.correctIndex};
  }
  function keepAnswered(item, s) { return item.kind === 'question' && item.q.format === 'order' ? s.order.length === item.q.steps.length : Number.isInteger(s.pick); }
  function keepIsRight(item, s) { return item.kind === 'question' && item.q.format === 'order' ? s.order.every((step, i) => step === i) : s.pick === keepChoices(item).correct; }
  function keepPrompt(item) {
    if (item.kind === 'picture') return 'Which part belongs in the gap?';
    if (item.kind === 'result') { const m = item.v.headline.measure; return `In this study, what happened to ${m.charAt(0).toLowerCase() + m.slice(1)}?`; }
    return item.q.format === 'book' ? `“${item.q.prompt}”` : item.q.prompt;
  }
  function keepFeedback(item, s) {
    const right = keepIsRight(item, s);
    if (item.kind === 'picture') { const {v, hidden} = keepPictureChoices(item); return {right, text: (right ? '' : 'The missing part is ' + v.labels[hidden] + '. ') + v.parts[hidden]}; }
    if (item.kind === 'result') { const h = item.v.headline; return {right, text: `${h.measure}: ${h.magnitude || KEEP_RESULTS.find(r => r[0] === h.direction)[1]}${h.favors ? ' (favored ' + h.favors + ')' : ''}.`}; }
    if (item.q.format === 'order') return {right, text: [].concat(item.q.feedback)[0] || ''};
    return {right, text: tapChoices(item.q)[s.pick]?.feedback || ''};
  }
  function keepVerdict(item, s) {
    const right = keepIsRight(item, s);
    if (item.kind === 'picture') return right ? 'Right.' : 'Not this one.';
    if (item.kind === 'result') return right ? 'You called it.' : 'Not this time.';
    return right ? (s.sure === false ? 'Right, even though you were guessing.' : 'You know this one.') : (s.sure ? 'A real mix-up, not a slip.' : 'Not quite.');
  }
  function keepWhere(item) {
    const b = item.book, chapter = b.chapters.find(c => c.id === item.rec.chapterId)?.title || item.rec.guide.title;
    const code = b.sourceType === 'article' ? '' : lessonCode(item.rec, b).code;
    return `${esc(b.title)}${code ? ' · ' + esc(code) : ''}${b.sourceType === 'article' ? '' : ' · ' + esc(chapter)}`;
  }
  // The body of one recall: figure (pictures), choices, "How sure?" (questions), then the verdict.
  function keepQuestion(item, s, scope) {
    const answered = keepAnswered(item, s), revealed = s.revealed, order = item.kind === 'question' && item.q.format === 'order';
    const {list, correct} = keepChoices(item);
    const a = `data-action="ks-pick" data-scope="${scope}"`;
    let figure = '';
    if (item.kind === 'picture') { const {v, hidden} = keepPictureChoices(item); figure = `<h2 class="idea-takeaway">${esc(v.takeaway)}</h2><figure class="idea-figure is-small">${ideaArt(v, {id: 'ks-' + scope + '-art', hidden: revealed ? -1 : hidden, selected: revealed ? hidden : -1, interactive: false})}</figure>`; }
    let body;
    if (order) {
      const q = item.q;
      body = `<ol class="tap-order-picked" aria-label="Your order">${s.order.map((step, i) => `<li class="${revealed ? (step === i ? 'is-right' : 'is-wrong') : ''}">${esc(q.steps[step])}</li>`).join('')}</ol><div class="tap-choices" role="group" aria-label="Steps to place">${q.display.filter(step => !s.order.includes(step)).map(step => `<button type="button" class="tap-choice" ${a} data-index="${step}">${esc(q.steps[step])}</button>`).join('')}</div>${s.order.length && !revealed ? `<button type="button" class="tap-text-button" data-action="ks-undo" data-scope="${scope}">Undo last step</button>` : ''}`;
    } else if (item.kind === 'picture') {
      body = `<div class="idea-choices" role="group" aria-label="Choose the missing part">${list.map((c, i) => `<button type="button" class="idea-choice${revealed && i === correct ? ' is-right' : revealed && s.pick === i ? ' is-wrong' : ''}" ${a} data-index="${i}" ${revealed ? 'disabled' : ''}>${esc(c.label)}</button>`).join('')}</div>`;
    } else {
      body = `<div class="tap-choices" role="group" aria-label="Answers">${list.map((c, i) => `<button type="button" class="tap-choice ${s.pick === i ? 'is-selected' : ''} ${revealed && i === correct ? 'is-right' : ''} ${revealed && s.pick === i && i !== correct ? 'is-wrong' : ''}" ${a} data-index="${i}" aria-pressed="${s.pick === i}" ${revealed ? 'disabled' : ''}><span class="tap-letter" aria-hidden="true">${c.icon || String.fromCharCode(65 + i)}</span><span>${esc(c.label)}</span>${revealed && i === correct ? '<span class="tap-mark" aria-label="Correct answer">✓</span>' : ''}</button>`).join('')}</div>`;
    }
    const confidence = answered && !revealed && item.kind === 'question' ? `<div class="tap-confidence" role="group" aria-label="How sure are you?"><span>How sure are you?</span><button type="button" class="tap-pill" data-action="ks-sure" data-scope="${scope}" data-sure="true">Sure</button><button type="button" class="tap-pill" data-action="ks-sure" data-scope="${scope}" data-sure="false">Guessing</button></div>` : '';
    const fb = revealed ? keepFeedback(item, s) : null;
    const feedback = fb ? `<div tabindex="-1" class="tap-feedback ${fb.right ? 'is-right' : 'is-wrong'}" role="status"><strong>${keepVerdict(item, s)}</strong><p>${esc(fb.text)}</p><p class="keep-when">${esc(keepWhen(keepEntry(item.book.id, item.key)))}</p></div>` : '';
    return `<h3 class="keep-prompt">${esc(keepPrompt(item))}</h3>${figure}${body}${confidence}${feedback}`;
  }
  // Records the answer once it is final (after "How sure?" for questions).
  function keepReveal(item, s, scope) {
    if (s.revealed) return;
    s.revealed = true; s.right = keepIsRight(item, s);
    const bookId = item.book.id, sure = s.sure !== false;
    if (item.kind === 'question') {
      state.checks[bookId] ||= {};
      state.checks[bookId]['tap:' + item.rec.unitId + ':' + item.q.id] = s.right;
      state.checks[bookId]['tap-sure:' + item.rec.unitId + ':' + item.q.id] = sure;
    }
    if (scope === 'before' && item.kind === 'picture' && !item.entry) keepStart(bookId, item.key, s.right, true, 0);
    else keepAnswer(bookId, item.key, s.right, sure);
  }
  let todayQueue = [], todayIndex = 0, todayRight = 0, todayMore = 0;
  function todayDialog() {
    let d = document.getElementById('today-review');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'today-review'; d.className = 'picture-review today-review'; d.setAttribute('aria-label', 'Today’s review'); document.body.append(d);
      d.addEventListener('close', () => { if (['library', 'overview', 'guides'].includes(view)) render(); });
    }
    d.innerHTML = `<button class="glass-icon review-x" data-action="today-close" aria-label="Close review">×</button><div class="review-inner">${todayBody()}</div>`;
    return d;
  }
  function todayBody() {
    const n = todayQueue.length;
    if (todayIndex >= n) {
      return `<div class="review-done"><p class="eyebrow">Today</p><h2>${todayRight} of ${n} held</h2><p>${todayRight === n ? 'Everything comes back further apart now.' : (n - todayRight) + (n - todayRight === 1 ? ' is' : ' are') + ' back tomorrow.'}${todayMore ? ` ${todayMore} more ${todayMore === 1 ? 'is' : 'are'} waiting.` : ''}</p>${todayMore ? `<button class="primary" data-action="today-open" data-book="${esc(todayQueue[0]?.scopeBook || '')}">Keep going →</button> ` : ''}<button class="${todayMore ? 'secondary' : 'primary'}" data-action="today-close">Done</button></div>`;
    }
    const item = todayQueue[todayIndex], s = keepSession('today', item);
    return `<div class="review-head"><span class="review-count">${todayIndex + 1} of ${n}</span><span class="review-dots" aria-hidden="true">${todayQueue.map((_, i) => `<i class="${i < todayIndex ? 'is-on' : i === todayIndex ? 'is-now' : ''}"></i>`).join('')}</span></div><p class="eyebrow">${keepKindChip(item)} ${keepWhere(item)}</p>${keepQuestion(item, s, 'today')}${s.revealed ? `<div class="review-actions">${item.kind === 'result' ? '' : `<button class="text-button" data-action="today-lesson" data-book="${esc(item.book.id)}" data-unit="${esc(item.rec.unitId)}">Open the lesson</button>`}<button class="primary" data-action="today-next">${todayIndex + 1 < n ? 'Next →' : 'Finish'}</button></div>` : ''}`;
  }
  function keepKindChip(item) {
    const e = item.entry, label = !e.right ? 'Missed' : item.kind === 'picture' ? 'Picture' : item.kind === 'result' ? 'Article result' : 'Question';
    return `<span class="keep-chip is-${!e.right ? 'm' : item.kind[0]}"><i></i>${label}${e.returns ? ' · return ' + e.returns : ''}</span>`;
  }
  function todayOpen(bookId) {
    const book = books.find(b => b.id === bookId), {due} = keepDueItems(book);
    keepSessions.clear();
    todayQueue = due.slice(0, KEEP_BATCH).map(it => ({...it, scope: 'today', scopeBook: bookId || ''})); todayMore = Math.max(0, due.length - KEEP_BATCH); todayIndex = 0; todayRight = 0;
    if (!todayQueue.length) return;
    const d = todayDialog(); if (!d.open) d.showModal();
    d.querySelector('.idea-choice,.tap-choice')?.focus();
  }
  // ---------- Before you start: one recall from the last lesson ----------
  const beforeCache = new Map();
  function beforeItem(rec) {
    const cacheKey = activeBook.id + '::' + rec.unitId;
    if (beforeCache.has(cacheKey)) return beforeCache.get(cacheKey);
    const all = bookGuides(), idx = all.findIndex(r => r.unitId === rec.unitId);
    if (idx < 1 || activeBook.sourceType === 'article') return null;
    const prev = all[idx - 1], items = keepItems(activeBook, prev).filter(i => i.kind === 'picture' || (i.kind === 'question' && i.q.format !== 'order'));
    if (!items.length) return null;
    // Something slipping or due comes first; otherwise the picture; otherwise the first question.
    const pick = items.find(i => i.entry && ['missed', 'fading'].includes(keepStatus(i.entry))) || items.find(i => i.kind === 'picture') || items[0];
    const item = {...pick, scope: 'before', prevCode: lessonCode(prev).code, prevUnit: prev.unitId};
    beforeCache.set(cacheKey, item);
    return item;
  }
  function beforeYouStart(rec) {
    if (guideStep !== 0 || !ideaApplies(rec)) return '';
    const key = 'before:' + rec.unitId, saved = state.checks[activeBook.id]?.[key];
    const item = beforeItem(rec); if (!item) return '';
    const s = keepSession('before', item);
    if (typeof saved === 'boolean' && !s.revealed) return '';
    return `<section class="before-start${s.revealed ? ' is-done' : ''}" data-before="${esc(rec.unitId)}" aria-label="Before you start"><div class="idea-head"><p class="eyebrow">Before you start · from ${esc(item.prevCode)}</p><span class="idea-kind">${item.kind === 'picture' ? 'Last lesson’s picture' : 'From the last lesson'}</span></div>${keepQuestion(item, s, 'before')}${s.revealed ? `<p class="before-on">${s.right ? 'Good. On to the new idea.' : 'Noted. It comes back in Today’s review. On to the new idea.'}</p>` : `<p class="idea-note">One tap, then the lesson. If you miss it, it joins Today’s pile.</p>`}</section>`;
  }
  // ---------- Your copy: the page you keep when a book is finished ----------
  function keepCopy(book, s) {
    const recs = s.recs.filter(ideaApplies); if (!recs.length) return '';
    const rows = recs.map(rec => ({rec, status: keepLessonStatus(book, rec) || 'new', v: ideaVisual(rec), misses: keepItems(book, rec).reduce((n, i) => n + (i.entry?.misses || 0), 0)}));
    const held = rows.filter(r => r.status === 'held'), slipping = rows.filter(r => r.misses > 0).sort((a, b) => b.misses - a.misses).slice(0, 3);
    const rank = {held: 0, learning: 1, fading: 2, new: 3, missed: 4}, ordered = [...rows].sort((a, b) => rank[a.status] - rank[b.status]);
    return `<section class="keep-copy" aria-label="Your copy"><div class="keep-copy-head"><div><p class="eyebrow">Your copy</p><h2>${esc(book.title)}, as you hold it</h2><p>${held.length} of ${rows.length} ideas held.${slipping.length ? ' The ones that kept slipping stay in Today’s pile a while longer.' : ''}</p></div><button class="secondary" data-action="keep-share" data-book="${esc(book.id)}">${readIcon('share')} Share as a picture</button></div>${slipping.length ? `<p class="keep-copy-label">Kept slipping</p><div class="keep-slipping">${slipping.map(r => `<button class="keep-slip" data-action="explore" data-unit="${esc(r.rec.unitId)}"><span class="keep-slip-art" aria-hidden="true">${ideaArt(r.v, {id: labId(r.rec, 'copy'), thumb: true, interactive: false})}</span><strong>${esc(ideaSentence(r.v.takeaway, 90))}</strong><small>${esc(lessonCode(r.rec, book).code)} · missed ${r.misses}×</small></button>`).join('')}</div>` : ''}<p class="keep-copy-label">What you hold, in your order</p><ol class="keep-copy-list">${ordered.map(r => `<li class="is-${r.status}"><i aria-hidden="true"></i><span><strong>${esc(lessonCode(r.rec, book).code)}</strong> ${esc(r.v.takeaway)}</span></li>`).join('')}</ol></section>`;
  }
  // The copy as one image, through the device's share sheet (text if files can't be shared).
  async function keepShare(book) {
    const s = bookLessonState(book), recs = s.recs.filter(ideaApplies);
    const rows = recs.map(rec => ({code: lessonCode(rec, book).code, status: keepLessonStatus(book, rec) || 'new', takeaway: ideaVisual({...rec, bookId: book.id}).takeaway}));
    const held = rows.filter(r => r.status === 'held').length, lines = rows.map(r => `${r.code}  ${r.takeaway}`);
    const text = `${book.title} · ${book.author}\n${held} of ${rows.length} ideas held\n\n${lines.join('\n')}\n\nread.`;
    try {
      const W = 1080, pad = 84, c = document.createElement('canvas'); c.width = W; const ctx = c.getContext('2d');
      const wrap = (t, font, max) => { ctx.font = font; const out = []; let line = ''; for (const w of String(t).split(/\s+/)) { const next = line ? line + ' ' + w : w; if (ctx.measureText(next).width > max && line) { out.push(line); line = w; } else line = next; } if (line) out.push(line); return out; };
      const blocks = rows.map(r => ({r, lines: wrap(r.takeaway, '400 30px Georgia, serif', W - pad * 2 - 150)}));
      const titleLines = wrap(book.title, '400 60px Georgia, serif', W - pad * 2);
      let h = pad + titleLines.length * 68 + 120; for (const b of blocks) h += b.lines.length * 40 + 30; h += 120; c.height = Math.max(1350, Math.ceil(h));
      ctx.fillStyle = '#fbfbfa'; ctx.fillRect(0, 0, W, c.height);
      ctx.fillStyle = '#2039c4'; ctx.font = '600 22px "Avenir Next", "Helvetica Neue", sans-serif'; ctx.fillText('YOUR COPY', pad, pad + 10);
      ctx.fillStyle = '#252b28'; ctx.font = '400 60px Georgia, serif'; let y = pad + 80; for (const l of titleLines) { ctx.fillText(l, pad, y); y += 68; }
      ctx.fillStyle = '#626962'; ctx.font = '400 28px "Avenir Next", "Helvetica Neue", sans-serif'; ctx.fillText(`${book.author} · ${held} of ${rows.length} ideas held`, pad, y); y += 70;
      const dot = {held: '#2039c4', learning: '#8a93c9', fading: '#b48a2f', missed: '#8d3b3b', new: '#d8d8d2'};
      for (const {r, lines: ls} of blocks) {
        ctx.fillStyle = dot[r.status] || dot.new; ctx.beginPath(); ctx.arc(pad + 12, y - 10, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#626962'; ctx.font = '600 22px "Avenir Next", "Helvetica Neue", sans-serif'; ctx.fillText(r.code, pad + 40, y);
        ctx.fillStyle = '#252b28'; ctx.font = '400 30px Georgia, serif'; for (const l of ls) { ctx.fillText(l, pad + 150, y); y += 40; }
        y += 30;
      }
      ctx.fillStyle = '#252b28'; ctx.font = '400 40px Georgia, serif'; ctx.fillText('read.', pad, c.height - pad + 10);
      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
      const file = blob && new File([blob], 'your-copy.png', {type: 'image/png'});
      if (file && navigator.canShare?.({files: [file]})) { try { await navigator.share({files: [file], title: book.title, text: `${held} of ${rows.length} ideas held`}); return; } catch (error) { if (error?.name === 'AbortError') return; } }
    } catch (_) { /* fall through to text */ }
    shareReading({title: book.title, text});
  }
  // ---------- Actions ----------
  function keepRefresh(scope) {
    if (scope === 'today') { const d = todayDialog(); (d.querySelector('.tap-feedback') || d.querySelector('.tap-confidence button, .idea-choice:not([disabled]), .tap-choice:not([disabled])'))?.focus?.({preventScroll: true}); return; }
    const section = document.querySelector('[data-before]'); if (!section) return;
    const rec = bookGuides().find(r => r.unitId === section.dataset.before), y = window.scrollY;
    const holder = document.createElement('div'); holder.innerHTML = beforeYouStart(rec);
    const next = holder.firstElementChild; if (next) section.replaceWith(next); else section.remove();
    (next?.querySelector('.tap-feedback') || next?.querySelector('.tap-confidence button, .idea-choice:not([disabled]), .tap-choice:not([disabled])'))?.focus?.({preventScroll: true});
    window.scrollTo({top: y, behavior: 'instant'});
  }
  function keepCurrent(scope) {
    if (scope === 'today') return todayQueue[todayIndex] || null;
    const rec = bookGuides().find(r => r.unitId === document.querySelector('[data-before]')?.dataset.before);
    return rec ? beforeItem(rec) : null;
  }
  function handleKeepAction(action, el) {
    if (action === 'today-open') { todayOpen(el.dataset.book); return true; }
    if (action === 'today-close') { document.getElementById('today-review')?.close(); return true; }
    if (action === 'today-next') { todayIndex++; const d = todayDialog(); (d.querySelector('.idea-choice,.tap-choice') || d.querySelector('.review-done .primary'))?.focus(); return true; }
    if (action === 'today-lesson') { document.getElementById('today-review')?.close(); go('explore', {book: el.dataset.book, unit: el.dataset.unit, guideStep: 0}); return true; }
    if (action === 'keep-share') { const book = books.find(b => b.id === el.dataset.book) || activeBook; keepShare(book); return true; }
    if (!['ks-pick', 'ks-undo', 'ks-sure'].includes(action)) return false;
    const scope = el.dataset.scope, item = keepCurrent(scope); if (!item) return true;
    const s = keepSession(scope, item), index = Number(el.dataset.index), order = item.kind === 'question' && item.q.format === 'order';
    if (s.revealed) return true;
    if (action === 'ks-pick') {
      if (order) { if (Number.isInteger(index) && index >= 0 && index < item.q.steps.length && !s.order.includes(index)) s.order.push(index); }
      else if (Number.isInteger(index) && index >= 0 && index < keepChoices(item).list.length) s.pick = index;
      if (keepAnswered(item, s) && item.kind !== 'question') keepReveal(item, s, scope);
    }
    if (action === 'ks-undo' && order) s.order.pop();
    if (action === 'ks-sure' && keepAnswered(item, s)) { s.sure = el.dataset.sure === 'true'; keepReveal(item, s, scope); }
    if (s.revealed) {
      if (scope === 'today' && s.right) todayRight++;
      if (scope === 'before') { state.checks[activeBook.id] ||= {}; state.checks[activeBook.id]['before:' + document.querySelector('[data-before]')?.dataset.before] = s.right; save(); }
    }
    keepRefresh(scope);
    return true;
  }
  document.addEventListener('click', event => { const el = event.target.closest?.('[data-action^="today-"],[data-action^="ks-"],[data-action="keep-share"]'); if (el && handleKeepAction(el.dataset.action, el)) event.stopImmediatePropagation(); }, true);
