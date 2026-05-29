import {
  applyTheme,
  CORPORATE_APPEARANCES,
  getCorporateThemePresets,
  getThemeState,
  initTheme,
  normalizeHex
} from './theme.js';
import { initModuleLayout } from './module-layout.js';
import {
  getMusicTrack,
  getMusicVolumePercent,
  isMusicMuted,
  MUSIC_TRACKS,
  setMusicMuted,
  setMusicTrack,
  setMusicVolume,
  initAmbientMusicSync
} from './ambient-music.js?v=music-tracks-v1';
import {
  lockVolumeModules,
  resetConsequenceProgress,
  setCorporateVolumeCheatMode,
  unlockAllConsequenceProgress,
  unlockVolumeModules
} from './consequence-progress.js?v=flex-only-v2';
import {
  HOVER_SOUND_CATEGORIES,
  getHoverSoundCategory,
  getHoverSoundMode,
  getHoverSoundVolumePercent,
  initModuleCardSounds,
  setHoverSoundCategory,
  setHoverSoundMode,
  setHoverSoundVolume
} from './ui-sounds.js';
import {
  applyLayoutVisibility,
  buildLayoutSkeletonHtml,
  initLayoutCheat,
  syncLayoutSkeletonUi,
  wireLayoutCheat
} from './layout-cheat.js';
import { getFlowWiringMode, initFlowWiringCheat, setFlowWiringMode } from './flow-wiring-cheat.js';

const PANEL_ID = 'wf-cheat-panel';
const PANEL_VERSION = 'corp-18';

function isWorkflowIntroPage() {
  return /\/workflow-intro\//.test(window.location.pathname);
}

function panelIsCurrent(panel) {
  if (!panel || panel.dataset.panelVersion !== PANEL_VERSION) return false;
  if (!panel.querySelector('[data-corporate-appearance]')) return false;
  if (!panel.querySelector('[data-music-volume]')) return false;
  if (!panel.querySelector('[data-music-track]')) return false;
  if (!panel.querySelector('[data-hover-sound-volume]')) return false;
  if (isWorkflowIntroPage()) {
    if (!panel.querySelector('[data-cheat-layout]')) return false;
    if (!panel.querySelector('[data-flow-wiring]')) return false;
  }
  if (!panel.querySelector('.cheat-panel__body')) return false;
  return true;
}

const CHEAT_FAB_REVEAL_MS = 1000;
let cheatFabRevealTimer = 0;

function cheatFabRevealDelayMs() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : CHEAT_FAB_REVEAL_MS;
}

function clearCheatFabRevealTimer() {
  if (!cheatFabRevealTimer) return;
  clearTimeout(cheatFabRevealTimer);
  cheatFabRevealTimer = 0;
}

function setCheatFabRevealed(revealed) {
  const fab = document.getElementById('wf-cheat-fab');
  if (!fab) return;
  const visible = revealed || fab.getAttribute('aria-expanded') === 'true';
  fab.classList.toggle('cheat-panel-fab--revealed', visible);
  fab.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (visible) fab.removeAttribute('tabindex');
  else fab.setAttribute('tabindex', '-1');
}

function wireCheatFabReveal(zone) {
  if (zone.dataset.cheatFabRevealWired === '1') return;
  zone.dataset.cheatFabRevealWired = '1';

  const fab = document.getElementById('wf-cheat-fab');
  if (!fab) return;

  const scheduleReveal = () => {
    clearCheatFabRevealTimer();
    if (fab.classList.contains('cheat-panel-fab--revealed')) return;
    cheatFabRevealTimer = window.setTimeout(() => {
      cheatFabRevealTimer = 0;
      setCheatFabRevealed(true);
    }, cheatFabRevealDelayMs());
  };

  const hideUnlessPinned = () => {
    clearCheatFabRevealTimer();
    if (fab.getAttribute('aria-expanded') === 'true') return;
    setCheatFabRevealed(false);
  };

  zone.addEventListener('pointerenter', scheduleReveal);
  zone.addEventListener('pointerleave', hideUnlessPinned);
  zone.addEventListener('pointercancel', hideUnlessPinned);
  setCheatFabRevealed(false);
}

