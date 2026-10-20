// Minimal valid tap-only checks for provider-output fixtures.
export function sampleChecks(paragraphs) {
  const p = paragraphs.find(x => x.text.length >= 20) || paragraphs[0];
  const source = {paragraphId: p.id, quote: p.text.slice(0, Math.min(40, p.text.length))};
  const choices = ['The passage states this.', 'The passage rejects this.', 'The passage never raises this.'].map((label, i) => ({label, feedback: i ? 'Not quite. Check the passage.' : 'Right. The passage says so.'}));
  return [
    {id: 'pick-1', format: 'pick', where: ['remember'], prompt: 'Which reading fits the passage best?', choices, steps: [], display: [], feedback: [], correctIndex: 0, source},
    {id: 'book-1', format: 'book', where: ['remember'], prompt: 'The passage opens this section.', choices: [], steps: [], display: [], feedback: ['Right.', 'It does not say the opposite.', 'It is in the passage.'], correctIndex: 0, source},
    {id: 'order-1', format: 'order', where: ['remember'], prompt: 'Put these in the order the passage gives them.', choices: [], steps: ['First idea', 'Second idea', 'Third idea'], display: [2, 0, 1], feedback: ['The passage moves from the first idea to the third.'], correctIndex: 0, source},
    {id: 'mistake-1', format: 'mistake', where: ['teach'], prompt: 'Tap the statement that misreads the passage.', choices, steps: [], display: [], feedback: [], correctIndex: 1, source},
  ];
}
