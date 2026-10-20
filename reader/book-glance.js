  // "Book at a glance": every lesson's picture and main idea on one page.
  // A lesson's picture joins the memory (reader/keep.js) when its big-idea check
  // is passed; it comes back in Today's review on day 1, 3, 7 and 21.
  let glanceMode = 'pictures';
  try { glanceMode = localStorage.getItem('read-glance-mode') === 'list' ? 'list' : 'pictures'; } catch (_) {}
  const reviewKey = rec => 'pic:' + rec.unitId;
  const isoDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  function reviewEntry(rec) { return keepEntry(rec.bookId || activeBook.id, reviewKey(rec)); }
  // Called when a lesson's big-idea check is answered right the first time.
  function startPictureReview(rec) { if (!reviewEntry(rec)) keepStart(rec.bookId || activeBook.id, reviewKey(rec), true, true, 0); }
  function handleGlanceAction(action, el) {
    if (action === 'glance-mode') { glanceMode = el.dataset.mode === 'list' ? 'list' : 'pictures'; try { localStorage.setItem('read-glance-mode', glanceMode); } catch (_) {} render(); document.querySelector(`[data-action="glance-mode"][data-mode="${glanceMode}"]`)?.focus({preventScroll: true}); return true; }
    return false;
  }
  document.addEventListener('click', event => { const el = event.target.closest?.('[data-action^="glance-"]'); if (el && handleGlanceAction(el.dataset.action, el)) event.stopImmediatePropagation(); }, true);
  // ---------- Book at a glance ----------
  function glanceSwitch() {
    return `<div class="glance-switch" role="group" aria-label="Show lessons as">${[['pictures', 'Pictures'], ['list', 'List']].map(([m, l]) => `<button type="button" data-action="glance-mode" data-mode="${m}" aria-pressed="${glanceMode === m}">${l}</button>`).join('')}</div>`;
  }
  function bookGlance() {
    const records = bookGuides().filter(ideaApplies);
    if (!records.length) return '';
    return `<section class="book-glance" aria-label="Book at a glance"><div class="glance-grid">${records.map((rec, i) => {
      const v = ideaVisual(rec), chapter = activeBook.chapters.find(c => c.id === rec.chapterId)?.title || rec.guide.title, reviewed = guideReviewed(rec), entry = reviewEntry(rec);
      return `<button class="glance-card" data-action="explore" data-unit="${esc(rec.unitId)}" aria-label="Lesson ${i + 1}: ${esc(chapter)}. ${esc(v.takeaway)}"><span class="glance-art" aria-hidden="true">${ideaArt(v, {id: labId(rec, 'glance'), thumb: true, interactive: false})}</span><span class="glance-meta"><span class="glance-n">${String(i + 1).padStart(2, '0')}</span><span class="glance-chapter">${esc(chapter)}</span>${reviewed ? '<span class="glance-badge">Reviewed</span>' : entry ? '<span class="glance-badge">In review</span>' : ''}</span><span class="glance-takeaway">${esc(v.takeaway)}</span><span class="glance-labels">${v.labels.map(l => `<i>${esc(l)}</i>`).join('<b aria-hidden="true">·</b>')}</span></button>`;
    }).join('')}</div></section>`;
  }
