// A small invented library for tests. The open edition ships no books, so every
// test that needs a "bundled" book, its prepared lessons or its 30-min version
// uses this fixture. All text here is original and written for the tests.
import {createHash} from 'node:crypto';
import {buildLesson} from '../../lib/lesson-maker.mjs';
import {normalizeParagraphs} from '../../lib/guide-core.mjs';

const chapter = (id, title, paragraphs, extra = {}) => ({id, title, text: paragraphs.join('\n\n'), ...extra});

const routines = [
  'The author begins with a simple observation about routines: small actions repeated every day shape far more of a week than the rare dramatic decisions people tend to remember afterwards.',
  'A routine, the author argues, is held in place by its surroundings. When the cue, the setting and the reward stay the same, the action keeps happening even after the original reason for it has faded away.',
  'The chapter then adds a qualification. Changing the surroundings does not change behaviour by itself, because people carry old expectations with them, and those expectations can rebuild the old routine somewhere new.',
  'To make the point concrete, the author describes a kitchen in which the kettle sits beside the biscuit tin, so that every cup of tea comes with a snack that nobody actually decided to eat.',
  'Moving the tin to a high cupboard helped for a while, the author reports, but the habit returned whenever visitors arrived and the tin came back down to the counter for the afternoon.',
  'The author closes the chapter by warning that no single trick settles the matter. Lasting change, the chapter suggests, needs attention to the cue, the setting and the expectation together, over many weeks.',
];
const notes = [
  'The second chapter turns from routines to notes. The author notices that most notes are written with care and then never read again, which makes the effort of writing them almost entirely wasted.',
  'A note becomes useful, the author argues, only when it is written for a later reader who has forgotten the context. That later reader is usually the same person, a few weeks older and much busier.',
  'The chapter qualifies this claim straight away. A note that tries to keep everything ends up as long as the original source, and a long note is skipped for the same reason the source was.',
  'As an example, the author describes a gardener who keeps one card per bed, listing only what was planted, when it went in, and the single thing that went wrong last season.',
  'The cards are short enough to read while standing in the garden, the author explains, and that is why the gardener actually reads them before each planting rather than repeating last year’s mistake.',
  'The author ends by suggesting that the test of a note is simple: whether it changes what happens the next time the same situation comes around, not how complete or tidy it looks on the page.',
];
const weeks = [
  'The final chapter puts the earlier ideas together and asks how a whole week can stay steady. The author observes that most plans fail on the third or fourth day, when the first enthusiasm has worn off.',
  'A steady week, the author argues, depends on a few fixed anchors rather than on a full timetable. When a handful of moments are protected, the rest of the week can bend without the plan collapsing.',
  'The chapter adds a limit to this advice. Anchors that are chosen for an ideal week rather than for the real one are dropped quickly, and each dropped anchor makes the next one easier to abandon.',
  'The author illustrates the point with a household that keeps one fixed evening for shopping and cooking ahead. Everything else in the week moves around that evening, and the meals mostly take care of themselves.',
  'When that household tried to add a second fixed evening for cleaning, the author notes, both anchors began to slip, because the second one competed with time the family already used for rest.',
  'The author closes the book by returning to small routines. A week stays steady, the chapter concludes, when its anchors are few, honest about real life, and reviewed with short notes that actually get read.',
];

export const sampleBook = {
  id: 'sample-routines-book', title: 'An Invented Book About Routines', author: 'Example Author', fullTitle: 'An Invented Book About Routines: Notes on Small Habits', cover: '',
  sourceFormat: 'EPUB', sourceType: 'book',
  chapters: [
    chapter('contents', 'Contents', ['Small Routines', 'Notes That Get Used', 'Keeping the Week Steady', 'About the Author']),
    chapter('copyright', 'Copyright', ['Copyright 2026 Example Author. All rights reserved. This book is an invented test fixture.']),
    chapter('c1', 'Small Routines', routines, {label: 'Chapter 1'}),
    chapter('c2', 'Notes That Get Used', notes, {label: 'Chapter 2'}),
    chapter('c3', 'Keeping the Week Steady', weeks, {label: 'Chapter 3'}),
    chapter('about', 'About the Author', ['Example Author is an invented writer who exists only in this test fixture.']),
  ],
};
export const LESSON_CHAPTERS = ['c1', 'c2', 'c3'];

