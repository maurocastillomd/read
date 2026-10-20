import {parseHTML} from 'linkedom';
import {Readability} from '@mozilla/readability';
import ipaddr from 'ipaddr.js';
import {cleanDocumentText,isWeakAuthor,normalizeImportedText,pickTitle} from './document-import-core.mjs';
import {importScholarly,openAccessCopies,scholarlyId} from './scholarly-import.mjs';

export const ARTICLE_HTML_LIMIT=2*1024*1024;
export const ARTICLE_PDF_LIMIT=30*1024*1024;
const FALLBACK='Upload a document or paste the article text instead.';
export class DocumentImportError extends Error {constructor(message,status=400){super(message);this.name='DocumentImportError';this.status=status;}}
const fail=(message,status=400)=>{throw new DocumentImportError(message+' '+FALLBACK,status);};
function publicHostname(host){
  const name=String(host||'').toLowerCase().replace(/\.$/,'');
  if(!name.includes('.')||name.length>253||ipaddr.isValid(name)||/[\[\]:%\\]/.test(name)||!name.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))return false;
  if(/(?:^|\.)(?:localhost|localdomain|local|internal|intranet|private|home|lan|corp|onion|test|invalid|example|arpa)$/.test(name))return false;
  return true;
}
export function validateArticleUrl(input){
  if(typeof input!=='string'||!input.trim()||input.length>4000||/[\u0000-\u0020\u007f\\]/.test(input))fail('Enter a public article URL.');
  let url;try{url=new URL(input);}catch{fail('Enter a valid public article URL.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!publicHostname(url.hostname))fail('Only public HTTP or HTTPS article links on standard ports are supported.');
  url.hash='';return url;
}
export function isPublicArticleAddress(address){
  try{
    const ip=ipaddr.parse(address);if(ip.range()!=='unicast')return false;
    return ip.kind()==='ipv4'||ip.match(ipaddr.parse('2000::'),3);
  }catch{return false;}
}
function abortable(promise,signal){
  if(signal.aborted)return Promise.reject(new DocumentImportError('The article request timed out. '+FALLBACK,408));
  return new Promise((resolve,reject)=>{
    const stop=()=>reject(new DocumentImportError('The article request timed out. '+FALLBACK,408));signal.addEventListener('abort',stop,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));
  });
}
async function boundedBytes(response,limit,signal){
  if(Number(response.headers.get('content-length'))>limit){void response.body?.cancel().catch(()=>{});fail('The page is too large to import.',413);}
  if(!response.body)fail('The page returned no readable content.');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{
    while(true){const {done,value}=await abortable(reader.read(),signal);if(done)break;length+=value.byteLength;if(length>limit)fail('The page is too large to import.',413);chunks.push(value);}
  }catch(error){void reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes;
}
async function boundedText(response,limit,signal){
  const bytes=await boundedBytes(response,limit,signal);
  const charset=response.headers.get('content-type')?.match(/charset=["']?([\w-]+)/i)?.[1]||'utf-8';
  try{return new TextDecoder(charset).decode(bytes);}catch{return new TextDecoder().decode(bytes);}
}
async function checkPublicDns(url,fetchImpl,signal){
  const replies=await Promise.all(['A','AAAA'].map(async type=>{
    const endpoint=new URL('https://cloudflare-dns.com/dns-query');endpoint.searchParams.set('name',url.hostname);endpoint.searchParams.set('type',type);
    const response=await abortable(fetchImpl(endpoint.href,{headers:{Accept:'application/dns-json'},redirect:'manual',signal}),signal);
    if(!response.ok)fail('The article host could not be safely resolved.');
    let data;try{data=JSON.parse(await boundedText(response,65536,signal));}catch(error){if(error instanceof DocumentImportError)throw error;fail('The article host returned an invalid DNS response.');}
    if(data.Status!==0||data.TC===true||!Array.isArray(data.Answer||[]))fail('The article host could not be safely resolved.');
    const answers=data.Answer||[];
    for(const item of answers){
      if(item.type===5&&!publicHostname(item.data))fail('The article host resolves through a private or unsupported network.');
      if([1,28].includes(item.type)&&!isPublicArticleAddress(item.data))fail('Private or reserved network addresses cannot be imported.');
    }
    return answers.filter(item=>[1,28].includes(item.type)).map(item=>item.data);
  }));
  if(!replies.flat().length)fail('The article host has no public address.');
}
function readableText(element){
  const blocks=new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','LI','UL','OL','BLOCKQUOTE','PRE','TABLE','TR','FIGCAPTION']);
  // Headings, quotes and captions keep the reader's line markers (## > ~), one per paragraph.
  const markers={H1:'## ',H2:'## ',H3:'## ',H4:'## ',BLOCKQUOTE:'> ',FIGCAPTION:'~ '};
  const walk=(node,inline=false)=>{
    if(node.nodeType===3)return node.textContent;
    if(node.nodeType!==1)return '';
    if(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','IFRAME','SVG','FORM'].includes(node.tagName))return '';
    if(node.tagName==='BR')return inline?' ':'\n';
    const marker=markers[node.tagName];
    let inner=[...node.childNodes].map(child=>walk(child,inline||/^H[1-6]$/.test(node.tagName))).join('');
    if(marker)inner=cleanDocumentText(inner).split(/\n+/).map(line=>line.trim().replace(/^(?:## |> |~ )/,'')).filter(Boolean).map(line=>marker+line).join('\n\n');
    if(node.tagName==='LI')inner='• '+inner;
    if(['TD','TH'].includes(node.tagName))inner+=' | ';
    return blocks.has(node.tagName)?'\n\n'+inner+'\n\n':inner;
  };
  return cleanDocumentText(walk(element)).replace(/ \|(?=\n|$)/g,'');
}
// The page's own share picture (og:image / twitter:image) becomes the article's cover.
// Site-wide logos and placeholders are skipped, since every page of that site shares them.
const GENERIC_IMAGE=/(?:logo|favicon|placeholder|default|fallback|sprite|blank|brand(?!ed)|social-share|share-image|site-image|apple-touch)/i;
export function previewImageUrl(document,sourceUrl){
  const pick=[...document.querySelectorAll('meta[property="og:image"],meta[property="og:image:url"],meta[property="og:image:secure_url"],meta[name="twitter:image"],meta[name="twitter:image:src"]')].map(m=>m.getAttribute('content')).find(Boolean);
  if(!pick)return '';
  try{const url=new URL(pick.trim(),sourceUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!publicHostname(url.hostname)||GENERIC_IMAGE.test(url.pathname)||/\.(?:svg|gif|ico)$/i.test(url.pathname))return '';return url.href;}catch{return '';}
}
export const PREVIEW_IMAGE_LIMIT=900*1024;
/** Fetches a preview picture as a data: URL, or '' — a cover is optional and never blocks an import. */
export async function fetchPreviewImage(input,{fetchImpl=fetch,timeoutMs=6000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    let url=validateArticleUrl(input);
    for(let hop=0;hop<=3;hop++){
      await checkPublicDns(url,fetchImpl,controller.signal);
      const response=await abortable(fetchImpl(url.href,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'image/webp,image/jpeg,image/png;q=0.9','User-Agent':'read-article-import/1.0'}}),controller.signal);
      if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');void response.body?.cancel().catch(()=>{});if(!location)return '';url=validateArticleUrl(new URL(location,url).href);continue;}
      const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(type)){void response.body?.cancel().catch(()=>{});return '';}
      const bytes=await boundedBytes(response,PREVIEW_IMAGE_LIMIT,controller.signal);
      if(bytes.length<2000)return '';
      let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
      return 'data:'+type+';base64,'+btoa(binary);
    }
    return '';
  }catch{return '';}
  finally{clearTimeout(timer);}
}
export function extractArticleHtml(html,sourceUrl){
  if(typeof html!=='string'||new TextEncoder().encode(html).length>ARTICLE_HTML_LIMIT)fail('The page is too large to import.',413);
  const {document}=parseHTML(html);
  const title=cleanDocumentText(document.querySelector('meta[property="og:title"]')?.getAttribute('content')||document.title||'Article');
  // Scholarly pages carry the exact paper title and authors in citation_* tags.
  const metaContent=name=>[...document.querySelectorAll(`meta[name="${name}"]`)].map(m=>cleanDocumentText(m.getAttribute('content'))).filter(Boolean);
  const citationTitle=metaContent('citation_title')[0]||metaContent('dc.title')[0]||'',citationAuthors=metaContent('citation_author').slice(0,30);
  const previewImage=previewImageUrl(document,sourceUrl);
  const scripts=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent||'').join('\n');
  const gate=document.querySelector('[data-paywall],.paywall,.paywall-overlay,#paywall,[class*="subscription-gate"],[class*="regwall"]');
  if(/"isAccessibleForFree"\s*:\s*(?:false|"false")/i.test(scripts)||gate||document.querySelector('input[type="password"]')&&/(?:sign[ -]?in|log[ -]?in|member|account|access)/i.test(title))fail('This page requires sign-in or subscription access.');
  for(const node of document.querySelectorAll('script,style,noscript,template,iframe,form,nav,footer,base,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"]'))node.remove();
  Object.defineProperty(document,'documentURI',{value:sourceUrl,configurable:true});Object.defineProperty(document,'baseURI',{value:sourceUrl,configurable:true});
  let article;try{article=new Readability(document,{charThreshold:180,maxElemsToParse:50000}).parse();}catch{fail('The page could not be read as an article.');}
  if(!article?.content)fail('No readable article was found at this link.');
  const {document:clean}=parseHTML('<!doctype html><html><body>'+article.content+'</body></html>');const text=readableText(clean.body);
  if(text.replace(/\s/g,'').length<180||/^(?:access denied|just a moment|enable javascript|checking your browser|sign in to continue)/i.test(text))fail('The page did not provide a readable public article.');
  const byline=cleanDocumentText(article.byline||'').replace(/^by\s+/i,'');
  return {...(previewImage?{previewImage}:{}),title:pickTitle(citationTitle,article.title,title),author:(citationAuthors.join(', ')||(isWeakAuthor(byline)?'':byline)).slice(0,2000),text,sourceUrl,sourceFormat:'HTML',sourceType:'article',importWarnings:['Imported the publicly available article text. Embedded figures, interactive content, and complex tables may need checking at the source.']};
}
/** With allowPdf, a PDF link returns {pdf:Uint8Array,sourceUrl} for the device to read. */
export async function importArticleUrl(input,{fetchImpl=fetch,timeoutMs=12000,allowPdf=false}={}){
  let url=validateArticleUrl(input);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(allowPdf?20000:12000,Math.max(1,timeoutMs)));
  try{
    for(let hop=0;hop<=4;hop++){
      await checkPublicDns(url,fetchImpl,controller.signal);
      const response=await abortable(fetchImpl(url.href,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'text/html,application/xhtml+xml;q=0.9','User-Agent':'read-article-import/1.0'}}),controller.signal);
      if([301,302,303,307,308].includes(response.status)){
        const location=response.headers.get('location');void response.body?.cancel().catch(()=>{});
        if(!location||hop===4)fail('The article redirects too many times or has an invalid redirect.');
        try{url=validateArticleUrl(new URL(location,url).href);}catch(error){if(error instanceof DocumentImportError)throw error;fail('The article has an invalid redirect.');}continue;
      }
      if(!response.ok){void response.body?.cancel().catch(()=>{});fail([401,403,407,451].includes(response.status)?'The source does not permit public access to this article.':'The source could not return this article.');}
      const type=response.headers.get('content-type')||'';
      if(allowPdf&&(/^application\/(?:x-)?pdf(?:;|$)/i.test(type)||/^(?:application\/(?:octet-stream|x-download|force-download)|binary\/octet-stream)(?:;|$)/i.test(type)&&/\.pdf$/i.test(url.pathname))){
        const pdf=await boundedBytes(response,ARTICLE_PDF_LIMIT,controller.signal);
        if(controller.signal.aborted)fail('The article request timed out.',408);
        if(new TextDecoder().decode(pdf.slice(0,1024)).indexOf('%PDF-')<0)fail('This link did not return a readable PDF.');
        return {pdf,sourceUrl:url.href};
      }
      if(!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type)){void response.body?.cancel().catch(()=>{});fail('This link is not an HTML article. Download the file and import it from your device.');}
      const html=await boundedText(response,ARTICLE_HTML_LIMIT,controller.signal);
      if(controller.signal.aborted)fail('The article request timed out.',408);
      const {previewImage,...extracted}=extractArticleHtml(html,url.href);
      const reading=await normalizeImportedText(extracted);
      clearTimeout(timer);
      const cover=previewImage?await fetchPreviewImage(previewImage,{fetchImpl}):'';
      return cover?{...reading,cover}:reading;
    }
  }catch(error){if(error instanceof DocumentImportError)throw error;if(controller.signal.aborted)fail('The article request timed out.',408);fail('The article could not be retrieved safely.');}
  finally{clearTimeout(timer);}
}

