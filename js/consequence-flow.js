/**
 * Shared consequence-flow graph (workflow-intro + flow-map).
 * Bump FLOW_GRAPH_BUILD when changing module topology (cache-bust ?v= on imports).
 */
export const FLOW_GRAPH_BUILD = 'grid-7col-v1';

/**
 * Volume 1 — classic split (3A / 3B) → convergence (4) → hub (5).
 *
 *              m6 ──→ m8 ──→ m5
 *             ↗      ↗
 * m1 → m2 ───┤      │
 *             ↘      │
 *              m4 ───┘
 */

/** Path card label, e.g. "Chapter 3A". */
export function formatChapterLabel(chapter) {
  if (chapter == null || chapter === '') return '';
  const raw = String(chapter).trim();
  return /^chapter\b/i.test(raw) ? raw : `Chapter ${raw}`;
}

export function getChapterCardLabel(mod) {
  if (mod?.chapter != null && mod.chapter !== '') {
    return formatChapterLabel(mod.chapter);
  }
  return mod?.title ?? '';
}

/** Path card heading — "CHAPTER 1", "CHAPTER 3A", … */
export function getChapterCapsLabel(mod) {
  if (mod?.chapter == null || mod.chapter === '') return '';
  return `CHAPTER ${String(mod.chapter).trim()}`;
}

export function getChapterAriaLabel(mod) {
  const chapter = getChapterCardLabel(mod);
  const name = mod?.title?.trim();
  const locked = mod?.locked ? ' (locked)' : '';
  if (chapter && name && chapter !== name && !name.startsWith(chapter)) {
    return `${chapter}, ${name}${locked}`;
  }
  return `${chapter || name}${locked}`;
}

export const CONSEQUENCE_MODULES = [
  {
    id: 'm1',
    column: 1,
    row: 2,
    start: true,
    chapter: '1',
    title: 'Volume intro',
    description: 'Orientation — no scoring, sets context for the path ahead.',
    progress: 100,
    locked: false,
    hue: 210,
    modal: {
      badge: 'INTRO',
      cta: 'Play volume',
      showStats: false
    }
  },
  {
    id: 'm2',
    column: 2,
    row: 2,
    chapter: '2',
    title: 'First practice',
    description: 'First scored module; your result opens the up or down branch.',
    progress: 0,
    locked: true,
    hue: 205,
    modal: {
      badge: 'PRACTICE',
      cta: 'Play module',
      showStats: true,
      lastChoice: '—',
      playtime: '12 min',
      bestRun: '85%'
    }
  },
  {
    id: 'm4',
    column: 3,
    row: 3,
    chapter: '3B',
    title: 'Needs reinforcement',
    description: 'Unlocked when you struggle — lower consequence path.',
    progress: 0,
    locked: true,
    hue: 192
  },
  {
    id: 'm6',
    column: 3,
    row: 1,
    chapter: '3A',
    title: 'Upper lane',
    description: 'Strong outcome — continue straight or return to the hub.',
    progress: 0,
    locked: true,
    hue: 196,
    modal: {
      badge: 'PRACTICE',
      cta: 'Play module',
      showStats: true,
      lastChoice: '—',
      playtime: '12 min',
      bestRun: '85%'
    }
  },
  {
    id: 'm8',
    column: 4,
    row: 2,
    chapter: '4',
    title: 'Straight ahead',
    description: 'Merge point — both branches rejoin here before the final step.',
    progress: 0,
    locked: true,
    hue: 194
  },
  {
    id: 'm5',
    column: 5,
    row: 2,
    chapter: '5',
    title: 'Center check-in',
    description: 'Final step on the main lane after chapter 4.',
    progress: 0,
    locked: true,
    hue: 200
  }
];

export const CONSEQUENCE_EDGES = [
  ['m1', 'm2'],
  ['m2', 'm6'],
  ['m2', 'm4'],
  ['m6', 'm8'],
  ['m4', 'm8'],
  ['m8', 'm5']
];

