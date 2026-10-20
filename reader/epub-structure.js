  // Turns EPUB spine documents and the table of contents into clean chapters.
  // Structure survives as line prefixes inside plain chapter text, so every
  // existing consumer keeps working on paragraphs separated by newlines:
  //   "## " heading · "> " quotation or epigraph · "~ " figure caption · "![key]" figure
  // Calibre conversions of PDFs (one paragraph per printed line, page anchors,
  // inline note numbers) are rejoined into real paragraphs.
  const EpubStructure=(()=>{
    const LEAF='h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,td,th,dt,dd,figcaption,div,section,aside';
    const EMPHASIS=new Set(['I','EM','B','STRONG','CITE']);
    const SKIP=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','NAV','TEMPLATE','HEAD','NOSCRIPT']);
    const SUPERSCRIPT={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
    const FROM_SUPERSCRIPT=Object.fromEntries(Object.entries(SUPERSCRIPT).map(([d,s])=>[s,d]));
    const superscript=digits=>digits.replace(/\d/g,d=>SUPERSCRIPT[d]);
    const normal=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
    const tidy=s=>String(s||'').replace(/[\s ]+/g,' ').trim();
    const ROMAN={i:1,v:5,x:10,l:50,c:100};
    const roman=s=>{let n=0;const r=s.toLowerCase();for(let i=0;i<r.length;i++){const a=ROMAN[r[i]],b=ROMAN[r[i+1]]||0;if(!a)return NaN;n+=a<b?-a:a;}return n;};
    const WORDS=['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
    const numberOf=s=>{const t=String(s||'').trim().toLowerCase();if(/^\d+$/.test(t))return Number(t);if(/^[ivxlc]+$/.test(t))return roman(t);const w=WORDS.indexOf(t);return w>=0?w+1:NaN;};
    const GENERIC=/^(chapter|part|book|section|unit)\s+([0-9]+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\.?$/i;
    const titleCase=s=>s===s.toUpperCase()&&/[A-Z]{3}/.test(s)?s.toLowerCase().replace(/(^|[\s(“"-])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(A|An|And|As|At|But|By|For|From|In|Into|Of|On|Or|The|To|With)\b/g,(w,_,i)=>i?w.toLowerCase():w):s;
    const REFERENCE=/^(?:notes|endnotes|footnotes|bibliography|references|works cited|sources|index|copyright(?: page| notice)?|permissions(?: acknowledg(?:e)?ments)?|acknowledg(?:e)?ments|about the authors?|a note (?:about|on) the authors?|title page|half title|dedication|epigraph|contents|table of contents|also by .+|other books by .+|books by .+|cover)$/i;
    const ORIENTATION=/^(?:foreword|preface|introduction|prologue|afterword|epilogue|(?:a |an )?(?:author|translator)'?s note|conclusion)$/i;
    const TERMINAL=/[.!?…:]["”’)\]]*(?:\d{1,3}|[⁰¹²³⁴⁵⁶⁷⁸⁹]{1,3})?$/;
    const CAPTION=/^(?:fig(?:ure)?|table|plate|chart|map|illustration)s?\.?\s*\d+/i;

    function structuredLine(line){
      const text=String(line||'');
      if(/^!\[[\w.-]{1,60}\]$/.test(text))return {kind:'figure',key:text.slice(2,-1),text:''};
      if(text.startsWith('## '))return {kind:'heading',text:text.slice(3)};
      if(text.startsWith('> '))return {kind:'quote',text:text.slice(2)};
      if(text.startsWith('~ '))return {kind:'caption',text:text.slice(2)};
      return {kind:'text',text};
    }
    // Reads one leaf element: its text, whether every word is emphasized, its images,
    // and footnote references written as <sup>.
    function readLeaf(el,figureFor){
      let text='',plainText='',lead='',leading=true;const images=[];
      const walk=(node,emph)=>{
        if(node.nodeType===3){const v=node.nodeValue||'';text+=v;if(!emph)plainText+=v;if(leading){if(emph||!v.trim())lead+=v;else leading=false;}return;}
        if(node.nodeType!==1)return;
        const tag=String(node.tagName||'').toUpperCase();
        if(SKIP.has(tag))return;
        if(tag==='BR'){text+=' ';return;}
        if(tag==='IMG'||tag==='IMAGE'){const src=node.getAttribute('src')||node.getAttribute('href')||node.getAttribute('xlink:href');const key=src&&figureFor?figureFor(src,node.getAttribute('alt')||''):null;if(key)images.push(key);return;}
        if(tag==='SUP'){const t=tidy(node.textContent);if(/^\[?\d{1,3}\]?$/.test(t)){text+=superscript(t.replace(/\D/g,''));return;}}
        for(const child of Array.from(node.childNodes||[]))walk(child,emph||EMPHASIS.has(tag));
      };
      walk(el,false);
      const clean=tidy(text);
      return {text:clean,allEmph:!!clean&&!tidy(plainText),lead:tidy(lead),images};
    }
    function blocksOf(doc,figureFor){
      const body=doc.querySelector('body')||doc.documentElement;if(!body)return {blocks:[],order:new Map()};
      const all=Array.from(body.querySelectorAll('*')),order=new Map(all.map((el,i)=>[el,i]));
      const isLeaf=el=>el.matches(LEAF)&&!el.querySelector(LEAF);
      const blocks=[];
      for(const el of all){
        if(!isLeaf(el))continue;
        if(el.closest('nav,script,style,head'))continue;
        const tag=el.tagName.toUpperCase(),{text,allEmph,lead,images}=readLeaf(el,figureFor);
        const quote=!!el.closest('blockquote');
        if(text)blocks.push({el,order:order.get(el),text,allEmph,lead,tag,quote,kind:/^H[1-6]$/.test(tag)?'heading':'text'});
        for(const key of images)blocks.push({el,order:order.get(el),text:'',kind:'figure',key,tag});
      }
      // Images that sit outside any text element (common in fixed-layout chapters).
      for(const img of Array.from(body.querySelectorAll('img,image'))){
        if(img.closest(LEAF))continue;
        const src=img.getAttribute('src')||img.getAttribute('href')||img.getAttribute('xlink:href');const key=src&&figureFor?figureFor(src,img.getAttribute('alt')||''):null;
        if(key)blocks.push({el:img,order:order.get(img),text:'',kind:'figure',key,tag:'IMG'});
      }
      blocks.sort((a,b)=>a.order-b.order);
      return {blocks,order};
    }
    function locate(doc,blocks,order,fragment){
      if(!fragment)return 0;
      let target=null;
      try{target=doc.getElementById?.(fragment)||null;}catch(_){target=null;}
      if(!target)target=Array.from(doc.querySelectorAll('[id],[name]')).find(el=>el.getAttribute('id')===fragment||el.getAttribute('name')===fragment)||null;
      if(!target)return 0;
      const owner=blocks.findIndex(b=>b.el===target||b.el.contains?.(target));
      if(owner>=0)return owner;
      const at=order.get(target);
      if(at===undefined)return 0;
      const after=blocks.findIndex(b=>b.order>=at);
      return after<0?blocks.length:after;
    }
    // A short, fully emphasized line inside running text reads as a section heading.
    function looksLikeHeading(block,previous){
      if(block.kind!=='text'||!block.allEmph)return false;
      const t=block.text;
      if(t.length>90||t.split(/\s+/).length>12||/[,;]$/.test(t)||/^[a-z]/.test(t)||CAPTION.test(t))return false;
      if(/\.$/.test(t)&&!/\b[A-Z][a-z]?\.$/.test(t))return false;
      if(previous&&previous.kind==='text'&&!TERMINAL.test(previous.text))return false;
      return true;
    }
    function runInHeading(lead,text){
      if(!lead||lead.length<3||lead.length>80||TERMINAL.test(lead)||/[,;—–-]$/.test(lead)||!text.startsWith(lead))return false;
      const words=lead.split(/\s+/);if(words.length>8)return false;
      const minor=/^(?:a|an|and|as|at|but|by|for|from|in|into|of|on|or|the|to|with|vs\.?)$/i;
      if(!words.every((w,i)=>/^[A-Z0-9“"(]/.test(w)||(i>0&&minor.test(w))))return false;
      return /^[A-Z“"]/.test(text.slice(lead.length).trim());
    }
    function joinable(prev,next,notes){
      if(notes)return !/^\d{1,3}\.\s/.test(next);
      if(/^[•▪●◦]\s/.test(next)||/^[•▪●◦]\s/.test(prev)&&/[)”"]$/.test(prev)&&/^[A-Z“"]/.test(next))return false;
      return !TERMINAL.test(prev)||/^[a-z(—–,;:]/.test(next)||/[—–]$/.test(prev);
    }
    function joinText(prev,next){
      if(/[—–]$/.test(prev)||/^[—–]/.test(next))return prev+next;
      return prev+' '+next;
    }
    function inlineNotes(text){
      // "humanity.1" or "slumbers 5 Human" in converted PDFs: printed note numbers.
      // Prices and model names ("$30,000", "SL600") keep their digits.
      return text.replace(/([A-Za-z.,;:!?”’")\]])(\d{1,3})(?=[\s“"]|$)/g,(m,a,d,at,all)=>{const before=all.slice(Math.max(0,at-2),at);return /[\d$]$/.test(before)||a==="."&&/\s$/.test(before)||/[A-Z]$/.test(before)&&/[A-Z]/.test(a)?m:a+superscript(d);}).replace(/([.!?”’])\s(\d{1,3})(?=$|\s[A-Z“"])/g,(m,a,d)=>a+superscript(d));
    }
    function fromSuperscript(s){return s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,c=>FROM_SUPERSCRIPT[c]);}

    // spine: [{path, doc}] in reading order. toc: [{path, fragment, label, depth}] in nav order.
    // figureFor(path, src, alt) returns a figure key or null. Returns {chapters, warnings}.
    function parse({spine,toc=[],figureFor=null,converted=null}){
      const docs=spine.map(({path,doc})=>{const f=figureFor?(src,alt)=>figureFor(path,src,alt):null;const {blocks,order}=blocksOf(doc,f);return {path,doc,blocks,order};});
      const texts=docs.flatMap(d=>d.blocks.filter(b=>b.kind==='text').map(b=>b.text)).filter(t=>t.length>30);
      const unfinished=texts.filter(t=>!TERMINAL.test(t)).length;
      const reflow=converted??(texts.length>40&&unfinished/texts.length>.3);
      // Link text inside the book (its own contents page) often names chapters
      // better than a converter's table of contents ("CHAPTER 1").
      const linkTexts=new Map();
      for(const d of docs)for(const a of Array.from(d.doc.querySelectorAll('a[href]'))){
        const href=a.getAttribute('href')||'';if(/^[a-z]+:/i.test(href))continue;
        const [file,frag='']=href.split('#'),path=file?resolve(d.path,file):d.path,key=path+'#'+frag,text=tidy(a.textContent);
        if(!text||text.length>160)continue;
        if(!linkTexts.has(key))linkTexts.set(key,[]);
        if(!linkTexts.get(key).includes(text))linkTexts.get(key).push(text);
      }
      const spineIndex=new Map(docs.map((d,i)=>[d.path,i]));
      const entries=toc.map((e,i)=>({...e,i,label:tidy(e.label)})).filter(e=>spineIndex.has(e.path)&&e.label);
      entries.forEach((e,i)=>{const next=entries[i+1];e.hasChildren=!!next&&next.depth>e.depth;const d=docs[spineIndex.get(e.path)];e.spine=spineIndex.get(e.path);e.block=locate(d.doc,d.blocks,d.order,e.fragment);});
      // Converters often point a chapter at the page where it begins, not at its
      // heading. When the entry's own name ("CHAPTER 3") appears a little further
      // into that file, start there so the previous chapter keeps its ending.
      entries.forEach(e=>{
        const d=docs[e.spine],key=normal(e.label);if(!key||key.length<4)return;
        const later=entries.filter(x=>x.spine===e.spine&&x.i>e.i).map(x=>x.block),limit=Math.min(d.blocks.length,e.block+120,...later.filter(b=>b>e.block));
        const here=d.blocks[e.block];if(here&&normal(here.text)===key)return;
        for(let b=e.block+1;b<limit;b++)if(d.blocks[b].kind!=='figure'&&normal(d.blocks[b].text)===key){e.block=b;break;}
      });
      // A part opener and its first chapter's heading share one section.
      entries.forEach(e=>{const next=entries.find(x=>x.i===e.i+1);if(e.hasChildren&&next&&next.spine===e.spine&&next.block>e.block){const between=docs[e.spine].blocks.slice(e.block,next.block);if(between.length<=12&&between.every(b=>b.text.length<160))next.block=e.block;}});
      entries.sort((a,b)=>a.spine-b.spine||a.block-b.block||a.i-b.i);
      const groups=[];
      for(const e of entries){const last=groups[groups.length-1];if(last&&last.spine===e.spine&&last.block===e.block)last.entries.push(e);else groups.push({spine:e.spine,block:e.block,entries:[e]});}
      const warnings=[];
      if(!groups.length){
        warnings.push('This book has no usable table of contents, so each file became a section.');
        docs.forEach((d,i)=>{if(d.blocks.length)groups.push({spine:i,block:0,entries:[{label:(d.blocks.find(b=>b.kind==='heading')||d.blocks.find(b=>b.text))?.text?.slice(0,90)||'Section '+(i+1),depth:0,hasChildren:false,path:d.path,fragment:''}]});});
      }
      const names=(e)=>linkTexts.get(e.path+'#'+(e.fragment||''))||[];
      let part=null;const chapters=[];
      groups.forEach((g,gi)=>{
        const next=groups[gi+1];
        const blocks=[];
        for(let s=g.spine;s<(next?next.spine+1:docs.length);s++){
          const from=s===g.spine?g.block:0,to=next&&s===next.spine?next.block:docs[s].blocks.length;
          blocks.push(...docs[s].blocks.slice(from,to));
        }
        const partEntry=g.entries.find(e=>e.hasChildren&&/^part\b/i.test(e.label))||(g.entries.length>1&&g.entries[0].hasChildren?g.entries[0]:null);
        const own=g.entries.filter(e=>e!==partEntry);
        const main=own[own.length-1]||partEntry;
        if(partEntry){
          const linked=[...names(partEntry),...names(main)].map(t=>t.match(/^part\s+([ivxlc\d]+|one|two|three|four|five|six|seven|eight|nine|ten)\b[\s.:—–-]*(.*)$/i)).find(Boolean);
          const generic=partEntry.label.match(GENERIC);
          const number=numberOf(linked?.[1]||generic?.[2]||'');
          let title=linked?.[2]?titleCase(tidy(linked[2])):generic?'':partEntry.label;
          if(!title){const at=blocks.findIndex(b=>normal(b.text)===normal(partEntry.label));const after=blocks[at+1];if(at>=0&&after&&after.text.length<60)title=titleCase(after.text);}
          part={depth:partEntry.depth,title:title||partEntry.label,number:Number.isInteger(number)&&number>0&&number<100?number:undefined,label:generic||linked?'Part '+(linked?.[1]||generic[2]).toUpperCase():''};
        }else if(part&&main&&main.depth<=part.depth)part=null;
        // Chapter title: the entry's label, unless it is generic ("CHAPTER 1").
        let label='',title=main.label;
        const generic=main.label.match(GENERIC);
        if(generic&&main!==partEntry){
          label=generic[1][0].toUpperCase()+generic[1].slice(1).toLowerCase()+' '+generic[2].toUpperCase();
          const linked=names(main).filter(t=>!/^part\b/i.test(t)&&normal(t)!==normal(main.label)).map(t=>t.replace(/^(?:chapter\s+)?(?:\d+|[ivxlc]+)\s*[.:)—–-]\s*/i,''))[0];
          if(linked)title=titleCase(linked);
          else{
            // A title set over several emphasized lines ("Journey to" / "Elsewhen") is one title.
            const at=blocks.findIndex(b=>normal(b.text)===normal(main.label));let words='';
            for(let k=at+1;at>=0&&k<Math.min(blocks.length,at+4);k++){const b=blocks[k];if(b.kind!=='text'||b.text.length>=90||(words&&!b.allEmph)||(words+' '+b.text).length>90)break;words=tidy(words+' '+b.text);if(!b.allEmph)break;}
            title=words?titleCase(words):label;}
        }else title=titleCase(title);
        // Remove the opening lines that only repeat the chapter or part name.
        const repeats=new Set([main.label,title,label,...g.entries.map(e=>e.label),...names(main),part?.title,part?.label,part&&part.label+' '+part.title].filter(Boolean).map(normal));
        const body=blocks.filter((b,i)=>!(i<8&&b.kind!=='figure'&&repeats.has(normal(b.text))&&blocks.slice(0,i).every(x=>x.kind==='figure'||repeats.has(normal(x.text))))).map(b=>({...b}));
        const role=REFERENCE.test(title)?'reference':ORIENTATION.test(title)?'orientation':'chapter';
        // Short lines before the first real paragraph are an epigraph (or a part's definition).
        if(role!=='reference'){
          // Book openers are often set in capitals ("THIS MUCH WE KNOW for sure").
          const opener=t=>/^[“"]?[A-Z]{2,}[A-Z’'.,-]*(?:\s+[A-Z’'.,-]{2,})+\s+[A-Za-z]/.test(t)&&t.length>40;
          let firstBody=body.findIndex(b=>b.kind==='text'&&(b.text.length>140||opener(b.text)));
          if(firstBody>0&&firstBody<=18){
            // A title broken across lines ("In the Blind Spot" / "of the Mind's Eye") is still the title.
            for(let i=0;i<firstBody;i++){
              if(body[i].kind!=='text')continue;
              let joined='';
              for(let j=i;j<Math.min(firstBody,i+4);j++){if(body[j].kind!=='text')break;joined+=body[j].text;if(repeats.has(normal(joined))){for(let k=i;k<=j;k++)body[k].kind='drop';break;}}
            }
            for(let i=0;i<firstBody;i++){const b=body[i];if(b.kind!=='text')continue;b.kind=b.tag&&/^H[1-6]$/.test(b.tag)?'heading':'quote';}
          }
        }
        const out=[];let lastText=-1;
        const notesChapter=/^(?:notes|endnotes)$/i.test(title);
        for(let i=0;i<body.length;i++){
          const b={...body[i]};
          if(b.kind==='drop')continue;
          if(b.kind==='text'&&CAPTION.test(b.text))b.kind='caption';
          // Converted PDFs often run a section heading into its first paragraph.
          if(reflow&&role!=='reference'&&b.kind==='text'&&!b.allEmph&&runInHeading(b.lead,b.text)){out.push({kind:'heading',text:b.lead});lastText=-1;b.text=b.text.slice(b.lead.length).trim();b.lead='';}
          if(b.kind==='text'&&looksLikeHeading(b,out[lastText])&&(notesChapter?/^(?:chapter|part)\s+[\divxlc]+\b|^(?:foreword|preface|introduction|prologue|afterword|epilogue|conclusion)$/i.test(b.text):role!=='reference'))b.kind='heading';
          if(reflow&&b.kind==='heading'&&/^document outline$/i.test(b.text))break;
          if(b.kind==='text'&&b.quote)b.kind='quote';
          if(b.kind==='text'&&(reflow||notesChapter)&&lastText>=0&&out.slice(lastText+1).every(x=>x.kind==='figure'||x.kind==='caption')&&joinable(out[lastText].text,b.text,notesChapter)){
            out[lastText].text=joinText(out[lastText].text,b.text);continue;
          }
          if(b.kind==='quote'&&reflow&&out.length&&out[out.length-1].kind==='quote'&&!TERMINAL.test(out[out.length-1].text)&&/^[a-z]/.test(b.text)){out[out.length-1].text=joinText(out[out.length-1].text,b.text);continue;}
          out.push(b);
          lastText=b.kind==='text'?out.length-1:b.kind==='figure'||b.kind==='caption'?lastText:-1;
        }
        const lines=out.map(b=>{
          const text=reflow&&role!=='reference'&&b.kind!=='heading'?inlineNotes(b.text):b.text;
          return b.kind==='figure'?'!['+b.key+']':b.kind==='heading'?'## '+text:b.kind==='quote'?'> '+text:b.kind==='caption'?'~ '+text:text;
        }).filter(line=>line&&line!=='## '&&line!=='> ');
        if(!lines.some(l=>structuredLine(l).kind!=='figure')&&role==='reference'&&!lines.length)return;
        if(!lines.length)return;
        chapters.push({id:'s'+chapters.length,title:title||'Section '+(chapters.length+1),...(label?{label}:{}),...(part?{partTitle:part.title,...(part.number?{partNumber:part.number}:{}),...(part.label?{partLabel:part.label}:{})}:{}),studyRole:role,text:lines.join('\n\n'),anchor:docs[g.spine].path+'#'+(main.fragment||''),firstPage:pageOf(main.fragment)});
      });
      // A converter's contents page duplicates the app's own navigation.
      const contents=chapters.findIndex(c=>/^(?:table of )?contents$/i.test(c.title));
      if(contents>=0&&chapters.length>3)chapters.splice(contents,1);
      attachNotes(chapters);
      chapters.forEach((c,i)=>{c.id='s'+i;});
      return {chapters,warnings,reflow};
    }
    const pageOf=fragment=>{const m=String(fragment||'').match(/^(?:p|page|pg)[-_]?(\d{1,4})$/i);return m?Number(m[1]):undefined;};
    // Endnotes grouped under chapter headings become a per-chapter lookup, so a
    // note number in the text can open its note in place.
    function attachNotes(chapters){
      const notesChapter=chapters.find(c=>/^(?:notes|endnotes)$/i.test(c.title));if(!notesChapter)return;
      let target=null;
      for(const line of notesChapter.text.split(/\n+/)){
        const {kind,text}=structuredLine(line);
        if(kind==='heading'){
          const name=normal(text.replace(/^(?:chapter\s+)?(?:\d+|[ivxlc]+)\s*[:.—–-]\s*/i,''));
          const number=numberOf((text.match(/^chapter\s+(\d+|[ivxlc]+)/i)||[])[1]||'');
          target=chapters.find(c=>c!==notesChapter&&normal(c.title)===name)||chapters.find(c=>Number.isInteger(number)&&c.label&&numberOf(c.label.split(/\s+/)[1])===number)||null;
          continue;
        }
        const m=kind==='text'&&text.match(/^(\d{1,3})\.\s+(.+)$/);
        if(m&&target){target.notes||={};target.notes[m[1]]=m[2];}
      }
      for(const c of chapters)if(c.notes){
        // Keep only notes actually referenced in this chapter's text.
        const used=new Set([...c.text.matchAll(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g)].map(m=>fromSuperscript(m[0])));
        for(const key of Object.keys(c.notes))if(!used.has(key)&&used.size)delete c.notes[key];
      }
    }
    // Reads a whole EPUB from a JSZip archive. parseXml/parseHtml return DOM documents.
    async function fromZip(zip,{parseXml,parseHtml,fallbackTitle='Untitled',maxFigureBytes=400*1024,maxFiguresBytes=4*1024*1024}){
      const elements=(node,name)=>Array.from(node.querySelectorAll('*')).filter(n=>(n.localName||'').replace(/^.*:/,'')===name);
      const read=async path=>{const f=zip.file(path);if(!f)throw new Error('An EPUB file is missing: '+path);return f.async('string');};
      const container=parseXml(await read('META-INF/container.xml'));const root=elements(container,'rootfile')[0];if(!root)throw new Error('The EPUB package could not be found.');
      const opfPath=root.getAttribute('full-path');const opf=parseXml(await read(opfPath));
      const metadata=elements(opf,'metadata')[0];if(!metadata)throw new Error('The EPUB metadata could not be read.');
      const title=tidy(elements(metadata,'title')[0]?.textContent)||fallbackTitle;
      const author=elements(metadata,'creator').map(x=>tidy(x.textContent)).filter(Boolean).join(', ')||'Author not listed';
      const uid=opf.documentElement.getAttribute('unique-identifier');const idNode=elements(metadata,'identifier').find(x=>x.getAttribute('id')===uid)||elements(metadata,'identifier')[0];
      let ident=tidy(idNode?.textContent).replace(/^urn:uuid:/i,'');
      if(['__proto__','constructor','prototype'].includes(ident))ident='epub-'+ident;
      const manifest=Object.fromEntries(elements(opf,'item').map(i=>[i.getAttribute('id'),{href:resolve(opfPath,i.getAttribute('href')),type:i.getAttribute('media-type')||'',properties:i.getAttribute('properties')||''}]));
      const spineItems=elements(opf,'itemref').map(i=>manifest[i.getAttribute('idref')]).filter(i=>i&&/html|xml/.test(i.type));if(!spineItems.length)throw new Error('No readable text sections were found.');
      const toc=[];
      const nav=Object.values(manifest).find(i=>i.properties.split(/\s+/).includes('nav'));const ncx=Object.values(manifest).find(i=>i.type==='application/x-dtbncx+xml');
      if(nav){const d=parseXml(await read(nav.href));const navs=elements(d,'nav');const list=navs.find(n=>Array.from(n.attributes).some(a=>a.localName==='type'&&a.value.includes('toc')))||navs[0];
        if(list)for(const a of elements(list,'a')){const href=a.getAttribute('href');if(!href||/^[a-z]+:/i.test(href))continue;let depth=0;for(let p=a.parentNode;p&&p!==list;p=p.parentNode)if(p.localName==='ol'||p.localName==='ul')depth++;const [file,fragment='']=href.split('#');toc.push({path:resolve(nav.href,file),fragment:decodeURIComponent(fragment),label:a.textContent,depth:Math.max(0,depth-1)});}}
      if(!toc.length&&ncx){const d=parseXml(await read(ncx.href));const walk=(node,depth)=>{for(const n of Array.from(node.children||[]).filter(x=>x.localName==='navPoint')){const kids=Array.from(n.children);const label=kids.find(x=>x.localName==='navLabel')?.textContent;const src=kids.find(x=>x.localName==='content')?.getAttribute('src');if(label&&src){const [file,fragment='']=src.split('#');toc.push({path:resolve(ncx.href,file),fragment:decodeURIComponent(fragment),label,depth});}walk(n,depth+1);}};const map=elements(d,'navMap')[0];if(map)walk(map,0);}
      let cover='';const metaCover=elements(metadata,'meta').find(m=>m.getAttribute('name')==='cover')?.getAttribute('content');const coverItem=manifest[metaCover]||Object.values(manifest).find(i=>i.properties.split(/\s+/).includes('cover-image'));
      if(coverItem&&/^image\/(jpeg|png|webp)$/.test(coverItem.type)){const f=zip.file(coverItem.href);if(f&&(!f._data?.uncompressedSize||f._data.uncompressedSize<2*1024*1024))cover='data:'+coverItem.type+';base64,'+await f.async('base64');}
      const byPath=new Map(Object.values(manifest).map(i=>[i.href,i]));
      const figures=new Map();let figureBytes=0;const pending=[];
      const figureFor=(docPath,src)=>{
        let path;try{path=resolve(docPath,src.split('#')[0]);}catch(_){return null;}
        const item=byPath.get(path),file=zip.file(path);
        if(!item||!file||!/^image\/(jpeg|png|webp|gif)$/.test(item.type)||item===coverItem)return null;
        const size=file._data?.uncompressedSize||0;
        if(size&&size<3000)return null;
        if(size>maxFigureBytes)return null;
        const key='f'+path.replace(/\.[a-z]+$/i,'').replace(/[^a-zA-Z0-9-]+/g,'-').slice(-40);
        if(!figures.has(key)){figures.set(key,null);pending.push({key,file,type:item.type,size});}
        return key;
      };
      const spine=[];
      for(const item of spineItems)spine.push({path:item.href,doc:parseHtml(await read(item.href))});
      const generator=spine.map(s=>s.doc.querySelector('meta[name="generator"]')?.getAttribute('content')||'').join(' ');
      const fromPdf=/pdftohtml|pdf2htmlex/i.test(generator);
      const result=parse({spine,toc,figureFor,converted:fromPdf?true:null});
      const used=new Set(result.chapters.flatMap(c=>[...c.text.matchAll(/^!\[([\w.-]+)\]$/gm)].map(m=>m[1])));
      for(const f of pending){
        if(!used.has(f.key))continue;
        if(figureBytes+f.size>maxFiguresBytes){result.warnings.push('Some figures were left out to keep the book small.');used.delete(f.key);continue;}
        figureBytes+=f.size;figures.set(f.key,'data:'+(f.type==='image/gif'?'image/gif':f.type)+';base64,'+await f.file.async('base64'));
      }
      for(const c of result.chapters){
        const keys=[...c.text.matchAll(/^!\[([\w.-]+)\]$/gm)].map(m=>m[1]);
        c.text=c.text.split(/\n\n/).filter(line=>{const m=line.match(/^!\[([\w.-]+)\]$/);return !m||figures.get(m[1]);}).join('\n\n');
        const own=keys.filter(k=>figures.get(k));
        if(own.length)c.figures=Object.fromEntries(own.map(k=>[k,figures.get(k)]));
        // A PDF conversion's page anchors are the printed edition's page numbers.
        if(fromPdf&&c.firstPage)c.sourcePageStart=c.firstPage;
        delete c.anchor;delete c.firstPage;
      }
      if(!result.chapters.length)throw new Error('This EPUB has no readable text. It may be an image-only or protected edition.');
      return {ident,title,author,cover,chapters:result.chapters,warnings:result.warnings,reflow:result.reflow};
    }
    function resolve(base,href){const u=new URL(href,'https://epub.invalid/'+base);return decodeURIComponent(u.pathname.slice(1));}
    // Paragraph text without structural markers; figures carry no words.
    function plainLines(text){return String(text||'').split(/\n+/).map(l=>l.trim()).filter(Boolean).map(structuredLine).filter(b=>b.kind!=='figure').map(b=>b.text);}
    return {parse,fromZip,structuredLine,plainLines,superscript,fromSuperscript,titleCase};
  })();
