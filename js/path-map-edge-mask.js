/**
 * Path map edge feather — CSS mask-image on the path map container (no overlay DOM).
 * Fades only appear on edges where content is clipped by the viewport.
 */

const CLIP_EPSILON_PX = 2;
const FEATHER_PCT = 9;
/** @type {WeakMap<HTMLElement, ResizeObserver>} */
const observers = new WeakMap();

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownFns = new WeakMap();

/**
 * @param {HTMLElement} pathMapEl
 * @returns {{ fadeTop: boolean, fadeBottom: boolean, fadeLeft: boolean, fadeRight: boolean }}
 */
function measurePathMapEdgeFades(pathMapEl) {
  const eps = CLIP_EPSILON_PX;
  const mapW = pathMapEl.clientWidth;
  const mapH = pathMapEl.clientHeight;

  const grid = pathMapEl.querySelector('.intro-path-grid');
  if (!grid || mapW < 1 || mapH < 1) {
    return { fadeTop: false, fadeBottom: false, fadeLeft: false, fadeRight: false };
  }

  const mapRect = pathMapEl.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  const hOverflow = pathMapEl.scrollWidth - mapW > eps || gridRect.width > mapW + eps;
  const vOverflow = pathMapEl.scrollHeight - mapH > eps || gridRect.height > mapH + eps;

  return {
    fadeLeft: hOverflow && gridRect.left < mapRect.left - eps,
    fadeRight: hOverflow && gridRect.right > mapRect.right + eps,
    fadeTop: vOverflow && gridRect.top < mapRect.top - eps,
    fadeBottom: vOverflow && gridRect.bottom > mapRect.bottom + eps
  };
}

/**
 * @param {boolean} fadeStart
 * @param {boolean} fadeEnd
 */
function buildAxisMask(direction, fadeStart, fadeEnd) {
  const f = `${FEATHER_PCT}%`;
  if (direction === 'vertical') {
    const start = fadeStart ? `transparent 0%, #000 ${f}` : '#000 0%';
    const end = fadeEnd ? `#000 calc(100% - ${f}), transparent 100%` : '#000 100%';
    return `linear-gradient(to bottom, ${start}, ${end})`;
  }
  const start = fadeStart ? `transparent 0%, #000 ${f}` : '#000 0%';
  const end = fadeEnd ? `#000 calc(100% - ${f}), transparent 100%` : '#000 100%';
  return `linear-gradient(to right, ${start}, ${end})`;
}

function clearPathMapEdgeMask(pathMapEl) {
  pathMapEl.style.removeProperty('-webkit-mask-image');
  pathMapEl.style.removeProperty('mask-image');
  pathMapEl.style.removeProperty('-webkit-mask-composite');
  pathMapEl.style.removeProperty('mask-composite');
  pathMapEl.style.removeProperty('mask-repeat');
  pathMapEl.style.removeProperty('mask-size');
  pathMapEl.classList.remove('has-path-edge-mask');

  const stage = pathMapEl.querySelector('.intro-path-map__stage');
  if (!stage) return;
  stage.style.removeProperty('-webkit-mask-image');
  stage.style.removeProperty('mask-image');
  stage.style.removeProperty('-webkit-mask-composite');
  stage.style.removeProperty('mask-composite');
}

function removeLegacyEdgeBlurDom(pathMapEl) {
  pathMapEl.querySelector('.intro-path-map__edge-blur')?.remove();
  pathMapEl.classList.remove('has-path-edge-blur', 'is-path-edge-masked');
}

/** Keep zoom controls outside the masked path map subtree. */
function reparentPathZoomControls(pathMapEl) {
  const controls = pathMapEl.querySelector('.intro-path-zoom-controls');
  if (!controls) return;
  const host =
    pathMapEl.closest('.intro-modules') ??
    pathMapEl.closest('#modules') ??
    pathMapEl.parentElement;
  if (host && controls.parentElement === pathMapEl) {
    host.appendChild(controls);
  }
}

/**
 * @param {HTMLElement | null} pathMapEl
 */
export function syncPathMapEdgeMask(pathMapEl) {
  if (!pathMapEl) return;

  removeLegacyEdgeBlurDom(pathMapEl);
  reparentPathZoomControls(pathMapEl);

  const fades = measurePathMapEdgeFades(pathMapEl);
  const hasFade =
    fades.fadeTop || fades.fadeBottom || fades.fadeLeft || fades.fadeRight;

  if (!hasFade) {
    clearPathMapEdgeMask(pathMapEl);
    return;
  }

  const vertical = buildAxisMask('vertical', fades.fadeTop, fades.fadeBottom);
  const horizontal = buildAxisMask('horizontal', fades.fadeLeft, fades.fadeRight);
  const maskImage = `${vertical}, ${horizontal}`;

  pathMapEl.classList.add('has-path-edge-mask');
  pathMapEl.style.webkitMaskImage = maskImage;
  pathMapEl.style.maskImage = maskImage;
  pathMapEl.style.webkitMaskComposite = 'source-in';
  pathMapEl.style.maskComposite = 'intersect';
  pathMapEl.style.maskRepeat = 'no-repeat';
  pathMapEl.style.maskSize = '100% 100%';
}

/**
 * @param {HTMLElement | null} pathMapEl
 */
export function ensurePathMapEdgeMask(pathMapEl) {
  if (!pathMapEl) return;

  removeLegacyEdgeBlurDom(pathMapEl);
  syncPathMapEdgeMask(pathMapEl);

  if (!observers.has(pathMapEl)) {
    const run = () => syncPathMapEdgeMask(pathMapEl);
    const ro = new ResizeObserver(run);
    ro.observe(pathMapEl);
    const stage = pathMapEl.querySelector('.intro-path-map__stage');
    const grid = pathMapEl.querySelector('.intro-path-grid');
    if (stage) ro.observe(stage);
    if (grid) ro.observe(grid);

    window.addEventListener('resize', run, { passive: true });
    teardownFns.set(pathMapEl, () => {
      window.removeEventListener('resize', run);
    });
    observers.set(pathMapEl, ro);
  }
}

/**
 * @param {HTMLElement | null} pathMapEl
 */
export function teardownPathMapEdgeMask(pathMapEl) {
  if (!pathMapEl) return;
  observers.get(pathMapEl)?.disconnect();
  observers.delete(pathMapEl);
  teardownFns.get(pathMapEl)?.();
  teardownFns.delete(pathMapEl);
  clearPathMapEdgeMask(pathMapEl);
  removeLegacyEdgeBlurDom(pathMapEl);
}