/**
 * Cord attachment per edge (from → to), matched to layout sketches.
 * Only drawn when both modules are unlocked.
 */
/**
 * Junction Y on chapter cards (0–1 along the edge) — merge reference: ch.3 merge point.
 * Upper / lower share the same value on exit and entry; straight lanes use the midpoint.
 */
export const SUBWAY_JUNCTION_ALONG = {
  upper: 0.38,
  lower: 0.62,
  center: 0.5
};

/** Cord anchor spreads — same Y on from/to for fork, merge, and branch. */
export const SUBWAY_FORK_ALONG = {
  upper: { fromAlong: SUBWAY_JUNCTION_ALONG.upper, toAlong: SUBWAY_JUNCTION_ALONG.upper },
  lower: { fromAlong: SUBWAY_JUNCTION_ALONG.lower, toAlong: SUBWAY_JUNCTION_ALONG.lower },
  center: { fromAlong: SUBWAY_JUNCTION_ALONG.center, toAlong: SUBWAY_JUNCTION_ALONG.center }
};

export const CONSEQUENCE_CORD_ANCHORS = {
  'm1|m2': { from: 'right', to: 'left', ...SUBWAY_FORK_ALONG.center, slack: 1.06, sagSign: 1 },
  'm2|m6': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.upper,
    slack: 1.14,
    sagSign: -1
  },
  'm2|m4': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.lower,
    slack: 1.14,
    sagSign: 1
  },
  'm6|m8': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.upper,
    slack: 1.08,
    sagSign: -1
  },
  'm4|m8': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.lower,
    slack: 1.08,
    sagSign: 1
  },
  'm8|m5': { from: 'right', to: 'left', ...SUBWAY_FORK_ALONG.center, slack: 1.06, sagSign: 1 }
};

/** @typedef {{ id: string, label: string, plugWire?: boolean, direction?: 'up'|'down', hint?: string, unlocks: string[], fills: string[], lastChoice: string, result: string }} PlayOutcome */
/** @typedef {{ choicesPrompt: string, outcomes: PlayOutcome[] }} PlayScenario */

/** Simulated play — choice buttons in module modal unlock the next step(s). */
export const MODULE_PLAY_SCENARIOS = {
  m1: {
    choicesPrompt: 'How do you want to begin?',
    outcomes: [
      {
        id: 'orient',
        label: 'Take a moment to orient',
        plugWire: true,
        unlocks: ['m2'],
        fills: ['m1|m2'],
        lastChoice: 'Oriented first',
        result: 'First practice is now open on your path.'
      }
    ]
  },
  m2: {
    choicesPrompt: 'Which path does your result open?',
    outcomes: [
      {
        id: 'upper',
        label: 'Upper lane',
        hint: 'Strong outcome — continue up',
        direction: 'up',
        plugWire: true,
        unlocks: ['m6'],
        fills: ['m2|m6'],
        lastChoice: 'Upper lane',
        empathyScore: 80,
        result: 'Upper lane opens ahead on the straight path.'
      },
      {
        id: 'lower',
        label: 'Needs reinforcement',
        hint: 'Revisit fundamentals — path down',
        direction: 'down',
        plugWire: true,
        unlocks: ['m4'],
        fills: ['m2|m4'],
        lastChoice: 'Reinforcement',
        empathyScore: 80,
        result: 'The reinforcement path opens below.'
      }
    ]
  },
  m6: {
    choicesPrompt: 'Continue on the upper lane',
    outcomes: [
      {
        id: 'continue',
        label: 'Continue to chapter 4',
        hint: 'Rejoin the main path',
        plugWire: true,
        unlocks: ['m8'],
        fills: ['m6|m8'],
        lastChoice: 'Upper lane',
        empathyScore: 80,
        result: 'Chapter 4 opens on the merged path.'
      }
    ]
  },
  m8: {
    choicesPrompt: 'Continue on the main lane',
    outcomes: [
      {
        id: 'continue',
        label: 'Continue to chapter 5',
        plugWire: true,
        unlocks: ['m5'],
        fills: ['m8|m5'],
        lastChoice: 'Straight ahead',
        empathyScore: 52,
        result: 'Chapter 5 is now available.'
      }
    ]
  },
  m4: {
    choicesPrompt: 'Continue on the reinforcement path',
    outcomes: [
      {
        id: 'continue',
        label: 'Continue to chapter 4',
        hint: 'Rejoin the main path',
        plugWire: true,
        unlocks: ['m8'],
        fills: ['m4|m8'],
        lastChoice: 'Reinforcement',
        result: 'Chapter 4 opens on the merged path.'
      }
    ]
  },
  m5: {
    choicesPrompt: 'Clear the hub',
    outcomes: [
      {
        id: 'finish',
        label: 'Complete volume',
        lastChoice: 'Hub cleared',
        result: 'Getting started is complete.'
      }
    ]
  }
};

