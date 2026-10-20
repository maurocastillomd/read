import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./read-aloud.js', import.meta.url), 'utf8');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
function load(extra = {}) {
  const book = {id: 'b', title: 'Book', chapters: [{id: 'c1', title: 'One', label: 'Chapter 1'}, {id: 'c2', title: 'Two', label: 'Chapter 2'}]};
  const rec = {unitId: 'u1', chapterId: 'c1', guide: {title: 'One'}};
  const guide = {title: 'The first lesson', gist: 'Gist.', principles: [{title: 'Stocks change slowly', explanation: 'Flows fill them.\n\nDelays follow.'}]};
  const context = {esc, view: 'explore', activeBook: book, chapterId: 'c1', selectedUnit: 'u1', THIRTY_MIN_ID: '30-min', localStorage: {getItem: () => null, setItem() {}},
    bookGuides: () => [rec], roleContextGuide: () => guide, lessonCode: () => ({code: 'C1 · L1', long: 'Chapter 1 · Lesson 1', spoken: 'Chapter 1, lesson 1'}),
    ideaApplies: () => true, ideaVisual: () => ({takeaway: 'Systems hold their shape.', labels: ['Stock', 'Flow', 'Delay'], parts: ['What builds up.', 'What moves.', 'What lags.']}),
    ideaReadingText: () => ({passage: ['First brief paragraph.', 'Second brief paragraph.'], connect: 'They connect.', forward: 'Next comes chapter two.'}), ...extra};
  vm.createContext(context);
  vm.runInContext(source + ';this.api={raChunks,raClean,raRankVoices,raMinutesLeft,raLessonItems,raButton};', context);
  return context.api;
}

test('long paragraphs split into short pieces at sentence ends, never mid-word', () => {
  const {raChunks} = load();
  const text = 'A first sentence that is short. ' + 'Then a much longer sentence, with clauses, that keeps going and going '.repeat(6) + 'until it ends. Last one?';
  const chunks = raChunks(text, 120);
  assert.ok(chunks.length > 3);
  for (const c of chunks) assert.ok(c.length <= 121, c);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text.replace(/\s+/g, ' ').trim());
  assert.equal(raChunks('').length, 0);
  assert.equal(JSON.stringify(raChunks('One. Two.')), '["One. Two."]');
});

test('note numbers and code dots are not read out', () => {
  const {raClean} = load();
  assert.equal(raClean('Happiness¹² is hard · C1 · L1'), 'Happiness is hard, C1, L1');
});

test('voices: English only, better voices first, novelty voices never offered', () => {
  const {raRankVoices} = load();
  const ranked = [...raRankVoices([
    {name: 'Zarvox', lang: 'en-US', localService: true},
    {name: 'Thomas', lang: 'fr-FR', localService: true},
    {name: 'Fred', lang: 'en-US', localService: true},
    {name: 'Daniel', lang: 'en-GB', localService: true},
    {name: 'Samantha', lang: 'en-US', localService: true},
    {name: 'Ava (Premium)', lang: 'en-US', localService: true},
    {name: 'Evan (Enhanced)', lang: 'en_US', localService: true}
  ])].map(v => v.name);
  assert.ok(Array.isArray(ranked));
  assert.deepEqual(ranked, ['Ava (Premium)', 'Evan (Enhanced)', 'Samantha', 'Daniel']);
});

test('a lesson reads as a script: code and title, big idea, three parts, brief, reasoning, review', () => {
  const {raLessonItems} = load();
  const lines = [...raLessonItems().map(i => i.text)];
  assert.equal(lines[0], 'Chapter 1, lesson 1. One. The first lesson.');
  assert.equal(lines[1], 'The big idea. Systems hold their shape.');
  assert.deepEqual([...lines.slice(2, 5)], ['Stock. What builds up.', 'Flow. What moves.', 'Delay. What lags.']);
  assert.ok(lines.includes('The chapter in brief.'));
  assert.ok(lines.includes('Flows fill them.') && lines.includes('Delays follow.'));
  assert.equal(lines.at(-1), 'The chapter in review. Next comes chapter two.');
  assert.ok(!lines.some(l => /\?$/.test(l)), 'no questions are read');
});

test('time left follows the speed', () => {
  const {raMinutesLeft} = load();
  const items = Array.from({length: 10}, () => ({text: 'word '.repeat(165)}));
  assert.equal(raMinutesLeft(items, 0, 1), 10);
  assert.equal(raMinutesLeft(items, 5, 1), 5);
  assert.equal(raMinutesLeft(items, 0, 1.5), 7);
});

test('no Listen button where the browser has no voice', () => {
  assert.equal(load().raButton(), '');
  const html = load({window: {speechSynthesis: {getVoices: () => []}}, SpeechSynthesisUtterance: function () {}}).raButton();
  assert.match(html, /data-action="ra-start"/);
  assert.match(html, /aria-label="Listen/);
});