/** The hash scripts/build-reader.mjs and lib/cloud-validation.ts compute for an edition. */
export function bookHash(book) {
  return createHash('sha256').update(JSON.stringify({id: book.id, title: book.title, author: book.author, chapters: book.chapters.map(({id, title, text}) => ({id, title, text}))})).digest('hex');
}

const words = (text, from, n) => text.split(' ').slice(from, from + n).join(' ');
const q = (p, from = 0, n = 10) => ({p: p.id, text: words(p.text, from, n)});

/** A draft the way the AI writes it in production, for one chapter of the sample book. */
export function sampleDraft(ch) {
  const paragraphs = normalizeParagraphs(ch), [a, b, c, d] = paragraphs.filter(p => p.text.length > 120);
  const topic = ch.title.toLowerCase();
  return {
    title: `What “${ch.title}” argues`,
    gist: `The chapter on ${topic} makes one argument and supports it with an everyday example. It closes with a limit.`,
    picture: {kind: 'loop', title: 'One loop', takeaway: `In ${topic}, each step feeds the next and the loop returns.`, parts: [{label: 'Claim', meaning: 'The opening idea of the chapter.'}, {label: 'Limit', meaning: 'The qualification the author adds.'}, {label: 'Example', meaning: 'The everyday case that makes it concrete.'}], caption: 'A companion picture of the chapter.'},
    concepts: [
      {title: 'The opening claim', explanation: `The author opens with a claim: ${words(a.text, 0, 16)}.`, quote: q(a)},
      {title: 'The qualification', explanation: `Then the author adds a qualification: ${words(b.text, 0, 16)}.`, quote: q(b, 2)},
      {title: 'The example', explanation: `An example makes it concrete: ${words(c.text, 0, 16)}.`, quote: q(c, 1)},
    ],
    principles: [{title: 'A stated principle', explanation: 'Stated by the author in the chapter.', fromAuthor: true, quote: q(d)}, {title: 'Our reading', explanation: 'An interpretation of the chapter.', fromAuthor: false}],
    flow: {kind: 'sequence', steps: [{label: 'Claim', detail: 'The opening claim.'}, {label: 'Limit', detail: 'The qualification.'}, {label: 'Example', detail: 'The example.'}], links: [{from: 1, to: 2, label: 'then'}, {from: 2, to: 3, label: ''}], caption: 'Arrows show order.', limit: 'A simplified map.'},
    path: {previous: 'Before this, the book set out its question.', current: `This section looks at ${topic}.`, next: 'Next comes the following chapter.', thread: 'Fictional thread: a volunteer plans a weekly routine.'},
    analogy: {situation: 'Fictional example: a teacher plans the week.', mapping: 'Like the claim, the plan holds when its setting holds.', limit: 'It breaks down when the week changes.'},
    application: {scenario: 'Fictional example: a volunteer reviews a weekly rota.', steps: ['Name the one fixed moment.', 'Set a short review date.']},
    memoryCue: {cue: 'C-L-E', meaning: 'Claim, limit, example.', pieces: [{key: 'C', meaning: 'Claim'}, {key: 'L', meaning: 'Limit'}, {key: 'E', meaning: 'Example'}], caution: 'Leaves out nuance.'},
    recall: [
      {question: `What does the author claim first about ${topic}?`, answer: `That ${words(a.text, 0, 12)}.`},
      {question: `Which limit does the author add about ${topic}?`, answer: `That ${words(b.text, 0, 12)}.`},
    ],
    cautions: ['Only one chapter.'],
    reading: {
      passage: [`Example Author makes the case about ${topic} across the chapter, moving from a plain claim to the limit that keeps it honest. `.repeat(2).trim(), 'A second paragraph adds the everyday example from the chapter itself, and shows where the idea stops working. '.repeat(2).trim()],
      connect: 'The claim leads to the limit, and the limit leads to the example.',
      forward: `The chapter on ${topic} builds from one claim to its limit and then to an example from the text itself, which Example Author carries into the next chapter. `.repeat(2).trim(),
    },
    checks: [
      {type: 'pick', question: 'What comes first in the chapter?', options: [{text: 'The claim', correct: true, why: 'It opens the chapter.'}, {text: 'The example', correct: false, why: 'It comes later.'}, {text: 'The limit', correct: false, why: 'It comes second.'}], quote: q(a)},
      {type: 'book', claim: 'The author qualifies the opening claim.', answer: 'said', why: 'The chapter says so.', quote: q(b, 2)},
      {type: 'order', question: 'Put these in the order the chapter gives them.', steps: ['Claim', 'Limit', 'Example'], why: 'That is the sequence.', quote: q(c, 1)},
      {type: 'mistake', question: 'Which statement misreads the chapter?', options: [{text: 'It opens with a claim.', wrong: false, why: 'True.'}, {text: 'It never qualifies anything.', wrong: true, why: 'It does.'}, {text: 'It gives an example.', wrong: false, why: 'True.'}], quote: q(d)},
      {type: 'pick', question: 'Which part is the qualification?', options: [{text: 'A limit', correct: true, why: 'Yes.'}, {text: 'A story', correct: false, why: 'No.'}, {text: 'A number', correct: false, why: 'No.'}], quote: q(b, 4)},
      {type: 'book', claim: 'The author says nothing ever changes.', answer: 'not', why: 'Not in the text.', quote: q(c, 3)},
    ],
    article: null,
  };
}