/** Chapter 1 is complete when the end cap module has been played. */
export const CHAPTER_1_END_MODULE_ID = 'm5';

/** Min stars on a module before its downstream unlocks / fills apply (prototype: m8 → m5). */
export const MODULE_STAR_UNLOCK_GATES = {
  m8: { minStars: 4, unlocks: ['m5'], fills: ['m8|m5'] }
};

/** Shorter linear path — Chapter 2: Almost a pro */
export const CHAPTER_2_MODULES = [
  {
    id: 'c2m1',
    column: 1,
    row: 1,
    start: true,
    chapter: '1',
    title: 'Warm-up drill',
    description: 'Quick calibration before the tighter pro lane.',
    progress: 100,
    locked: false,
    hue: 208,
    modal: { badge: 'DRILL', cta: 'Play module', showStats: false }
  },
  {
    id: 'c2m2',
    column: 2,
    row: 1,
    chapter: '2',
    title: 'Pro lane',
    description: 'Sharper pacing — your choices branch less here.',
    progress: 0,
    locked: true,
    hue: 202,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c2m3',
    column: 3,
    row: 1,
    chapter: '3',
    title: 'Almost there',
    description: 'Final check-in before the next milestone.',
    progress: 0,
    locked: true,
    hue: 198,
    modal: { badge: 'CHECK-IN', cta: 'Play module', showStats: true }
  }
];

export const CHAPTER_2_EDGES = [
  ['c2m1', 'c2m2'],
  ['c2m2', 'c2m3']
];

export const CHAPTER_2_CORD_ANCHORS = {
  'c2m1|c2m2': { from: 'right', to: 'left', ...SUBWAY_FORK_ALONG.center, slack: 1.05, sagSign: 1 },
  'c2m2|c2m3': { from: 'right', to: 'left', ...SUBWAY_FORK_ALONG.center, slack: 1.05, sagSign: -1 }
};

export const CHAPTER_2_PLAY_SCENARIOS = {
  c2m1: {
    choicesPrompt: 'How do you want to enter the pro lane?',
    outcomes: [
      {
        id: 'steady',
        label: 'Steady pace',
        plugWire: true,
        unlocks: ['c2m2'],
        fills: ['c2m1|c2m2'],
        lastChoice: 'Steady pace',
        result: 'Pro lane is open.'
      },
      {
        id: 'push',
        label: 'Push ahead',
        plugWire: true,
        unlocks: ['c2m2'],
        fills: ['c2m1|c2m2'],
        lastChoice: 'Push ahead',
        result: 'Pro lane is open.'
      }
    ]
  },
  c2m2: {
    choicesPrompt: 'Continue toward the check-in',
    outcomes: [
      {
        id: 'continue',
        label: 'Proceed to check-in',
        plugWire: true,
        unlocks: ['c2m3'],
        fills: ['c2m2|c2m3'],
        lastChoice: 'Pro lane',
        result: 'Almost there is unlocked.'
      }
    ]
  },
  c2m3: {
    choicesPrompt: 'Close out the volume',
    outcomes: [
      {
        id: 'done',
        label: 'Finish practice',
        lastChoice: 'Almost a pro',
        result: 'Volume complete.'
      }
    ]
  }
};