/**
 * Everything the "Article link" box accepts: a web article, a PDF link, a DOI,
 * or a PubMed / PubMed Central link. Returns {book} or {pdf,sourceUrl}.
 * Research identifiers try Europe PMC's open full text first, then the page,
 * then an abstract-only reading with a clear note to upload the PDF.
 */
export async function importReadingLink(input,{fetchImpl=fetch,timeoutMs=20000}={}){
  const id=scholarlyId(input);
  let scholarly=null;
  if(id){
    scholarly=await importScholarly(id,{fetchImpl});
    if(scholarly?.reading)return {book:await normalizeImportedText(scholarly.reading)};
    if(scholarly?.pdfUrl){
      try{const result=await importArticleUrl(scholarly.pdfUrl,{fetchImpl,timeoutMs,allowPdf:true});if(result.pdf)return {...result,sourceUrl:scholarly.sourceUrl||result.sourceUrl};}
      catch{/* fall through to the page or the abstract */}
    }
  }
  // No open copy in Europe PMC: OpenAlex often knows a free manuscript or repository copy.
  if(id?.doi&&!scholarly?.reading){
    for(const copy of await openAccessCopies(scholarly?.doi||id.doi,{fetchImpl})){
      try{
        const result=await importArticleUrl(copy,{fetchImpl,timeoutMs,allowPdf:true});
        if(result.pdf)return {...result,sourceUrl:scholarly?.sourceUrl||`https://doi.org/${id.doi}`};
        if(result.chapters?.[0]?.text?.length>3000)return {book:{...result,sourceUrl:scholarly?.sourceUrl||result.sourceUrl}};
      }catch{/* try the next copy */}
    }
  }
  const raw=String(input||'').trim();
  // A pasted DOI or PMID has no page of its own: open its landing page instead.
  const pageUrl=/^https?:\/\//i.test(raw)||!id?raw:scholarly?.sourceUrl||(id.doi?`https://doi.org/${id.doi}`:id.pmid?`https://pubmed.ncbi.nlm.nih.gov/${id.pmid}/`:`https://europepmc.org/article/PMC/${id.pmcid}`);
  try{
    const result=await importArticleUrl(pageUrl,{fetchImpl,timeoutMs,allowPdf:true});
    return result.pdf?result:{book:result};
  }catch(error){
    if(scholarly?.abstract)return {book:await normalizeImportedText(scholarly.abstract),abstractOnly:true};
    if(id&&error instanceof DocumentImportError)throw new DocumentImportError('This paper is not openly available to read here. Download the PDF from the journal or your library and upload it with Upload file.',error.status);
    throw error;
  }
}
