/** Provider-independent EPUB learning-guide planning and validation. */
import {statisticsLabSchema, validateStatisticsLab} from './statistics-contract.mjs';

const DEFAULT_MAX_CHARS = 12000;
export const CONTEXT_EXCERPT_CHARS = 1200;
const objectSchema = properties => ({
  type: 'object', additionalProperties: false,
  properties, required: Object.keys(properties),
});
const stringSchema = (maxLength = 1400, minLength = 1) => ({type: 'string', minLength, maxLength});
const arraySchema = (items, minItems = 0, maxItems = 8) => ({type: 'array', items, minItems, maxItems});
const refSchema = objectSchema({paragraphId: stringSchema(100), quote: stringSchema(300)});
const evidenceItemSchema = objectSchema({
  status: {type:'string', enum:['reported','not-reported','not-applicable','interpretation']},
  text: stringSchema(1800), sourceRefs: arraySchema(refSchema,0,5),
});
// A picture of the study, drawn by the app: who took part, the groups, how long,
// what was measured, and which way the main result went. Labels are short.
const countSchema = {anyOf:[{type:'null'},{type:'number'}]};
export const STUDY_DESIGNS = ['randomized-trial','crossover-trial','non-randomized-trial','single-group','cohort','case-control','cross-sectional','case-series','qualitative','systematic-review','meta-analysis','narrative-review','commentary','other'];
const studyVisualSchema = objectSchema({
  design: {type:'string', enum:STUDY_DESIGNS},
  participants: objectSchema({label: stringSchema(80), count: countSchema}),
  groups: arraySchema(objectSchema({label: stringSchema(60), count: countSchema, receives: stringSchema(120, 0)}), 0, 4),
  duration: stringSchema(60, 0),
  outcomes: arraySchema(stringSchema(60), 0, 4),
  headline: objectSchema({
    measure: stringSchema(80, 0),
    direction: {type:'string', enum:['increase','decrease','no-clear-difference','mixed','not-applicable']},
    magnitude: stringSchema(100, 0), favors: stringSchema(60, 0),
  }),
  sourceRefs: arraySchema(refSchema, 1, 4),
});
const articleAnalysisSchema = objectSchema({
  kind: {type:'string', enum:['empirical-study','evidence-review','commentary','unclear']},
  scope: stringSchema(1200), statisticsLab: statisticsLabSchema, studyVisual: {anyOf:[{type:'null'},studyVisualSchema]},
  researchQuestion:evidenceItemSchema, studyDesign:evidenceItemSchema, population:evidenceItemSchema,
  comparator:evidenceItemSchema, outcomes:evidenceItemSchema,
  results:arraySchema(evidenceItemSchema,0,6), statistics:arraySchema(evidenceItemSchema,1,6), limitations:arraySchema(evidenceItemSchema,1,6),
  implications:arraySchema(evidenceItemSchema,1,5), criticalQuestions:arraySchema(stringSchema(800),2,5),
});

// Tap-only comprehension checks. The reader never types: every check has a right
// answer chosen by tapping. pick: best answer. mistake: tap the wrong statement.
// book: is this claim in the book, opposite to it, or absent (feedback per label).
// order: tap steps into sequence (display is the shuffled order shown).
const checkSchema = objectSchema({
  id: stringSchema(60),
  format: {type: 'string', enum: ['pick', 'mistake', 'book', 'order']},
  where: arraySchema({type: 'string', enum: ['remember', 'use', 'teach']}, 1, 3),
  prompt: stringSchema(400),
  choices: arraySchema(objectSchema({label: stringSchema(260), feedback: stringSchema(500)}), 0, 4),
  steps: arraySchema(stringSchema(160), 0, 6),
  display: arraySchema({type: 'integer'}, 0, 6),
  feedback: arraySchema(stringSchema(500), 0, 3),
  correctIndex: {type: 'integer'},
  source: refSchema,
});
export const checksSchema = arraySchema(checkSchema, 4, 10);
// Prompts that would ask the reader to produce writing are rejected everywhere.
export const WRITING_PROMPT = /\b(?:write|type|jot|journal|draft|compose|in (?:your|my) own words|put (?:it|this) into words|explain (?:it|this|that|why|how|what|the|to)|describe|summari[sz]e|list (?:three|two|four|five|some|the))\b/i;