/**
 * Volume 3 — 7-column A / B / C grid (reference layout).
 * Row 1 = A, row 2 = B (or unlettered solo mid), row 3 = C.
 * A may continue A or merge to B; C may continue C or merge to B; never A ↔ C.
 */
export const CHAPTER_3_MODULES = [
  {
    id: 'c3m1',
    column: 1,
    row: 2,
    start: true,
    chapter: '1',
    title: 'Opening move',
    description: 'Entry — fans out to the upper, middle, and lower lanes.',
    progress: 100,
    locked: false,
    hue: 210,
    modal: { badge: 'INTRO', cta: 'Play module', showStats: false }
  },
  {
    id: 'c3m2a',
    column: 2,
    row: 1,
    chapter: '2A',
    title: 'Upper split',
    description: 'A lane — continues up or merges toward the center.',
    progress: 0,
    locked: true,
    hue: 206,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m2b',
    column: 2,
    row: 2,
    chapter: '2B',
    title: 'Middle split',
    description: 'B lane — can feed the upper or lower merge in column 3.',
    progress: 0,
    locked: true,
    hue: 204,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m2c',
    column: 2,
    row: 3,
    chapter: '2C',
    title: 'Lower split',
    description: 'C lane — merges up to the center; never skips straight to A.',
    progress: 0,
    locked: true,
    hue: 202,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m3a',
    column: 3,
    row: 1,
    chapter: '3A',
    title: 'Upper merge',
    description: 'A lane in column 3 — branches to 4A or drops to 4B.',
    progress: 0,
    locked: true,
    hue: 198,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m3b',
    column: 3,
    row: 2,
    chapter: '3B',
    title: 'Center merge',
    description: 'B lane — receives merges from 2B and 2C; feeds 4B.',
    progress: 0,
    locked: true,
    hue: 196,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m4a',
    column: 4,
    row: 1,
    chapter: '4A',
    title: 'Upper branch',
    description: 'A lane — rejoins the center hub at chapter 5.',
    progress: 0,
    locked: true,
    hue: 194,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m4b',
    column: 4,
    row: 2,
    chapter: '4B',
    title: 'Lower branch',
    description: 'B lane — merge target from 3A and 3B before chapter 5.',
    progress: 0,
    locked: true,
    hue: 192,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m5',
    column: 5,
    row: 2,
    chapter: '5',
    title: 'Center hub',
    description: '4A and 4B meet here, then the path splits again.',
    progress: 0,
    locked: true,
    hue: 200,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m6a',
    column: 6,
    row: 1,
    chapter: '6A',
    title: 'Upper fan',
    description: 'A lane out of the hub — carries to the finale.',
    progress: 0,
    locked: true,
    hue: 198,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m6b',
    column: 6,
    row: 2,
    chapter: '6B',
    title: 'Middle fan',
    description: 'B lane — one of three paths into chapter 7.',
    progress: 0,
    locked: true,
    hue: 196,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m6c',
    column: 6,
    row: 3,
    chapter: '6C',
    title: 'Lower fan',
    description: 'C lane — merges up to the finale on the center row.',
    progress: 0,
    locked: true,
    hue: 194,
    modal: { badge: 'PRACTICE', cta: 'Play module', showStats: true }
  },
  {
    id: 'c3m7',
    column: 7,
    row: 2,
    chapter: '7',
    title: 'Finale',
    description: 'All lanes converge — close out the volume.',
    progress: 0,
    locked: true,
    hue: 200,
    modal: { badge: 'CHECK-IN', cta: 'Play module', showStats: true }
  }
];