/** The unit a prepared (bundled) guide covers: the whole chapter. */
export const preparedUnit = ch => ({id: `${ch.id}:prepared`, chapterId: ch.id, chapterTitle: ch.title, part: 1, totalParts: 1, paragraphs: normalizeParagraphs(ch)});

export function preparedGuides(book, chapterIds = LESSON_CHAPTERS) {
  const hash = bookHash(book);
  return chapterIds.map(id => {
    const ch = book.chapters.find(c => c.id === id);
    return {bookId: book.id, unitId: `${id}:prepared`, chapterId: id, sourceHash: hash, prepared: true, model: 'Synthetic fixture lesson', createdAt: '2026-01-01T00:00:00.000Z', guide: buildLesson(sampleDraft(ch), preparedUnit(ch))};
  });
}

/** One seed-library entry ({book, guides}), the shape lib/seed-library.json holds. */
export const sampleEntry = () => structuredClone({book: sampleBook, guides: preparedGuides(sampleBook)});

/** The same invented book as a PDF edition with page links. */
export const samplePdfBook = {
  ...sampleBook, id: 'sample-routines-pdf', sourceFormat: 'PDF', sourcePdf: '/books/sample-routines-pdf.pdf',
  chapters: sampleBook.chapters.map((c, i) => ({...c, id: LESSON_CHAPTERS.includes(c.id) ? 'chapter-' + c.id.slice(1) : c.id, sourcePageStart: i * 4 + 1, sourcePageEnd: i * 4 + 4})),
};
export const samplePdfEntry = () => structuredClone({book: samplePdfBook, guides: preparedGuides(samplePdfBook, ['chapter-1', 'chapter-2', 'chapter-3'])});

/** The seed library as lib/seed-library.json would hold it if the open edition bundled books. */
export const sampleLibrary = () => [sampleEntry(), samplePdfEntry()];