function ensureCheatFab() {
  let zone = document.getElementById('wf-cheat-fab-zone');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'wf-cheat-fab-zone';
    zone.className = 'cheat-panel-fab-zone';
    document.body.appendChild(zone);
  }

  let fab = document.getElementById('wf-cheat-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'wf-cheat-fab';
    fab.type = 'button';
    fab.className = 'cheat-panel-fab';
    fab.setAttribute('aria-label', 'Open cheat panel');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML =
      '<span class="cheat-panel-fab__mark" aria-hidden="true">◇</span><span class="cheat-panel-fab__label">Cheat</span>';
    fab.addEventListener('click', () => toggleCheatPanel());
  }

  if (fab.parentElement !== zone) zone.appendChild(fab);
  wireCheatFabReveal(zone);
  return fab;
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panelIsCurrent(panel)) return panel;
  panel?.remove();
  panel = buildPanel();
  wirePanel(panel);
  syncPanelUi(panel);
  ensureCheatFab();
  return panel;
}

export function toggleCheatPanel() {
  const panel = ensurePanel();
  if (!panel) return;
  setPanelOpen(panel, !panel.classList.contains('is-open'));
}

function buildPanel() {
  const existing = document.getElementById(PANEL_ID);
  if (panelIsCurrent(existing)) return existing;
  existing?.remove();

  const panel = document.createElement('aside');
  panel.id = PANEL_ID;
  panel.dataset.panelVersion = PANEL_VERSION;
  panel.className = 'cheat-panel';
  panel.setAttribute('aria-label', 'Prototype cheat panel');
  panel.hidden = true;

  const state = getThemeState();
  const presets = getCorporateThemePresets();
  const showPathReset = isWorkflowIntroPage();

  panel.innerHTML = `
    <header class="cheat-panel__header">
      <h2 class="cheat-panel__title">Cheat panel</h2>
      <button type="button" class="cheat-panel__close" data-cheat-close aria-label="Close">×</button>
    </header>
    <div class="cheat-panel__body">

    <section class="cheat-panel__section" data-cheat-corporate-appearance aria-labelledby="cheat-corporate-appearance-label">
      <span class="cheat-panel__label" id="cheat-corporate-appearance-label">Corporate appearance</span>
      <div class="cheat-panel__segmented" role="group" aria-label="Image hero or colour theme">
        ${CORPORATE_APPEARANCES.map(
          (mode) =>
            `<button type="button" class="cheat-panel__seg-btn" data-corporate-appearance="${mode.id}">${mode.label}</button>`
        ).join('')}
      </div>
    </section>

    <section class="cheat-panel__section" data-cheat-theme-color aria-labelledby="cheat-theme-label">
      <span class="cheat-panel__label" id="cheat-theme-label">Primary colour</span>
      <p class="cheat-panel__sound-note" data-cheat-theme-note hidden></p>
      <div class="cheat-panel__color-row">
        <input type="color" class="cheat-panel__color-input" data-theme-color-input value="${normalizeHex(state.themeColor)}" aria-label="Pick theme colour" />
        <input type="text" class="cheat-panel__color-hex" data-theme-color-hex value="${normalizeHex(state.themeColor)}" spellcheck="false" aria-label="Theme colour hex" />
      </div>
      <div class="cheat-panel__swatches" role="list" aria-label="Theme presets">
        ${presets
          .map(
            (hex) =>
              `<button type="button" class="cheat-panel__swatch" data-theme-preset="${hex}" style="background:${hex}" aria-label="Theme ${hex}"></button>`
          )
          .join('')}
      </div>
    </section>

    ${showPathReset ? buildLayoutSkeletonHtml() : ''}

    <section class="cheat-panel__section" aria-labelledby="cheat-music-label">
      <span class="cheat-panel__label" id="cheat-music-label">Background music</span>
      <div class="cheat-panel__segmented" role="group" aria-label="Background music on or muted">
        <button type="button" class="cheat-panel__seg-btn" data-music="on">On</button>
        <button type="button" class="cheat-panel__seg-btn" data-music="muted">Muted</button>
      </div>
      <div class="cheat-panel__segmented" role="group" aria-label="Background music track">
        ${MUSIC_TRACKS.map(
          (track) =>
            `<button type="button" class="cheat-panel__seg-btn" data-music-track="${track.id}">${track.label}</button>`
        ).join('')}
      </div>
      <label class="cheat-panel__volume" for="cheat-music-volume">
        <span class="cheat-panel__volume-label">Volume</span>
        <input
          type="range"
          class="cheat-panel__volume-slider"
          id="cheat-music-volume"
          data-music-volume
          min="0"
          max="100"
          step="1"
          value="${getMusicVolumePercent()}"
        />
        <span class="cheat-panel__volume-value" data-music-volume-label>${getMusicVolumePercent()}%</span>
      </label>
    </section>

    <section class="cheat-panel__section" aria-labelledby="cheat-hover-sound-label">
      <span class="cheat-panel__label" id="cheat-hover-sound-label">Module hover sound</span>
      <div class="cheat-panel__segmented cheat-panel__segmented--compact" role="group" aria-label="Hover sound pick mode">
        <button type="button" class="cheat-panel__seg-btn" data-hover-sound-mode="random">Random pick</button>
        <button type="button" class="cheat-panel__seg-btn" data-hover-sound-mode="single">Same each time</button>
      </div>
      <div class="cheat-panel__sound-grid" role="group" aria-label="Hover sound category">
        ${HOVER_SOUND_CATEGORIES.map(
          (cat) =>
            `<button type="button" class="cheat-panel__sound-btn" data-hover-sound="${cat.id}">${cat.label}</button>`
        ).join('')}
      </div>
      <label class="cheat-panel__volume" for="cheat-hover-sound-volume">
        <span class="cheat-panel__volume-label">Volume</span>
        <input
          type="range"
          class="cheat-panel__volume-slider"
          id="cheat-hover-sound-volume"
          data-hover-sound-volume
          min="0"
          max="100"
          step="1"
          value="${getHoverSoundVolumePercent()}"
        />
        <span class="cheat-panel__volume-value" data-hover-sound-volume-label>${getHoverSoundVolumePercent()}%</span>
      </label>
      <p class="cheat-panel__sound-note">Random: new file from the category on every hover. Same: one fixed file per category.</p>
    </section>
    ${
      showPathReset
        ? `<section class="cheat-panel__section" aria-labelledby="cheat-path-label">
      <span class="cheat-panel__label" id="cheat-path-label">Path progress</span>
      <span class="cheat-panel__label" id="cheat-flow-wiring-label">Flow wiring</span>
      <div class="cheat-panel__segmented" role="group" aria-label="Volume 3 path complexity" data-flow-wiring>
        <button type="button" class="cheat-panel__seg-btn" data-flow-wiring-mode="complicated">Complicated</button>
        <button type="button" class="cheat-panel__seg-btn" data-flow-wiring-mode="simple">Simple</button>
      </div>
      <p class="cheat-panel__sound-note">Complicated adds the 3B → 4A branch tube. Simple keeps 3B on the center row to 4B only.</p>
      <div class="cheat-panel__path-actions">
        <div class="cheat-panel__path-row" role="group" aria-label="Volume access">
          <button type="button" class="cheat-panel__reset-path" data-lock-all-volumes>Lock all volumes</button>
          <button type="button" class="cheat-panel__reset-path" data-unlock-all-volumes>Open all volumes</button>
        </div>
        <hr class="cheat-panel__path-divider" />
        <button type="button" class="cheat-panel__reset-path" data-unlock-all-progress>Open all chapters</button>
        <button type="button" class="cheat-panel__reset-path" data-reset-progress>Lock all chapters</button>
        <div class="cheat-panel__path-row" role="group" aria-label="Volume 1 chapters">
          <button type="button" class="cheat-panel__reset-path" data-lock-volume-modules="1">Lock vol. 1 chapters</button>
          <button type="button" class="cheat-panel__reset-path" data-unlock-volume-modules="1">Open vol. 1 chapters</button>
        </div>
        <div class="cheat-panel__path-row" role="group" aria-label="Volume 2 chapters">
          <button type="button" class="cheat-panel__reset-path" data-lock-volume-modules="2">Lock vol. 2 chapters</button>
          <button type="button" class="cheat-panel__reset-path" data-unlock-volume-modules="2">Open vol. 2 chapters</button>
        </div>
        <div class="cheat-panel__path-row" role="group" aria-label="Volume 3 chapters">
          <button type="button" class="cheat-panel__reset-path" data-lock-volume-modules="3">Lock vol. 3 chapters</button>
          <button type="button" class="cheat-panel__reset-path" data-unlock-volume-modules="3">Open vol. 3 chapters</button>
        </div>
      </div>
    </section>`
        : ''
    }
    </div>
  `;

  document.body.appendChild(panel);
  return panel;
}

