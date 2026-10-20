import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateChecks, WRITING_PROMPT} from '../lib/guide-core.mjs';
import {sampleChecks} from './check-fixture.mjs';
import {sampleLibrary} from './fixtures/sample-library.mjs';

const paragraphs = [{id: 'p1', text: 'A routine is held in place by its cue, its setting and its reward.'}];
const byId = new Map(paragraphs.map(p => [p.id, p.text]));

test('a check that asks the reader to write is rejected', () => {
  assert.doesNotThrow(() => validateChecks(sampleChecks(paragraphs), byId));
  for (const prompt of ['Explain in your own words why routines persist.', 'Write one sentence about the passage.', 'Describe how this applies to your week.', 'Summarize the argument.']) {
    const checks = sampleChecks(paragraphs);
    checks[0].prompt = prompt;
    assert.throws(() => validateChecks(checks, byId), /tapping/, prompt);
  }
  assert.equal(WRITING_PROMPT.test('Which reading fits the passage best?'), false);
});

test('no learning flow renders a writing box', async () => {
  // Search fields and the paste-a-document import box are the only text inputs left.
  for (const file of ['generation-ui.js', 'chapter-practice.js', 'lesson-lab.js', 'statistics-lab.js', 'tap-check.js', 'book-reader.js', 'role-context.js', 'article-breakdown.js']) {
    const source = await readFile(new URL('../reader/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<textarea/i, file);
  }
  const app = await readFile(new URL('../reader/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /<textarea/i);
});

test('prepared lessons carry tap checks and no writing prompts', () => {
  // Lessons built by lib/lesson-maker.mjs for an invented library stand in for bundled books.
  for (const entry of sampleLibrary()) for (const rec of entry.guides) {
    assert.ok(rec.guide.checks.length >= 6, rec.unitId);
    for (const text of [...rec.guide.checks.map(c => c.prompt), ...rec.guide.recall.map(r => r.question)]) assert.doesNotMatch(text, WRITING_PROMPT, rec.unitId + ': ' + text);
  }
});
