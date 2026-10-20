/* Local reading preferences and NOAA sunrise/sunset estimates. No location request until a click. */
(function (root) {
  'use strict';
  const STORE = 'ycaro-reading-preferences-v1';
  const DAY = 86400000;
  const HOME = Object.freeze({latitude:26.9342,longitude:-80.0942,source:'home'});
  const DEFAULTS = Object.freeze({mode:'auto',dim:0,warm:true,size:20,autoSize:true,width:'wide',font:'literata',leading:'normal',paper:'paper',align:'justify',location:HOME});
  const FONTS = ['literata','iowan','sans'], LEADINGS = ['snug','normal','airy'], PAPERS = ['white','paper','sepia','gray'], ALIGNS = ['left','justify'];
  function sanitizePreferences(value) {
    const p = value && typeof value === 'object' ? value : {};
    const l = p.location;
    const validLocation = l && typeof l.latitude === 'number' && Number.isFinite(l.latitude) && Math.abs(l.latitude) <= 90 && typeof l.longitude === 'number' && Number.isFinite(l.longitude) && Math.abs(l.longitude) <= 180 && l.source === 'device';
    return {
      mode:['auto','day','night'].includes(p.mode)?p.mode:'auto',
      dim:typeof p.dim === 'number' && Number.isFinite(p.dim)?Math.round(Math.min(30,Math.max(0,p.dim))):0,
      warm:typeof p.warm === 'boolean'?p.warm:true,
      size:Number.isInteger(p.size)&&p.size>=18&&p.size<=32?p.size:20,
      autoSize:typeof p.autoSize==='boolean'?p.autoSize:true,
      width:['comfortable','wide','fill'].includes(p.width)?p.width:'wide',
      font:FONTS.includes(p.font)?p.font:'literata',
      leading:LEADINGS.includes(p.leading)?p.leading:'normal',
      paper:PAPERS.includes(p.paper)?p.paper:'paper',
      align:ALIGNS.includes(p.align)?p.align:'justify',
      location:validLocation?{latitude:l.latitude,longitude:l.longitude,source:'device'}:{...HOME}
    };
  }
  // NOAA's fractional-year approximation, including the 90.833 degree horizon correction.
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  // Dates are anchored to solar longitude, independent of the device time zone and DST.
  function sunTimes(now,latitude,longitude) {
    const stamp = new Date(now).getTime();
    if (!Number.isFinite(stamp) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new RangeError('A valid date and location are required.');
    const localSolar = new Date(stamp + longitude * 240000);
    const year = localSolar.getUTCFullYear();
    const midnight = Date.UTC(year,localSolar.getUTCMonth(),localSolar.getUTCDate());
    const day = (midnight-Date.UTC(year,0,1))/DAY+1;
    const daysInYear = (Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/DAY;
    const gamma = 2*Math.PI/daysInYear*(day-1);
    const eq = 229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
    const decl = 0.006918-0.399912*Math.cos(gamma)+0.070257*Math.sin(gamma)-0.006758*Math.cos(2*gamma)+0.000907*Math.sin(2*gamma)-0.002697*Math.cos(3*gamma)+0.00148*Math.sin(3*gamma);
    const lat = latitude*Math.PI/180;
    const cosHour = Math.cos(90.833*Math.PI/180)/(Math.cos(lat)*Math.cos(decl))-Math.tan(lat)*Math.tan(decl);
    if (cosHour > 1) return {sunrise:null,sunset:null,polar:'night',isNight:true};
    if (cosHour < -1) return {sunrise:null,sunset:null,polar:'day',isNight:false};
    const ha = Math.acos(cosHour)*180/Math.PI;
    const sunrise = Math.round(midnight+(720-4*(longitude+ha)-eq)*60000);
    const sunset = Math.round(midnight+(720-4*(longitude-ha)-eq)*60000);
    return {sunrise,sunset,polar:null,isNight:stamp<sunrise || stamp>=sunset};
  }
  function appearance(preferences,now=Date.now()) {
    const p=sanitizePreferences(preferences);
    const sun=sunTimes(now,p.location.latitude,p.location.longitude);
    return {night:p.mode==='night'||(p.mode==='auto'&&sun.isNight),sun,preferences:p};
  }
  function readPreferences(storage) {
    try {return sanitizePreferences(JSON.parse(storage.getItem(STORE)));} catch {return sanitizePreferences(null);}
  }
  function savePreferences(storage,value) {
    try {storage.setItem(STORE,JSON.stringify(sanitizePreferences(value)));return true;} catch {return false;}
  }
  function responsiveSize(size,width,automatic=true) {
    return automatic?Math.min(36,size+4,Math.round((size+Math.max(0,width-700)/140)*2)/2):size;
  }
  const math = Object.freeze({STORE,HOME,DEFAULTS,sanitizePreferences,sunTimes,appearance,readPreferences,savePreferences,responsiveSize});
  root.YcaroReadingComfortMath=math;
  if (typeof document === 'undefined') return;
  let preferences;
  try {preferences=readPreferences(root.localStorage);} catch {preferences=sanitizePreferences(null);}
  let dialog, opener, locationPending=false, geoRequest=0, notice='';
  const html=document.documentElement;
  function apply() {
    const current=appearance(preferences);
    html.dataset.readingTheme=current.night?'night':'day';
    html.dataset.readingWarm=String(current.night && preferences.warm);
    html.dataset.readingWidth=preferences.width;
    html.dataset.readingFont=preferences.font;
    html.dataset.readingLeading=preferences.leading;
    html.dataset.readingPaper=preferences.paper;
    html.dataset.readingAlign=preferences.align;
    const main=document.getElementById('main'),style=main?root.getComputedStyle(main):null;
    const available=main?main.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight):root.innerWidth||700;
    const size=responsiveSize(preferences.size,available,preferences.autoSize);
    if(html.style.getPropertyValue('--reading-size')!==size+'px')root.dispatchEvent(new Event('ycaro-reading-layout-change'));
    html.style.setProperty('--reading-size',size+'px');
    html.style.setProperty('--page-dim',String(preferences.dim/100));
    html.style.setProperty('--reading-brightness',String(1-preferences.dim/100));
    html.style.colorScheme=current.night?'dark':'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',current.night?'#000000':({white:'#FFFFFF',paper:'#FAF7F0',sepia:'#F3E9D4',gray:'#E9E9E6'})[preferences.paper]);
    if(dialog)updatePanel(current);
    root.dispatchEvent(new CustomEvent('ycaro-reading-change',{detail:{night:current.night,size,mode:preferences.mode,autoSize:preferences.autoSize,width:preferences.width}}));
    return current;
  }
  // This script belongs in <head>, before CSS and body, so night readers never get a white flash.
  apply();
  function setPreferences(patch) {
    preferences=sanitizePreferences({...preferences,...patch});
    try {if(!savePreferences(root.localStorage,preferences))notice='Applied for this visit. This browser could not save your preference.';} catch {notice='Applied for this visit. This browser could not save your preference.';}
    apply();
  }
  function clockTime(value) {
    return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));
  }
  function scheduleText(current) {
    const sun=current.sun;
    if(sun.polar==='night')return 'No sunrise today at this location. Automatic stays in night mode.';
    if(sun.polar==='day')return 'No sunset today at this location. Automatic stays in day mode.';
    if(!sun.isNight)return 'Automatic changes to night at sunset, about '+clockTime(sun.sunset)+'.';
    const next=Date.now()<sun.sunrise?sun:sunTimes(Date.now()+DAY,preferences.location.latitude,preferences.location.longitude);
    return next.sunrise?'Automatic returns to day at sunrise, about '+clockTime(next.sunrise)+'.':'Automatic stays in night mode until the next sunrise.';
  }
  function updatePanel(current) {
    dialog.querySelectorAll('[data-reading-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.readingMode===preferences.mode)));
    dialog.querySelectorAll('[data-reading-size]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.readingSize)===preferences.size)));
    dialog.querySelector('#reading-auto-size').checked=preferences.autoSize;
    for(const key of ['font','leading','paper','align'])dialog.querySelectorAll('[data-reading-'+key+']').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset['reading'+key[0].toUpperCase()+key.slice(1)]===preferences[key])));
    dialog.querySelector('#reading-width').value=preferences.width;
    const dim=dialog.querySelector('#reading-dim');
    if(Number(dim.value)!==preferences.dim)dim.value=String(preferences.dim);
    dialog.querySelector('#reading-dim-value').textContent=preferences.dim?preferences.dim+'% dimmer':'No dimming';
    dialog.querySelector('#reading-warm').checked=preferences.warm;
    dialog.querySelector('#reading-theme-status').textContent=current.night?'Night is on':'Day is on';
    dialog.querySelector('#reading-schedule').textContent=scheduleText(current);
    dialog.querySelector('#reading-location').textContent=preferences.location.source==='home'?'Sunset location: Jupiter, FL':'Sunset location: your saved location';
    dialog.querySelector('[data-reading-action="home"]').hidden=preferences.location.source==='home';
    const locationButton=dialog.querySelector('[data-reading-action="location"]');
    locationButton.disabled=locationPending;
    locationButton.textContent=locationPending?'Finding your location…':'Use my location';
    dialog.querySelector('#reading-notice').textContent=notice;
    document.querySelectorAll('[data-action="reading-settings"]').forEach(button=>button.setAttribute('aria-label','Reading comfort. '+(current.night?'Night':'Day')+' mode.'));
  }
  function open(trigger) {
    if(!dialog)mount();
    opener=trigger instanceof HTMLElement?trigger:document.activeElement;
    apply();
    if(!dialog.open){root.dispatchEvent(new Event('ycaro-reading-settings-open'));dialog.showModal();}
    dialog.querySelector('[data-reading-action="close"]').focus();
  }
  function close() {if(dialog?.open)dialog.close();}
  function requestLocation() {
    if(!root.navigator?.geolocation){notice='Location is unavailable here. Jupiter, FL remains selected; day and night controls still work.';apply();return;}
    locationPending=true;notice='';const request=++geoRequest;apply();
    root.navigator.geolocation.getCurrentPosition(position=>{
      if(request!==geoRequest)return;
      locationPending=false;
      notice='Location saved on this device. Refresh it here when you travel.';
      setPreferences({location:{latitude:Math.round(position.coords.latitude*100)/100,longitude:Math.round(position.coords.longitude*100)/100,source:'device'}});
    },()=>{
      if(request!==geoRequest)return;
      locationPending=false;notice='Location was not available or permission was declined. Your previous sunset location is still selected.';apply();
    },{enableHighAccuracy:false,timeout:10000,maximumAge:3600000});
  }
  function mount() {
    if(dialog)return;
    dialog=document.createElement('dialog');
    dialog.id='reading-comfort-dialog';
    dialog.setAttribute('aria-labelledby','reading-comfort-title');
    dialog.innerHTML=`<div class="comfort-header"><div><span class="comfort-eyebrow">Settle into your book</span><h2 id="reading-comfort-title">Text and page</h2></div><button class="comfort-close" data-reading-action="close" aria-label="Close reading comfort">×</button></div>
      <div class="comfort-content"><section class="comfort-section"><h3>Reading size</h3><div class="comfort-options comfort-sizes" role="group" aria-label="Reading text size">${[18,20,24,28].map(size=>`<button data-reading-size="${size}" aria-label="${size} pixel reading size" aria-pressed="false"><span aria-hidden="true" style="font-size:${size}px">Aa</span><small>${size}</small></button>`).join('')}</div><label class="comfort-switch" for="reading-auto-size"><span><strong>Fit text to the window</strong><small>Text grows with the available reading space. Your chosen size is the starting point.</small></span><input id="reading-auto-size" type="checkbox" role="switch"></label><label for="reading-width">Page width</label><select id="reading-width"><option value="comfortable">Comfortable</option><option value="wide">Wide</option><option value="fill">Fill window</option></select><p class="comfort-sample">One idea at a time. Let the page meet you where you are.</p></section><section class="comfort-section comfort-page"><h3>Page</h3><div class="comfort-options comfort-papers" role="group" aria-label="Page color">${[["white","White"],["paper","Paper"],["sepia","Sepia"],["gray","Gray"]].map(([v,l])=>`<button data-reading-paper="${v}" aria-pressed="false"><span class="comfort-swatch comfort-swatch-${v}" aria-hidden="true"></span>${l}</button>`).join('')}</div><p class="comfort-help">Page color applies in day mode. Night mode is always dark.</p><h3>Typeface</h3><div class="comfort-options comfort-fonts" role="group" aria-label="Typeface">${[["literata","Literata"],["iowan","Classic"],["sans","Sans"]].map(([v,l])=>`<button data-reading-font="${v}" aria-pressed="false"><span class="comfort-font-${v}" aria-hidden="true">Ag</span>${l}</button>`).join('')}</div><h3>Line spacing</h3><div class="comfort-options" role="group" aria-label="Line spacing">${[["snug","Snug"],["normal","Normal"],["airy","Airy"]].map(([v,l])=>`<button data-reading-leading="${v}" aria-pressed="false">${l}</button>`).join('')}</div><h3>Alignment</h3><div class="comfort-options" role="group" aria-label="Text alignment">${[["justify","Justified"],["left","Left"]].map(([v,l])=>`<button data-reading-align="${v}" aria-pressed="false">${l}</button>`).join('')}</div></section><section class="comfort-section"><div class="comfort-heading"><h3>Night shift</h3><span id="reading-theme-status"></span></div><div class="comfort-options" role="group" aria-label="Reading appearance"><button data-reading-mode="day" aria-pressed="false">Day</button><button data-reading-mode="auto" aria-pressed="false">Sunset</button><button data-reading-mode="night" aria-pressed="false">Night</button></div><p id="reading-schedule" class="comfort-help"></p><p id="reading-location" class="comfort-location"></p><div class="comfort-location-actions"><button class="text-button" data-reading-action="location">Use my location</button><button class="text-button" data-reading-action="home" hidden>Use Jupiter, FL</button></div><p class="comfort-fine">Sunrise and sunset are estimated on your device. The schedule follows the saved location.</p></section>
      <section class="comfort-section"><label class="comfort-switch" for="reading-warm"><span><strong>Warm light at night</strong><small>A softer, amber-tinted reading palette.</small></span><input id="reading-warm" type="checkbox" role="switch"></label><label class="comfort-range-label" for="reading-dim"><strong>Page dimmer</strong><output id="reading-dim-value" for="reading-dim"></output></label><input id="reading-dim" type="range" min="0" max="30" step="1" value="0" aria-describedby="reading-dim-help"><p id="reading-dim-help" class="comfort-help">Softens this page. Use iPad or iPhone Control Center to lower the screen brightness further.</p></section>
<p id="reading-notice" class="comfort-help" role="status"></p><p class="comfort-fine">Saved on this device, so your iPad can have its own reading setup.</p></div>`;
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});root.dispatchEvent(new Event('ycaro-reading-settings-close'));});
    dialog.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.readingMode)setPreferences({mode:button.dataset.readingMode});
      else if(button.dataset.readingSize)setPreferences({size:Number(button.dataset.readingSize)});
      else if(button.dataset.readingFont)setPreferences({font:button.dataset.readingFont});
      else if(button.dataset.readingLeading)setPreferences({leading:button.dataset.readingLeading});
      else if(button.dataset.readingPaper)setPreferences({paper:button.dataset.readingPaper});
      else if(button.dataset.readingAlign)setPreferences({align:button.dataset.readingAlign});
      else if(button.dataset.readingAction==='close')close();
      else if(button.dataset.readingAction==='location')requestLocation();
      else if(button.dataset.readingAction==='home'){geoRequest++;locationPending=false;notice='';setPreferences({location:HOME});}
    });
    dialog.querySelector('#reading-dim').addEventListener('input',event=>setPreferences({dim:Number(event.target.value)}));
    dialog.querySelector('#reading-warm').addEventListener('change',event=>setPreferences({warm:event.target.checked}));
    dialog.querySelector('#reading-auto-size').addEventListener('change',event=>setPreferences({autoSize:event.target.checked}));
    dialog.querySelector('#reading-width').addEventListener('change',event=>setPreferences({width:event.target.value}));
    apply();
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-action="reading-settings"]');if(trigger){event.preventDefault();open(trigger);}
  });
  root.addEventListener('storage',event=>{if(event.key===STORE){preferences=readPreferences(root.localStorage);apply();}});
  root.addEventListener('focus',apply);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply();});
  root.setInterval(apply,60000);
  root.YcaroReadingComfort=Object.freeze({open,close,refresh:apply,update:setPreferences,getPreferences:()=>({...preferences})});
  function initialize(){mount();if(root.ResizeObserver){const observer=new root.ResizeObserver(apply);const main=document.getElementById('main');if(main)observer.observe(main);}root.addEventListener('resize',apply);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})(globalThis);