/** The lesson contract every stored guide meets (lib/lesson-maker.mjs builds new ones). Semantic checks follow in validateGuide. */
export const schema = objectSchema({
  title: stringSchema(180),
  gist: stringSchema(1800),
  learningPath: objectSchema({
    previous: stringSchema(800), current: stringSchema(1000),
    next: stringSchema(800), thread: stringSchema(1000),
  }),
  chapterVisual: objectSchema({
    kind: {type: 'string', enum: ['handoff', 'loop', 'capacity', 'decision', 'layers', 'compass', 'release', 'network']},
    title: stringSchema(120), caption: stringSchema(800), labels: arraySchema(stringSchema(60), 3, 3),
    takeaway: stringSchema(180), parts: arraySchema(stringSchema(260), 3, 3),
  }),
  concepts: arraySchema(objectSchema({
    title: stringSchema(160), explanation: stringSchema(1800),
    sourceRefs: arraySchema(refSchema, 1, 5),
  }), 1, 8),
  principles: arraySchema(objectSchema({
    title: stringSchema(160), explanation: stringSchema(1400),
    origin: {type: 'string', enum: ['author', 'interpretation']},
    sourceRefs: arraySchema(refSchema, 0, 5),
  }), 1, 8),
  analogy: objectSchema({
    familiarSituation: stringSchema(1200), mapping: stringSchema(1600), limit: stringSchema(1000),
  }),
  flow: objectSchema({
    kind: {type: 'string', enum: ['sequence', 'decision', 'concept-map']},
    nodes: arraySchema(objectSchema({
      id: stringSchema(60), label: stringSchema(120), detail: stringSchema(600),
    }), 2, 10),
    edges: arraySchema(objectSchema({
      from: stringSchema(60), to: stringSchema(60), label: stringSchema(160, 0),
    }), 1, 15),
    caption: stringSchema(1000), limit: stringSchema(1000),
  }),
  application: objectSchema({scenario: stringSchema(1600), steps: arraySchema(stringSchema(800), 1, 6)}),
  mnemonic: objectSchema({
    cue: stringSchema(160), meaning: stringSchema(1000),
    items: arraySchema(objectSchema({letter: stringSchema(40), meaning: stringSchema(500)}), 1, 6),
    caution: stringSchema(500),
  }),
  recall: arraySchema(objectSchema({question: stringSchema(800), answer: stringSchema(1400)}), 1, 5),
  cautions: arraySchema(stringSchema(1000), 0, 6),
  checks: checksSchema,
  articleAnalysis: {anyOf:[{type:'null'},articleAnalysisSchema]},
  // About two paragraphs of plain reading on the chapter's argument, and how the map's ideas link. Books only.
  // forward (optional) closes the lesson: a review of the chapter that carries the idea into the next one.
  reading: {...objectSchema({passage: arraySchema(stringSchema(700), 2, 2), connect: stringSchema(450), forward: stringSchema(1000)}), required: ['passage', 'connect']},
});

// Older cloud guides and portable backups predate continuity, visuals, or memory
// cues. Missing enhancements stay optional in storage; supplied ones are checked.
// New lessons are built with every field; reading is books-only and always optional.
const OPTIONAL_STORED_FIELDS = new Set(['mnemonic', 'learningPath', 'chapterVisual', 'articleAnalysis', 'checks', 'reading']);
const storedArticleAnalysisSchema = {...articleAnalysisSchema, required: articleAnalysisSchema.required.filter(key=>!['statisticsLab','studyVisual'].includes(key))};
// Guides stored before the visual-first lesson have no takeaway or parts; the reader falls back to their concepts.
const storedChapterVisualSchema = {...schema.properties.chapterVisual, required: schema.properties.chapterVisual.required.filter(key => !['takeaway', 'parts'].includes(key))};
const storedSchema = {...schema, properties:{...schema.properties,chapterVisual:storedChapterVisualSchema,articleAnalysis:{anyOf:[{type:'null'},storedArticleAnalysisSchema]}}, required: schema.required.filter(key => !OPTIONAL_STORED_FIELDS.has(key))};

