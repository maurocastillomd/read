import test from 'node:test';
import assert from 'node:assert/strict';
import {thirtyMinPlan, sectionFromText, frameFromText, assembleThirtyMin, sectionRequest, frameRequest} from './thirty-min-maker.mjs';
import {checkThirtyMin} from './thirty-min-core.mjs';
import {sampleBook, sampleThirtyMin} from '../tests/fixtures/sample-library.mjs';

const para = (n, word = 'idea') => Array.from({length: n}, (_, i) => `${word} ${i}`).join(' ') + '.';
const chapter = (id, title, words) => ({id, title, text: Array.from({length: Math.ceil(words / 100)}, () => para(100)).join('\n')});

test('long chapters get a section each; short ones join their neighbours; skipped matter stays out', () => {
  const book = {id: 'b', title: 'B', author: 'A', chapters: [chapter('toc', 'Contents', 200), chapter('i', 'Introduction', 900), chapter('c1', 'One', 5000), chapter('c2', 'Two', 300), chapter('c3', 'Three', 300), chapter('c4', 'Four', 5000), chapter('e', 'Afterword', 800), chapter('a', 'About the Author', 150)]};
  const plan = thirtyMinPlan(book);
  assert.deepEqual(plan.map(s => s.covers), [['i'], ['c1'], ['c2', 'c3'], ['c4'], ['e']]);
  assert.deepEqual(plan.map(s => s.label), ['Introduction', 'Chapter 1', 'Chapters 2–3', 'Chapter 4', 'Closing']);
  const total = plan.reduce((n, s) => n + s.target, 0);
  assert.ok(total > 5500 && total < 7600, 'about 30 minutes in all: ' + total);
});

test('cover, title, copyright and author notes stay out, even ones lessons keep', () => {
  const book = {id: 'b', title: 'B', chapters: [chapter('cv', 'Cover', 300), chapter('c5', 'Chapter 5', 4000), chapter('p6', 'Part VI', 4000), chapter('n', 'A Note about the Author', 300), chapter('cp', 'Copyright Page', 200), chapter('ix', 'Index', 900)]};
  const plan = thirtyMinPlan(book);
  assert.deepEqual([...new Set(plan.flatMap(s => s.covers))], ['c5', 'p6']);
});

