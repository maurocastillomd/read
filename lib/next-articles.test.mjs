import test from 'node:test';
import assert from 'node:assert/strict';
import {nextArticles,rankNextArticles,titleQuery} from './next-articles.mjs';
import {omitUnverifiedStudyVisual} from './guide-core.mjs';

const work=(id,title,extra={})=>({id:'https://openalex.org/'+id,title,display_name:title,publication_year:2024,cited_by_count:10,open_access:{is_oa:false},doi:`https://doi.org/10.1234/${id.toLowerCase()}`,type:'article',authorships:[{author:{display_name:'Ana Lee'}},{author:{display_name:'Ben Kim'}},{author:{display_name:'Cy Diaz'}}],primary_location:{source:{display_name:'J Sports Sci'}},...extra});

test('title search words drop common words and keep the distinctive ones',()=>{
  assert.equal(titleQuery('Sleep extension and sprint speed in collegiate soccer players: a randomized trial'),'sleep extension sprint speed collegiate soccer players randomized');
});

test('ranking favors follow-ups and free full text, skips the article itself, errata and duplicates, and stays varied',()=>{
  const c=(title,why,extra={})=>({title,why,year:2024,citedBy:5,openAccess:false,doi:null,type:'article',...extra});
  const out=rankNextArticles([
    c('The article itself','Builds on this paper'),
    c('Erratum to a sleep paper','Builds on this paper',{type:'erratum'}),
    c('Follow-up A','Builds on this paper',{openAccess:true}),c('Follow-up B','Builds on this paper'),c('Follow-up C','Builds on this paper'),c('Follow-up D','Builds on this paper',{openAccess:true,citedBy:900}),
    c('Follow-up a','Builds on this paper'),
    c('Related old','Closely related',{year:1990}),c('Same question','On the same question',{openAccess:true}),
  ],{exclude:['The article itself'],year:2026});
  assert.equal(out.length,5);
  assert.equal(out[0].title,'Follow-up D');
  assert.ok(!out.some(x=>/itself|Erratum/.test(x.title)));
  assert.equal(out.filter(x=>x.why==='Builds on this paper').length,3,'no more than three of one kind');
  assert.equal(out.filter(x=>x.title.toLowerCase()==='follow-up a').length,1);
  assert.ok(!('score' in out[0])&&!('type' in out[0]));
});

test('a DOI article gets papers that cite it and related works from OpenAlex, with links and badges',async()=>{
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(url);const u=new URL(url);
    if(u.pathname==='/works/doi:10.1234%2Fself'||u.pathname==='/works/doi:10.1234/self')return Response.json({id:'https://openalex.org/W0',related_works:['https://openalex.org/W8','https://openalex.org/W9']});
    if(u.searchParams.get('filter')?.startsWith('cites:W0'))return Response.json({results:[work('W1','Sleep and reaction time in tennis',{open_access:{is_oa:true},cited_by_count:40}),work('W2','Napping and sprint recovery'),work('W3','Sleep banking before competition')]});
    if(u.searchParams.get('filter')?.startsWith('openalex:W8|W9'))return Response.json({results:[work('W8','Sleep and athletic performance: a meta-analysis',{cited_by_count:300}),work('W9','Actigraphy in athletes')]});
    return new Response('',{status:404});
  };
  const out=await nextArticles({title:'Self',sourceUrl:'https://doi.org/10.1234/self'},{fetchImpl});
  assert.equal(out.length,5);
  assert.ok(!calls.some(u=>new URL(u).searchParams.has('search')),'no title search when the DOI gives enough');
  const tennis=out.find(x=>x.id==='W1');
  assert.deepEqual({why:tennis.why,openAccess:tennis.openAccess,link:tennis.link,authors:tennis.authors,venue:tennis.venue},{why:'Builds on this paper',openAccess:true,link:'https://doi.org/10.1234/w1',authors:'Ana Lee, Ben Kim et al.',venue:'J Sports Sci'});
  assert.equal(out.find(x=>x.id==='W8').why,'Closely related');
});

test('an ordinary web article is matched by its title, and a dead index returns nothing instead of failing',async()=>{
  const fetchImpl=async url=>new URL(url).searchParams.has('search')?Response.json({results:[work('W5','Why athletes need more sleep'),work('W6','Sleep hygiene for teams')]}):new Response('',{status:404});
  const out=await nextArticles({title:'Why athletes should sleep more',sourceUrl:'https://www.nytimes.com/x'},{fetchImpl});
  assert.deepEqual(out.map(x=>x.why),['On the same question','On the same question']);
  assert.deepEqual(await nextArticles({title:'X y z words here',sourceUrl:''},{fetchImpl:async()=>{throw new Error('offline');}}),[]);
});

test('a study drawing that does not match the article is dropped, and a good one is kept',()=>{
  const unit={paragraphs:[{id:'p1',text:'Twenty-four players were randomized to sleep extension or usual sleep.'}]};
  const visual={design:'randomized-trial',participants:{label:'Soccer players',count:24},groups:[{label:'Sleep extension',count:12,receives:'9 h in bed'},{label:'Usual sleep',count:12,receives:''}],duration:'4 weeks',outcomes:['Sprint time'],headline:{measure:'Sprint time',direction:'decrease',magnitude:'0.09 s',favors:'Sleep extension'},sourceRefs:[{paragraphId:'p1',quote:'players were randomized to sleep extension'}]};
  const guide=v=>({articleAnalysis:{kind:'empirical-study',studyVisual:v}});
  const good=guide(visual);
  assert.equal(omitUnverifiedStudyVisual(good,unit),good);
  assert.equal(omitUnverifiedStudyVisual(guide({...visual,sourceRefs:[{paragraphId:'p1',quote:'players were blinded'}]}),unit).articleAnalysis.studyVisual,null);
  assert.equal(omitUnverifiedStudyVisual(guide({...visual,participants:{label:'Players',count:24.5}}),unit).articleAnalysis.studyVisual,null);
  assert.equal(omitUnverifiedStudyVisual({articleAnalysis:{kind:'commentary',studyVisual:visual}},unit).articleAnalysis.studyVisual,null);
  assert.equal(omitUnverifiedStudyVisual(guide({...visual,design:'mega-trial'}),unit).articleAnalysis.studyVisual,null);
});
