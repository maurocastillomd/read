  // Listen: the device's own voice reads the page aloud. Free, nothing stored, no setup.
  // Book chapters and articles read what is on the page, from the paragraph you are on,
  // and the book keeps going into the next chapter. The 30-min version reads top to bottom.
  // A lesson reads its spoken script (big idea, the chapter in brief, the reasoning,
  // the chapter in review) and moves on to the next lesson.
  // The voice stops when the screen locks: browsers pause speech for a hidden page,
  // so the screen is kept awake while listening.
  const RA_STORE = 'read-listen-v1';
  const RA_RATES = [0.85, 1, 1.15, 1.3, 1.5];
  const RA_WPM = 165;
  // Novelty and robot voices that ship with Apple devices; never offered.
  const RA_SKIP = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|deranged|hysterical|pipe organ)\b/i;
  const RA_GOOD = /\b(samantha|ava|zoe|allison|susan|evan|nathan|tom|noelle|joelle|daniel|serena|karen|moira|tessa|kate|oliver|google us english|google uk english)\b/i;
  const raIcons = {
    listen: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.6"/>',
    play: '<path d="M8 5.3v13.4L19 12z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
    back: '<path d="M6 6v12"/><path d="M18 6.5 9.5 12l8.5 5.5z"/>',
    next: '<path d="M18 6v12"/><path d="M6 6.5 14.5 12 6 17.5z"/>',
    voice: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const raIcon = (name, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${raIcons[name]}</svg>`;

  // ---------- Pure helpers (tested) ----------
  function raClean(text) {
    return String(text || '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, '').replace(/\s*·\s*/g, ', ').replace(/\s+/g, ' ').trim();
  }
  // Short pieces keep every browser speaking: some cut a long utterance off after 15 seconds.
  function raChunks(text, max = 220) {
    const clean = raClean(text);
    if (!clean) return [];
    const sentences = clean.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)\s*/g) || [clean];
    const out = [];
    let block = '';
    const push = piece => {
      piece = piece.trim();
      while (piece.length > max) {
        let cut = piece.lastIndexOf(', ', max);
        if (cut < max / 3) cut = piece.lastIndexOf(' ', max);
        if (cut < max / 3) cut = max;
        out.push(piece.slice(0, cut + 1).trim());
        piece = piece.slice(cut + 1).trim();
      }
      if (piece) out.push(piece);
    };
    for (const s of sentences) {
      if (block && (block + s).length > max) { push(block); block = ''; }
      block += s;
    }
    push(block);
    return out.filter(Boolean);
  }
  function raVoiceScore(v) {
    const name = String(v?.name || ''), lang = String(v?.lang || '').replace('_', '-');
    if (!/^en(-|$)/i.test(lang) || RA_SKIP.test(name)) return -1;
    let s = 0;
    if (/premium/i.test(name)) s += 6;
    else if (/enhanced|natural|neural/i.test(name)) s += 4;
    if (RA_GOOD.test(name)) s += 2;
    if (/^en-US$/i.test(lang)) s += 1.5;
    else if (/^en-(GB|AU|IE|CA)$/i.test(lang)) s += 1;
    if (v.localService) s += 0.5;
    return s;
  }
  function raRankVoices(list) {
    return (list || []).map(v => ({v, s: raVoiceScore(v)})).filter(x => x.s >= 0).sort((a, b) => b.s - a.s || String(a.v.name).localeCompare(String(b.v.name))).map(x => x.v);
  }
  function raMinutesLeft(items, index, rate = 1) {
    const words = items.slice(index).reduce((n, it) => n + raClean(it.text).split(/\s+/).filter(Boolean).length, 0);
    return Math.max(1, Math.round(words / (RA_WPM * rate)));
  }

  // ---------- What to read ----------
  const raSynth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;
  const raSupported = () => !!raSynth() && typeof SpeechSynthesisUtterance !== 'undefined';
  function raPageKey() {
    if (view === 'reader') return 'reader/' + activeBook.id + '/' + chapterId;
    if (view === 'explore') return 'lesson/' + activeBook.id + '/' + selectedUnit;
    return '';
  }
  function raReaderItems() {
    const page = document.querySelector('.br-page');
    if (!page) return [];
    const picked = [...page.querySelectorAll('h1,h2,h3,p,dt,dd,figcaption,blockquote')].filter(el =>
      !el.closest('details:not([open]),button,.br-table,.tm-spine,.sr-only,[aria-hidden="true"]') &&
      !el.matches('.br-meta,.tm-kicker') && !el.parentElement.closest('p,dd,figcaption,blockquote'));
    return picked.map(el => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('.br-note-ref,sup,.sr-only,[aria-hidden="true"]').forEach(n => n.remove());
      // The kicker of the big idea reads as a lead-in, not its own line.
      const kicker = el.previousElementSibling?.matches?.('.tm-kicker') ? el.previousElementSibling.textContent.trim() + '. ' : '';
      return {text: kicker + copy.textContent, el};
    }).filter(it => raClean(it.text));
  }
  function raLessonItems() {
    const rec = bookGuides().find(g => g.unitId === selectedUnit);
    if (!rec) return [];
    const g = roleContextGuide(rec), ch = activeBook.chapters.find(c => c.id === rec.chapterId), code = lessonCode(rec);
    const items = [], add = text => { if (raClean(text)) items.push({text}); };
    const prose = text => String(text || '').split(/\n\s*\n/).forEach(add);
    add([code.spoken || code.long, ch?.title, g.title !== ch?.title ? g.title : ''].filter(Boolean).join('. ') + '.');
    const visual = ideaApplies(rec);
    if (visual) {
      const v = ideaVisual(rec);
      add('The big idea. ' + v.takeaway);
      v.labels.forEach((label, i) => add(label + '. ' + (v.parts[i] || '')));
    }
    const reading = visual ? ideaReadingText(rec) : {passage: String(g.gist || '').split(/\n\s*\n/), connect: '', forward: ''};
    if (reading.passage.length) { add('The chapter in brief.'); reading.passage.forEach(add); }
    if (reading.connect) add('How the ideas connect. ' + reading.connect);
    if ((g.principles || []).length) {
      add('The reasoning, one step at a time.');
      g.principles.forEach(p => { add(p.title + '.'); prose(p.explanation); });
    }
    if (reading.forward) add('The chapter in review. ' + reading.forward);
    return items;
  }
  function raCollect() { return view === 'explore' ? raLessonItems() : raReaderItems(); }
  // Start from the paragraph on screen, so listening picks up where reading stopped.
  function raStartIndex(items) {
    if (view !== 'reader' || window.scrollY < 120) return 0;
    const top = (document.querySelector('[data-br-bar]')?.getBoundingClientRect().bottom || 0) + 8;
    const i = items.findIndex(it => it.el && it.el.getBoundingClientRect().bottom > top);
    return Math.max(0, i);
  }
  function raNextPage() {
    if (view === 'reader') {
      if (chapterId === THIRTY_MIN_ID || activeBook.sourceType === 'article') return null;
      const i = activeBook.chapters.findIndex(c => c.id === chapterId), next = activeBook.chapters[i + 1];
      return next ? {label: (next.label ? next.label + ' · ' : '') + next.title, go: () => go('reader', {chapter: next.id})} : null;
    }
    if (view === 'explore') {
      const all = bookGuides(), i = all.findIndex(g => g.unitId === selectedUnit), next = all[i + 1];
      return next ? {label: lessonCode(next).code || next.guide.title, go: () => go('explore', {unit: next.unitId, guideStep: 0})} : null;
    }
    return null;
  }

  // ---------- Settings (this device only) ----------
  let raPrefs = {voice: '', rate: 1};
  try { const saved = JSON.parse(localStorage.getItem(RA_STORE) || '{}'); raPrefs = {voice: typeof saved.voice === 'string' ? saved.voice : '', rate: RA_RATES.includes(saved.rate) ? saved.rate : 1}; } catch (_) {}
  function raSavePrefs() { try { localStorage.setItem(RA_STORE, JSON.stringify(raPrefs)); } catch (_) {} }
  function raVoices() { return raRankVoices(raSynth()?.getVoices?.() || []); }
  function raVoice() {
    const list = raVoices();
    return list.find(v => v.voiceURI === raPrefs.voice) || list[0] || null;
  }

  // ---------- Speaking ----------
  const ra = {on: false, playing: false, key: '', items: [], index: 0, chunks: [], chunk: 0, token: 0, moving: false, started: 0, lock: null, done: false};
  function raWake(on) {
    try {
      if (on && !ra.lock && navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(l => { ra.lock = l; l.addEventListener?.('release', () => { if (ra.lock === l) ra.lock = null; }); }).catch(() => {});
      if (!on && ra.lock) { ra.lock.release().catch(() => {}); ra.lock = null; }
    } catch (_) {}
  }
  function raSpeak() {
    const synth = raSynth();
    if (!synth) return;
    const item = ra.items[ra.index];
    if (!item) { raEnd(); return; }
    if (!ra.chunks.length) { ra.chunks = raChunks(item.text); ra.chunk = 0; }
    const token = ++ra.token, text = ra.chunks[ra.chunk];
    if (!text) { raAfterChunk(token); return; }
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text), voice = raVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = raPrefs.rate;
    u.onend = () => raAfterChunk(token);
    u.onerror = e => { if (token === ra.token && !['interrupted', 'canceled'].includes(e?.error)) raAfterChunk(token); };
    ra.started = Date.now();
    synth.speak(u);
    raShowCurrent();
  }
  function raAfterChunk(token) {
    if (token !== ra.token || !ra.playing) return;
    ra.token++;
    if (ra.chunk + 1 < ra.chunks.length) { ra.chunk++; raSpeak(); return; }
    ra.index++; ra.chunks = []; ra.chunk = 0;
    raSpeak();
  }
  function raEnd() {
    const next = raNextPage();
    if (next && ra.playing) {
      ra.moving = true;
      next.go();
      return;
    }
    ra.playing = false; ra.done = true; ra.index = Math.max(0, ra.items.length - 1);
    raWake(false); raMarkCurrent(null); raPlayer();
  }
  function raPlay() {
    if (!raSupported()) { toast('This browser cannot read aloud.'); return; }
    if (ra.done) { ra.done = false; ra.index = 0; ra.chunks = []; }
    ra.playing = true; raWake(true); raSpeak(); raPlayer();
  }
  function raPause() {
    ra.playing = false; ra.token++;
    raSynth()?.cancel();
    raWake(false); raPlayer();
  }
  function raJump(delta) {
    ra.done = false;
    // Back restarts the paragraph when it is under way; a second tap goes one further.
    if (delta < 0 && ra.playing && (ra.chunk > 0 || Date.now() - ra.started > 2500)) delta = 0;
    ra.index = Math.max(0, Math.min(ra.items.length - 1, ra.index + delta));
    ra.chunks = []; ra.chunk = 0;
    if (ra.playing) raSpeak(); else raShowCurrent();
    raPlayer();
  }
  function raStart() {
    if (!raSupported()) { toast('This browser cannot read aloud.'); return; }
    const items = raCollect();
    if (!items.length) { toast('There is nothing to read aloud here.'); return; }
    raStop(true);
    Object.assign(ra, {on: true, key: raPageKey(), items, index: raStartIndex(items), chunks: [], chunk: 0, done: false});
    raPlay();
  }
  function raStop(quiet = false) {
    ra.token++; ra.on = false; ra.playing = false; ra.moving = false; ra.done = false;
    raSynth()?.cancel();
    raWake(false); raMarkCurrent(null);
    document.getElementById('ra-player')?.remove();
    document.documentElement.removeAttribute('data-listening');
    if (!quiet) document.querySelectorAll('[data-action="ra-start"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  }
  function raMarkCurrent(el) {
    document.querySelectorAll('.ra-current').forEach(n => { if (n !== el) n.classList.remove('ra-current'); });
    el?.classList.add('ra-current');
  }
  function raShowCurrent() {
    const item = ra.items[ra.index];
    // A re-render may have replaced the page; find the same paragraph again.
    if (item?.el && !item.el.isConnected) { ra.items = raCollect(); }
    const el = ra.items[ra.index]?.el || null;
    raMarkCurrent(el);
    if (el) {
      const r = el.getBoundingClientRect(), bar = document.querySelector('[data-br-bar]')?.getBoundingClientRect().bottom || 0;
      if (r.top < bar + 10 || r.bottom > window.innerHeight - 150) {
        if (typeof progressReaderMoved !== 'undefined') progressReaderMoved = true;
        window.scrollTo({top: Math.max(0, window.scrollY + r.top - Math.max(bar + 24, window.innerHeight * 0.28)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      }
    }
    raPlayer();
  }

  // ---------- Controls ----------
  function raButton(cls = 'br-icon') {
    if (!raSupported()) return '';
    const here = ra.on && ra.key === raPageKey();
    return `<button class="${cls} ra-start" data-action="ra-start" aria-pressed="${here}" aria-label="Listen. Read this aloud" title="Listen">${raIcon('listen')}${cls.includes('ra-pill') ? '<span>Listen</span>' : ''}</button>`;
  }
  function raPlayer() {
    if (!ra.on) return;
    let p = document.getElementById('ra-player');
    if (!p) {
      p = document.createElement('div');
      p.id = 'ra-player'; p.className = 'ra-player'; p.setAttribute('role', 'region'); p.setAttribute('aria-label', 'Listening');
      document.body.append(p);
    }
    document.documentElement.dataset.listening = 'true';
    const item = ra.items[ra.index], line = ra.done ? 'Finished' : raClean(ra.chunks[ra.chunk] || item?.text || '');
    const left = ra.done ? '' : raMinutesLeft(ra.items, ra.index, raPrefs.rate) + ' min left';
    p.innerHTML = `<div class="ra-line"><span class="ra-where">${view === 'explore' ? 'Lesson' : chapterId === THIRTY_MIN_ID ? '30-min version' : activeBook.sourceType === 'article' ? 'Article' : 'Book'}${left ? ' · ' + left : ''}</span><span class="ra-text" aria-live="off">${esc(line)}</span></div>
      <div class="ra-controls">
        <button class="ra-btn" data-action="ra-back" aria-label="Back one paragraph">${raIcon('back', 18)}</button>
        <button class="ra-btn ra-main" data-action="${ra.playing ? 'ra-pause' : 'ra-play'}" aria-label="${ra.playing ? 'Pause' : 'Play'}">${raIcon(ra.playing ? 'pause' : 'play', 22)}</button>
        <button class="ra-btn" data-action="ra-next" aria-label="Next paragraph">${raIcon('next', 18)}</button>
        <button class="ra-btn ra-rate" data-action="ra-rate" aria-label="Speed ${raPrefs.rate} times. Tap to change">${raPrefs.rate}×</button>
        <button class="ra-btn" data-action="ra-voices" aria-label="Voice and speed">${raIcon('voice', 18)}</button>
        <button class="ra-btn" data-action="ra-stop" aria-label="Stop listening">${raIcon('close', 18)}</button>
      </div>`;
  }
  function raOpenVoices() {
    const d = bookReaderSheet('ra-voices', 'Voice');
    const list = raVoices(), current = raVoice();
    const better = v => /premium|enhanced|natural|neural/i.test(v.name);
    d.innerHTML = `${bookReaderSheetHead('ra-voices', 'Voice and speed')}
      <p class="br-sheet-sub">Your device's own voice reads the page. It is free and nothing is downloaded from read.</p>
      <div class="ra-rates" role="group" aria-label="Speed">${RA_RATES.map(r => `<button data-action="ra-set-rate" data-rate="${r}" aria-pressed="${r === raPrefs.rate}">${r}×</button>`).join('')}</div>
      <div class="br-toc ra-voice-list"><ol>${list.length ? list.slice(0, 24).map(v => `<li><button class="br-toc-row${current && v.voiceURI === current.voiceURI ? ' is-current' : ''}" data-action="ra-set-voice" data-voice="${esc(v.voiceURI)}"><span class="br-toc-label"></span><span class="br-toc-title">${esc(v.name.replace(/\s*\((enhanced|premium)\)/i, ''))}</span><span class="br-toc-state">${better(v) ? 'Better voice' : esc(v.lang)}</span></button></li>`).join('') : '<li><p class="br-sheet-sub">Voices are still loading. Close this and open it again.</p></li>'}</ol></div>
      <p class="br-sheet-sub ra-tip">For a more natural voice on iPhone or iPad, open Settings, then Accessibility, Spoken Content, Voices, English, and download one marked Enhanced or Premium. It shows up in this list.</p>
      <p class="br-sheet-sub ra-tip">The voice pauses when the screen locks, so read. keeps the screen on while you listen.</p>`;
    if (!d.open) d.showModal();
  }
  function handleReadAloudAction(action, el) {
    if (!action.startsWith('ra-')) return false;
    if (action === 'ra-start') { if (ra.on && ra.key === raPageKey()) { if (ra.playing) raPause(); else raPlay(); } else raStart(); }
    else if (action === 'ra-play') raPlay();
    else if (action === 'ra-pause') raPause();
    else if (action === 'ra-back') raJump(-1);
    else if (action === 'ra-next') raJump(1);
    else if (action === 'ra-stop') raStop();
    else if (action === 'ra-voices') raOpenVoices();
    else if (action === 'ra-rate' || action === 'ra-set-rate') {
      raPrefs.rate = action === 'ra-rate' ? RA_RATES[(RA_RATES.indexOf(raPrefs.rate) + 1) % RA_RATES.length] : Number(el.dataset.rate);
      raSavePrefs();
      if (ra.playing) raSpeak();
      raPlayer();
      if (action === 'ra-set-rate') el.closest('.ra-rates')?.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === raPrefs.rate)));
    } else if (action === 'ra-set-voice') {
      raPrefs.voice = el.dataset.voice; raSavePrefs();
      el.closest('ol')?.querySelectorAll('.br-toc-row').forEach(b => b.classList.toggle('is-current', b === el));
      if (ra.playing) raSpeak();
      else { const synth = raSynth(), u = new SpeechSynthesisUtterance('This is how I sound.'); u.voice = raVoice(); u.rate = raPrefs.rate; synth.cancel(); synth.speak(u); }
    }
    return true;
  }
  // Called after every render.
  function readAloudAfterRender() {
    document.querySelectorAll('[data-action="ra-start"]').forEach(b => b.setAttribute('aria-pressed', String(ra.on && ra.key === raPageKey())));
    if (!ra.on) return;
    const key = raPageKey();
    if (ra.moving) {
      // Carry on into the next chapter or lesson from its first line.
      ra.moving = false;
      Object.assign(ra, {key, items: raCollect(), index: 0, chunks: [], chunk: 0});
      if (!ra.items.length) { raStop(); return; }
      requestAnimationFrame(() => { if (ra.playing) raSpeak(); else raShowCurrent(); });
      return;
    }
    if (key !== ra.key) { raStop(); return; }
    ra.items = raCollect();
    raMarkCurrent(ra.items[ra.index]?.el || null);
    raPlayer();
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !ra.playing) return;
      raWake(true);
      // Coming back after the screen locked: pick the voice up again at the same place.
      const synth = raSynth();
      if (synth && (!synth.speaking || synth.paused)) { synth.cancel(); raSpeak(); }
    });
    // Some devices never report the end of a piece; notice the silence and move on.
    setInterval(() => {
      const synth = raSynth();
      if (!ra.playing || !synth || document.visibilityState !== 'visible') return;
      if (!synth.speaking && !synth.pending && Date.now() - ra.started > 1500) raAfterChunk(ra.token);
    }, 1200);
    raSynth()?.addEventListener?.('voiceschanged', () => { if (document.getElementById('ra-voices')?.open) raOpenVoices(); });
  }
