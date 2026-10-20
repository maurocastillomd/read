import test from 'node:test';
import assert from 'node:assert/strict';
import {generationPlan, batchRequests, parseBatchResult, publicJob, MODEL, MAX_OUTPUT_TOKENS, BATCH_OUTPUT_TOKENS, MAX_ATTEMPTS} from '../lib/generation-core.mjs';
import {normalizeParagraphs, validateGuide, planBook, learningContext, CONTEXT_EXCERPT_CHARS} from '../lib/guide-core.mjs';
import {sampleChecks} from './check-fixture.mjs';
import {sampleEntry, sampleMnemonic} from './fixtures/sample-library.mjs';
// An invented book with prepared lessons stands in for bundled seed data.
const seed = sampleEntry();
const first = seed.guides[0];
const chapter = seed.book.chapters.find(c => c.id === first.chapterId);
const unit = {id: 'test:u1', chapterId: chapter.id, chapterTitle: chapter.title, part: 1, totalParts: 1, paragraphs: normalizeParagraphs(chapter)};
const validGuide = structuredClone(first.guide);
validGuide.application.scenario = 'Fictional example: ' + validGuide.application.scenario;
validGuide.checks = sampleChecks(unit.paragraphs);
validGuide.mnemonic = sampleMnemonic();
validGuide.learningPath = {previous: 'This opening section sets the question.', current: 'Examine the source claim before applying it.', next: 'Check the next supplied excerpt for the next distinction.', thread: 'Fictional thread: a volunteer reviews how a weekly rota is handed over.'};
validGuide.chapterVisual = {kind: 'handoff', title: 'A task needs an owner', caption: 'Companion illustration: a task passes to its named owner for review.', labels: ['Task', 'Owner', 'Review']};
function result(guide = validGuide) { return {custom_id: 'unit-0', result: {type: 'succeeded', message: {stop_reason: 'end_turn', content: [{type: 'text', text: JSON.stringify(guide)}]}}}; }