/**
 * Imported EPUBs keep structure as line prefixes: "## " heading, "> " quotation,
 * "~ " caption, and "![key]" for a figure. Figures carry no words.
 */
export function unmarkLine(line) {
  return /^!\[[\w.-]{1,60}\]$/.test(line) ? '' : line.replace(/^(?:## |> |~ )/, '');
}

/** Paragraph IDs are local to a chapter; text is normalized once before citing it. */
export function normalizeParagraphs(textOrChapter) {
  const text = typeof textOrChapter === 'string' ? textOrChapter : textOrChapter?.text;
  if (typeof text !== 'string') throw new TypeError('A chapter must contain text.');
  return text.replace(/\r\n?/g, '\n').split(/\n+/)
    .map(line => unmarkLine(line.replace(/[\t \f\v\u00a0]+/g, ' ').trim()))
    .filter(Boolean).map((text, i) => ({id: `p${i + 1}`, text}));
}

function skipReason(chapter) {
  if (chapter.studyRole === 'reference') return 'Reference material; available in the original reader.';
  // Title matches are deliberately narrow: short substantive chapters stay eligible.
  const title = chapter.title.trim().replace(/[.:]+$/, '').toLocaleLowerCase();
  const text = chapter.text;
  if (/^(?:table of )?contents$/.test(title)) return 'Table of contents; available in the reader.';
  if (/^(?:title|cover) page$/.test(title)) return 'Title or cover page; available in the reader.';
  if (/^copyright(?: (?:page|notice|information))?$/.test(title) && /©|all rights reserved|copyright\s+(?:\(c\)\s*)?\d{4}/i.test(text)) {
    return 'Copyright notice; available in the reader.';
  }
  if (/^(?:other|more) books(?: by .+)?$/.test(title) || /^also by .+$/.test(title)) {
    return 'Promotional book list; available in the reader.';
  }
  if (/^(?:your|a) free gift$/.test(title) && /gift|download|subscribe|newsletter/i.test(text)) {
    return 'Promotional offer; available in the reader.';
  }
  if (/^(?:did you enjoy (?:reading )?.+|please (?:leave|write) a review|a request for (?:a )?review)\??$/.test(title) && /review|amazon|rating/i.test(text)) {
    return 'Review request; available in the reader.';
  }
  if (/^about the author(?:s)?$/.test(title)) return 'Author biography; available in the reader.';
  return null;
}

function paragraphPieces(paragraph, maxChars) {
  const {id, text} = paragraph;
  if (text.length <= maxChars) return [{id, text, sourceParagraphId: id, start: 0, end: text.length}];
  const pieces = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end - 1);
      if (space >= start + Math.floor(maxChars / 2)) end = space + 1;
      // Do not divide a Unicode surrogate pair when no word boundary is available.
      if (end > start && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end])) end--;
    }
    pieces.push({id: `${id}.${pieces.length + 1}`, text: text.slice(start, end), sourceParagraphId: id, start, end});
    start = end;
  }
  return pieces;
}

/**
 * Every normalized paragraph is either covered in full by units or belongs to an
 * explicitly skipped chapter. includeSkipped is an explicit override for front matter.
 */