/** A memory aid in the shape stored guides carry. */
export const sampleMnemonic = () => ({cue: 'C-S-E', meaning: 'Cue, setting, expectation: the three things that hold a routine in place.', items: [{letter: 'C', meaning: 'Cue: what starts the action.'}, {letter: 'S', meaning: 'Setting: where it happens.'}, {letter: 'E', meaning: 'Expectation: what people bring with them.'}], caution: 'A cue is a reminder, not a rule; the chapter adds limits.'});

/** A hand-written tap-check bank (the reader/tap-checks.json shape) for the sample book's first chapter. */
export function sampleTapBank(book = sampleBook) {
  const [p1, p2, , p4] = normalizeParagraphs(book.chapters.find(c => c.id === 'c1'));
  const src = (p, n = 8) => ({paragraphId: p.id, quote: words(p.text, 0, n)});
  const choices = (right, ...wrong) => [{label: right, feedback: 'Right. ' + right}, ...wrong.map(w => ({label: w, feedback: 'Not quite. The chapter says otherwise.'}))];
  return {[book.id]: {'c1:prepared': [
    {id: 'cue-first', format: 'pick', where: ['remember'], prompt: 'What holds a routine in place, according to the chapter?', choices: choices('Its surroundings: cue, setting and reward', 'Willpower alone', 'A written plan'), correctIndex: 0, source: src(p2)},
    {id: 'routine-order', format: 'order', where: ['remember'], prompt: 'Put the kitchen story in order.', choices: [], steps: ['Kettle beside the tin', 'Tin moved to a cupboard', 'Visitors arrive', 'Tin back on the counter', 'Habit returns'], display: [2, 0, 4, 1, 3], feedback: ['The tin moved away, then came back with visitors, and the habit returned.'], correctIndex: 0, source: src(p4)},
    {id: 'small-actions', format: 'book', where: ['remember'], prompt: 'Small repeated actions shape more of a week than rare big decisions.', choices: [], steps: [], display: [], feedback: ['Right. That is the opening observation.', 'The chapter does not say the opposite.', 'It is in the opening paragraph.'], correctIndex: 0, source: src(p1)},
    {id: 'spot-misreading', format: 'mistake', where: ['teach'], prompt: 'Tap the statement that misreads the chapter.', choices: [{label: 'Surroundings help keep a routine going.', feedback: 'That fits the chapter.'}, {label: 'Moving the tin settled the habit for good.', feedback: 'Right, that misreads it: the habit returned.'}, {label: 'Expectations can rebuild an old routine.', feedback: 'That fits the chapter.'}], correctIndex: 1, source: src(p4)},
  ]}};
}