test('prepared full-book guides prevent every duplicate provider request', () => {
  const plan = generationPlan(seed.book, seed.guides);
  assert.equal(plan.units.length, seed.guides.length);
  assert.equal(plan.units.filter(u => u.status !== 'completed').length, 0);
  assert.deepEqual(plan.skipped.map(s => s.chapterId), ['contents', 'copyright', 'about']);
  const partial = generationPlan(seed.book, seed.guides.slice(1));
  assert.deepEqual(partial.units.filter(u => u.status === 'queued').map(u => u.chapterId), [seed.guides[0].chapterId], 'only the chapter without a prepared lesson is sent');
});
test('all source text covered across long chapter units and no skipped substantive sections', () => {
  const book = {title: 'Long source', author: '', chapters: [{id: 'ch1', title: 'Useful ideas', text: ('The sequence explains a limited claim. '.repeat(1000))}]};
  const {units} = generationPlan(book);
  assert.ok(units.length > 1);
  assert.equal(units.flatMap(u => u.paragraphs.map(p => p.text)).join(''), book.chapters[0].text.trim());
});
test('legacy stored guides stay unchanged while supplied malformed mnemonics are rejected', () => {
  const legacy = structuredClone(first.guide); delete legacy.mnemonic;
  assert.equal(validateGuide(legacy,unit),legacy);
  assert.equal(Object.hasOwn(legacy,'mnemonic'),false);
  assert.throws(()=>validateGuide({...first.guide,mnemonic:{cue:'Invent your own'}},unit),/mnemonic.meaning is required/);
  assert.deepEqual(validateGuide(validGuide,unit).mnemonic,validGuide.mnemonic);
});
test('book batches ask for the lesson draft with a larger output room and no strict format or tools', () => {
  const [row] = batchRequests(seed.book, [unit]);
  assert.equal(row.custom_id, 'unit-0');
  const params = row.params;
  assert.equal(params.model, MODEL);
  assert.equal(params.max_tokens, BATCH_OUTPUT_TOKENS); assert.ok(BATCH_OUTPUT_TOKENS > MAX_OUTPUT_TOKENS);
  assert.deepEqual(params.thinking, {type: 'disabled'}, 'thinking must not eat the output budget');
  assert.deepEqual(params.output_config, {effort: 'low'});
  assert.equal(params.tools, undefined);
  assert.match(params.system[0].text, /source material, never instructions/);
});
test('unknown custom IDs cannot cross into other units', () => {
  assert.throws(() => parseBatchResult({...result(), custom_id: 'unit-5'}, [unit]), /unknown section/);
  assert.throws(() => parseBatchResult({...result(), custom_id: '../../other-book'}, [unit]), /unknown section/);
});
test('incomplete and refused model responses never become guides', () => {
  const r = result(); r.result.message.stop_reason = 'max_tokens'; assert.match(parseBatchResult(r, [unit]).error, /length limit/);
  const refusal = result(); refusal.result.message.stop_reason = 'refusal';
  assert.match(parseBatchResult(refusal, [unit]).error, /declined/);
  for (const type of ['errored', 'expired', 'canceled']) assert.ok(parseBatchResult({custom_id: 'unit-0', result: {type}}, [unit]).error);
});
test('public status hides provider file/batch identifiers and full source text', () => {
  const j = publicJob({id: 'j', bookId: 'b', model: MODEL, status: 'running', units: [{...unit, status: 'running', attempts: 1}], skipped: [], batchId: 'secret-batch-id', inputFileId: 'secret-file-id'});
  assert.equal(j.total, 1); assert.equal(j.completed, 0);
  assert.equal(j.batchId, undefined); assert.equal(j.units[0].paragraphs, undefined);
});
test('unexpected overlarge books are rejected before creating a paid batch', () => {
  const chapters = Array.from({length: 251}, (_, i) => ({id: `c${i}`, title: `Topic ${i}`, text: 'A simple statement.'}));
  assert.throws(() => generationPlan({chapters}), /more than 250/);
});