function syncPanelUi(panel) {
  const state = getThemeState();
  const color = normalizeHex(state.themeColor);

  panel.querySelectorAll('[data-corporate-appearance]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.corporateAppearance === state.corporateAppearance);
  });

  const themeColorSection = panel.querySelector('[data-cheat-theme-color]');
  if (themeColorSection) {
    themeColorSection.hidden = false;
  }
  const themeNote = panel.querySelector('[data-cheat-theme-note]');
  if (themeNote) {
    themeNote.hidden = false;
    themeNote.textContent =
      state.corporateAppearance === 'color'
        ? 'Sets the exact primary for paths, stars, and accents. Hero gradient stops are derived separately.'
        : 'Sets the exact primary for paths, stars, and accents. The hero photo stays the same.';
  }

  const colorInput = panel.querySelector('[data-theme-color-input]');
  const colorHex = panel.querySelector('[data-theme-color-hex]');
  if (colorInput) colorInput.value = color;
  if (colorHex) colorHex.value = color;

  panel.querySelectorAll('[data-theme-preset]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.themePreset === color);
  });

  const muted = isMusicMuted();
  panel.querySelectorAll('[data-music]').forEach((btn) => {
    btn.classList.toggle('is-active', muted ? btn.dataset.music === 'muted' : btn.dataset.music === 'on');
  });

  const musicTrack = getMusicTrack();
  panel.querySelectorAll('[data-music-track]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.musicTrack === musicTrack);
    btn.disabled = muted;
  });

  const volumePct = getMusicVolumePercent();
  const volumeSlider = panel.querySelector('[data-music-volume]');
  const volumeLabel = panel.querySelector('[data-music-volume-label]');
  if (volumeSlider) {
    volumeSlider.value = String(volumePct);
    volumeSlider.disabled = muted;
  }
  if (volumeLabel) volumeLabel.textContent = `${volumePct}%`;

  const hoverSound = getHoverSoundCategory();
  panel.querySelectorAll('[data-hover-sound]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.hoverSound === hoverSound);
  });

  const hoverMode = getHoverSoundMode();
  panel.querySelectorAll('[data-hover-sound-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.hoverSoundMode === hoverMode);
  });

  const hoverOff = hoverSound === 'off';
  const hoverVolumePct = getHoverSoundVolumePercent();
  const hoverVolumeSlider = panel.querySelector('[data-hover-sound-volume]');
  const hoverVolumeLabel = panel.querySelector('[data-hover-sound-volume-label]');
  if (hoverVolumeSlider) {
    hoverVolumeSlider.value = String(hoverVolumePct);
    hoverVolumeSlider.disabled = hoverOff;
  }
  if (hoverVolumeLabel) hoverVolumeLabel.textContent = `${hoverVolumePct}%`;

  if (panel.querySelector('[data-cheat-layout]')) syncLayoutSkeletonUi(panel);

  const flowWiring = getFlowWiringMode();
  panel.querySelectorAll('[data-flow-wiring-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.flowWiringMode === flowWiring);
  });
}