// ---- the 30-min version ----
const tmSentences = {
  c1: ['Small actions repeated every day carry more of a week than the rare big decisions people remember.', 'A routine keeps going because its cue, its setting and its reward stay the same from one day to the next.', 'Even after the first reason for a habit fades, the surroundings keep prompting it.', 'Changing the setting helps, but people bring old expectations along, and those expectations can rebuild the habit somewhere new.', 'The kitchen story makes this plain: a kettle beside a biscuit tin turns every cup of tea into a snack.', 'Moving the tin worked for a while, until visitors arrived and the tin came back to the counter.', 'The lesson is that cue, setting and expectation have to be handled together, and over weeks rather than days.', 'No single trick settles the matter; steady attention does.'],
  c2: ['Most notes are written with care and then never read again, so the care is wasted.', 'A useful note is written for a later reader who has forgotten the context, usually the writer a few weeks on.', 'A note that tries to hold everything grows as long as its source and is skipped for the same reason.', 'The gardener keeps one card per bed, with only what was planted, when, and what went wrong last time.', 'Because the cards are short, they are read standing in the garden, right before the next planting.', 'That is the whole point: the card changes what happens next season.', 'The test of a note is whether it changes the next attempt, not how complete or tidy it looks.', 'Short notes that get read beat long notes that do not.'],
  c3: ['Most weekly plans fail on the third or fourth day, once the first enthusiasm wears off.', 'A steady week rests on a few fixed anchors rather than on a full timetable.', 'When a handful of moments are protected, the rest of the week can bend without collapsing.', 'Anchors chosen for an ideal week are dropped quickly, and each one dropped makes the next easier to abandon.', 'One household keeps a single evening for shopping and cooking ahead, and the meals mostly take care of themselves.', 'Adding a second fixed evening for cleaning made both anchors slip, because it competed with time already used for rest.', 'Few anchors, honest about real life, and reviewed with short notes: that is how the week holds.', 'The book ends where it began, with small routines doing the quiet work.'],
};
function tmParagraph(list, seed) {
  const out = [];
  for (let i = 0; out.join(' ').split(' ').length < 140; i++) out.push(list[(seed + i * 3) % list.length]);
  return out.join(' ');
}
/** A full 30-min version of the sample book that passes checkThirtyMin, strict included. */
export function sampleThirtyMin(book = sampleBook) {
  const titles = {c1: 'Small Routines', c2: 'Notes That Get Used', c3: 'Keeping the Week Steady'};
  const figs = {
    c1: [{kind: 'chain', title: 'What keeps a routine going', steps: [{label: 'Cue', note: 'The kettle goes on.'}, {label: 'Setting', note: 'The tin sits beside it.'}, {label: 'Reward', note: 'A snack with the tea.'}]}, {kind: 'contrast', left: {label: 'What we expect', points: ['Move the tin, end the habit', 'One change is enough']}, right: {label: 'What happens', points: ['Visitors bring the tin back', 'The habit returns']}}],
    c2: [{kind: 'scale', from: 'Kept everything', to: 'Kept the one point', marks: [{at: 10, label: 'A copy of the source'}, {at: 85, label: 'The gardener’s card'}]}, {kind: 'terms', items: [{term: 'Later reader', meaning: 'You, weeks from now, without the context.'}, {term: 'Useful note', meaning: 'One that changes the next attempt.'}]}],
    c3: [{kind: 'stack', title: 'A steady week', layers: [{label: 'Few anchors', note: 'One protected evening.'}, {label: 'Flexible days', note: 'Everything else bends.'}, {label: 'Short review', note: 'A note that gets read.'}]}, {kind: 'cycle', steps: [{label: 'Anchor'}, {label: 'Week bends'}, {label: 'Review'}, {label: 'Adjust'}]}],
  };
  const ids = ['c1', 'c2', 'c3'], next = {c1: 'Notes That Get Used', c2: 'Keeping the Week Steady', c3: 'the closing'};
  const sections = ids.map((id, n) => {
    const list = tmSentences[id], blocks = [];
    for (let i = 0; i < 14; i++) {
      blocks.push({p: tmParagraph(list, i + n)});
      if (i === 1) blocks.push({fig: figs[id][0]});
      if (i === 6) blocks.push({pull: list[0]});
      if (i === 8) blocks.push({h: 'Where the idea stops'});
      if (i === 10) blocks.push({fig: figs[id][1]});
    }
    return {covers: [id], label: 'Chapter ' + (n + 1), title: titles[id], idea: list[0], blocks, carry: `${list[6]} The idea carries into ${next[id]}.`};
  });
  return {
    bookId: book.id,
    thread: 'Small, steady routines, held by their surroundings and kept honest by short notes, shape a life more than rare big decisions.',
    opening: ['Example Author argues that the quiet, repeated parts of a week matter more than the dramatic ones. The book follows that idea from habits in a kitchen, to notes in a garden, to the shape of a whole week.'],
    sections,
    closing: ['Small routines, notes that get used, and a steady week turn out to be one idea seen three ways. Each depends on a few honest anchors and on short reviews that actually happen, and together they carry the book’s thread to its end.'],
  };
}
