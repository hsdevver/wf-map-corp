const STORAGE_KEY = 'wf-cheat-lock-size-v1';

export const LOCK_SIZE_SCALES = ['1', '1.5', '2', '2.5'];

/** @returns {'1' | '1.5' | '2' | '2.5'} */
export function getLockSizeScale() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (LOCK_SIZE_SCALES.includes(raw)) return /** @type {'1' | '1.5' | '2' | '2.5'} */ (raw);
  } catch {
    /* ignore */
  }
  return '1';
}

/** @param {string} scale */
export function setLockSizeScale(scale) {
  const next = LOCK_SIZE_SCALES.includes(scale) ? scale : '1';
  sessionStorage.setItem(STORAGE_KEY, next);
  applyLockSizeScale(next);
  window.dispatchEvent(new CustomEvent('wf-lock-size-change', { detail: { scale: next } }));
  return next;
}

/** @param {string} [scale] */
export function applyLockSizeScale(scale = getLockSizeScale()) {
  const next = LOCK_SIZE_SCALES.includes(scale) ? scale : '1';
  document.documentElement.dataset.lockSize = next;
  document.documentElement.style.setProperty('--lock-size-scale', next);
}

export function initLockSizeCheat() {
  applyLockSizeScale();
}
