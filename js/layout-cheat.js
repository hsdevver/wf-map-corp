/**
 * Cheat-panel layout visibility — mirrors corporate board regions.
 */

const STORAGE_KEY = 'wf-cheat-layout-v3';
const THUMB_STYLE_KEY = 'wf-cheat-chapter-thumb-v1';
const PATH_HIGHLIGHT_KEY = 'wf-cheat-path-highlight-v2';

/** @typedef {'backdrop' | 'image'} ChapterThumbStyle */
/** @typedef {'hover' | 'recent' | 'completed'} PathHighlightMode */

export const CHAPTER_THUMB_STYLES = [
  { id: 'backdrop', label: 'Frosted panel' },
  { id: 'image', label: 'Chapter image' }
];

export const PATH_HIGHLIGHT_MODES = [
  { id: 'hover', label: 'Local hover' },
  { id: 'recent', label: 'Recent path' },
  { id: 'completed', label: 'All opened' }
];

/** @typedef {'hero' | 'sidebar' | 'main' | 'copy' | 'lead' | 'path' | 'skills' | 'feedback'} LayoutRegionId */

export const LAYOUT_REGIONS = [
  { id: 'hero', label: 'Header', selector: '.intro-corporate-board__hero' },
  { id: 'sidebar', label: 'Sidebar', selector: '.intro-corporate-leaderboard-column' },
  { id: 'main', label: 'Main', selector: '.intro-corporate-board__main', nested: ['copy', 'lead', 'path'] },
  {
    id: 'copy',
    label: 'Intro block',
    selector: '.intro-corporate-board__copy',
    parent: 'main',
    nested: ['lead']
  },
  { id: 'lead', label: 'Lead text', selector: '.intro-corporate-board__lead', parent: 'copy' },
  { id: 'path', label: 'Chapter path', selector: '#modules', parent: 'main' },
  {
    id: 'skills',
    label: 'Skills',
    selector: '.intro-corporate-player-profile__skills',
    parent: 'sidebar'
  },
  {
    id: 'feedback',
    label: 'Feedback',
    selector: '#intro-corporate-feedback',
    parent: 'sidebar'
  }
];

const DEFAULT_LAYOUT = Object.fromEntries(
  LAYOUT_REGIONS.map((r) => [r.id, r.id !== 'skills' && r.id !== 'feedback'])
);

/** @param {LayoutRegionId} id */
function regionById(id) {
  return LAYOUT_REGIONS.find((r) => r.id === id);
}

/** @param {Record<LayoutRegionId, boolean>} state */
function isRegionEnabled(state, id) {
  const region = regionById(id);
  if (!region) return true;
  if (region.parent && !state[region.parent]) return false;
  return Boolean(state[id]);
}

/** @returns {Record<LayoutRegionId, boolean>} */
export function getLayoutVisibility() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw);
    const out = { ...DEFAULT_LAYOUT };
    for (const region of LAYOUT_REGIONS) {
      if (typeof parsed[region.id] === 'boolean') out[region.id] = parsed[region.id];
    }
    return out;
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

