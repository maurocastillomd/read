  // Tap-only comprehension checks. Each question has a right answer, so understanding is checked without typing.
  const tapCheckData = JSON.parse(document.getElementById('tap-checks-data')?.textContent || '{}');
  const tapSessions = new Map();
  const tapBookLabels = ['Said in the book','The book says the opposite','Not in the book'];
  // Every guide gets tap questions, from the best source available: checks written
  // with the guide, the hand-written bank, or questions built from the guide's own
  // recall answers (older guides). Nothing in the guided route asks for typing.
  const tapAutoCache = new Map();
  function tapQuestions(rec, where) {
    if (!rec?.guide) return [];
    const list = Array.isArray(rec.guide.checks) && rec.guide.checks.length ? rec.guide.checks : tapCheckData[rec.bookId || activeBook?.id]?.[rec.unitId] || tapAutoQuestions(rec);
    return where ? list.filter(q => (q.where || []).includes(where)) : list;
  }
  function tapFirstSentences(text, limit = 230) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= limit) return clean;
    const cut = clean.slice(0, limit), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    return end > 60 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
  }
  function tapHash(text) { let h = 7; for (const c of String(text)) h = (Math.imul(h, 31) + c.codePointAt(0)) | 0; return Math.abs(h); }
  function tapAutoQuestions(rec) {
    const key = (rec.bookId || '') + '\n' + rec.unitId + '\n' + (rec.sourceHash || '');
    if (tapAutoCache.has(key)) return tapAutoCache.get(key);
    const own = (rec.guide.recall || []).map(r => ({question: r.question, answer: tapFirstSentences(r.answer)}));
    const others = (typeof bookGuides === 'function' ? bookGuides() : []).filter(r => r.unitId !== rec.unitId && r.guide).flatMap(r => (r.guide.recall || []).map(x => ({question: x.question, answer: tapFirstSentences(x.answer), title: r.guide.title})));
    const source = rec.guide.concepts?.find(c => c.sourceRefs?.length)?.sourceRefs[0];
    const list = [];
    own.forEach((r, i) => {
      const pool = [...own.filter((_, j) => j !== i).map(x => ({...x, near: true})), ...others].filter(x => x.answer && x.answer !== r.answer);
      const picked = [];
      for (let n = 0; n < pool.length && picked.length < 2; n++) { const x = pool[(tapHash(r.question) + n * 7) % pool.length]; if (!picked.includes(x)) picked.push(x); }
      if (picked.length < 2) return;
      const at = tapHash(r.answer) % 3, choices = [...picked];
      choices.splice(at, 0, {answer: r.answer, right: true});
      list.push({id: 'auto-' + (i + 1), format: 'pick', where: ['remember'], label: 'Pick the best answer', prompt: r.question,
        choices: choices.map(c => ({label: c.answer, feedback: c.right ? 'Right. ' + r.answer : c.near ? 'That answers a different question from this section: “' + c.question + '”' : 'That comes from another part of the book' + (c.title ? ', “' + c.title + '”' : '') + '.'})),
        correctIndex: at, ...(source ? {source} : {})});
    });
    tapAutoCache.set(key, list);
    return list;
  }
  function tapKey(rec, q) { return 'tap:' + rec.unitId + ':' + q.id; }
  function tapSession(rec, q) {
    const key = tapKey(rec, q);
    if (!tapSessions.has(key)) tapSessions.set(key, {pick: null, order: [], sure: null});
    return tapSessions.get(key);
  }
  function tapChoices(q) { return q.format === 'book' ? tapBookLabels.map((label, i) => ({label, feedback: [].concat(q.feedback)[i]})) : q.choices; }
  function tapAnswered(q, s) { return q.format === 'order' ? s.order.length === q.steps.length : Number.isInteger(s.pick); }
  function tapCorrect(q, s) { return q.format === 'order' ? s.order.every((step, i) => step === i) : s.pick === q.correctIndex; }
  function tapKicker(q) { return q.label || {pick: 'Pick the best answer', book: 'Book, or not?', order: 'Put it in order', mistake: 'Spot the mistake'}[q.format] || 'Check yourself'; }
  function tapQuestion(rec, q) {
    const s = tapSession(rec, q), answered = tapAnswered(q, s), revealed = answered && s.sure !== null, right = revealed && tapCorrect(q, s);
    const ready = state.checks[rec.bookId || activeBook.id] || {};
    let body;
    if (q.format === 'order') {
      body = `<ol class="tap-order-picked" aria-label="Your order">${s.order.map((step, i) => `<li class="${revealed ? (step === i ? 'is-right' : 'is-wrong') : ''}">${esc(q.steps[step])}</li>`).join('')}</ol><div class="tap-choices" role="group" aria-label="Steps to place">${q.display.filter(step => !s.order.includes(step)).map(step => `<button type="button" class="tap-choice" data-action="tap-order" data-tap="${esc(q.id)}" data-index="${step}">${esc(q.steps[step])}</button>`).join('')}</div>${s.order.length && !revealed ? `<button type="button" class="tap-text-button" data-action="tap-undo" data-tap="${esc(q.id)}">Undo last step</button>` : ''}`;
    } else {
      body = `<div class="tap-choices" role="group" aria-label="Answers">${tapChoices(q).map((choice, i) => `<button type="button" class="tap-choice ${s.pick === i ? 'is-selected' : ''} ${revealed && i === q.correctIndex ? 'is-right' : ''} ${revealed && s.pick === i && i !== q.correctIndex ? 'is-wrong' : ''}" data-action="tap-pick" data-tap="${esc(q.id)}" data-index="${i}" aria-pressed="${s.pick === i}" ${revealed ? 'disabled' : ''}><span class="tap-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${esc(choice.label)}</span>${revealed && i === q.correctIndex ? '<span class="tap-mark" aria-label="Correct answer">✓</span>' : ''}</button>`).join('')}</div>`;
    }
    const confidence = answered && !revealed ? `<div class="tap-confidence" role="group" aria-label="How sure are you?"><span>How sure are you?</span><button type="button" class="tap-pill" data-action="tap-sure" data-tap="${esc(q.id)}" data-sure="true">Sure</button><button type="button" class="tap-pill" data-action="tap-sure" data-tap="${esc(q.id)}" data-sure="false">Guessing</button></div>` : '';
    const note = revealed ? (q.format === 'order' ? [].concat(q.feedback)[0] : tapChoices(q)[s.pick].feedback) : '';
    const verdict = !revealed ? '' : right ? (s.sure ? 'You know this one.' : 'Right, even though you were guessing. It will come back soon.') : (s.sure ? 'Worth a second look. You were sure, so this is a real mix-up, not a slip.' : 'Not quite. Here is the distinction.');
    const feedback = revealed ? `<div tabindex="-1" class="tap-feedback ${right ? 'is-right' : 'is-wrong'}" role="status"><strong>${verdict}</strong><p>${esc(note)}</p><div class="tap-feedback-actions">${q.source ? sourceButton(rec.chapterId, 'See it in the book', q.source.quote, q.source.paragraphId) : ''}<button type="button" class="tap-text-button" data-action="tap-retry" data-tap="${esc(q.id)}">Try again</button></div></div>` : '';
    const last = ready[tapKey(rec, q)];
    return `<article class="tap-question" data-tap-question="${esc(q.id)}"><div class="tap-meta"><span>${esc(tapKicker(q))}</span>${!revealed && typeof last === 'boolean' ? `<span>${last ? 'Last time: right' : 'Last time: missed'}</span>` : ''}</div><h3>${q.format === 'book' ? `“${esc(q.prompt)}”` : esc(q.prompt)}</h3>${body}${confidence}${feedback}</article>`;
  }
  function tapSet(rec, where, intro = '') {
    const list = tapQuestions(rec, where);
    if (!list.length) return '';
    return `<section class="tap-set" aria-label="Check your understanding">${intro ? `<p class="tap-intro">${esc(intro)}</p>` : ''}${list.map(q => tapQuestion(rec, q)).join('')}</section>`;
  }
  function tapScore(rec) {
    const list = tapQuestions(rec), ready = state.checks[rec.bookId || activeBook.id] || {};
    return {right: list.filter(q => ready[tapKey(rec, q)] === true).length, answered: list.filter(q => typeof ready[tapKey(rec, q)] === 'boolean').length, total: list.length};
  }
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-action]'), action = el?.dataset.action;
    if (!action?.startsWith('tap-')) return;
    const rec = bookGuides().find(r => r.unitId === selectedUnit), q = rec && tapQuestions(rec).find(item => item.id === el.dataset.tap);
    if (!q) return;
    const s = tapSession(rec, q), index = Number(el.dataset.index);
    if (action === 'tap-pick' && s.sure === null && Number.isInteger(index) && index >= 0 && index < tapChoices(q).length) s.pick = index;
    if (action === 'tap-order' && s.sure === null && Number.isInteger(index) && index >= 0 && index < q.steps.length && !s.order.includes(index)) s.order.push(index);
    if (action === 'tap-undo' && s.sure === null) s.order.pop();
    if (action === 'tap-sure' && tapAnswered(q, s) && s.sure === null) {
      s.sure = el.dataset.sure === 'true';
      const bookId = rec.bookId || activeBook.id;
      state.checks[bookId] ||= {};
      state.checks[bookId][tapKey(rec, q)] = tapCorrect(q, s);
      state.checks[bookId]['tap-sure:' + rec.unitId + ':' + q.id] = s.sure;
      save();
      if (typeof keepRecordTap === 'function') keepRecordTap(rec, q, tapCorrect(q, s), s.sure);
    }
    if (action === 'tap-retry') { s.pick = null; s.order = []; s.sure = null; }
    document.querySelectorAll('[data-tap-question="' + q.id + '"]').forEach(node => { node.outerHTML = tapQuestion(rec, q); });
    const fresh = document.querySelector('[data-tap-question="' + q.id + '"]');
    (fresh?.querySelector(action === 'tap-sure' ? '.tap-feedback' : '.tap-confidence button, .tap-choice:not([disabled]), h3'))?.focus?.({preventScroll: true});
  });
