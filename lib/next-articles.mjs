// "Read next" for articles, from OpenAlex: a free, open index of 250M+ research
// works with citation links and open-access locations. No key and no cost.
// A paper with a DOI gets its newer follow-ups (papers that cite it) and the
// works OpenAlex marks as related; any other article is matched by its title.
import {scholarlyId} from './scholarly-import.mjs';

const OPENALEX='https://api.openalex.org';
const FIELDS='id,doi,title,display_name,publication_year,cited_by_count,open_access,primary_location,authorships,type,best_oa_location';
const STOP=new Set('a an and are as at be by for from has have how in into is it its of on or that the their this to was were what when which who why will with without your you vs versus among between study trial effect effects using based'.split(' '));

async function getJson(path,fetchImpl){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetchImpl(OPENALEX+path,{headers:{Accept:'application/json','User-Agent':'read-next-articles/1.0'},redirect:'manual',signal:controller.signal});
    if(!response.ok){void response.body?.cancel().catch(()=>{});return null;}
    const text=await response.text();if(text.length>3*1024*1024)return null;
    return JSON.parse(text);
  }catch{return null;}
  finally{clearTimeout(timer);}
}
const shortId=id=>String(id||'').replace(/^https:\/\/openalex\.org\//,'');
const cleanDoi=doi=>String(doi||'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
function normalTitle(t){return String(t||'').toLowerCase().replace(/<[^>]+>/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
/** Search words from a title: the distinctive ones, at most ten. */
export function titleQuery(title){
  return [...new Set(normalTitle(title).split(' ').filter(w=>w.length>2&&!STOP.has(w)))].slice(0,10).join(' ');
}
function card(work,why){
  const names=(work.authorships||[]).map(a=>a.author?.display_name).filter(Boolean);
  const doi=cleanDoi(work.doi);
  const oa=work.best_oa_location||(work.open_access?.is_oa?work.primary_location:null);
  return {
    id:shortId(work.id),title:String(work.display_name||work.title||'').replace(/<[^>]+>/g,'').slice(0,300),
    authors:names.length>2?names.slice(0,2).join(', ')+' et al.':names.join(', '),
    year:work.publication_year||null,venue:String(work.primary_location?.source?.display_name||'').slice(0,160),
    citedBy:Number(work.cited_by_count)||0,openAccess:!!work.open_access?.is_oa,
    doi:doi||null,link:doi?`https://doi.org/${doi}`:String(oa?.landing_page_url||work.primary_location?.landing_page_url||'')||null,
    why,
  };
}
// Follow-ups that cite the paper teach what happened next; related works widen the view;
// free full text can be added in one tap, so it ranks higher; very old or uncited work ranks lower.
export function rankNextArticles(candidates,{exclude=[],year=new Date().getUTCFullYear(),limit=5}={}){
  const skip=new Set(exclude.map(normalTitle).filter(Boolean)),seen=new Set(),weights={'Builds on this paper':1,'Closely related':.8,'On the same question':.7};
  const scored=[];
  for(const c of candidates){
    const key=normalTitle(c.title);
    if(!c.title||!key||skip.has(key)||seen.has(key)||(c.doi&&seen.has(c.doi)))continue;
    if(['erratum','retraction','editorial','letter','paratext'].includes(c.type))continue;
    seen.add(key);if(c.doi)seen.add(c.doi);
    const age=c.year?Math.max(0,year-c.year):20;
    const score=(weights[c.why]||.6)+(c.openAccess?.5:0)+Math.min(1,Math.log10(c.citedBy+1)/3)*.6+(age<=5?.3:age<=10?.1:0);
    scored.push({...c,score});
  }
  scored.sort((a,b)=>b.score-a.score);
  // Keep the list varied: no more than three of the same kind.
  const out=[],perWhy={};
  for(const c of scored){if((perWhy[c.why]||0)>=3)continue;perWhy[c.why]=(perWhy[c.why]||0)+1;const {score,type,...rest}=c;out.push(rest);if(out.length>=limit)break;}
  return out;
}
/**
 * The 3 to 5 best next reads for one article in the library.
 * @param {{title?:string,sourceUrl?:string}} book
 * @param {{fetchImpl?:typeof fetch,exclude?:string[]}} [options]
 */
export async function nextArticles(book,{fetchImpl=fetch,exclude=[]}={}){
  const id=scholarlyId(book?.sourceUrl||'');
  const candidates=[];
  const add=(works,why)=>{for(const w of works||[])if(w?.id)candidates.push({...card(w,why),type:w.type});};
  if(id?.doi){
    const work=await getJson(`/works/doi:${encodeURIComponent(id.doi)}?select=id,related_works,display_name`,fetchImpl);
    if(work?.id){
      const wid=shortId(work.id);
      const [citing,related]=await Promise.all([
        getJson(`/works?filter=cites:${wid},type:article&sort=cited_by_count:desc&per-page=12&select=${FIELDS}`,fetchImpl),
        work.related_works?.length?getJson(`/works?filter=openalex:${work.related_works.slice(0,15).map(shortId).join('|')}&per-page=15&select=${FIELDS}`,fetchImpl):null,
      ]);
      add(citing?.results,'Builds on this paper');add(related?.results,'Closely related');
    }
  }
  if(candidates.length<5){
    const q=titleQuery(book?.title);
    if(q){const found=await getJson(`/works?search=${encodeURIComponent(q)}&filter=type:article|review&per-page=15&select=${FIELDS}`,fetchImpl);add(found?.results,'On the same question');}
  }
  return rankNextArticles(candidates,{exclude:[book?.title,...exclude]});
}
