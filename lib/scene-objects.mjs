/**
 * The things a lesson picture can be built from. Each is drawn by the reader
 * (reader/iso-scenes.js, or a station in reader/iso-compose.js) in the anatomy
 * machine style. A picture plan names one object per part, in order, so the
 * picture shows the lesson's own subject instead of a generic machine.
 */
export const SCENE_OBJECTS = {
  balloon: 'hope, expectation',
  bathtub: 'a stock that fills and drains',
  bell: 'a signal, one event',
  book: 'a lesson, a story, rules',
  bridge: 'a connection',
  calendar: 'dates, the real day, a time budget',
  cage: 'a trap, freedom (door open)',
  cells: 'battery: energy, a need',
  chairs: 'two chairs: a relationship, a conversation',
  clipboard: 'facts, evidence, a report',
  clock: 'waiting, routine',
  cloud: 'a threat, uncertainty, what you cannot control',
  coins: 'cost still to pay',
  compass: 'values, direction',
  crates: 'tasks, load, what gets pushed aside',
  cup: 'an everyday experience; cracked: a mistake',
  dice: 'chance, odds',
  dominoes: 'a chain reaction, collapse',
  door: 'an opening, an open question, moving on',
  drum: 'a repeated rhythm',
  dumbbell: 'practice, strength',
  envelope: 'a request, a message',
  fan: 'spreading, cooling down',
  faucet: 'a flow in or out',
  fence: 'boundaries',
  flask: 'an experiment',
  gauge: 'a measure, pressure',
  gears: 'a process, the system working',
  gift: 'appreciation, a choice made for someone',
  helm: 'ship’s wheel: control, your choice',
  heart: 'love, care',
  honeycomb: 'parts that organise themselves',
  hopper: 'many inputs narrowing to one',
  hourglass: 'limited time or attention',
  jar: 'sealed jar of coins: what is already spent',
  jigsaw: 'filling gaps, your part of the whole',
  kettle: 'pressure and release',
  key: 'what fits, unlocking',
  kite: 'partial control, something elusive',
  ladder: 'steps up, progress',
  lamp: 'attention, awareness',
  lever: 'a shift, an adjustment',
  lightbulb: 'an idea, insight',
  magnifier: 'looking closer, investigating',
  map: 'a mental model, where something comes from',
  megaphone: 'a loud message, criticism, a headline',
  mirror: 'reflection, self-image',
  note: 'a quotation, a short message',
  picture: 'a memory, an image taken as real',
  piston: 'force, a push',
  press: 'rigid demand, pressure applied',
  projector: 'projecting today onto the future',
  reel: 'film reel: a memory replaying, a pattern',
  scales: 'weighing, judging, comparing',
  scissors: 'an edit, a cut, cutting something out',
  scoreboard: 'keeping score',
  screen: 'an imagined picture',
  seedling: 'growth, future value, recovery',
  shield: 'protection, defense',
  sieve: 'filtering, sorting',
  signpost: 'a choice, options',
  sketch: 'a rough draft or model',
  spring: 'resistance, bouncing back',
  stone: 'boulder: a burden, guilt, a concern',
  stones: 'stepping stones: next steps',
  tag: 'a label, naming',
  tank: 'a store, a limited resource',
  target: 'a goal, an aim',
  telescope: 'the far future, a way of seeing',
  thermometer: 'a feeling, a reading of the moment',
  toolbox: 'tools, repair, practice',
  tree: 'growth, levels',
  trophy: 'an ideal, success, a big event',
  umbrella: 'fear, preparing for the worst',
  weights: 'load, heaviness',
  wheel: 'hand wheel: adjusting, restoring',
};
export const SCENE_NAMES = Object.keys(SCENE_OBJECTS);
export const SCENE_LINKS = ['path', 'beam', 'none'];

/** A clean picture plan for `count` parts, or null. Unknown names, repeats inside one plan and the wrong count drop it. */
export function cleanScene(value, count) {
  const v = value && typeof value === 'object' ? value : {objects: value};
  const objects = (Array.isArray(v.objects) ? v.objects : []).map(o => String(o || '').trim().toLowerCase());
  if (objects.length !== count || objects.some(o => !Object.hasOwn(SCENE_OBJECTS, o)) || new Set(objects).size !== objects.length) return null;
  const link = SCENE_LINKS.includes(v.link) && !(v.link === 'beam' && objects[0] !== 'projector') ? v.link : 'none';
  return {objects, link};
}

/** The set as prompt text: one line per object. */
export const SCENE_HELP = Object.entries(SCENE_OBJECTS).map(([name, what]) => `${name}: ${what}`).join('\n');
