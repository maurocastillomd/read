  // First run. read. asks your name once, then asks for a first book or article and
  // makes everything else from it. The name syncs with the rest of your state.
  const PROFILE_ID = 'read.profile';
  function readerName(){const n=state.last[PROFILE_ID]?.name;return typeof n==='string'?n.trim().slice(0,60):'';}
  function saveReaderName(name){state.last[PROFILE_ID]={...state.last[PROFILE_ID],name:String(name||'').trim().slice(0,60)};save();}
  function libraryGreeting(){
    const name=readerName();if(!name)return '';
    const hour=new Date().getHours(),part=hour<5?'evening':hour<12?'morning':hour<18?'afternoon':'evening';
    return `<p class="library-greeting">Good ${part}, ${esc(name)}.</p>`;
  }
  // The copyright stance, shown before the first upload and kept in Cloud settings.
  function rightsNotice(open=false){
    return `<details class="method-note welcome-rights"${open?' open':''}><summary>Your readings and copyright</summary>
      <p><strong>Add only what you have the right to use.</strong> Upload books, papers and articles you own, bought for your own use, or that are openly licensed. read. ships with no books and never shares, publishes or sells what you add: your library stays in your own private copy, behind your password.</p>
      <p>Lessons, pictures and summaries are made by AI from your copy, for your personal study. They can be wrong. Check anything important against the original.</p>
      <p>read. is free, open-source software, provided “as is”, without warranty of any kind. You are responsible for what you upload and how you use it. The authors and contributors are not liable for any misuse, copyright infringement or unlawful use by anyone running the software. This is not legal advice. <a href="https://github.com/maurocastillomd/read#copyright-and-your-content" target="_blank" rel="noopener noreferrer">Read the full notice</a>.</p>
    </details>`;
  }
  function welcomeView(count){
    const name=readerName();
    const art=isoFigure(isoPick('welcome','handoff'));
    if(!name)return `${topbar('Welcome')}<section class="welcome" aria-labelledby="welcome-title"><div class="welcome-card">
      <p class="eyebrow">Welcome to read.</p>
      <h1 id="welcome-title">Books you finish.<br>Ideas you keep.</h1>
      <p class="lead">Add a book or an article and read. turns it into short visual lessons, a 30-minute version, and a daily review that brings the ideas back before they fade.</p>
      <div class="welcome-art" aria-hidden="true">${art}</div>
      <form id="welcome-name-form" class="welcome-form"><label for="welcome-name">What should we call you?</label>
        <div class="welcome-field"><input id="welcome-name" name="name" autocomplete="given-name" maxlength="60" placeholder="Your first name" required><button class="primary" type="submit">Continue <span aria-hidden="true">→</span></button></div>
      </form>
      <p class="welcome-promise">read. ships with no books. Add only readings you own or have the right to use. Free software, provided as is, with no warranty.</p>
      ${rightsNotice()}
    </div></section>`;
    return `${topbar('Welcome')}<section class="welcome" aria-labelledby="welcome-title"><div class="welcome-card">
      <p class="eyebrow">Your library is ready</p>
      <h1 id="welcome-title">Hi, ${esc(name)}.<br>What are you reading?</h1>
      <p class="lead">Add your first book or article. read. makes its lessons, pictures and daily review from it.</p>
      <div class="welcome-art" aria-hidden="true">${art}</div>
      <div class="button-row"><button class="primary" data-action="import">Add your first reading ${readIcon('plus')}</button></div>
      <ul class="welcome-kinds" aria-label="What you can add"><li><strong>Books</strong><span>EPUB or PDF</span></li><li><strong>Articles</strong><span>A web link</span></li><li><strong>Papers</strong><span>PDF, DOI or PubMed ID</span></li></ul>
      <p class="small welcome-change">Not ${esc(name)}? <button class="text-button" data-action="welcome-rename">Change name</button></p>
      ${rightsNotice(true)}
    </div></section>`;
  }
  function welcomeAfterRender(){
    const form=document.getElementById('welcome-name-form');if(!form)return;
    form.addEventListener('submit',event=>{event.preventDefault();const name=form.elements.name.value.trim();if(!name){form.elements.name.focus();return;}saveReaderName(name);render(true);});
  }
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-action="welcome-rename"]'))return;
    state.last[PROFILE_ID]={...state.last[PROFILE_ID],name:''};save();render(true);document.getElementById('welcome-name')?.focus();
  });