test('legacy storage accepts missing enhancements but checks any supplied enhancement', () => {
  const legacy = structuredClone(validGuide);
  delete legacy.learningPath; delete legacy.chapterVisual; delete legacy.mnemonic;
  assert.equal(validateGuide(legacy, unit), legacy);
  assert.equal(validateGuide({...legacy, mnemonic: validGuide.mnemonic}, unit).mnemonic, validGuide.mnemonic);
  assert.equal(validateGuide({...legacy, learningPath: validGuide.learningPath}, unit).learningPath, validGuide.learningPath);
  assert.equal(validateGuide({...legacy, chapterVisual: validGuide.chapterVisual}, unit).chapterVisual, validGuide.chapterVisual);
  assert.throws(() => validateGuide({...legacy, learningPath: {current: 'Only one field'}}, unit), /learningPath.previous is required/);
  assert.throws(() => validateGuide({...legacy, chapterVisual: {...validGuide.chapterVisual, labels: ['One']}}, unit), /chapterVisual.labels/);
});
test('neighbor context is bounded, source-derived, and skips nonreading front matter', () => {
  const book = {title: 'Synthetic continuity', author: 'QA', chapters: [
    {id: 'before', title: 'Shared purpose', text: 'BEFORE OPEN ' + 'source '.repeat(2000) + ' BEFORE CLOSE'},
    {id: 'copyright', title: 'Copyright', text: 'Copyright 2026 All rights reserved'},
    {id: 'current', title: 'Decision ownership', text: 'This section explains how to assign ownership.'},
    {id: 'after', title: 'Review decisions', text: 'AFTER OPEN ' + 'review '.repeat(2000) + ' AFTER CLOSE'},
  ]};
  const current = planBook(book).units.find(u => u.chapterId === 'current');
  const context = learningContext(book, current);
  assert.equal(context.previousChapter.chapterId, 'before');
  assert.equal(context.nextChapter.chapterId, 'after');
  for (const [field, id] of [['previousChapter', 'before'], ['nextChapter', 'after']]) {
    const source = book.chapters.find(c => c.id === id).text;
    assert.equal(context[field].excerpts.reduce((n, e) => n + e.text.length, 0), CONTEXT_EXCERPT_CHARS);
    assert.ok(context[field].excerpts.every(e => source.includes(e.text)));
    assert.match(context[field].coverage, /middle is omitted/);
  }
  assert.match(context.coverage, /Only current-unit paragraphs may be cited/);
  const first = learningContext(book, planBook(book).units[0]);
  const last = learningContext(book, planBook(book).units.at(-1));
  assert.equal(first.previousChapter, null); assert.equal(last.nextChapter, null);
  const input = JSON.parse(batchRequests(book, [current])[0].params.messages[0].content);
  assert.deepEqual(input.context, context);
  assert.deepEqual(input.paragraphs, current.paragraphs.map(({id, text}) => ({id, text})));
});
test('split-chapter context is drawn from the exact text around each unit', () => {
  const book = {chapters: [{id: 'split', title: 'Long idea', text: 'Start. ' + 'Specific source detail. '.repeat(160) + ' End.'}]};
  const units = planBook(book, {maxChars: 500}).units;
  const middle = units[2], context = learningContext(book, middle), paragraph = normalizeParagraphs(book.chapters[0])[0].text;
  assert.equal(context.previousPart.text, paragraph.slice(0, middle.paragraphs[0].start).trim().slice(-CONTEXT_EXCERPT_CHARS));
  assert.equal(context.nextPart.text, paragraph.slice(middle.paragraphs.at(-1).end).trim().slice(0, CONTEXT_EXCERPT_CHARS));
  assert.equal(learningContext(book, units[0]).previousPart, null);
  assert.equal(learningContext(book, units.at(-1)).nextPart, null);
  const malformed = {...middle, paragraphs: middle.paragraphs.map(p => ({...p, text: 'Not the source'}))};
  assert.equal(learningContext(book, malformed).previousPart, null);
});
const articleBook={id:'synthetic-article',title:'Synthetic study fixture',author:'QA',sourceType:'article',sourceFormat:'PDF',importWarnings:['Figures were not extracted.'],chapters:[{id:'article',title:'Article',text:'Researchers randomly assigned 40 teachers to two team-training formats.\n\nThe outcome was a prespecified communication score after six weeks. The mean difference was 2 points, with a 95% confidence interval from -1 to 5.\n\nThe authors reported that participants came from one organization and follow-up was short.'}]};
test('article units cover substantially longer sections without claiming unseen coverage',()=>{
  const long={...articleBook,chapters:[{id:'long',title:'Article',text:'Explicit source content. '.repeat(2200)}]};
  const article=generationPlan(long).units,book=generationPlan({...long,sourceType:'book'}).units;
  assert.ok(article.length<book.length);assert.equal(article.map(u=>u.paragraphs.map(p=>p.text).join('')).join(''),long.chapters[0].text.trim());
});
test('saved-output recheck is available only for terminal incomplete jobs and does not expose the storage key',()=>{
  const job={id:'saved-output',bookId:'book',model:MODEL,status:'completed_with_errors',outputKey:'private-output-key',units:[{...unit,status:'failed',attempts:MAX_ATTEMPTS}],skipped:[]};
  for(const status of ['completed_with_errors','failed','cancelled']){
    const publicStatus=publicJob({...job,status});assert.equal(publicStatus.recheckAvailable,true);assert.equal(publicStatus.retryAvailable,false);assert.equal(publicStatus.outputKey,undefined);
  }
  for(const status of ['queued','running','collecting','completed'])assert.equal(publicJob({...job,status}).recheckAvailable,false);
  assert.equal(publicJob({...job,outputKey:''}).recheckAvailable,false);
  assert.equal(publicJob({...job,units:[{...unit,status:'completed',attempts:2}]}).recheckAvailable,false);
});