/** @param {Record<LayoutRegionId, boolean>} state */
export function setLayoutVisibility(state) {
  const next = { ...DEFAULT_LAYOUT };
  for (const region of LAYOUT_REGIONS) {
    if (typeof state[region.id] === 'boolean') next[region.id] = state[region.id];
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyLayoutVisibility(next);
  return next;
}

/** @param {LayoutRegionId} id */
export function toggleLayoutRegion(id) {
  const state = getLayoutVisibility();
  state[id] = !state[id];
  return setLayoutVisibility(state);
}

function remeasureSideProfile() {
  const profile = document.getElementById('intro-corporate-player-profile');
  const column = document.querySelector('.intro-corporate-leaderboard-column');
  if (!profile || !column) return;

  profile.style.removeProperty('height');
  profile.style.removeProperty('min-height');
  profile.style.removeProperty('max-height');

  const state = getLayoutVisibility();
  const compact =
    state.sidebar && (!state.skills || !state.feedback);

  if (!compact) {
    column.style.removeProperty('--side-profile-height');
    return;
  }

  const h = Math.ceil(profile.scrollHeight);
  column.style.setProperty('--side-profile-height', `${h}px`);
}

/** @param {Record<LayoutRegionId, boolean>} state */
export function applyLayoutVisibility(state = getLayoutVisibility()) {
  const root = document.documentElement;
  for (const region of LAYOUT_REGIONS) {
    const visible = isRegionEnabled(state, region.id);
    root.classList.toggle(`wf-layout-hidden-${region.id}`, !visible);
  }

  const compactProfile =
    state.sidebar && (!state.skills || !state.feedback);
  root.classList.toggle('wf-layout-compact-profile', compactProfile);

  requestAnimationFrame(() => {
    remeasureSideProfile();
    window.dispatchEvent(new CustomEvent('wf-layout-cheat-change', { detail: { state } }));
  });
}

export function buildLayoutSkeletonHtml() {
  return `
    <section class="cheat-panel__section" data-cheat-layout aria-labelledby="cheat-layout-label">
      <span class="cheat-panel__label" id="cheat-layout-label">Layout</span>
      <p class="cheat-panel__sound-note">Tap a zone on the map to show or hide that part of the board.</p>
      <div class="cheat-layout-sketch" role="group" aria-label="Board layout map">
        <div class="cheat-layout-sketch__map">
          <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--hero" data-layout-region="hero">
            <span class="cheat-layout-sketch__zone-label">Header</span>
          </button>
          <div class="cheat-layout-sketch__board">
            <div class="cheat-layout-sketch__main-stack">
              <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--band cheat-layout-sketch__zone--main" data-layout-region="main">
                <span class="cheat-layout-sketch__zone-label">Main column</span>
              </button>
              <div class="cheat-layout-sketch__main-parts">
                <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--copy" data-layout-region="copy">
                  <span class="cheat-layout-sketch__zone-label">Intro</span>
                </button>
                <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--lead" data-layout-region="lead">
                  <span class="cheat-layout-sketch__zone-label">Lead</span>
                </button>
                <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--path" data-layout-region="path">
                  <span class="cheat-layout-sketch__zone-label">Path</span>
                </button>
              </div>
            </div>
            <div class="cheat-layout-sketch__side-stack">
              <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--band cheat-layout-sketch__zone--sidebar" data-layout-region="sidebar">
                <span class="cheat-layout-sketch__zone-label">Sidebar</span>
              </button>
              <div class="cheat-layout-sketch__side-parts">
                <span class="cheat-layout-sketch__ghost" aria-hidden="true">You</span>
                <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--skills" data-layout-region="skills">
                  <span class="cheat-layout-sketch__zone-label">Skills</span>
                </button>
                <button type="button" class="cheat-layout-sketch__zone cheat-layout-sketch__zone--feedback" data-layout-region="feedback">
                  <span class="cheat-layout-sketch__zone-label">Feedback</span>
                </button>
                <span class="cheat-layout-sketch__ghost cheat-layout-sketch__ghost--dim" aria-hidden="true">Activity</span>
                <span class="cheat-layout-sketch__ghost cheat-layout-sketch__ghost--dim" aria-hidden="true">Board</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span class="cheat-panel__label" id="cheat-chapter-thumb-label">Chapter cards</span>
      <div class="cheat-panel__segmented" role="group" aria-label="Locked chapter card appearance">
        ${CHAPTER_THUMB_STYLES.map(
          (mode) =>
            `<button type="button" class="cheat-panel__seg-btn" data-chapter-thumb="${mode.id}">${mode.label}</button>`
        ).join('')}
      </div>
      <p class="cheat-panel__sound-note">Frosted panel: glass over the office photo. Chapter image: blurred photo inside the card.</p>
      <span class="cheat-panel__label" id="cheat-path-highlight-label">Path highlight</span>
      <div class="cheat-panel__segmented" role="group" aria-label="Chapter path highlight">
        ${PATH_HIGHLIGHT_MODES.map(
          (mode) =>
            `<button type="button" class="cheat-panel__seg-btn" data-path-highlight="${mode.id}">${mode.label}</button>`
        ).join('')}
      </div>
      <p class="cheat-panel__sound-note">Local hover: scrub taken routes into a chapter (no locked stops). Recent path: on chapter hover, only your latest taken route there. All opened: on chapter hover, every taken route into that chapter.</p>
    </section>`;
}

/** @param {HTMLElement} panel */
export function syncLayoutSkeletonUi(panel) {
  const state = getLayoutVisibility();

  panel.querySelectorAll('[data-layout-region]').forEach((btn) => {
    const id = /** @type {LayoutRegionId} */ (btn.dataset.layoutRegion);
    const region = regionById(id);
    const enabled = isRegionEnabled(state, id);
    const parentId = region?.parent;
    const parentOff = parentId ? !state[parentId] : false;

    btn.classList.toggle('is-on', enabled);
    btn.classList.toggle('is-off', !enabled);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.disabled = parentOff;
    btn.setAttribute(
      'aria-label',
      `${region?.label ?? id}: ${enabled ? 'visible' : 'hidden'}${parentOff ? ` (${regionById(parentId)?.label ?? parentId} is off)` : ''}`
    );
  });

  syncChapterThumbUi(panel);
  syncPathHighlightUi(panel);
}

/** @param {HTMLElement} panel */
export function wireLayoutCheat(panel) {
  panel.querySelectorAll('[data-layout-region]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const id = /** @type {LayoutRegionId} */ (btn.dataset.layoutRegion);
      const state = getLayoutVisibility();
      state[id] = !state[id];
      setLayoutVisibility(state);
      syncLayoutSkeletonUi(panel);
    });
  });

  panel.querySelectorAll('[data-chapter-thumb]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setChapterThumbStyle(/** @type {ChapterThumbStyle} */ (btn.dataset.chapterThumb));
      syncLayoutSkeletonUi(panel);
    });
  });

  panel.querySelectorAll('[data-path-highlight]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPathHighlightMode(/** @type {PathHighlightMode} */ (btn.dataset.pathHighlight));
      syncLayoutSkeletonUi(panel);
    });
  });
}

