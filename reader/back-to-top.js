  // Back to top: a round glass arrow that floats in once you near the end of a
  // lesson, a book chapter or an article, and glides back to the start.
  const BACK_TO_TOP_VIEWS=new Set(['learn','reader','explore','guides']);
  let backToTopButton=null,backToTopFrame=0;
  function backToTopEl(){
    if(backToTopButton?.isConnected)return backToTopButton;
    backToTopButton=document.createElement('button');backToTopButton.type='button';backToTopButton.className='back-to-top';backToTopButton.setAttribute('aria-label','Back to top');backToTopButton.tabIndex=-1;
    backToTopButton.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>';
    backToTopButton.addEventListener('click',()=>{
      const smooth=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({top:0,behavior:smooth?'smooth':'auto'});
      const heading=document.querySelector('#main h1, #main h2, main h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    });
    document.body.appendChild(backToTopButton);return backToTopButton;
  }
  // Shown in the last stretch of a long page: past 60% of it, or within two screens of the end.
  function backToTopNearEnd(){
    const doc=document.documentElement,height=doc.scrollHeight,screen=window.innerHeight,y=window.scrollY;
    if(height<screen*2.2||y<screen*.8)return false;
    return y+screen>=height*.6||height-(y+screen)<screen*2;
  }
  function updateBackToTop(){
    backToTopFrame=0;const el=backToTopEl(),show=BACK_TO_TOP_VIEWS.has(view)&&!document.querySelector('dialog[open]')&&backToTopNearEnd();
    if(el.classList.contains('is-shown')===show)return;
    el.classList.toggle('is-shown',show);el.tabIndex=show?0:-1;el.setAttribute('aria-hidden',String(!show));
  }
  function scheduleBackToTop(){if(!backToTopFrame)backToTopFrame=requestAnimationFrame(updateBackToTop);}
  window.addEventListener('scroll',scheduleBackToTop,{passive:true});
  window.addEventListener('resize',scheduleBackToTop,{passive:true});
  window.addEventListener('hashchange',()=>setTimeout(scheduleBackToTop,60));