test('a book with two real chapters splits the longest at a paragraph break to reach three sections', () => {
  const book = {id: 'b', title: 'B', chapters: [chapter('c5', 'Chapter 5', 9000), chapter('p6', 'Part VI', 4000)]};
  const plan = thirtyMinPlan(book);
  assert.deepEqual(plan.map(s => s.covers), [['c5'], ['c5'], ['p6']]);
  assert.deepEqual(plan.map(s => s.label), ['Chapter 5 · 1 of 2', 'Chapter 5 · 2 of 2', 'Part VI']);
  assert.deepEqual(plan.map(s => s.part || null), [[1, 2], [2, 2], null]);
  // The two halves hold the whole chapter, each paragraph once.
  assert.equal(plan[0].parts[0].paragraphs.length + plan[1].parts[0].paragraphs.length, 90);
  assert.match(JSON.parse(sectionRequest('m', book, plan, plan[1]).messages[0].content).text, /^# Chapter 5 \(part 2 of 2\)/);
  // A version built from it passes the reader's check, chapter 5 covered by both halves.
  const sections = plan.map(p => sectionFromText(JSON.stringify({idea: 'I.', carry: 'C.', blocks: [{p: 'a'}, {fig: {kind: 'stat', value: '1', label: 'x'}}, {p: 'b'}]}), p).section);
  assert.deepEqual(checkThirtyMin(assembleThirtyMin(book, frameFromText('', book, sections), sections)).errors, []);
});

test('a book that cannot reach three sections is refused before anything is sent', () => {
  const one = {id: 'b', title: 'B', chapters: [{id: 'c', title: 'Only', text: para(800) + '\n' + para(800)}]};
  assert.throws(() => thirtyMinPlan(one), /too short/);
  assert.throws(() => thirtyMinPlan({id: 'b', title: 'B', chapters: [chapter('c', 'Short', 400)]}), /too short/);
});

test('never more than 18 sections', () => {
  const book = {id: 'b', title: 'B', chapters: Array.from({length: 60}, (_, i) => chapter('c' + i, 'Chapter ' + i, 2000))};
  assert.ok(thirtyMinPlan(book).length <= 18);
});

test('a reply becomes a section: broken pictures and writing prompts are dropped, long text is trimmed', () => {
  const plan = {covers: ['c1'], label: 'Chapter 1', title: 'One'};
  const reply = 'Here it is: ' + JSON.stringify({idea: 'Structure makes behavior.', carry: 'Next comes the zoo.', blocks: [
    {p: 'First paragraph about stocks and flows.'}, {fig: {kind: 'chain', steps: [{label: 'Inflow'}, {label: 'Stock'}, {label: 'Outflow'}]}},
    {fig: {kind: 'contrast', left: {label: 'Only one side'}}}, {fig: {kind: 'spiral'}},
    {p: 'Second paragraph.'}, {p: 'Take a moment to write down three stocks in your life.'}, {pull: 'Structure decides.'}, {h: 'Dangling'}]});
  const {section, error} = sectionFromText(reply, plan);
  assert.equal(error, undefined);
  assert.deepEqual(section.blocks.map(b => Object.keys(b)[0]), ['p', 'fig', 'p', 'pull']);
  assert.equal(section.title, 'One');
});

test('a reply without a picture or enough text fails, so it can be retried', () => {
  assert.match(sectionFromText(JSON.stringify({idea: 'x', blocks: [{p: 'a'}, {p: 'b'}]}), {covers: ['c']}).error, /picture/);
  assert.match(sectionFromText('not json', {covers: ['c']}).error, /could not be read/);
});

test('the frame falls back to plain framing; the assembled version passes the reader check', () => {
  const book = {id: 'b', title: 'B', author: 'A', chapters: [{id: 'c1'}, {id: 'c2'}, {id: 'c3'}]};
  const sections = ['c1', 'c2', 'c3'].map((c, i) => ({covers: [c], label: 'Chapter ' + (i + 1), title: 'T' + i, idea: 'Idea ' + i + '.', carry: 'On.', blocks: [{p: 'One.'}, {fig: {kind: 'stat', value: '2×', label: 'Twice'}}, {p: 'Two.'}]}));
  const frame = frameFromText('garbage', book, sections);
  assert.equal(frame.thread, 'Idea 0.');
  const v = assembleThirtyMin(book, frame, sections);
  assert.equal(v.bookId, 'b');
  assert.deepEqual(checkThirtyMin(v).errors, []);
});

test('requests use the cheap model settings and cache the instructions', () => {
  const book = {id: 'b', title: 'B', chapters: [chapter('c1', 'One', 3000), chapter('c2', 'Two', 3000), chapter('c3', 'Three', 3000)]};
  const plan = thirtyMinPlan(book), r = sectionRequest('m', book, plan, plan[0]);
  assert.equal(r.model, 'm'); assert.equal(r.thinking.type, 'disabled');
  assert.equal(r.system[0].cache_control.type, 'ephemeral');
  assert.match(JSON.parse(r.messages[0].content).write.next, /Chapter 2/);
  assert.match(frameRequest('m', book, plan.map(s => ({...s, idea: 'i'}))).messages[0].content, /"idea":"i"/);
});

test('a full-length version passes the strict check against its book, and the strict check catches what the plain one allows', () => {
  // The open edition bundles no 30-min versions; an invented one exercises the strict rules.
  const v = sampleThirtyMin(), chapterIds = sampleBook.chapters.map(c => c.id);
  const r = checkThirtyMin(v, {strict: true, chapterIds});
  assert.deepEqual(r.errors, []);
  assert.ok(r.minutes >= 27 && r.minutes <= 33, 'reads in ' + r.minutes + ' min');
  assert.equal(r.sections, 3); assert.equal(r.figures, 6);
  assert.match(checkThirtyMin(v, {strict: true, chapterIds: ['c1', 'c2']}).errors.join(), /unknown chapter c3/);
  const short = {...v, sections: v.sections.map(s => ({...s, blocks: s.blocks.slice(0, 4)}))};
  assert.deepEqual(checkThirtyMin(short).errors, [], 'a short version is fine for the plain check');
  assert.match(checkThirtyMin(short, {strict: true}).errors.join(), /length: \d+ words/);
  const oneFigure = {...v, sections: v.sections.map((s, i) => i ? s : {...s, blocks: s.blocks.filter(b => b.fig?.kind !== 'contrast')})};
  assert.deepEqual(checkThirtyMin(oneFigure).errors, []);
  assert.match(checkThirtyMin(oneFigure, {strict: true}).errors.join(), /section 1: at least 2 figures/);
  const twice = {...v, sections: v.sections.map((s, i) => i === 1 ? {...s, covers: ['c1']} : s)};
  assert.match(checkThirtyMin(twice).errors.join(), /chapter covered twice c1/);
});

test('a figure keeps its picture plan only when every part has one known object', () => {
  const plan = {covers: ['c1'], label: 'Chapter 1', title: 'One'};
  const steps = [{label: 'Inflow'}, {label: 'Stock'}, {label: 'Outflow'}];
  const figs = [
    {kind: 'chain', steps, objects: ['faucet', 'bathtub', 'Gauge']},
    {kind: 'cycle', steps, objects: ['faucet', 'bathtub']},
    {kind: 'contrast', left: {label: 'A', points: ['x', 'y']}, right: {label: 'B', points: ['x', 'y']}, objects: ['jar', 'spaceship']},
    {kind: 'stat', value: '3', label: 'x', objects: ['jar']},
  ];
  const {section} = sectionFromText(JSON.stringify({idea: 'I.', carry: 'C.', blocks: [{p: 'a'}, ...figs.map(fig => ({fig})), {p: 'b'}]}), plan);
  const got = section.blocks.filter(b => b.fig).map(b => b.fig.scene || null);
  assert.deepEqual(got, [{objects: ['faucet', 'bathtub', 'gauge'], link: 'path'}, null, null, null]);
});