export function planBook(book, {maxChars = book?.sourceType === 'article' ? 40000 : DEFAULT_MAX_CHARS, includeSkipped = false} = {}) {
  if (!book || !Array.isArray(book.chapters)) throw new TypeError('A book must contain chapters.');
  if (!Number.isInteger(maxChars) || maxChars < 256 || maxChars > 100000) throw new RangeError('maxChars must be an integer from 256 to 100000.');
  const seen = new Set(), units = [], skipped = [], chapters = [];
  for (const chapter of book.chapters) {
    if (!chapter || typeof chapter.id !== 'string' || !chapter.id || typeof chapter.title !== 'string' || typeof chapter.text !== 'string') {
      throw new TypeError('Each chapter needs a unique string id, title, and text.');
    }
    if (seen.has(chapter.id)) throw new Error(`Duplicate chapter id: ${chapter.id}`);
    seen.add(chapter.id);
    const paragraphs = normalizeParagraphs(chapter);
    const reason = !paragraphs.length ? 'No readable text in this section.' : (!includeSkipped && skipReason(chapter));
    if (reason) {
      skipped.push({chapterId: chapter.id, title: chapter.title, reason});
      chapters.push({chapterId: chapter.id, title: chapter.title, status: 'skipped', unitIds: [], reason});
      continue;
    }
    const groups = [];
    let group = [], length = 0;
    for (const paragraph of paragraphs) {
      for (const piece of paragraphPieces(paragraph, maxChars)) {
        const addition = piece.text.length + (group.length ? 2 : 0);
        if (group.length && length + addition > maxChars) {
          groups.push(group); group = []; length = 0;
        }
        length += piece.text.length + (group.length ? 2 : 0);
        group.push(piece);
      }
    }
    if (group.length) groups.push(group);
    const unitIds = [];
    groups.forEach((paragraphs, i) => {
      const id = `${chapter.id}:u${i + 1}`;
      unitIds.push(id);
      units.push({
        id, chapterId: chapter.id, chapterTitle: chapter.title,
        ...(book.sourceType ? {sourceType:book.sourceType} : {}),
        index: units.length, part: i + 1, totalParts: groups.length,
        paragraphs, text: paragraphs.map(p => p.text).join('\n\n'),
      });
    });
    chapters.push({chapterId: chapter.id, title: chapter.title, status: 'queued', unitIds});
  }
  return {units, skipped, chapters};
}

/** Short source excerpts support orientation only, never citations for this unit. */
function chapterContext(chapter) {
  const text = chapter.text.replace(/\r\n?/g, '\n').trim();
  const half = CONTEXT_EXCERPT_CHARS / 2;
  return {chapterId: String(chapter.id).slice(0, 100), title: chapter.title.slice(0, 180),
    excerpts: text.length <= CONTEXT_EXCERPT_CHARS ? [{position: 'complete short section', text}] : [
      {position: 'opening excerpt', text: text.slice(0, half)},
      {position: 'closing excerpt', text: text.slice(-half)},
    ], coverage: text.length <= CONTEXT_EXCERPT_CHARS ? 'Complete short section.' : 'Opening and closing excerpts only; the middle is omitted.'};
}

/**
 * Bound context to the nearest readable chapters plus exact neighboring text
 * within a split chapter. No generated summaries or unprovided chapter claims.
 */
