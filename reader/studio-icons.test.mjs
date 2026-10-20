import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {sampleLibrary} from '../tests/fixtures/sample-library.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context=vm.createContext({esc});
vm.runInContext(readFileSync(new URL('./studio-icons.js',import.meta.url),'utf8')+'\nthis.renderProse=readingProse;',context);
const render=context.renderProse;
const text=html=>parseHTML('<html><body>'+html+'</body></html>').document.body.textContent;
const nonWhitespace=value=>String(value).replace(/\s/g,'');
const assertLossless=value=>assert.equal(nonWhitespace(text(render(value))),nonWhitespace(value));

test('statistics preserve every clause, decimal, comparison, and numeric character',()=>{
  const values=[
    'Statistical significance was set at p < .05. The observed result was p .056, so this comparison did not reach that threshold.',
    'The interaction was F3,27 = 1.076, p = .375. Reliability was ICC .967, with a lower bound of .275.',
    'The authors reported p < .05; the second outcome had p .056. ICC values were .967 and .275.',
    'A mean difference of 0.25 (95% CI −0.15 to 0.65) is an estimate with uncertainty. It is not proof of a meaningful effect.',
    'Three sentences precede the result. The next clause contains .05 within its explanation. Keep the entire leading clause.',
  ];
  for(const value of values)assertLossless(value);
  assert.match(render(values[0]),/Statistical significance was set at p &lt; \.05/);
  assert.match(render(values[1]),/The interaction was F3,27 = 1\.076, p = \.375/);
});
test('abbreviations, quotes, citations, and punctuation stay intact across paragraph grouping',()=>{
  const value=('A complete sentence with enough context to explain the study result. '.repeat(8))+'Dr. Example et al. reported U.S. data, e.g. p = .056 [12, 15]. “What follows?” The authors replied: “More uncertainty.”\n\nThe second paragraph retains 1.25, 2.50, and .75.';
  assertLossless(value);
  assert.ok((render(value).match(/<p>/g)||[]).length>2,'Long prose still breaks into readable paragraphs');
  for(const value of ['... Leading punctuation stays.','!? All punctuation remains!?','A result... then a qualification.','The ratio is 1.2:1.0.','A single sentence without ending punctuation'])assertLossless(value);
});
test('untrusted prose is escaped without losing its literal contents',()=>{
  const value='<script>alert("bad")</script> <img src=x onerror="alert(1)"> p < .05 & CI > .275.';
  const html=render(value),document=parseHTML('<html><body>'+html+'</body></html>').document;
  assert.equal(document.querySelector('script,img'),null);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/p &lt; \.05 &amp; CI &gt; \.275/);
  assertLossless(value);
  assert.equal(render(null),'');assert.equal(render(undefined),'');assert.equal(render(0),'<p>0</p>');
});
test('all prepared guide text renders without losing any nonwhitespace character',()=>{
  // Lessons built by lib/lesson-maker.mjs for an invented library stand in for bundled books.
  const strings=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
  let checked=0;
  for(const entry of sampleLibrary())for(const record of entry.guides)for(const value of strings(record.guide)){assertLossless(value);checked++;}
  assert.ok(checked>100,'Every sample lesson should be covered: '+checked);
});
