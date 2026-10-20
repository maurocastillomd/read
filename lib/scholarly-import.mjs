// Research links (DOI, PubMed, PubMed Central) resolve through Europe PMC's free
// public API. Open-access papers arrive as structured full text with their own
// sections, so the breakdown can find the methods, results and limitations.
import {DOMParser,parseHTML} from 'linkedom';
import {cleanDocumentText} from './document-import-core.mjs';

const EPMC='https://www.ebi.ac.uk/europepmc/webservices/rest';
export const SCHOLARLY_XML_LIMIT=6*1024*1024;
const DOI=/\b(10\.\d{4,9}\/[^\s"'<>?#]+)/i;

/** Finds a DOI, PubMed ID or PMC ID in what the reader pasted. Returns null for ordinary links. */
export function scholarlyId(input){
  const raw=String(input||'').trim();if(!raw||raw.length>4000)return null;
  const pmc=raw.match(/\b(PMC\d{4,10})\b/i);
  if(pmc&&(/^PMC\d+$/i.test(raw)||/(?:ncbi\.nlm\.nih\.gov|europepmc\.org)/i.test(raw)))return {pmcid:pmc[1].toUpperCase()};
  const pubmed=raw.match(/^(?:https?:\/\/)?(?:www\.)?pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,9})\b/i)||raw.match(/^(?:https?:\/\/)?(?:www\.)?ncbi\.nlm\.nih\.gov\/pubmed\/(\d{1,9})\b/i)||raw.match(/^(?:https?:\/\/)?europepmc\.org\/(?:article|abstract)\/MED\/(\d{1,9})\b/i)||raw.match(/^(?:PMID:?\s*)(\d{1,9})$/i);
  if(pubmed)return {pmid:pubmed[1]};
  let decoded=raw;try{decoded=decodeURIComponent(raw);}catch{/* keep the raw text */}
  const doi=decoded.match(DOI);
  if(!doi)return null;
  // Strip punctuation a sentence or a publisher path can leave on the end.
  const value=doi[1].replace(/(?:\/(?:full|abstract|pdf|epdf|html|meta|references|figures|suppl(?:ementary)?)(?:\/.*)?|[.,;:)\]]+)$/i,'');
  const isDoiLink=/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\./i.test(raw);
  return {doi:value,...(isDoiLink?{bare:true}:{})};
}

async function epmcFetch(path,fetchImpl,limit,accept){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetchImpl(EPMC+path,{headers:{Accept:accept,'User-Agent':'read-article-import/1.0'},redirect:'manual',signal:controller.signal});
    if(!response.ok){void response.body?.cancel().catch(()=>{});return null;}
    if(Number(response.headers.get('content-length'))>limit){void response.body?.cancel().catch(()=>{});return null;}
    const text=await response.text();
    return new TextEncoder().encode(text).length>limit?null:text;
  }catch{return null;}
  finally{clearTimeout(timer);}
}

/** One Europe PMC record for the identifier, or null when the paper is not indexed. */
export async function findScholarlyRecord(id,{fetchImpl=fetch}={}){
  const query=id.pmcid?`PMCID:${id.pmcid}`:id.pmid?`EXT_ID:${id.pmid} AND SRC:MED`:`DOI:"${id.doi.replace(/"/g,'')}"`;
  const text=await epmcFetch(`/search?query=${encodeURIComponent(query)}&resultType=core&format=json&pageSize=1`,fetchImpl,512*1024,'application/json');
  if(!text)return null;
  try{return JSON.parse(text)?.resultList?.result?.[0]||null;}catch{return null;}
}

const nodeText=node=>cleanDocumentText(node?.textContent||'').replace(/\n+/g,' ');
const kids=(node,...names)=>[...(node?.childNodes||[])].filter(n=>n.nodeType===1&&names.includes(String(n.localName||n.tagName).toLowerCase()));
function caption(node,kind){
  const label=nodeText(kids(node,'label')[0]),text=kids(node,'caption').map(nodeText).join(' ');
  const line=[label||kind,text].filter(Boolean).join('. ').replace(/\.\.\s/g,'. ');
  return line?'~ '+line:'';
}
function tableRows(wrap){
  const rows=[...wrap.getElementsByTagName('tr')].map(row=>kids(row,'td','th').map(nodeText).join(' | ')).filter(r=>r.replace(/[|\s]/g,''));
  return rows.length?['[Table rows; columns separated by |]',...rows.slice(0,200)]:[];
}
// JATS body: nested <sec> with <title>, <p>, <fig>, <table-wrap>, <list>, <disp-quote>.
function jatsBlocks(node,out){
  for(const child of kids(node,'sec','title','p','fig','table-wrap','list','disp-quote','boxed-text','statement','fig-group','table-wrap-group')){
    const name=String(child.localName||child.tagName).toLowerCase();
    if(name==='title'){const t=nodeText(child);if(t)out.push('## '+t.slice(0,180));}
    else if(name==='p'){
      // Figures and tables sometimes sit inside a paragraph; read them after its words.
      const nested=kids(child,'fig','table-wrap');nested.forEach(n=>n.remove());
      const t=nodeText(child);if(t)out.push(t);
      for(const n of nested)jatsBlocks({childNodes:[n]},out);
    }
    else if(name==='fig'){const c=caption(child,'Figure');if(c)out.push(c);}
    else if(name==='table-wrap'){const c=caption(child,'Table');if(c)out.push(c);out.push(...tableRows(child));}
    else if(name==='list'){for(const item of child.getElementsByTagName('list-item')){const t=nodeText(item);if(t)out.push('• '+t);}}
    else if(name==='disp-quote'){const t=nodeText(child);if(t)out.push('> '+t);}
    else jatsBlocks(child,out);
  }
  return out;
}
function abstractLines(abstract){
  const out=[];
  const secs=kids(abstract,'sec');
  if(secs.length)for(const sec of secs){const title=nodeText(kids(sec,'title')[0]),body=kids(sec,'p').map(nodeText).filter(Boolean).join(' ');if(body)out.push(title?`${title.replace(/[:.]$/,'')}: ${body}`:body);}
  else for(const p of kids(abstract,'p')){const t=nodeText(p);if(t)out.push(t);}
  return out;
}
const authorLine=record=>{
  const names=String(record?.authorString||'').replace(/\.$/,'').split(/,\s*/).filter(Boolean);
  return names.length>3?names.slice(0,3).join(', ')+' et al.':names.join(', ');
};
const sourceLine=record=>[record?.journalInfo?.journal?.title||record?.journalTitle,record?.pubYear].filter(Boolean).join(' · ');

