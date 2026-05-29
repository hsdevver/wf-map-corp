/**
 * Corporate path grid — flex cords (centered branch stacks).
 */

/** @typedef {'flex'} PathGridLayoutMode */

export const PATH_GRID_LAYOUT = 'flex';

/** @deprecated Flex-only layout — kept for cached imports */
export const PATH_GRID_LAYOUT_MODES = [PATH_GRID_LAYOUT];

export function applyPathGridLayoutMode() {
  document.documentElement.dataset.pathGridLayout = PATH_GRID_LAYOUT;
}

/** @deprecated Always flex */
export function getPathGridLayoutMode() {
  return PATH_GRID_LAYOUT;
}

/** @deprecated No-op — layout is always flex */
export function setPathGridLayoutMode(_mode) {
  applyPathGridLayoutMode();
}

/** @deprecated Always true */
export function isPathGridFlexLayout() {
  return true;
}

/**
 * Row tracks used for flex lane height — deepest branch stack, not graph row spread.
 * @param {{ column: number, row: number }[]} modules
 */
export function pathGridEffectiveRowCount(modules) {
  if (!modules?.length) return 1;
  if (!pathGridNeedsLayoutRules(modules)) {
    return Math.max(1, ...modules.map((m) => m.row));
  }
  return PATH_GRID_SPINE_ROW + 1;
}

/** @param {string | number | null | undefined} chapter */
export function chapterLaneLetter(chapter) {
  const raw = String(chapter ?? '').trim();
  const match = raw.match(/([ABC])$/i);
  return match ? match[1].toUpperCase() : null;
}

/** Main spine row — chapters 1, 2, 4, 5 and B lanes on the spine. */
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

/** Flex stack: A top, spine B, C bottom (vol. 3 fan). */
function laneRowFlexGrid(chapter) {
  const lane = chapterLaneLetter(chapter);
  if (lane === 'A') return 1;
  if (lane === 'B') return PATH_GRID_SPINE_ROW;
  if (lane === 'C') return 3;
  return PATH_GRID_SPINE_ROW;
}

/** Flex 2-way pair — adjacent slots in one column. */
function laneRowFlexGridFork(chapter) {
  const lane = chapterLaneLetter(chapter);
  if (lane === 'A') return 1;
  if (lane === 'B') return 2;
  return PATH_GRID_SPINE_ROW;
}

/**
 * Resolve grid row for one module (exported for DOM sync).
 * @param {{ column: number, row: number, chapter?: string | number }} mod
 * @param {{ column: number, chapter?: string | number }[]} modules
 */
export function resolvePathGridRow(mod, modules) {
  if (!modules?.length || !pathGridNeedsLayoutRules(modules)) return mod.row;

  const colMods = modules.filter((m) => m.column === mod.column);
  const letters = new Set(
    colMods.map((m) => chapterLaneLetter(m.chapter)).filter(Boolean)
  );

  if (!letters.has('C') && colMods.length === 2) {
    return laneRowFlexGridFork(mod.chapter);
  }
  return laneRowFlexGrid(mod.chapter);
}

/**
 * @template {object} T
 * @param {T[]} modules
 * @returns {T[]}
 */
/** Map-local Y of the main-path spine center (middle row of the 3-row fork band). */
export function flexMainPathSpineCenterY(cardSizePx, rowGapPx, laneRows = 3) {
  const rows = Math.max(1, laneRows);
  const spineRow = Math.min(PATH_GRID_SPINE_ROW, rows);
  return (spineRow - 1) * (cardSizePx + rowGapPx) + cardSizePx * 0.5;
}

export function layoutPathGridModules(modules) {
  if (!modules?.length || !pathGridNeedsLayoutRules(modules)) return modules;

  return modules.map((mod) => {
    const row = resolvePathGridRow(mod, modules);
    return row === mod.row ? mod : { ...mod, row };
  });
}