export const CHAPTER_3_EDGES = [
  ['c3m1', 'c3m2a'],
  ['c3m1', 'c3m2b'],
  ['c3m1', 'c3m2c'],
  ['c3m2a', 'c3m3a'],
  ['c3m2b', 'c3m3a'],
  ['c3m2b', 'c3m3b'],
  ['c3m2c', 'c3m3b'],
  ['c3m3a', 'c3m4a'],
  ['c3m3a', 'c3m4b'],
  ['c3m3b', 'c3m4b'],
  ['c3m4a', 'c3m5'],
  ['c3m4b', 'c3m5'],
  ['c3m5', 'c3m6a'],
  ['c3m5', 'c3m6b'],
  ['c3m5', 'c3m6c'],
  ['c3m6a', 'c3m7'],
  ['c3m6b', 'c3m7'],
  ['c3m6c', 'c3m7']
];

export const CHAPTER_3_CORD_ANCHORS = {
  'c3m1|c3m2a': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.upper,
    subwayLane: 0,
    slack: 1.14,
    sagSign: -1
  },
  'c3m1|c3m2b': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.center,
    subwayLane: 1,
    slack: 1.14,
    sagSign: 1
  },
  'c3m1|c3m2c': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.lower,
    subwayLane: 2,
    slack: 1.14,
    sagSign: 1
  },
  'c3m2a|c3m3a': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.upper,
    subwayLane: 0,
    slack: 1.12,
    sagSign: -1
  },
  'c3m2b|c3m3a': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.upper,
    subwayLane: 0,
    slack: 1.12,
    sagSign: -1
  },
  'c3m2b|c3m3b': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.center,
    subwayLane: 1,
    slack: 1.12,
    sagSign: 1
  },
  'c3m2c|c3m3b': {
    from: 'right',
    to: 'left',
    fromAlong: SUBWAY_JUNCTION_ALONG.lower,
    toAlong: SUBWAY_JUNCTION_ALONG.center,
    subwayLane: 1,
    slack: 1.12,
    sagSign: 1
  },
  'c3m3a|c3m4a': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.upper,
    subwayLane: 0,
    slack: 1.1,
    sagSign: -1
  },
  'c3m3a|c3m4b': {
    from: 'right',
    to: 'left',
    fromAlong: SUBWAY_JUNCTION_ALONG.upper,
    toAlong: SUBWAY_JUNCTION_ALONG.center,
    subwayLane: 0,
    slack: 1.1,
    sagSign: -1
  },
  'c3m3b|c3m4b': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.center,
    subwayLane: 1,
    slack: 1.1,
    sagSign: 1
  },
  'c3m4a|c3m5': {
    from: 'right',
    to: 'left',
    fromAlong: SUBWAY_JUNCTION_ALONG.upper,
    toAlong: SUBWAY_JUNCTION_ALONG.center,
    subwayLane: 0,
    slack: 1.1,
    sagSign: -1
  },
  'c3m4b|c3m5': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.center,
    subwayLane: 1,
    slack: 1.1,
    sagSign: 1
  },
  'c3m5|c3m6a': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.upper,
    subwayLane: 0,
    slack: 1.12,
    sagSign: -1
  },
  'c3m5|c3m6b': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.center,
    subwayLane: 1,
    slack: 1.12,
    sagSign: 1
  },
  'c3m5|c3m6c': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.lower,
    subwayLane: 2,
    slack: 1.12,
    sagSign: 1
  },
  'c3m6a|c3m7': {
    from: 'right',
    to: 'left',
    fromAlong: SUBWAY_JUNCTION_ALONG.upper,
    toAlong: SUBWAY_JUNCTION_ALONG.center,
    subwayLane: 0,
    slack: 1.08,
    sagSign: -1
  },
  'c3m6b|c3m7': {
    from: 'right',
    to: 'left',
    ...SUBWAY_FORK_ALONG.center,
    subwayLane: 1,
    slack: 1.08,
    sagSign: 1
  },
  'c3m6c|c3m7': {
    from: 'right',
    to: 'left',
    fromAlong: SUBWAY_JUNCTION_ALONG.lower,
    toAlong: SUBWAY_JUNCTION_ALONG.center,
    subwayLane: 2,
    slack: 1.08,
    sagSign: 1
  }
};