function setPanelOpen(panel, open) {
  panel.classList.toggle('is-open', open);
  panel.hidden = !open;
  const fab = document.getElementById('wf-cheat-fab');
  fab?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) setCheatFabRevealed(true);
  else if (!document.getElementById('wf-cheat-fab-zone')?.matches(':hover')) setCheatFabRevealed(false);
}

const CHEAT_PANEL_TRIGGERS =
  '.intro-chapter, .intro-corporate-board__title, .intro-corporate-nav__item[data-volume="1"], .intro-volume-overview__title, [data-volume-overview-title]';

/** Hidden trigger: Volume 1 label (nav, overview, or chapter title) opens the cheat panel. */
export function wireSecretChapterTrigger() {
  document.querySelectorAll(CHEAT_PANEL_TRIGGERS).forEach((el) => {
    if (el.dataset.cheatTrigger === '1') return;
    el.dataset.cheatTrigger = '1';
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCheatPanel();
    });
  });
}

function rebuildThemePresets(panel) {
  const state = getThemeState();
  const presets = getCorporateThemePresets();
  const swatches = panel.querySelector('.cheat-panel__swatches');
  if (!swatches) return;
  swatches.innerHTML = presets
    .map(
      (hex) =>
        `<button type="button" class="cheat-panel__swatch" data-theme-preset="${hex}" style="background:${hex}" aria-label="Theme ${hex}"></button>`
    )
    .join('');
  swatches.querySelectorAll('[data-theme-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = getThemeState();
      applyTheme({ ...next, themeColor: btn.dataset.themePreset });
      syncPanelUi(panel);
    });
  });
  syncPanelUi(panel);
}

