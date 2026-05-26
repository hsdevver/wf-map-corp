/**
 * Corporate path grid — strict (grid + fork rows) vs flex (centered branch stacks).
 */

const STORAGE_KEY = 'wf-cheat-path-grid-layout-v1';

/** @typedef {'flex' | 'strict'} PathGridLayoutMode */

export const PATH_GRID_LAYOUT_MODES = [
  { id: 'flex', label: 'Flex' },
  { id: 'strict', label: 'Strict' }
];

/** @returns {PathGridLayoutMode} */
export function getPathGridLayoutMode() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === 'flex' || raw === 'strict') return raw;
  } catch {
    /* ignore */
  }
  return 'flex';
}

/** @param {PathGridLayoutMode} mode */
export function setPathGridLayoutMode(mode) {
  const next = mode === 'strict' ? 'strict' : 'flex';
  sessionStorage.setItem(STORAGE_KEY, next);
  applyPathGridLayoutMode(next);
  return next;
}

/** @param {PathGridLayoutMode} [mode] */
export function applyPathGridLayoutMode(mode = getPathGridLayoutMode()) {
  document.documentElement.dataset.pathGridLayout = mode;
  window.dispatchEvent(new CustomEvent('wf-path-grid-layout-change', { detail: { mode } }));
}

export function isPathGridFlexLayout(mode = getPathGridLayoutMode()) {
  return mode === 'flex';
}

/**
 * Row tracks used for flex lane height — deepest branch stack, not graph row spread.
 * @param {{ column: number, row: number }[]} modules
 * @param {PathGridLayoutMode} [mode]
 */
export function pathGridEffectiveRowCount(modules, mode = getPathGridLayoutMode()) {
  if (!modules?.length) return 1;
  const maxGraphRow = Math.max(1, ...modules.map((m) => m.row));
  if (mode !== 'flex' || !pathGridNeedsLayoutRules(modules)) return maxGraphRow;

  const byColumn = new Map();
  for (const mod of modules) {
    if (!byColumn.has(mod.column)) byColumn.set(mod.column, []);
    byColumn.get(mod.column).push(mod);
  }
  let maxStack = 1;
  for (const colMods of byColumn.values()) {
    maxStack = Math.max(maxStack, colMods.length);
  }
  return maxStack;
}

/** @param {string | number | null | undefined} chapter */
export function chapterLaneLetter(chapter) {
  const raw = String(chapter ?? '').trim();
  const match = raw.match(/([ABC])$/i);
  return match ? match[1].toUpperCase() : null;
}

/** Main spine row — chapters 1, 2, 4, 5 and grid-strict B lanes on the spine. */
export const PATH_GRID_SPINE_ROW = 2;

/** True when the graph uses fork columns (not a single-row linear path). */
export function pathGridNeedsLayoutRules(modules) {
  if (!modules?.length) return false;
  const byColumn = new Map();
  for (const mod of modules) {
    if (!byColumn.has(mod.column)) byColumn.set(mod.column, []);
    byColumn.get(mod.column).push(mod);
  }
  if ([...byColumn.values()].some((col) => col.length > 1)) return true;
  return modules.some((m) => chapterLaneLetter(m.chapter));
}

/** @deprecated Use pathGridNeedsLayoutRules */
export function pathGridHasVerticalLanes(modules) {
  return pathGridNeedsLayoutRules(modules);
}

/** Strict grid: A top, B on spine, C bottom (vol. 3 fan). Used for flex stack order & spacing. */
function laneRowStrictGrid(chapter) {
  const lane = chapterLaneLetter(chapter);
  if (lane === 'A') return 1;
  if (lane === 'B') return PATH_GRID_SPINE_ROW;
  if (lane === 'C') return 3;
  return PATH_GRID_SPINE_ROW;
}

/** Strict grid: A top, B bottom when a column has no C lane (vol. 1-style fork on the grid). */
function laneRowStrictGridFork(chapter) {
  const lane = chapterLaneLetter(chapter);
  if (lane === 'A') return 1;
  if (lane === 'B') return 3;
  return PATH_GRID_SPINE_ROW;
}

/**
 * Resolve grid row for one module (exported for DOM sync).
 * @param {{ column: number, row: number, chapter?: string | number }} mod
 * @param {{ column: number, chapter?: string | number }[]} modules
 * @param {PathGridLayoutMode} [mode]
 */
export function resolvePathGridRow(mod, modules, mode = getPathGridLayoutMode()) {
  if (!modules?.length || !pathGridNeedsLayoutRules(modules)) return mod.row;

  const colMods = modules.filter((m) => m.column === mod.column);
  const letters = new Set(
    colMods.map((m) => chapterLaneLetter(m.chapter)).filter(Boolean)
  );

  if (mode === 'flex') {
    /** Flex: logical strict rows for stack order (DOM centers the branch). */
    return laneRowStrictGrid(mod.chapter);
  }

  /** Strict: grid placement — fork spread when no C lane, else A / spine / C rows. */
  if (letters.has('C')) return laneRowStrictGrid(mod.chapter);
  return laneRowStrictGridFork(mod.chapter);
}

/**
 * @template {object} T
 * @param {T[]} modules
 * @param {PathGridLayoutMode} [mode]
 * @returns {T[]}
 */
export function layoutPathGridModules(modules, mode = getPathGridLayoutMode()) {
  if (!modules?.length || !pathGridNeedsLayoutRules(modules)) return modules;

  return modules.map((mod) => {
    const row = resolvePathGridRow(mod, modules, mode);
    return row === mod.row ? mod : { ...mod, row };
  });
}
