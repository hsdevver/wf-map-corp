/**
 * Cheat-panel layout visibility — mirrors corporate board regions.
 */

import { applyPathGridLayoutMode } from './path-grid-layout.js?v=flex-only-v2';
import {
  PATH_LANE_FRAMING_MODES,
  applyPathLaneFramingMode,
  getPathLaneFramingMode,
  setPathLaneFramingMode
} from './path-lane-framing.js';
import {
  PATH_COLUMN_GUTTER_MODES,
  applyPathColumnGutterMode,
  getPathColumnGutterMode,
  setPathColumnGutterMode
} from './path-column-gutter.js';
const STORAGE_KEY = 'wf-cheat-layout-v3';

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

/** Force dashboard path + main column visible (fixes stale layout-cheat session hiding #modules). */
export function resetCorporateDashboardLayout() {
  const next = { ...DEFAULT_LAYOUT };
  next.hero = true;
  next.sidebar = true;
  next.main = true;
  next.copy = true;
  next.lead = true;
  next.path = true;
  return setLayoutVisibility(next);
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
      <span class="cheat-panel__label" id="cheat-path-lane-framing-label">Path lane zoom</span>
      <div class="cheat-panel__segmented" role="group" aria-label="Path lane zoom framing">
        ${PATH_LANE_FRAMING_MODES.map(
          (mode) =>
            `<button type="button" class="cheat-panel__seg-btn" data-path-lane-framing="${mode.id}">${mode.label}</button>`
        ).join('')}
      </div>
      <p class="cheat-panel__sound-note">5 columns: lane zoom fills five chapter columns (top/bottom branches may clip). Fit rows: caps card size so the full branch stack fits vertically — you may see more than five columns.</p>
      <span class="cheat-panel__label" id="cheat-path-column-gutter-label">Column gutters</span>
      <div class="cheat-panel__segmented" role="group" aria-label="Chapter column gutter spacing">
        ${PATH_COLUMN_GUTTER_MODES.map(
          (mode) =>
            `<button type="button" class="cheat-panel__seg-btn" data-path-column-gutter="${mode.id}">${mode.label}</button>`
        ).join('')}
      </div>
      <p class="cheat-panel__sound-note">Scales horizontal space between chapter columns (more room for subway tubes between cards).</p>
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

  syncPathLaneFramingUi(panel);
  syncPathColumnGutterUi(panel);
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

  panel.querySelectorAll('[data-path-lane-framing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPathLaneFramingMode(/** @type {'five-columns' | 'fit-rows'} */ (btn.dataset.pathLaneFraming));
      syncLayoutSkeletonUi(panel);
    });
  });

  panel.querySelectorAll('[data-path-column-gutter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPathColumnGutterMode(/** @type {import('./path-column-gutter.js').PathColumnGutterMode} */ (btn.dataset.pathColumnGutter));
      syncLayoutSkeletonUi(panel);
    });
  });
}

/** @param {HTMLElement} panel */
export function syncPathLaneFramingUi(panel) {
  const mode = getPathLaneFramingMode();
  panel.querySelectorAll('[data-path-lane-framing]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.pathLaneFraming === mode);
  });
}

/** @param {HTMLElement} panel */
export function syncPathColumnGutterUi(panel) {
  const mode = getPathColumnGutterMode();
  panel.querySelectorAll('[data-path-column-gutter]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.pathColumnGutter === mode);
  });
}

export function initLayoutCheat() {
  if (/\/workflow-intro\//.test(window.location.pathname)) {
    resetCorporateDashboardLayout();
  } else {
    applyLayoutVisibility();
  }
  applyPathGridLayoutMode();
  applyPathLaneFramingMode();
  applyPathColumnGutterMode();
}
