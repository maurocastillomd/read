  // Library shelves and covers. Every reading gets a cover of its own: a book's
  // real cover from its file, an article's own share picture, or, when there is
  // none, a cover drawn from its title so no two readings look alike. A picture
  // that several readings share (a site logo, a stock image) counts as none.
  // Each shelf folds away with one tap and stays that way on this device.
  const SHELF_KEY='read.shelves.v1';
  const COVER_TONES=[
    {bg:'#2039c4',fg:'#f6f5ee'},{bg:'#222329',fg:'#f6f5ee'},
    {bg:'color-mix(in srgb,#2039c4 58%,#222329)',fg:'#f6f5ee'},{bg:'color-mix(in srgb,#2039c4 26%,#222329)',fg:'#f6f5ee'},
    {bg:'color-mix(in srgb,#2039c4 80%,#f6f5ee)',fg:'#f6f5ee'},{bg:'#ecebe4',fg:'#16171b',art:'#2039c4',light:true},
  ];
  function coverHash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.codePointAt(0),16777619);return h>>>0;}
  function coverRandom(seed){let s=seed||1;return()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
  const coverN=v=>Math.round(v*10)/10;
  // Eight families of line drawings, each with its own random proportions.
  const COVER_MOTIFS=[
    r=>{const cx=90+r()*120,cy=60+r()*80,n=4+Math.floor(r()*4),step=12+r()*10;let s='';for(let i=0;i<n;i++)s+=`<circle cx="${coverN(cx+i*r()*6)}" cy="${coverN(cy)}" r="${coverN(14+i*step)}"${i===n-1?' stroke-dasharray="3 6"':''}/>`;return s+`<circle cx="${coverN(cx)}" cy="${coverN(cy)}" r="5" fill="currentColor"/>`;},
    r=>{const n=4+Math.floor(r()*4),amp=8+r()*18,freq=1+r()*2.2,phase=r()*6;let s='';for(let i=0;i<n;i++){const y=40+i*(130/n);let d=`M10 ${coverN(y)}`;for(let x=10;x<=290;x+=10)d+=`L${x} ${coverN(y+Math.sin(x/290*Math.PI*2*freq+phase+i*.5)*amp)}`;s+=`<path d="${d}"${i%2?' opacity=".5"':''}/>`;}return s;},
    r=>{const cols=7+Math.floor(r()*4),rows=5+Math.floor(r()*2),gap=Math.min(260/cols,170/rows);let s='';for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const on=r()<.18;s+=`<circle cx="${coverN(150-(cols-1)*gap/2+x*gap)}" cy="${coverN(102-(rows-1)*gap/2+y*gap)}" r="${on?5:1.8}"${on?' fill="currentColor"':' fill="currentColor" opacity=".55"'}/>`;}return s;},
    r=>{const n=5+Math.floor(r()*5),w=200/n;let s='<path d="M40 180H260" opacity=".5"/>';for(let i=0;i<n;i++){const h=25+r()*120;s+=`<rect x="${coverN(50+i*w)}" y="${coverN(178-h)}" width="${coverN(w*.55)}" height="${coverN(h)}" rx="2"${r()<.25?' fill="currentColor" opacity=".35"':''}/>`;}return s;},
    r=>{const n=3+Math.floor(r()*3),pts=[];let s='';for(let i=0;i<n;i++){const rx=40+i*28+r()*10,ry=18+i*14+r()*8,rot=coverN(-30+r()*60);s+=`<ellipse cx="150" cy="102" rx="${coverN(rx)}" ry="${coverN(ry)}" transform="rotate(${rot} 150 102)"${i%2?' opacity=".55"':''}/>`;const a=r()*Math.PI*2,c=Math.cos(rot*Math.PI/180),sn=Math.sin(rot*Math.PI/180),x=rx*Math.cos(a),y=ry*Math.sin(a);pts.push([150+x*c-y*sn,102+x*sn+y*c]);}return s+pts.map(([x,y])=>`<circle cx="${coverN(x)}" cy="${coverN(y)}" r="4.5" fill="currentColor"/>`).join('')+'<circle cx="150" cy="102" r="7"/>';},
    r=>{const n=4+Math.floor(r()*4),base=coverN(r()*40);let s='';for(let i=0;i<n;i++){const size=150-i*(110/n);s+=`<rect x="${coverN(150-size/2)}" y="${coverN(102-size/2)}" width="${coverN(size)}" height="${coverN(size)}" rx="${coverN(4+i*2)}" transform="rotate(${coverN(base+i*(8+r()*10))} 150 102)"${i===n-1?' fill="currentColor" opacity=".3"':''}/>`;}return s;},
    r=>{const n=10+Math.floor(r()*14),cx=150,cy=102+r()*30,inner=10+r()*14;let s=`<circle cx="${cx}" cy="${coverN(cy)}" r="${coverN(inner-4)}" fill="currentColor" opacity=".35"/>`;for(let i=0;i<n;i++){const a=Math.PI*(1+i/(n-1)),len=50+r()*70;s+=`<path d="M${coverN(cx+Math.cos(a)*inner)} ${coverN(cy+Math.sin(a)*inner)}L${coverN(cx+Math.cos(a)*(inner+len))} ${coverN(cy+Math.sin(a)*(inner+len))}"${i%3?'':' opacity=".5"'}/>`;}return s+`<path d="M30 ${coverN(cy)}H270" opacity=".45"/>`;},
    r=>{const n=4+Math.floor(r()*3),cx=110+r()*80,cy=80+r()*40;let s='';for(let i=0;i<n;i++){const k=1+i*.55,pts=[];for(let j=0;j<8;j++){const a=j/8*Math.PI*2,rad=(24+r()*14)*k;pts.push([cx+Math.cos(a)*rad*1.3,cy+Math.sin(a)*rad]);}const d=pts.map((p,j)=>{const q=pts[(j+1)%8];return `${j?'':'M'+coverN((p[0]+pts[7][0])/2)+' '+coverN((p[1]+pts[7][1])/2)}Q${coverN(p[0])} ${coverN(p[1])} ${coverN((p[0]+q[0])/2)} ${coverN((p[1]+q[1])/2)}`;}).join('')+'Z';s+=`<path d="${d}"${i%2?' opacity=".55"':''}/>`;}return s;},
  ];
  function coverArt(book){
    const seed=coverHash(book.id+'|'+book.title+'|'+book.author),r=coverRandom(seed);
    const motif=COVER_MOTIFS[seed%COVER_MOTIFS.length],tone=COVER_TONES[Math.floor(seed/COVER_MOTIFS.length)%COVER_TONES.length];
    return {tone,svg:`<svg viewBox="0 0 300 205" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${motif(r)}</g></svg>`};
  }
  function coverHost(book){try{return new URL(book.sourceUrl).hostname.replace(/^www\./,'');}catch{return '';}}
  let coverShareCache={key:'',shared:new Set()};
  function sharedCovers(){
    const list=books.filter(b=>!state.hiddenBooks?.[b.id]&&!isReplaced(b)),key=list.map(b=>b.id+':'+String(b.cover||'').length).join('|');
    if(coverShareCache.key!==key){const seen=new Map();for(const b of list)if(b.cover)seen.set(b.cover,(seen.get(b.cover)||0)+1);coverShareCache={key,shared:new Set([...seen].filter(([,n])=>n>1).map(([c])=>c))};}
    return coverShareCache.shared;
  }
  function ownCover(book){return book.cover&&/^(?:data:image\/|\/books\/)/.test(book.cover)&&!sharedCovers().has(book.cover)?book.cover:'';}
  function coverObject(book){
    const article=book.sourceType==='article',photo=ownCover(book);
    if(photo&&!article)return `<div class="book-object book-object-photo"><div class="book-spine" aria-hidden="true"></div><img class="book-cover-photo" src="${esc(photo)}" alt="" decoding="async"></div>`;
    const {tone,svg}=coverArt(book),host=article?coverHost(book):'',long=String(book.title).length>58;
    const series=article?`<span class="cover-brand">read.</span> / ${host?esc(host):'Article'}`:'<span class="cover-brand">read.</span> / Learning edition';
    const art=photo?`<div class="book-art cover-photo-band"><img src="${esc(photo)}" alt="" decoding="async"></div>`:`<div class="book-art"${tone.art?` style="color:${tone.art}"`:''}>${svg}</div>`;
    return `<div class="book-object generated-cover${article?' article-cover':''}${tone.light?' cover-light':''}" style="--cover-bg:${tone.bg};--cover-fg:${tone.fg}">${article?'':'<div class="book-spine" aria-hidden="true"></div>'}<div class="book-cover-front"><span class="cover-series">${series}</span>${art}<span class="book-cover-title${long?' cover-title-long':''}">${esc(book.title)}</span><span class="book-cover-author">${esc(String(book.author||'').split(/,\s*/).slice(0,3).join(', '))}</span><span class="cover-rule" aria-hidden="true"></span></div></div>`;
  }
  function shelfPrefs(){try{return JSON.parse(localStorage.getItem(SHELF_KEY)||'{}')||{};}catch{return {};}}
  function shelfOpen(key){return libraryQuery.trim()?true:shelfPrefs()[key]!==false;}
  function shelfGroup(key,label,list){
    const open=shelfOpen(key),id='shelf-'+key;
    return `<section class="shelf-group${open?'':' shelf-closed'}" aria-label="${label}"><h3 class="shelf-group-title"><button class="shelf-toggle" data-action="toggle-shelf" data-shelf="${key}" aria-expanded="${open}" aria-controls="${id}">${label} <span>${list.length}</span><svg class="shelf-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg><span class="sr-only">${open?'Hide':'Show'}</span></button></h3><div class="shelf-fold" id="${id}"${open?'':' inert'}><div class="shelf">${shelfTiles(list)}</div></div></section>`;
  }
  function toggleShelf(el){
    const key=el.dataset.shelf,open=el.getAttribute('aria-expanded')!=='true',prefs=shelfPrefs();prefs[key]=open;
    try{localStorage.setItem(SHELF_KEY,JSON.stringify(prefs));}catch{}
    el.setAttribute('aria-expanded',String(open));el.querySelector('.sr-only').textContent=open?'Hide':'Show';
    const group=el.closest('.shelf-group'),fold=group.querySelector('.shelf-fold');group.classList.toggle('shelf-closed',!open);
    if(open)fold.removeAttribute('inert');else fold.setAttribute('inert','');
  }
  function handleLibraryShelfAction(a,el){if(a!=='toggle-shelf')return false;toggleShelf(el);return true;}