export const CHAPTER_3_PLAY_SCENARIOS = {
  c3m1: {
    choicesPrompt: 'Which lane does your choice open?',
    outcomes: [
      {
        id: 'upper',
        label: 'Upper lane (2A)',
        direction: 'up',
        plugWire: true,
        unlocks: ['c3m2a'],
        fills: ['c3m1|c3m2a'],
        lastChoice: 'Upper lane',
        empathyScore: 80,
        result: 'Chapter 2A opens on the A row.'
      },
      {
        id: 'middle',
        label: 'Middle lane (2B)',
        plugWire: true,
        unlocks: ['c3m2b'],
        fills: ['c3m1|c3m2b'],
        lastChoice: 'Middle lane',
        empathyScore: 80,
        result: 'Chapter 2B opens on the center row.'
      },
      {
        id: 'lower',
        label: 'Lower lane (2C)',
        direction: 'down',
        plugWire: true,
        unlocks: ['c3m2c'],
        fills: ['c3m1|c3m2c'],
        lastChoice: 'Lower lane',
        empathyScore: 80,
        result: 'Chapter 2C opens on the C row.'
      }
    ]
  },
  c3m2a: {
    choicesPrompt: 'From the A lane',
    outcomes: [
      {
        id: 'stay-a',
        label: 'Continue on 3A',
        direction: 'up',
        plugWire: true,
        unlocks: ['c3m3a'],
        fills: ['c3m2a|c3m3a'],
        lastChoice: 'Stay on A',
        result: 'Chapter 3A opens ahead.'
      }
    ]
  },
  c3m2b: {
    choicesPrompt: 'From the center split',
    outcomes: [
      {
        id: 'merge-up',
        label: 'Merge up to 3A',
        direction: 'up',
        plugWire: true,
        unlocks: ['c3m3a'],
        fills: ['c3m2b|c3m3a'],
        lastChoice: 'Merge up',
        result: 'Chapter 3A opens above.'
      },
      {
        id: 'stay-b',
        label: 'Continue on 3B',
        plugWire: true,
        unlocks: ['c3m3b'],
        fills: ['c3m2b|c3m3b'],
        lastChoice: 'Stay on B',
        result: 'Chapter 3B opens on the center row.'
      }
    ]
  },
  c3m2c: {
    choicesPrompt: 'From the C lane',
    outcomes: [
      {
        id: 'merge-b',
        label: 'Merge up to 3B',
        plugWire: true,
        unlocks: ['c3m3b'],
        fills: ['c3m2c|c3m3b'],
        lastChoice: 'Merge to B',
        result: 'Chapter 3B opens — C never jumps to A.'
      }
    ]
  },
  c3m3a: {
    choicesPrompt: 'Branch from 3A',
    outcomes: [
      {
        id: 'to-4a',
        label: 'Stay on 4A',
        direction: 'up',
        plugWire: true,
        unlocks: ['c3m4a'],
        fills: ['c3m3a|c3m4a'],
        lastChoice: '4A branch',
        result: 'Chapter 4A opens on the A row.'
      },
      {
        id: 'to-4b',
        label: 'Drop to 4B',
        direction: 'down',
        plugWire: true,
        unlocks: ['c3m4b'],
        fills: ['c3m3a|c3m4b'],
        lastChoice: 'Drop to B',
        result: 'Chapter 4B opens on the center row.'
      }
    ]
  },
  c3m3b: {
    choicesPrompt: 'From 3B',
    outcomes: [
      {
        id: 'to-4b',
        label: 'Continue to 4B',
        plugWire: true,
        unlocks: ['c3m4b'],
        fills: ['c3m3b|c3m4b'],
        lastChoice: '4B branch',
        result: 'Chapter 4B opens ahead.'
      }
    ]
  },
  c3m4a: {
    choicesPrompt: 'Rejoin the hub',
    outcomes: [
      {
        id: 'hub',
        label: 'Continue to chapter 5',
        plugWire: true,
        unlocks: ['c3m5'],
        fills: ['c3m4a|c3m5'],
        lastChoice: '4A → hub',
        result: 'Center hub at chapter 5 opens.'
      }
    ]
  },
  c3m4b: {
    choicesPrompt: 'Rejoin the hub',
    outcomes: [
      {
        id: 'hub',
        label: 'Continue to chapter 5',
        plugWire: true,
        unlocks: ['c3m5'],
        fills: ['c3m4b|c3m5'],
        lastChoice: '4B → hub',
        result: 'Center hub at chapter 5 opens.'
      }
    ]
  },
  c3m5: {
    choicesPrompt: 'Fan out from the hub',
    outcomes: [
      {
        id: 'fan-a',
        label: 'Upper fan (6A)',
        direction: 'up',
        plugWire: true,
        unlocks: ['c3m6a'],
        fills: ['c3m5|c3m6a'],
        lastChoice: '6A fan',
        result: 'Chapter 6A opens above.'
      },
      {
        id: 'fan-b',
        label: 'Middle fan (6B)',
        plugWire: true,
        unlocks: ['c3m6b'],
        fills: ['c3m5|c3m6b'],
        lastChoice: '6B fan',
        result: 'Chapter 6B opens on the center row.'
      },
      {
        id: 'fan-c',
        label: 'Lower fan (6C)',
        direction: 'down',
        plugWire: true,
        unlocks: ['c3m6c'],
        fills: ['c3m5|c3m6c'],
        lastChoice: '6C fan',
        result: 'Chapter 6C opens below.'
      }
    ]
  },
  c3m6a: {
    choicesPrompt: 'Finish on the A lane',
    outcomes: [
      {
        id: 'finale',
        label: 'Merge to finale',
        plugWire: true,
        unlocks: ['c3m7'],
        fills: ['c3m6a|c3m7'],
        lastChoice: '6A → 7',
        result: 'Finale opens on the center row.'
      }
    ]
  },
  c3m6b: {
    choicesPrompt: 'Finish on the B lane',
    outcomes: [
      {
        id: 'finale',
        label: 'Continue to finale',
        plugWire: true,
        unlocks: ['c3m7'],
        fills: ['c3m6b|c3m7'],
        lastChoice: '6B → 7',
        result: 'Finale opens ahead.'
      }
    ]
  },
  c3m6c: {
    choicesPrompt: 'Finish from the C lane',
    outcomes: [
      {
        id: 'finale',
        label: 'Merge up to finale',
        plugWire: true,
        unlocks: ['c3m7'],
        fills: ['c3m6c|c3m7'],
        lastChoice: '6C → 7',
        result: 'Finale opens — merged from below.'
      }
    ]
  },
  c3m7: {
    choicesPrompt: 'Close the volume',
    outcomes: [
      {
        id: 'finish',
        label: 'Complete volume',
        lastChoice: 'Finale',
        result: 'Volume 3 complete.'
      }
    ]
  }
};

