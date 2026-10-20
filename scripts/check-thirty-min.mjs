// Checks a 30-min version file: node scripts/check-thirty-min.mjs reader/thirty-min/<book>.json
import {readFile} from 'node:fs/promises';
import {checkThirtyMin} from '../lib/thirty-min-core.mjs';
const library = JSON.parse(await readFile(new URL('../lib/seed-library.json', import.meta.url), 'utf8'));
const files = process.argv.slice(2);
let bad = 0;
for (const file of files) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  const {errors, words, minutes, figures, sections} = checkThirtyMin(data, {strict: true, chapterIds: library.find(e => e.book.id === data.bookId)?.book.chapters.map(c => c.id) || []});
  console.log(`${file}: ${sections} sections, ${words} words (~${minutes} min), ${figures} figures`);
  for (const e of errors) console.log('  ✗ ' + e);
  if (errors.length) bad++;
}
process.exit(bad ? 1 : 0);
