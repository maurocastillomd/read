import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLesson, fit, lessonFromText, lessonPrompt, LessonError, makeAnchor, readDraft, tapSafe} from '../lib/lesson-maker.mjs';
import {lessonRequest, parseBatchResult, MAX_OUTPUT_TOKENS} from '../lib/generation-core.mjs';
import {normalizeParagraphs, planBook, validateGuide, WRITING_PROMPT} from '../lib/guide-core.mjs';

// A small invented book stands in for bundled seed data; the open version ships no books.
const syntheticText = [
  'The author begins with a simple observation about routines: small actions repeated every day shape far more of a week than the rare dramatic decisions people tend to remember afterwards.',
  'A routine, the author argues, is held in place by its surroundings. When the cue, the setting and the reward stay the same, the action keeps happening even after the original reason for it has faded away.',
  'The chapter then adds a qualification. Changing the surroundings does not change behaviour by itself, because people carry old expectations with them, and those expectations can rebuild the old routine somewhere new.',
  'To make the point concrete, the author describes a kitchen in which the kettle sits beside the biscuit tin, so that every cup of tea comes with a snack that nobody actually decided to eat.',
  'Moving the tin to a high cupboard helped for a while, the author reports, but the habit returned whenever visitors arrived and the tin came back down to the counter for the afternoon.',
  'The author closes the chapter by warning that no single trick settles the matter. Lasting change, the chapter suggests, needs attention to the cue, the setting and the expectation together, over many weeks.',
].join('\n\n');
const syntheticBook = {id: 'synthetic-book', title: 'An Invented Book About Routines', author: 'Example Author', sourceType: 'book', sourceFormat: 'EPUB', chapters: [{id: 'c6', title: 'Small Routines', text: syntheticText}]};
const seed = {book: syntheticBook};
const chapter = seed.book.chapters.find(c => c.id === 'c6');
const unit = {id: 'test:u1', chapterId: chapter.id, chapterTitle: chapter.title, part: 1, totalParts: 1, paragraphs: normalizeParagraphs(chapter)};
const long = unit.paragraphs.filter(p => p.text.length > 120);
const words = (text, from, n) => text.split(' ').slice(from, from + n).join(' ');
const q = (p, from = 0, n = 10) => ({p: p.id, text: words(p.text, from, n)});

