import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import * as core from '../lib/document-import-core.mjs';

const source=await readFile(new URL('./import-ui.js',import.meta.url),'utf8');
const reading={id:'reading-one',title:'Department communication',author:'Source author',chapters:[{id:'section-1',title:'The question',text:'A source paragraph with enough detail to explain the question.'}],sourceFormat:'PDF',sourceType:'article'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

function runtime({ai={},persist,refresh,api,readDocument,readEpub,dbPut,db=null}={}){
  const {document}=parseHTML('<html><body><dialog id="reading-import-dialog"></dialog></body></html>');
  const calls=[],books=[],state={hiddenBooks:{[reading.id]:true}},localAI={available:true,connected:true,autoGenerate:true,...ai};
  const dialog=document.querySelector('dialog');dialog.open=true;
  dialog.close=()=>{calls.push(['close']);dialog.open=false;};
  dialog.showModal=()=>{dialog.open=true;};
  const context=vm.createContext({document,URL,books,state,localAI,db,importing:false,$:selector=>document.querySelector(selector),esc:escape,readIcon:()=>'',setupDismissibleDialog:()=>{},
    save:()=>calls.push(['save-state']),toast:message=>calls.push(['toast',message]),go:(view,args)=>calls.push(['go',view,args]),
    dbPut:async book=>{calls.push(['device-save',book]);await dbPut?.(book);},
    persistBook:async book=>{calls.push(['cloud-save-start',book]);await persist?.(book);calls.push(['cloud-save-complete',book]);},
    refreshGeneration:async (repaint,book)=>{calls.push(['refresh',repaint,book]);await refresh?.(localAI,book);},
    startGeneration:async book=>calls.push(['generate',book]),
    api:async (path,method,body)=>{calls.push(['api',path,method,body]);return api?api(path,method,body):{book:structuredClone(reading)};},
    // Link imports call fetch directly so a PDF can come back as a file.
    Response,AbortSignal,File,location:{href:'https://read.example/read'},
    fetch:async (path,init)=>{const body=JSON.parse(init.body);calls.push(['api',path,init.method,body]);
      try{const value=await (api?api(path,init.method,body):{book:structuredClone(reading)});return value instanceof Response?value:Response.json(value);}
      catch(error){return Response.json({error:error.message},{status:400});}},
    documentImportCore:async()=>core,
    readImportedDocument:async(file,options)=>{calls.push(['parse-document',file,options.sourceType]);return readDocument?readDocument(file,options):{...structuredClone(reading),sourceType:options.sourceType};},
    readEPUB:async file=>{calls.push(['parse-epub',file]);return readEpub?readEpub(file):structuredClone(reading);}
  });
  vm.runInContext(source+'\nthis.importer={add:addImportedReading,submit:submitReadingImport,busy:()=>readingImportBusy,tab:value=>{readingImportTab=value;paintReadingImport();}};',context);
  const importer=context.importer;
  function form({mode='file',type='article',file={name:'paper.pdf'},url='https://example.org/paper',title='Department communication',text='A substantive source paragraph describing staff communication and a limitation.'}={}){
    importer.tab(mode);
    for(const [selector,value] of [['#reading-article-url',url],['#reading-text-title',title],['#reading-pasted-text',text]]){const input=document.querySelector(selector);if(input)input.value=value;}
    const typeInput=document.querySelector('#reading-document-type');if(typeInput)Object.defineProperty(typeInput,'value',{value:type,configurable:true});
    const fileInput=document.querySelector('#reading-document-file');if(fileInput)Object.defineProperty(fileInput,'files',{value:file?[file]:[],configurable:true});
  }
  const submit=()=>importer.submit({preventDefault(){calls.push(['prevent-default']);}});
  return {importer,form,submit,calls,books,state,localAI,document,dialog};
}

test('an imported reading finishes its cloud save before navigation or paid generation',async()=>{
  const gate=deferred(),started=deferred(),h=runtime({persist:()=>{started.resolve();return gate.promise;},db:{}});
  const pending=h.importer.add(structuredClone(reading));
  await started.promise;
  assert.equal(h.calls.filter(c=>c[0]==='device-save').length,1);
  assert.equal(h.calls.filter(c=>c[0]==='cloud-save-start').length,1);
  assert.equal(h.calls.some(c=>c[0]==='generate'||c[0]==='go'),false);
  assert.equal(h.dialog.open,true);
  gate.resolve();await pending;
  const order=h.calls.map(c=>c[0]);
  assert.ok(order.indexOf('cloud-save-complete')<order.indexOf('go'));
  assert.ok(order.indexOf('cloud-save-complete')<order.indexOf('generate'));
  assert.ok(order.indexOf('refresh')<order.indexOf('generate'));
  assert.equal(h.state.hiddenBooks[reading.id],undefined);
  assert.equal(h.books.length,1);
  assert.equal(h.dialog.open,false);
});

test('cloud-save failure starts no generation and leaves a recoverable form that can retry',async()=>{
  let attempts=0;const h=runtime({persist:()=>{if(++attempts===1)throw new Error('Cloud save is unavailable. Try again.');}});
  h.form({type:'book'});await h.submit();
  const status=h.document.querySelector('#reading-import-status');
  assert.match(status.textContent,/Cloud save is unavailable/);
  assert.equal(status.classList.contains('is-error'),true);
  assert.equal(h.calls.some(c=>c[0]==='generate'||c[0]==='go'),false);
  assert.equal(h.dialog.open,true);
  assert.equal(h.importer.busy(),false);
  assert.equal(h.dialog.hasAttribute('aria-busy'),false);
  assert.ok([...h.dialog.querySelectorAll('input,select,textarea,button')].every(control=>!control.disabled));
  assert.equal(h.document.querySelector('#reading-document-file').files[0].name,'paper.pdf');
  await h.submit();
  assert.equal(attempts,2);
  assert.equal(h.calls.filter(c=>c[0]==='generate').length,1);
  assert.equal(h.books.length,1,'Retrying the same document must not duplicate the local library entry');
  assert.equal(status.classList.contains('is-error'),false);
});

test('AI availability, connection and auto-generation preference each gate generation after saving',async()=>{
  for(const ai of [{available:false},{connected:false},{autoGenerate:false}]){
    const h=runtime({ai});await h.importer.add(structuredClone(reading));
    assert.equal(h.calls.filter(c=>c[0]==='cloud-save-complete').length,1);
    assert.equal(h.calls.some(c=>c[0]==='generate'),false);
    assert.equal(h.calls.some(c=>c[0]==='go'),true);
  }
  const h=runtime({refresh:ai=>{ai.available=false;}});await h.importer.add(structuredClone(reading));
  assert.equal(h.calls.some(c=>c[0]==='generate'),false,'Use refreshed connection state rather than a stale pre-import state');
});

test('an article URL already saved by the import endpoint skips a second cloud write',async()=>{
  const h=runtime();h.form({mode:'link',url:'  https://example.org/paper  '});await h.submit();
  const requests=h.calls.filter(c=>c[0]==='api');
  assert.equal(requests.length,1);
  assert.equal(requests[0][1],'/api/import-document');
  assert.equal(requests[0][2],'POST');
  assert.equal(requests[0][3].url,'https://example.org/paper');
  assert.equal(h.calls.some(c=>c[0]==='cloud-save-start'),false);
  assert.equal(h.calls.filter(c=>c[0]==='generate').length,1);
  assert.equal(h.books[0].id,reading.id);
});

test('selected document types reach the parser and saved metadata, while EPUBs retain book structure',async()=>{
  for(const type of ['article','book']){
    const h=runtime({ai:{autoGenerate:false}});h.form({type});await h.submit();
    assert.equal(h.calls.find(c=>c[0]==='parse-document')[2],type);
    assert.equal(h.calls.find(c=>c[0]==='cloud-save-complete')[1].sourceType,type);
  }
  const h=runtime({ai:{autoGenerate:false}});h.form({type:'article',file:{name:'Book.EPUB'}});await h.submit();
  assert.equal(h.calls.filter(c=>c[0]==='parse-epub').length,1);
  assert.equal(h.calls.some(c=>c[0]==='parse-document'),false);
  const saved=h.calls.find(c=>c[0]==='cloud-save-complete')[1];
  assert.equal(saved.sourceType,'book');assert.equal(saved.sourceFormat,'EPUB');
});

test('pasted text uses the selected type and preserves source content through normalization',async()=>{
  const text='Chapter 1\nA source claim with its first qualification.\n\nChapter 2\nA second source claim with a separate qualification.';
  const h=runtime({ai:{autoGenerate:false}});h.form({mode:'text',type:'book',title:'  Staff learning  ',text});await h.submit();
  const saved=h.calls.find(c=>c[0]==='cloud-save-complete')[1];
  assert.equal(saved.title,'Staff learning');assert.equal(saved.sourceType,'book');assert.equal(saved.sourceFormat,'TXT');
  assert.equal(saved.chapters.length,2);
  assert.equal(saved.chapters[0].text,'A source claim with its first qualification.');
  assert.equal(saved.chapters[1].text,'A second source claim with a separate qualification.');
});

test('duplicate submits during parsing cannot create duplicate imports or paid jobs',async()=>{
  const gate=deferred(),h=runtime({readDocument:()=>gate.promise});h.form();
  const first=h.submit();
  assert.equal(h.importer.busy(),true);
  assert.equal(h.dialog.getAttribute('aria-busy'),'true');
  assert.ok([...h.dialog.querySelectorAll('input,select,textarea,button')].every(control=>control.disabled));
  await h.submit();
  assert.equal(h.calls.filter(c=>c[0]==='parse-document').length,1);
  gate.resolve(structuredClone(reading));await first;
  assert.equal(h.calls.filter(c=>c[0]==='cloud-save-start').length,1);
  assert.equal(h.calls.filter(c=>c[0]==='generate').length,1);
  assert.equal(h.importer.busy(),false);
});

test('URL and parsing failures show an error and restore usable controls without saving or generating',async()=>{
  for(const mode of ['link','file']){
    const fail=()=>{throw new Error(mode==='link'?'This page could not be read.':'This PDF contains no text.');};
    const h=runtime({api:fail,readDocument:fail});h.form({mode});await h.submit();
    assert.match(h.document.querySelector('#reading-import-status').textContent,/could not be read|contains no text/);
    assert.equal(h.document.querySelector('#reading-import-status').classList.contains('is-error'),true);
    assert.equal(h.calls.some(c=>['cloud-save-start','generate','go'].includes(c[0])),false);
    assert.equal(h.books.length,0);assert.equal(h.dialog.open,true);assert.equal(h.importer.busy(),false);
    assert.ok([...h.dialog.querySelectorAll('input,select,textarea,button')].every(control=>!control.disabled));
  }
});

test('a PDF link is read on the device like an uploaded PDF and keeps its source link',async()=>{
  const pdf=()=>new Response('%PDF-1.7',{headers:{'content-type':'application/pdf','x-read-source-url':'https://journal.org/paper.pdf'}});
  const h=runtime({api:pdf});h.form({mode:'link',url:'https://journal.org/paper.pdf'});await h.submit();
  const parsed=h.calls.find(c=>c[0]==='parse-document');
  assert.equal(parsed[1].name,'paper.pdf');assert.equal(parsed[2],'article');
  assert.equal(h.books[0].sourceUrl,'https://journal.org/paper.pdf');
  assert.equal(h.calls.some(c=>c[0]==='cloud-save-start'),true,'a device-read PDF is saved to the cloud library');
});
