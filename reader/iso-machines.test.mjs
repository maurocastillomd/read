import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, readdirSync} from 'node:fs';
import {isoSource} from '../scripts/iso-source.mjs';
import {SCENE_NAMES} from '../lib/scene-objects.mjs';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const context = {esc, document: {getElementById: () => ({}), createElement: () => ({}), head: {appendChild() {}}}};
vm.createContext(context);
vm.runInContext(await isoSource() + ';this.api={isoMachine,isoForKind,isoFigure,isoThumb,isoPick,isoClaim,isoSetKeys,ISO_STATION_NAMES,isoCompose,isoScenePicture,isoSceneOk};', context);
const {isoMachine, isoForKind, isoFigure, isoThumb, isoPick, isoSetKeys, ISO_STATION_NAMES, isoCompose, isoScenePicture, isoSceneOk} = context.api;

const variants = [
  ['tank', {}, 3], ['tank', {level: .86}, 3], ['balance', {}, 3],
  ...[2, 3, 4, 5].map(n => ['drawers', {count: n, open: n - 1}, n]),
  ...[2, 3, 4, 5].map(n => ['conveyor', {n}, n]),
  ...[2, 3, 4, 5].map(n => ['turntable', {n}, n]),
  ['ruler', {marks: [10, 50, 95]}, 3], ['ruler', {marks: [0, 100]}, 2],
  ['dial', {}, 3], ['pegboard', {}, 3], ...[1, 2, 3, 4].map(g => ['bench', {groups: g, dir: 'up'}, Math.min(g, 3)]),
];

test('every machine draws clean SVG with one tagged group per part', () => {
  for (const [name, opts, parts] of variants) {
    const svg = isoMachine(name, opts), what = name + JSON.stringify(opts);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"[^>]*role="img"/, what);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, what);
    for (let i = 0; i < parts; i++) assert.match(svg, new RegExp(`<g data-p="${i}">`), `${what} part ${i}`);
    assert.doesNotMatch(svg, /<text(?![^>]*iso-face-text)/, what + ': no words in the drawing');
    assert.ok(svg.length < 140000, what + ' stays small');
  }
});

test('machines are built once and reused, and every picture kind has one', () => {
  assert.equal(isoMachine('tank', {}), isoMachine('tank', {}));
  for (const kind of ['handoff', 'loop', 'capacity', 'decision', 'layers', 'compass', 'release', 'network', 'unknown']) assert.match(isoForKind(kind), /^<svg /, kind);
});

test('a figure marks the selected part and the gap, and tapping is opt-in', () => {
  const svg = isoMachine('tank', {});
  assert.match(isoFigure(svg, {selected: 2}), /^<div class="ivm" data-sel="2">/);
  assert.match(isoFigure(svg, {hidden: 0}), /data-gap="0"/);
  assert.doesNotMatch(isoFigure(svg), /data-action/);
  assert.match(isoFigure(svg, {interactive: true, parts: 3, labels: ['a', 'b', 'c']}), /<g data-p="1" data-action="iv-part" data-index="1" role="button" aria-label="Part 2: b">/);
  const thumb = isoThumb(svg, 'Tank');
  assert.match(thumb, /class="ivm-img is-day" src="[^"]+" alt="Tank"/);
  assert.match(thumb, /class="ivm-img is-night"/);
});

test('no two pictures in a library share a drawing', () => {
  const kinds = ['handoff', 'loop', 'capacity', 'decision', 'layers', 'compass', 'release', 'network', 'chain', 'cycle', 'stack', 'terms', 'contrast', 'stat'];
  const keys = [];
  for (let i = 0; i < 220; i++) { const kind = kinds[i % kinds.length]; keys.push(['p' + i, kind, kind === 'contrast' ? 2 : 3 + (i % 3), {}]); }
  keys.push(['r1', 'scale', 3, {marks: [10, 40, 80]}], ['r2', 'scale', 3, {marks: [10, 40, 80]}]);
  isoSetKeys({token: () => 'lib', keys: () => keys});
  const svgs = keys.map(([key, kind, n, o]) => isoPick(key, kind, n, o));
  assert.equal(new Set(svgs).size, svgs.length);
  // the same picture always gets the same drawing
  assert.equal(isoPick('p5', keys[5][1], keys[5][2]), svgs[5]);
  // the hand-built machines appear once each
  assert.equal(svgs.filter(s => s === isoMachine('tank', {})).length, 1);
});