/** A draft the way Claude writes it, with every field filled. */
function draft() {
  const [a, b, c, d] = long;
  return {
    title: 'What the chapter argues',
    gist: 'The chapter makes one argument and supports it with examples. It closes with a limit.',
    picture: {kind: 'loop', title: 'One loop', takeaway: 'Each step feeds the next.', parts: [{label: 'Start here', meaning: 'The first idea.'}, {label: 'Then this', meaning: 'The second idea.'}, {label: 'Back again', meaning: 'It returns.'}], caption: 'A companion picture.'},
    concepts: [
      // Explanations paraphrase the source, as real ones do.
      {title: 'First idea', explanation: `The author opens with a claim: ${words(a.text, 0, 16)}.`, quote: q(a)},
      {title: 'Second idea', explanation: `Then the author adds a qualification: ${words(b.text, 0, 16)}.`, quote: q(b, 2)},
      {title: 'Third idea', explanation: `An example makes it concrete: ${words(c.text, 0, 16)}.`, quote: q(c, 1)},
    ],
    principles: [{title: 'A principle', explanation: 'Stated by the author.', fromAuthor: true, quote: q(d)}, {title: 'Our reasoning', explanation: 'An interpretation.', fromAuthor: false}],
    flow: {kind: 'sequence', steps: [{label: 'Claim', detail: 'The opening claim.'}, {label: 'Limit', detail: 'The qualification.'}, {label: 'Example', detail: 'The example.'}], links: [{from: 1, to: 2, label: 'then'}, {from: 2, to: 3, label: ''}], caption: 'Arrows show order.', limit: 'A simplified map.'},
    path: {previous: 'Before this.', current: 'This section asks one question.', next: 'Next comes more.', thread: 'Fictional thread: a team lead reviews a weekly routine.'},
    analogy: {situation: 'Fictional example: a teacher plans the week.', mapping: 'Like the claim.', limit: 'It breaks down here.'},
    application: {scenario: 'Fictional example: a team lead reviews a handoff.', steps: ['Name the owner.', 'Set a review date.']},
    memoryCue: {cue: 'C-L-E', meaning: 'Claim, limit, example.', pieces: [{key: 'C', meaning: 'Claim'}, {key: 'L', meaning: 'Limit'}, {key: 'E', meaning: 'Example'}], caution: 'Leaves out nuance.'},
    recall: [{question: 'What does the author claim first?', answer: 'The opening claim.'}],
    cautions: ['Only one chapter.'],
    reading: {passage: ['Author makes the case across the chapter. '.repeat(4).trim(), 'A second paragraph adds an example from the chapter itself. '.repeat(3).trim()], connect: 'The claim leads to the limit, and the limit leads to the example.'},
    checks: [
      {type: 'pick', question: 'What comes first?', options: [{text: 'The claim', correct: true, why: 'It opens.'}, {text: 'The example', correct: false, why: 'Later.'}, {text: 'The limit', correct: false, why: 'Second.'}], quote: q(a)},
      {type: 'book', claim: 'The author qualifies the claim.', answer: 'said', why: 'It says so.', quote: q(b, 2)},
      {type: 'order', question: 'Put these in order.', steps: ['Claim', 'Limit', 'Example'], why: 'That is the sequence.', quote: q(c, 1)},
      {type: 'mistake', question: 'Which statement misreads the chapter?', options: [{text: 'It opens with a claim.', wrong: false, why: 'True.'}, {text: 'It never qualifies anything.', wrong: true, why: 'It does.'}, {text: 'It gives an example.', wrong: false, why: 'True.'}], quote: q(d)},
      {type: 'pick', question: 'Which is the qualification?', options: [{text: 'A limit', correct: true, why: 'Yes.'}, {text: 'A story', correct: false, why: 'No.'}, {text: 'A number', correct: false, why: 'No.'}], quote: q(b, 4)},
      {type: 'book', claim: 'The author says nothing ever changes.', answer: 'not', why: 'Not in the text.', quote: q(c, 3)},
    ],
    article: null,
  };
}
const build = (d, u = unit) => buildLesson(d, u);
const STRICT = u => ({requireMnemonic: true, requireTeachingContinuity: true, requireArticleAnalysis: u.sourceType === 'article', requireStatisticsLab: u.sourceType === 'article', requireChecks: true});