export function learningContext(book, unit) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const index = chapters.findIndex(chapter => chapter?.id === unit.chapterId);
  const context = {previousChapter: null, nextChapter: null, previousPart: null, nextPart: null,
    coverage: 'Adjacent-chapter excerpts and adjacent-part excerpts are limited orientation, not evidence that the whole book was read. Only current-unit paragraphs may be cited.'};
  if (index < 0) return context;
  const readable = chapter => chapter && typeof chapter.title === 'string' && typeof chapter.text === 'string' && chapter.text.trim() && !skipReason(chapter);
  for (let i = index - 1; i >= 0; i--) if (readable(chapters[i])) {context.previousChapter = chapterContext(chapters[i]); break;}
  for (let i = index + 1; i < chapters.length; i++) if (readable(chapters[i])) {context.nextChapter = chapterContext(chapters[i]); break;}
  const paragraphs = normalizeParagraphs(chapters[index]);
  const pieces = unit.paragraphs || [];
  const first = pieces[0], last = pieces.at(-1);
  const firstId = first?.sourceParagraphId || first?.id?.split('.')[0];
  const lastId = last?.sourceParagraphId || last?.id?.split('.')[0];
  const startIndex = paragraphs.findIndex(p => p.id === firstId), endIndex = paragraphs.findIndex(p => p.id === lastId);
  if (startIndex >= 0 && endIndex >= startIndex) {
    // Only use an offset if it anchors exactly in the original paragraph.
    const start = first.start ?? (first.id === firstId ? 0 : -1);
    const end = last.end ?? (last.id === lastId ? paragraphs[endIndex].text.length : -1);
    if (start >= 0 && end >= 0 && paragraphs[startIndex].text.slice(start, start + first.text.length) === first.text && paragraphs[endIndex].text.slice(end - last.text.length, end) === last.text) {
      const before = [...paragraphs.slice(0, startIndex).map(p => p.text), paragraphs[startIndex].text.slice(0, start)].join('\n\n').trim();
      const after = [paragraphs[endIndex].text.slice(end), ...paragraphs.slice(endIndex + 1).map(p => p.text)].join('\n\n').trim();
      if (unit.part > 1 && before) context.previousPart = {position: 'text immediately before this unit', text: before.slice(-CONTEXT_EXCERPT_CHARS)};
      if (unit.part < unit.totalParts && after) context.nextPart = {position: 'text immediately after this unit', text: after.slice(0, CONTEXT_EXCERPT_CHARS)};
    }
  }
  return context;
}

function validateShape(value, rule, path) {
  if(rule.anyOf){
    const valueType=value===null?'null':Array.isArray(value)?'array':typeof value;
    const branch=rule.anyOf.find(option=>option.type===valueType);
    if(!branch)throw new Error(`${path} has an invalid value.`);
    validateShape(value,branch,path);return;
  }
  if(rule.type==='null'){if(value!==null)throw new Error(`${path} must be null.`);return;}
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${path} must be an object.`);
    for (const key of rule.required) if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required.`);
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(rule.properties, key)) throw new Error(`${path}.${key} is not an allowed field.`);
      validateShape(value[key], rule.properties[key], `${path}.${key}`);
    }
  } else if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) throw new Error(`${path} must contain ${rule.minItems} to ${rule.maxItems} items.`);
    value.forEach((entry, i) => validateShape(entry, rule.items, `${path}[${i}]`));
  } else if (rule.type === 'integer') {
    if(!Number.isInteger(value))throw new Error(`${path} must be a whole number.`);
  } else if (rule.type === 'number') {
    if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${path} must be a finite number.`);
    if(rule.enum&&!rule.enum.includes(value))throw new Error(`${path} has an invalid value.`);
  } else if (rule.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${path} must be a string.`);
    if (rule.enum && !rule.enum.includes(value)) throw new Error(`${path} has an invalid value.`);
    if (rule.minLength !== undefined && (value.length < rule.minLength || (rule.minLength > 0 && !value.trim()))) throw new Error(`${path} is too short or empty.`);
    if (rule.maxLength !== undefined && value.length > rule.maxLength) throw new Error(`${path} exceeds ${rule.maxLength} characters.`);
  }
}

/** Validate one proposed metric without relaxing the full stored-guide contract. */
export function validateStatisticsMetric(metric, appraisal, paragraphs) {
  const metricSchema=statisticsLabSchema.anyOf.find(rule=>rule.type==='object').properties.metrics.items;
  validateShape(metric,metricSchema,'guide.articleAnalysis.statisticsLab.metrics[]');
  validateStatisticsLab({metrics:[metric]},appraisal,paragraphs);
  return metric;
}