function wirePanel(panel) {
  panel.querySelector('[data-cheat-close]')?.addEventListener('click', () => setPanelOpen(panel, false));

  panel.querySelectorAll('[data-corporate-appearance]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const state = getThemeState();
      applyTheme({ ...state, corporateAppearance: btn.dataset.corporateAppearance });
      syncPanelUi(panel);
      rebuildThemePresets(panel);
    });
  });

  const colorInput = panel.querySelector('[data-theme-color-input]');
  const colorHex = panel.querySelector('[data-theme-color-hex]');

  colorInput?.addEventListener('input', () => {
    const state = getThemeState();
    applyTheme({ ...state, themeColor: colorInput.value });
    syncPanelUi(panel);
  });

  colorHex?.addEventListener('change', () => {
    const state = getThemeState();
    applyTheme({ ...state, themeColor: colorHex.value });
    syncPanelUi(panel);
  });

  panel.querySelectorAll('[data-theme-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const state = getThemeState();
      applyTheme({ ...state, themeColor: btn.dataset.themePreset });
      syncPanelUi(panel);
    });
  });

  window.addEventListener('wf-theme-change', () => syncPanelUi(panel));

  panel.querySelectorAll('[data-music]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setMusicMuted(btn.dataset.music === 'muted');
      syncPanelUi(panel);
    });
  });

  panel.querySelectorAll('[data-music-track]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isMusicMuted()) return;
      setMusicTrack(/** @type {'office' | 'ambient'} */ (btn.dataset.musicTrack));
      syncPanelUi(panel);
    });
  });

  const volumeSlider = panel.querySelector('[data-music-volume]');
  const volumeLabel = panel.querySelector('[data-music-volume-label]');
  volumeSlider?.addEventListener('input', () => {
    const pct = Number(volumeSlider.value);
    if (volumeLabel) volumeLabel.textContent = `${pct}%`;
    setMusicVolume(pct / 100);
  });

  window.addEventListener('wf-music-change', () => syncPanelUi(panel));

  panel.querySelectorAll('[data-hover-sound-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setHoverSoundMode(btn.dataset.hoverSoundMode);
      syncPanelUi(panel);
    });
  });

  panel.querySelectorAll('[data-hover-sound]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setHoverSoundCategory(btn.dataset.hoverSound);
      syncPanelUi(panel);
    });
  });

  const hoverVolumeSlider = panel.querySelector('[data-hover-sound-volume]');
  const hoverVolumeLabel = panel.querySelector('[data-hover-sound-volume-label]');
  hoverVolumeSlider?.addEventListener('input', () => {
    const pct = Number(hoverVolumeSlider.value);
    if (hoverVolumeLabel) hoverVolumeLabel.textContent = `${pct}%`;
    setHoverSoundVolume(pct / 100);
  });

  window.addEventListener('wf-hover-sound-change', () => syncPanelUi(panel));

  panel.querySelector('[data-lock-all-volumes]')?.addEventListener('click', () => {
    setCorporateVolumeCheatMode('locked');
    window.dispatchEvent(new CustomEvent('wf-corporate-volumes-cheat'));
  });

  panel.querySelector('[data-unlock-all-volumes]')?.addEventListener('click', () => {
    setCorporateVolumeCheatMode('all');
    window.dispatchEvent(new CustomEvent('wf-corporate-volumes-cheat'));
  });

  panel.querySelector('[data-unlock-all-progress]')?.addEventListener('click', () => {
    unlockAllConsequenceProgress();
  });

  panel.querySelector('[data-reset-progress]')?.addEventListener('click', () => {
    resetConsequenceProgress();
  });

  panel.querySelectorAll('[data-lock-volume-modules]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vol = Number(btn.dataset.lockVolumeModules);
      lockVolumeModules(vol);
    });
  });

  panel.querySelectorAll('[data-unlock-volume-modules]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vol = Number(btn.dataset.unlockVolumeModules);
      unlockVolumeModules(vol);
    });
  });

  panel.querySelectorAll('[data-flow-wiring-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFlowWiringMode(btn.dataset.flowWiringMode);
      syncPanelUi(panel);
    });
  });

  if (panel.querySelector('[data-cheat-layout]')) wireLayoutCheat(panel);
}

function onPageShow(event) {
  if (!event.persisted) return;
  const panel = document.getElementById(PANEL_ID);
  if (!panelIsCurrent(panel)) {
    panel?.remove();
    const fresh = buildPanel();
    wirePanel(fresh);
    syncPanelUi(fresh);
    wireSecretChapterTrigger();
    applyLayoutVisibility();
  }
}

let cheatPanelInitialized = false;

export function initCheatPanel() {
  if (!cheatPanelInitialized) {
    cheatPanelInitialized = true;
    initTheme();
    initModuleLayout();
    initLayoutCheat();
    initFlowWiringCheat();
    initAmbientMusicSync();
    initModuleCardSounds();
    window.addEventListener('pageshow', onPageShow);
  }

  const panel = ensurePanel();
  if (panel.querySelector('[data-cheat-layout]')) syncLayoutSkeletonUi(panel);
  wireSecretChapterTrigger();
}
