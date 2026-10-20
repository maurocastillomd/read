// Parses an EPUB with the same code the reader uses in the browser and prints
// the book as JSON. Usage: node scripts/import-epub.mjs book.epub [id]
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DOMParser} from 'linkedom';
async function loadJSZip(){
  const context=vm.createContext({setTimeout,clearTimeout,setImmediate,Uint8Array,ArrayBuffer,Promise,TextDecoder,TextEncoder});
  context.self=context;context.window=context;
  vm.runInContext(await readFile(new URL('../public/vendor/jszip.min.js',import.meta.url),'utf8'),context);
  return context.JSZip;
}
export async function loadEpubStructure(){
  const source=await readFile(new URL('../reader/epub-structure.js',import.meta.url),'utf8');
  const context=vm.createContext({URL,console});
  vm.runInContext(source+'\nthis.EpubStructure=EpubStructure;',context);
  return context.EpubStructure;
}
export async function parseEpub(path){
  const EpubStructure=await loadEpubStructure();
  const JSZip=await loadJSZip();
  const zip=await JSZip.loadAsync(await readFile(path));
  const parser=new DOMParser();
  return EpubStructure.fromZip(zip,{parseXml:t=>parser.parseFromString(t,'text/xml'),parseHtml:t=>parser.parseFromString(t,'text/html')});
}
if(import.meta.url===`file://${process.argv[1]}`){
  const book=await parseEpub(process.argv[2]);
  process.stdout.write(JSON.stringify(book));
}
