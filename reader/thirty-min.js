  // The 30-min version: the whole book as one continuous read of about 30 minutes,
  // a section per chapter, with pictures that keep coming back to the main ideas.
  // It opens on the book-reader page (same paper, type and Aa settings) as a
  // pseudo chapter, so reading position and progress work the same way.
  // No questions, no checks, no typing.
  const THIRTY_MIN_ID = '30-min';
  const thirtyMinPrepared = JSON.parse(document.getElementById('thirty-min-data')?.textContent || '{}');
  // Versions written for uploads arrive from the cloud: {status, version}.
  const thirtyMinCloud = new Map();
  function thirtyMinFor(book = activeBook) {
    if (!book || book.sourceType === 'article') return null;
    return thirtyMinPrepared[book.id] || thirtyMinCloud.get(book.id)?.version || null;
  }
  const tmIsOpen = () => view === 'reader' && chapterId === THIRTY_MIN_ID;
  const tmLabel = s => String(s?.label || '').trim();
  function tmSectionLesson(s, book = activeBook) {
    return bookGuides(book).find(r => s.covers.includes(r.chapterId) && ideaApplies({...r, bookId: book.id}));
  }
  // ---------- Pictures ----------
  const tmSteps = (list, cls) => list.map((s, i) => `<li class="${cls}"><span class="tm-num" aria-hidden="true">${i + 1}</span><span class="tm-step-text"><strong>${esc(s.label)}</strong>${s.note ? `<span>${esc(s.note)}</span>` : ''}</span></li>`).join('');
  // Each figure opens with its machine (reader/iso-machines.js); the words follow below it.
  // Every figure gets its own machine: no two pictures in the library share one.
  function tmFigureArgs(f) {
    const n = list => Math.max(2, Math.min(5, (list || []).length));
    const count = {contrast: 2, chain: n(f.steps), cycle: n(f.steps), stack: n(f.layers), terms: n(f.items), scale: n(f.marks), stat: 3}[f.kind];
    return count ? [f.kind, count, f.kind === 'scale' ? {marks: [...f.marks].sort((a, b) => a.at - b.at).map(m => Math.round(m.at))} : {scene: f.scene}] : null;
  }
  function tmFigureKeys(book, v) {
    const out = [];
    (v.sections || []).forEach((s, i) => (s.blocks || []).forEach((b, k) => { const args = b.fig && tmFigureArgs(b.fig); if (args) out.push(['tm:' + book.id + ':tm-' + i + '-' + k, ...args]); }));
    return out;
  }
  function tmMachine(f, id) {
    const args = tmFigureArgs(f);
    return args ? `<div class="tm-machine" aria-hidden="true">${isoFigure(isoPick('tm:' + activeBook.id + ':' + id, ...args))}</div>` : '';
  }
  function tmFigure(f, id) {
    const title = f.title ? `<figcaption class="tm-fig-title">${esc(f.title)}</figcaption>` : '';
    let body = '';
    if (f.kind === 'contrast') body = `<div class="tm-contrast">${[f.left, f.right].map((side, i) => `<div class="tm-side${i ? ' is-right' : ''}"><p class="tm-side-label">${esc(side.label)}</p><ul>${side.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('<span class="tm-vs" aria-hidden="true">vs</span>')}</div>`;
    else if (f.kind === 'chain') body = `<ol class="tm-steps tm-chain">${tmSteps(f.steps, 'tm-step')}</ol>`;
    else if (f.kind === 'cycle') body = `<ol class="tm-steps tm-chain tm-cycle-steps">${tmSteps(f.steps, 'tm-step')}</ol>`;
    else if (f.kind === 'stack') body = `<ol class="tm-stack">${f.layers.map((l, i) => `<li style="--tm-w:${100 - i * Math.min(12, 40 / Math.max(1, f.layers.length - 1))}%"><strong>${esc(l.label)}</strong>${l.note ? `<span>${esc(l.note)}</span>` : ''}</li>`).join('')}</ol>`;
    else if (f.kind === 'scale') {
      const marks = [...f.marks].sort((a, b) => a.at - b.at);
      body = `<div class="tm-scale"><div class="tm-scale-bar" aria-hidden="true">${marks.map((m, i) => `<span class="tm-scale-pin${i % 2 ? ' is-low' : ''}" style="--tm-at:${Math.max(4, Math.min(96, m.at))}%"><i></i><b>${esc(m.label)}</b></span>`).join('')}</div><div class="tm-scale-ends"><span>${esc(f.from)}</span><span>${esc(f.to)}</span></div><ul class="sr-only">${marks.map(m => `<li>${esc(m.label)}: ${m.at} of 100, from ${esc(f.from)} to ${esc(f.to)}</li>`).join('')}</ul></div>`;
    }
    else if (f.kind === 'stat') body = `<div class="tm-stat"><strong>${esc(f.value)}</strong><span>${esc(f.label)}</span></div>`;
    else if (f.kind === 'terms') body = `<dl class="tm-terms">${f.items.map(t => `<div><dt>${esc(t.term)}</dt><dd>${esc(t.meaning)}</dd></div>`).join('')}</dl>`;
    else return '';
    return `<figure class="tm-fig tm-fig-${esc(f.kind)}">${title}${tmMachine(f, id)}${body}</figure>`;
  }
  // ---------- The page ----------
  function tmSection(s, i, v, all) {
    const rec = tmSectionLesson(s), visual = rec ? ideaVisual({...rec, bookId: activeBook.id}) : null;
    let first = true;
    const blocks = s.blocks.map((b, k) => {
      if (b.p !== undefined) { const cls = first ? ' class="br-first"' : (k && s.blocks[k - 1].p === undefined ? ' class="br-noindent"' : ''); first = false; return `<p${cls}>${esc(b.p)}</p>`; }
      if (b.pull !== undefined) return `<p class="tm-pull">${esc(b.pull)}</p>`;
      if (b.h !== undefined) return `<h3 class="br-heading tm-sub">${esc(b.h)}</h3>`;
      if (b.fig) return tmFigure(b.fig, `tm-${i}-${k}`);
      return '';
    }).join('');
    const next = all[i + 1];
    return `<section class="tm-section" id="tm-s-${i}" aria-labelledby="tm-h-${i}">
      <header class="tm-section-head"><p class="br-chapter-label">${esc(tmLabel(s) || 'Section ' + (i + 1))}</p><h2 id="tm-h-${i}">${esc(s.title)}</h2></header>
      <p class="tm-thread-line"><span class="tm-thread-mark" aria-hidden="true"></span><span><span class="tm-kicker">The thread</span> ${esc(v.thread)}</span></p>
      <div class="tm-idea">${visual ? `<div class="tm-idea-art" aria-hidden="true">${ideaArt(visual, {id: 'tm-art-' + i, interactive: false})}</div>` : ''}<p class="tm-kicker">The big idea</p><p class="tm-idea-text">${esc(s.idea)}</p></div>
      ${blocks}
      <aside class="tm-carry"><p class="tm-kicker">${next ? 'Carry it forward · ' + esc(tmLabel(next) || next.title) : 'Carry it forward · The whole book'}</p><p>${esc(s.carry)}</p></aside>
    </section>`;
  }
  // The last picture: every section's idea on one line, down a single spine.
  function tmSpine(v) {
    return `<figure class="tm-fig tm-spine"><figcaption class="tm-fig-title">The whole book, one page</figcaption><ol>${v.sections.map((s, i) => `<li><button type="button" data-action="tm-section" data-index="${i}"><span class="tm-spine-label">${esc(tmLabel(s) || s.title)}</span><span class="tm-spine-idea">${esc(s.idea)}</span></button></li>`).join('')}</ol></figure>`;
  }
  function thirtyMinMinutesLeft(v, ratio) { return Math.max(1, Math.round(thirtyMinMinutes(v) * (1 - ratio))); }
  function thirtyMinView() {
    const v = thirtyMinFor();
    if (!v) return `${topbar(activeBook.title)}<div class="empty"><h2>The 30-min version is not ready yet.</h2><button class="primary" data-action="guides">Back to the book</button></div>`;
    const ratio = readingPosition(state, activeBook.id, THIRTY_MIN_ID), percent = Math.round(ratio * 100), minutes = thirtyMinMinutes(v);
    return `<div class="book-reader tm-reader${bookReaderChromeHidden ? ' br-chrome-hidden' : ''}" data-book-reader>
      <header class="br-bar" data-br-bar>
        <button class="br-icon" data-action="guides" aria-label="Back to ${esc(activeBook.title)}" title="Back to the book">${brIcon('back')}</button>
        <button class="br-title" data-action="tm-contents" aria-haspopup="dialog" aria-label="Sections of the 30-min version"><span class="br-title-book">The 30-min version</span><span class="br-title-chapter" data-tm-current>${esc(activeBook.title)}</span></button>
        <div class="br-actions">
          ${raButton()}
          <button class="br-icon" data-action="tm-contents" aria-label="Sections" title="Sections">${brIcon('list')}</button>
          <button class="br-icon br-aa" data-action="reading-settings" aria-label="Text and page appearance" title="Text and page">Aa</button>
        </div>
      </header>
      <article class="reader-article br-page tm-page" lang="en">
        <header class="br-opener"><p class="br-part">The 30-min version</p><h1>${esc(activeBook.title)}</h1><p class="br-meta">${minutes} min read · ${v.sections.length} sections${activeBook.author ? ' · ' + esc(activeBook.author) : ''}</p></header>
        <div class="tm-thread"><p class="tm-kicker">The thread through the whole book</p><p class="tm-thread-text">${esc(v.thread)}</p><ol class="tm-thread-dots" aria-hidden="true">${v.sections.map(() => '<li></li>').join('')}</ol></div>
        ${v.opening.map((p, i) => `<p${i ? '' : ' class="br-noindent"'}>${esc(p)}</p>`).join('')}
        ${v.sections.map((s, i, all) => tmSection(s, i, v, all)).join('')}
        <section class="tm-section tm-closing" id="tm-s-end" aria-labelledby="tm-h-end"><header class="tm-section-head"><p class="br-chapter-label">Closing</p><h2 id="tm-h-end">The whole book</h2></header>${tmSpine(v)}${v.closing.map((p, i) => `<p${i ? '' : ' class="br-noindent"'}>${esc(p)}</p>`).join('')}<p class="tm-pull">${esc(v.thread)}</p></section>
      </article>
      <section class="br-end" aria-label="End of the 30-min version">
        <p class="br-end-mark" aria-hidden="true">❦</p>
        <p class="br-end-status" data-br-read-status>End of the 30-min version</p>
        <button class="br-card br-card-next" data-action="guides"><span class="br-card-kicker">${esc(activeBook.title)}</span><strong>Back to the book</strong><span>Lessons and pictures, chapter by chapter ${brIcon('next')}</span></button>
      </section>
      <footer class="br-progress" aria-label="Reading progress">
        <progress data-reading-position value="${percent}" max="100" aria-label="Position in the 30-min version"></progress>
        <div class="br-progress-text"><span data-br-left>${ratio > .985 ? 'Finished' : thirtyMinMinutesLeft(v, ratio) + ' min left'}</span><span data-reading-percent>${percent}%</span></div>
      </footer>
    </div>`;
  }
  // Called by the book reader's progress hook while this page is open.
  function thirtyMinProgress(ratio) {
    const v = thirtyMinFor(), left = document.querySelector('[data-br-left]');
    if (v && left) left.textContent = ratio > .985 ? 'Finished' : thirtyMinMinutesLeft(v, ratio) + ' min left';
    const label = document.querySelector('[data-tm-current]');
    if (!label || !v) return;
    let current = activeBook.title;
    for (const h of document.querySelectorAll('.tm-section-head h2')) { if (h.getBoundingClientRect().top > 140) break; current = h.textContent; }
    if (label.textContent !== current) label.textContent = current;
  }
  function openThirtyMinContents() {
    const v = thirtyMinFor(); if (!v) return;
    const d = bookReaderSheet('br-contents', 'The 30-min version');
    const at = v.sections.reduce((o, s, i) => { o.list.push(o.t); o.t += s.blocks.reduce((n, b) => n + tmWords(b.p || b.pull || ''), tmWords(s.idea) + tmWords(s.carry)) / TM_WPM; return o; }, {t: 0, list: []}).list;
    d.innerHTML = `${bookReaderSheetHead('br-contents', 'The 30-min version')}<p class="br-sheet-sub">${esc(activeBook.title)} · ${thirtyMinMinutes(v)} min</p><div class="br-toc"><ol><li><button class="br-toc-row" data-action="tm-section" data-index="top"><span class="br-toc-label"></span><span class="br-toc-title">The thread</span><span class="br-toc-state">0 min</span></button></li>${v.sections.map((s, i) => `<li><button class="br-toc-row" data-action="tm-section" data-index="${i}"><span class="br-toc-label">${esc(tmLabel(s))}</span><span class="br-toc-title">${esc(s.title)}</span><span class="br-toc-state">${Math.round(at[i])} min</span></button></li>`).join('')}<li><button class="br-toc-row" data-action="tm-section" data-index="end"><span class="br-toc-label">Closing</span><span class="br-toc-title">The whole book</span><span class="br-toc-state"></span></button></li></ol></div>`;
    d.showModal();
  }
  // ---------- On the book home ----------
  function thirtyMinCard(book = activeBook) {
    const v = thirtyMinFor(book);
    if (!v) return thirtyMinPendingCard(book);
    const ratio = readingPosition(state, book.id, THIRTY_MIN_ID), started = ratio > .01, done = ratio > .985;
    const figures = v.sections.reduce((n, s) => n + s.blocks.filter(b => b.fig).length, 0);
    return `<section class="tm-card" aria-label="The 30-min version"><div class="tm-card-text"><p class="eyebrow">The 30-min version</p><h2>The whole book, start to finish, in ${thirtyMinMinutes(v)} minutes.</h2><p>${v.sections.length} sections, one per chapter, and ${figures} pictures that keep coming back to the main ideas. Just reading. No questions.</p>${started ? `<div class="lf-meter"><div class="lf-meter-caption"><span>${done ? 'Read to the end' : Math.round(ratio * 100) + '% read'}</span><span>${done ? '' : thirtyMinMinutesLeft(v, ratio) + ' min left'}</span></div><progress value="${Math.round(ratio * 100)}" max="100" aria-label="30-min version read: ${Math.round(ratio * 100)}%"></progress></div>` : ''}<div class="button-row"><button class="primary" data-action="tm-open">${done ? 'Read it again' : started ? 'Continue reading' : 'Start reading'} <span aria-hidden="true">→</span></button></div></div><ol class="tm-card-spine" aria-hidden="true">${v.sections.slice(0, 7).map(s => `<li><span>${esc(tmLabel(s))}</span>${esc(ideaSentence(s.idea, 90))}</li>`).join('')}${v.sections.length > 7 ? `<li class="is-more">+ ${v.sections.length - 7} more</li>` : ''}</ol></section>`;
  }
  // Uploads get theirs written in the cloud; until then the card says where it stands.
  function thirtyMinPendingCard(book) {
    if (!book || book.sourceType === 'article' || !thirtyMinCloudAvailable()) return '';
    const s = thirtyMinCloud.get(book.id), status = s?.status || 'unknown';
    if (status === 'unknown') { refreshThirtyMin(book); return ''; }
    if (status === 'checking' || status === 'unavailable') return '';
    const line = status === 'none' ? 'A 30-min version of this book can be written for you: every chapter, with pictures throughout.'
      : status === 'failed' ? (s.error || 'The 30-min version could not be finished.')
      : `Being written now, chapter by chapter${s.total ? ` (${s.done || 0} of ${s.total} sections done)` : ''}. It usually takes under an hour and appears here when it is ready.`;
    const action = status === 'none' ? `<button class="primary" data-action="tm-write">Write the 30-min version</button>` : status === 'failed' ? `<button class="secondary" data-action="tm-write">Try once more</button>` : '';
    return `<section class="tm-card is-pending" aria-label="The 30-min version"><div class="tm-card-text"><p class="eyebrow">The 30-min version</p><h2>${status === 'none' || status === 'failed' ? 'The whole book in 30 minutes.' : 'Your 30-min version is on its way.'}</h2><p>${esc(line)}</p>${action ? `<div class="button-row">${action}</div>` : ''}</div></section>`;
  }
  function handleThirtyMinAction(action, el) {
    if (action === 'tm-open') { go('reader', {chapter: THIRTY_MIN_ID}); return true; }
    if (action === 'tm-contents') { openThirtyMinContents(); return true; }
    if (action === 'tm-write') { startThirtyMin(activeBook); return true; }
    if (action === 'tm-section') {
      closeBookReaderSheets(); progressReaderMoved = true;
      const i = el.dataset.index, target = i === 'top' ? document.querySelector('.tm-thread') : document.getElementById('tm-s-' + i);
      if (target) window.scrollTo({top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 76), behavior: 'instant'});
      return true;
    }
    return false;
  }
  // ---------- Uploads: written in the cloud ----------
  const thirtyMinAsked = new Set();
  let thirtyMinTimer = null;
  const thirtyMinCloudAvailable = () => !!localAI?.available;
  async function refreshThirtyMin(book = activeBook) {
    if (!book || book.sourceType === 'article' || thirtyMinPrepared[book.id] || !thirtyMinCloudAvailable()) return;
    const before = JSON.stringify(thirtyMinCloud.get(book.id) || null);
    if (!thirtyMinCloud.has(book.id)) thirtyMinCloud.set(book.id, {status: 'checking'});
    try {
      const result = await api('/api/thirty-min?bookId=' + encodeURIComponent(book.id));
      thirtyMinCloud.set(book.id, result);
      // Every book on the shelf gets one: the first visit to a book without it starts it.
      if (result.status === 'none' && bookGuides(book).length && !thirtyMinAsked.has(book.id)) { startThirtyMin(book, {quiet: true}); return; }
    } catch (_) { thirtyMinCloud.delete(book.id); return; }
    const now = thirtyMinCloud.get(book.id);
    clearTimeout(thirtyMinTimer);
    if (now?.status === 'running') thirtyMinTimer = setTimeout(() => { if (activeBook.id === book.id && view === 'guides') refreshThirtyMin(book); }, 60000);
    if (JSON.stringify(now) !== before && activeBook.id === book.id && view === 'guides') render();
  }
  async function startThirtyMin(book = activeBook, {quiet = false} = {}) {
    if (!book || book.sourceType === 'article' || thirtyMinPrepared[book.id] || thirtyMinAsked.has(book.id) && quiet) return;
    thirtyMinAsked.add(book.id);
    thirtyMinCloud.set(book.id, {status: 'running', done: 0, total: 0});
    if (activeBook.id === book.id && view === 'guides') render();
    try { thirtyMinCloud.set(book.id, await api('/api/thirty-min', 'POST', {bookId: book.id}, 90000)); }
    catch (error) { thirtyMinCloud.set(book.id, {status: 'failed', error: error.message}); if (!quiet) toast(error.message); }
    if (activeBook.id === book.id && view === 'guides') render();
    if (thirtyMinCloud.get(book.id)?.status === 'running') { clearTimeout(thirtyMinTimer); thirtyMinTimer = setTimeout(() => refreshThirtyMin(book), 60000); }
  }