/** Turns Europe PMC full-text XML into reader text with ## section headings. */
export function jatsToReading(xml,record={}){
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  const article=doc.getElementsByTagName('article')[0];if(!article)return null;
  const meta=article.getElementsByTagName('article-meta')[0];
  const title=nodeText(meta?.getElementsByTagName('article-title')[0])||cleanDocumentText(record.title||'');
  const lines=[];
  const abstract=[...(meta?.getElementsByTagName('abstract')||[])].find(a=>!a.getAttribute('abstract-type'))||meta?.getElementsByTagName('abstract')[0];
  if(abstract){const a=abstractLines(abstract);if(a.length)lines.push('## Abstract',...a);}
  const body=article.getElementsByTagName('body')[0];
  if(body)jatsBlocks(body,lines);
  const text=lines.join('\n\n');
  if(text.replace(/\s/g,'').length<400||!body)return null;
  return {title:title.replace(/\.$/,'').slice(0,2000),author:authorLine(record),text};
}

function abstractOnly(record){
  const {document}=parseHTML('<!doctype html><html><body>'+String(record.abstractText||'').slice(0,200000)+'</body></html>');
  const text=cleanDocumentText([...document.body.childNodes].map(n=>n.textContent).join('\n\n'));
  if(text.replace(/\s/g,'').length<120)return null;
  return {title:cleanDocumentText(record.title||'Research article').replace(/\.$/,'').slice(0,2000),author:authorLine(record),text:'## Abstract\n\n'+text};
}

/**
 * Resolves a research identifier through Europe PMC. Returns null when the paper
 * is not indexed, otherwise what is open: {reading} full text (normalizeImportedText
 * input), {pdfUrl} an open-access PDF, and/or {abstract} an abstract-only reading.
 */
export async function importScholarly(id,{fetchImpl=fetch}={}){
  const record=await findScholarlyRecord(id,{fetchImpl});
  if(!record)return null;
  const doi=record.doi||id.doi;
  const sourceUrl=doi?`https://doi.org/${doi}`:record.pmcid?`https://europepmc.org/article/PMC/${record.pmcid}`:record.pmid?`https://pubmed.ncbi.nlm.nih.gov/${record.pmid}/`:undefined;
  const where=sourceLine(record);
  if(record.pmcid&&(record.isOpenAccess==='Y'||record.inEPMC==='Y')){
    const xml=await epmcFetch(`/${encodeURIComponent(record.pmcid)}/fullTextXML`,fetchImpl,SCHOLARLY_XML_LIMIT,'application/xml');
    const reading=xml&&jatsToReading(xml,record);
    if(reading)return {sourceUrl,reading:{...reading,sourceUrl,sourceFormat:'HTML',sourceType:'article',
      importWarnings:[`Full open-access text from Europe PMC${where?' ('+where+')':''}. The reference list stays at the source. Figures appear as their captions; check complex tables against the original.`]}};
  }
  const pdf=(record.fullTextUrlList?.fullTextUrl||[]).find(u=>u.documentStyle==='pdf'&&['OA','F'].includes(u.availabilityCode)&&/^https:\/\//.test(u.url||''));
  const abstract=abstractOnly(record);
  return {sourceUrl,...(pdf?{pdfUrl:pdf.url}:{}),...(abstract?{abstract:{...abstract,sourceUrl,sourceFormat:'HTML',sourceType:'article',
    importWarnings:[`Only the abstract of this paper is free to read${where?' ('+where+')':''}. For a full breakdown of the methods, results and limitations, download the PDF from the journal or your library and upload it here.`]}}:{})};
}

/** Free copies OpenAlex knows about (author manuscripts, repositories, OA journals) for a DOI. */
export async function openAccessCopies(doi,{fetchImpl=fetch}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetchImpl(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=best_oa_location,locations`,{headers:{Accept:'application/json'},redirect:'manual',signal:controller.signal});
    if(!response.ok){void response.body?.cancel().catch(()=>{});return [];}
    const work=JSON.parse(await response.text());
    const locations=[work.best_oa_location,...(work.locations||[]).filter(l=>l?.is_oa)].filter(Boolean);
    const urls=[];
    for(const l of locations)for(const u of [l.pdf_url,l.landing_page_url])if(typeof u==='string'&&/^https:\/\//.test(u)&&!/(?:^|\.)doi\.org\//.test(u)&&!urls.includes(u))urls.push(u);
    return urls.slice(0,4);
  }catch{return [];}
  finally{clearTimeout(timer);}
}
