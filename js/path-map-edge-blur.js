/**
 * Path map edge softening — progressive backdrop-blur strips (no dark gradient overlays).
 */

const EDGE_BLUR_LAYER_BLURS_PX = [5, 11, 20, 34];
const EDGE_BLUR_LAYER_BLURS_REDUCED_PX = [4, 8];

/** @type {WeakMap<HTMLElement, ResizeObserver>} */
const observers = new WeakMap();

function edgeBlurZoneHeightPx(pathMapEl) {
  const style = getComputedStyle(pathMapEl);
  const raw = style.getPropertyValue('--path-edge-fade').trim();
  const parsed = parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return Math.min(52, Math.max(28, pathMapEl.clientHeight * 0.08));
}

function blurAmountsForPreference() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced ? EDGE_BLUR_LAYER_BLURS_REDUCED_PX : EDGE_BLUR_LAYER_BLURS_PX;
}

/**
 * @param {HTMLElement} stack
 * @param {'top' | 'bottom'} side
 */
function ensureBlurLayers(stack, side) {
  const amounts = blurAmountsForPreference();
  const needed = amounts.length;

  while (stack.children.length < needed) {
    const layer = document.createElement('div');
    layer.className = 'intro-path-map__edge-blur-layer';
    layer.dataset.edgeBlurSide = side;
    stack.appendChild(layer);
  }
  while (stack.children.length > needed) {
    stack.lastElementChild?.remove();
  }

  [...stack.children].forEach((layer, i) => {
    layer.style.setProperty('--path-edge-blur-amount', `${amounts[i]}px`);
  });
}

/**
 * @param {HTMLElement} pathMapEl
 */
export function syncPathMapEdgeBlur(pathMapEl) {
  if (!pathMapEl) return;

  const root = pathMapEl.querySelector('.intro-path-map__edge-blur');
  if (!root) return;

  const zoneH = edgeBlurZoneHeightPx(pathMapEl);
  pathMapEl.style.setProperty('--path-edge-blur-zone', `${zoneH}px`);

  for (const stack of root.querySelectorAll('.intro-path-map__edge-blur-stack')) {
    const side = stack.dataset.edgeBlurSide === 'bottom' ? 'bottom' : 'top';
    stack.style.height = `${zoneH}px`;
    ensureBlurLayers(/** @type {HTMLElement} */ (stack), side);
  }
}

/**
 * @param {HTMLElement | null} pathMapEl
 */
export function ensurePathMapEdgeBlur(pathMapEl) {
  if (!pathMapEl) return;

  let root = pathMapEl.querySelector('.intro-path-map__edge-blur');
  if (!root) {
    root = document.createElement('div');
    root.className = 'intro-path-map__edge-blur';
    root.setAttribute('aria-hidden', 'true');

    for (const side of /** @type {const} */ (['top', 'bottom'])) {
      const stack = document.createElement('div');
      stack.className = `intro-path-map__edge-blur-stack intro-path-map__edge-blur-stack--${side}`;
      stack.dataset.edgeBlurSide = side;
      root.appendChild(stack);
    }

    pathMapEl.appendChild(root);
    pathMapEl.classList.add('has-path-edge-blur');
  }

  syncPathMapEdgeBlur(pathMapEl);

  if (!observers.has(pathMapEl)) {
    const ro = new ResizeObserver(() => syncPathMapEdgeBlur(pathMapEl));
    ro.observe(pathMapEl);
    observers.set(pathMapEl, ro);
  }
}

/**
 * @param {HTMLElement | null} pathMapEl
 */
export function teardownPathMapEdgeBlur(pathMapEl) {
  if (!pathMapEl) return;
  observers.get(pathMapEl)?.disconnect();
  observers.delete(pathMapEl);
  pathMapEl.querySelector('.intro-path-map__edge-blur')?.remove();
  pathMapEl.classList.remove('has-path-edge-blur');
}
