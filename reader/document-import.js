  // Local files are parsed on the device. Only their extracted reading text is saved.
  let documentImportCorePromise=null,documentPdfPromise=null;
  const documentImportCore=()=>documentImportCorePromise||(documentImportCorePromise=import('/vendor/document-import-core.mjs').catch(error=>{documentImportCorePromise=null;throw error;}));
  const documentPdfLibrary=()=>documentPdfPromise||(documentPdfPromise=import('/vendor/pdfjs/pdf.min.mjs').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.mjs';return pdf;}).catch(error=>{documentPdfPromise=null;throw error;}));
  function documentXml(source){
    if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('This document uses unsupported XML entities. Export a clean DOCX or text file.');
    const xml=new DOMParser().parseFromString(source,'application/xml');
    if(xml.getElementsByTagName('parsererror').length)throw new Error('The DOCX contains invalid document XML.');return xml;
  }
  function documentXmlNodes(node,name){return [...node.getElementsByTagName(name)];}
  function documentWordText(paragraph){
    const output=[];
    const walk=node=>{
      if(node.nodeType!==1)return;
      if(['w:del','w:moveFrom','w:instrText'].includes(node.nodeName))return;
      if(node.nodeName==='w:t'){output.push(node.textContent||'');return;}
      if(node.nodeName==='w:tab'){output.push(' | ');return;}
      if(['w:br','w:cr'].includes(node.nodeName)){output.push('\n');return;}
      for(const child of node.childNodes)walk(child);
    };walk(paragraph);return output.join('').trim();
  }
  async function documentDocxSections(file,core){
    if(typeof JSZip==='undefined')throw new Error('The document reader has not loaded. Refresh and try again.');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    if(Object.keys(zip.files).length>10000)throw new Error('This DOCX contains too many archive entries.');
    const readXml=async name=>{
      const entry=zip.file(name);if(!entry)return null;
      if(entry._data?.uncompressedSize>16*1024*1024)throw new Error('The DOCX text exceeds the extraction limit.');
      const content=await entry.async('string');if(new TextEncoder().encode(content).length>16*1024*1024)throw new Error('The DOCX text exceeds the extraction limit.');
      return documentXml(content);
    };
    const xml=await readXml('word/document.xml');if(!xml)throw new Error('Choose a valid DOCX document. Older .doc files need conversion to DOCX.');
    const metadata=await readXml('docProps/core.xml');
    const metaTitle=core.cleanDocumentText(metadata?.getElementsByTagName('dc:title')[0]?.textContent);
    const metaAuthor=core.cleanDocumentText(metadata?.getElementsByTagName('dc:creator')[0]?.textContent||'');
    const author=core.isWeakAuthor(metaAuthor)?'':metaAuthor;
    let title=metaTitle||core.documentFileTitle(file.name),styledTitle='';
    const sections=[];let heading=title,body=[];
    const finish=()=>{if(body.length)sections.push({title:heading,text:body.join('\n\n')});body=[];};
    // Keep table rows together so a statistic stays beside its outcome and
    // comparator. Merged cells remain explicit instead of guessing alignment.
    const walkContent=node=>{
      if(['w:del','w:moveFrom'].includes(node.nodeName))return;
      if(node.nodeName==='w:tbl'){
        const rows=[...node.children].filter(n=>n.nodeName==='w:tr').map(row=>[...row.children].filter(n=>n.nodeName==='w:tc').map(cell=>{
          const text=documentXmlNodes(cell,'w:p').map(documentWordText).filter(Boolean).join(' / ');
          const span=cell.getElementsByTagName('w:gridSpan')[0]?.getAttribute('w:val');
          const merged=cell.getElementsByTagName('w:vMerge').length>0;
          return text+(span&&span!=='1'||merged?' [merged cell; check original layout]':'');
        }).join(' | ')).filter(Boolean);
        if(rows.length)body.push('[Table rows; columns separated by |]\n'+rows.join('\n'));
        return;
      }
      if(node.nodeName==='w:p'){
        const text=documentWordText(node);if(!text)return;
        const style=node.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val')||'';
        if(/^title$/i.test(style)&&!styledTitle){styledTitle=text;return;}
        if(/^(?:heading[1-3]|title)$/i.test(style)){finish();heading=text;}else body.push(text);
        return;
      }
      for(const child of node.children||[])walkContent(child);
    };
    walkContent(xml.documentElement);
    finish();
    for(const [path,tag,label] of [['word/footnotes.xml','w:footnote','Footnotes'],['word/endnotes.xml','w:endnote','Endnotes']]){
      const notes=await readXml(path);if(!notes)continue;
      const text=documentXmlNodes(notes,tag).filter(n=>Number(n.getAttribute('w:id'))>=0&&!n.getAttribute('w:type')).map(n=>documentXmlNodes(n,'w:p').map(documentWordText).filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
      if(text)sections.push({title:label,text});
    }
    // The document's Title paragraph beats metadata like "Microsoft Word - draft3.docx".
    const chosen=core.pickTitle(metaTitle,styledTitle,core.documentFileTitle(file.name));
    for(const section of sections)if(section.title===title)section.title=chosen;
    title=chosen;
    return {title,author,sections,importWarnings:['Imported DOCX text includes paragraphs and notes. Images, complex table layout, and formatting may need checking against the original.']};
  }
  function documentPdfLines(items){
    const lines=[];let line=null;
    const finish=()=>{if(line?.text.trim())lines.push(line);line=null;};
    for(const item of items){
      if(typeof item.str!=='string')continue;
      const x=item.transform?.[4],y=item.transform?.[5],height=Math.abs(item.height)||Math.hypot(item.transform?.[2]||0,item.transform?.[3]||0)||12;
      if(line&&Number.isFinite(y)&&Number.isFinite(line.y)&&Math.abs(y-line.y)>Math.max(3,height*.35))finish();
      if(!line)line={text:'',x,y,height,endX:null,columns:false,font:'',chars:{}};
      if(item.str){
        const gap=Number.isFinite(x)&&Number.isFinite(line.endX)?x-line.endX:null;
        if(line.text&&!/\s$/.test(line.text)&&!/^\s/.test(item.str)){
          if(gap!==null&&gap>Math.max(24,height*3)){line.text+=' | ';line.columns=true;}
          else if(gap===null||gap>height*.12)line.text+=' ';
        }
        line.text+=item.str;line.height=Math.max(line.height,height);
        if(item.fontName&&item.str.trim()){if(!line.font)line.font=item.fontName;line.chars[item.fontName]=(line.chars[item.fontName]||0)+item.str.length;}
        line.endX=Number.isFinite(x)&&Number.isFinite(item.width)?x+item.width:null;
      }
      if(item.hasEOL)finish();
    }
    finish();return lines;
  }
  // Journal PDFs mark paragraphs with an indent or a short last line, and set
  // headings on their own line in another font. Keep those breaks so the reader
  // shows paragraphs and sections instead of one block per column.
  function documentPdfJoin(lines,core,{headings=false}={}){
    const fontChars={};for(const l of lines)for(const [f,n] of Object.entries(l.chars||{}))fontChars[f]=(fontChars[f]||0)+n;
    const bodyFont=Object.entries(fontChars).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
    const bodyHeights=lines.filter(l=>l.font===bodyFont).map(l=>l.height).sort((a,b)=>a-b),bodyHeight=bodyHeights[bodyHeights.length>>1]||12;
    const columnRight=l=>{let right=-Infinity;for(const o of lines)if(Number.isFinite(o.x)&&Number.isFinite(o.endX)&&Math.abs(o.x-l.x)<=Math.max(18,l.height*1.6))right=Math.max(right,o.endX);return right;};
    const isShort=l=>Number.isFinite(l.endX)&&Number.isFinite(columnRight(l))&&l.endX<columnRight(l)-Math.max(20,l.height*2.5);
    const isHeading=l=>{
      const t=l.text.trim();if(t.length>80||t.length<3||l.columns||/[.,;]$/.test(t)||/^\d+(?:[.,]\d+)?$/.test(t))return false;
      const letters=t.replace(/[^A-Za-z]/g,'');
      if(letters.length>=4&&letters===letters.toUpperCase()&&/^[A-Z]/.test(t)&&!/,/.test(t)&&t.split(/\s+/).length<=6)return true;
      return !!bodyFont&&l.font&&l.font!==bodyFont&&Object.keys(l.chars||{}).length===1&&isShort(l)&&/^[A-Z0-9]/.test(t);
    };
    let text='';
    for(let index=0;index<lines.length;index++){
      const current=lines[index],previous=lines[index-1];
      // A title or heading that wraps continues on the next line in the same type.
      const wrapped=previous&&previous.font&&previous.font===current.font&&Math.abs(previous.height-current.height)<.5&&previous.font!==bodyFont&&!/[.?!:]$/.test(previous.text.trim())&&previous.y-current.y>0&&previous.y-current.y<=current.height*1.65&&(!isShort(previous)||previous.height>=bodyHeight*1.3);
      const heading=!wrapped&&isHeading(current);
      if(wrapped){text+=' '+current.text.trim();continue;}
      if(previous){
        const height=Math.max(previous.height,current.height),drop=previous.y-current.y;
        const sameColumn=Number.isFinite(previous.x)&&Number.isFinite(current.x)&&Math.abs(previous.x-current.x)<=Math.max(12,height*.9);
        const fontChange=Math.max(previous.height,current.height)>Math.min(previous.height,current.height)*1.15;
        const listStart=/^\s*(?:[•*\-]\s|\d{1,3}[.)]\s)/.test(current.text);
        const indented=Number.isFinite(previous.x)&&Number.isFinite(current.x)&&current.x-previous.x>=Math.max(4,height*.6);
        const ended=/[.?!:"”’)\]]$/.test(previous.text.trim())&&isShort(previous);
        // The left column's last sentence runs on at the top of the right column.
        const columnJump=Number.isFinite(drop)&&drop<0&&Number.isFinite(previous.x)&&Number.isFinite(current.x)&&current.x-previous.x>height*8&&!/[.?!:"”’)\]]$/.test(previous.text.trim())&&/^[a-z(]/.test(current.text.trim())&&!fontChange&&!previous.columns&&!current.columns;
        const continuation=columnJump||sameColumn&&Number.isFinite(drop)&&drop>0&&drop<=height*1.65&&!fontChange&&!previous.columns&&!current.columns&&!listStart&&!indented&&!ended&&!heading&&!isHeading(previous);
        // A word split across lines keeps its hyphen but loses the gap: "intermit-tent", "test-retest".
        text+=continuation?(/[A-Za-z]-$/.test(text)&&/^[a-z]/.test(current.text.trim())?'':' '):'\n\n';
      }
      text+=(heading&&headings?'## ':'')+current.text.trim();
    }
    return core.cleanDocumentText(text);
  }
  function documentPdfText(items,core,out,options){
    const lines=documentPdfLines(items);if(out)out.lines=lines;
    return documentPdfJoin(lines,core,options);
  }
  // Running heads, footers, page numbers and typesetting codes repeat in the page
  // margins. They are dropped so a sentence can run on from one page to the next.
  function documentPdfDropRunningLines(pages){
    const key=l=>l.text.trim().toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ');
    const edge=(l,box)=>{const h=box[3]-box[1];return Number.isFinite(l.y)&&h>0&&(l.y>box[3]-h*.09||l.y<box[1]+h*.09);};
    const seen=new Map();
    for(const {lines,box} of pages)for(const k of new Set(lines.filter(l=>edge(l,box)).map(key)))seen.set(k,(seen.get(k)||0)+1);
    const repeats=pages.length>=2?2:Infinity;
    for(const page of pages)page.lines=page.lines.filter(l=>{
      const t=l.text.trim();
      if(/^[A-Z]{2,8}[-_ ]?\d{2}[-_ ]?\d{3,6}\s+\d+\.\.\d+$/.test(t))return false;
      if(!edge(l,page.box))return true;
      return !(/^(?:page\s*)?\d{1,4}$/i.test(t)||seen.get(key(l))>=repeats);
    });
    return pages;
  }
  async function documentPdfSections(file,core,onProgress,{headings=false}={}){
    const pdf=await documentPdfLibrary();
    const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,useWorkerFetch:false,useWasm:false,disableAutoFetch:true,disableStream:true,disableFontFace:true,enableXfa:false,stopAtErrors:true,isEvalSupported:false});
    let document;
    try{
      document=await task.promise;
      if(document.numPages>2000)throw new Error('This PDF has more than 2,000 pages. Split it into smaller files.');
      const meta=await document.getMetadata().catch(()=>({})),sections=[],pages=[];let empty=0,bytes=0,firstLines=null;
      for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
        onProgress?.(`Reading PDF page ${pageNumber} of ${document.numPages}…`);
        const page=await document.getPage(pageNumber),content=await page.getTextContent(),lines=documentPdfLines(content.items);
        if(!firstLines&&lines.length>1)firstLines=lines;
        bytes+=lines.reduce((n,l)=>n+l.text.length,0);page.cleanup();
        if(bytes>core.DOCUMENT_TEXT_LIMIT)throw new Error('This PDF exceeds the 12 MB extracted-text limit.');
        pages.push({pageNumber,lines,box:Array.isArray(page.view)&&page.view.length===4?page.view:[0,0,612,792]});
      }
      for(const {pageNumber,lines} of documentPdfDropRunningLines(pages)){
        const text=documentPdfJoin(lines,core,{headings});
        if(text.replace(/\s/g,'').length<5){empty++;continue;}
        sections.push({title:`Page ${pageNumber}`,text,sourcePageStart:pageNumber,sourcePageEnd:pageNumber});
      }
      // A paragraph that runs over a page break continues on the next page.
      for(let i=1;i<sections.length;i++){
        const prev=sections[i-1],next=sections[i],first=next.text.split(/\n\n/)[0];
        if(/[.?!:"”’)\]]$/.test(prev.text)||!/^[a-z(]/.test(first)||prev.sourcePageEnd!==next.sourcePageStart-1)continue;
        prev.text+=(/[A-Za-z]-$/.test(prev.text)?'':' ')+first;
        next.text=next.text.slice(first.length).replace(/^\n+/,'');
      }
      for(let i=sections.length-1;i>=0;i--)if(sections[i].text.replace(/\s/g,'').length<5)sections.splice(i,1);
      if(!sections.length)throw new Error('This PDF has no readable text. Use a text-based PDF or an OCR version; read. does not OCR scanned pages.');
      // Embedded PDF titles are often typesetting codes, so the first page's headline wins when they are.
      const metaTitle=core.cleanDocumentText(meta.info?.Title||meta.metadata?.get?.('dc:title')||''),pageTitle=firstLines?core.pdfTitleFromLines(firstLines):'';
      const title=core.pickTitle(metaTitle,pageTitle,core.documentFileTitle(file.name));
      const metaAuthor=core.cleanDocumentText(meta.info?.Author||'');
      const author=!core.isWeakAuthor(metaAuthor)?metaAuthor:firstLines?core.pdfAuthorFromLines(firstLines,pageTitle||title):'';
      // The reader shows the title and authors above the text, so their first-page lines are not repeated in it.
      if(headings&&sections[0]){
        const same=(a,b)=>core.cleanDocumentText(a).replace(/^## /,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()===String(b||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
        const parts=sections[0].text.split(/\n\n/);let i=0;
        while(i<Math.min(parts.length-1,6)&&(same(parts[i],title)||(author&&same(parts[i],author))||(pageTitle&&same(parts[i],pageTitle))))i++;
        if(i)sections[0].text=parts.slice(i).join('\n\n');
      }
      return {title,author,sections,
        importWarnings:['Text extracted from PDF. Figures, equations, tables, and reading order may need checking against the original.',...(empty?[`${empty} of ${document.numPages} pages had no extractable text. Their content is not included.`]:[])]};
    }catch(error){if(error?.name==='PasswordException')throw new Error('This PDF is password protected. Unlock it on your device and upload an authorized copy.');throw error;}
    finally{await task.destroy();}
  }
  async function readImportedDocument(file,{sourceType='article',onProgress}={}){
    if(!file)throw new Error('Choose a document to import.');
    if(file.size>60*1024*1024)throw new Error('Choose a document under 60 MB.');
    const extension=(file.name||'').split('.').pop().toLowerCase(),format={pdf:'PDF',docx:'DOCX',txt:'TXT',md:'MD',markdown:'MD'}[extension];
    if(!format)throw new Error('Choose a PDF, DOCX, TXT, or Markdown file.');
    const core=await documentImportCore();let parsed;
    if(format==='PDF'){
      parsed=await documentPdfSections(file,core,onProgress,{headings:sourceType==='article'});
      if(sourceType==='book')parsed.sections=core.groupPdfPages(parsed.sections);
    }
    else if(format==='DOCX')parsed=await documentDocxSections(file,core);
    else{
      if(file.size>core.DOCUMENT_TEXT_LIMIT)throw new Error('Choose a text document under 12 MB.');
      const buffer=await file.arrayBuffer();let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw new Error('Save this text file as UTF-8, then import it again.');}
      const heading=text.match(/^\s*#\s+(.{3,300}?)\s*#*\s*$/m)?.[1];
      parsed={title:core.pickTitle(core.documentFileTitle(file.name),heading),text};
    }
    return core.normalizeImportedText({...parsed,sourceFormat:format,sourceType});
  }