export const CHAPTER_2_END_MODULE_ID = 'c2m3';
export const CHAPTER_3_END_MODULE_ID = 'c3m7';

/**
 * Distinct upstream routes into hub / final modules (for path-hover picker).
 * `along` is 0–1 band on the target card for pointer selection (top → bottom).
 */
export const PATH_ROUTE_VARIANTS = {
  m5: [
    {
      id: 'via-upper',
      along: SUBWAY_JUNCTION_ALONG.upper,
      label: '2A · 4',
      edges: ['m1|m2', 'm2|m6', 'm6|m8', 'm8|m5']
    },
    {
      id: 'via-lower',
      along: SUBWAY_JUNCTION_ALONG.lower,
      label: '2B · 4',
      edges: ['m1|m2', 'm2|m4', 'm4|m8', 'm8|m5']
    }
  ],
  c3m7: [
    {
      id: 'via-a-a-a',
      along: SUBWAY_JUNCTION_ALONG.upper,
      label: '2A·3A·4A·6A',
      edges: [
        'c3m1|c3m2a',
        'c3m2a|c3m3a',
        'c3m3a|c3m4a',
        'c3m4a|c3m5',
        'c3m5|c3m6a',
        'c3m6a|c3m7'
      ]
    },
    {
      id: 'via-b-b-b',
      along: SUBWAY_JUNCTION_ALONG.center,
      label: '2B·3B·4B·6B',
      edges: [
        'c3m1|c3m2b',
        'c3m2b|c3m3b',
        'c3m3b|c3m4b',
        'c3m4b|c3m5',
        'c3m5|c3m6b',
        'c3m6b|c3m7'
      ]
    },
    {
      id: 'via-c-c-c',
      along: SUBWAY_JUNCTION_ALONG.lower,
      label: '2C·3B·4B·6C',
      edges: [
        'c3m1|c3m2c',
        'c3m2c|c3m3b',
        'c3m3b|c3m4b',
        'c3m4b|c3m5',
        'c3m5|c3m6c',
        'c3m6c|c3m7'
      ]
    }
  ]
};

