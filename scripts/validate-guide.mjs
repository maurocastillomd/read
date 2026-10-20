// Checks one prepared guide against its bundled chapter exactly as new AI output is checked.
// Usage: node scripts/validate-guide.mjs <bookId> <chapterId> guide.json
import {readFile} from 'node:fs/promises';
import {normalizeParagraphs,validateGuide} from '../lib/guide-core.mjs';
const [bookId,chapterId,file]=process.argv.slice(2);
const library=JSON.parse(await readFile(new URL('../lib/seed-library.json',import.meta.url),'utf8'));
const book=library.find(e=>e.book.id===bookId)?.book;if(!book)throw new Error('Unknown book '+bookId);
const chapter=book.chapters.find(c=>c.id===chapterId);if(!chapter)throw new Error('Unknown chapter '+chapterId);
const guide=JSON.parse(await readFile(file,'utf8'));
validateGuide(guide,{paragraphs:normalizeParagraphs(chapter)},{requireMnemonic:true,requireTeachingContinuity:true,requireChecks:true});
if(!/^Fictional example:/.test(guide.application.scenario))throw new Error('application.scenario must start with "Fictional example:"');
if(guide.checks.length<6)throw new Error('Write at least 6 checks.');
console.log('OK',chapterId,guide.checks.length,'checks');