/** Validate shape, exact source anchors, and a connected graph; return unchanged data. */
/** Semantic checks for tap questions: a real right answer, exact source, no writing. */
export function validateChecks(checks, paragraphs) {
  const ids = new Set();
  for (const [i, q] of checks.entries()) {
    if (ids.has(q.id)) throw new Error(`guide.checks[${i}].id must be unique.`);
    ids.add(q.id);
    validateCheck(q, i, paragraphs);
  }
  if (!checks.some(q => q.where.includes('remember'))) throw new Error('guide.checks needs at least one Remember check.');
  return checks;
}
/** One tap check's own rules (format, choices, steps, source quote). */
export function validateCheck(q, i, paragraphs) {
    const at = `guide.checks[${i}]`;
    if (WRITING_PROMPT.test(q.prompt)) throw new Error(`${at}.prompt asks the reader to write; checks must be answered by tapping.`);
    if (q.format === 'pick' || q.format === 'mistake') {
      if (q.choices.length < 3) throw new Error(`${at} needs 3 or 4 choices.`);
      if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) throw new Error(`${at}.correctIndex is out of range.`);
      if (q.steps.length || q.display.length) throw new Error(`${at} must not include steps.`);
      if (new Set(q.choices.map(c => c.label.trim().toLowerCase())).size !== q.choices.length) throw new Error(`${at} repeats a choice.`);
    } else if (q.format === 'book') {
      if (q.choices.length || q.steps.length) throw new Error(`${at} must use the three book labels, not choices.`);
      if (q.feedback.length !== 3 || q.correctIndex < 0 || q.correctIndex > 2) throw new Error(`${at} needs feedback for each of the three book answers.`);
    } else if (q.format === 'order') {
      if (q.steps.length < 3 || q.choices.length) throw new Error(`${at} needs 3 to 6 steps.`);
      const sorted = [...q.display].sort((a, b) => a - b);
      if (q.display.length !== q.steps.length || sorted.some((n, k) => n !== k)) throw new Error(`${at}.display must list every step once.`);
      if (q.display.every((n, k) => n === k)) throw new Error(`${at}.display must shuffle the steps.`);
      if (q.feedback.length !== 1) throw new Error(`${at} needs one feedback explanation.`);
    }
    if (!paragraphs.has(q.source.paragraphId)) throw new Error(`Unknown source paragraph: ${q.source.paragraphId}`);
    if (!paragraphs.get(q.source.paragraphId).includes(q.source.quote) || q.source.quote.length < Math.min(8, paragraphs.get(q.source.paragraphId).length)) throw new Error(`${at}.source quote does not match paragraph ${q.source.paragraphId}.`);
}

/** A study picture is optional teaching material: one that fails its checks is dropped, never the whole guide. */
export function omitUnverifiedStudyVisual(guide, unit) {
  const v=guide?.articleAnalysis?.studyVisual;
  if(!v||!Array.isArray(unit?.paragraphs))return guide;
  const paragraphs=new Map(unit.paragraphs.map(p=>[p.id,p.text]));
  try{
    validateShape(v,studyVisualSchema,'studyVisual');
    for(const count of [v.participants.count,...v.groups.map(g=>g.count)])if(count!==null&&(!Number.isInteger(count)||count<1||count>10000000))throw new Error('count');
    if(guide.articleAnalysis.kind==='commentary')throw new Error('commentary');
    for(const ref of v.sourceRefs)if(!paragraphs.get(ref.paragraphId)?.includes(ref.quote)||ref.quote.length<Math.min(8,paragraphs.get(ref.paragraphId).length))throw new Error('quote');
    return guide;
  }catch{
    const candidate=structuredClone(guide);candidate.articleAnalysis.studyVisual=null;return candidate;
  }
}

