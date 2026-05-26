/** Volume 3 optional branch: chapter 3B → 4A (complicated wiring). */
export const FLOW_WIRING_3B_4A_KEY = 'c3m3b|c3m4a';
export const FLOW_WIRING_3B_4A_EDGE = ['c3m3b', 'c3m4a'];

const STORAGE_KEY = 'wf-cheat-flow-wiring-v1';

/** @typedef {'simple' | 'complicated'} FlowWiringMode */

/** @returns {FlowWiringMode} */
export function getFlowWiringMode() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === 'simple' || raw === 'complicated') return raw;
  } catch {
    /* ignore */
  }
  return 'complicated';
}

/** @param {FlowWiringMode} mode */
export function setFlowWiringMode(mode) {
  const next = mode === 'simple' ? 'simple' : 'complicated';
  sessionStorage.setItem(STORAGE_KEY, next);
  applyFlowWiringMode(next);
  window.dispatchEvent(new CustomEvent('wf-flow-wiring-change', { detail: { mode: next } }));
  return next;
}

/** @param {FlowWiringMode} [mode] */
export function applyFlowWiringMode(mode = getFlowWiringMode()) {
  document.documentElement.dataset.flowWiring = mode;
}

export function isComplicatedFlowWiring() {
  return getFlowWiringMode() === 'complicated';
}

export function initFlowWiringCheat() {
  applyFlowWiringMode();
}