/** @param {string} moduleId */
export function getPathRouteVariants(moduleId) {
  return PATH_ROUTE_VARIANTS[moduleId] ?? null;
}

export function getChapterGraph(chapter) {
  if (chapter === 2) {
    return {
      modules: CHAPTER_2_MODULES,
      edges: CHAPTER_2_EDGES,
      cordAnchors: CHAPTER_2_CORD_ANCHORS,
      scenarios: CHAPTER_2_PLAY_SCENARIOS
    };
  }
  if (chapter === 3) {
    return {
      modules: CHAPTER_3_MODULES,
      edges: CHAPTER_3_EDGES,
      cordAnchors: CHAPTER_3_CORD_ANCHORS,
      scenarios: CHAPTER_3_PLAY_SCENARIOS
    };
  }
  return {
    modules: CONSEQUENCE_MODULES,
    edges: CONSEQUENCE_EDGES,
    cordAnchors: CONSEQUENCE_CORD_ANCHORS,
    scenarios: MODULE_PLAY_SCENARIOS
  };
}

/** @deprecated — use consequence-progress session state */
export const CONSEQUENCE_FILLED_EDGE_KEYS = [];

export const CONSEQUENCE_PLAY_ORDER = ['m1', 'm2', 'm4', 'm6', 'm8', 'm5'];

/** Primary skill each module contributes to the player profile aggregate. */
export const MODULE_SKILL_FOCUS = {
  m1: 'communication',
  m2: 'empathy',
  m4: 'ownership',
  m6: 'empathy',
  m8: 'communication',
  m5: 'ownership',
  c2m1: 'communication',
  c2m2: 'empathy',
  c2m3: 'ownership',
  c3m1: 'communication',
  c3m2a: 'empathy',
  c3m2b: 'communication',
  c3m2c: 'ownership',
  c3m3a: 'empathy',
  c3m3b: 'communication',
  c3m4a: 'empathy',
  c3m4b: 'ownership',
  c3m5: 'communication',
  c3m6a: 'empathy',
  c3m6b: 'communication',
  c3m6c: 'ownership',
  c3m7: 'ownership'
};
