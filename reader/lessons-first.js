  // Lessons first. read. is for getting a book's ideas and moving on, not for reading
  // every page. A book opens on its lessons ("the whole book in N minutes"), the
  // library leads with the next lesson, and the last lesson hands over the next book.
  // Every lesson carries a short code, C5 · L1 (chapter 5, lesson 1), so a chapter
  // and a lesson are never confused.
  // One-paragraph briefs for bundled books, keyed by book id. The public edition
  // bundles none; uploads get theirs from their lessons.
  const BOOK_BRIEFS = {};
  const LESSON_INTRO = /^(foreword|preface|prologue|introduction|intro\b|a note)/i;
  const LESSON_END = /^(afterword|epilogue|conclusion|final thoughts|closing|coda)/i;
  const lessonCodeCache = new Map();
  // Chapters are numbered in reading order. Front and back matter with lessons read
  // "Intro" and "End"; a chapter split into several lessons counts L1, L2, ...
  function lessonCodes(book = activeBook) {
    const recs = bookGuides(book), stamp = recs.map(r => r.unitId).join('|');
    const hit = lessonCodeCache.get(book.id);
    if (hit?.stamp === stamp) return hit.codes;
    const chapterLabel = new Map(), counts = new Map(), seen = new Map(), codes = new Map();
    const order = [...new Set(recs.map(r => r.chapterId))], titleOf = id => String(book.chapters.find(c => c.id === id)?.title || '').trim();
    const lastIntro = order.reduce((at, id, i) => LESSON_INTRO.test(titleOf(id)) ? i : at, -1);
    let n = 0;
    order.forEach((id, i) => {
      const ch = book.chapters.find(c => c.id === id), title = titleOf(id);
      // Everything up to the introduction is front matter, so it all reads "Intro".
      if (!n && (i <= lastIntro || LESSON_INTRO.test(title) || ch?.studyRole === 'orientation')) chapterLabel.set(id, 'Intro');
      else if (LESSON_END.test(title) || (n && ch?.studyRole === 'orientation')) chapterLabel.set(id, 'End');
      else chapterLabel.set(id, 'C' + (++n));
    });
    // Lessons count within their label, so two front-matter sections read Intro · L1 and Intro · L2.
    for (const rec of recs) { const label = chapterLabel.get(rec.chapterId); counts.set(label, (counts.get(label) || 0) + 1); }
    for (const rec of recs) {
      const chapter = chapterLabel.get(rec.chapterId), lesson = (seen.get(chapter) || 0) + 1;
      seen.set(chapter, lesson);
      const long = chapter === 'Intro' ? 'Introduction' : chapter === 'End' ? 'Closing' : 'Chapter ' + chapter.slice(1);
      codes.set(rec.unitId, {chapter, lesson, of: counts.get(chapter), code: chapter + ' · L' + lesson, long, spoken: long + ', lesson ' + lesson});
    }
    lessonCodeCache.set(book.id, {stamp, codes});
    return codes;
  }
  function lessonCode(rec, book = activeBook) {
    return lessonCodes(book).get(rec?.unitId) || {chapter: '', lesson: 1, of: 1, code: '', long: '', spoken: ''};
  }
  function lessonChip(rec, book = activeBook) {
    const c = lessonCode(rec, book);
    return c.code ? `<span class="lesson-code" aria-label="${esc(c.spoken)}">${esc(c.code)}</span>` : '';
  }
  // A lesson counts as done when it was marked reviewed, its last step was reached,
  // or its picture check was passed.
  function lessonDone(rec, book = activeBook) {
    const p = lessonProgressModel(state, book.id, rec.unitId);
    return p.reviewed || p.visited[5] || !!reviewEntry({...rec, bookId: book.id});
  }
  function lessonsFirstBook(book) {
    return book && book.sourceType !== 'article' && bookGuides(book).some(ideaApplies);
  }
  function bookLessonState(book = activeBook) {
    const recs = bookGuides(book), done = recs.filter(r => lessonDone(r, book));
    const savedId = state.last[book.id]?.unit, savedAt = recs.findIndex(r => r.unitId === savedId);
    let next = savedAt >= 0 && !lessonDone(recs[savedAt], book) ? recs[savedAt] : null;
    if (!next) next = recs.slice(Math.max(0, savedAt)).find(r => !lessonDone(r, book)) || recs.find(r => !lessonDone(r, book)) || null;
    return {recs, done: done.length, next, finished: recs.length > 0 && done.length === recs.length, started: savedAt >= 0 || done.length > 0};
  }
  const lessonStepFor = (book, rec) => state.last[book.id]?.[progressKey('lesson-step', rec.unitId)] ?? 0;
  // What's holding: held, fading and missed ideas, with the lessons left on the side.
  function lessonMeter(book, s) {
    const note = s.recs.length - s.done ? (s.recs.length - s.done) + (s.recs.length - s.done === 1 ? ' lesson to go' : ' lessons to go') : 'Finished';
    const held = typeof keepMeter === 'function' && keepMeter(book, {note});
    if (held) return `<div class="lf-meter">${held}</div>`;
    return `<div class="lf-meter"><div class="lf-meter-caption"><span>${s.done} of ${s.recs.length} lessons done</span><span>${note}</span></div><progress value="${s.done}" max="${Math.max(1, s.recs.length)}" aria-label="Lessons done: ${s.done} of ${s.recs.length}"></progress></div>`;
  }
  // ---------- Library: one tap back to the next lesson ----------
  function shelfLessonBooks() {
    return books.filter(b => !state.hiddenBooks?.[b.id] && !isReplaced(b) && lessonsFirstBook(b));
  }
  function continueCard() {
    const list = shelfLessonBooks();
    if (!list.length) return '';
    const touched = list.filter(b => !bookLessonState(b).finished).sort((a, b) => String(state.last[b.id]?.at || '').localeCompare(String(state.last[a.id]?.at || '')));
    const book = touched[0];
    if (!book) return '';
    const s = bookLessonState(book), rec = s.next;
    if (!rec) return '';
    const v = ideaVisual({...rec, bookId: book.id}), c = lessonCode(rec, book), chapter = book.chapters.find(ch => ch.id === rec.chapterId)?.title || rec.guide.title;
    return `<section class="lf-continue" aria-label="${s.started ? 'Continue' : 'Start'} ${esc(book.title)}"><div class="lf-continue-art" aria-hidden="true">${ideaArt(v, {id: 'continue-art', thumb: true, interactive: false})}</div><div class="lf-continue-text"><p class="eyebrow">${esc(book.title)} · <span aria-label="${esc(c.spoken)}">${esc(c.code)}</span></p><h2>${esc(chapter)}</h2><p class="lf-takeaway">${esc(v.takeaway)}</p>${lessonMeter(book, s)}<div class="button-row"><button class="primary" data-action="lf-continue" data-book="${esc(book.id)}" data-unit="${esc(rec.unitId)}">${s.started ? 'Continue lesson' : 'Start the first lesson'} <span aria-hidden="true">→</span></button><button class="secondary" data-action="open-book" data-book="${esc(book.id)}">See the whole book</button></div></div></section>`;
  }
  // ---------- A book opens here: the whole book in N minutes ----------
  const lfWords = text => (String(text || '').match(/\S+/g) || []).length;
  function bookMinutes(book, recs) {
    let words = lfWords(BOOK_BRIEFS[book.id]);
    for (const rec of recs) words += lfWords(ideaVisual(rec).takeaway) + ideaReadingText(rec).passage.reduce((n, p) => n + lfWords(p), 0);
    return Math.max(5, Math.ceil(words / 220 / 5) * 5);
  }
  function finishedCard(book, s) {
    const brief = BOOK_BRIEFS[book.id], sentence = brief ? ideaSentence(brief, 400) : '';
    const others = shelfLessonBooks().filter(b => b.id !== book.id && !bookLessonState(b).finished);
    const pick = others.sort((a, b) => Number(bookLessonState(b).started) - Number(bookLessonState(a).started))[0];
    const ps = pick && bookLessonState(pick);
    return `<section class="lf-finished" aria-label="Book finished"><div class="lf-finished-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><p class="eyebrow">Book finished</p><h2>${s.recs.length} lessons, all done.</h2>${sentence ? `<p class="lf-sentence">${esc(sentence)}</p>` : ''}${pick ? `<div class="lf-next"><div class="lf-next-cover" aria-hidden="true">${coverObject(pick)}</div><div class="lf-next-text"><p class="eyebrow">Up next, from your shelf</p><h3>${esc(pick.title)}</h3><p>${esc(pick.author)} · ${ps.recs.length} lessons${ps.done ? ' · ' + ps.done + ' done' : ''}</p><div class="button-row"><button class="primary" data-action="open-book" data-book="${esc(pick.id)}">${ps.started ? 'Continue it' : 'Start it'}</button><button class="secondary" data-action="library">Choose another</button></div></div></div>` : `<p class="lf-sentence">Every book on your shelf is done. Add a new one to keep going.</p><div class="button-row"><button class="primary" data-action="import">Add reading</button></div>`}</section>`;
  }
  function bookPathRow(rec, s) {
    const v = ideaVisual(rec), c = lessonCode(rec), done = lessonDone(rec), next = s.next?.unitId === rec.unitId;
    const chapter = activeBook.chapters.find(ch => ch.id === rec.chapterId)?.title || rec.guide.title;
    const {passage} = ideaReadingText(rec), minutes = Math.max(1, Math.round(passage.reduce((n, p) => n + lfWords(p), 0) / 220));
    const multi = s.recs.filter(r => r.chapterId === rec.chapterId).length > 1, title = multi ? rec.guide.title : chapter;
    return `<article class="lf-row${next ? ' is-next' : ''}${done ? ' is-done' : ''}"><button class="lf-row-art" data-action="explore" data-unit="${esc(rec.unitId)}" aria-label="Open lesson ${esc(c.spoken)}: ${esc(title)}">${ideaArt(v, {id: labId(rec, 'path'), thumb: true, interactive: false})}</button><div class="lf-row-text"><div class="lf-row-head">${lessonChip(rec)}${done ? '<span class="lf-badge is-done">Done</span>' : next ? '<span class="lf-badge is-next">Next</span>' : ''}</div><h3>${esc(title)}</h3>${multi ? `<p class="lf-row-chapter">${esc(c.long)} · ${esc(chapter)}</p>` : ''}<p class="lf-takeaway">${esc(v.takeaway)}</p>${passage.length ? `<details class="lf-brief"><summary>The chapter in brief · ${minutes} min</summary>${passage.map(p => `<p>${esc(p)}</p>`).join('')}</details>` : ''}<button class="text-button lf-open" data-action="explore" data-unit="${esc(rec.unitId)}">Open lesson ${esc(c.code)} <span aria-hidden="true">→</span></button></div></article>`;
  }
  // "Every chapter's big idea" folds away; the choice is kept on this device.
  let lfPathOpen = false;
  try { lfPathOpen = localStorage.getItem('read-path-open') === '1'; } catch (_) {}
  function bookPathSection(recs, s) {
    const head = `<div class="glance-head lf-path-head"><button type="button" class="lf-path-toggle" data-action="lf-path-toggle" aria-expanded="${lfPathOpen}" aria-controls="lf-path-body"><h2>Every chapter’s big idea</h2><span class="lf-path-count">${recs.length} lessons</span><span class="lf-path-chevron" aria-hidden="true"></span></button>${lfPathOpen ? glanceSwitch() : ''}</div>`;
    if (!lfPathOpen) return head;
    return `${head}<div id="lf-path-body">${glanceMode === 'pictures' ? `<p class="lf-path-note">Read down the page for the whole book, or open any lesson.</p><div class="lf-path">${recs.map(r => bookPathRow(r, s)).join('')}</div>` : chapterList()}</div>`;
  }
  function bookHome() {
    const s = bookLessonState(), recs = s.recs.filter(ideaApplies), brief = BOOK_BRIEFS[activeBook.id];
    const chapters = new Set(recs.map(r => r.chapterId)).size, next = s.next, nc = next ? lessonCode(next) : null;
    const hero = `<section class="lf-hero"><div class="lf-hero-cover" aria-hidden="true">${coverObject(activeBook)}</div><div class="lf-hero-text"><p class="eyebrow">The whole book in ${bookMinutes(activeBook, recs)} minutes</p><h1>${esc(activeBook.title)}</h1><p class="book-author">${esc(activeBook.author)} · ${recs.length} big ideas${chapters !== recs.length ? ' in ' + chapters + ' chapters' : ''}</p>${lessonMeter(activeBook, s)}<div class="lf-hero-actions">${next ? `<button class="primary" data-action="lf-continue" data-book="${esc(activeBook.id)}" data-unit="${esc(next.unitId)}">${s.started ? 'Continue' : 'Start'} <span aria-label="${esc(nc.spoken)}">${esc(nc.code)}</span> <span aria-hidden="true">→</span></button>` : ''}<button class="text-button lf-original" data-action="reader">${readIcon('book')} Read the original</button></div></div></section>`;
    return `${topbar(activeBook.title)}${s.finished ? finishedCard(activeBook, s) + keepCopy(activeBook, s) : ''}${hero}${thirtyMinCard(activeBook)}${brief ? `<section class="lf-brief-card" aria-label="The book in brief"><p class="eyebrow">The book in brief</p><p>${esc(brief)}</p></section>` : ''}${todayCard(activeBook)}${bookPathSection(recs, s)}${s.finished ? '' : nextBooksPanel(activeBook)}${footer()}`;
  }
  function handleLessonsFirstAction(action, el) {
    if (action === 'lf-path-toggle') {
      lfPathOpen = !lfPathOpen;
      try { localStorage.setItem('read-path-open', lfPathOpen ? '1' : '0'); } catch (_) {}
      render();
      document.querySelector('[data-action="lf-path-toggle"]')?.focus({preventScroll: true});
      return true;
    }
    if (action !== 'lf-continue') return false;
    const book = books.find(b => b.id === el.dataset.book) || activeBook, rec = bookGuides(book).find(r => r.unitId === el.dataset.unit);
    go('explore', {book: book.id, unit: el.dataset.unit, guideStep: rec ? lessonStepFor(book, rec) : 0});
    return true;
  }
