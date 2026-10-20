import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./article-text.js',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(source+'\nthis.clean=articleDisplayText;this.split=articleSplitLong;',ctx);
const sentence=n=>`Players completed trial ${n} on the ergometer and the authors reported peak and mean power for each attempt.`;

test('journal page furniture, repeated titles and run-in headings are tidied for reading',()=>{
  const text=['Journal of Strength and Conditioning Research 1716','VOLUME 22 | NUMBER 5 | SEPTEMBER 2008 Copyright © National Strength and Conditioning Association. Unauthorized reproduction of this article is prohibited.','JSX-01-0001 1716..1722',
    'Sample Test Reliability','ALEX Q. EXAMPLE','ABSTRACT The purpose was to test reliability.','INTRODUCTION Ice hockey is a high-intensity intermit- tent sport with pre- and post-game testing.',
    'Experimental Approach to the Problem Players were tested three times. Statistical Analyses Reliability was assessed with intraclass correlations and the page ends mid',
    'Journal of Strength and Conditioning Research 1718','JSX-01-0001 1716..1722','sentence on the next page.','## REFERENCES','1. Author A. A reference.'].join('\n\n');
  const out=ctx.clean(text,{title:'Sample Test Reliability',author:'Alex Q. Example'});
  assert.doesNotMatch(out,/Journal of Strength|VOLUME 22|JSX-01|Unauthorized|Sample Test Reliability|EXAMPLE/);
  assert.match(out,/^## ABSTRACT\n\nThe purpose was to test reliability\.\n\n## INTRODUCTION\n\nIce hockey is a high-intensity intermit-tent sport with pre- and post-game testing\./);
  assert.match(out,/## Experimental Approach to the Problem\n\nPlayers were tested three times\.\n\n## Statistical Analyses\n\nReliability was assessed with intraclass correlations and the page ends mid sentence on the next page\./);
  assert.match(out,/## REFERENCES\n\n1\. Author A\. A reference\./);
});

test('clean article text and tables pass through unchanged, and long blocks break at sentence ends',()=>{
  const clean='## Methods\n\nWe measured sprint time.\n\n[Table rows; columns separated by |]\n\nGroup | n\n\nSleep | 12';
  assert.equal(ctx.clean(clean,{title:'Other'}),clean);
  const long=Array.from({length:24},(_,i)=>sentence(i)+(i===5?' See Fig. 2 for details et al. reported this.':'')).join(' ');
  const parts=ctx.split(long).split('\n\n');
  assert.ok(parts.length>=3);assert.equal(parts.join(' '),long);
  for(const p of parts)assert.match(p,/\.$/);
  assert.ok(!parts.some(p=>/^2 for details|^reported this/.test(p)));
});
