import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTICLE_HTML_LIMIT,DocumentImportError,extractArticleHtml,importArticleUrl,isPublicArticleAddress,validateArticleUrl} from './document-import-url.mjs';
const html='<!doctype html><html><head><title>Staff learning evidence</title><meta name="author" content="Source Author"></head><body><nav>Unrelated navigation</nav><article><h1>Staff learning evidence</h1><h2>The question</h2><p>A source article explains how staff development is organized and why the comparison matters. The authors distinguish a reported observation from an interpretation about department culture.</p><h2>Results and uncertainty</h2><p>The reported difference was 2 points, with a confidence interval from -1 to 5. The source does not establish that the same result applies to every organization. A future reader should examine the population and the measurement method.</p><ul><li>First qualification remains in the source.</li><li>Second qualification retains its wording.</li></ul></article><footer>Unrelated footer</footer><script>fetch("https://bad.invalid")</script></body></html>';
const page=(body=html,status=200,headers={})=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8',...headers}});
function mockFetch({addresses=['93.184.216.34','2606:4700:4700::1111'],pages={},dns={}}={}){
  const calls=[];
  const fetchImpl=async(url,options)=>{
    assert.notEqual(options.redirect,'error','Cloudflare Workers supports follow/manual redirects only');
    calls.push({url,options});const u=new URL(url);
    if(u.hostname==='cloudflare-dns.com'){
      const name=u.searchParams.get('name'),type=u.searchParams.get('type');const list=dns[name]||addresses;
      return Response.json({Status:0,Answer:list.filter(address=>type==='A'?!address.includes(':'):address.includes(':')).map(data=>({type:data.includes(':')?28:1,data}))});
    }
    const chosen=pages[u.href];return typeof chosen==='function'?chosen(url,options):chosen?.clone()||page();
  };return {fetchImpl,calls};
}
test('only public hostname URLs on standard HTTP/S ports reach DNS or fetching',()=>{
  for(const url of ['http://localhost/a','http://internal/a','https://host.local/a','https://host.internal/a','https://host.home/a','https://host.arpa/a','https://127.0.0.1/a','https://2130706433/a','http://0x7f000001/a','https://[::1]/a','https://[2606:4700::1111]/a','https://host.org:8443/a','ftp://host.org/a','file:///etc/passwd','https://user:pass@host.org/a','https://host.org\\@internal/a','https://host.org/a\n'])assert.throws(()=>validateArticleUrl(url),DocumentImportError,url);
  assert.equal(validateArticleUrl('https://journal.org:443/article#results').href,'https://journal.org/article');
});
test('address checks reject special IPv4 and IPv6 ranges including mapped and transition forms',()=>{
  for(const address of ['0.0.0.0','10.1.2.3','127.1.2.3','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','198.18.0.1','192.0.2.1','203.0.113.1','224.0.0.1','255.255.255.255','::','::1','fc00::1','fe80::1','fec0::1','ff02::1','::ffff:127.0.0.1','64:ff9b::7f00:1','2002:7f00:1::','2001:db8::1','2001::1','3fff::1','5f00::1','bad'])assert.equal(isPublicArticleAddress(address),false,address);
  for(const address of ['93.184.216.34','1.1.1.1','2606:4700:4700::1111','2001:4860:4860::8888'])assert.equal(isPublicArticleAddress(address),true,address);
});
test('readable HTML becomes plain article text, retaining headings, figures of speech and numeric uncertainty',async()=>{
  const raw=extractArticleHtml(html,'https://journal.org/article');assert.match(raw.text,/The question\n\nA source article/);assert.match(raw.text,/confidence interval from -1 to 5/);assert.match(raw.text,/• First qualification/);assert.doesNotMatch(raw.text,/Unrelated navigation|Unrelated footer|fetch\(|<script|<p>/);
  const mocked=mockFetch();const book=await importArticleUrl('https://journal.org/article#results',mocked);
  assert.equal(book.sourceType,'article');assert.equal(book.sourceFormat,'HTML');assert.equal(book.sourceUrl,'https://journal.org/article');assert.equal(book.chapters.length,1);assert.match(book.chapters[0].text,/reported difference was 2 points/);
  const request=mocked.calls.find(call=>new URL(call.url).hostname==='journal.org');assert.equal(request.options.redirect,'manual');assert.equal(request.options.headers.Cookie,undefined);assert.equal(request.options.headers.Authorization,undefined);
  assert.deepEqual(mocked.calls.filter(c=>new URL(c.url).hostname==='cloudflare-dns.com').map(c=>new URL(c.url).searchParams.get('type')).sort(),['A','AAAA']);
});
test('any private DNS answer blocks the host before its page is fetched',async()=>{
  for(const addresses of [['93.184.216.34','10.0.0.2'],['2606:4700::1111','fc00::1'],[]]){
    const mocked=mockFetch({addresses});await assert.rejects(()=>importArticleUrl('https://journal.org/article',mocked),/Private|no public address/);assert.ok(mocked.calls.every(c=>new URL(c.url).hostname==='cloudflare-dns.com'));
  }
});
test('DNS endpoint redirects fail closed without following a different resolver',async()=>{
  const calls=[];
  await assert.rejects(()=>importArticleUrl('https://journal.org/article',{fetchImpl:async(url,options)=>{
    calls.push(url);assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'http://127.0.0.1/dns'}});
  }}),/safely resolved/);
  assert.ok(calls.every(url=>new URL(url).hostname==='cloudflare-dns.com'));
});
test('each redirect is checked before following and redirect count remains bounded',async()=>{
  const internal=mockFetch({pages:{'https://journal.org/article':page('',302,{location:'http://127.0.0.1/secret'})}});
  await assert.rejects(()=>importArticleUrl('https://journal.org/article',internal),/Only public/);assert.equal(internal.calls.filter(c=>!c.url.includes('dns-query')).length,1);
  const privateDns=mockFetch({pages:{'https://journal.org/article':page('',302,{location:'https://redirect.org/article'})},dns:{'redirect.org':['192.168.1.2']}});
  await assert.rejects(()=>importArticleUrl('https://journal.org/article',privateDns),/Private/);assert.ok(!privateDns.calls.some(c=>new URL(c.url).hostname==='redirect.org'));
  const loop=mockFetch({pages:{'https://journal.org/article':()=>page('',302,{location:'/article'})}});
  await assert.rejects(()=>importArticleUrl('https://journal.org/article',loop),/redirects too many/);assert.equal(loop.calls.filter(c=>!c.url.includes('dns-query')).length,5);
  const success=mockFetch({pages:{'https://journal.org/article':page('',301,{location:'/final'})}});assert.equal((await importArticleUrl('https://journal.org/article',success)).sourceUrl,'https://journal.org/final');
});
test('HTML size bounds apply to declared and streamed bodies; binary links use upload fallback',async()=>{
  for(const response of [page(html,200,{'content-length':String(ARTICLE_HTML_LIMIT+1)}),page('x'.repeat(ARTICLE_HTML_LIMIT+1)),new Response('%PDF',{headers:{'content-type':'application/pdf'}})]){
    const mocked=mockFetch({pages:{'https://journal.org/article':response}});await assert.rejects(()=>importArticleUrl('https://journal.org/article',mocked),/too large|not an HTML article/);
  }
});
test('subscription, login, hidden and empty pages never become complete articles',async()=>{
  for(const source of [html.replace('<head>','<head><script type="application/ld+json">{"isAccessibleForFree":false}</script>'),html.replace('<article>','<div class="paywall">Subscribe to read</div><article>'),'<html><head><title>Sign in to your account</title></head><body><input type="password"></body></html>','<html><head><title>Empty</title></head><body>Welcome</body></html>',html.replace('<article>','<article hidden>')])assert.throws(()=>extractArticleHtml(source,'https://journal.org/article'),DocumentImportError);
  const denied=mockFetch({pages:{'https://journal.org/article':page('Forbidden',403)}});await assert.rejects(()=>importArticleUrl('https://journal.org/article',denied),/does not permit public access/);
});
test('one total timeout covers stalled DNS, requests and body reads',async()=>{
  await assert.rejects(()=>importArticleUrl('https://journal.org/article',{fetchImpl:()=>new Promise(()=>{}),timeoutMs:5}),/timed out/);
  const mocked=mockFetch({pages:{'https://journal.org/article':()=>new Response(new ReadableStream({start(){}}),{headers:{'content-type':'text/html'}})}});
  await assert.rejects(()=>importArticleUrl('https://journal.org/article',{...mocked,timeoutMs:5}),/timed out/);
});
test('a web article keeps its own share picture as its cover, and skips site logos',async()=>{
  const jpeg=new Uint8Array(4096).fill(7);jpeg.set([0xff,0xd8,0xff]);
  const withImage=src=>html.replace('</head>',`<meta property="og:image" content="${src}"></head>`);
  const image=()=>new Response(jpeg,{headers:{'content-type':'image/jpeg'}});
  const mocked=mockFetch({pages:{'https://journal.org/article':page(withImage('/media/hero-figure.jpg')),'https://journal.org/media/hero-figure.jpg':image()}});
  const book=await importArticleUrl('https://journal.org/article',mocked);
  assert.match(book.cover,/^data:image\/jpeg;base64,\/9j\//);
  const logo=mockFetch({pages:{'https://journal.org/article':page(withImage('https://journal.org/static/logo-share.png'))}});
  assert.equal((await importArticleUrl('https://journal.org/article',logo)).cover,'');
  assert.ok(!logo.calls.some(c=>c.url.includes('logo')),'a site logo is never fetched');
  const broken=mockFetch({pages:{'https://journal.org/article':page(withImage('/media/missing.jpg')),'https://journal.org/media/missing.jpg':new Response('nope',{status:404})}});
  assert.equal((await importArticleUrl('https://journal.org/article',broken)).cover,'','a missing picture never blocks the import');
});
test('a photo inside a "branded" folder is kept, while a brand mark is skipped',async()=>{
  const {parseHTML}=await import('linkedom');const {previewImageUrl}=await import('./document-import-url.mjs');
  const doc=src=>parseHTML(`<html><head><meta property="og:image" content="${src}"></head><body></body></html>`).document;
  assert.equal(previewImageUrl(doc('https://ichef.bbci.co.uk/news/1024/branded_news/052f/live/photo.jpg'),'https://www.bbc.com/news/x'),'https://ichef.bbci.co.uk/news/1024/branded_news/052f/live/photo.jpg');
  assert.equal(previewImageUrl(doc('/img/brand-mark.png'),'https://www.bbc.com/news/x'),'');
});
