import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {DOMParser} from 'linkedom';
import {loadEpubStructure} from '../scripts/import-epub.mjs';

const EpubStructure = await loadEpubStructure();
async function loadJSZip() {
  const context = vm.createContext({setTimeout, clearTimeout, setImmediate, Uint8Array, ArrayBuffer, Promise, TextDecoder, TextEncoder});
  context.self = context; context.window = context;
  vm.runInContext(await readFile(new URL('../public/vendor/jszip.min.js', import.meta.url), 'utf8'), context);
  return context.JSZip;
}
const JSZip = await loadJSZip();
const parser = new DOMParser();
const long = n => Array.from({length: n}, (_, i) => `sentence ${i} continues the argument in plain words`).join(' ');

// A converted PDF: one paragraph per printed line, page anchors, and a table of
// contents that points chapter 2 at the page where chapter 1 ends.
function convertedBook() {
  const p = (text, id) => `<p class="calibre1">${id ? `<a id="${id}"></a>` : ''}${text}</p>`;
  const body = [
    p('PART I', 'p1'), p('<b>Prospection</b>'), p('<b>prospection</b> (pro•spe•kshen)'), p('The act of looking forward in time.'),
    p('CHAPTER 1'), p('<i>Journey to</i>'), p('<i>Elsewhen</i>'),
    p('O, that a man might know'), p('The end of this day’s business ere it come!'), p('Shakespeare, Julius Caesar'),
    p(`PRIESTS VOW TO REMAIN CELIBATE, and the rest of us ${long(4)}. A price of $30,000 is not a note.¹`),
    p(`The middle of chapter one keeps going and then breaks across the printed page so that the sentence`),
    p(`continues on the next line ${long(3)}.`, 'p2'),
    p(`and ends here on the shared page with the final words of chapter one.`, 'p3'),
    p('CHAPTER 2'), p('<i>The View from in Here</i>'), p('But, O, how bitter a thing it is.'), p('Shakespeare, As You Like It'),
    p(`LORI AND REBA SCHAPPELL may be twins ${long(5)}.`),
    p('Notes', 'p4'), p('<b>Chapter 1: Journey to Elsewhen</b>'), p('1. W. A. Roberts, “Are Animals Stuck in Time?” (2002).'),
  ].join('\n');
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Synthetic Happiness</dc:title><dc:creator>Test Author</dc:creator><dc:identifier id="id">synthetic-1</dc:identifier><meta name="generator" content="pdftohtml"/></metadata><manifest><item id="t" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="a" href="index.html" media-type="application/xhtml+xml"/></manifest><spine toc="t"><itemref idref="a"/></spine></package>`);
  const point = (label, src, children = '') => `<navPoint><navLabel><text>${label}</text></navLabel><content src="${src}"/>${children}</navPoint>`;
  zip.file('toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>${point('PART I', 'index.html#p1', point('CHAPTER 1', 'index.html#p1') + point('CHAPTER 2', 'index.html#p3'))}${point('Notes', 'index.html#p4')}</navMap></ncx>`);
  zip.file('index.html', `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`);
  return zip;
}

test('a converted PDF keeps each chapter whole when the contents points at a shared page', async () => {
  const zip = await JSZip.loadAsync(await convertedBook().generateAsync({type: 'uint8array'}));
  const book = await EpubStructure.fromZip(zip, {parseXml: t => parser.parseFromString(t, 'text/xml'), parseHtml: t => parser.parseFromString(t, 'text/html')});
  const [one, two] = book.chapters;
  assert.equal(one.title, 'Journey to Elsewhen');
  assert.equal(one.label, 'Chapter 1');
  assert.equal(one.partTitle, 'Prospection');
  assert.equal(two.title, 'The View from in Here');
  const last = one.text.split('\n').filter(Boolean).at(-1);
  assert.match(last, /final words of chapter one\.$/, 'chapter 1 keeps its ending');
  assert.doesNotMatch(two.text, /final words of chapter one/, 'chapter 2 starts at its own heading');
  const lines = two.text.split('\n').filter(Boolean);
  assert.equal(lines[0], '> But, O, how bitter a thing it is.');
  assert.match(lines.at(-1), /^LORI AND REBA SCHAPPELL/);
  // The part definition and epigraph become quotes; the split title is dropped.
  const first = one.text.split('\n').filter(Boolean);
  assert.equal(first[0], '> prospection (pro•spe•kshen)');
  assert.ok(!first.some(l => /Journey to|CHAPTER 1/.test(l)), 'title lines are not repeated in the text');
  assert.ok(first.some(l => l.startsWith('PRIESTS VOW')), 'the capitalised opening is body text, not a quote');
  // A price stays a number; a note number becomes a link to the chapter's note.
  assert.match(one.text, /\$30,000/);
  assert.match(one.text, /note\.¹/);
  assert.match(one.notes['1'], /Roberts/);
});

test('reflowed lines join into paragraphs, and bullets stay separate', () => {
  const html = `<html><body>${['<p>First line of a sentence that</p>', '<p>keeps going to the end.</p>', '<p>• One point (TX)</p>', '<p>• Another point</p>', ...Array.from({length: 45}, (_, i) => `<p>filler line ${i} without an ending</p>`)].join('')}</body></html>`;
  const doc = parser.parseFromString(html, 'text/html');
  const {chapters} = EpubStructure.parse({spine: [{path: 'a.html', doc}], toc: [{path: 'a.html', fragment: '', label: 'Only', depth: 0}]});
  const lines = chapters[0].text.split('\n').filter(Boolean);
  assert.equal(lines[0], 'First line of a sentence that keeps going to the end.');
  assert.equal(lines[1], '• One point (TX)');
  assert.equal(lines[2].startsWith('• Another point'), true);
});
