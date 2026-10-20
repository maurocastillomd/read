/** Shared normalization for local documents and publicly readable articles. */
export const DOCUMENT_TEXT_LIMIT = 12 * 1024 * 1024;
const FORMATS = new Set(['EPUB','PDF','DOCX','TXT','MD','HTML']);
const textBytes = text => new TextEncoder().encode(text).length;
export function cleanDocumentText(value) {
  return String(value ?? '').replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/[\t \f\v\u00a0]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function documentFileTitle(name) {
  return String(name || 'Untitled document').replace(/\.(?:pdf|docx|txt|md|markdown)$/i,'').replace(/[_]+/g,' ').trim().slice(0,2000) || 'Untitled document';
}
// Titles: embedded metadata is often a typesetting code ("JSX-01-0001 1716..1722"),
// a Word file name, or a site suffix. These helpers pick the reader-facing title.
const SMALL_WORDS=new Set(['a','an','and','as','at','but','by','for','from','in','into','nor','of','on','or','per','the','to','vs','via','with']);
export function titleCaseIfShouting(value){
  const text=String(value||'');
  const letters=text.replace(/[^A-Za-z]/g,'');
  if(letters.length<6||letters!==letters.toUpperCase())return text;
  return text.toLowerCase().replace(/[a-z][a-z'’]*/g,(word,offset)=>offset>0&&SMALL_WORDS.has(word)&&!/[:—-]\s*$/.test(text.slice(0,offset))?word:word[0].toUpperCase()+word.slice(1));
}
export function cleanTitle(value){
  let title=cleanDocumentText(value).replace(/\n+/g,' ');
  title=title.replace(/^microsoft (?:word|powerpoint)\s*-\s*/i,'').replace(/_+/g,' ').replace(/\.(?:pdf|docx?|rtf|txt|md|markdown|tex|indd|qxd|epub)$/i,'');
  title=title.replace(/\s+[|]\s+[^|]{1,80}$/,'').replace(/\s+[-–—]\s+(?:PubMed|PMC|NCBI|ScienceDirect|Wikipedia|ResearchGate|Google Scholar|Semantic Scholar|SpringerLink|Wiley Online Library|Taylor & Francis Online|JSTOR|Medium|Substack)\s*$/i,'');
  title=title.replace(/^["'“”‘’\s]+/,'').replace(/[\s"'“”‘’,;:]+$/,'').replace(/(?<![.\s][A-Z])\.$/,'').trim();
  return titleCaseIfShouting(title).slice(0,2000);
}
export function isWeakTitle(value){
  const title=cleanDocumentText(value);
  if(!title)return true;
  if(/^(?:untitled|document\d*|title|manuscript|paper|article|layout \d+|new document|draft|final|untitled document)$/i.test(title))return true;
  if(/^microsoft (?:word|powerpoint)\s*-|\.(?:pdf|docx?|rtf|tex|indd|qxd|epub)$/i.test(title))return true;
  if(/\d\.\.\d|^doi[:\s]|^10\.\d{4,}\//i.test(title))return true;
  const words=title.match(/[A-Za-z][A-Za-z'’]{2,}/g)||[];
  if(!words.length)return true;
  // A code made of digits and one stray word, e.g. "JSX-01-0001 1716" or "ms_2023_0412".
  return /\d/.test(title)&&words.length<2;
}
export function pickTitle(...candidates){
  for(const candidate of candidates){const title=cleanTitle(candidate);if(title&&!isWeakTitle(title))return title;}
  for(const candidate of candidates){const title=cleanTitle(candidate);if(title)return title;}
  return 'Untitled document';
}
const NOT_A_TITLE=/(?:\bdoi\b|https?:|www\.|©|\bcopyright\b|\bjournal of\b|\bvol(?:ume)?\.?\s*\d|\bissue\b|\bpp?\.\s*\d|\breceived\b|\baccepted\b|\bpublished\b|\bissn\b|\bcorrespond|\bdownloaded from\b|\ball rights reserved\b|^(?:original (?:research|investigation|article)|research (?:article|paper|note)|review(?: article)?|brief report|case report|abstract|keywords?|article|open access)$)/i;
// The title on a PDF's first page is the largest text near the top that is not a
// journal header. Lines carry pdf.js font heights.
export function pdfTitleFromLines(lines=[]){
  const usable=lines.map((line,index)=>({...line,index,text:cleanDocumentText(line.text).replace(/\s*\|\s*/g,' ')})).filter(line=>line.text&&Number.isFinite(line.height));
  if(usable.length<2)return '';
  const heights=usable.map(l=>l.height).sort((a,b)=>a-b),body=heights[Math.floor(heights.length/2)];
  const candidates=usable.filter(l=>l.text.length>=8&&l.text.length<=300&&!NOT_A_TITLE.test(l.text)&&(l.text.match(/[A-Za-z]{2,}/g)||[]).length>=2&&!/^[\d\s.,:;()\-–]+$/.test(l.text));
  if(!candidates.length)return '';
  const largest=Math.max(...candidates.map(l=>l.height));
  if(largest<body*1.15)return '';
  const first=candidates.find(l=>l.height>=largest*.94),parts=[first.text];
  for(let i=first.index+1;i<usable.length&&parts.length<4;i++){
    const next=usable[i];
    if(Math.abs(next.height-first.height)>first.height*.08||NOT_A_TITLE.test(next.text))break;
    parts.push(next.text);
  }
  const title=parts.join(' ').replace(/\s+([:,])/g,'$1').replace(/(\w)- (\w)/g,'$1$2').replace(/[*†‡§¶]+|\s\d{1,2}(?:,\d{1,2})*$/g,'').trim();
  return title.length>=8?cleanTitle(title):'';
}
// Authors usually sit on the line(s) just under the title in a smaller font.
export function pdfAuthorFromLines(lines=[],title=''){
  const usable=lines.map(line=>({...line,text:cleanDocumentText(line.text).replace(/\s*\|\s*/g,' ')})).filter(line=>line.text);
  const key=s=>String(s).toLowerCase().replace(/[^a-z]/g,'');
  const end=title?usable.findIndex(l=>key(title).includes(key(l.text))&&key(l.text).length>3):-1;
  if(end<0)return '';
  let last=end;while(last+1<usable.length&&key(title).includes(key(usable[last+1].text))&&key(usable[last+1].text).length>3)last++;
  for(const line of usable.slice(last+1,last+3)){
    const text=line.text.replace(/[*†‡§¶#]+/g,'').replace(/(?<=[A-Za-z.,])\s?\d{1,2}(?:\s?,\s?\d{1,2})*(?=[\s,]|$)/g,'').replace(/\s+,/g,',').trim();
    const names=text.split(/\s*(?:,|;|\band\b|&)\s*/).filter(Boolean);
    const nameLike=n=>/^(?:[A-Z][A-Za-zÀ-ÿ'’.-]*\.?\s+){1,4}[A-Z][A-Za-zÀ-ÿ'’-]+$/.test(n)||/^[A-Z][A-Za-zÀ-ÿ'’-]+\s+[A-Z]{1,3}$/.test(n);
    if(names.length&&names.length<=30&&names.every(n=>nameLike(n)||/^(?:MD|PhD|MS|MSc|CSCS|DPT|ATC|RD|MPH|MA|BS|BSc|PT|RN)$/.test(n))&&names.some(nameLike))return names.filter(nameLike).join(', ').slice(0,2000);
  }
  return '';
}
export function isWeakAuthor(value){
  const author=cleanDocumentText(value);
  return !author||/@|\d|^(?:admin|administrator|user|owner|author|unknown|anonymous|editor|staff|default|windows user|microsoft office user)$/i.test(author)||/^[a-z0-9._-]+$/.test(author);
}
export function splitDocumentSections(text, title='Document') {
  const lines=cleanDocumentText(text).split('\n'),sections=[];let heading=title,body=[];
  const finish=()=>{const content=body.join('\n').trim();if(content)sections.push({title:heading,text:content});body=[];};
  for(const line of lines){
    const match=line.match(/^#{1,2}\s+(.{1,180}?)\s*#*$/) || line.match(/^(Chapter\s+(?:\d+|[IVXLCDM]+)(?:[.:\s].{0,160})?)$/i);
    if(match){finish();heading=match[1].trim();}else body.push(line);
  }
  finish();return sections;
}
// PDF pages are extraction boundaries, not chapters. Group complete pages into
// readable sections without guessing chapter titles or dropping page content.
export function groupPdfPages(pages,{maxChars=12000}={}) {
  const sections=[];let group=[],length=0;
  const finish=()=>{
    if(!group.length)return;
    const start=group[0].sourcePageStart,end=group.at(-1).sourcePageEnd;
    sections.push({title:start===end?`Page ${start}`:`Pages ${start}–${end}`,text:group.map(p=>p.text).join('\n\n'),sourcePageStart:start,sourcePageEnd:end});
    group=[];length=0;
  };
  for(const page of pages){
    if(group.length&&length+2+page.text.length>maxChars)finish();
    group.push(page);length+=page.text.length+(group.length>1?2:0);
  }
  finish();return sections;
}
// Standard research-paper section names on a line of their own become headings,
// so PDFs and plain-text papers show their structure like a web article does.
const RESEARCH_HEADING=/^(?:(?:\d{1,2}|[IVX]{1,4})\.?\s+)?(abstract|introduction|background|aims?|objectives?|purpose|hypothes[ie]s|methods?|materials and methods|methods and materials|methodology|participants|subjects|study design|design|procedures?|protocol|interventions?|measures|measurements|outcome measures|data collection|statistical analys[ie]s|data analysis|analysis|results|findings|discussion|limitations|strengths and limitations|study limitations|conclusions?|summary|practical applications|practical implications|clinical implications|implications|future directions|key points|highlights|references|bibliography|acknowledg(?:e)?ments|funding|conflicts? of interest|competing interests|declarations?|author contributions|data availability|supplementary (?:material|information)|appendix)\s*:?$/i;
export function markResearchHeadings(text){
  return String(text).split('\n').map(line=>{
    const t=line.trim();
    return t.length<=60&&!/^(?:## |> |~ )/.test(t)&&RESEARCH_HEADING.test(t)?'## '+t.replace(/\s*:$/,''):line;
  }).join('\n');
}
export async function normalizeImportedText({text='',title='Untitled document',author='',sourceFormat='TXT',sourceType='article',sourceUrl,sections,importWarnings=[]}={}) {
  if(!FORMATS.has(sourceFormat))throw new Error('Unsupported document format.');
  if(!['book','article'].includes(sourceType))throw new Error('Choose Book or Article as the reading type.');
  title=cleanTitle(title) || 'Untitled document';
  author=cleanDocumentText(author).replace(/\n/g,' ').slice(0,2000);
  if(sourceUrl){const url=new URL(sourceUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Source links must be public HTTP or HTTPS URLs without credentials.');url.hash='';sourceUrl=url.href;}
  // An article's own text keeps every heading in place, even one with no body of its own.
  const articleText=()=>[{title,text:cleanDocumentText(text).replace(/^#{1,6}[ \t]+(.+?)[ \t]*#*$/gm,'## $1')}];
  const parts=(Array.isArray(sections)?sections:sourceType==='article'?articleText():splitDocumentSections(text,title)).map((section,index)=>({
    title:cleanDocumentText(section.title || `Section ${index+1}`).replace(/\n/g,' ').slice(0,3000),text:cleanDocumentText(section.text),
    ...(Number.isSafeInteger(section.sourcePageStart)&&section.sourcePageStart>0?{sourcePageStart:section.sourcePageStart}:{}),
    ...(Number.isSafeInteger(section.sourcePageEnd)&&section.sourcePageEnd>0?{sourcePageEnd:section.sourcePageEnd}:{}),
  })).filter(section=>section.text);
  if(!parts.length||parts.reduce((n,p)=>n+p.text.replace(/\s/g,'').length,0)<20)throw new Error('No readable text was found. Scanned or image-only documents need a text/OCR version.');
  if(parts.length>5000)throw new Error('This document has too many sections. Split it into smaller files.');
  if(parts.reduce((n,p)=>n+textBytes(p.text),0)>DOCUMENT_TEXT_LIMIT)throw new Error('This document exceeds the 12 MB extracted-text limit.');
  // An article reads as one page. Its section titles stay as headings; PDF page
  // numbers are extraction boundaries and are left out.
  const articleHeading=p=>p.title&&p.title!==title&&!/^Pages? \d+(?:–\d+)?$/.test(p.title)?'## '+p.title+'\n\n':'';
  const normalized=sourceType==='article'?[{title,text:markResearchHeadings(parts.map(p=>articleHeading(p)+p.text).join('\n\n')),
    ...(parts[0].sourcePageStart?{sourcePageStart:parts[0].sourcePageStart}:{}),...(parts.at(-1).sourcePageEnd?{sourcePageEnd:parts.at(-1).sourcePageEnd}:{})}]:parts;
  const chapters=normalized.map((p,i)=>({id:`section-${i+1}`,...p}));
  if(chapters.reduce((n,p)=>n+textBytes(p.text),0)>DOCUMENT_TEXT_LIMIT)throw new Error('This document exceeds the 12 MB extracted-text limit.');
  const identity=JSON.stringify({title,author,sourceType,chapters});
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
  const id='document-'+[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
  return {id,title,fullTitle:title,author,cover:'',chapters,sourceFormat,sourceType,...(sourceUrl?{sourceUrl}:{}),
    ...(importWarnings.length?{importWarnings:importWarnings.map(cleanDocumentText).filter(Boolean).slice(0,6).map(s=>s.slice(0,600))}:{})};
}
