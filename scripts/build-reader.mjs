import {readFile,writeFile,readdir} from 'node:fs/promises';
import {checkThirtyMin} from '../lib/thirty-min-core.mjs';
import {createHash} from 'node:crypto';
import {isoSource} from './iso-source.mjs';
import {normalizeParagraphs,validateGuide} from '../lib/guide-core.mjs';
import {eligibleBooks,resolvePicks} from '../lib/reading-recommendations-core.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const safe=v=>JSON.stringify(v).replace(/</g,'\\u003c');
// Books bundled with the app ({book, guides} entries). The public edition ships none:
// every reader brings their own books and articles.
const entries=JSON.parse(await read('lib/seed-library.json'));
const readingCatalog=JSON.parse(await read('lib/reading-catalog.json'));
eligibleBooks(readingCatalog,{});
for(const path of readingCatalog.curated)resolvePicks(path.picks,readingCatalog,{title:path.sourceTitle,author:path.sourceAuthor});
for(const entry of entries){
  const b=entry.book;
  for(const record of entry.guides){
    const chapter=b.chapters.find(c=>c.id===record.chapterId);
    if(!chapter)throw new Error('Prepared guide has no source chapter: '+record.chapterId);
    validateGuide(record.guide,{paragraphs:normalizeParagraphs(chapter)});
  }
  const hash=createHash('sha256').update(JSON.stringify({id:b.id,title:b.title,author:b.author,chapters:b.chapters.map(({id,title,text})=>({id,title,text}))})).digest('hex');
  entry.guides=entry.guides.map(g=>({...g,bookId:b.id,sourceHash:hash,prepared:true}));
}
await writeFile(new URL('lib/seed-library.json',root),JSON.stringify(entries));
const allGuides=entries.flatMap(e=>e.guides);
// 30-min versions of bundled books, one checked file per book.
const thirtyMin={};
for(const name of (await readdir(new URL('reader/thirty-min/',root))).filter(n=>n.endsWith('.json')).sort()){
  const v=JSON.parse(await read('reader/thirty-min/'+name)),entry=entries.find(e=>e.book.id===v.bookId);
  if(!entry)throw new Error('30-min version for a book that is not bundled: '+name);
  const {errors}=checkThirtyMin(v,{chapterIds:entry.book.chapters.map(c=>c.id)});
  if(errors.length)throw new Error('30-min version '+name+': '+errors[0]);
  thirtyMin[v.bookId]=v;
}
await writeFile(new URL('public/vendor/document-import-core.mjs',root),await read('lib/document-import-core.mjs'));
const isoKitSource=await isoSource();
let app=await read('reader/app.js');
for(const [marker,path] of [['EPUB_STRUCTURE','epub-structure.js'],['ROLE_CONTEXT','role-context.js'],['STUDIO_ICONS','studio-icons.js'],['SOURCE_READER','source-reader.js'],['STATISTICS_CORE','statistics-core.js'],['STATISTICS_LAB','statistics-lab.js'],['CHAPTER_PRACTICE','chapter-practice.js'],['DOCUMENT_IMPORT','document-import.js'],['IMPORT_UI','import-ui.js'],['ARTICLE_BREAKDOWN','article-breakdown.js'],['SHARE','share.js'],['ARTICLE_TEXT','article-text.js'],['FOCUS_READING','focus-reading.js'],['CHAPTER_JOURNEY','chapter-journey.js'],['BOOKMARKS','bookmarks.js'],['READING_HABIT','reading-habit.js'],['NEXT_BOOKS','next-books.js'],['READING_PROGRESS','reading-progress.js'],['TAP_CHECK','tap-check.js'],['BOOK_READER','book-reader.js'],['ISO_MACHINES','iso-machines.js'],['IDEA_VISUAL','idea-visual.js'],['BOOK_GLANCE','book-glance.js'],['LESSONS_FIRST','lessons-first.js'],['KEEP','keep.js'],['WELCOME','welcome.js'],['LESSON_LAB','lesson-lab.js'],['GENERATION_UI','generation-ui.js'],['CLOUD_SYNC','cloud-sync.js'],['CLOUD_IMPORT','cloud-import.js'],['LIBRARY_SHELF','library-shelf.js'],['BACK_TO_TOP','back-to-top.js'],['THIRTY_MIN','thirty-min.js'],['READ_ALOUD','read-aloud.js']]){let module=await read('reader/'+path);if(marker==='ISO_MACHINES')module=isoKitSource;if(marker==='THIRTY_MIN'){const core=await read('lib/thirty-min-core.mjs');module=`const ThirtyMinCore=(()=>{${core.replace(/^export /gm,'')}\nreturn {checkThirtyMin,thirtyMinWords,thirtyMinMinutes,tmWords,TM_WPM};})();\nconst {thirtyMinWords,thirtyMinMinutes,tmWords,TM_WPM}=ThirtyMinCore;\n`+module;}if(marker==='STATISTICS_CORE'){const contract=await read('lib/statistics-contract.mjs');module=module.replace('/*STATISTICS_CONTRACT*/',()=>`const StatisticsContract=(()=>{${contract.replace(/^export /gm,'')}\nreturn {validateStatisticsLab,statisticsNumbers};})();`);}app=app.replace('/*__'+marker+'__*/',()=>module);}
let html=await read('reader/template.html');
for(const [key,value] of Object.entries({READING_COMFORT:await read('reader/reading-comfort.js'),STYLES:(await Promise.all(['styles.css','redesign.css','lesson-lab.css','learning-shell.css','reading-progress.css','reading-typography.css','reading-comfort.css','bookmarks.css','sidebar-layout.css','reading-habit.css','next-books.css','focus-reading.css','chapter-journey.css','chapter-practice.css','statistics-lab.css','role-context.css','book-structure.css','import-ui.css','studio.css','tap-check.css','book-reader.css','article-breakdown.css','idea-visual.css','iso-machines.css','library-shelf.css','back-to-top.css','lessons-first.css','keep.css','welcome.css','thirty-min.css','read-aloud.css','design-system.css'].map(f=>read('reader/'+f)))).join('\n'),READING_CATALOG:safe(JSON.parse(await read('lib/reading-catalog.json'))),LESSON_ENRICHMENT:safe(JSON.parse(await read('reader/lesson-enrichment.json'))),TAP_CHECKS:safe(JSON.parse(await read('reader/tap-checks.json'))),IDEA_VISUALS:safe(JSON.parse(await read('reader/idea-visuals.json'))),THIRTY_MIN_DATA:safe(thirtyMin),BOOK_DATA:safe(entries.map(e=>e.book)),GUIDE_DATA:safe(JSON.parse(await read('reader/guide.json'))),GENERATED_DATA:safe(allGuides),JSZIP:await read('public/vendor/jszip.min.js'),APP:app}))html=html.replace('/*__'+key+'__*/',()=>value);
if(/\/\*__[A-Z_]+__\*\//.test(html))throw new Error('Reader build contains unresolved placeholders');
new Function(app);
new Function(await read('reader/reading-comfort.js'));
await writeFile(new URL('reader/rendered.ts',root),'// Generated by scripts/build-reader.mjs. Edit reader sources.\nexport default '+JSON.stringify(html)+';\n');
console.log('Built reader with '+allGuides.length+' verified guides across '+entries.length+' books.');
