/**
 * Path lane zoom framing — cheat-panel preference.
 * five-columns: prioritize five horizontal columns (rows may clip).
 * fit-rows: cap card size so the deepest branch stack fits vertically.
 */

const STORAGE_KEY = 'wf-cheat-path-lane-framing-v1';

/** @typedef {'five-columns' | 'fit-rows'} PathLaneFramingMode */

export const PATH_LANE_FRAMING_MODES = [
  { id: 'five-columns', label: '5 columns' },
  { id: 'fit-rows', label: 'Fit rows' }
];

/** @returns {PathLaneFramingMode} */
export function getPathLaneFramingMode() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === 'fit-rows' || raw === 'five-columns') return raw;
  } catch {
    /* ignore */
  }
  return 'five-columns';
}

/** @param {PathLaneFramingMode} [mode] */
export function isPathLaneFitRows(mode = getPathLaneFramingMode()) {
  return mode === 'fit-rows';
}

/** @param {PathLaneFramingMode} mode */
export function setPathLaneFramingMode(mode) {
  const next = mode === 'fit-rows' ? 'fit-rows' : 'five-columns';
  sessionStorage.setItem(STORAGE_KEY, next);
  applyPathLaneFramingMode(next);
  window.dispatchEvent(new CustomEvent('wf-path-lane-framing-change', { detail: { mode: next } }));
  return next;
}

/** @param {PathLaneFramingMode} [mode] */
export function applyPathLaneFramingMode(mode = getPathLaneFramingMode()) {
  document.documentElement.dataset.pathLaneFraming = mode;
}
