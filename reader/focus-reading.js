  let focusReading=false;
  try{focusReading=sessionStorage.getItem('read-focus-v1')==='true';}catch(_){}
  const focusReadingViews=new Set(['reader','explore','learn']);
  function focusReadingControls(){
    if(!focusReadingViews.has(view))return '';
    const p=window.YcaroReadingComfort?.getPreferences()||{size:20,autoSize:true,width:'wide'};
    return `<div class="reading-tools-bar" aria-label="Reading layout"><button class="focus-enter" data-action="focus-enter" aria-label="Enter focus mode">${readIcon('focus')} <span>Focus</span></button><div class="reading-size-tools" role="group" aria-label="Adjust text size"><button data-action="text-smaller" aria-label="Smaller reading text">A−</button><output data-reading-size-output aria-label="Current reading text size"></output><button data-action="text-larger" aria-label="Larger reading text">A+</button></div><label class="reading-auto-control"><input type="checkbox" data-reading-auto ${p.autoSize?'checked':''}>Auto size</label><label class="reading-width-control">Page width <select data-reading-width aria-label="Reading page width">${[['comfortable','Comfortable'],['wide','Wide'],['fill','Fill window']].map(([id,label])=>`<option value="${id}" ${p.width===id?'selected':''}>${label}</option>`).join('')}</select></label></div>`;
  }
  function focusReadingAfterRender(){
    const enabled=focusReading&&focusReadingViews.has(view);
    document.documentElement.dataset.readingFocus=String(enabled);
    let exit=document.getElementById('focus-exit');
    if(!exit){exit=document.createElement('button');exit.id='focus-exit';exit.dataset.action='focus-exit';exit.className='focus-exit';exit.textContent='Show controls';exit.setAttribute('aria-label','Exit focus mode and show controls');document.body.append(exit);}
    exit.hidden=!enabled;
    window.YcaroReadingComfort?.refresh();
    updateReadingTools();
  }
  function updateReadingTools(){
    const p=window.YcaroReadingComfort?.getPreferences();if(!p)return;
    const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading-size'));
    document.querySelectorAll('[data-reading-size-output]').forEach(el=>el.textContent=`${value||p.size}px`);
    document.querySelectorAll('[data-reading-auto]').forEach(el=>el.checked=p.autoSize);
    document.querySelectorAll('[data-reading-width]').forEach(el=>el.value=p.width);
    document.querySelectorAll('[data-action="text-smaller"]').forEach(el=>el.disabled=p.size<=18);
    document.querySelectorAll('[data-action="text-larger"]').forEach(el=>el.disabled=p.size>=32);
  }
  function setReadingFocus(enabled){
    const anchor=[...document.querySelectorAll('.reader-article > p,.lesson-body > *,main > .lesson-head')].find(el=>{const r=el.getBoundingClientRect();return r.bottom>80&&r.top<innerHeight;});
    const top=anchor?.getBoundingClientRect().top;
    window.dispatchEvent(new Event('ycaro-reading-layout-change'));
    focusReading=enabled;try{sessionStorage.setItem('read-focus-v1',String(enabled));}catch(_){}
    focusReadingAfterRender();
    requestAnimationFrame(()=>{if(anchor?.isConnected&&top!==undefined)window.scrollBy({top:anchor.getBoundingClientRect().top-top,behavior:'instant'});const target=enabled?document.getElementById('focus-exit'):document.querySelector('[data-action="focus-enter"]');target?.focus({preventScroll:true});});
  }
  document.addEventListener('click',event=>{
    const action=event.target.closest?.('[data-action]')?.dataset.action;
    if(action==='focus-enter')setReadingFocus(true);
    if(action==='focus-exit')setReadingFocus(false);
    if(action==='text-smaller'||action==='text-larger'){
      const comfort=window.YcaroReadingComfort,p=comfort.getPreferences();
      comfort.update({size:Math.max(18,Math.min(32,p.size+(action==='text-larger'?1:-1)))});
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.matches?.('[data-reading-auto]'))window.YcaroReadingComfort?.update({autoSize:event.target.checked});
    if(event.target.matches?.('[data-reading-width]'))window.YcaroReadingComfort?.update({width:event.target.value});
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&focusReading&&!document.querySelector('dialog[open]'))setReadingFocus(false);});
  window.addEventListener('ycaro-reading-change',updateReadingTools);