/** @param {HTMLElement} panel */
export function syncChapterThumbUi(panel) {
  const style = getChapterThumbStyle();
  panel.querySelectorAll('[data-chapter-thumb]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.chapterThumb === style);
  });
}

/** @returns {ChapterThumbStyle} */
export function getChapterThumbStyle() {
  try {
    const raw = sessionStorage.getItem(THUMB_STYLE_KEY);
    if (raw === 'image' || raw === 'backdrop') return raw;
  } catch {
    /* ignore */
  }
  return 'image';
}

/** @param {ChapterThumbStyle} style */
export function setChapterThumbStyle(style) {
  const next = style === 'image' ? 'image' : 'backdrop';
  sessionStorage.setItem(THUMB_STYLE_KEY, next);
  applyChapterThumbStyle(next);
  return next;
}

/** @param {ChapterThumbStyle} [style] */
export function applyChapterThumbStyle(style = getChapterThumbStyle()) {
  const root = document.documentElement;
  root.dataset.chapterThumb = style;
  root.classList.toggle('wf-chapter-thumb-image', style === 'image');
  root.classList.toggle('wf-chapter-thumb-backdrop', style === 'backdrop');
  window.dispatchEvent(new CustomEvent('wf-chapter-thumb-style-change', { detail: { style } }));
}

/** @returns {PathHighlightMode} */
export function getPathHighlightMode() {
  try {
    const raw = sessionStorage.getItem(PATH_HIGHLIGHT_KEY);
    if (raw === 'hover' || raw === 'recent' || raw === 'completed') return raw;
  } catch {
    /* ignore */
  }
  return 'recent';
}

/** @param {PathHighlightMode} mode */
export function setPathHighlightMode(mode) {
  const next =
    mode === 'recent' || mode === 'completed' ? mode : /** @type {PathHighlightMode} */ ('hover');
  sessionStorage.setItem(PATH_HIGHLIGHT_KEY, next);
  applyPathHighlightMode(next);
  return next;
}

/** @param {PathHighlightMode} [mode] */
export function applyPathHighlightMode(mode = getPathHighlightMode()) {
  document.documentElement.dataset.pathHighlight = mode;
  window.dispatchEvent(new CustomEvent('wf-path-highlight-mode-change', { detail: { mode } }));
}

/** @param {HTMLElement} panel */
export function syncPathHighlightUi(panel) {
  const mode = getPathHighlightMode();
  panel.querySelectorAll('[data-path-highlight]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.pathHighlight === mode);
  });
}

export function initLayoutCheat() {
  applyLayoutVisibility();
  applyChapterThumbStyle();
  applyPathHighlightMode();
}
