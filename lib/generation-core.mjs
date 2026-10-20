import {planBook} from './guide-core.mjs';
import {lessonFromText, lessonPrompt} from './lesson-maker.mjs';

export const MODEL = 'claude-haiku-5-5';
export const MAX_UNITS = 250;
export const MAX_OUTPUT_TOKENS = 16000;
// Batches have no request timeout, so book sections get more room for long chapters.
export const BATCH_OUTPUT_TOKENS = 32000;
export const MAX_ATTEMPTS = 2;

export function generationPlan(book, guides = []) {
  const plan = planBook(book);
  const completed = new Set(guides.map(g => g.unitId));
  const prepared = new Set(guides.filter(g => g.unitId === `${g.chapterId}:prepared`).map(g => g.chapterId));
  const units = plan.units.map(unit => ({...unit, status: completed.has(unit.id) || prepared.has(unit.chapterId) ? 'completed' : 'queued', attempts: 0}));
  if (units.filter(u => u.status !== 'completed').length > MAX_UNITS) throw new Error(`This book needs more than ${MAX_UNITS} explanation sections. Split it into smaller EPUB volumes before generating.`);
  return {...plan, units};
}

/**
 * One lesson request. Claude writes a small draft as plain JSON (lib/lesson-maker.mjs
 * describes it); read.'s code builds and checks the stored lesson from it. No strict
 * output format: the lesson contract is too large for one, and the code does that job.
 */
export function lessonRequest(book, unit, {maxTokens = MAX_OUTPUT_TOKENS} = {}) {
  const {instructions, input} = lessonPrompt(book, unit);
  return {
    model: MODEL,
    max_tokens: maxTokens,
    // Hidden thinking would spend the output budget before the lesson is written.
    thinking: {type: 'disabled'},
    output_config: {effort: 'low'},
    // Identical for every section, so it is cached between requests.
    system: [{type: 'text', text: instructions, cache_control: {type: 'ephemeral'}}],
    messages: [{role: 'user', content: input}],
  };
}
/** The text of a Messages API reply. */
export const messageText = message => (message?.content || []).filter(b => b?.type === 'text').map(b => b.text).join('');

/** The `requests` array for POST /v1/messages/batches. */
export function batchRequests(book, units) {
  return units.map((u, i) => ({custom_id: `unit-${i}`, params: lessonRequest(book, u, {maxTokens: BATCH_OUTPUT_TOKENS})}));
}

/** Text of a succeeded batch row, or an error message for the reader. */
export function batchRowText(row) {
  const result = row?.result;
  if (result?.type === 'canceled') return {error: 'This section was cancelled before completion.'};
  if (result?.type === 'expired') return {error: 'The AI provider ran out of time for this section. Retry it.'};
  if (result?.type !== 'succeeded') {
    const reason = typeof result?.error?.error?.message === 'string' ? result.error.error.message.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    return {error: `The AI provider could not complete this section${reason ? `: ${reason}` : '.'}`};
  }
  const message = result.message;
  if (message?.stop_reason === 'max_tokens') return {error: 'The lesson ran past its length limit. Retry this section.'};
  if (message?.stop_reason === 'refusal') return {error: 'The AI provider declined this section.'};
  if (message?.stop_reason !== 'end_turn') return {error: 'The AI provider did not return a complete explanation.'};
  return {text: (message.content || []).filter(block => block.type === 'text').map(block => block.text).join('')};
}

export function parseBatchResult(row, units) {
  if (!row || typeof row.custom_id !== 'string' || !/^unit-\d+$/.test(row.custom_id)) throw new Error('The provider returned an unknown section identifier.');
  const unit = units[Number(row.custom_id.slice(5))];
  if (!unit) throw new Error('The provider returned an unknown section identifier.');
  const {text, error} = batchRowText(row);
  if (error) return {unitId: unit.id, error};
  const {guide, error: problem} = lessonFromText(text, unit);
  return guide ? {unitId: unit.id, guide} : {unitId: unit.id, error: problem};
}

export function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id, bookId: job.bookId, bookTitle: job.bookTitle, model: job.model,
    status: job.status, providerStatus: job.providerStatus || '',
    total: job.units.length, completed: job.units.filter(u => u.status === 'completed').length,
    processed: job.processed || 0, error: job.error || '', skipped: job.skipped,
    createdAt: job.createdAt, updatedAt: job.updatedAt,
    retryAvailable: ['completed_with_errors', 'failed', 'cancelled'].includes(job.status) && job.units.some(u => u.status !== 'completed' && (job.mode === 'direct' || u.attempts < MAX_ATTEMPTS)),
    recheckAvailable: ['completed_with_errors', 'failed', 'cancelled'].includes(job.status) && Boolean(job.outputKey) && job.units.some(u => u.status !== 'completed'),
    completionWindow: job.mode === 'direct' ? 'minutes' : '24h',
    units: job.units.map(({id, chapterId, chapterTitle, part, totalParts, status, error, attempts}) => ({id, chapterId, chapterTitle, part, totalParts, status, error, attempts})),
  };
}