test('every station draws clean in each variant and layout', () => {
  for (const m of ISO_STATION_NAMES) for (const v of [0, 1]) {
    const svg = isoCompose({shape: 'line', n: 1, mods: [m], vars: [v], az: 45, opts: {}});
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, m + v);
  }
  for (const [shape, n, opts] of [['line', 5], ['fade', 3], ['loop', 4], ['limit', 3], ['fork', 4], ['pair', 2], ['steps', 5], ['shelf', 4], ['hub', 3], ['web', 3], ['rail', 3, {marks: [5, 50, 95]}], ['study', 4, {dir: 'down'}]]) {
    const svg = isoCompose({shape, n, mods: ISO_STATION_NAMES.slice(0, n), vars: Array(n).fill(0), az: -45, opts: opts || {}});
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, shape);
    for (let i = 0; i < n; i++) assert.match(svg, new RegExp(`<g data-p="${i}">`), shape + ' part ' + i);
  }
});

test('every object in the picture set draws clean, in both variants and from both sides', () => {
  for (const name of SCENE_NAMES) for (const v of [0, 1]) for (const az of [45, -45]) {
    const svg = isoScenePicture({objects: [name], link: 'none', vars: [v], az}), what = `${name} v${v} ${az}`;
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, what);
    assert.match(svg, /<g data-p="0">/, what);
    assert.doesNotMatch(svg, /<text/, what + ': no words in the drawing');
  }
});

test('a picture plan draws the lesson’s own things, and two plans naming the same things still differ', () => {
  const scene = {objects: ['jar', 'coins', 'seedling'], link: 'none'};
  const keys = [['a', 'decision', 3, {scene}], ['b', 'decision', 3, {scene}], ['c', 'loop', 3, {scene: {objects: ['jar', 'coins']}}], ['d', 'loop', 3, {scene: {objects: ['jar', 'coins', 'spaceship']}}], ['e', 'contrast', 2, {scene: {objects: ['scales', 'dice']}}]];
  isoSetKeys({token: () => 'plans', keys: () => keys});
  const [a, b, c, d, e] = keys.map(([key, kind, n, o]) => isoPick(key, kind, n, o));
  assert.match(a, /aria-label="A picture: a locked jar of coins, a tray of coins and a seedling in a pot\."/);
  assert.notEqual(a, b);
  assert.match(b, /aria-label="A picture: /);
  for (const svg of [a, b, e]) for (let i = 0; i < 3 && i < (svg === e ? 2 : 3); i++) assert.match(svg, new RegExp(`<g data-p="${i}">`));
  // a plan that does not fit the parts falls back to a machine
  assert.doesNotMatch(c, /A picture: /);
  assert.doesNotMatch(d, /A picture: /);
  assert.equal(isoSceneOk({objects: ['bell', 'gears', 'lamp'], link: 'beam'}, 3).link, 'beam');
  assert.equal(isoSceneOk({objects: ['bell', 'bell', 'lamp']}, 3), null);
});

test('every bundled lesson and 30-min figure has a plan the reader can draw, and no two share one', () => {
  const visuals = JSON.parse(readFileSync(new URL('./idea-visuals.json', import.meta.url), 'utf8'));
  const seen = new Set();
  const check = (scene, count, what) => {
    assert.ok(isoSceneOk(scene, count), what);
    assert.ok(scene.objects.every(o => SCENE_NAMES.includes(o)), what + ': in the shared set');
    const sig = scene.objects.join(',');
    assert.ok(!seen.has(sig), what + ': repeats ' + sig);
    seen.add(sig);
  };
  for (const [book, units] of Object.entries(visuals)) for (const [unit, v] of Object.entries(units)) check(v.scene, 3, book + ' ' + unit);
  const dir = new URL('./thirty-min/', import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const tm = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    tm.sections.forEach((s, i) => s.blocks.forEach((b, k) => {
      const f = b.fig;
      if (!f || f.kind === 'scale' || f.kind === 'stat') return;
      const count = f.kind === 'contrast' ? 2 : Math.max(2, Math.min(5, (f.steps || f.layers || f.items).length));
      check(f.scene, count, `${file} ${i}-${k}`);
    }));
  }
});
