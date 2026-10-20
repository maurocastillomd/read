// The anatomy drawing kit (reader/vendor/anatomy, MIT) and read.'s machines as one
// plain script, the way the reader build inlines them. Tests load the same text.
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
function wrapKit(src,name,preamble=''){
  const names=[...src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
  // An inline </script> in the kit's page helper would end the app's script tag early.
  const body=src.replace(/^import[^\n]*\n/gm,'').replace(/^export\s+/gm,'').replace(/<\/script/gi,'<\\/script');
  return `const ${name}=(()=>{${preamble}\n${body}\nreturn {${names.join(',')}};})();\n`;
}
export async function isoSource(){
  return wrapKit(await read('reader/vendor/anatomy/iso-kit.mjs'),'IsoKit')
    +wrapKit(await read('reader/vendor/anatomy/lathe.mjs'),'IsoLathe','const {cameraOf,iso,pathOf}=IsoKit;')
    +wrapKit(await read('reader/vendor/anatomy/tube.mjs'),'IsoTube','const {iso,pathOf}=IsoKit;const G=IsoLathe;')
    +await read('reader/iso-machines.js')
    +await read('reader/iso-compose.js');
}
