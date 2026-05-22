/**
 * Corporate path grid row rules — strict (vol. 3) vs flex (vol. 1-style forks).
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

/** @param {string | number | null | undefined} chapter */
export function chapterLaneLetter(chapter) {
  const raw = String(chapter ?? '').trim();
  const match = raw.match(/([ABC])$/i);
  return match ? match[1].toUpperCase() : null;
}

/** Main spine row — chapters 1, 2, 4, 5 and strict-mode B lanes. */
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

/** @param {string | number | null | undefined} chapter */
function strictRowForChapter(chapter) {
  const lane = chapterLaneLetter(chapter);
  if (lane === 'A') return 1;
  if (lane === 'B') return PATH_GRID_SPINE_ROW;
  if (lane === 'C') return 3;
  return PATH_GRID_SPINE_ROW;
}

/** @param {string | number | null | undefined} chapter */
function flexRowForChapter(chapter) {
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
  const useStrictColumn = mode === 'strict' || letters.has('C');

  if (useStrictColumn) return strictRowForChapter(mod.chapter);
  return flexRowForChapter(mod.chapter);
}

/**
 * Flex: per column, A on top and B on bottom when there is no C lane (vol. 1 forks).
 * Columns that include C use strict rows (vol. 3 fan).
 *
 * @template {object} T
 * @param {T[]} modules
 * @param {PathGridLayoutMode} [mode]
 * @returns {T[]}
 */
export function layoutPathGridModules(modules, mode = getPathGridLayoutMode()) {
  if (!modules?.length || !pathGridNeedsLayoutRules(modules)) return modules;

  const byColumn = new Map();
  for (const mod of modules) {
    if (!byColumn.has(mod.column)) byColumn.set(mod.column, []);
    byColumn.get(mod.column).push(mod);
  }

  return modules.map((mod) => {
    const row = resolvePathGridRow(mod, modules, mode);
    return row === mod.row ? mod : { ...mod, row };
  });
}