test('a complete draft becomes a stored lesson that passes the strict contract', () => {
  const guide = build(draft());
  assert.equal(validateGuide(guide, unit, STRICT(unit)), guide);
  assert.equal(guide.concepts.length, 3);
  assert.deepEqual(guide.chapterVisual.labels, ['Start here', 'Then this', 'Back again']);
  assert.equal(guide.checks.length, 6);
  assert.deepEqual(guide.flow.edges, [{from: 'n1', to: 'n2', label: 'then'}, {from: 'n2', to: 'n3', label: ''}]);
  assert.equal(guide.reading.passage.length, 2);
  assert.equal(guide.articleAnalysis, null);
  assert.deepEqual(guide.checks.map(c => c.where.join()).sort(), ['remember', 'remember', 'remember', 'remember', 'remember', 'teach']);
  assert.deepEqual(guide.checks.map(c => c.id), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']);
  assert.notDeepEqual(guide.checks.map(c => c.format), ['pick', 'book', 'order', 'mistake', 'pick', 'book'], 'formats are mixed, not in the example order');
  // The same section always gets the same answer positions.
  assert.deepEqual(build(draft()).checks, guide.checks);
});

test('slightly-off quotes snap to the exact source text instead of failing the lesson', () => {
  const p = long[0], anchor = makeAnchor(unit);
  const exact = words(p.text, 0, 12);
  assert.deepEqual(anchor({p: p.id, text: exact}), {paragraphId: p.id, quote: exact});
  assert.deepEqual(anchor({p: 'p999', text: exact}), {paragraphId: p.id, quote: exact}, 'wrong paragraph id');
  assert.deepEqual(anchor({p: p.id, text: `“${exact}”`}), {paragraphId: p.id, quote: exact}, 'wrapped in quote marks');
  const loose = exact.toUpperCase().replace(/ /g, '  ').replace(/'/g, '’');
  assert.deepEqual(anchor({p: p.id, text: loose}), {paragraphId: p.id, quote: exact}, 'case and spacing');
  const joined = `${words(p.text, 0, 6)} ... ${words(p.text, 12, 8)}`;
  const found = anchor({p: p.id, text: joined});
  assert.ok(p.text.includes(found.quote) && found.paragraphId === p.id, 'ellipsis-joined quote keeps a real piece');
  const paraphrase = anchor({p: p.id, text: 'nothing like this'}, words(p.text, 0, 30));
  assert.ok(paraphrase && unit.paragraphs.find(x => x.id === paraphrase.paragraphId).text.includes(paraphrase.quote), 'falls back to the closest real sentence');
  assert.equal(anchor({p: p.id, text: 'zebra quantum marmalade'}, ''), null, 'unrelated text is dropped');
  const longest = anchor({p: p.id, text: p.text});
  assert.ok(longest.quote.length <= 300 && p.text.includes(longest.quote));
  // Dashes and curly quotes differ between the PDF text and the reply.
  const dashed = {...unit, paragraphs: [{id: 'p1', text: 'Strength—not speed—was the “main” outcome measured at week 6.'}]};
  assert.deepEqual(makeAnchor(dashed)({p: 'p1', text: 'Strength-not speed-was the "main" outcome'}), {paragraphId: 'p1', quote: 'Strength—not speed—was the “main” outcome'});
});

test('broken optional parts are repaired or dropped, never the whole lesson', () => {
  const d = draft();
  d.checks[0].options[1].correct = true; // two right answers: dropped
  d.checks[1].answer = 'maybe'; // unknown book answer: dropped
  d.checks[2].steps = ['Only', 'two']; // too few steps: dropped
  d.checks.push({type: 'pick', question: 'Write a paragraph about the chapter.', options: [{text: 'a', correct: true}, {text: 'b'}, {text: 'c'}], quote: q(long[0])});
  d.checks.push({type: 'book', claim: 'The author qualifies the claim.', answer: 'said', choices: [{label: 'Agree'}], quote: q(long[1], 2)}); // duplicate prompt
  d.flow.links = [{from: 1, to: 9}, {from: 'Claim', to: 'Example', label: 'leads to'}];
  d.picture.kind = 'spiral'; d.picture.parts = d.picture.parts.slice(0, 1);
  d.memoryCue = {cue: '', pieces: []};
  d.recall = [{question: 'Describe the main argument.', answer: 'x'}, {question: 'Explain why the author qualifies it.', answer: 'Because.'}];
  d.application = {scenario: 'A team lead reviews a handoff.', steps: ['Write down the owner.']};
  d.concepts[0].explanation = 'Long. '.repeat(600);
  d.gist = undefined;
  const guide = build(d);
  assert.equal(validateGuide(guide, unit, STRICT(unit)), guide);
  assert.ok(guide.checks.length >= 4 && guide.checks.length <= 10);
  assert.ok(guide.checks.every(c => !WRITING_PROMPT.test(c.prompt)));
  assert.equal(guide.chapterVisual.kind, 'network');
  assert.equal(guide.chapterVisual.labels.length, 3);
  assert.ok(guide.flow.edges.some(e => e.label === 'leads to'));
  assert.ok(guide.mnemonic.items.length >= 1);
  assert.ok(guide.recall.length && guide.recall.every(r => /^What is the key point of/.test(r.question)), 'instructions to write are dropped, not reworded');
  assert.match(guide.application.scenario, /^Fictional example: A team lead/);
  assert.deepEqual(guide.application.steps, ['Compare the situation with the passage before deciding anything.']);
  assert.ok(guide.concepts[0].explanation.length <= 1800);
  assert.ok(guide.gist.length > 0);
});

test('too few tap questions are topped up from the lesson’s own quoted ideas', () => {
  const d = draft(); d.checks = d.checks.slice(0, 1);
  d.concepts.push({title: 'Fourth idea', explanation: 'A further point the chapter makes.', quote: q(long[4] || long[0], 5)});
  const guide = build(d);
  assert.ok(guide.checks.length >= 4);
  assert.ok(guide.checks.filter(c => c.format === 'book').every(c => c.feedback.length === 3 && c.correctIndex === 0));
});

test('a short opening section with no main ideas still becomes a lesson from its summary', () => {
  const d = {...draft(), concepts: [], principles: []};
  const guide = build(d);
  assert.equal(guide.concepts.length, 1);
  assert.equal(guide.concepts[0].explanation, d.gist);
  assert.equal(guide.principles[0].origin, 'interpretation');
  const opening = build({...d, gist: 'zebra quantum marmalade over the moon tonight'});
  assert.deepEqual(opening.concepts[0].sourceRefs[0].paragraphId, unit.paragraphs[0].id, 'no matching sentence: cite the opening of the section');
});

test('a reading passage given as one string with a blank line still counts', () => {
  const d = draft(); d.reading = {passage: d.reading.passage.join('\n\n'), connect: ''};
  const guide = build(d);
  assert.equal(guide.reading.passage.length, 2);
  assert.match(guide.reading.connect, /^The map moves through/);
});

test('a book lesson keeps a closing review that carries into the next chapter, and drops a bad one', () => {
  const forward = 'The chapter builds from one claim to its limit and then to an example from the text itself. '.repeat(3).trim();
  const d = draft(); d.reading = {...d.reading, forward};
  const guide = build(d);
  assert.equal(guide.reading.forward, forward);
  assert.doesNotThrow(() => validateGuide(guide, unit, {requireChecks: true}));
  for (const bad of ['Too short to carry anything.', 'Now write down in your journal what the chapter means to you and why it matters for the next one. '.repeat(3)]) {
    const g = build({...draft(), reading: {...draft().reading, forward: bad}});
    assert.equal(g.reading.forward, undefined, bad.slice(0, 20));
    assert.equal(g.reading.passage.length, 2, 'the opening passage stays');
  }
  assert.match(lessonPrompt(seed.book, unit).instructions, /forward is one paragraph/);
});

test('only missing core content fails, with a plain reason', () => {
  assert.throws(() => build({...draft(), concepts: [], gist: '', picture: {}}), LessonError);
  assert.throws(() => build({...draft(), gist: '', picture: {}, concepts: [{title: 'x', explanation: 'y', quote: {p: 'p1', text: 'zebra quantum marmalade'}}]}), /no main idea/);
  assert.match(lessonFromText('Sorry, I cannot help.', unit).error, /^The lesson could not be built: the reply contained no lesson\.$/);
  assert.match(lessonFromText('{"title": "cut off', unit).error, /no lesson|not complete JSON/);
  const article = {...unit, sourceType: 'article'};
  assert.match(lessonFromText(JSON.stringify(draft()), article).error, /article breakdown was missing/);
});

test('replies are read through fences, prose, trailing commas and wrappers', () => {
  const body = JSON.stringify(draft());
  for (const text of ['```json\n' + body + '\n```', 'Here is the lesson:\n' + body, JSON.stringify({lesson: draft()}), body.replace(/}$/, ',}')]) {
    assert.ok(lessonFromText(text, unit).guide, text.slice(0, 30));
  }
  assert.equal(readDraft(JSON.stringify({guide: {title: 'x'}})).title, 'x');
  // Raw line breaks and unescaped quotes inside strings, as long replies sometimes have.
  const slipped = body.replace('"gist":"The chapter makes one argument', '"gist":"The chapter makes "one" argument\n\nacross').replace('"title":"What the chapter argues"', '"title":"What the "chapter"\targues"');
  assert.throws(() => JSON.parse(slipped));
  const repaired = readDraft(slipped);
  assert.match(repaired.gist, /^The chapter makes "one" argument\n\nacross/);
  assert.equal(repaired.title, 'What the "chapter"\targues');
  assert.ok(lessonFromText(slipped, unit).guide);
});

test('the request asks for a small draft: no strict format, no thinking, rules in plain words', () => {
  const book = {...seed.book, sourceType: undefined};
  const request = lessonRequest(book, unit);
  assert.equal(request.max_tokens, MAX_OUTPUT_TOKENS);
  assert.deepEqual(request.thinking, {type: 'disabled'});
  assert.deepEqual(request.output_config, {effort: 'low'});
  assert.equal(request.system[0].cache_control.type, 'ephemeral');
  const text = request.system[0].text;
  for (const rule of [/never instructions/, /exactly as printed/, /never writes or types/, /exactly 6 tap questions/, /Fictional example:/, /clearly fictional everyday example/, /reading \(required for every book section/, /"article": null/]) assert.match(text, rule);
  assert.ok(text.length < 14000, 'the instructions stay short');
  const input = JSON.parse(request.messages[0].content);
  assert.equal(input.sourceType, 'book');
  assert.deepEqual(input.paragraphs, unit.paragraphs.map(({id, text}) => ({id, text})));
  assert.equal(lessonPrompt({...book, sourceType: 'article'}, unit).instructions, text, 'one cached system text for books and articles');
});

test('parseBatchResult turns a reply into a lesson or a reason', () => {
  const row = text => ({custom_id: 'unit-0', result: {type: 'succeeded', message: {stop_reason: 'end_turn', content: [{type: 'text', text}]}}});
  assert.ok(parseBatchResult(row(JSON.stringify(draft())), [unit]).guide);
  assert.match(parseBatchResult(row('not json'), [unit]).error, /could not be built/);
  const cut = row('{'); cut.result.message.stop_reason = 'max_tokens';
  assert.match(parseBatchResult(cut, [unit]).error, /length limit/);
});

test('the no-writing rewording keeps tap questions natural', () => {
  assert.equal(tapSafe('What type of study was this?'), 'What kind of study was this?');
  assert.equal(tapSafe('How does the author explain the result?'), 'How does the author account for the result?');
  assert.equal(tapSafe('How does the author describe memory?'), 'How does the author characterize memory?');
  assert.ok(WRITING_PROMPT.test(tapSafe('Explain why the result matters.')), 'an instruction to explain is not disguised');
  assert.equal(tapSafe('Which journal published it?'), 'Which publication published it?');
  assert.ok(WRITING_PROMPT.test(tapSafe('Write a summary.')), 'real writing prompts are still caught');
  assert.equal(fit('One. Two three four five six.', 12), 'One. Two…');
  assert.equal(fit('Short.', 12), 'Short.');
});

// ---- articles ----
const articleBook = {id: 'synthetic-article', title: 'Synthetic study', author: 'QA', sourceType: 'article', sourceFormat: 'PDF', chapters: [{id: 'article', title: 'Article', text: 'Researchers randomly assigned 40 teachers to two team-training formats.\n\nThe outcome was a prespecified communication score after six weeks. The mean difference was 2 points (p = 0.04), with a 95% confidence interval from -1 to 5.\n\nThe authors reported that participants came from one organization and follow-up was short.'}]};
const articleUnit = planBook(articleBook).units[0];
const [a1, a2, a3] = articleUnit.paragraphs;
function articleDraft() {
  const d = draft();
  d.concepts = [{title: 'The comparison', explanation: 'Teachers were randomly assigned to two formats.', quote: {p: a1.id, text: 'randomly assigned 40 teachers'}},
    {title: 'The outcome', explanation: 'A prespecified communication score after six weeks, with a mean difference of 2 points.', quote: {p: a2.id, text: 'The outcome was a prespecified communication score'}}];
  d.principles = [{title: 'Uncertainty', explanation: 'The interval includes zero.', fromAuthor: false}];
  d.checks = d.checks.map((c, i) => ({...c, quote: {p: [a1, a2, a3][i % 3].id, text: words([a1, a2, a3][i % 3].text, 0, 6)}}));
  d.reading = null;
  d.article = {
    kind: 'empirical-study', scope: 'The whole extracted article.',
    researchQuestion: {status: 'interpretation', text: 'Does the format matter?'},
    studyDesign: {status: 'reported', text: 'Randomized to two formats.', quotes: [{p: a1.id, text: 'randomly assigned 40 teachers'}]},
    population: {status: 'reported', text: '40 teachers.', quotes: [{p: a1.id, text: '40 teachers'}]},
    comparator: {status: 'reported', text: 'The other format.', quotes: [{p: 'p7', text: 'two team training formats'}]},
    outcomes: {status: 'reported', text: 'A communication score.', quotes: [{p: a2.id, text: 'prespecified communication score after six weeks'}]},
    results: [{status: 'reported', text: 'The mean difference was 2 points.', quotes: [{p: a2.id, text: 'The mean difference was 2 points'}]}],
    statistics: [{status: 'interpretation', text: 'The interval runs from -1 to 5, so no difference is still plausible.'}],
    limitations: [{status: 'reported', text: 'One organization; short follow-up.', quotes: [{p: a3.id, text: 'participants came from one organization'}]}],
    implications: [], criticalQuestions: ['How was the score measured?'],
    studyPicture: {design: 'randomized-trial', participants: 'Teachers', participantCount: 40, groups: [{label: 'Format A', count: null, receives: 'one format'}], duration: '6 weeks', outcomes: ['Communication score'], headline: {measure: 'Communication score', direction: 'no-clear-difference', magnitude: '2 points', favors: ''}, quotes: [{p: a1.id, text: 'randomly assigned 40 teachers'}]},
    numbers: [
      {kind: 'p-value', label: 'p for the difference', measure: 'p value', value: 0.04, operator: '=', comparison: 'Format A vs B', timepoint: 'six weeks', quote: {p: a2.id, text: 'The mean difference was 2 points (p = 0.04)'}, meaning: 'Data this far apart would be unusual if there were no difference.', caution: 'Not the chance the idea is true.'},
      {kind: 'estimate', label: 'Mean difference', measure: 'mean difference', value: '2', operator: '=', unit: 'points', interval: {low: -1, high: 5, level: 95, type: 'confidence'}, quote: {p: a2.id, text: 'The mean difference was 2 points (p = 0.04), with a 95% confidence interval from -1 to 5'}},
      {kind: 'effect-size', label: 'Invented effect size', measure: "Cohen's d", value: 0.8, quote: {p: a2.id, text: 'The mean difference was 2 points'}},
    ],
  };
  return d;
}

test('an article draft becomes a full breakdown; unverifiable numbers are left out', () => {
  const guide = build(articleDraft(), articleUnit);
  assert.equal(validateGuide(guide, articleUnit, STRICT(articleUnit)), guide);
  const a = guide.articleAnalysis;
  assert.equal(a.kind, 'empirical-study');
  assert.equal(a.comparator.status, 'reported', 'wrong id and dash style still anchor');
  assert.deepEqual(a.statisticsLab.metrics.map(m => [m.kind, m.value, m.interval?.level ?? null]), [['p-value', 0.04, null], ['estimate', 2, 95]]);
  assert.equal(a.studyVisual.participants.count, 40);
  assert.equal(a.implications.length, 1, 'an empty required list gets a plain fallback');
  assert.equal(a.criticalQuestions.length, 2);
  assert.equal(guide.reading, undefined, 'articles carry no book reading passage');
});

test('commentary gets no study picture or statistics, and unanchored claims are not called reported', () => {
  const d = articleDraft();
  d.article.kind = 'commentary';
  d.article.results = [{status: 'reported', text: 'Something not in the text at all.', quotes: [{p: 'p1', text: 'zebra quantum marmalade'}]}];
  delete d.article.studyDesign;
  const a = build(d, articleUnit).articleAnalysis;
  assert.equal(a.studyVisual, null); assert.equal(a.statisticsLab, null);
  assert.equal(a.results[0].status, 'interpretation');
  assert.equal(a.studyDesign.status, 'not-applicable');
});

test('a draft in the old stored-lesson shape is still accepted', () => {
  // A stored lesson (the shape the app saves) fed back in as a draft still builds.
  const stored = build(draft());
  const old = structuredClone(stored);
  const [p] = unit.paragraphs.filter(x => x.text.length > 60);
  old.checks = [0, 1, 2, 3].map(i => ({id: `x${i}`, format: 'book', where: ['remember'], prompt: `Claim ${i} from the chapter.`, choices: [], steps: [], display: [], feedback: ['a', 'b', 'c'], correctIndex: i % 3, source: {paragraphId: p.id, quote: p.text.slice(0, 40)}}));
  const guide = buildLesson(old, unit);
  assert.equal(validateGuide(guide, unit, STRICT(unit)), guide);
  assert.equal(guide.concepts[0].title, stored.concepts[0].title);
});

test('no draft, however broken, produces anything but a valid lesson or a plain reason', () => {
  let state = 7;
  const rand = () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const junk = [null, 0, 42, -1, '', ' ', 'x'.repeat(5000), [], {}, [null], [{}], true, 'Write about it in your own words.', {p: 'p1', text: 'zebra'}];
  const mutate = (value, depth = 0) => {
    if (Array.isArray(value)) return rand() < 0.05 ? junk[Math.floor(rand() * junk.length)] : value.filter(() => rand() > 0.1).map(v => mutate(v, depth + 1));
    if (value && typeof value === 'object') {
      if (rand() < 0.04) return junk[Math.floor(rand() * junk.length)];
      return Object.fromEntries(Object.entries(value).filter(() => rand() > 0.06).map(([k, v]) => [k, mutate(v, depth + 1)]));
    }
    if (rand() < 0.06) return junk[Math.floor(rand() * junk.length)];
    return value;
  };
  let built = 0, refused = 0; const reasons = {};
  for (let i = 0; i < 1500; i++) {
    const [base, u] = i % 2 ? [articleDraft(), articleUnit] : [draft(), unit];
    let guide;
    try { guide = buildLesson(mutate(base), u); }
    catch (error) { assert.ok(error instanceof LessonError, `iteration ${i}: ${error.message}`); refused++; reasons[error.message] = (reasons[error.message] || 0) + 1; continue; }
    assert.equal(validateGuide(guide, u, STRICT(u)), guide);
    built++;
  }
  // Every refusal names missing core content; most damaged drafts still become lessons.
  assert.ok(Object.keys(reasons).every(r => /no main idea|tap questions could be tied|article breakdown was missing/.test(r)), JSON.stringify(reasons));
  assert.ok(built > 1000, `${built} built, ${refused} refused: ${JSON.stringify(reasons)}`);
});