export function validateGuide(guide, unit, {requireMnemonic = false, requireTeachingContinuity = false, requireArticleAnalysis = false, requireStatisticsLab = false, requireChecks = false} = {}) {
  const required = [...storedSchema.required];
  if (requireChecks) required.push('checks');
  if (requireMnemonic) required.push('mnemonic');
  if (requireTeachingContinuity) required.push('learningPath', 'chapterVisual');
  if (requireArticleAnalysis) required.push('articleAnalysis');
  validateShape(guide, {...storedSchema, required}, 'guide');
  if (!unit || !Array.isArray(unit.paragraphs)) throw new TypeError('Source paragraphs are required for validation.');
  if(requireArticleAnalysis&&!guide.articleAnalysis)throw new Error('guide.articleAnalysis is required for an article.');
  const appraisal=guide.articleAnalysis;
  if(requireStatisticsLab&&appraisal&&!Object.hasOwn(appraisal,'statisticsLab'))throw new Error('guide.articleAnalysis.statisticsLab is required for new article output.');
  const articleItems=appraisal?[appraisal.researchQuestion,appraisal.studyDesign,appraisal.population,appraisal.comparator,appraisal.outcomes,...appraisal.results,...appraisal.statistics,...appraisal.limitations,...appraisal.implications]:[];
  for(const item of articleItems)if(item.status==='reported'&&!item.sourceRefs.length)throw new Error('Reported article evidence needs an exact source reference.');
  const paragraphs = new Map(unit.paragraphs.map(p => [p.id, p.text]));
  if (paragraphs.size !== unit.paragraphs.length) throw new Error('Source paragraph IDs must be unique.');
  for (const [i, item] of [...guide.concepts, ...guide.principles, ...articleItems].entries()) {
    if (item.origin === 'author' && !item.sourceRefs.length) throw new Error(`Author principle ${i + 1} needs a source reference.`);
    for (const ref of item.sourceRefs) {
      if (!paragraphs.has(ref.paragraphId)) throw new Error(`Unknown source paragraph: ${ref.paragraphId}`);
      if (ref.quote.length < Math.min(8, paragraphs.get(ref.paragraphId).length)) throw new Error(`Source quote is too short for paragraph ${ref.paragraphId}.`);
      if (!paragraphs.get(ref.paragraphId).includes(ref.quote)) throw new Error(`Source quote does not match paragraph ${ref.paragraphId}.`);
    }
  }
  if(appraisal)validateStatisticsLab(appraisal.statisticsLab,appraisal,paragraphs);
  if(appraisal?.studyVisual){
    const v=appraisal.studyVisual;
    for(const count of [v.participants.count,...v.groups.map(g=>g.count)])if(count!==null&&(!Number.isInteger(count)||count<1||count>10000000))throw new Error('guide.articleAnalysis.studyVisual counts must be whole numbers or null.');
    if(appraisal.kind==='commentary')throw new Error('Commentary has no study to draw; set studyVisual to null.');
    for(const ref of v.sourceRefs)if(!paragraphs.get(ref.paragraphId)?.includes(ref.quote)||ref.quote.length<Math.min(8,paragraphs.get(ref.paragraphId).length))throw new Error('guide.articleAnalysis.studyVisual source quote does not match its paragraph.');
  }
  if(guide.checks)validateChecks(guide.checks,paragraphs);
  if(requireChecks)for(const text of [...guide.recall.map(r=>r.question),...guide.application.steps])if(WRITING_PROMPT.test(text))throw new Error('Recall questions and application steps must not ask the reader to write.');
  const nodes = new Map(guide.flow.nodes.map(node => [node.id, node]));
  if (nodes.size !== guide.flow.nodes.length) throw new Error('Flow node IDs must be unique.');
  const connected = new Map([...nodes.keys()].map(id => [id, new Set()]));
  const edgeKeys = new Set();
  for (const edge of guide.flow.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error('A flow edge refers to an unknown node.');
    const key = JSON.stringify([edge.from, edge.to, edge.label]);
    if (edgeKeys.has(key)) throw new Error('Flow edges must be unique.');
    edgeKeys.add(key);
    connected.get(edge.from).add(edge.to); connected.get(edge.to).add(edge.from);
  }
  const visited = new Set(), pending = [guide.flow.nodes[0].id];
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(...connected.get(id));
  }
  if (visited.size !== nodes.size) throw new Error('Every flow node must connect to the graph.');
  return guide;
}
