/**
 * Path column gutter spacing — cheat-panel preference (horizontal gap between chapter columns).
 */

const STORAGE_KEY = 'wf-cheat-path-column-gutter-v2';

/** @typedef {'default' | '1.5' | '2' | '2.5' | '3'} PathColumnGutterMode */

export const PATH_COLUMN_GUTTER_MODES = [
  { id: 'default', label: 'Default' },
  { id: '1.5', label: '1.5×' },
  { id: '2', label: '2×' },
  { id: '2.5', label: '2.5×' },
  { id: '3', label: '3×' }
];

/** @type {Record<PathColumnGutterMode, number>} */
const PATH_COLUMN_GUTTER_SCALES = {
  default: 1,
  '1.5': 1.5,
  '2': 2,
  '2.5': 2.5,
  '3': 3
};

/** @param {string | null | undefined} raw */
function normalizePathColumnGutterMode(raw) {
  if (raw === 'wide') return '2.5';
  if (raw && raw in PATH_COLUMN_GUTTER_SCALES) return /** @type {PathColumnGutterMode} */ (raw);
  return 'default';
}

/** @returns {PathColumnGutterMode} */
export function getPathColumnGutterMode() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return normalizePathColumnGutterMode(raw);
    const legacy = sessionStorage.getItem('wf-cheat-path-column-gutter-v1');
    return normalizePathColumnGutterMode(legacy);
  } catch {
    /* ignore */
  }
  return 'default';
}

/** @param {PathColumnGutterMode} [mode] */
export function getPathColumnGutterScale(mode = getPathColumnGutterMode()) {
  return PATH_COLUMN_GUTTER_SCALES[normalizePathColumnGutterMode(mode)];
}

/** @param {PathColumnGutterMode} mode */
export function setPathColumnGutterMode(mode) {
  const next = normalizePathColumnGutterMode(mode);
  sessionStorage.setItem(STORAGE_KEY, next);
  applyPathColumnGutterMode(next);
  window.dispatchEvent(new CustomEvent('wf-path-column-gutter-change', { detail: { mode: next } }));
  return next;
}

/** Drop inline grid sizing so column-gap + width are recomputed from CSS vars. */
export function clearPathGridInlineColumnSizing(gridEl = document.getElementById('intro-columns')) {
  if (!gridEl) return;
  gridEl.style.removeProperty('column-gap');
  gridEl.style.removeProperty('width');
  gridEl.style.removeProperty('min-width');
  gridEl.style.removeProperty('max-width');
}

/**
 * Measure default (1×) column gap in px by briefly forcing scale to 1.
 * @param {HTMLElement} gridEl
 */
function measurePathColGapBasePx(gridEl) {
  const html = document.documentElement;
  const prevScale = html.style.getPropertyValue('--path-col-gap-scale');
  html.style.setProperty('--path-col-gap-scale', '1');
  clearPathGridInlineColumnSizing(gridEl);
  void gridEl.offsetWidth;
  const base = parseFloat(getComputedStyle(gridEl).columnGap);
  if (prevScale) html.style.setProperty('--path-col-gap-scale', prevScale);
  else html.style.removeProperty('--path-col-gap-scale');
  return Number.isFinite(base) && base > 0 ? base : 40;
}

/** @param {PathColumnGutterMode} [mode] */
export function applyPathColumnGutterMode(mode = getPathColumnGutterMode()) {
  const next = normalizePathColumnGutterMode(mode);
  const scale = getPathColumnGutterScale(next);
  const html = document.documentElement;
  html.dataset.pathColumnGutter = next;
  html.style.setProperty('--path-col-gap-scale', String(scale));

  const grid = document.getElementById('intro-columns');
  clearPathGridInlineColumnSizing(grid);
  if (grid) void grid.offsetWidth;
}

/**
 * Horizontal gap between path columns in px (cheat scale × base gap).
 * @param {HTMLElement | null} [gridEl]
 */
export function resolvePathColumnGapPx(gridEl = document.getElementById('intro-columns')) {
  const scale = getPathColumnGutterScale();
  if (!gridEl) return 40 * scale;

  clearPathGridInlineColumnSizing(gridEl);
  void gridEl.offsetWidth;

  const fromGrid = parseFloat(getComputedStyle(gridEl).columnGap);
  if (Number.isFinite(fromGrid) && fromGrid > 0) return fromGrid;

  return measurePathColGapBasePx(gridEl) * scale;
}
