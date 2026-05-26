import { initCheatPanel, wireSecretChapterTrigger } from './cheat-panel.js';
import { getPathHighlightMode, resetCorporateDashboardLayout } from './layout-cheat.js';
import {
  getRecentActivityModuleIds,
  initIntroActivityLog,
  recordPlayActivity,
  syncIntroSideColumnLayout
} from './intro-activity-log.js';
import { initAmbientMusicSync, initAmbientPlayback } from './ambient-music.js?v=music-tracks-v1';
import {
  anchorFromRect,
  applySubwayLaneBundles,
  applySubwayMidXLanes,
  applySubwayClearOfCards,
  SUBWAY_MID_LANE_PITCH,
  sortSubwayCordPaintOrder,
  cordPathD,
  cordPhaseOffset,
  edgeKey,
  subwayCordPathD
} from './cord-paths.js';
import {
  EMPATHY_SCORE_CEIL,
  EMPATHY_SCORE_FLOOR,
  hasPerfectStars,
  starsForModule
} from './empathy-score.js';
import {
  CHAPTER_1_END_MODULE_ID,
  CHAPTER_2_END_MODULE_ID,
  CHAPTER_3_MODULES,
  CONSEQUENCE_MODULES,
  FLOW_GRAPH_BUILD,
  formatChapterLabel,
  getChapterAriaLabel,
  getPathRouteVariants,
  MODULE_SKILL_FOCUS
} from './consequence-flow.js?v=grid-7col-v1';
import {
  applyPlayOutcome,
  beginChapter2,
  beginChapter3,
  computePlayerLeaderboardPoints,
  wouldBlockStarGateUnlock,
  getChapterCordAnchors,
  getChapterEdges,
  getCurrentChapter,
  getEdgeChoiceLabel,
  getEdgeHoverLabel,
  getFilledEdgeKeys,
  getRuntimeModule,
  getRuntimeModules,
  getCorporateVolumeCheatMode,
  isChapter1Complete,
  isChapter2Complete,
  isChapter3HandoffDone,
  isChapterHandoffDone,
  isEdgeFilled,
  playModeBeforeOutcome,
  setCatalogChapter,
  setCorporateVolumeCheatMode
} from './consequence-progress.js';
import { initModuleModal, isModuleModalOpen, openModuleModal } from './module-modal.js';
import {
  applyFolderChrome,
  createModuleThumbLabel,
  getModuleLayout,
  refreshFolderChrome,
  syncModuleThumbLabel
} from './module-layout.js';
import { playModuleHoverClick } from './ui-sounds.js';

/** Subtle tilt/offset per cell — grid slots, satellite scatter feel */
const INTRO_MODULE_SCATTER = {
  m1: { x: -10, y: 12, r: -3.2, z: 3 },
  m2: { x: 8, y: -8, r: 2.8, z: 2 },
  m6: { x: -12, y: 7, r: -2.5, z: 1 },
  m8: { x: 6, y: -4, r: 1.6, z: 1 },
  m4: { x: 11, y: -10, r: 3.2, z: 0 },
  m5: { x: -7, y: 11, r: -1.6, z: 2 },
  c2m1: { x: -6, y: 5, r: -2.2, z: 2 },
  c2m2: { x: 5, y: -4, r: 2.4, z: 1 },
  c2m3: { x: 8, y: 6, r: -1.8, z: 0 },
  c3m1: { x: -8, y: 10, r: -2.8, z: 3 },
  c3m2a: { x: 7, y: -9, r: 2.6, z: 2 },
  c3m2b: { x: -4, y: 3, r: -1.2, z: 2 },
  c3m2c: { x: -10, y: 8, r: -2.4, z: 1 },
  c3m3a: { x: 6, y: -7, r: 2.1, z: 2 },
  c3m3b: { x: -5, y: 4, r: -1.4, z: 1 },
  c3m4a: { x: 9, y: -6, r: 2.2, z: 2 },
  c3m4b: { x: 4, y: 5, r: 1.8, z: 1 },
  c3m5: { x: 5, y: 9, r: 1.6, z: 1 },
  c3m6a: { x: 8, y: -8, r: 2.4, z: 2 },
  c3m6b: { x: -6, y: 6, r: -1.8, z: 1 },
  c3m6c: { x: 10, y: 7, r: 2.6, z: 0 },
  c3m7: { x: 3, y: 8, r: 1.4, z: 1 }
};

function isCorporateSkin() {
  return document.documentElement.dataset.skin === 'corporate';
}

function isSpaceSkin() {
  return document.documentElement.dataset.skin === 'space';
}

function usesIntroSidePanel() {
  return isCorporateSkin() || isSpaceSkin();
}

function dissolveCorporatePathStacks() {
  if (!gridEl) return;
  gridEl.querySelectorAll('.intro-path-stack').forEach((stack) => {
    while (stack.firstChild) {
      gridEl.appendChild(stack.firstChild);
    }
    stack.remove();
  });
}

/** True when the path grid DOM matches the active catalog (avoids linear layout on stale vol. 3 cards). */
function pathMapMatchesCatalog() {
  if (!gridEl) return true;
  const catalogIds = getRuntimeModules()
    .map((m) => m.id)
    .sort()
    .join(',');
  const domIds = [...gridEl.querySelectorAll('.intro-module-wrap[data-module-anchor]')]
    .map((w) => w.dataset.moduleAnchor)
    .filter(Boolean)
    .sort()
    .join(',');
  return catalogIds === domIds;
}

const VOL1_PATH_MODULE_IDS = CONSEQUENCE_MODULES.map((m) => m.id)
  .sort()
  .join(',');
const VOL3_PATH_MODULE_IDS = CHAPTER_3_MODULES.map((m) => m.id)
  .sort()
  .join(',');

function volume1GraphIsLegacy(modules = getRuntimeModules()) {
  return modules.some(
    (m) =>
      m.id === 'm7' ||
      m.chapter === '2A' ||
      m.chapter === '2B' ||
      m.chapter === '4A' ||
      m.chapter === '4B' ||
      (m.id === 'm2' && m.chapter === '3')
  );
}

function volume3GraphIsLegacy(modules = getRuntimeModules()) {
  const ids = new Set(modules.map((m) => m.id));
  if (!ids.has('c3m7') || !ids.has('c3m2c') || !ids.has('c3m3a') || !ids.has('c3m6a')) return true;
  if (ids.has('c3m3')) return true;
  const twoB = modules.find((m) => m.id === 'c3m2b');
  if (twoB && twoB.row === 3) return true;
  const fourB = modules.find((m) => m.id === 'c3m4b');
  if (fourB && fourB.row === 3) return true;
  return modules.length < 12;
}

/** Align catalog chapter with the viewed volume before rendering (never call renderModules from here). */
function prepareCatalogForRender() {
  if (!isCorporateSkin() || !gridEl) return;

  const vol = getCorporateViewVolume();
  const catalogIds = getRuntimeModules()
    .map((m) => m.id)
    .sort()
    .join(',');

  if (vol === 1 && (catalogIds !== VOL1_PATH_MODULE_IDS || volume1GraphIsLegacy())) {
    console.warn(
      `[wf-map] Rebuilding volume 1 path map (${FLOW_GRAPH_BUILD}) — restoring classic graph`
    );
    setCatalogChapter(1);
    return;
  }

  if (vol === 3 && (catalogIds !== VOL3_PATH_MODULE_IDS || volume3GraphIsLegacy())) {
    console.warn(
      `[wf-map] Rebuilding volume 3 path map (${FLOW_GRAPH_BUILD}) — stale graph was cached`
    );
    setCatalogChapter(3);
    return;
  }

  if (!pathMapMatchesCatalog() && usesIntroSidePanel()) {
    setCatalogChapter(vol);
  }
}

/** After render: re-sync if DOM still does not match catalog. */
function syncCorporatePathMapToCatalog() {
  if (!isCorporateSkin() || !gridEl) return;
  prepareCatalogForRender();
  if (!pathMapMatchesCatalog()) {
    renderModules();
  }
}

/** Place each module on its graph row/column so forks align across the grid (reference layout). */
function applyCorporateModuleGridLayout({ skipCatalogSync = false } = {}) {
  if ((!isCorporateSkin() && !isSpaceSkin()) || !gridEl) return;
  if (!gridEl.querySelector('.intro-module-wrap')) return;

  dissolveCorporatePathStacks();

  const modules = getRuntimeModules();
  const byColumn = new Map();
  modules.forEach((mod) => {
    if (!byColumn.has(mod.column)) byColumn.set(mod.column, []);
    byColumn.get(mod.column).push(mod);
  });

  const maxRow = Math.max(1, ...modules.map((m) => m.row));
  const maxCol = Math.max(1, ...modules.map((m) => m.column));
  if (!isCorporateSkin()) {
    gridEl.style.gridTemplateRows = `repeat(${maxRow}, auto)`;
    gridEl.style.gridTemplateColumns = `repeat(${maxCol}, minmax(0, 1fr))`;
  }

  modules.forEach((mod) => {
    const wrap = gridEl.querySelector(`[data-module-anchor="${mod.id}"]`);
    if (!wrap) return;
    wrap.classList.remove(
      'intro-module-wrap--stacked',
      'intro-module-wrap--stack-top',
      'intro-module-wrap--stack-bottom'
    );
    wrap.classList.add('intro-module-wrap--solo');
    wrap.style.gridColumn = String(mod.column);
    wrap.style.gridRow = String(mod.row);
    wrap.dataset.pathRow = String(mod.row);
  });

  const rowSpread =
    modules.length > 0
      ? Math.max(...modules.map((m) => m.row)) - Math.min(...modules.map((m) => m.row))
      : 0;
  const hasColumnBranch = [...byColumn.values()].some((colMods) => {
    if (colMods.length < 2) return false;
    const rows = colMods.map((m) => m.row);
    return Math.max(...rows) - Math.min(...rows) > 0;
  });
  const isLinearLane = rowSpread === 0 && !hasColumnBranch;
  const linearCols = byColumn.size;
  const board = document.getElementById('intro-corporate-board');
  const modulesEl = document.getElementById('modules');
  board?.classList.toggle('is-path-linear', isLinearLane);
  modulesEl?.classList.toggle('is-path-linear', isLinearLane);
  pathMapEl?.classList.toggle('is-path-linear', isLinearLane);
  gridEl?.classList.toggle('is-path-linear', isLinearLane);
  if (isLinearLane && linearCols > 0) {
    gridEl?.style.setProperty('--path-linear-cols', String(linearCols));
  } else {
    gridEl?.style.removeProperty('--path-linear-cols');
  }

  if (isCorporateSkin()) syncCorporatePathViewport();
}

/** Soft ceiling only — dashboard cards scale with viewport below this. */
const PATH_CARD_MAX_PX = 360;
const PATH_CARD_MIN_PX = 72;
/** Corporate chapter cards — match vol 1–2 linear lane (~11rem). */
const PATH_CORPORATE_CHAPTER_CARD_MAX_PX = 176;
const PATH_FOCUS_COLUMN_COUNT = 5;
/** Fraction of column 6 visible at lane zoom (five full columns + ~10% of col. 6). */
const PATH_OVERVIEW_COLUMN_PEEK = 0.1;
const PATH_LATE_FOCUS_START_COL = 3;
const PATH_COLUMN_AFTER_CH3 = 4;
const PATH_COLUMN_OVERVIEW_MS = 2250;
const PATH_COLUMN_REVEAL_MS = 2800;
const PATH_FOCUS_PAN_MS = 2800;
const PATH_COLUMN_REVEAL_EASE = [0.14, 0.92, 0.18, 1];
/** Slower ease-out for horizontal focus-window pans (1–5 → 3–7). */
const PATH_FOCUS_PAN_EASE = [0.22, 0.03, 0.26, 1];
const PATH_ZOOM_OVERVIEW_THRESHOLD = 0.04;
/** Normalized zoom where five columns + col. 6 peek fill the lane (post-reveal resting view). */
const PATH_ZOOM_LANE_LEVEL = 0.58;
const PATH_ZOOM_STEP = 0.12;
const PATH_ZOOM_WHEEL_STEP = 0.05;
/** Plug wire → new chapter unlock sequence (2× base pacing). */
const PLUG_WIRE_TRAVEL_MS = 1840;
const PLUG_WIRE_SETTLE_MS = 1080;
const PLUG_LAND_SHAKE_MS = 200;
const PLUG_LAND_RISE_MS = 380;
const PLUG_LAND_SQUASH_MS = 360;
const PLUG_LAND_HOLD_MS = 100;
const PLUG_LAND_SETTLE_MS = 440;
const MODULE_PLUG_LAND_MS =
  PLUG_LAND_SHAKE_MS + PLUG_LAND_RISE_MS + PLUG_LAND_SQUASH_MS + PLUG_LAND_HOLD_MS + PLUG_LAND_SETTLE_MS;
const MODULE_PLUG_UNLOCK_AT_MS = PLUG_LAND_SHAKE_MS + PLUG_LAND_RISE_MS + PLUG_LAND_SQUASH_MS;
const PLUG_LAND_RISE_EASE = [0.12, 0.92, 0.22, 1];
const PLUG_LAND_SQUASH_EASE = [0.55, 0.02, 0.45, 1];
const PLUG_LAND_SETTLE_EASE = [0.22, 1.12, 0.36, 1];

let pathColumnRevealTimer = 0;
let pathColumnRevealRunId = 0;
/** @type {'idle' | 'overview' | 'focus' | 'revealing'} */
let pathColumnRevealPhase = 'idle';
/** 0 = entire flow, PATH_ZOOM_LANE_LEVEL = five cols + peek, 1 = max focus. */
let pathZoomLevel = 0;
/** @type {{ mapSize: number, laneSize: number, focusSize: number, panMap: number, panLane: number, panFocus: number, panFocusEarly: number, panFocusLate: number, focusStartCol: number, focusEndCol: number } | null} */
let pathRevealBounds = null;
let pathFocusWindowKey = '';
let pathFocusPanAnimRunId = 0;
let pathFocusPanAnimating = false;
let pathZoomControlsWired = false;
let pathPanDragWired = false;
/** Current stage translateX (map-local). */
let pathStagePanX = 0;

function getPathColumnCount(modules = getRuntimeModules()) {
  if (!modules.length) return 1;
  return Math.max(1, ...modules.map((m) => m.column));
}

function pathNeedsColumnReveal(modules = getRuntimeModules()) {
  return getPathColumnCount(modules) > PATH_FOCUS_COLUMN_COUNT;
}

function ensurePathMapStage() {
  if (!pathMapEl) return null;
  let stage = pathMapEl.querySelector('.intro-path-map__stage');
  if (!stage) {
    stage = document.createElement('div');
    stage.className = 'intro-path-map__stage';
    pathMapEl.appendChild(stage);
  }

  // SVG cords use path-map viewport coordinates; only the grid pans inside the stage.
  const connectors =
    pathMapEl.querySelector('#intro-connectors') ??
    pathMapEl.querySelector('.intro-connectors');
  if (connectors?.parentElement === stage) {
    pathMapEl.insertBefore(connectors, stage);
  }

  const zoomControls = pathMapEl.querySelector('.intro-path-zoom-controls');
  if (zoomControls?.parentElement === stage) {
    pathMapEl.appendChild(zoomControls);
  }

  if (gridEl && gridEl.parentElement !== stage) {
    stage.appendChild(gridEl);
  }

  return stage;
}

function measurePathVisibleWidth(modulesEl, gridPadX) {
  const modRect = modulesEl.getBoundingClientRect();
  let rightEdge = modRect.right;
  const lbPanel = document.querySelector('.intro-corporate-leaderboard-panel');
  if (lbPanel && (isCorporateSkin() || isSpaceSkin())) {
    const lbStyle = getComputedStyle(lbPanel);
    if (lbStyle.position === 'absolute') {
      const lbRect = lbPanel.getBoundingClientRect();
      if (lbRect.width > 0 && lbRect.left > modRect.left + 48) {
        rightEdge = lbRect.left;
      }
    }
  }
  return Math.max(0, rightEdge - modRect.left - gridPadX);
}

function measurePathLayoutBox() {
  const modulesEl = document.getElementById('modules');
  if (!modulesEl || !pathMapEl || !gridEl) return null;

  const modulesRect = modulesEl.getBoundingClientRect();
  const modulesH = modulesEl.clientHeight || modulesRect.height;
  if (modulesH < 48 && modulesRect.width < 48) return null;

  const pathStyle = getComputedStyle(pathMapEl);
  const pathPadY = parseFloat(pathStyle.paddingTop) + parseFloat(pathStyle.paddingBottom);
  const gridStyle = getComputedStyle(gridEl);
  const gridPadY = parseFloat(gridStyle.paddingTop) + parseFloat(gridStyle.paddingBottom);
  const gridPadX = parseFloat(gridStyle.paddingLeft) + parseFloat(gridStyle.paddingRight);
  const gridPadL = parseFloat(gridStyle.paddingLeft) || 0;

  const modules = getRuntimeModules();
  if (!modules.length) return null;

  return {
    modulesEl,
    availH: Math.max(0, modulesH - pathPadY - gridPadY),
    availW: measurePathVisibleWidth(modulesEl, gridPadX),
    maxRow: Math.max(1, ...modules.map((m) => m.row)),
    maxCol: Math.max(1, ...modules.map((m) => m.column)),
    colGap: parseFloat(gridStyle.columnGap) || 0,
    rowGap: parseFloat(gridStyle.rowGap) || 0,
    gridPadL,
    isLinear: gridEl.classList.contains('is-path-linear')
  };
}

/** Columns used to size cards in the path lane (not always the rendered module count). */
function pathDashboardColumnBudget(box) {
  if (!box) return PATH_FOCUS_COLUMN_COUNT;
  /* Linear vol. paths with fewer than five modules still size cards for a five-column lane. */
  if (box.isLinear && (isCorporateSkin() || isSpaceSkin())) {
    return Math.max(box.maxCol, PATH_FOCUS_COLUMN_COUNT);
  }
  if (box.isLinear) return box.maxCol;
  return Math.min(PATH_FOCUS_COLUMN_COUNT, box.maxCol);
}

/** Largest card size that keeps every grid row inside the path lane height. */
function computePathRowFitCardSize(box) {
  if (!box || box.maxRow < 1) return PATH_CARD_MIN_PX;
  const cardFromHeight = (box.availH - (box.maxRow - 1) * box.rowGap) / box.maxRow;
  return clampPathCardSizePx(cardFromHeight);
}

function clampPathCardSizePx(cardSize) {
  return Math.max(
    PATH_CARD_MIN_PX,
    Math.min(PATH_CARD_MAX_PX, Math.floor(cardSize))
  );
}

function computePathCardSize(
  box,
  columnBudget = pathDashboardColumnBudget(box),
  { widthOnly = false } = {}
) {
  const budget = Math.max(1, columnBudget);
  const cardFromWidth = (box.availW - (budget - 1) * box.colGap) / budget;
  const cardFromHeight = (box.availH - (box.maxRow - 1) * box.rowGap) / box.maxRow;
  let cardSize = cardFromWidth;
  if (!box.isLinear && !widthOnly) cardSize = Math.min(cardSize, cardFromHeight);
  return clampPathCardSizePx(cardSize);
}

/** Same chapter card size as vol 1–2 (width + row fit, capped to the linear-lane standard). */
function computeCorporateChapterCardSize(box) {
  const sized = computePathCardSize(box, pathDashboardColumnBudget(box));
  const rowFit = box.maxRow > 1 && !box.isLinear ? computePathRowFitCardSize(box) : sized;
  return clampPathCardSizePx(
    Math.min(sized, rowFit, PATH_CORPORATE_CHAPTER_CARD_MAX_PX)
  );
}

/** Lane zoom — slightly wider framing than focus (5 cols + peek), never larger than standard cards. */
function computePathOverviewCardSize(box) {
  const standard = computeCorporateChapterCardSize(box);
  const cardFromWidth =
    (box.availW - (PATH_FOCUS_COLUMN_COUNT - 1) * box.colGap) /
    (PATH_FOCUS_COLUMN_COUNT + PATH_OVERVIEW_COLUMN_PEEK);
  return clampPathCardSizePx(Math.min(cardFromWidth, standard));
}

/** Max zoom-in uses the same chapter size as vol 1–2. */
function computePathRevealFocusSize(box) {
  return computeCorporateChapterCardSize(box);
}

/** Left-align overview so columns 1–5 are full width and column 6 only peeks in. */
function computePathOverviewPanX() {
  return 0;
}

function computePathFocusPanX(box, cardSize, startCol = 1, endCol = PATH_FOCUS_COLUMN_COUNT) {
  const leftCenter =
    box.gridPadL + (startCol - 1) * (cardSize + box.colGap) + cardSize * 0.5;
  const rightCenter =
    box.gridPadL + (endCol - 1) * (cardSize + box.colGap) + cardSize * 0.5;
  const blockCenter = (leftCenter + rightCenter) * 0.5;
  return box.availW * 0.5 - blockCenter;
}

/** True once chapter 4+ is reachable (column 4 unlocked or played). */
function pathFocusShouldUseLateWindow(modules = getRuntimeModules(), maxCol = getPathColumnCount(modules)) {
  if (maxCol <= PATH_FOCUS_COLUMN_COUNT) return false;
  return modules.some(
    (m) => m.column >= PATH_COLUMN_AFTER_CH3 && (!m.locked || m.completed)
  );
}

function getPathFocusColumnWindow(box, modules = getRuntimeModules()) {
  const maxCol = box?.maxCol ?? getPathColumnCount(modules);
  if (maxCol <= PATH_FOCUS_COLUMN_COUNT) {
    return { startCol: 1, endCol: maxCol, mode: 'full' };
  }
  if (pathFocusShouldUseLateWindow(modules, maxCol)) {
    return {
      startCol: PATH_LATE_FOCUS_START_COL,
      endCol: maxCol,
      mode: 'late'
    };
  }
  return {
    startCol: 1,
    endCol: PATH_FOCUS_COLUMN_COUNT,
    mode: 'early'
  };
}

function pathFocusWindowKeyFor(window) {
  return `${window.startCol}-${window.endCol}`;
}

function applyPathGridCardSize(box, cardSize) {
  if (!gridEl || !pathMapEl) return;
  gridEl.style.setProperty('--path-card-size', `${cardSize}px`);
  gridEl.style.setProperty('--path-grid-cols', String(box.maxCol));
  pathMapEl.style.setProperty('--path-viewport-height', `${box.availH}px`);

  if (box.isLinear) {
    gridEl.style.setProperty('--card-size', `${cardSize}px`);
    gridEl.style.removeProperty('height');
    gridEl.style.removeProperty('max-height');
    gridEl.style.removeProperty('min-height');
    gridEl.style.gridTemplateRows = `repeat(${box.maxRow}, ${cardSize}px)`;
  } else {
    const gridH = box.maxRow * cardSize + (box.maxRow - 1) * box.rowGap;
    gridEl.style.height = `${gridH}px`;
    gridEl.style.maxHeight = `${gridH}px`;
    gridEl.style.minHeight = `${gridH}px`;
    gridEl.style.gridTemplateRows = `repeat(${box.maxRow}, ${cardSize}px)`;
    gridEl.style.removeProperty('--card-size');
  }

  applyPathGridColumnTracks(box, cardSize);
}

/**
 * Fixed column tracks at --intro-col-gap — never stretch 1fr (that created huge empty lanes).
 * Wide focus: full grid width + pan shows five columns; narrow volumes: compact grid centered.
 */
function applyPathGridColumnTracks(box, cardSize) {
  if (!gridEl) return;

  const gridW = box.maxCol * cardSize + (box.maxCol - 1) * box.colGap;
  const gridStyle = getComputedStyle(gridEl);
  const padX =
    (parseFloat(gridStyle.paddingLeft) || 0) + (parseFloat(gridStyle.paddingRight) || 0);

  gridEl.style.gridTemplateColumns = `repeat(${box.maxCol}, ${cardSize}px)`;
  gridEl.style.width = `${gridW}px`;
  gridEl.style.minWidth = `${gridW + padX}px`;
  gridEl.style.maxWidth = 'none';
  gridEl.style.justifyContent = 'start';
}

/** Pan when the grid is narrower than the path lane (centers wide branching maps). */
function computePathGridCenterPan(box, cardSize) {
  const totalW = getPathGridWidth(box, cardSize);
  if (totalW >= box.availW - 2) return 0;
  return (box.availW - totalW) * 0.5;
}

/** Linear vol. lanes — flush left with copy/lead (no centering pan). */
function computePathGridAlignPan(box, cardSize) {
  if (box?.isLinear && isCorporateSkin()) return 0;
  if (box.maxCol <= PATH_FOCUS_COLUMN_COUNT) return computePathGridCenterPan(box, cardSize);
  return 0;
}

function getPathGridWidth(box, cardSize) {
  const gridPadR = parseFloat(getComputedStyle(gridEl).paddingRight) || 0;
  return box.gridPadL + box.maxCol * cardSize + (box.maxCol - 1) * box.colGap + gridPadR;
}

/** Horizontal pan limits when the grid is wider than the viewport. */
function getPathPanRange(box, cardSize) {
  const overflow = getPathGridWidth(box, cardSize) - box.availW;
  if (overflow <= 2) return { min: 0, max: 0 };
  return { min: box.availW - getPathGridWidth(box, cardSize), max: 0 };
}

function clampPathStagePan(panX, box, cardSize) {
  const { min, max } = getPathPanRange(box, cardSize);
  return Math.max(min, Math.min(max, panX));
}

function setPathMapStageTransform(translateX) {
  pathStagePanX = translateX;
  const stage = ensurePathMapStage();
  if (!stage) return;
  stage.style.transform = `translate3d(${translateX}px, 0, 0)`;
}

function pathZoomCardSize(bounds, zoomT) {
  const t = clampPathZoom(zoomT);
  const laneT = PATH_ZOOM_LANE_LEVEL;
  if (t <= laneT) {
    const u = laneT > 0 ? t / laneT : 1;
    return Math.round(lerp(bounds.mapSize, bounds.laneSize, u));
  }
  const u = (t - laneT) / (1 - laneT);
  return Math.round(lerp(bounds.laneSize, bounds.focusSize, u));
}

function pathZoomPanX(box, bounds, zoomT, cardSize) {
  const t = clampPathZoom(zoomT);
  const laneT = PATH_ZOOM_LANE_LEVEL;
  const window = getPathFocusColumnWindow(box);
  const panFocus = computePathFocusPanX(box, cardSize, window.startCol, window.endCol);
  if (t <= laneT) {
    const u = laneT > 0 ? t / laneT : 1;
    return lerp(bounds.panMap, bounds.panLane, u);
  }
  const u = (t - laneT) / (1 - laneT);
  return lerp(bounds.panLane, panFocus, u);
}

function pathCanManualPan() {
  return (
    isCorporateSkin() &&
    pathNeedsColumnReveal() &&
    pathZoomLevel > PATH_ZOOM_LANE_LEVEL + 0.002 &&
    !pathFocusPanAnimating &&
    pathColumnRevealPhase !== 'revealing'
  );
}

function cancelPathColumnReveal() {
  if (pathColumnRevealTimer) {
    clearTimeout(pathColumnRevealTimer);
    pathColumnRevealTimer = 0;
  }
  pathColumnRevealRunId += 1;
}

function clampPathZoom(zoomT) {
  return Math.max(0, Math.min(1, zoomT));
}

function syncPathZoomPhaseFromLevel() {
  if (pathColumnRevealPhase === 'revealing') return;
  pathColumnRevealPhase =
    pathZoomLevel <= PATH_ZOOM_LANE_LEVEL + 0.002 ? 'overview' : 'focus';
}

function applyPathZoomFromLevel(box, bounds, zoomT, { preservePan = false } = {}) {
  if (!box || !bounds) return;
  zoomT = clampPathZoom(zoomT);
  pathZoomLevel = zoomT;
  const cardSize = pathZoomCardSize(bounds, zoomT);
  const zoomPan = pathZoomPanX(box, bounds, zoomT, cardSize);
  const panX = preservePan
    ? clampPathStagePan(pathStagePanX, box, cardSize)
    : clampPathStagePan(zoomPan, box, cardSize);
  applyPathGridCardSize(box, cardSize);
  setPathMapStageTransform(panX);
  syncPathZoomPhaseFromLevel();
}

function setPathZoomLevel(zoomT, { remeasureCords = true } = {}) {
  if (!isCorporateSkin() || !pathNeedsColumnReveal() || !pathMapEl || !gridEl) return;

  cancelPathColumnReveal();

  const box = measurePathLayoutBox();
  const bounds = refreshPathRevealBounds(box);
  if (!box || !bounds) return;

  applyPathZoomFromLevel(box, bounds, zoomT);
  updatePathColumnRevealClasses();
  updatePathZoomControls();
  if (remeasureCords) queueIntroCordLayout();
}

function nudgePathZoom(delta) {
  setPathZoomLevel(pathZoomLevel + delta);
}

function updatePathZoomControls() {
  const controls = pathMapEl?.querySelector('.intro-path-zoom-controls');
  if (!controls) return;
  const show = isCorporateSkin() && pathNeedsColumnReveal();
  controls.hidden = !show;
  pathMapEl?.classList.toggle('has-path-zoom-controls', show);
  const btnIn = controls.querySelector('[data-path-zoom="in"]');
  const btnOut = controls.querySelector('[data-path-zoom="out"]');
  if (btnIn) btnIn.disabled = pathZoomLevel >= 1 - 0.002;
  if (btnOut) btnOut.disabled = pathZoomLevel <= 0.002;
}

function onPathMapWheel(e) {
  if (!isCorporateSkin() || !pathNeedsColumnReveal()) return;

  const pinch = e.ctrlKey || e.metaKey;
  if (pathCanManualPan() && !pinch && Math.abs(e.deltaX) > Math.abs(e.deltaY) + 2) {
    e.preventDefault();
    e.stopPropagation();
    const box = measurePathLayoutBox();
    const bounds = refreshPathRevealBounds(box);
    if (!box || !bounds) return;
    const cardSize = pathZoomCardSize(bounds, pathZoomLevel);
    setPathMapStageTransform(clampPathStagePan(pathStagePanX - e.deltaX, box, cardSize));
    refreshSubwayCordGeometry();
    applyCordRopePaths(cordFloatPhase);
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  const step = (pinch ? PATH_ZOOM_WHEEL_STEP * 2.4 : PATH_ZOOM_WHEEL_STEP) * (e.deltaY > 0 ? -1 : 1);
  setPathZoomLevel(pathZoomLevel + step);
}

function wirePathPanDrag() {
  if (!pathMapEl || pathPanDragWired) return;
  pathPanDragWired = true;

  let dragPointerId = null;
  let dragStartX = 0;
  let dragStartPan = 0;
  let dragBox = null;
  let dragCardSize = 0;

  const endPathPanDrag = () => {
    dragPointerId = null;
    pathMapEl?.classList.remove('is-path-pan-dragging');
    window.removeEventListener('pointermove', onPathPanMove);
    window.removeEventListener('pointerup', onPathPanUp);
    window.removeEventListener('pointercancel', onPathPanUp);
    queueIntroCordLayout();
  };

  const onPathPanMove = (e) => {
    if (e.pointerId !== dragPointerId || !dragBox) return;
    const dx = e.clientX - dragStartX;
    setPathMapStageTransform(clampPathStagePan(dragStartPan + dx, dragBox, dragCardSize));
    refreshSubwayCordGeometry();
    applyCordRopePaths(cordFloatPhase);
  };

  const onPathPanUp = (e) => {
    if (e.pointerId !== dragPointerId) return;
    endPathPanDrag();
  };

  pathMapEl.addEventListener(
    'pointerdown',
    (e) => {
      if (!pathCanManualPan() || e.button !== 0) return;
      if (
        e.target.closest(
          'button, .module-card, .intro-cord-hit, .intro-cord, .intro-path-zoom-controls, .intro-path-zoom-btn'
        )
      ) {
        return;
      }

      const box = measurePathLayoutBox();
      const bounds = refreshPathRevealBounds(box);
      if (!box || !bounds) return;
      const cardSize = pathZoomCardSize(bounds, pathZoomLevel);
      const { min, max } = getPathPanRange(box, cardSize);
      if (max - min < 4) return;

      e.preventDefault();
      e.stopPropagation();

      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartPan = pathStagePanX;
      dragBox = box;
      dragCardSize = cardSize;

      pathMapEl.classList.add('is-path-pan-dragging');
      window.addEventListener('pointermove', onPathPanMove);
      window.addEventListener('pointerup', onPathPanUp);
      window.addEventListener('pointercancel', onPathPanUp);
    },
    { capture: true }
  );
}

function ensurePathZoomControls() {
  if (!pathMapEl || pathZoomControlsWired) return;
  pathZoomControlsWired = true;

  const controls = document.createElement('div');
  controls.className = 'intro-path-zoom-controls';
  controls.hidden = true;
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Path map zoom');

  const btnOut = document.createElement('button');
  btnOut.type = 'button';
  btnOut.className = 'intro-path-zoom-btn intro-path-zoom-btn--out';
  btnOut.dataset.pathZoom = 'out';
  btnOut.setAttribute('aria-label', 'Zoom out — show all chapter columns');
  btnOut.textContent = '−';

  const btnIn = document.createElement('button');
  btnIn.type = 'button';
  btnIn.className = 'intro-path-zoom-btn intro-path-zoom-btn--in';
  btnIn.dataset.pathZoom = 'in';
  btnIn.setAttribute('aria-label', 'Zoom in — focus five chapter columns');
  btnIn.textContent = '+';

  controls.append(btnOut, btnIn);
  pathMapEl.appendChild(controls);

  btnOut.addEventListener('click', () => nudgePathZoom(-PATH_ZOOM_STEP));
  btnIn.addEventListener('click', () => nudgePathZoom(PATH_ZOOM_STEP));

  pathMapEl.addEventListener('wheel', onPathMapWheel, { passive: false });

  let gestureScale = 1;
  pathMapEl.addEventListener(
    'gesturestart',
    (e) => {
      if (!pathNeedsColumnReveal()) return;
      e.preventDefault();
      gestureScale = e.scale;
    },
    { passive: false }
  );
  pathMapEl.addEventListener(
    'gesturechange',
    (e) => {
      if (!pathNeedsColumnReveal()) return;
      e.preventDefault();
      const delta = (e.scale - gestureScale) * 0.42;
      gestureScale = e.scale;
      setPathZoomLevel(pathZoomLevel + delta);
    },
    { passive: false }
  );
  pathMapEl.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  wirePathPanDrag();
  updatePathZoomControls();
}

function resetPathColumnReveal() {
  cancelPathColumnReveal();
  pathColumnRevealPhase = 'idle';
  pathZoomLevel = 0;
  pathRevealBounds = null;
  pathFocusWindowKey = '';
  pathFocusPanAnimRunId += 1;
  pathFocusPanAnimating = false;
  pathStagePanX = 0;
  setPathMapStageTransform(0);
  pathMapEl?.classList.remove(
    'is-path-pan-dragging',
    'is-path-column-overview',
    'is-path-column-focus',
    'is-path-column-revealing'
  );
  pathMapEl?.removeAttribute('data-path-zoom-phase');
  pathMapEl?.removeAttribute('data-path-focus-start');
  pathMapEl?.removeAttribute('data-path-focus-end');
  pathMapEl?.classList.remove('is-path-focus-early', 'is-path-focus-late', 'is-path-focus-panning');
  document.getElementById('modules')?.classList.remove('is-path-wide-volume');
  updatePathZoomControls();
}

/** Wide volumes — map fits all columns; lane shows five + peek; zoom in focuses five. */
function refreshPathRevealBounds(box, modules = getRuntimeModules()) {
  if (!box || box.maxCol <= PATH_FOCUS_COLUMN_COUNT) {
    pathRevealBounds = null;
    return null;
  }
  const focusSize = computePathRevealFocusSize(box);
  let mapSize = computePathCardSize(box, box.maxCol);
  let laneSize = computePathOverviewCardSize(box);
  if (laneSize >= focusSize) {
    laneSize = clampPathCardSizePx(focusSize - 12);
  }
  if (mapSize >= laneSize) {
    mapSize = Math.max(PATH_CARD_MIN_PX, laneSize - 12);
  }
  const window = getPathFocusColumnWindow(box, modules);
  pathRevealBounds = {
    mapSize,
    laneSize,
    focusSize,
    panMap: computePathGridCenterPan(box, mapSize),
    panLane: computePathOverviewPanX(),
    panFocus: computePathFocusPanX(box, focusSize, window.startCol, window.endCol),
    panFocusEarly: computePathFocusPanX(box, focusSize, 1, PATH_FOCUS_COLUMN_COUNT),
    panFocusLate: computePathFocusPanX(
      box,
      focusSize,
      PATH_LATE_FOCUS_START_COL,
      box.maxCol
    ),
    focusStartCol: window.startCol,
    focusEndCol: window.endCol
  };
  return pathRevealBounds;
}

function applyPathRevealOverview(box, bounds = pathRevealBounds) {
  if (!bounds || !box) return;
  applyPathZoomFromLevel(box, bounds, 0);
}

function applyPathRevealLane(box, bounds = pathRevealBounds) {
  if (!bounds || !box) return;
  applyPathZoomFromLevel(box, bounds, PATH_ZOOM_LANE_LEVEL);
}

function applyPathRevealFocus(box, bounds = pathRevealBounds) {
  if (!bounds || !box) return;
  refreshPathRevealBounds(box);
  const active = pathRevealBounds ?? bounds;
  const window = getPathFocusColumnWindow(box);
  pathFocusWindowKey = pathFocusWindowKeyFor(window);
  applyPathZoomFromLevel(box, active, 1);
}

function updatePathColumnRevealClasses() {
  const modulesEl = document.getElementById('modules');
  const needs = pathNeedsColumnReveal();
  const isOverview = needs && pathZoomLevel <= PATH_ZOOM_LANE_LEVEL + 0.002;
  const inFocus =
    needs &&
    (pathZoomLevel > PATH_ZOOM_LANE_LEVEL + 0.002 ||
      pathColumnRevealPhase === 'revealing' ||
      pathFocusPanAnimating);
  const box = needs ? measurePathLayoutBox() : null;
  const window = box && inFocus ? getPathFocusColumnWindow(box) : null;

  modulesEl?.classList.toggle('is-path-wide-volume', needs);
  pathMapEl?.classList.toggle('is-path-column-overview', isOverview);
  pathMapEl?.classList.toggle('is-path-column-focus', inFocus);
  pathMapEl?.classList.toggle('is-path-column-revealing', pathColumnRevealPhase === 'revealing');
  pathMapEl?.classList.toggle('is-path-focus-early', inFocus && window?.mode === 'early');
  pathMapEl?.classList.toggle('is-path-focus-late', inFocus && window?.mode === 'late');
  let panEnabled = false;
  if (inFocus && box && pathRevealBounds) {
    const cardSize = pathZoomCardSize(pathRevealBounds, pathZoomLevel);
    const { min, max } = getPathPanRange(box, cardSize);
    panEnabled = max - min > 4;
  }
  pathMapEl?.classList.toggle('is-path-pan-enabled', panEnabled);
  if (needs && pathMapEl) {
    pathMapEl.dataset.pathZoomPhase = pathColumnRevealPhase;
    document.documentElement.style.setProperty('--path-map-scale', '1');
    if (window && inFocus) {
      pathMapEl.dataset.pathFocusStart = String(window.startCol);
      pathMapEl.dataset.pathFocusEnd = String(window.endCol);
    } else {
      pathMapEl.removeAttribute('data-path-focus-start');
      pathMapEl.removeAttribute('data-path-focus-end');
    }
  } else {
    pathMapEl?.removeAttribute('data-path-zoom-phase');
    pathMapEl?.removeAttribute('data-path-focus-start');
    pathMapEl?.removeAttribute('data-path-focus-end');
    pathMapEl?.classList.remove('is-path-focus-early', 'is-path-focus-late');
  }
}

async function animatePathFocusPan(fromPan, toPan, box, bounds) {
  if (!pathMapEl || !gridEl || !bounds) return;
  if (Math.abs(fromPan - toPan) < 1) {
    applyPathRevealFocus(box, bounds);
    updatePathColumnRevealClasses();
    queueIntroCordLayout();
    return;
  }

  const runId = ++pathFocusPanAnimRunId;
  pathFocusPanAnimating = true;
  pathMapEl.classList.add('is-path-focus-panning');
  clearModulePathHover();

  let lastCordSync = 0;
  await tweenLeaderboard(PATH_FOCUS_PAN_MS, PATH_FOCUS_PAN_EASE, (t) => {
    if (runId !== pathFocusPanAnimRunId) return;
    applyPathGridCardSize(box, bounds.focusSize);
    setPathMapStageTransform(
      clampPathStagePan(lerp(fromPan, toPan, t), box, bounds.focusSize)
    );
    refreshSubwayCordGeometry();
    applyCordRopePaths(cordFloatPhase);
    const now = performance.now();
    if (now - lastCordSync > 120) {
      lastCordSync = now;
      measureIntroCords();
    }
  });

  if (runId !== pathFocusPanAnimRunId) return;

  pathFocusPanAnimating = false;
  pathMapEl.classList.remove('is-path-focus-panning');
  applyPathRevealFocus(box, bounds);
  updatePathColumnRevealClasses();
  queueIntroCordLayout();
}

/** Pan focus window when progress reaches chapter 4+ on a wide volume. */
function syncPathFocusPanFromProgress() {
  if (!isCorporateSkin() || !pathNeedsColumnReveal()) return;
  if (pathColumnRevealPhase !== 'focus' || pathFocusPanAnimating) return;

  const box = measurePathLayoutBox();
  if (!box) return;

  const window = getPathFocusColumnWindow(box);
  const nextKey = pathFocusWindowKeyFor(window);
  const bounds = refreshPathRevealBounds(box);
  if (!bounds) return;

  if (!pathFocusWindowKey || nextKey === pathFocusWindowKey) {
    pathFocusWindowKey = nextKey;
    refreshPathRevealBounds(box);
    applyPathZoomFromLevel(box, pathRevealBounds ?? bounds, pathZoomLevel, { preservePan: true });
    updatePathColumnRevealClasses();
    updatePathZoomControls();
    return;
  }

  const [prevStart, prevEnd] = pathFocusWindowKey.split('-').map(Number);
  const fromPan = Number.isFinite(prevStart)
    ? computePathFocusPanX(box, bounds.focusSize, prevStart, prevEnd)
    : bounds.panFocusEarly;
  const toPan = bounds.panFocus;

  pathFocusWindowKey = nextKey;
  void animatePathFocusPan(fromPan, toPan, box, bounds);
}

function schedulePathColumnReveal() {
  if (!isCorporateSkin() || !pathMapEl || !pathNeedsColumnReveal()) {
    resetPathColumnReveal();
    return;
  }

  if (pathColumnRevealPhase === 'focus' || pathColumnRevealPhase === 'revealing') {
    updatePathColumnRevealClasses();
    return;
  }

  if (pathColumnRevealTimer) {
    updatePathColumnRevealClasses();
    return;
  }

  const box = measurePathLayoutBox();
  const bounds = box ? refreshPathRevealBounds(box) : null;
  pathColumnRevealPhase = 'overview';
  pathZoomLevel = 0;
  if (box && bounds) {
    applyPathRevealOverview(box, bounds);
  } else {
    updatePathColumnRevealClasses();
    setPathMapStageTransform(0);
  }
  updatePathColumnRevealClasses();
  updatePathZoomControls();

  const runId = ++pathColumnRevealRunId;
  pathColumnRevealTimer = window.setTimeout(() => {
    pathColumnRevealTimer = 0;
    if (runId !== pathColumnRevealRunId) return;
    void runPathColumnFocusReveal(runId);
  }, PATH_COLUMN_OVERVIEW_MS);
}

/** Kick overview → focus zoom after volume change once the path lane has measurable layout. */
function requestPathColumnReveal(attempt = 0) {
  if (!isCorporateSkin() || !pathMapEl || !gridEl) return;

  if (!pathNeedsColumnReveal()) {
    resetPathColumnReveal();
    syncCorporatePathViewport();
    return;
  }

  const box = measurePathLayoutBox();
  if (!box) {
    if (attempt < 20) {
      requestAnimationFrame(() => requestPathColumnReveal(attempt + 1));
    }
    return;
  }

  cancelPathColumnReveal();
  pathColumnRevealPhase = 'idle';
  pathZoomLevel = 0;
  pathRevealBounds = null;
  syncCorporatePathViewport();
}

async function runPathColumnFocusReveal(runId) {
  if (runId !== pathColumnRevealRunId || !pathMapEl || !gridEl) return;

  const box = measurePathLayoutBox();
  if (!box || box.maxCol <= PATH_FOCUS_COLUMN_COUNT) {
    resetPathColumnReveal();
    return;
  }

  const bounds = refreshPathRevealBounds(box);
  if (!bounds) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    pathColumnRevealPhase = 'overview';
    applyPathRevealLane(box, bounds);
    updatePathColumnRevealClasses();
    queueIntroCordLayout();
    return;
  }

  pathColumnRevealPhase = 'revealing';
  updatePathColumnRevealClasses();
  clearModulePathHover();

  let lastCordSync = 0;
  await tweenLeaderboard(PATH_COLUMN_REVEAL_MS, PATH_COLUMN_REVEAL_EASE, (t) => {
    if (runId !== pathColumnRevealRunId) return;
    applyPathZoomFromLevel(box, bounds, t * PATH_ZOOM_LANE_LEVEL);
    updatePathColumnRevealClasses();
    refreshSubwayCordGeometry();
    applyCordRopePaths(cordFloatPhase);
    const now = performance.now();
    if (now - lastCordSync > 120) {
      lastCordSync = now;
      measureIntroCords();
    }
  });

  if (runId !== pathColumnRevealRunId) return;

  applyPathRevealLane(box, bounds);
  updatePathColumnRevealClasses();
  updatePathZoomControls();
  queueIntroCordLayout();
}

/** Minimum card/grid sizing when the path lane has not been measured yet (hidden main column, etc.). */
function applyCorporatePathFallbackSizing() {
  if (!isCorporateSkin() || !gridEl || !pathMapEl) return;

  const modules = getRuntimeModules();
  if (!modules.length) return;

  const maxRow = Math.max(1, ...modules.map((m) => m.row));
  const maxCol = Math.max(1, ...modules.map((m) => m.column));
  const colGap = 16;
  const rowGap = 16;
  const cardSize = 160;
  const gridH = maxRow * cardSize + (maxRow - 1) * rowGap;
  const gridW = maxCol * cardSize + (maxCol - 1) * colGap;

  gridEl.style.setProperty('--path-card-size', `${cardSize}px`);
  gridEl.style.setProperty('--path-grid-cols', String(maxCol));
  gridEl.style.gridTemplateColumns = `repeat(${maxCol}, ${cardSize}px)`;
  gridEl.style.gridTemplateRows = `repeat(${maxRow}, ${cardSize}px)`;
  gridEl.style.height = `${gridH}px`;
  gridEl.style.minHeight = `${gridH}px`;
  gridEl.style.width = `${gridW}px`;
  gridEl.style.minWidth = `${gridW}px`;
  pathMapEl.style.setProperty('--path-viewport-height', `${Math.max(gridH, 200)}px`);
  setPathMapStageTransform(0);
}

/** Fit #intro-columns to remaining main-column height; scale chapter cards to match. */
function syncCorporatePathViewport() {
  if (!isCorporateSkin() || !gridEl || !pathMapEl) return;

  ensurePathZoomControls();
  ensurePathMapStage();
  const box = measurePathLayoutBox();
  if (!box) {
    applyCorporatePathFallbackSizing();
    return;
  }

  const needsReveal = pathNeedsColumnReveal();
  if (!needsReveal) {
    resetPathColumnReveal();
    const cardSize = computeCorporateChapterCardSize(box);
    applyPathGridCardSize(box, cardSize);
    const window = getPathFocusColumnWindow(box);
    const panX = box.isLinear
      ? computePathGridAlignPan(box, cardSize)
      : box.maxCol <= PATH_FOCUS_COLUMN_COUNT
        ? computePathGridCenterPan(box, cardSize)
        : computePathFocusPanX(box, cardSize, window.startCol, window.endCol);
    pathStagePanX = panX;
    setPathMapStageTransform(panX);
    return;
  }

  if (pathColumnRevealPhase === 'revealing' || pathFocusPanAnimating) return;

  if (pathColumnRevealPhase === 'idle') {
    pathColumnRevealPhase = 'overview';
  }

  const bounds = refreshPathRevealBounds(box);
  if (!bounds) return;

  applyPathZoomFromLevel(box, bounds, pathZoomLevel, {
    preservePan: pathZoomLevel > PATH_ZOOM_LANE_LEVEL + 0.002
  });
  updatePathColumnRevealClasses();
  updatePathZoomControls();

  if (
    pathZoomLevel <= PATH_ZOOM_OVERVIEW_THRESHOLD &&
    pathColumnRevealPhase === 'overview' &&
    !pathColumnRevealTimer
  ) {
    schedulePathColumnReveal();
  }
}

function applyModuleFloatVars(wrap, moduleId) {
  wrap.style.setProperty('--float-delay', ((cordPhaseOffset(moduleId) % 40) / 10).toFixed(2));
  wrap.style.setProperty(
    '--float-duration',
    (4.2 + (cordPhaseOffset(`${moduleId}-dur`) % 24) / 10).toFixed(2)
  );
  wrap.style.setProperty(
    '--float-amp',
    (4 + (cordPhaseOffset(`${moduleId}-amp`) % 20) / 10).toFixed(2)
  );
  wrap.style.setProperty(
    '--float-tilt',
    `${((cordPhaseOffset(`${moduleId}-tilt`) % 17) - 8) / 10}deg`
  );
}

function clearModuleFloatVars(wrap) {
  wrap.style.removeProperty('--float-delay');
  wrap.style.removeProperty('--float-duration');
  wrap.style.removeProperty('--float-amp');
  wrap.style.removeProperty('--float-tilt');
}

function applyModuleScatter(wrap, moduleId) {
  if (isCorporateSkin() || isSpaceSkin()) {
    wrap.style.setProperty('--scatter-x', '0px');
    wrap.style.setProperty('--scatter-y', '0px');
    wrap.style.setProperty('--scatter-rotate', '0deg');
    wrap.style.removeProperty('z-index');
    if (isSpaceSkin()) applyModuleFloatVars(wrap, moduleId);
    else clearModuleFloatVars(wrap);
    return;
  }
  const s = INTRO_MODULE_SCATTER[moduleId] ?? { x: 0, y: 0, r: 0, z: 0 };
  wrap.style.setProperty('--scatter-x', `${s.x}px`);
  wrap.style.setProperty('--scatter-y', `${s.y}px`);
  wrap.style.setProperty('--scatter-rotate', `${s.r}deg`);
  applyModuleFloatVars(wrap, moduleId);
  if (s.z) wrap.style.zIndex = String(s.z);
}

const STAR_SVG =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 1.2 7.47 4.18l3.29.48-2.38 2.32.56 3.27L6 8.3l-2.94 1.55.56-3.27-2.38-2.32 3.29-.48z"/></svg>';

const DIAMOND_SVG =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 .75 10.5 6 6 11.25 1.5 6z"/></svg>';

const PADLOCK_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="lock-shackle" fill="none" stroke="currentColor" stroke-width="2" d="M8 11V8a4 4 0 0 1 8 0v3"/><rect class="lock-body" fill="currentColor" x="5" y="11" width="14" height="9" rx="2"/></svg>';

/** Intro timeline 0→1 — auto-play and scroll scrub share this. */
const INTRO_SPACE = {
  heroEnd: 0.1,
  dollyStart: 0.1,
  dollyEnd: 0.78,
  chapterRevealStart: 0.28,
  chapterRevealEnd: 0.78,
  /** Keep camera on the chapter beat; modules pop in place (no second pan to path-map center). */
  modulesCameraStart: 1,
  modulesSettleDelayMs: 1600,
  moduleStaggerMs: 180,
  moduleHoldProgress: 0.045,
  moduleStaggerProgress: 0.014,
  wheelStep: 0.00042,
  phases: [
    { progressEnd: 0.1, durationMs: 4200 },
    { progressEnd: 0.78, durationMs: 10_500 },
    { progressEnd: 0.78, durationMs: 1600, hold: true },
    { progressEnd: 1, durationMs: 6 * 180 + 120 + 400 }
  ]
};

const INTRO_CORPORATE = {
  heroEnd: 0.06,
  dollyStart: 0.06,
  dollyEnd: 0.52,
  chapterRevealStart: 0.06,
  chapterRevealEnd: 0.52,
  modulesCameraStart: 0.58,
  modulesSettleDelayMs: 900,
  moduleStaggerMs: 140,
  moduleHoldProgress: 0.04,
  moduleStaggerProgress: 0.012,
  wheelStep: 0.00055,
  phases: [
    { progressEnd: 0.52, durationMs: 3200 },
    { progressEnd: 0.52, durationMs: 700, hold: true },
    { progressEnd: 0.92, durationMs: 6 * 140 + 100 },
    { progressEnd: 1, durationMs: 600 }
  ]
};

function introCfg() {
  return isCorporateSkin() ? INTRO_CORPORATE : INTRO_SPACE;
}

const introState = {
  progress: 0,
  complete: false,
  autoDriving: false,
  autoStartMs: 0,
  autoRaf: 0,
  stops: null,
  chapterSettledAt: null,
  moduleSoundsPlayed: new Set(),
  pluggingEdge: null,
  plugActive: false,
  plugRaf: 0,
  handoffRunning: false,
  chapter2SettledAt: null,
  corporateViewVolume: 1,
  nextPlayModuleId: null
};

let corporatePopRun = 0;

const CORPORATE_POP = {
  stepMs: 420,
  navStaggerMs: 110,
  copyStaggerMs: 200,
  moduleStaggerMs: 150,
  cordGrowMs: 560,
  sideStaggerMs: 170,
  lbRowStaggerMs: 32,
  lbRowCap: 10
};

const CORPORATE_VOLUME_COPY = {
  1: {
    title: 'Volume 1: Getting started',
    lead:
      'Your walk-through for this volume—what each module is for, how they connect, and what to try first. Same energy as the laminated sheet by the copier: read once, then you’re set.'
  },
  2: {
    title: 'Volume 2: Almost a pro',
    lead:
      'Shorter lane, sharper pacing—three modules in a row. Your choices branch less; the tubes stay lit as you move.'
  },
  3: {
    title: 'Volume 3: Full weave',
    lead:
      'Split, merge at chapter 3, then 4A and 4B branch out of the merge and rejoin at the final gate.'
  }
};

const CORPORATE_HANDOFF = {
  cordShineMs: 650,
  pathSlamMs: 720,
  navWiggleMs: 380,
  navSlamMs: 520,
  mainExitMs: 780,
  mainEnterMs: 820,
  moduleStaggerMs: 130
};

function shouldFreezeModuleReveal() {
  return Boolean(
    introState.pluggingEdge ||
    introState.plugActive ||
    introState.handoffRunning ||
    isModuleModalOpen()
  );
}

function syncPlugActiveClass() {
  document.documentElement.classList.toggle(
    'is-plug-active',
    Boolean(introState.pluggingEdge || introState.plugActive)
  );
}

/** Depth parallax — lower = slower drift (further away). */
const SKY_PARALLAX = {
  base: 0.22,
  glow: 0.38,
  dust: 0.52,
  starsFar: 0.58,
  starsMid: 0.76,
  starsNear: 0.92
};

const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');
const rail = document.getElementById('rail');
const chapterSection1 = document.querySelector('[data-chapter="1"]');
const chapterSection2 = document.querySelector('[data-chapter="2"]');
const nextChapterBtn = document.getElementById('intro-next-chapter');
const poofEl = document.getElementById('intro-poof');

let gridEl = document.getElementById('intro-columns');
let pathMapEl = document.getElementById('intro-path-map');
let connectorsEl = document.getElementById('intro-connectors');
let chapterEl = chapterSection1?.querySelector('.intro-chapter') ?? null;

function cordAnchorsForKey(key) {
  return getChapterCordAnchors()[key] ?? { from: 'right', to: 'left' };
}

function setActiveChapter(chapter) {
  const board = document.getElementById('intro-corporate-board');
  if (chapter === 2 && !isCorporateSkin()) {
    gridEl = document.getElementById('intro-columns-c2');
    pathMapEl = document.getElementById('intro-path-map-c2');
    connectorsEl = document.getElementById('intro-connectors-c2');
    chapterEl = chapterSection2?.querySelector('.intro-chapter') ?? null;
  } else {
    gridEl = document.getElementById('intro-columns');
    pathMapEl = document.getElementById('intro-path-map');
    connectorsEl = document.getElementById('intro-connectors');
    chapterEl = chapterSection1?.querySelector('.intro-chapter') ?? null;
  }
  if (isCorporateSkin()) {
    board?.classList.toggle('is-volume-2', chapter === 2);
  }
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function imageUrlFor(mod) {
  return `https://picsum.photos/seed/wf-${mod.id}/400/320`;
}

function renderStars(count) {
  const el = document.createElement('div');
  el.className = 'module-stars';
  el.setAttribute('aria-hidden', count ? 'false' : 'true');
  if (count) el.setAttribute('aria-label', `${count} of 5 stars`);
  for (let i = 0; i < 5; i++) {
    const star = document.createElement('span');
    star.className = `module-star${i < count ? ' is-filled' : ''}`;
    star.innerHTML = STAR_SVG;
    el.appendChild(star);
  }
  return el;
}

function syncStarsElement(starsEl, count) {
  starsEl.querySelectorAll('.module-star').forEach((star, i) => {
    star.classList.toggle('is-filled', i < count);
  });
  starsEl.setAttribute('aria-hidden', count ? 'false' : 'true');
  if (count) starsEl.setAttribute('aria-label', `${count} of 5 stars`);
  else starsEl.removeAttribute('aria-label');
}

function renderDiamondBadge() {
  const el = document.createElement('span');
  el.className = 'module-diamond-badge';
  el.setAttribute('aria-label', 'Perfect empathy score');
  el.innerHTML = DIAMOND_SVG;
  return el;
}

function syncDiamondBadge(thumb, mod) {
  let badge = thumb.querySelector('.module-diamond-badge');
  if (hasPerfectStars(mod)) {
    if (!badge) thumb.appendChild(renderDiamondBadge());
  } else {
    badge?.remove();
  }
}

function focusModuleCard(moduleId) {
  gridEl?.querySelectorAll('.module-card').forEach((c) => c.classList.remove('is-focused'));
  const card = gridEl?.querySelector(`[data-module-id="${moduleId}"]`);
  card?.classList.add('is-focused');
  return card;
}

/** First unlocked, incomplete module to suggest as the next play target. */
function resolveNextPlayModuleId() {
  const stored = introState.nextPlayModuleId;
  if (stored) {
    const mod = getRuntimeModule(stored);
    if (mod && !mod.locked && !mod.completed) return stored;
  }

  const candidates = getRuntimeModules().filter((m) => !m.locked && !m.completed);
  if (!candidates.length) return null;

  const start = candidates.find((m) => m.start);
  if (start) return start.id;

  return (
    candidates.sort((a, b) => b.column - a.column || a.row - b.row || 0)[0]?.id ?? null
  );
}

function syncNextPlayModuleGlow() {
  if (!gridEl) return;
  gridEl.querySelectorAll('.intro-module-wrap--next-play').forEach((wrap) => {
    wrap.classList.remove('intro-module-wrap--next-play');
  });

  const nextId = resolveNextPlayModuleId();
  if (!nextId) {
    introState.nextPlayModuleId = null;
    return;
  }

  introState.nextPlayModuleId = nextId;
  gridEl.querySelector(`[data-module-anchor="${nextId}"]`)?.classList.add('intro-module-wrap--next-play');
}

function setNextPlayModule(moduleId) {
  if (!moduleId) {
    introState.nextPlayModuleId = null;
    syncNextPlayModuleGlow();
    return;
  }
  const mod = getRuntimeModule(moduleId);
  if (!mod || mod.locked || mod.completed) {
    introState.nextPlayModuleId = null;
    syncNextPlayModuleGlow();
    return;
  }
  introState.nextPlayModuleId = moduleId;
  syncNextPlayModuleGlow();
}

function refreshNextPlayAfterProgress(playedModuleId, newlyUnlocked = []) {
  if (newlyUnlocked.length) {
    setNextPlayModule(newlyUnlocked[newlyUnlocked.length - 1]);
    return;
  }
  const played = getRuntimeModule(playedModuleId);
  if (played?.completed) introState.nextPlayModuleId = null;
  syncNextPlayModuleGlow();
}

function highlightUnlockedModules(moduleIds) {
  for (const id of moduleIds) {
    const wrap = pathMapEl?.querySelector(`[data-module-anchor="${id}"]`);
    wrap?.classList.add('intro-module-wrap--just-unlocked');
    window.setTimeout(() => wrap?.classList.remove('intro-module-wrap--just-unlocked'), 1200);
  }
  const focusId = moduleIds[moduleIds.length - 1] ?? moduleIds[0];
  if (focusId) {
    setNextPlayModule(focusId);
    focusModuleCard(focusId);
  }
}

const LOCKED_PLAY_HINT_MS = 2400;
let lockedPlayHintWrap = null;
let lockedPlayHintTimer = 0;

function clearLockedPlayHint() {
  clearTimeout(lockedPlayHintTimer);
  lockedPlayHintTimer = 0;
  lockedPlayHintWrap?.classList.remove('intro-module-wrap--play-hint');
  lockedPlayHintWrap = null;
}

/** Unlocked module to play next in order to reach a locked chapter. */
function resolvePlayablePredecessor(lockedModuleId) {
  for (const key of getRecentPathEdgeKeys(lockedModuleId)) {
    const [from, to] = key.split('|');
    if (to !== lockedModuleId) continue;
    const fromMod = moduleById(from);
    if (fromMod && !fromMod.locked) return from;
  }

  const preds = [];
  for (const [from, to] of getChapterEdges()) {
    if (to !== lockedModuleId) continue;
    const fromMod = moduleById(from);
    if (fromMod && !fromMod.locked) preds.push(fromMod);
  }
  if (!preds.length) return resolveNextPlayModuleId();

  const nextId = resolveNextPlayModuleId();
  const viaNext = preds.find((m) => m.id === nextId);
  if (viaNext) return viaNext.id;

  const incomplete = preds.filter((m) => !m.completed);
  const pool = incomplete.length ? incomplete : preds;
  pool.sort((a, b) => b.column - a.column || a.row - b.row);
  return pool[0]?.id ?? null;
}

function showLockedPlayHint(lockedModuleId) {
  if (!gridEl || introState.plugActive || introState.pluggingEdge) return;

  const predId = resolvePlayablePredecessor(lockedModuleId);
  if (!predId) return;

  clearLockedPlayHint();
  clearModulePathHover();
  clearModuleStarGatePrompt();

  const predWrap = gridEl.querySelector(`[data-module-anchor="${predId}"]`);
  if (!predWrap) return;

  lockedPlayHintWrap = predWrap;
  predWrap.classList.add('intro-module-wrap--play-hint');
  setNextPlayModule(predId);
  focusModuleCard(predId);

  if (isCorporateSkin() || isSpaceSkin()) {
    playModuleHoverClick({ bypassThrottle: true, volumeRatio: 0.5 });
  }

  lockedPlayHintTimer = window.setTimeout(() => {
    clearLockedPlayHint();
    syncNextPlayModuleGlow();
  }, LOCKED_PLAY_HINT_MS);
}

let starGatePromptModuleId = null;

function clearModuleStarGatePrompt() {
  if (!starGatePromptModuleId) return;
  const wrap = gridEl?.querySelector(`[data-module-anchor="${starGatePromptModuleId}"]`);
  wrap?.classList.remove('is-star-gate-prompt');
  wrap?.querySelector('.intro-module-star-gate-tooltip')?.remove();
  starGatePromptModuleId = null;
}

function showModuleStarGatePrompt(moduleId) {
  const wrap = gridEl?.querySelector(`[data-module-anchor="${moduleId}"]`);
  if (!wrap) return;

  clearModuleStarGatePrompt();
  starGatePromptModuleId = moduleId;
  wrap.classList.add('is-star-gate-prompt');

  const tip = document.createElement('div');
  tip.className = 'intro-module-star-gate-tooltip';
  tip.setAttribute('role', 'status');
  tip.textContent = 'Need a higher score to unlock the next chapter';
  wrap.appendChild(tip);

  window.setTimeout(() => tip.classList.add('is-visible'), 480);
}

function onModuleProgress(unlockedIds, moduleId, { starGateBlocked = false } = {}) {
  if (!introState.plugActive) {
    patchModulesFromRuntime(unlockedIds);
    queueIntroCordLayout();
  }
  highlightUnlockedModules(unlockedIds);
  if (!unlockedIds.length) refreshNextPlayAfterProgress(moduleId, unlockedIds);
  refreshLeaderboardPanel();
  syncPlayerProfile();
  startCordFloat();

  if (starGateBlocked) {
    showModuleStarGatePrompt(moduleId);
  } else if (moduleId === 'm8' || starGatePromptModuleId === 'm8') {
    clearModuleStarGatePrompt();
    patchModulesFromRuntime(unlockedIds);
    queueIntroCordLayout();
  }

  maybeStartChapterHandoff(moduleId);
  if (isCorporateSkin()) syncPathFocusPanFromProgress();
}

function maybeStartChapterHandoff(moduleId) {
  if (introState.handoffRunning) return;

  if (moduleId === CHAPTER_1_END_MODULE_ID) {
    if (!isChapter1Complete() || isChapterHandoffDone()) return;
    if (isCorporateSkin()) {
      window.setTimeout(() => runCorporateChapterHandoff(), 480);
      return;
    }
    if (!chapterSection2) return;
    window.setTimeout(() => runChapterHandoff(), 480);
    return;
  }

  if (moduleId === CHAPTER_2_END_MODULE_ID) {
    if (!isChapter2Complete() || isChapter3HandoffDone()) return;
    if (isCorporateSkin()) {
      window.setTimeout(() => runCorporateVolume3Handoff(), 480);
    }
  }
}

function getCorporateNavItem(volume) {
  return document.querySelector(`.intro-corporate-nav__item[data-volume="${volume}"]`);
}

/** Align module/cord catalog with the volume selected in the side nav (not only save progress). */
function syncCatalogToViewVolume() {
  if (!usesIntroSidePanel()) return;
  setCatalogChapter(getCorporateViewVolume());
}

function updateCorporateVolumeCopy(volume) {
  const copy = CORPORATE_VOLUME_COPY[volume];
  const board = document.getElementById('intro-corporate-board');
  const title = board?.querySelector('.intro-corporate-board__title');
  const lead = board?.querySelector('.intro-corporate-board__lead');
  if (copy?.title && title) title.textContent = copy.title;
  if (copy?.lead && lead) lead.textContent = copy.lead;

  if (copy?.title && chapterEl) chapterEl.textContent = copy.title;
}

const CORPORATE_NAV_LOCK_SVG = `<svg viewBox="0 0 24 24" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" d="M8 11V8a4 4 0 0 1 8 0v3"/><rect fill="currentColor" x="5" y="11" width="14" height="9" rx="2"/></svg>`;

function getAccessibleCorporateVolumes() {
  const cheat = getCorporateVolumeCheatMode();
  if (cheat === 'all') return [1, 2, 3];
  if (cheat === 'locked') return [1];

  const progress = getCurrentChapter();
  const volumes = [1];
  if (progress >= 2 || (isChapterHandoffDone() && isChapter1Complete())) volumes.push(2);
  if (progress >= 3 || (isChapter3HandoffDone() && isChapter2Complete())) volumes.push(3);
  return volumes;
}

/** Keep volume nav buttons aligned with progress (DOM can stay unlocked after reset). */
function syncCorporateVolumeNavLocks() {
  const cheat = getCorporateVolumeCheatMode();
  if (cheat === 'all') {
    for (const v of [1, 2, 3]) activateCorporateVolumeNav(v);
    return;
  }
  if (cheat === 'locked') {
    lockCorporateVolumeNav(2);
    lockCorporateVolumeNav(3);
    return;
  }
  lockCorporateVolumeNav(2);
  lockCorporateVolumeNav(3);
  const progress = getCurrentChapter();
  if (progress >= 2 || (isChapterHandoffDone() && isChapter1Complete())) activateCorporateVolumeNav(2);
  if (progress >= 3 || (isChapter3HandoffDone() && isChapter2Complete())) activateCorporateVolumeNav(3);
}

function lockCorporateVolumeNav(volume) {
  const item = getCorporateNavItem(volume);
  if (!item || volume === 1) return;
  item.disabled = true;
  item.classList.add('is-locked');
  item.removeAttribute('aria-current');
  item.setAttribute('aria-label', `Volume ${volume} (locked)`);
  if (!item.querySelector('.intro-corporate-nav__lock')) {
    const lock = document.createElement('span');
    lock.className = 'intro-corporate-nav__lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.innerHTML = CORPORATE_NAV_LOCK_SVG;
    item.insertBefore(lock, item.firstChild);
  }
}

function applyCorporateVolumeCheatUi() {
  if (!usesIntroSidePanel()) return;

  syncCorporateVolumeNavLocks();

  const mode = getCorporateVolumeCheatMode();
  const allowed = getAccessibleCorporateVolumes();
  if (mode === 'locked') {
    setCorporateViewVolume(1, { animate: false });
  } else if (!allowed.includes(getCorporateViewVolume())) {
    setCorporateViewVolume(allowed[0], { animate: false });
  }

  document
    .getElementById('modules')
    ?.classList.toggle('is-volume-swipeable', allowed.length > 1);
  syncCorporateVolumeNavActive();
}

function getCorporateViewVolume() {
  const allowed = getAccessibleCorporateVolumes();
  const view = introState.corporateViewVolume ?? getCurrentChapter();
  return allowed.includes(view) ? view : allowed[0];
}

function syncCorporateVolumeNavActive() {
  const nav = document.querySelector('.intro-corporate-nav');
  const view = getCorporateViewVolume();
  const progress = getCurrentChapter();
  nav?.querySelectorAll('.intro-corporate-nav__item').forEach((btn) => {
    const v = Number(btn.dataset.volume);
    if (!v) return;
    btn.classList.toggle('is-active', v === view);
    btn.classList.toggle(
      'is-complete',
      v < progress ||
        (v === 1 && isChapterHandoffDone()) ||
        (v === 2 && isChapter3HandoffDone())
    );
    if (v === view) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

function setCorporateViewVolume(volume, { animate = true } = {}) {
  if (!usesIntroSidePanel()) return;
  const allowed = getAccessibleCorporateVolumes();
  if (!allowed.includes(volume)) return;

  const prev = getCorporateViewVolume();
  if (prev === volume) return;

  resetPathColumnReveal();
  pathColumnRevealPhase = 'idle';

  introState.corporateViewVolume = volume;
  setCatalogChapter(volume);
  setActiveChapter(volume);
  updateCorporateVolumeCopy(volume);
  syncCorporateVolumeNavActive();
  clearModulePathHover();

  const modulesEl = document.getElementById('modules');
  const pathMap = document.getElementById('intro-path-map');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slideDir = volume > prev ? 1 : -1;

  if (isSpaceSkin() && animate && !reduced && introState.complete) {
    void animateSpaceVolumeTransition(volume, prev);
    return;
  }

  if (animate && !reduced && isCorporateSkin() && modulesEl && pathMap) {
    modulesEl.classList.add('is-volume-switching');
    pathMap.classList.add(slideDir > 0 ? 'is-volume-enter-from-right' : 'is-volume-enter-from-left');
    renderModules();
    queueIntroCordLayout();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pathMap.classList.remove('is-volume-enter-from-right', 'is-volume-enter-from-left');
        requestPathColumnReveal(0);
        window.setTimeout(() => modulesEl.classList.remove('is-volume-switching'), 400);
      });
    });
    return;
  }

  renderModules();
  syncCorporatePathMapToCatalog();
  queueIntroCordLayout();
  requestPathColumnReveal(0);
}

function activateCorporateVolumeNav(volume) {
  const item = getCorporateNavItem(volume);
  if (!item) return;
  item.disabled = false;
  item.classList.remove('is-locked');
  item.setAttribute('aria-label', `Volume ${volume}`);
  item.querySelector('.intro-corporate-nav__lock')?.remove();
  syncCorporateVolumeNavActive();
}

const CORPORATE_VOLUME_DRAG_THRESHOLD_PX = 52;
let corporateVolumeDragBound = false;
let corporateVolumeDragConsumed = false;
let spaceVolumeSwitchRunning = false;

/** Space skin — volume changes use the same downward/upward camera pan as the intro dolly. */
async function animateSpaceVolumeTransition(volume, prev) {
  if (spaceVolumeSwitchRunning || !viewport || !stage) return;
  spaceVolumeSwitchRunning = true;

  const modulesEl = document.getElementById('modules');
  const pathMap = document.getElementById('intro-path-map');
  const dir = volume > prev ? 1 : -1;

  modulesEl?.classList.add('is-volume-switching');
  pathMap?.classList.add('is-volume-camera-pan');
  viewport.classList.add('is-volume-camera-pan');
  document.documentElement.classList.add('is-volume-camera-pan');

  try {
    const fromY = readCameraY();
    const dipPx = Math.min(viewport.clientHeight * 0.24, 240);
    await panCameraToY(fromY + dir * dipPx, 420);

    renderModules();
    queueIntroCordLayout();
    syncPlayerProfile();

    introState.stops = null;
    const stops = getIntroStops();
    const settleY = stops.chapterSettled;
    await panCameraToY(settleY, 520);

    requestAnimationFrame(() => requestAnimationFrame(syncIntroSideColumnLayout));
  } finally {
    modulesEl?.classList.remove('is-volume-switching');
    pathMap?.classList.remove('is-volume-camera-pan');
    viewport.classList.remove('is-volume-camera-pan');
    document.documentElement.classList.remove('is-volume-camera-pan');
    spaceVolumeSwitchRunning = false;
  }
}

function wireCorporateVolumeNav() {
  const nav = document.querySelector('.intro-corporate-nav');
  if (!nav || nav.dataset.volumeNavBound) return;
  nav.dataset.volumeNavBound = '1';

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.intro-corporate-nav__item');
    if (!btn || btn.disabled || btn.classList.contains('is-locked')) return;
    const vol = Number(btn.dataset.volume);
    if (!vol) return;
    const allowed = getAccessibleCorporateVolumes();
    if (!allowed.includes(vol)) return;
    setCorporateViewVolume(vol);
  });
}

function wireCorporateVolumeDrag() {
  const modulesEl = document.getElementById('modules');
  if (!modulesEl || corporateVolumeDragBound) return;
  corporateVolumeDragBound = true;

  let startX = 0;
  let dragging = false;
  let pointerId = null;

  const canSwipe = () => usesIntroSidePanel() && getAccessibleCorporateVolumes().length > 1;

  const endDrag = (e) => {
    if (pointerId != null && e.pointerId !== pointerId) return;

    modulesEl.classList.remove('is-volume-dragging');
    modulesEl.style.removeProperty('--volume-drag-offset');

    if (dragging) {
      corporateVolumeDragConsumed = true;
      const dx = e.clientX - startX;
      const volumes = getAccessibleCorporateVolumes();
      const idx = volumes.indexOf(getCorporateViewVolume());
      if (dx < -CORPORATE_VOLUME_DRAG_THRESHOLD_PX && idx < volumes.length - 1) {
        setCorporateViewVolume(volumes[idx + 1]);
      } else if (dx > CORPORATE_VOLUME_DRAG_THRESHOLD_PX && idx > 0) {
        setCorporateViewVolume(volumes[idx - 1]);
      }
    }

    dragging = false;
    pointerId = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) > 10) {
      dragging = true;
      modulesEl.classList.add('is-volume-dragging');
      try {
        modulesEl.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
    if (dragging) {
      const volumes = getAccessibleCorporateVolumes();
      const idx = volumes.indexOf(getCorporateViewVolume());
      let dragDx = dx;
      if (idx <= 0) dragDx = Math.max(0, dragDx);
      if (idx >= volumes.length - 1) dragDx = Math.min(0, dragDx);
      const damped = Math.max(-72, Math.min(72, dragDx * 0.35));
      modulesEl.style.setProperty('--volume-drag-offset', `${damped}px`);
    }
  };

  const onPointerUp = (e) => {
    endDrag(e);
  };

  modulesEl.addEventListener(
    'click',
    (e) => {
      if (!corporateVolumeDragConsumed) return;
      corporateVolumeDragConsumed = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  modulesEl.addEventListener('pointerdown', (e) => {
    if (!canSwipe() || e.button !== 0) return;
    if (introState.handoffRunning || introState.plugActive) return;

    corporateVolumeDragConsumed = false;
    startX = e.clientX;
    dragging = false;
    pointerId = e.pointerId;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
  });
}

function finishCorporateHandoffContent() {
  const board = document.getElementById('intro-corporate-board');
  const vol1Nav = getCorporateNavItem(1);
  vol1Nav?.classList.remove('is-active');
  vol1Nav?.classList.add('is-complete');
  vol1Nav?.removeAttribute('aria-current');

  beginChapter2();
  introState.corporateViewVolume = 2;
  setCatalogChapter(2);
  setActiveChapter(2);
  updateCorporateVolumeCopy(2);
  renderModules();
  applyCorporateModuleGridLayout();
  activateCorporateVolumeNav(2);
  board?.classList.add('is-pop-complete');
  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.remove('is-revealed', 'is-pop-visible');
  });
}

async function revealCorporateVolume2Modules() {
  const modules = getRuntimeModules();
  for (const mod of modules) {
    const wrap = gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`);
    if (!wrap) continue;
    wrap.classList.add('is-revealed', 'is-pop-visible');
    if (!introState.moduleSoundsPlayed.has(mod.id)) {
      introState.moduleSoundsPlayed.add(mod.id);
      playModuleHoverClick({ bypassThrottle: true });
    }
    await delayMs(CORPORATE_HANDOFF.moduleStaggerMs);
  }
}

async function runCorporateChapterHandoff() {
  if (!isCorporateSkin() || introState.handoffRunning || isChapterHandoffDone()) return;
  introState.handoffRunning = true;
  clearModulePathHover();
  document.documentElement.classList.add('is-corporate-handoff', 'is-intro-handoff');
  stopCordFloat();
  stopIntroAuto();

  const board = document.getElementById('intro-corporate-board');
  const body = board?.querySelector('.intro-corporate-board__body');
  const main = board?.querySelector('.intro-corporate-board__main');
  const pathMap = document.getElementById('intro-path-map');
  const connectors = document.getElementById('intro-connectors');
  const vol2Nav = getCorporateNavItem(2);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishCorporateHandoffContent();
    queueIntroCordLayout();
    startCordFloat();
    introState.handoffRunning = false;
    document.documentElement.classList.remove('is-corporate-handoff', 'is-intro-handoff');
    return;
  }

  body?.classList.add('is-handoff-active');

  connectors?.classList.add('is-volume-complete-glow');
  pathMap?.classList.add('is-cord-shine');
  await delayMs(CORPORATE_HANDOFF.cordShineMs);

  pathMap?.classList.add('is-chapter-path-slam');
  await delayMs(CORPORATE_HANDOFF.pathSlamMs);
  pathMap?.classList.remove('is-chapter-path-slam', 'is-cord-shine');
  connectors?.classList.remove('is-volume-complete-glow');

  if (vol2Nav) {
    vol2Nav.classList.add('is-nav-unlocking');
    await delayMs(CORPORATE_HANDOFF.navWiggleMs);
    vol2Nav.classList.add('is-nav-slamming');
    await delayMs(CORPORATE_HANDOFF.navSlamMs);
    activateCorporateVolumeNav(2);
    vol2Nav.classList.remove('is-nav-unlocking', 'is-nav-slamming');
  }

  main?.classList.add('is-main-exiting');
  await delayMs(CORPORATE_HANDOFF.mainExitMs);

  finishCorporateHandoffContent();
  main?.classList.remove('is-main-exiting');
  main?.classList.add('is-main-entering');
  await revealCorporateVolume2Modules();
  await delayMs(CORPORATE_HANDOFF.mainEnterMs);
  main?.classList.remove('is-main-entering');

  body?.classList.remove('is-handoff-active');
  queueIntroCordLayout();
  startCordFloat();
  introState.handoffRunning = false;
  document.documentElement.classList.remove('is-corporate-handoff', 'is-intro-handoff');
}

function finishCorporateVolume3HandoffContent() {
  const board = document.getElementById('intro-corporate-board');
  const vol2Nav = getCorporateNavItem(2);
  vol2Nav?.classList.remove('is-active');
  vol2Nav?.classList.add('is-complete');
  vol2Nav?.removeAttribute('aria-current');

  beginChapter3();
  introState.corporateViewVolume = 3;
  setCatalogChapter(3);
  setActiveChapter(3);
  updateCorporateVolumeCopy(3);
  renderModules();
  syncCorporatePathMapToCatalog();
  applyCorporateModuleGridLayout();
  activateCorporateVolumeNav(3);
  board?.classList.add('is-pop-complete');
  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.remove('is-revealed', 'is-pop-visible');
  });
}

async function revealCorporateVolume3Modules() {
  const modules = getRuntimeModules();
  for (const mod of modules) {
    const wrap = gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`);
    if (!wrap) continue;
    wrap.classList.add('is-revealed', 'is-pop-visible');
    if (!introState.moduleSoundsPlayed.has(mod.id)) {
      introState.moduleSoundsPlayed.add(mod.id);
      playModuleHoverClick({ bypassThrottle: true });
    }
    await delayMs(CORPORATE_POP.moduleStaggerMs);
  }
}

async function runCorporateVolume3Handoff() {
  if (!isCorporateSkin() || introState.handoffRunning || isChapter3HandoffDone()) return;
  introState.handoffRunning = true;
  clearModulePathHover();
  document.documentElement.classList.add('is-corporate-handoff', 'is-intro-handoff');
  stopCordFloat();
  stopIntroAuto();

  const board = document.getElementById('intro-corporate-board');
  const body = board?.querySelector('.intro-corporate-board__body');
  const main = board?.querySelector('.intro-corporate-board__main');
  const pathMap = document.getElementById('intro-path-map');
  const connectors = document.getElementById('intro-connectors');
  const vol3Nav = getCorporateNavItem(3);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishCorporateVolume3HandoffContent();
    queueIntroCordLayout();
    startCordFloat();
    introState.handoffRunning = false;
    document.documentElement.classList.remove('is-corporate-handoff', 'is-intro-handoff');
    return;
  }

  body?.classList.add('is-handoff-active');

  connectors?.classList.add('is-volume-complete-glow');
  pathMap?.classList.add('is-cord-shine');
  await delayMs(CORPORATE_HANDOFF.cordShineMs);

  pathMap?.classList.add('is-chapter-path-slam');
  await delayMs(CORPORATE_HANDOFF.pathSlamMs);
  pathMap?.classList.remove('is-chapter-path-slam', 'is-cord-shine');
  connectors?.classList.remove('is-volume-complete-glow');

  if (vol3Nav) {
    vol3Nav.classList.add('is-nav-unlocking');
    await delayMs(CORPORATE_HANDOFF.navWiggleMs);
    vol3Nav.classList.add('is-nav-slamming');
    await delayMs(CORPORATE_HANDOFF.navSlamMs);
    activateCorporateVolumeNav(3);
    vol3Nav.classList.remove('is-nav-unlocking', 'is-nav-slamming');
  }

  main?.classList.add('is-main-exiting');
  await delayMs(CORPORATE_HANDOFF.mainExitMs);

  finishCorporateVolume3HandoffContent();
  main?.classList.remove('is-main-exiting');
  main?.classList.add('is-main-entering');
  await revealCorporateVolume3Modules();
  await delayMs(CORPORATE_HANDOFF.mainEnterMs);
  main?.classList.remove('is-main-entering');

  body?.classList.remove('is-handoff-active');
  queueIntroCordLayout();
  startCordFloat();
  introState.handoffRunning = false;
  document.documentElement.classList.remove('is-corporate-handoff', 'is-intro-handoff');
}

function bootstrapCorporateChapter2View() {
  const board = document.getElementById('intro-corporate-board');
  if (!board || !gridEl) return;
  introState.complete = true;
  viewport?.classList.add('is-chapter-2-active', 'is-chapter-settled', 'is-modules-visible');
  finishCorporateHandoffContent();
  getRuntimeModules().forEach((mod) => {
    gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`)?.classList.add('is-revealed', 'is-pop-visible');
  });
  board.classList.add('is-pop-complete');
  startCordFloat();
  queueIntroCordLayout();
}

function bootstrapCorporateChapter3View() {
  const board = document.getElementById('intro-corporate-board');
  if (!board || !gridEl) return;
  introState.complete = true;
  viewport?.classList.add('is-chapter-settled', 'is-modules-visible');
  finishCorporateVolume3HandoffContent();
  getRuntimeModules().forEach((mod) => {
    gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`)?.classList.add('is-revealed', 'is-pop-visible');
  });
  board.classList.add('is-pop-complete');
  applyCorporateVolumeCheatUi();
  startCordFloat();
  queueIntroCordLayout();
  requestPathColumnReveal(0);
}

function panCameraToY(targetY, durationMs) {
  return new Promise((resolve) => {
    const startY = readCameraY();
    const start = performance.now();
    stage.classList.add('is-panning');

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const y = startY + (targetY - startY) * easeInOutCubic(t);
      syncParallax(y);
      stage.style.transform = `translate3d(0, ${y}px, 0)`;
      if (t < 1) requestAnimationFrame(tick);
      else {
        stage.classList.remove('is-panning');
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

function revealChapter2Modules() {
  introState.chapter2SettledAt = performance.now();
  introState.moduleSoundsPlayed.clear();
  const modules = getRuntimeModules();

  viewport.classList.add('is-chapter-settled', 'is-modules-visible', 'is-chapter-2-active');
  document.documentElement.style.setProperty('--chapter-opacity', '1');
  document.documentElement.style.setProperty('--chapter-y', '0');
  document.documentElement.style.setProperty('--chapter-blur', '0');
  document.documentElement.style.setProperty('--path-map-scale', '1');

  modules.forEach((mod, i) => {
    window.setTimeout(() => {
      const wrap = gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`);
      if (!wrap) return;
      wrap.classList.add('is-revealed');
      if (!introState.moduleSoundsPlayed.has(mod.id)) {
        introState.moduleSoundsPlayed.add(mod.id);
        playModuleHoverClick({ bypassThrottle: true });
      }
    }, introCfg().modulesSettleDelayMs + i * introCfg().moduleStaggerMs);
  });

  const totalMs = introCfg().modulesSettleDelayMs + modules.length * introCfg().moduleStaggerMs + 240;
  window.setTimeout(() => {
    introState.stops = null;
    startCordFloat();
    queueIntroCordLayout();
  }, totalMs);
}

async function runChapterHandoff() {
  if (introState.handoffRunning || isChapterHandoffDone()) return;
  introState.handoffRunning = true;
  clearModulePathHover();
  document.documentElement.classList.add('is-intro-handoff');
  stopCordFloat();
  stopIntroAuto();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (chapterSection2) chapterSection2.hidden = false;
    chapterSection1?.classList.add('is-archived');
    beginChapter2();
    setActiveChapter(2);
    renderModules();
    revealChapter2Modules();
    introState.handoffRunning = false;
    document.documentElement.classList.remove('is-intro-handoff');
    return;
  }

  const ch1Map = document.getElementById('intro-path-map');
  const wraps = ch1Map?.querySelectorAll('.intro-module-wrap.is-revealed') ?? [];

  ch1Map?.classList.add('is-chapter-poofing');
  wraps.forEach((w) => w.classList.add('is-slamming'));

  await delay(140);
  poofEl?.classList.add('is-active');
  await delay(560);

  if (nextChapterBtn) {
    nextChapterBtn.hidden = false;
    requestAnimationFrame(() => nextChapterBtn.classList.add('is-visible'));
  }
  await delay(1200);

  if (chapterSection2) chapterSection2.hidden = false;
  introState.stops = null;
  const stops = measureCameraStops();
  await panCameraToY(stops.chapter2Modules, 2600);

  nextChapterBtn?.classList.remove('is-visible');
  await delay(300);
  if (nextChapterBtn) nextChapterBtn.hidden = true;

  chapterSection1?.classList.add('is-archived');
  poofEl?.classList.remove('is-active');
  ch1Map?.classList.remove('is-chapter-poofing');
  wraps.forEach((w) => w.classList.remove('is-slamming'));

  beginChapter2();
  setActiveChapter(2);
  renderModules();
  revealChapter2Modules();

  introState.handoffRunning = false;
  document.documentElement.classList.remove('is-intro-handoff');
}

function bootstrapChapter2View() {
  if (!chapterSection2 || !document.getElementById('intro-columns-c2')) return;
  introState.complete = true;
  chapterSection1?.classList.add('is-archived');
  chapterSection2.hidden = false;
  viewport.classList.add('is-chapter-2-active', 'is-chapter-settled', 'is-modules-visible');
  setActiveChapter(2);
  renderModules();
  getRuntimeModules().forEach((mod) => {
    gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`)?.classList.add('is-revealed');
  });
  introState.stops = null;
  const stops = measureCameraStops();
  syncParallax(stops.chapter2Modules);
  stage.style.transform = `translate3d(0, ${stops.chapter2Modules}px, 0)`;
  startCordFloat();
  queueIntroCordLayout();
}

/** Update lock/completion UI without tearing down the grid (avoids reveal blink). */
function patchModulesFromRuntime(unlockedIds = []) {
  if (!gridEl) return;
  const unlockedSet = new Set(unlockedIds);

  for (const mod of getRuntimeModules()) {
    const wrap = gridEl.querySelector(`[data-module-anchor="${mod.id}"]`);
    const card = wrap?.querySelector('.module-card');
    if (!wrap || !card) continue;

    card.classList.toggle('locked', mod.locked);
    card.title = getChapterAriaLabel(mod).replace(/ \(locked\)$/, '');
    card.setAttribute('aria-label', getChapterAriaLabel(mod));

    syncModuleThumbLabel(card, mod);
    const thumb = card.querySelector('.module-thumb');
    if (!thumb) continue;

    let lock = thumb.querySelector('.module-padlock');
    let stars = thumb.querySelector('.module-stars');

    if (mod.locked) {
      if (modulePathHoverId === mod.id) clearModulePathHover();
      if (!lock) {
        lock = document.createElement('div');
        lock.className = 'module-padlock';
        lock.innerHTML = PADLOCK_SVG;
        thumb.appendChild(lock);
      }
      stars?.remove();
    } else {
      lock?.remove();
      const starCount = starsForModule(mod);
      if (!stars) {
        stars = renderStars(starCount);
        thumb.appendChild(stars);
      } else {
        syncStarsElement(stars, starCount);
      }
      syncDiamondBadge(thumb, mod);
    }

    if (unlockedSet.has(mod.id) && !wrap.classList.contains('is-plug-landing')) {
      wrap.classList.add('intro-module-wrap--just-unlocked');
      window.setTimeout(() => wrap.classList.remove('intro-module-wrap--just-unlocked'), 1200);
    }

    if (getModuleLayout() === 'folder') refreshFolderChrome(card, mod);
  }
  syncNextPlayModuleGlow();
}

function renderModules({ _retry = 0 } = {}) {
  if (!gridEl) return;

  prepareCatalogForRender();

  gridEl.innerHTML = '';

  getRuntimeModules().forEach((mod, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'intro-module-wrap';
    wrap.dataset.moduleAnchor = mod.id;
    wrap.dataset.pathColumn = String(mod.column);
    wrap.style.gridColumn = String(mod.column);
    wrap.style.gridRow = String(mod.row);
    wrap.dataset.pathRow = String(mod.row);
    wrap.style.setProperty('--reveal-index', String(index));
    applyModuleScatter(wrap, mod.id);
    if (mod.start) wrap.classList.add('intro-module-wrap--start');
    if (mod.id === 'm5' || mod.id === 'c3m5') wrap.classList.add('intro-module-wrap--hub');

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'module-card';
    card.dataset.moduleId = mod.id;
    card.title = getChapterAriaLabel(mod).replace(/ \(locked\)$/, '');
    card.setAttribute('aria-label', getChapterAriaLabel(mod));
    if (mod.locked) card.classList.add('locked');
    if (mod.start) {
      card.classList.add('module-card--start', 'is-focused');
    }

    const thumb = document.createElement('div');
    thumb.className = 'module-thumb';

    const img = document.createElement('img');
    img.className = 'module-thumb__img';
    img.src = imageUrlFor(mod);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', queueIntroCordLayout, { once: true });

    const overlay = document.createElement('div');
    overlay.className = 'module-thumb__overlay';
    overlay.setAttribute('aria-hidden', 'true');

    thumb.append(img, overlay, createModuleThumbLabel(mod));

    if (mod.locked) {
      const lock = document.createElement('div');
      lock.className = 'module-padlock';
      lock.innerHTML = PADLOCK_SVG;
      thumb.appendChild(lock);
    } else {
      const starCount = starsForModule(mod);
      thumb.appendChild(renderStars(starCount));
      if (hasPerfectStars(mod)) thumb.appendChild(renderDiamondBadge());
    }

    card.append(thumb);
    applyFolderChrome(card, mod);

    card.addEventListener('click', () => {
      const runtime = moduleById(mod.id);
      if (!runtime) return;
      if (runtime.locked) {
        showLockedPlayHint(mod.id);
        return;
      }
      clearLockedPlayHint();
      const wrap = card.closest('.intro-module-wrap');
      const canOpen =
        getCurrentChapter() === 1
          ? revealedModuleCount(introState.progress) >= 1
          : wrap?.classList.contains('is-revealed') || !runtime.locked;
      if (!canOpen) return;
      if (runtime.id === 'm8') clearModuleStarGatePrompt();
      focusModuleCard(runtime.id);
      openModuleModal(runtime, card, {
        imageUrl: imageUrlFor(runtime),
        onProgress: (unlockedIds, moduleId, detail) => onModuleProgress(unlockedIds, moduleId, detail),
        onPlugWire: (sourceMod, outcome, sourceCardEl) =>
          animatePlugWire(sourceMod, outcome, sourceCardEl)
      });
    });

    wrap.appendChild(card);
    gridEl.appendChild(wrap);
    bindModulePathHover(wrap, mod.id);
  });

  wireModulePathHoverMap();
  if (usesIntroSidePanel()) syncPlayerProfile();

  if (isCorporateSkin()) {
    const board = document.getElementById('intro-corporate-board');
    resetCorporateDashboardLayout();
    applyCorporateModuleGridLayout({ skipCatalogSync: true });
    tagCorporatePopTargets();
    wireLeaderboardScopes();
    gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
      wrap.classList.add('is-revealed', 'is-pop-visible');
    });
    viewport?.classList.add('is-modules-visible', 'is-chapter-settled', 'is-corporate-board');
    board?.classList.remove('is-pop-pending', 'is-path-pop-active');
    board?.classList.add('is-pop-complete');
    introState.complete = true;
    introState.chapterSettledAt = introState.chapterSettledAt ?? performance.now();
    introState.progress = 1;
    syncCorporatePathViewport();
  } else if (isSpaceSkin()) {
    applyCorporateModuleGridLayout({ skipCatalogSync: true });
  }

  syncNextPlayModuleGlow();
  queueIntroCordLayout();

  if (
    _retry < 2 &&
    (isCorporateSkin() || isSpaceSkin()) &&
    !pathMapMatchesCatalog()
  ) {
    console.warn('[wf-map] path grid still mismatched catalog after render — retrying');
    prepareCatalogForRender();
    renderModules({ _retry: _retry + 1 });
  }
}

function delayMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Canonical player points — earned from played modules (0 when nothing scored yet). */
function yourPlayerPoints() {
  return computePlayerLeaderboardPoints();
}

function formatYourPts() {
  return yourPlayerPoints().toLocaleString('en-US');
}

const PLAYER_DISPLAY_NAME = 'You';

const SKILL_LABELS = {
  empathy: 'empathy',
  ownership: 'ownership',
  communication: 'communication'
};

const SKILL_FEEDBACK = {
  empathy: {
    strength: 'You stay present when lanes split; you rarely rush past a scored moment without landing it.'
  },
  ownership: {
    strength: 'You close loops once a branch opens; check-ins and hub clears show you finish what you start.'
  },
  communication: {
    strength: 'Orientation and straight-ahead runs read clean; you set context before the team moves.'
  }
};

const SKILL_DEFAULT_FEEDBACK = {
  focus: 'Play your first scored module to unlock an AI summary of your latest coaching notes here.',
  strength: 'Showing up on the path counts—finish a module to see what to keep doing.'
};

function pickReplayModuleForSkill(skillKey) {
  const candidates = getRuntimeModules().filter(
    (mod) => MODULE_SKILL_FOCUS[mod.id] === skillKey && moduleSkillSample(mod) != null
  );
  if (!candidates.length) return null;

  for (const id of getRecentActivityModuleIds()) {
    const recent = candidates.find((mod) => mod.id === id);
    if (recent) return recent;
  }

  candidates.sort((a, b) => (moduleSkillSample(a) ?? 100) - (moduleSkillSample(b) ?? 100));
  return candidates[0];
}

function formatReplayImprovement(skillKey) {
  const mod = pickReplayModuleForSkill(skillKey);
  if (!mod?.chapter) return '';
  const chapter = formatChapterLabel(mod.chapter);
  if (!chapter) return '';
  return `Play ${chapter} again to improve ${SKILL_LABELS[skillKey] ?? skillKey}.`;
}

/** @typedef {{ summary: string, action: string }} FeedbackFocusParts */

/** AI-style recap of recent coaching — reflects empathy / ownership / communication spread. */
function summarizeFeedbackFocus(skills) {
  const entries = Object.entries(skills).filter(([, value]) => value != null);
  if (!entries.length) {
    return { summary: SKILL_DEFAULT_FEEDBACK.focus, action: '' };
  }

  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const [lowKey] = sorted[0];
  const [highKey] = sorted[sorted.length - 1];
  const spread = sorted[sorted.length - 1][1] - sorted[0][1];
  const midKeys = sorted.slice(1, -1).map(([key]) => SKILL_LABELS[key] ?? key);
  const action = formatReplayImprovement(lowKey);

  let summary;
  if (spread <= 10) {
    summary =
      'Your recent feedback is balanced across empathy, ownership, and communication—runs read steady, with no single lane dominating the profile.';
  } else if (spread <= 22) {
    const midPhrase = midKeys.length ? `, with ${midKeys.join(' and ')} between them` : '';
    summary = `Latest coaching summary: ${SKILL_LABELS[highKey]} is slightly ahead${midPhrase}, and ${SKILL_LABELS[lowKey]} has the most room to grow on the next run.`;
  } else {
    const midPhrase = midKeys.length ? `, with ${midKeys.join(' and ')} between them` : '';
    summary = `Recent runs lean on ${SKILL_LABELS[highKey]}; ${SKILL_LABELS[lowKey]} is the clearest gap in your skill spread${midPhrase}.`;
  }

  return { summary, action };
}

function renderFeedbackFocus(el, focus) {
  if (!el) return;
  el.replaceChildren();
  const parts = typeof focus === 'string' ? { summary: focus, action: '' } : focus;
  if (parts.summary) el.append(parts.summary);
  if (parts.action) {
    if (parts.summary) el.append(' ');
    const actionEl = document.createElement('strong');
    actionEl.className = 'intro-corporate-feedback__action';
    actionEl.textContent = parts.action;
    el.appendChild(actionEl);
  }
}

/** Shown on profile skill bars whenever score > 0 but no played modules yet. */
const SKILL_ACTIVE_FALLBACK = {
  empathy: 72,
  ownership: 68,
  communication: 74
};

function resolvePlayerSkillValue(skillKey, skills, score) {
  const measured = skills[skillKey];
  if (measured != null) return measured;
  if (score > 0) return SKILL_ACTIVE_FALLBACK[skillKey] ?? 70;
  return null;
}

const LEADERBOARD_SCOPE_ORDER = { department: 0, company: 1 };

const LB_SWITCH = {
  pickUpMs: 160,
  swooshMs: 420,
  dropMs: 200,
  enterDelayMs: 60,
  exitMsRatio: 0.6,
  exitOffsetRows: 1.5,
  pickUpScale: 1.08,
  pickUpShadow: '0 6px 24px rgba(0,0,0,0.13)',
  /** Rank travel → conveyor rows (capped); sign = climb (+) vs fall (−) in rank space */
  flyRankScale: 0.042,
  flyCapRows: 6,
  /** Extra shift per row away from You — sells flying past neighbors */
  parallaxSpread: 0.38,
  /** Fake rows scrolled during scope swoosh (added to rank-based travel) */
  swooshScrollBoostRows: 4,
  /** When 0–1 swoosh progress crosses this, swap department ↔ company rows */
  swooshSwapAt: 0.48,
  easePickUp: [0.4, 0, 1, 1],
  easeSwoosh: [0.25, 0.46, 0.45, 0.94],
  easeShuffle: [0.34, 1.08, 0.64, 1],
  easeDrop: [0.34, 1.4, 0.64, 1]
};

/** Signed row travel for scope switch (positive = better rank / move up the list). */
function leaderboardFlyRows(fromRank, toRank) {
  const delta = (fromRank ?? 0) - (toRank ?? 0);
  if (Math.abs(delta) < 1) return 0;
  const rows =
    Math.sign(delta) *
    Math.min(LB_SWITCH.flyCapRows, Math.abs(delta) * LB_SWITCH.flyRankScale + 1.25);
  return rows;
}

function leaderboardRowParallaxPx(index, youIdx, rowStep, travelEase) {
  return (index - youIdx) * rowStep * LB_SWITCH.parallaxSpread * travelEase;
}

/** Slow start → fast middle → soft stop (fake ladder scroll, not expand/pop). */
function leaderboardSwooshProgress(t) {
  const ramp = 0.14;
  const land = 0.86;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < ramp) {
    const u = t / ramp;
    return 0.07 * cubicBezierEase(0.28, 0.08, 0.42, 1, u);
  }
  if (t > land) {
    const u = (t - land) / (1 - land);
    return 0.93 + 0.07 * cubicBezierEase(0.18, 0.82, 0.38, 1, u);
  }
  const u = (t - ramp) / (land - ramp);
  return 0.07 + 0.86 * u;
}

/** Total list translate for the swoosh (sign = scroll direction through ranks). */
function leaderboardSwooshTravelPx(fromRank, toRank, rowStep) {
  const flyRows = leaderboardFlyRows(fromRank, toRank);
  const boost = Math.sign(flyRows || 1) * LB_SWITCH.swooshScrollBoostRows;
  const rows = flyRows === 0 ? boost : flyRows + boost;
  return rows * rowStep;
}

function leaderboardTapeRowPool(listEl) {
  const rows = [
    ...listEl.querySelectorAll(
      '.intro-corporate-leaderboard__row:not(.intro-corporate-leaderboard__row--tape):not(.intro-corporate-leaderboard__row--pad)'
    )
  ];
  const pool = rows.filter((r) => !r.classList.contains('intro-corporate-leaderboard__row--you'));
  return pool.length ? pool : rows;
}

function cloneLeaderboardTapeRow(sourceRow) {
  const li = sourceRow.cloneNode(true);
  li.classList.add('intro-corporate-leaderboard__row--tape');
  li.classList.remove('intro-corporate-leaderboard__row--you');
  li.setAttribute('aria-hidden', 'true');
  return li;
}

/** Extra rows above/below so translateY never exposes empty viewport. */
function installLeaderboardTapeBuffers(listEl, viewportEl, rowStep, travelPx) {
  removeLeaderboardTapeBuffers(listEl);
  const pool = leaderboardTapeRowPool(listEl);
  if (!pool.length || !viewportEl) return 0;

  const viewH = viewportEl.clientHeight || 0;
  const bufCount = Math.ceil((viewH + Math.abs(travelPx)) / rowStep) + 4;
  const topFrag = document.createDocumentFragment();
  const botFrag = document.createDocumentFragment();

  for (let i = 0; i < bufCount; i++) {
    topFrag.appendChild(cloneLeaderboardTapeRow(pool[i % pool.length]));
    botFrag.appendChild(
      cloneLeaderboardTapeRow(pool[(pool.length - 1 - (i % pool.length))] ?? pool[0])
    );
  }

  listEl.insertBefore(topFrag, listEl.firstChild);
  listEl.appendChild(botFrag);
  return bufCount;
}

function removeLeaderboardTapeBuffers(listEl) {
  listEl?.querySelectorAll('.intro-corporate-leaderboard__row--tape').forEach((el) => el.remove());
}

function formatLeaderboardRank(rank) {
  return Math.max(1, Math.round(rank)).toLocaleString('en-US');
}

function leaderboardRankOdometerMarkup(rank) {
  const r = Math.max(1, Math.round(rank));
  const cur = formatLeaderboardRank(r);
  const cells = [r - 1, r, r + 1, r + 2]
    .map((n) => Math.max(1, n))
    .map(
      (n) =>
        `<span class="intro-corporate-leaderboard__rank-cell${
          n === r ? ' is-current' : ''
        }">${formatLeaderboardRank(n)}</span>`
    )
    .join('');
  return `<span class="intro-corporate-leaderboard__rank intro-corporate-leaderboard__rank--odometer" aria-label="Rank ${cur}">
    <span class="intro-corporate-leaderboard__rank-viewport">
      <span class="intro-corporate-leaderboard__rank-strip" data-rank="${r}" style="transform: translateY(calc(-1 * var(--lb-rank-line)))">${cells}</span>
    </span>
  </span>`;
}

function mountLeaderboardRankOdometer(rowEl, rank) {
  if (!rowEl) return;
  const html = leaderboardRankOdometerMarkup(rank);
  const odometer = rowEl.querySelector('.intro-corporate-leaderboard__rank--odometer');
  if (odometer) odometer.outerHTML = html;
  else {
    const plain = rowEl.querySelector('.intro-corporate-leaderboard__rank');
    if (plain) plain.outerHTML = html;
  }
}

/** Timer-style rank scroll on the You row during scope swoosh (fractional 148 → 149 → …). */
function updateLeaderboardYouRankOdometer(youRow, fromRank, toRank, progress) {
  if (!youRow) return;
  if (!youRow.querySelector('.intro-corporate-leaderboard__rank-strip')) {
    mountLeaderboardRankOdometer(youRow, fromRank);
  }
  const strip = youRow.querySelector('.intro-corporate-leaderboard__rank-strip');
  const odometer = youRow.querySelector('.intro-corporate-leaderboard__rank--odometer');
  if (!strip || !odometer) return;

  const mix = (fromRank ?? 0) + ((toRank ?? 0) - (fromRank ?? 0)) * progress;
  const base = Math.floor(mix);
  const frac = mix - base;
  const slice = [0, 1, 2, 3].map((i) => Math.max(1, base - 1 + i));

  strip.dataset.rank = String(base);
  strip.style.transition = 'none';
  if (strip.dataset.rankBase !== String(base)) {
    strip.dataset.rankBase = String(base);
    strip.innerHTML = slice
      .map(
        (n, i) =>
          `<span class="intro-corporate-leaderboard__rank-cell${
            i === 1 ? ' is-current' : ''
          }">${formatLeaderboardRank(n)}</span>`
      )
      .join('');
  }
  strip.style.transform = `translateY(calc(-1 * var(--lb-rank-line) - ${frac} * var(--lb-rank-line)))`;
  odometer.setAttribute('aria-label', `Rank ${formatLeaderboardRank(Math.round(mix))}`);
}

function cubicBezierEase(x1, y1, x2, y2, t) {
  const sampleX = (u) => {
    const inv = 1 - u;
    return 3 * inv * inv * u * x1 + 3 * inv * u * u * x2 + u * u * u;
  };
  const sampleY = (u) => {
    const inv = 1 - u;
    return 3 * inv * inv * u * y1 + 3 * inv * u * u * y2 + u * u * u;
  };
  let u = t;
  for (let i = 0; i < 10; i++) {
    const x = sampleX(u) - t;
    if (Math.abs(x) < 1e-5) break;
    const dx =
      3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  u = Math.max(0, Math.min(1, u));
  return sampleY(u);
}

function tweenLeaderboard(ms, ease, onFrame) {
  return new Promise((resolve) => {
    const [x1, y1, x2, y2] = ease;
    const start = performance.now();
    const tick = (now) => {
      const raw = Math.min(1, (now - start) / ms);
      const eased = cubicBezierEase(x1, y1, x2, y2, raw);
      onFrame(eased, raw);
      if (raw < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function clearLeaderboardRowMotionStyles(el) {
  if (!el) return;
  el.style.transform = '';
  el.style.opacity = '';
  el.style.boxShadow = '';
  el.style.willChange = '';
}

function leaderboardOffsetKey(index, youIndex, entry) {
  if (entry?.you) return 'you';
  return `off:${index - youIndex}`;
}

function applyLeaderboardRowEntry(li, entry, staggerIndex) {
  if (!li || !entry) return;
  li.className = 'intro-corporate-leaderboard__row';
  if (entry.peek) {
    li.classList.add('intro-corporate-leaderboard__row--peek');
    li.setAttribute('aria-hidden', 'true');
  } else {
    li.removeAttribute('aria-hidden');
  }
  if (entry.you) li.classList.add('intro-corporate-leaderboard__row--you');
  li.style.setProperty('--lb-stagger', String(staggerIndex));
  const ptsClass = entry.ptsTone
    ? ` intro-corporate-leaderboard__pts--${entry.ptsTone}`
    : '';
  const rankHtml = entry.you
    ? leaderboardRankOdometerMarkup(entry.rank)
    : `<span class="intro-corporate-leaderboard__rank">${entry.rank}</span>`;
  li.innerHTML = `
    ${rankHtml}
    <span class="intro-corporate-leaderboard__name">${entry.name}</span>
    <span class="intro-corporate-leaderboard__pts${ptsClass}">${entry.pts}</span>
  `;
}

function buildLeaderboardSwitchPlan(currentScope, targetScope) {
  const current = leaderboardScopeData(currentScope);
  const target = leaderboardScopeData(targetScope);
  if (!current || !target) return null;

  const currentYouIdx = current.rows.findIndex((r) => r.you);
  const targetYouIdx = target.rows.findIndex((r) => r.you);
  if (currentYouIdx < 0 || targetYouIdx < 0) return null;

  const userVisualSlot = currentYouIdx;
  const targetByKey = new Map();
  target.rows.forEach((entry, index) => {
    targetByKey.set(leaderboardOffsetKey(index, targetYouIdx, entry), { entry, index });
  });

  const shared = [];
  const leaving = [];
  const usedKeys = new Set();

  current.rows.forEach((entry, index) => {
    const key = leaderboardOffsetKey(index, currentYouIdx, entry);
    const dest = targetByKey.get(key);
    if (dest) {
      shared.push({
        key,
        currentIndex: index,
        targetIndex: dest.index,
        currentEntry: entry,
        targetEntry: dest.entry
      });
      usedKeys.add(key);
    } else {
      leaving.push({ entry, currentIndex: index, aboveYou: index < currentYouIdx });
    }
  });

  const entering = [];
  target.rows.forEach((entry, index) => {
    const key = leaderboardOffsetKey(index, targetYouIdx, entry);
    if (usedKeys.has(key)) return;
    entering.push({
      entry,
      targetIndex: index,
      aboveYou: index < targetYouIdx
    });
  });

  return {
    userVisualSlot,
    currentYouIdx,
    targetYouIdx,
    fromYouRank: current.youRank,
    toYouRank: target.youRank,
    shared,
    leaving,
    entering
  };
}

const LEADERBOARD_FILLER_NAMES = [
  'Jamie Kim',
  'Elena Voss',
  'Marcus Chen',
  'Priya Nair',
  'Jonas Lind',
  'Sofia Ruiz',
  'Alex Morgan',
  'N. Okonkwo',
  'M. Laurent',
  'R. Patel',
  'S. Nguyen',
  'L. Bergström',
  'C. Okada',
  'D. Fischer',
  'H. Alves',
  'I. Kowalski',
  'J. Mensah',
  'K. Okafor',
  'T. Dubois',
  'V. Santos',
  'Y. Tanaka',
  'Z. Williams',
  'A. Dubois',
  'B. Chen',
  'F. Nielsen',
  'G. Rossi'
];

const LB_VIEWPORT_ROWS_DEFAULT = 7.5;

function getLbViewportRowSlots() {
  const panel = document.getElementById('intro-corporate-leaderboard');
  if (!panel) return LB_VIEWPORT_ROWS_DEFAULT;
  const raw = parseFloat(getComputedStyle(panel).getPropertyValue('--lb-viewport-row-count').trim());
  return Number.isFinite(raw) && raw > 0 ? raw : LB_VIEWPORT_ROWS_DEFAULT;
}

function parseLeaderboardPts(pts) {
  if (pts == null || pts === '') return null;
  const n = Number.parseInt(String(pts).replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function synthLeaderboardName(scope, rank) {
  let n = 0;
  const key = `${scope}|${rank}`;
  for (let i = 0; i < key.length; i++) n += key.charCodeAt(i);
  return LEADERBOARD_FILLER_NAMES[n % LEADERBOARD_FILLER_NAMES.length];
}

function synthLeaderboardPts(rank, youRank, anchorPts) {
  const spread = (youRank - rank) * 82 + ((rank * 19) % 37);
  return Math.max(120, anchorPts + spread);
}

/**
 * Grow the visible rank window so the list fills the viewport (unless the pool is tiny).
 * @param {object} scopeData
 * @param {number} rowSlots
 */
function expandLeaderboardRows(scopeData, rowSlots) {
  const seedRows = scopeData.rows ?? [];
  const scope = scopeData.scope ?? 'department';
  const youRank = scopeData.youRank ?? seedRows.find((row) => row.you)?.rank ?? 1;
  const totalPlayers = scopeData.totalPlayers ?? youRank + (scopeData.playersBelow ?? 0);
  const playersAbove = scopeData.playersAbove ?? Math.max(0, youRank - 1);
  const playersBelow = scopeData.playersBelow ?? Math.max(0, totalPlayers - youRank);
  const fullTarget = Math.max(3, Math.ceil(rowSlots));
  const playerPts = yourPlayerPoints();

  if (totalPlayers <= fullTarget) {
    const rows = [];
    for (let rank = 1; rank <= totalPlayers; rank++) {
      const peek = rank === 1 || rank === totalPlayers;
      if (rank === youRank) {
        rows.push({
          rank,
          name: PLAYER_DISPLAY_NAME,
          pts: formatLeaderboardPts(playerPts),
          you: true,
          peek
        });
        continue;
      }
      const existing = seedRows.find((row) => row.rank === rank);
      if (existing && !existing.you) {
        rows.push({ ...existing, peek: peek || Boolean(existing.peek) });
        continue;
      }
      rows.push({
        rank,
        name: synthLeaderboardName(scope, rank),
        pts: formatLeaderboardPts(synthLeaderboardPts(rank, youRank, playerPts)),
        peek
      });
    }
    return rows;
  }

  const centerIdx = Math.floor((fullTarget - 1) / 2);
  let rowsAbove = Math.min(playersAbove, centerIdx);
  let rowsBelow = Math.min(playersBelow, fullTarget - 1 - centerIdx);
  while (rowsAbove + rowsBelow + 1 < fullTarget) {
    const canAddAbove = rowsAbove < playersAbove;
    const canAddBelow = rowsBelow < playersBelow;
    if (!canAddAbove && !canAddBelow) break;
    if (canAddAbove && canAddBelow) {
      if (playersAbove - rowsAbove >= playersBelow - rowsBelow) rowsAbove += 1;
      else rowsBelow += 1;
    } else if (canAddBelow) rowsBelow += 1;
    else rowsAbove += 1;
  }

  const startRank = Math.max(1, youRank - rowsAbove);
  const endRank = Math.min(totalPlayers, youRank + rowsBelow);
  const seedByRank = new Map(seedRows.map((row) => [row.rank, row]));
  const rows = [];

  for (let rank = startRank; rank <= endRank; rank++) {
    const peek =
      (rank === startRank && startRank > 1) || (rank === endRank && endRank < totalPlayers);
    if (rank === youRank) {
      rows.push({
        rank,
        name: PLAYER_DISPLAY_NAME,
        pts: formatLeaderboardPts(playerPts),
        you: true,
        peek
      });
      continue;
    }
    const existing = seedByRank.get(rank);
    if (existing && !existing.you) {
      rows.push({ ...existing, peek: peek || Boolean(existing.peek) });
      continue;
    }
    rows.push({
      rank,
      name: synthLeaderboardName(scope, rank),
      pts: formatLeaderboardPts(synthLeaderboardPts(rank, youRank, playerPts)),
      peek
    });
  }

  const youIdx = rows.findIndex((row) => row.you);
  const padBefore = Math.max(0, centerIdx - youIdx);
  const padAfter = Math.max(0, fullTarget - rows.length - padBefore);
  const padRow = () => ({ pad: true });
  return [...Array(padBefore).fill(null).map(padRow), ...rows, ...Array(padAfter).fill(null).map(padRow)];
}

/** Rank 1 = highest pts; rank totalPlayers when score is still 0. */
function resolveYouRankForPts(scope, playerPts, totalPlayers) {
  if (playerPts <= 0) return totalPlayers;
  let youRank = Math.max(1, Math.min(totalPlayers, Math.round(totalPlayers / 2)));
  for (let pass = 0; pass < 32; pass++) {
    let above = 0;
    for (let rank = 1; rank <= totalPlayers; rank++) {
      if (rank === youRank) continue;
      if (synthLeaderboardPts(rank, youRank, playerPts) > playerPts) above += 1;
    }
    const next = above + 1;
    if (next === youRank) break;
    youRank = next;
  }
  return youRank;
}

const LEADERBOARD_SCOPES = {
  department: {
    label: 'Department',
    aria: 'Department leaderboard',
    more: '287 players below',
    totalPlayers: 295,
    rows: []
  },
  company: {
    label: 'Company',
    aria: 'Company-wide leaderboard',
    more: '1,312 players below',
    totalPlayers: 1456,
    rows: []
  }
};

function totalStarsCollected() {
  return getRuntimeModules().reduce((sum, mod) => {
    if (mod.locked) return sum;
    return sum + starsForModule(mod);
  }, 0);
}

function moduleSkillSample(mod) {
  if (mod.locked) return null;
  const played = mod.completed || mod.empathyScore != null;
  if (!played) return null;

  if (mod.empathyScore != null) {
    const clamped = Math.max(
      EMPATHY_SCORE_FLOOR,
      Math.min(EMPATHY_SCORE_CEIL, Math.round(mod.empathyScore))
    );
    return Math.round(
      ((clamped - EMPATHY_SCORE_FLOOR) / (EMPATHY_SCORE_CEIL - EMPATHY_SCORE_FLOOR)) * 100
    );
  }
  if (mod.completed) return 88;
  return null;
}

function aggregatePlayerSkills() {
  const buckets = { empathy: [], ownership: [], communication: [] };
  for (const mod of getRuntimeModules()) {
    const skill = MODULE_SKILL_FOCUS[mod.id];
    const sample = moduleSkillSample(mod);
    if (!skill || sample == null) continue;
    buckets[skill].push(sample);
  }

  const average = (values) =>
    values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  return {
    empathy: average(buckets.empathy),
    ownership: average(buckets.ownership),
    communication: average(buckets.communication)
  };
}

function feedbackForSkills(skills) {
  const entries = Object.entries(skills).filter(([, value]) => value != null);
  if (!entries.length) return SKILL_DEFAULT_FEEDBACK;

  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const highest = sorted[sorted.length - 1][0];
  return {
    focus: summarizeFeedbackFocus(skills),
    strength: SKILL_FEEDBACK[highest]?.strength ?? SKILL_DEFAULT_FEEDBACK.strength
  };
}

function syncPlayerProfile() {
  const profile = document.getElementById('intro-corporate-player-profile');
  const feedback = document.getElementById('intro-corporate-feedback');
  if (!profile) return;

  const stars = totalStarsCollected();
  const score = yourPlayerPoints();
  const skills = aggregatePlayerSkills();
  const skillsActive = score > 0;
  const displaySkills = {
    empathy: resolvePlayerSkillValue('empathy', skills, score),
    ownership: resolvePlayerSkillValue('ownership', skills, score),
    communication: resolvePlayerSkillValue('communication', skills, score)
  };
  const coaching = feedbackForSkills(displaySkills);

  profile.classList.toggle('is-skills-active', skillsActive);

  const nameEl = profile.querySelector('[data-player-name]');
  if (nameEl) nameEl.textContent = PLAYER_DISPLAY_NAME;

  const scoreEl = profile.querySelector('[data-player-score]');
  if (scoreEl) scoreEl.textContent = score.toLocaleString('en-US');

  const starsEl = profile.querySelector('[data-player-stars]');
  if (starsEl) {
    starsEl.textContent = stars === 1 ? '1 ★' : `${stars} ★`;
  }

  for (const skill of ['empathy', 'ownership', 'communication']) {
    const value = displaySkills[skill];
    const skillEl = profile.querySelector(`[data-skill="${skill}"]`);
    const pctEl = profile.querySelector(`[data-skill-pct="${skill}"]`);
    const fillEl = profile.querySelector(`[data-skill-fill="${skill}"]`);
    const active = skillsActive && value != null;
    skillEl?.classList.toggle('is-active', active);
    if (pctEl) pctEl.textContent = value == null ? '—' : `${value}%`;
    if (fillEl) fillEl.style.width = value == null ? '0%' : `${value}%`;
  }

  const focusEl = feedback?.querySelector('[data-feedback-focus]');
  renderFeedbackFocus(focusEl, coaching.focus);
  const strengthEl = feedback?.querySelector('[data-feedback-strength]');
  if (strengthEl) strengthEl.textContent = coaching.strength;

  refreshLeaderboardPanel();
}

function formatLeaderboardPts(pts) {
  return Math.round(pts).toLocaleString('en-US');
}

function leaderboardScopeData(scope) {
  const data = LEADERBOARD_SCOPES[scope];
  if (!data) return null;
  const playerPts = yourPlayerPoints();
  const youRank = resolveYouRankForPts(scope, playerPts, data.totalPlayers);
  const playersAbove = Math.max(0, youRank - 1);
  const playersBelow = Math.max(0, data.totalPlayers - youRank);
  const rowSlots = getLbViewportRowSlots();
  const rows = expandLeaderboardRows(
    { ...data, scope, youRank, playersAbove, playersBelow },
    rowSlots
  );
  return { ...data, scope, youRank, playersAbove, playersBelow, rows };
}

function buildLeaderboardRow(entry, staggerIndex) {
  const li = document.createElement('li');
  if (entry.pad) {
    li.className = 'intro-corporate-leaderboard__row intro-corporate-leaderboard__row--pad';
    li.setAttribute('aria-hidden', 'true');
    return li;
  }
  li.className = 'intro-corporate-leaderboard__row';
  if (entry.peek) {
    li.classList.add('intro-corporate-leaderboard__row--peek');
    li.setAttribute('aria-hidden', 'true');
  }
  if (entry.you) {
    li.classList.add('intro-corporate-leaderboard__row--you');
    li.removeAttribute('aria-hidden');
  }
  li.style.setProperty('--lb-stagger', String(staggerIndex));
  const ptsClass = entry.ptsTone
    ? ` intro-corporate-leaderboard__pts--${entry.ptsTone}`
    : '';
  const rankHtml = entry.you
    ? leaderboardRankOdometerMarkup(entry.rank)
    : `<span class="intro-corporate-leaderboard__rank">${entry.rank}</span>`;
  li.innerHTML = `
    ${rankHtml}
    <span class="intro-corporate-leaderboard__name">${entry.name}</span>
    <span class="intro-corporate-leaderboard__pts${ptsClass}">${entry.pts}</span>
  `;
  return li;
}

function renderLeaderboardRows(listEl, scope) {
  const data = leaderboardScopeData(scope);
  if (!listEl || !data) return;
  listEl.replaceChildren(...data.rows.map((row, index) => buildLeaderboardRow(row, index)));
}

/** Scroll so the You row sits in the center slot of the viewport (between neighbors in the list). */
function computeLeaderboardScrollToCenterYou(viewport, listEl, panel) {
  const youRow =
    listEl?.querySelector('.intro-corporate-leaderboard__row--you:not([aria-hidden="true"])') ??
    listEl?.querySelector('.intro-corporate-leaderboard__row--you');
  if (!viewport || !listEl || !youRow) return 0;

  const viewportH = viewport.clientHeight;
  const listH = listEl.offsetHeight;
  const maxScroll = Math.max(0, listH - viewportH);
  if (maxScroll <= 0) return 0;

  const rowStep = panel ? measureLeaderboardRowStepPx(panel) : 0;
  if (rowStep >= 8) {
    const rows = [
      ...listEl.querySelectorAll(
        '.intro-corporate-leaderboard__row:not(.intro-corporate-leaderboard__row--tape):not(.intro-corporate-leaderboard__row--pad)'
      )
    ];
    const youIdx = rows.indexOf(youRow);
    if (youIdx >= 0) {
      const visibleRows = Math.max(1, Math.round(viewportH / rowStep));
      const centerSlot = Math.floor(visibleRows / 2);
      let scroll = (youIdx - centerSlot) * rowStep;
      return Math.max(0, Math.min(maxScroll, scroll));
    }
  }

  const rowTop = youRow.offsetTop;
  const rowH = youRow.offsetHeight;
  let scroll = rowTop + rowH / 2 - viewportH / 2;
  return Math.max(0, Math.min(maxScroll, scroll));
}

function applyLeaderboardListAlign(panel, scope, { smooth = false, soft = false } = {}) {
  const viewport = panel?.querySelector('.intro-corporate-leaderboard__viewport');
  const listEl = panel?.querySelector('.intro-corporate-leaderboard__list');
  const data = leaderboardScopeData(scope);
  if (!viewport || !listEl || !data) return;

  const run = () => {
    const rowStep = measureLeaderboardRowStepPx(panel);
    const maxScroll = Math.max(0, listEl.offsetHeight - viewport.clientHeight);
    const ideal = computeLeaderboardScrollToCenterYou(viewport, listEl, panel);
    let scrollTarget = ideal;

    if (soft) {
      const current = viewport.scrollTop;
      const delta = ideal - current;
      if (Math.abs(delta) <= rowStep * 1.25) {
        scrollTarget = Math.round(current / rowStep) * rowStep;
      } else {
        scrollTarget = current + delta * 0.38;
        scrollTarget = Math.round(scrollTarget / rowStep) * rowStep;
      }
      scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
    } else if (rowStep >= 8) {
      scrollTarget = Math.round(scrollTarget / rowStep) * rowStep;
      scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
    }

    viewport.classList.toggle('is-ladder-slide', smooth);
    if (smooth) {
      viewport.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    } else {
      viewport.scrollTop = scrollTarget;
    }
    listEl.dataset.lbAlign = soft ? 'you-soft' : 'you-centered';
  };

  requestAnimationFrame(() => requestAnimationFrame(run));
}

function measureLeaderboardRowStepPx(panel) {
  const sample =
    panel?.querySelector('.intro-corporate-leaderboard__row:not(.intro-corporate-leaderboard__row--peek)') ??
    panel?.querySelector('.intro-corporate-leaderboard__row');
  const list = panel?.querySelector('.intro-corporate-leaderboard__list');
  if (!sample) return 28;
  const rowH = sample.getBoundingClientRect().height;
  const gap = list ? parseFloat(getComputedStyle(list).rowGap || getComputedStyle(list).gap) || 0 : 0;
  return rowH + gap;
}

/** After layout, grow row count if the measured viewport still has empty space. */
function ensureLeaderboardFillsViewport(panel, scope, listEl) {
  const viewport = panel?.querySelector('.intro-corporate-leaderboard__viewport');
  if (!panel || !viewport || !listEl) return;

  const rowStep = measureLeaderboardRowStepPx(panel);
  if (rowStep < 8) return;

  const neededSlots = Math.ceil(viewport.clientHeight / rowStep);
  const currentSlots = getLbViewportRowSlots();
  if (neededSlots <= currentSlots + 0.25) return;

  panel.style.setProperty('--lb-viewport-row-count', String(neededSlots));
  renderLeaderboardRows(listEl, scope);
  applyLeaderboardScopeMeta(panel, scope);
  applyLeaderboardListAlign(panel, scope);
}

function refreshLeaderboardPanel() {
  const panel = document.getElementById('intro-corporate-leaderboard');
  if (panel?.dataset.leaderboardAnimating === '1') return;
  let scope = panel?.dataset.leaderboardScope || 'department';
  if (LEADERBOARD_SCOPE_ORDER[scope] == null) scope = 'department';
  const listEl = panel?.querySelector('.intro-corporate-leaderboard__list');
  if (!panel || !listEl) return;
  panel.dataset.leaderboardScope = scope;
  renderLeaderboardRows(listEl, scope);
  applyLeaderboardScopeMeta(panel, scope);
  applyLeaderboardListAlign(panel, scope);
  requestAnimationFrame(() => {
    ensureLeaderboardFillsViewport(panel, scope, listEl);
  });
}

function leaderboardScopeDropdown(panel) {
  return panel?.querySelector('[data-leaderboard-scope-dropdown]');
}

function closeLeaderboardScopeMenu(panel) {
  const dropdown = leaderboardScopeDropdown(panel);
  if (!dropdown) return;
  const trigger = dropdown.querySelector('.intro-corporate-leaderboard-scope-trigger');
  const menu = dropdown.querySelector('.intro-corporate-leaderboard-scope-menu');
  dropdown.classList.remove('is-open');
  trigger?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('hidden', '');
}

function openLeaderboardScopeMenu(panel) {
  const dropdown = leaderboardScopeDropdown(panel);
  if (!dropdown) return;
  const trigger = dropdown.querySelector('.intro-corporate-leaderboard-scope-trigger');
  const menu = dropdown.querySelector('.intro-corporate-leaderboard-scope-menu');
  dropdown.classList.add('is-open');
  trigger?.setAttribute('aria-expanded', 'true');
  menu?.removeAttribute('hidden');
  const active = menu?.querySelector('.intro-corporate-leaderboard-scope-option.is-active');
  active?.focus?.();
}

function toggleLeaderboardScopeMenu(panel) {
  const dropdown = leaderboardScopeDropdown(panel);
  if (!dropdown) return;
  if (dropdown.classList.contains('is-open')) closeLeaderboardScopeMenu(panel);
  else openLeaderboardScopeMenu(panel);
}

function applyLeaderboardScopeMeta(panel, scope) {
  const copy = leaderboardScopeData(scope);
  if (!panel || !copy) return;
  const moreEl = panel.querySelector('[data-leaderboard-more]');
  panel.dataset.leaderboardScope = scope;
  panel.setAttribute('aria-label', copy.aria);
  const dropdown = leaderboardScopeDropdown(panel);
  const labelEl = dropdown?.querySelector('[data-leaderboard-scope-label]');
  const activeOption = panel.querySelector(
    `.intro-corporate-leaderboard-scope-option[data-scope="${scope}"]`
  );
  dropdown?.querySelectorAll('.intro-corporate-leaderboard-scope-option[data-scope]').forEach((opt) => {
    const active = opt === activeOption;
    opt.classList.toggle('is-active', active);
    opt.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (labelEl) labelEl.textContent = copy.label;
  closeLeaderboardScopeMenu(panel);
  if (moreEl) {
    const below = Math.max(0, (copy.totalPlayers ?? 0) - (copy.youRank ?? 0));
    moreEl.textContent =
      below > 0 ? `${below.toLocaleString('en-US')} players below` : '';
    moreEl.hidden = below <= 0;
  }
}

function releaseLeaderboardScopeSwitch(panel) {
  delete panel?.dataset.leaderboardAnimating;
  const trigger = panel?.querySelector('.intro-corporate-leaderboard-scope-trigger');
  if (trigger) trigger.disabled = false;
}

function cancelLeaderboardScopeSwitch(panel) {
  const listEl = panel?.querySelector('.intro-corporate-leaderboard__list');
  const viewportEl = panel?.querySelector('.intro-corporate-leaderboard__viewport');
  if (!panel || !listEl) return;
  listEl.classList.remove('is-lb-switch-animating');
  viewportEl?.classList.remove('is-lb-switch-animating');
  for (const el of listEl.querySelectorAll('.intro-corporate-leaderboard__row')) {
    clearLeaderboardRowMotionStyles(el);
  }
  releaseLeaderboardScopeSwitch(panel);
}

async function runLeaderboardScopeSwitch(panel, fromScope, toScope) {
  const listEl = panel.querySelector('.intro-corporate-leaderboard__list');
  const viewportEl = panel.querySelector('.intro-corporate-leaderboard__viewport');
  const scopeTrigger = panel.querySelector('.intro-corporate-leaderboard-scope-trigger');
  const plan = buildLeaderboardSwitchPlan(fromScope, toScope);
  if (!plan) return false;

  const rowStep = measureLeaderboardRowStepPx(panel);
  panel.style.setProperty('--lb-row-step', `${rowStep}px`);

  const rowEls = [...listEl.querySelectorAll('.intro-corporate-leaderboard__row')];
  const youEl = listEl.querySelector('.intro-corporate-leaderboard__row--you');
  if (!youEl) return false;

  panel.dataset.leaderboardAnimating = '1';
  closeLeaderboardScopeMenu(panel);
  if (scopeTrigger) scopeTrigger.disabled = true;
  mountLeaderboardRankOdometer(youEl, plan.fromYouRank);

  try {
  listEl.classList.add('is-lb-switch-animating');
  viewportEl?.classList.add('is-lb-switch-animating');
  viewportEl?.classList.remove('is-ladder-slide', 'is-escalator-landing');
  listEl.classList.remove(
    'is-escalator-enter-down',
    'is-escalator-enter-up',
    'is-escalator-exit-down',
    'is-escalator-exit-up'
  );

  const travelPx = leaderboardSwooshTravelPx(plan.fromYouRank, plan.toYouRank, rowStep);
  let scopeSwapped = false;
  listEl.classList.add('is-lb-swoosh-tape');
  installLeaderboardTapeBuffers(listEl, viewportEl, rowStep, travelPx);
  if (viewportEl) viewportEl.scrollTop = computeLeaderboardScrollToCenterYou(viewportEl, listEl, panel);

  rowEls.forEach((el) => {
    if (!el.classList.contains('intro-corporate-leaderboard__row--tape')) {
      el.style.willChange = 'transform, opacity';
    }
  });

  // Phase 1 — pick up (You row only)
  await tweenLeaderboard(LB_SWITCH.pickUpMs, LB_SWITCH.easePickUp, (t) => {
    const scale = 1 + (LB_SWITCH.pickUpScale - 1) * t;
    const youNow = listEl.querySelector('.intro-corporate-leaderboard__row--you');
    if (!youNow) return;
    youNow.style.transform = `scale(${scale})`;
    youNow.style.boxShadow = t > 0 ? LB_SWITCH.pickUpShadow : '';
  });

  // Phase 2 — tape scroll; You rank odometer counts through interpolated ranks
  await new Promise((resolve) => {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const swooshT = Math.min(1, elapsed / LB_SWITCH.swooshMs);
      const p = leaderboardSwooshProgress(swooshT);
      const listTy = travelPx * p;

      if (!scopeSwapped && p >= LB_SWITCH.swooshSwapAt) {
        scopeSwapped = true;
        removeLeaderboardTapeBuffers(listEl);
        renderLeaderboardRows(listEl, toScope);
        applyLeaderboardScopeMeta(panel, toScope);
        const remainTravel = Math.abs(travelPx) * (1 - p);
        installLeaderboardTapeBuffers(listEl, viewportEl, rowStep, remainTravel);
        if (viewportEl) {
          viewportEl.scrollTop = computeLeaderboardScrollToCenterYou(viewportEl, listEl, panel);
        }
      }

      const fast = swooshT > 0.16 && swooshT < 0.8;
      listEl.classList.toggle('is-lb-swoosh-fast', fast);

      listEl.style.transform = `translateY(${listTy}px)`;
      listEl.style.willChange = 'transform';

      const youNow = listEl.querySelector('.intro-corporate-leaderboard__row--you');
      if (youNow) {
        updateLeaderboardYouRankOdometer(youNow, plan.fromYouRank, plan.toYouRank, p);
        youNow.style.willChange = 'transform, box-shadow';
        youNow.style.transform = `translateY(${-listTy}px) scale(${LB_SWITCH.pickUpScale})`;
        youNow.style.boxShadow = LB_SWITCH.pickUpShadow;
      }

      if (elapsed >= LB_SWITCH.swooshMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  listEl.classList.remove('is-lb-swoosh-tape', 'is-lb-swoosh-fast');
  removeLeaderboardTapeBuffers(listEl);

  // Phase 3 — decelerate tape to rest, slam You down, center on new scope
  const endListTy = travelPx;
  await tweenLeaderboard(LB_SWITCH.dropMs, LB_SWITCH.easeDrop, (t) => {
    const settle = 1 - t;
    const listTy = endListTy * settle;
    const scale = LB_SWITCH.pickUpScale + (1 - LB_SWITCH.pickUpScale) * t;
    listEl.style.transform = listTy !== 0 ? `translateY(${listTy}px)` : '';
    const youNow = listEl.querySelector('.intro-corporate-leaderboard__row--you');
    if (youNow) {
      updateLeaderboardYouRankOdometer(youNow, plan.fromYouRank, plan.toYouRank, 1);
      youNow.style.transform =
        listTy !== 0
          ? `translateY(${-listTy}px) scale(${scale})`
          : `scale(${scale})`;
      youNow.style.boxShadow = t < 1 ? LB_SWITCH.pickUpShadow : '';
    }
  });

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  listEl.classList.remove('is-lb-switch-animating');
  viewportEl?.classList.remove('is-lb-switch-animating');
  listEl.style.transform = '';
  listEl.style.willChange = '';
  removeLeaderboardTapeBuffers(listEl);
  for (const el of listEl.querySelectorAll('.intro-corporate-leaderboard__row')) {
    clearLeaderboardRowMotionStyles(el);
  }

  if (!scopeSwapped) {
    renderLeaderboardRows(listEl, toScope);
    applyLeaderboardScopeMeta(panel, toScope);
  }
  const youFinal = listEl.querySelector('.intro-corporate-leaderboard__row--you');
  mountLeaderboardRankOdometer(youFinal, plan.toYouRank);
  applyLeaderboardListAlign(panel, toScope);
  return true;
  } finally {
    listEl.classList.remove('is-lb-switch-animating', 'is-lb-swoosh-tape', 'is-lb-swoosh-fast');
    viewportEl?.classList.remove('is-lb-switch-animating');
    removeLeaderboardTapeBuffers(listEl);
    releaseLeaderboardScopeSwitch(panel);
  }
}

function applyLeaderboardScopeImmediate(panel, listEl, scope) {
  renderLeaderboardRows(listEl, scope);
  applyLeaderboardScopeMeta(panel, scope);
  applyLeaderboardListAlign(panel, scope);
}

async function setLeaderboardScope(panel, scope, { animate = true } = {}) {
  const listEl = panel?.querySelector('.intro-corporate-leaderboard__list');
  const viewportEl = panel?.querySelector('.intro-corporate-leaderboard__viewport');
  if (!panel || !listEl) return;
  if (LEADERBOARD_SCOPE_ORDER[scope] == null) return;

  const fromScope = panel.dataset.leaderboardScope || 'department';

  if (panel.dataset.leaderboardAnimating === '1') {
    cancelLeaderboardScopeSwitch(panel);
    applyLeaderboardScopeImmediate(panel, listEl, fromScope);
  }
  if (fromScope === scope) {
    applyLeaderboardScopeImmediate(panel, listEl, scope);
    return;
  }

  applyLeaderboardScopeMeta(panel, scope);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (animate && !reduced && viewportEl) {
    try {
      const switched = await runLeaderboardScopeSwitch(panel, fromScope, scope);
      if (!switched) applyLeaderboardScopeImmediate(panel, listEl, scope);
    } catch (err) {
      console.error('[leaderboard] scope switch failed', err);
      listEl.classList.remove('is-lb-switch-animating');
      viewportEl?.classList.remove('is-lb-switch-animating');
      releaseLeaderboardScopeSwitch(panel);
      applyLeaderboardScopeImmediate(panel, listEl, scope);
    }
    return;
  }

  applyLeaderboardScopeImmediate(panel, listEl, scope);
}

function wireLeaderboardScopes() {
  const panel = document.getElementById('intro-corporate-leaderboard');
  const dropdown = leaderboardScopeDropdown(panel);
  if (!panel || !dropdown || dropdown.dataset.wired === '1') return;
  dropdown.dataset.wired = '1';

  if (!window.__wfLeaderboardViewportWired) {
    window.__wfLeaderboardViewportWired = true;
    window.addEventListener('wf:leaderboard-viewport', refreshLeaderboardPanel);
  }

  const initialScope = panel.dataset.leaderboardScope;
  panel.dataset.leaderboardScope = LEADERBOARD_SCOPE_ORDER[initialScope] != null ? initialScope : 'department';

  const trigger = dropdown.querySelector('.intro-corporate-leaderboard-scope-trigger');
  const menu = dropdown.querySelector('.intro-corporate-leaderboard-scope-menu');

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trigger.disabled) return;
    toggleLeaderboardScopeMenu(panel);
  });

  menu?.querySelectorAll('[data-scope]').forEach((opt) => {
    opt.tabIndex = -1;
    opt.addEventListener('click', () => {
      const scope = opt.dataset.scope;
      if (!scope || LEADERBOARD_SCOPE_ORDER[scope] == null) return;
      closeLeaderboardScopeMenu(panel);
      void setLeaderboardScope(panel, scope);
    });
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        opt.click();
      }
    });
  });

  if (!window.__wfLeaderboardScopeDropdownDocWired) {
    window.__wfLeaderboardScopeDropdownDocWired = true;
    document.addEventListener('click', (e) => {
      const lbPanel = document.getElementById('intro-corporate-leaderboard');
      const lbDropdown = leaderboardScopeDropdown(lbPanel);
      if (!lbDropdown?.classList.contains('is-open')) return;
      if (e.target instanceof Node && lbDropdown.contains(e.target)) return;
      closeLeaderboardScopeMenu(lbPanel);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeLeaderboardScopeMenu(document.getElementById('intro-corporate-leaderboard'));
    });
  }

  const listEl = panel.querySelector('.intro-corporate-leaderboard__list');
  if (listEl) {
    applyLeaderboardScopeImmediate(panel, listEl, panel.dataset.leaderboardScope || 'department');
  }
}

function tagCorporatePopTargets() {
  const board = document.getElementById('intro-corporate-board');
  if (!board) return;
  if (isCorporateSkin()) {
    board.querySelectorAll('.intro-corporate-nav__item').forEach((btn) => {
      btn.classList.add('intro-corporate-pop-target');
    });
    board.querySelector('.intro-corporate-board__title')?.classList.add('intro-corporate-pop-target');
    board.querySelector('.intro-corporate-board__lead')?.classList.add('intro-corporate-pop-target');
    gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
      wrap.classList.add('intro-corporate-pop-target');
    });
  }
  board.querySelector('.intro-corporate-player-profile')?.classList.add('intro-corporate-pop-target');
  board.querySelector('.intro-corporate-leaderboard-panel')?.classList.add('intro-corporate-pop-target');
  board.querySelector('.intro-corporate-activity')?.classList.add('intro-corporate-pop-target');
}

function resetCorporatePop() {
  const board = document.getElementById('intro-corporate-board');
  if (!board) return;
  board.classList.remove('is-pop-complete', 'is-path-pop-active');
  board.classList.add('is-pop-pending');
  board.querySelectorAll('.intro-corporate-pop-target').forEach((el) => {
    el.classList.remove('is-pop-visible');
  });
  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.remove('is-pop-visible');
    wrap.classList.add('is-revealed');
  });
  board
    .querySelectorAll('.intro-corporate-leaderboard__row.is-lb-row-pop')
    .forEach((row) => row.classList.remove('is-lb-row-pop', 'is-pop-visible'));
  pathMapEl?.querySelectorAll('.intro-cord.is-intro-revealed').forEach((host) => {
    host.classList.remove('is-intro-revealed', 'is-plugging');
  });
  viewport?.classList.remove('is-modules-visible');
  stopCordFloat();
  clearPlugState();
}

/** Show all corporate board UI (chapters, leaderboard, activity) without waiting on pop animation. */
function revealCorporateBoard() {
  const board = document.getElementById('intro-corporate-board');
  if (!board) return;

  if (isCorporateSkin()) resetCorporateDashboardLayout();
  tagCorporatePopTargets();
  board.classList.remove('is-pop-pending');
  board.classList.add('is-pop-complete');
  board.querySelectorAll('.intro-corporate-pop-target').forEach((el) => {
    el.classList.add('is-pop-visible');
  });
  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.add('is-revealed', 'is-pop-visible');
  });
  viewport?.classList.add('is-modules-visible', 'is-chapter-settled', 'is-corporate-board');
  introState.complete = true;
  introState.chapterSettledAt = introState.chapterSettledAt ?? performance.now();
  introState.progress = 1;
  applyCorporateModuleGridLayout();
  syncPlayerProfile();
  wireSecretChapterTrigger();
  startCordFloat();
  queueIntroCordLayout();
  requestAnimationFrame(() => requestAnimationFrame(syncIntroSideColumnLayout));
}

function finishCorporatePop(runId) {
  if (runId != null && runId !== corporatePopRun) return;
  const board = document.getElementById('intro-corporate-board');
  board?.classList.remove('is-path-pop-active');
  revealCorporateBoard();
}

async function popCorporateTarget(el, runId, holdMs = CORPORATE_POP.stepMs) {
  if (!el || runId !== corporatePopRun) return;
  el.classList.add('is-pop-visible');
  await delayMs(holdMs);
}

/** Chapter cards: column order, top row before lower branch (3A before 3B). */
function corporateModulePopOrder(modules = getRuntimeModules()) {
  return [...modules]
    .sort((a, b) => (a.column !== b.column ? a.column - b.column : a.row - b.row))
    .map((m) => m.id);
}

/** Cord grows after each module, in path order (fork upper lane before lower). */
function corporateIntroCordSequence(modules = getRuntimeModules()) {
  const order = corporateModulePopOrder(modules);
  const orderIdx = new Map(order.map((id, i) => [id, i]));
  const ids = new Set(order);
  const edges = getChapterEdges().filter(([from, to]) => ids.has(from) && ids.has(to));
  const sequence = [];

  for (let i = 0; i < order.length; i++) {
    const from = order[i];
    const outgoing = edges
      .filter(([f, t]) => f === from && orderIdx.get(t) > i)
      .sort((a, b) => orderIdx.get(a[1]) - orderIdx.get(b[1]));
    for (const [f, t] of outgoing) sequence.push(edgeKey(f, t));
  }
  return sequence;
}

function markIntroCordRevealed(edgeKeyStr) {
  const seg = findCordSegment(edgeKeyStr);
  if (!seg) return;
  seg.plugSettle = 1;
  const hosts = seg.cordHosts
    ? Object.values(seg.cordHosts)
    : seg.group
      ? [seg.group]
      : [];
  for (const host of hosts) {
    host.classList.remove('is-plugging');
    host.classList.add('is-intro-revealed');
  }
  applyCordRopePaths(cordFloatPhase);
}

function runCordGrowAnimation(edgeKeyStr, runId) {
  return new Promise((resolve) => {
    const finish = () => {
      stopPlugAnimation();
      introState.pluggingEdge = null;
      markIntroCordRevealed(edgeKeyStr);
      resolve();
    };

    const seg = findCordSegment(edgeKeyStr);
    if (!seg || runId !== corporatePopRun) {
      finish();
      return;
    }

    refreshSubwayCordGeometry();
    seg.plugSettle = 0;
    applyCordRopePaths(cordFloatPhase);

    const plugHosts = seg.cordHosts
      ? Object.values(seg.cordHosts)
      : seg.group
        ? [seg.group]
        : [];
    for (const host of plugHosts) host.classList.add('is-plugging');

    const body = seg.paths.find((p) => p.classList.contains('intro-cord-rope--active'));
    const sheen = seg.paths.find((p) => p.classList.contains('intro-cord-rope--sheen'));
    const shadow = seg.paths.find((p) => p.classList.contains('intro-cord-rope--shadow'));
    const guide = body ?? seg.centerlinePath;
    if (!guide) {
      finish();
      return;
    }

    if (seg.knotStart) {
      seg.knotStart.setAttribute('cx', String(seg.p0.x));
      seg.knotStart.setAttribute('cy', String(seg.p0.y));
      seg.knotStart.style.opacity = '1';
    }
    if (seg.knotEnd) seg.knotEnd.style.opacity = '0';

    const len = guide.getTotalLength() || 1;
    const dashLayers = [body, sheen, shadow].filter(Boolean);
    for (const path of dashLayers) {
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
    }

    const duration = CORPORATE_POP.cordGrowMs;
    const start = performance.now();
    introState.pluggingEdge = edgeKeyStr;

    const tick = (now) => {
      if (runId !== corporatePopRun) {
        finish();
        return;
      }

      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      const offset = len * (1 - eased);
      for (const path of dashLayers) path.style.strokeDashoffset = String(offset);

      if (t > 0.58) {
        seg.plugSettle = ((t - 0.58) / 0.42) * 0.55;
        refreshSubwayCordGeometry();
        applyCordRopePaths(cordFloatPhase);
      } else {
        applyCordRopePaths(cordFloatPhase);
      }

      if (t < 1) {
        introState.plugRaf = requestAnimationFrame(tick);
      } else {
        for (const path of dashLayers) {
          path.style.strokeDashoffset = '0';
        }
        if (seg.knotEnd) {
          seg.knotEnd.setAttribute('cx', String(seg.p3.x));
          seg.knotEnd.setAttribute('cy', String(seg.p3.y));
          seg.knotEnd.style.opacity = '1';
        }
        animateCordPlugSettle(seg, finish);
      }
    };

    introState.plugRaf = requestAnimationFrame(tick);
  });
}

async function animateIntroCordReveal(edgeKeyStr, runId) {
  if (runId !== corporatePopRun) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    markIntroCordRevealed(edgeKeyStr);
    return;
  }
  if (!findCordSegment(edgeKeyStr)) return;
  await runCordGrowAnimation(edgeKeyStr, runId);
}

async function measureIntroCordsAsync() {
  return new Promise((resolve) => {
    measureIntroCords({ onReady: resolve });
  });
}

async function popCorporatePathSequence(board, runId) {
  const modules = getRuntimeModules();
  const moduleOrder = corporateModulePopOrder(modules);
  const cordOrder = corporateIntroCordSequence(modules);
  const cordsByFrom = new Map();

  for (const key of cordOrder) {
    const { fromId } = parseEdgeKey(key);
    if (!cordsByFrom.has(fromId)) cordsByFrom.set(fromId, []);
    cordsByFrom.get(fromId).push(key);
  }

  applyCorporateModuleGridLayout();
  if (runId !== corporatePopRun) return;

  board.classList.add('is-path-pop-active');
  viewport?.classList.add('is-modules-visible');

  const wraps = [...(gridEl?.querySelectorAll('.intro-module-wrap') ?? [])];
  wraps.forEach((wrap) => wrap.classList.add('is-revealed', 'is-pop-visible'));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await measureIntroCordsAsync();
  if (runId !== corporatePopRun) return;
  wraps.forEach((wrap) => wrap.classList.remove('is-pop-visible'));

  for (const moduleId of moduleOrder) {
    if (runId !== corporatePopRun) return;
    const wrap = gridEl?.querySelector(`[data-module-anchor="${moduleId}"]`);
    if (!wrap) continue;
    wrap.classList.add('is-pop-visible', 'is-revealed');
    await delayMs(CORPORATE_POP.moduleStaggerMs);

    const edgeKeys = cordsByFrom.get(moduleId) ?? [];
    for (const edgeKeyStr of edgeKeys) {
      if (runId !== corporatePopRun) return;
      await animateIntroCordReveal(edgeKeyStr, runId);
    }
  }
}

async function popCorporateSideColumn(board, runId) {
  const blocks = [
    board.querySelector('.intro-corporate-player-profile'),
    board.querySelector('.intro-corporate-activity'),
    board.querySelector('.intro-corporate-leaderboard-panel')
  ].filter(Boolean);

  for (const block of blocks) {
    if (runId !== corporatePopRun) return;
    await popCorporateTarget(block, runId, CORPORATE_POP.sideStaggerMs);
  }

  const rows = [
    ...(board.querySelectorAll(
      '.intro-corporate-leaderboard__row:not(.intro-corporate-leaderboard__row--pad):not(.intro-corporate-leaderboard__row--tape)'
    ) ?? [])
  ];
  let shown = 0;
  for (const row of rows) {
    if (runId !== corporatePopRun) return;
    row.classList.add('is-lb-row-pop', 'is-pop-visible');
    await delayMs(CORPORATE_POP.lbRowStaggerMs);
    if (++shown >= CORPORATE_POP.lbRowCap) break;
  }
}

/** Recover a broken corporate dashboard (hidden path, empty grid, stale layout cheat). */
function recoverCorporateDashboard() {
  if (!isCorporateSkin()) return;

  resetCorporateDashboardLayout();

  const wrapCount = gridEl?.querySelectorAll('.intro-module-wrap').length ?? 0;
  if (!wrapCount) renderModules();

  revealCorporateBoard();
  syncCorporatePathViewport();
  queueIntroCordLayout();
  wireSecretChapterTrigger();
}

/** Settle the corporate dashboard (chapters visible). */
function bootstrapCorporateIntro() {
  if (!isCorporateSkin()) return;
  if (
    (getCurrentChapter() === 2 && isChapterHandoffDone()) ||
    (getCurrentChapter() === 3 && isChapter3HandoffDone())
  ) {
    return;
  }

  if (!document.getElementById('intro-corporate-board')) return;

  recoverCorporateDashboard();
}

async function runCorporatePopSequence() {
  if (!isCorporateSkin()) return;

  const board = document.getElementById('intro-corporate-board');
  if (!board) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || board.classList.contains('is-pop-complete')) {
    revealCorporateBoard();
    return;
  }

  const runId = ++corporatePopRun;
  try {
    stopIntroAuto();

    stage.style.transform = 'none';
    syncParallax(0);
    document.documentElement.classList.remove('is-intro-scrubbing');
    viewport?.classList.remove('is-hero-visible', 'is-camera-moving');

    resetCorporatePop();
    tagCorporatePopTargets();

    const navItems = [...board.querySelectorAll('.intro-corporate-nav__item')];
    const title = board.querySelector('.intro-corporate-board__title');
    const lead = board.querySelector('.intro-corporate-board__lead');

    for (const btn of navItems) {
      if (runId !== corporatePopRun) return;
      await popCorporateTarget(btn, runId, CORPORATE_POP.navStaggerMs);
    }

    if (title) {
      await popCorporateTarget(title, runId, CORPORATE_POP.copyStaggerMs);
      if (runId !== corporatePopRun) return;
    }

    if (lead) {
      await popCorporateTarget(lead, runId, CORPORATE_POP.copyStaggerMs);
      if (runId !== corporatePopRun) return;
    }

    await popCorporatePathSequence(board, runId);
    if (runId !== corporatePopRun) return;

    await popCorporateSideColumn(board, runId);
    if (runId !== corporatePopRun) return;

    finishCorporatePop(runId);
  } catch (err) {
    console.error('[wf-map] corporate pop sequence failed', err);
    if (runId === corporatePopRun) revealCorporateBoard();
  } finally {
    if (runId === corporatePopRun && board.classList.contains('is-pop-pending')) {
      revealCorporateBoard();
    }
  }
}

function moduleById(id) {
  return getRuntimeModules().find((m) => m.id === id);
}

function isCordEdgeVisible(fromId, toId) {
  if (isCorporateSkin()) return true;

  const from = moduleById(fromId);
  if (!from || from.locked) return false;

  const key = edgeKey(fromId, toId);
  if (introState.pluggingEdge === key) return true;
  if (isEdgeFilled(key)) return true;

  const to = moduleById(toId);
  return Boolean(to && !to.locked);
}

function parseEdgeKey(key) {
  const [fromId, toId] = key.split('|');
  return { fromId, toId };
}

function moduleAnchorRect(moduleId) {
  const wrap = pathMapEl?.querySelector(`[data-module-anchor="${moduleId}"]`);
  const card = wrap?.querySelector('.module-card');
  const rect = (card ?? wrap)?.getBoundingClientRect();
  if (!rect?.width) return null;
  return rect;
}

function refreshCordSegmentEndpoints(seg) {
  if (!seg || !pathMapEl) return;
  const { fromId, toId } = parseEdgeKey(seg.key);
  const mapRect = pathMapEl.getBoundingClientRect();
  const anchorOpts = cordAnchorsForKey(seg.key);
  const fromRect = moduleAnchorRect(fromId);
  const toRect = moduleAnchorRect(toId);
  if (!fromRect || !toRect) return;
  seg.p0 = anchorFromRect(fromRect, anchorOpts.from, mapRect, anchorOpts.fromAlong ?? 0.5);
  seg.p3 = anchorFromRect(toRect, anchorOpts.to, mapRect, anchorOpts.toAlong ?? 0.5);
  seg.fromSide = anchorOpts.from;
  seg.toSide = anchorOpts.to;
  seg.anchorOpts = anchorOpts;
}

function reorderSubwayCordGroups() {
  if (!connectorsEl || !isCorporateSkin()) return;
  for (const layerName of ['shadow', 'body', 'sheen', 'hit']) {
    const layer = connectorsEl.querySelector(`.intro-connectors__layer--${layerName}`);
    if (!layer) continue;
    for (const seg of cordRopeSegments) {
      const host = seg.cordHosts?.[layerName];
      if (host) layer.appendChild(host);
    }
  }
}

function pathCardSizePx() {
  if (!gridEl) return 194;
  const n = parseFloat(getComputedStyle(gridEl).getPropertyValue('--path-card-size'));
  return Number.isFinite(n) && n > 0 ? n : 194;
}

function refreshSubwayCordGeometry() {
  for (const seg of cordRopeSegments) refreshCordSegmentEndpoints(seg);
  applySubwayLaneBundles(cordRopeSegments, { cardSizePx: pathCardSizePx() });
  const midPitch = getCurrentChapter() === 3 ? 32 : SUBWAY_MID_LANE_PITCH;
  applySubwayMidXLanes(cordRopeSegments, midPitch);
  applySubwayClearOfCards(cordRopeSegments, pathMapEl);
  sortSubwayCordPaintOrder(cordRopeSegments);
  reorderSubwayCordGroups();
}

function findCordSegment(edgeKeyStr) {
  return cordRopeSegments.find((s) => s.key === edgeKeyStr);
}

function stopPlugAnimation() {
  if (introState.plugRaf) cancelAnimationFrame(introState.plugRaf);
  introState.plugRaf = 0;
}

/** Wire draws from source to a still-locked target; on connect, unlock + persist filled edge. */
function clearPlugState() {
  introState.pluggingEdge = null;
  introState.plugActive = false;
  syncPlugActiveClass();
}

function completeModulePlay(sourceMod, outcome, sourceCard, targetId) {
  const runtimeBefore = getRuntimeModule(sourceMod.id) ?? sourceMod;
  const playMode = playModeBeforeOutcome(sourceMod.id);
  const { newlyUnlocked, starGateBlocked } = applyPlayOutcome(sourceMod.id, outcome);
  recordPlayActivity(runtimeBefore, outcome, newlyUnlocked, { playMode });
  patchModulesFromRuntime(newlyUnlocked);
  highlightUnlockedModules(newlyUnlocked);
  onModuleProgress(newlyUnlocked, sourceMod.id, { starGateBlocked });

  if (starGateBlocked) {
    sourceCard?.classList.remove('is-plug-source');
    focusModuleCard(sourceMod.id);
    return;
  }

  if (targetId) focusModuleCard(targetId);
  sourceCard?.classList.remove('is-plug-source');

  if (playMode === 'replayed' && !starGateBlocked && (isCorporateSkin() || isSpaceSkin())) {
    queueIntroCordLayout();
    requestAnimationFrame(() => {
      measureIntroCords({ onReady: () => showReplayOutcomeFeedback(sourceMod.id, outcome) });
    });
  }
}

function animatePlugWire(sourceMod, outcome, sourceCard) {
  const edgeKeyStr = outcome.fills?.[0];
  const targetId = outcome.unlocks?.[0];
  if (!edgeKeyStr || !targetId) return;

  const { toId } = parseEdgeKey(edgeKeyStr);
  const targetWrap = pathMapEl?.querySelector(`[data-module-anchor="${toId || targetId}"]`);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  stopIntroAuto();

  if (wouldBlockStarGateUnlock(sourceMod.id, outcome)) {
    sourceCard?.classList.remove('is-plug-source');
    targetWrap?.classList.remove('is-plug-target');
    clearPlugState();
    completeModulePlay(sourceMod, outcome, sourceCard, targetId);
    queueIntroCordLayout();
    return;
  }

  introState.plugActive = true;
  syncPlugActiveClass();

  focusModuleCard(sourceMod.id);
  sourceCard?.classList.add('is-plug-source');
  targetWrap?.classList.add('is-plug-target');

  introState.pluggingEdge = edgeKeyStr;

  let landed = false;
  let playApplied = false;
  let plugStarGateBlocked = false;

  const applyUnlockAtSquash = () => {
    if (playApplied) return;
    playApplied = true;

    const runtimeBefore = getRuntimeModule(sourceMod.id) ?? sourceMod;
    const playMode = playModeBeforeOutcome(sourceMod.id);
    const { newlyUnlocked, starGateBlocked } = applyPlayOutcome(sourceMod.id, outcome);
    plugStarGateBlocked = starGateBlocked;
    recordPlayActivity(runtimeBefore, outcome, newlyUnlocked, { playMode });

    const targetCard = targetWrap?.querySelector('.module-card');
    targetCard?.querySelector('.module-padlock')?.classList.add('is-opening');

    patchModulesFromRuntime(newlyUnlocked);
    onModuleProgress(newlyUnlocked, sourceMod.id, { starGateBlocked });

    if (starGateBlocked) {
      sourceCard?.classList.remove('is-plug-source');
      focusModuleCard(sourceMod.id);
    }
  };

  const finish = () => {
    if (landed) return;
    landed = true;
    stopPlugAnimation();
    clearTimeout(safetyTimer);

    targetWrap?.classList.remove('is-plug-target', 'is-plug-landing');
    hideCordTooltip();

    if (!playApplied) applyUnlockAtSquash();

    if (!plugStarGateBlocked) {
      if (targetId) {
        setNextPlayModule(targetId);
        focusModuleCard(targetId);
      }
      sourceCard?.classList.remove('is-plug-source');
    }

    clearPlugState();
    queueIntroCordLayout();
  };

  const runPlugAnimation = () => {
    const seg = findCordSegment(edgeKeyStr);
    if (!seg || reduced) {
      finish();
      return;
    }

    refreshSubwayCordGeometry();
    seg.plugSettle = 0;
    applyCordRopePaths(cordFloatPhase);

    const plugHosts = seg.cordHosts
      ? Object.values(seg.cordHosts)
      : connectorsEl
        ? Array.from(
            connectorsEl.querySelectorAll(`[data-edge="${edgeKeyStr}"], [data-cord-edge="${edgeKeyStr}"]`)
          )
        : [];
    for (const host of plugHosts) host.classList.add('is-plugging');

    const body = seg.paths.find((p) => p.classList.contains('intro-cord-rope--active'));
    const sheen = seg.paths.find((p) => p.classList.contains('intro-cord-rope--sheen'));
    const shadow = seg.paths.find((p) => p.classList.contains('intro-cord-rope--shadow'));
    const guide = body ?? seg.centerlinePath;
    if (!guide) {
      finish();
      return;
    }

    if (seg.knotStart) {
      seg.knotStart.setAttribute('cx', String(seg.p0.x));
      seg.knotStart.setAttribute('cy', String(seg.p0.y));
      seg.knotStart.style.opacity = '1';
    }
    if (seg.knotEnd) seg.knotEnd.style.opacity = '0';

    const len = guide.getTotalLength() || 1;
    const dashLayers = [body, sheen, shadow].filter(Boolean);
    for (const path of dashLayers) {
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
    }

    const duration = PLUG_WIRE_TRAVEL_MS;
    const start = performance.now();
    const label = cordChoiceLabel(outcome);
    let plugTooltipShown = false;

    const plugPointAt = (eased) => guide.getPointAtLength(Math.min(len, len * eased));

    const landWire = () => {
      refreshSubwayCordGeometry();
      seg.plugSettle = 0.35;
      applyCordRopePaths(cordFloatPhase);
      const endLen = guide.getTotalLength() || len;
      for (const path of dashLayers) {
        path.style.strokeDasharray = String(endLen);
        path.style.strokeDashoffset = '0';
      }
      for (const host of plugHosts) {
        host.classList.remove('is-plugging');
        host.classList.add('is-filled');
      }
      if (seg.knotEnd) {
        seg.knotEnd.setAttribute('cx', String(seg.p3.x));
        seg.knotEnd.setAttribute('cy', String(seg.p3.y));
        seg.knotEnd.style.opacity = '1';
      }

      let landingDone = !targetWrap;
      let settleDone = false;
      const tryFinish = () => {
        if (landingDone && settleDone) finish();
      };

      animateCordPlugSettle(
        seg,
        () => {
          settleDone = true;
          tryFinish();
        },
        { durationMs: PLUG_WIRE_SETTLE_MS }
      );

      if (targetWrap) {
        void animateModulePlugLanding(targetWrap, applyUnlockAtSquash, () => {
          landingDone = true;
          tryFinish();
        });
      }
    };

    const tick = (now) => {
      if (landed) return;

      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);

      const offset = len * (1 - eased);
      for (const path of dashLayers) path.style.strokeDashoffset = String(offset);

      const pt = plugPointAt(eased);
      if (label) {
        if (!plugTooltipShown) {
          plugTooltipShown = true;
          showCordTooltip(label, pt.x, pt.y);
        } else if (cordTooltipEl?.classList.contains('is-visible')) {
          updateCordTooltipPosition(pt.x, pt.y);
        }
      }

      if (t > 0.62) {
        seg.plugSettle = ((t - 0.62) / 0.38) * 0.55;
        refreshSubwayCordGeometry();
        applyCordRopePaths(cordFloatPhase);
      } else {
        applyCordRopePaths(cordFloatPhase);
      }

      if (t < 1) {
        introState.plugRaf = requestAnimationFrame(tick);
      } else {
        landWire();
      }
    };

    introState.plugRaf = requestAnimationFrame(tick);
  };

  const safetyTimer = window.setTimeout(
    finish,
    PLUG_WIRE_TRAVEL_MS + PLUG_WIRE_SETTLE_MS + MODULE_PLUG_LAND_MS + 800
  );

  measureIntroCords({ onReady: runPlugAnimation });
}

const cordRopeSegments = [];
let cordFloatRaf = 0;
let cordFloatPhase = 0;
let cordTooltipEl = null;
let cordTooltipHideTimer = 0;
let modulePathHoverId = null;
let modulePathHoverIncomingKey = null;
let modulePathHoverRouteId = null;
let modulePathHoverClearTimer = 0;
let cordEdgeHoverKey = null;
let replayOutcomeEdgeKey = null;
let replayOutcomeClearTimer = 0;
const pathHoverTooltips = new Map();
/** @type {Set<string>} */
let persistentPathEdgeKeys = new Set();
let persistentPathFocusModuleId = null;
let persistentPathSourceEdgeKey = null;

const CORD_TOOLTIP_HIDE_MS = 400;

function cordChoiceLabel(outcome) {
  return outcome?.lastChoice || outcome?.label || '';
}

function ensureCordTooltip() {
  if (!pathMapEl) return null;
  if (!cordTooltipEl) {
    cordTooltipEl = document.createElement('div');
    cordTooltipEl.className = 'intro-cord-tooltip';
    cordTooltipEl.setAttribute('role', 'tooltip');
    pathMapEl.appendChild(cordTooltipEl);
  }
  return cordTooltipEl;
}

function updateCordTooltipPosition(x, y) {
  if (!cordTooltipEl) return;
  cordTooltipEl.style.left = `${x}px`;
  cordTooltipEl.style.top = `${y}px`;
}

function hideCordTooltip() {
  clearTimeout(cordTooltipHideTimer);
  cordTooltipHideTimer = 0;
  if (!cordTooltipEl) return;
  cordTooltipEl.classList.remove('is-visible');
  window.setTimeout(() => {
    if (cordTooltipEl && !cordTooltipEl.classList.contains('is-visible')) {
      cordTooltipEl.hidden = true;
    }
  }, 200);
}

/** Incoming cords to a module (top → bottom on the target card edge). */
function getIncomingEdgesTo(moduleId) {
  const anchors = getChapterCordAnchors();
  const list = [];
  for (const [fromId, toId] of getChapterEdges()) {
    if (toId !== moduleId) continue;
    if (!isCordEdgeVisible(fromId, toId)) continue;
    const key = edgeKey(fromId, toId);
    const anchor = anchors[key] ?? {};
    list.push({
      key,
      fromId,
      toAlong: anchor.toAlong ?? 0.5
    });
  }
  list.sort((a, b) => a.toAlong - b.toAlong);
  return list;
}

function hasOutgoingEdges(moduleId) {
  return getChapterEdges().some(([fromId]) => fromId === moduleId);
}

/** Visible tubes leaving `moduleId` (topological out-degree on the path map). */
function getOutgoingVisibleEdgeKeys(moduleId) {
  const keys = [];
  for (const [fromId, toId] of getChapterEdges()) {
    if (fromId !== moduleId) continue;
    if (!isCordEdgeVisible(fromId, toId)) continue;
    keys.push(edgeKey(fromId, toId));
  }
  return keys;
}

/** Played tubes leaving `moduleId`. */
function getOutgoingFilledEdgesFrom(moduleId) {
  return getOutgoingVisibleEdgeKeys(moduleId).filter((key) => isEdgeFilled(key));
}

/** Edge filled last among `keys` (progress fill order). */
function pickMostRecentEdgeKey(keys) {
  if (!keys?.length) return null;
  const filled = getFilledEdgeKeys();
  let pick = keys[0];
  let pickIdx = filled.indexOf(pick);
  for (const key of keys) {
    const idx = filled.indexOf(key);
    if (idx > pickIdx) {
      pickIdx = idx;
      pick = key;
    }
  }
  return pick;
}

/** Final / hub finish nodes — hover highlights only the incoming tube, not the whole graph. */
function isTerminalPathModule(moduleId) {
  return !hasOutgoingEdges(moduleId);
}

function pickIncomingEdgeByPointer(wrap, incoming, clientY) {
  if (!incoming.length) return null;
  if (incoming.length === 1) return incoming[0].key;
  const card = wrap.querySelector('.module-card') ?? wrap;
  const rect = card.getBoundingClientRect();
  if (rect.height < 1) return incoming[0].key;
  const t = Math.max(0, Math.min(0.999, (clientY - rect.top) / rect.height));
  const idx = Math.min(incoming.length - 1, Math.floor(t * incoming.length));
  return incoming[idx].key;
}

/** @param {HTMLElement} wrap @param {{ id: string, along?: number }[]} variants @param {number} clientY */
function pickRouteVariantByPointer(wrap, variants, clientY) {
  if (!variants.length) return null;
  const card = wrap.querySelector('.module-card') ?? wrap;
  const rect = card.getBoundingClientRect();
  if (rect.height < 1) return variants[0].id;
  const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  let best = variants[0];
  let bestDist = Infinity;
  for (const variant of variants) {
    const along = variant.along ?? 0.5;
    const dist = Math.abs(along - t);
    if (dist < bestDist) {
      bestDist = dist;
      best = variant;
    }
  }
  return best.id;
}

/** Drop unfilled tubes and any edge/module that touches a locked chapter. */
function filterPlayablePathEdgeKeys(edgeKeys) {
  const out = new Set();
  for (const key of edgeKeys) {
    if (!isEdgeFilled(key)) continue;
    const [from, to] = key.split('|');
    const fromMod = moduleById(from);
    const toMod = moduleById(to);
    if (!fromMod || !toMod || fromMod.locked || toMod.locked) continue;
    out.add(key);
  }
  const { onPath } = pathHoverModuleSets(out, null);
  for (const id of onPath) {
    const mod = moduleById(id);
    if (!mod || mod.locked) return new Set();
  }
  return out;
}

/** Single-tube hover — played edge only; destination may still be locked. */
function filterCordHoverEdgeKeys(edgeKeys) {
  const out = new Set();
  for (const key of edgeKeys) {
    if (!isEdgeFilled(key)) continue;
    const [from, to] = key.split('|');
    if (!isCordEdgeVisible(from, to)) continue;
    const fromMod = moduleById(from);
    if (!fromMod || fromMod.locked) continue;
    out.add(key);
  }
  return out;
}

/** Route variants where every tube was played and no locked chapter sits on the path. */
function getTakenRouteVariants(moduleId) {
  const variants = getPathRouteVariants(moduleId);
  if (!variants?.length) return [];
  return variants.filter((variant) => {
    const keys = new Set(variant.edges);
    return variant.edges.every((k) => isEdgeFilled(k)) && filterPlayablePathEdgeKeys(keys).size === keys.size;
  });
}

/** Filled upstream path for one incoming branch into `moduleId`. */
function getFilledEdgesForIncoming(incomingKey) {
  const [fromId] = incomingKey.split('|');
  const keys = new Set();
  if (isEdgeFilled(incomingKey)) keys.add(incomingKey);
  for (const k of getFilledEdgesLeadingTo(fromId)) keys.add(k);
  return keys;
}

/** Most recently filled upstream route into the next chapter (fill order in progress state). */
function getRecentPathEdgeKeys(targetModuleId = null) {
  const target = targetModuleId ?? introState.nextPlayModuleId ?? resolveNextPlayModuleId();
  if (!target) return new Set();

  const filled = getFilledEdgeKeys();
  const keys = new Set();
  let current = target;
  const visited = new Set();

  while (current && !visited.has(current)) {
    visited.add(current);
    const incoming = filled.filter((key) => key.split('|')[1] === current);
    if (!incoming.length) break;

    let pick = incoming[0];
    let pickIdx = filled.indexOf(pick);
    for (const key of incoming) {
      const idx = filled.indexOf(key);
      if (idx > pickIdx) {
        pickIdx = idx;
        pick = key;
      }
    }

    keys.add(pick);
    current = pick.split('|')[0];
  }

  return keys;
}

/** Filled edge keys on the path the player actually took into `moduleId`. */
function getFilledEdgesLeadingTo(moduleId) {
  const keys = new Set();
  const byTarget = new Map();

  for (const key of getFilledEdgeKeys()) {
    const [from, to] = key.split('|');
    if (!from || !to) continue;
    if (!byTarget.has(to)) byTarget.set(to, []);
    byTarget.get(to).push({ from, key });
  }

  const queue = [moduleId];
  const seen = new Set([moduleId]);
  while (queue.length) {
    const to = queue.shift();
    for (const { from, key } of byTarget.get(to) ?? []) {
      keys.add(key);
      if (!seen.has(from)) {
        seen.add(from);
        queue.push(from);
      }
    }
  }
  return keys;
}

function pathHoverModuleSets(edgeKeys, focusModuleId) {
  const onPath = new Set();
  const fromIds = new Set();
  if (focusModuleId) onPath.add(focusModuleId);
  for (const key of edgeKeys) {
    const [from, to] = key.split('|');
    if (from) {
      fromIds.add(from);
      onPath.add(from);
    }
    if (to) onPath.add(to);
  }
  return { onPath, fromIds };
}

function moduleIdsFromEdgeKeys(edgeKeys, focusModuleId) {
  return pathHoverModuleSets(edgeKeys, focusModuleId).onPath;
}

/** Module the highlighted tube exits from (direct parent of hover target). */
function pathHoverSourceModuleId(displayKeys, focusModuleId, incomingEdgeKey) {
  if (incomingEdgeKey) {
    const [from] = incomingEdgeKey.split('|');
    return from || null;
  }
  const edgeKeys = displayKeys instanceof Set ? displayKeys : new Set(displayKeys);
  for (const key of edgeKeys) {
    const [from, to] = key.split('|');
    if (to === focusModuleId && from) return from;
  }
  return null;
}

function resolvePathHoverSourceEdge(
  moduleId,
  { multiIngress, multiRoute, routeVariants, selectedRouteId, selectedKey, incoming }
) {
  if (multiIngress && selectedKey) return selectedKey;
  if (multiRoute && selectedRouteId) {
    const variant = routeVariants.find((v) => v.id === selectedRouteId) ?? routeVariants[0];
    return (
      variant.edges.find((key) => key.split('|')[1] === moduleId) ??
      variant.edges[variant.edges.length - 1] ??
      null
    );
  }
  if (incoming.length === 1) return incoming[0].key;
  return null;
}

function syncPathHoverModuleClasses(displayKeys, focusModuleId, incomingEdgeKey = null) {
  if (!pathMapEl) return;
  const edgeKeys = displayKeys instanceof Set ? displayKeys : new Set(displayKeys);
  const { onPath } = pathHoverModuleSets(edgeKeys, focusModuleId);
  const sourceId = pathHoverSourceModuleId(edgeKeys, focusModuleId, incomingEdgeKey);

  pathMapEl.querySelectorAll('.intro-module-wrap[data-module-anchor]').forEach((wrap) => {
    const id = wrap.dataset.moduleAnchor;
    const isFocus = id === focusModuleId;
    const card = wrap.querySelector('.module-card');
    wrap.classList.toggle('is-path-hover-focus', isFocus);
    wrap.classList.toggle('is-path-hover-source', id === sourceId && !isFocus);
    wrap.classList.toggle('is-path-hover-dim', !onPath.has(id));
    if (card && (isCorporateSkin() || isSpaceSkin())) {
      card.classList.toggle('is-hover-pop', isFocus);
    }
  });
}

function clearPathHoverModuleClasses() {
  pathMapEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.remove(
      'is-path-hover-focus',
      'is-path-hover-source',
      'is-path-hover-dim',
      'is-path-hover-from'
    );
    wrap.querySelector('.module-card')?.classList.remove('is-hover-pop');
  });
}

function setCordPathHighlight(edgeKeyStr, highlight, filled = false) {
  if (!connectorsEl || !edgeKeyStr) return;
  connectorsEl.querySelectorAll(`[data-cord-edge="${edgeKeyStr}"]`).forEach((host) => {
    host.classList.toggle('is-path-highlight', highlight);
    host.classList.toggle('is-path-highlight--played', highlight && filled);
  });
}

function setCordReplayPulse(edgeKeyStr, on) {
  if (!connectorsEl || !edgeKeyStr) return;
  connectorsEl.querySelectorAll(`[data-cord-edge="${edgeKeyStr}"]`).forEach((host) => {
    host.classList.toggle('is-replay-outcome-pulse', on);
  });
}

function clearReplayOutcomeFeedback({ keepHover = false } = {}) {
  clearTimeout(replayOutcomeClearTimer);
  replayOutcomeClearTimer = 0;
  if (replayOutcomeEdgeKey) {
    setCordReplayPulse(replayOutcomeEdgeKey, false);
    if (!keepHover && !modulePathHoverId && !cordEdgeHoverKey) {
      setCordPathHighlight(replayOutcomeEdgeKey, false);
    }
    replayOutcomeEdgeKey = null;
  }
  pathMapEl?.classList.remove('is-replay-outcome-active');
  if (!keepHover && !modulePathHoverId && !cordEdgeHoverKey) {
    hidePathHoverTooltips();
  }
}

/** After a replay, pulse the sole outgoing tube and show the latest decision label. */
function showReplayOutcomeFeedback(moduleId, outcome) {
  if (!pathMapEl || introState.plugActive || introState.pluggingEdge) return;

  const outgoingFilled = getOutgoingFilledEdgesFrom(moduleId);
  if (!outgoingFilled.length) return;

  const fromPlay = (outcome.fills ?? []).filter((key) => key.startsWith(`${moduleId}|`));
  const focusKey =
    fromPlay[fromPlay.length - 1] ?? pickMostRecentEdgeKey(outgoingFilled);
  if (!focusKey || !getEdgeHoverLabel(focusKey)) return;

  clearReplayOutcomeFeedback({ keepHover: Boolean(modulePathHoverId || cordEdgeHoverKey) });

  replayOutcomeEdgeKey = focusKey;
  const soleOutgoing = getOutgoingVisibleEdgeKeys(moduleId).length === 1;
  if (soleOutgoing) setCordReplayPulse(focusKey, true);

  pathMapEl.classList.add('is-replay-outcome-active');
  setCordPathHighlight(focusKey, true, true);
  showPathHoverTooltipsForEdges(new Set([focusKey]));

  const { toId } = parseEdgeKey(focusKey);
  syncPathHoverModuleClasses(new Set([focusKey]), toId || moduleId, focusKey);

  replayOutcomeClearTimer = window.setTimeout(() => {
    clearReplayOutcomeFeedback();
  }, 4800);
}

/** Tooltip keys for module hover — prefer the latest decision on an outgoing tube. */
function moduleHoverTooltipEdgeKeys(moduleId, filledKeys) {
  const outgoingFilled = getOutgoingFilledEdgesFrom(moduleId);
  if (!outgoingFilled.length) return filledKeys;
  const recent = pickMostRecentEdgeKey(outgoingFilled);
  return recent ? new Set([recent]) : filledKeys;
}

function ensurePathHoverTooltipLayer() {
  if (!pathMapEl) return null;
  let layer = pathMapEl.querySelector('.intro-path-hover-tooltips');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'intro-path-hover-tooltips';
    layer.setAttribute('aria-hidden', 'true');
    pathMapEl.appendChild(layer);
  }
  return layer;
}

function hidePathHoverTooltips() {
  for (const el of pathHoverTooltips.values()) {
    el.style.transition = 'none';
    el.classList.remove('is-visible');
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    el.hidden = true;
  }
}

function cordMidpointForTooltip(seg) {
  const body =
    seg.centerlinePath ?? seg.paths?.find((p) => p.classList.contains('intro-cord-rope--active'));
  if (!body) return null;
  const len = body.getTotalLength();
  if (!len) return null;
  return body.getPointAtLength(len * 0.42);
}

function showPathHoverTooltipsForEdges(edgeKeys) {
  const layer = ensurePathHoverTooltipLayer();
  if (!layer) return;
  hideCordTooltip();

  const activeKeys = new Set();
  for (const seg of cordRopeSegments) {
    if (!edgeKeys.has(seg.key)) continue;
    const label = getEdgeHoverLabel(seg.key);
    if (!label) continue;

    const pt = cordMidpointForTooltip(seg);
    if (!pt) continue;

    activeKeys.add(seg.key);
    let el = pathHoverTooltips.get(seg.key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'intro-cord-tooltip intro-cord-tooltip--path-hover';
      el.setAttribute('role', 'tooltip');
      layer.appendChild(el);
      pathHoverTooltips.set(seg.key, el);
    }
    el.textContent = label;
    el.style.left = `${pt.x}px`;
    el.style.top = `${pt.y}px`;
    el.style.removeProperty('transition');
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-visible'));
  }

  for (const [key, el] of pathHoverTooltips) {
    if (activeKeys.has(key)) continue;
    el.classList.remove('is-visible');
    el.hidden = true;
  }
}

function reapplyPersistentPathHighlights() {
  /* Path highlight is hover-driven for all cheat modes — no map-wide persistent tubes. */
}

function syncPersistentPathHighlights() {
  persistentPathEdgeKeys = new Set();
  persistentPathFocusModuleId = null;
  persistentPathSourceEdgeKey = null;

  if (!pathMapEl || !isCorporateSkin()) {
    pathMapEl?.classList.remove('is-path-highlight-persistent');
    pathMapEl?.removeAttribute('data-path-highlight-mode');
    return;
  }

  pathMapEl.dataset.pathHighlightMode = getPathHighlightMode();
  pathMapEl.classList.remove('is-path-highlight-persistent');

  if (!modulePathHoverId) {
    connectorsEl?.querySelectorAll('[data-cord-edge].is-path-highlight, .intro-cord.is-path-highlight').forEach(
      (cord) => {
        cord.classList.remove('is-path-highlight', 'is-path-highlight--played');
      }
    );
    clearPathHoverModuleClasses();
  }
}

function clearModulePathHover() {
  clearTimeout(modulePathHoverClearTimer);
  modulePathHoverClearTimer = 0;
  modulePathHoverId = null;
  modulePathHoverIncomingKey = null;
  modulePathHoverRouteId = null;
  cordEdgeHoverKey = null;
  pathMapEl?.classList.remove('is-module-path-hover', 'is-cord-edge-hover');
  pathMapEl?.removeAttribute('data-path-hover-module');
  pathMapEl?.removeAttribute('data-path-hover-edge');
  pathMapEl?.removeAttribute('data-path-hover-route');
  connectorsEl?.querySelectorAll('[data-cord-edge].is-path-highlight, .intro-cord.is-path-highlight').forEach(
    (cord) => {
      cord.classList.remove('is-path-highlight', 'is-path-highlight--played');
    }
  );
  clearPathHoverModuleClasses();
  hidePathHoverTooltips();
  reapplyPersistentPathHighlights();
}

/** Recent / all-opened — highlight paths into the hovered chapter only (no local ingress scrub). */
function applyChapterTargetPathHover(moduleId, mode) {
  let displayKeys =
    mode === 'recent'
      ? getRecentPathEdgeKeys(moduleId)
      : filterPlayablePathEdgeKeys(getFilledEdgesLeadingTo(moduleId));

  displayKeys = filterPlayablePathEdgeKeys(displayKeys);
  if (!displayKeys.size) {
    clearModulePathHover();
    return;
  }

  if (isCorporateSkin() || isSpaceSkin()) playModuleHoverClick();

  modulePathHoverId = moduleId;
  modulePathHoverIncomingKey = null;
  modulePathHoverRouteId = null;

  let sourceEdgeKey = null;
  for (const key of displayKeys) {
    if (key.split('|')[1] === moduleId) {
      sourceEdgeKey = key;
      if (mode === 'recent') break;
    }
  }

  pathMapEl?.classList.add('is-module-path-hover');
  pathMapEl?.setAttribute('data-path-hover-module', moduleId);
  pathMapEl?.removeAttribute('data-path-hover-edge');
  pathMapEl?.removeAttribute('data-path-hover-route');

  connectorsEl?.querySelectorAll('.intro-cord[data-edge], .intro-cord[data-cord-edge]').forEach((cord) => {
    const key = cord.dataset.edge || cord.dataset.cordEdge;
    if (!key) return;
    const onPath = displayKeys.has(key);
    setCordPathHighlight(key, onPath, onPath && cord.classList.contains('is-filled'));
  });

  syncPathHoverModuleClasses(displayKeys, moduleId, sourceEdgeKey);
  showPathHoverTooltipsForEdges(displayKeys);
}

/** Hover one played tube — highlight only that segment and show its decision. */
function setCordEdgeHover(edgeKey) {
  if (!edgeKey || !pathMapEl || introState.plugActive || introState.pluggingEdge || introState.handoffRunning) {
    return;
  }

  const displayKeys = filterCordHoverEdgeKeys(new Set([edgeKey]));
  if (!displayKeys.size) {
    clearModulePathHover();
    return;
  }

  clearTimeout(modulePathHoverClearTimer);
  modulePathHoverClearTimer = 0;
  modulePathHoverId = null;
  modulePathHoverIncomingKey = null;
  modulePathHoverRouteId = null;
  cordEdgeHoverKey = edgeKey;

  if (isCorporateSkin() || isSpaceSkin()) playModuleHoverClick();

  const { toId } = parseEdgeKey(edgeKey);
  pathMapEl.classList.add('is-module-path-hover', 'is-cord-edge-hover');
  pathMapEl.setAttribute('data-path-hover-edge', edgeKey);
  pathMapEl.removeAttribute('data-path-hover-module');
  pathMapEl.removeAttribute('data-path-hover-route');
  hideCordTooltip();

  connectorsEl?.querySelectorAll('.intro-cord[data-edge], .intro-cord[data-cord-edge]').forEach((cord) => {
    const key = cord.dataset.edge || cord.dataset.cordEdge;
    if (!key) return;
    const onPath = displayKeys.has(key);
    setCordPathHighlight(key, onPath, cord.classList.contains('is-filled'));
  });

  syncPathHoverModuleClasses(displayKeys, toId, edgeKey);
  showPathHoverTooltipsForEdges(displayKeys);
}

function setModulePathHover(
  moduleId,
  { incomingEdgeKey = null, routeVariantId = null, clientY = null } = {}
) {
  if (!moduleId || introState.plugActive || introState.pluggingEdge || introState.handoffRunning) {
    clearModulePathHover();
    return;
  }

  clearReplayOutcomeFeedback({ keepHover: true });

  const mod = moduleById(moduleId);
  if (!mod || mod.locked) {
    clearModulePathHover();
    return;
  }

  clearTimeout(modulePathHoverClearTimer);
  modulePathHoverClearTimer = 0;

  const highlightMode = getPathHighlightMode();
  if (highlightMode === 'recent' || highlightMode === 'completed') {
    applyChapterTargetPathHover(moduleId, highlightMode);
    return;
  }

  const wrap = pathMapEl?.querySelector(`[data-module-anchor="${moduleId}"]`);
  const incoming = getIncomingEdgesTo(moduleId);
  const routeVariants = getTakenRouteVariants(moduleId);
  const multiRoute = routeVariants.length > 1;
  const filledIncoming = incoming.filter((inc) => {
    const branch = filterPlayablePathEdgeKeys(getFilledEdgesForIncoming(inc.key));
    return branch.size > 0 && branch.has(inc.key);
  });
  const multiIngress = filledIncoming.length > 1 && !multiRoute;

  let selectedKey = incomingEdgeKey;
  if (multiIngress && !selectedKey && wrap && clientY != null) {
    selectedKey = pickIncomingEdgeByPointer(wrap, filledIncoming, clientY);
  }
  if (multiIngress && !selectedKey && wrap) {
    selectedKey = pickIncomingEdgeByPointer(
      wrap,
      filledIncoming,
      wrap.getBoundingClientRect().top + 1
    );
  }

  let selectedRouteId = routeVariantId;
  if (multiRoute && !selectedRouteId && wrap && clientY != null) {
    selectedRouteId = pickRouteVariantByPointer(wrap, routeVariants, clientY);
  }
  if (multiRoute && !selectedRouteId) {
    selectedRouteId = routeVariants[0].id;
  }

  const hoverIncomingKey =
    multiIngress || filledIncoming.length === 1
      ? selectedKey ?? filledIncoming[0]?.key ?? null
      : null;
  if (
    modulePathHoverId === moduleId &&
    modulePathHoverIncomingKey === hoverIncomingKey &&
    modulePathHoverRouteId === (multiRoute ? selectedRouteId : null)
  ) {
    return;
  }

  if (isCorporateSkin() || isSpaceSkin()) playModuleHoverClick();

  modulePathHoverId = moduleId;
  modulePathHoverIncomingKey = hoverIncomingKey;
  modulePathHoverRouteId = multiRoute ? selectedRouteId : null;

  let filledKeys = new Set();
  let displayKeys = new Set();

  if (multiRoute && selectedRouteId) {
    const variant = routeVariants.find((v) => v.id === selectedRouteId) ?? routeVariants[0];
    displayKeys = filterPlayablePathEdgeKeys(new Set(variant.edges));
    filledKeys = new Set(displayKeys);
  } else if (multiIngress && selectedKey) {
    displayKeys = filterPlayablePathEdgeKeys(getFilledEdgesForIncoming(selectedKey));
    filledKeys = new Set(displayKeys);
  } else if (
    (isCorporateSkin() || isSpaceSkin()) &&
    isTerminalPathModule(moduleId) &&
    !multiRoute &&
    filledIncoming.length >= 1
  ) {
    const localKey = hoverIncomingKey ?? filledIncoming[0]?.key;
    displayKeys = localKey ? filterPlayablePathEdgeKeys(new Set([localKey])) : new Set();
    filledKeys = new Set(displayKeys);
  } else {
    displayKeys = filterPlayablePathEdgeKeys(getFilledEdgesLeadingTo(moduleId));
    filledKeys = new Set(displayKeys);
  }

  if (!displayKeys.size) {
    clearModulePathHover();
    return;
  }

  pathMapEl?.classList.add('is-module-path-hover');
  pathMapEl?.setAttribute('data-path-hover-module', moduleId);
  if (selectedKey) pathMapEl?.setAttribute('data-path-hover-edge', selectedKey);
  else pathMapEl?.removeAttribute('data-path-hover-edge');
  if (selectedRouteId) pathMapEl?.setAttribute('data-path-hover-route', selectedRouteId);
  else pathMapEl?.removeAttribute('data-path-hover-route');

  connectorsEl?.querySelectorAll('.intro-cord[data-edge], .intro-cord[data-cord-edge]').forEach((cord) => {
    const key = cord.dataset.edge || cord.dataset.cordEdge;
    if (!key) return;
    const onPath = displayKeys.has(key);
    const filled = cord.classList.contains('is-filled');
    const highlight = onPath && filled;
    setCordPathHighlight(key, highlight, highlight);
  });

  const sourceEdgeKey = resolvePathHoverSourceEdge(moduleId, {
    multiIngress,
    multiRoute,
    routeVariants,
    selectedRouteId,
    selectedKey,
    incoming: filledIncoming
  });
  const tooltipKeys = moduleHoverTooltipEdgeKeys(moduleId, filledKeys);
  for (const key of tooltipKeys) {
    if (!displayKeys.has(key)) {
      displayKeys.add(key);
      setCordPathHighlight(key, true, true);
    }
  }

  syncPathHoverModuleClasses(displayKeys, moduleId, sourceEdgeKey);
  showPathHoverTooltipsForEdges(tooltipKeys);
}

/** @param {EventTarget | null} related */
function isPathHoverHandoffTarget(related) {
  if (!(related instanceof Element)) return false;
  if (related.closest('.intro-module-wrap[data-module-anchor]')) return true;
  if (related.closest('.intro-connectors__layer--hit')) return true;
  return false;
}

function scheduleClearModulePathHover() {
  clearModulePathHover();
}

function bindModulePathHover(wrap, moduleId) {
  const useLocalIngress = () => {
    if (getPathHighlightMode() !== 'hover') return false;
    const routeVariants = getTakenRouteVariants(moduleId);
    if (routeVariants.length > 1) return true;
    const incoming = getIncomingEdgesTo(moduleId);
    const filledIncoming = incoming.filter((inc) => {
      const branch = filterPlayablePathEdgeKeys(getFilledEdgesForIncoming(inc.key));
      return branch.size > 0 && branch.has(inc.key);
    });
    return filledIncoming.length > 1;
  };

  const onPointer = (e) => {
    const mod = moduleById(moduleId);
    if (!mod || mod.locked) {
      clearModulePathHover();
      return;
    }
    if (useLocalIngress()) {
      setModulePathHover(moduleId, { clientY: e.clientY });
    } else {
      setModulePathHover(moduleId);
    }
  };
  const onLeave = (e) => {
    if (wrap.contains(e.relatedTarget)) return;
    if (isPathHoverHandoffTarget(e.relatedTarget)) return;
    clearModulePathHover();
  };

  wrap.addEventListener('mouseenter', onPointer);
  wrap.addEventListener('mousemove', onPointer);
  wrap.addEventListener('mouseleave', onLeave);
  wrap.addEventListener('focusin', onPointer);
  wrap.addEventListener('focusout', onLeave);
}

function wireModulePathHoverMap() {
  if (!pathMapEl || pathMapEl.dataset.pathHoverWired) return;
  pathMapEl.dataset.pathHoverWired = '1';

  pathMapEl.addEventListener('mouseleave', (e) => {
    if (isPathHoverHandoffTarget(e.relatedTarget)) return;
    clearModulePathHover();
  });
}

function showCordTooltip(text, x, y, { persist = false } = {}) {
  const el = ensureCordTooltip();
  if (!el || !text) return;
  clearTimeout(cordTooltipHideTimer);
  el.textContent = text;
  updateCordTooltipPosition(x, y);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-visible'));
  if (!persist) {
    cordTooltipHideTimer = window.setTimeout(hideCordTooltip, CORD_TOOLTIP_HIDE_MS);
  }
}

let cordDragSeg = null;

function pointerOnCordPath(pathEl, clientX, clientY) {
  const ctm = pathEl.getScreenCTM();
  if (!ctm) return null;
  const pt = connectorsEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  const len = pathEl.getTotalLength();
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * len;
    const p = pathEl.getPointAtLength(t);
    const d = (p.x - local.x) ** 2 + (p.y - local.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return pathEl.getPointAtLength(bestT);
}

function bindCordHitTooltip(seg) {
  if (!seg.hitPath) return;
  const { toId } = parseEdgeKey(seg.key);
  const body = () =>
    seg.centerlinePath ?? seg.paths.find((p) => p.classList.contains('intro-cord-rope--active'));

  const onCordPointerMove = (e) => {
    const active = body();
    if (!active) return;

    if (cordDragSeg === seg && seg.stretch) {
      const pt = pointerOnCordPath(active, e.clientX, e.clientY);
      if (!pt) return;
      const mid = active.getPointAtLength(active.getTotalLength() * 0.42);
      seg.stretch.tx = pt.x;
      seg.stretch.ty = pt.y;
      seg.stretch.tAmt = Math.min(1, Math.hypot(pt.x - mid.x, pt.y - mid.y) / 52);
      applyCordRopePaths(cordFloatPhase);
      return;
    }

    if (isEdgeFilled(seg.key)) setCordEdgeHover(seg.key);
  };

  seg.hitPath.addEventListener('pointerenter', onCordPointerMove);
  seg.hitPath.addEventListener('pointermove', onCordPointerMove);

  seg.hitPath.addEventListener('pointerdown', (e) => {
    if (introState.plugActive || introState.pluggingEdge) return;
    const active = body();
    if (!active) return;
    cordDragSeg = seg;
    seg.stretch ??= { x: 0, y: 0, amt: 0, tx: 0, ty: 0, tAmt: 0 };
    const pt = pointerOnCordPath(active, e.clientX, e.clientY);
    if (pt) {
      seg.stretch.tx = pt.x;
      seg.stretch.ty = pt.y;
      seg.stretch.tAmt = 0.32;
    }
    seg.hitPath.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  const endCordDrag = (e) => {
    if (cordDragSeg !== seg) return;
    if (seg.stretch) {
      seg.stretch.tAmt = 0;
      seg.stretch.tx = seg.stretch.x;
      seg.stretch.ty = seg.stretch.y;
    }
    cordDragSeg = null;
    try {
      seg.hitPath.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    hideCordTooltip();
    if (!introState.plugActive && !introState.pluggingEdge) startCordFloat();
  };

  seg.hitPath.addEventListener('pointerup', endCordDrag);
  seg.hitPath.addEventListener('pointercancel', endCordDrag);
  seg.hitPath.addEventListener('pointerleave', (e) => {
    if (cordDragSeg === seg) return;
    if (e.relatedTarget instanceof Element) {
      if (e.relatedTarget.closest(`[data-module-anchor="${toId}"]`)) return;
      if (e.relatedTarget.closest('.intro-connectors__layer--hit')) return;
    }
    if (isCorporateSkin() || isSpaceSkin()) clearModulePathHover();
    hideCordTooltip();
  });
}

function ensureCordDefs() {
  if (connectorsEl.querySelector('#intro-cord-defs')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.id = 'intro-cord-defs';
  defs.innerHTML = `
    <filter id="intro-cord-rope-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.8" />
    </filter>
  `;
  connectorsEl.appendChild(defs);
}

function ropePathOptions(seg, phase) {
  const stretch = seg.stretch;
  const stretchPull =
    stretch && stretch.amt > 0.001 ? { x: stretch.x, y: stretch.y, amt: stretch.amt } : null;

  return {
    ...seg.anchorOpts,
    phase,
    phaseOffset: seg.phaseOffset,
    sagOffset: seg.sagOffset,
    breezePhase: phase * 0.88 + (seg.breezeSeed ?? 0),
    plugSettle: seg.plugSettle ?? 0,
    stretchPull,
    reveal: seg.bridgeReveal ?? 1
  };
}

function ropePathD(seg, phase) {
  if (seg.isSubway) {
    return subwayCordPathD(seg.p0, seg.fromSide, seg.p3, seg.toSide, seg.anchorOpts);
  }
  const opts = ropePathOptions(seg, phase);
  return cordPathD(seg.p0, seg.fromSide, seg.p3, seg.toSide, opts);
}

function ropeCenterlinePathD(seg, phase) {
  if (seg.isSubway) {
    return subwayCordPathD(seg.p0, seg.fromSide, seg.p3, seg.toSide, seg.anchorOpts);
  }
  return cordPathD(seg.p0, seg.fromSide, seg.p3, seg.toSide, ropePathOptions(seg, phase));
}

function updateCordStretchPhysics() {
  for (const seg of cordRopeSegments) {
    if (!seg.stretch) continue;
    const s = seg.stretch;
    s.x += (s.tx - s.x) * 0.24;
    s.y += (s.ty - s.y) * 0.24;
    s.amt += (s.tAmt - s.amt) * 0.2;
    if (s.tAmt < 0.001 && s.amt < 0.001) {
      s.x *= 0.82;
      s.y *= 0.82;
    }
  }
}

function applyCordRopePaths(phase = cordFloatPhase) {
  updateCordStretchPhysics();
  for (const seg of cordRopeSegments) {
    if (seg.isSubway) {
      const d = ropePathD(seg, phase);
      for (const path of seg.paths) path.setAttribute('d', d);
      if (seg.centerlinePath) seg.centerlinePath.setAttribute('d', d);
      if (seg.hitPath) seg.hitPath.setAttribute('d', d);
      continue;
    }
    const d = ropePathD(seg, phase);
    for (const path of seg.paths) path.setAttribute('d', d);
    if (seg.centerlinePath) seg.centerlinePath.setAttribute('d', ropeCenterlinePathD(seg, phase));
    if (seg.hitPath) {
      seg.hitPath.setAttribute('d', d);
    }
    if (seg.knotStart) {
      seg.knotStart.setAttribute('cx', String(seg.p0.x));
      seg.knotStart.setAttribute('cy', String(seg.p0.y));
    }
    if (seg.knotEnd) {
      seg.knotEnd.setAttribute('cx', String(seg.p3.x));
      seg.knotEnd.setAttribute('cy', String(seg.p3.y));
    }
  }
}

function stopCordFloat() {
  if (cordFloatRaf) cancelAnimationFrame(cordFloatRaf);
  cordFloatRaf = 0;
}

function applyPlugLandTransform(card, scale, translateX = 0) {
  card.style.transform = `translate3d(${translateX}px, 0, 0) scale(${scale})`;
  card.style.transformOrigin = 'center center';
}

function clearPlugLandTransform(card) {
  card.style.transform = '';
  card.style.transformOrigin = '';
  card.style.willChange = '';
}

/** Shake → ease up to 1.2 → ease down to 0.9 (unlock) → ease settle to 1.0. */
async function animateModulePlugLanding(targetWrap, onUnlockAtSquash, onComplete) {
  const card = targetWrap?.querySelector('.module-card');
  if (!targetWrap || !card) {
    onUnlockAtSquash?.();
    onComplete?.();
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  targetWrap.classList.remove('is-plug-target');
  targetWrap.classList.add('is-plug-landing');

  if (reduced) {
    onUnlockAtSquash?.();
    targetWrap.classList.remove('is-plug-landing');
    card.classList.remove('is-plug-landing');
    onComplete?.();
    return;
  }

  card.classList.add('is-plug-landing');
  card.style.willChange = 'transform';

  try {
    let scale = 1;
    await tweenLeaderboard(PLUG_LAND_SHAKE_MS, [0.25, 1, 0.45, 1], (t) => {
      const wobble = Math.sin(t * Math.PI * 2.75) * (1 - t) * 4.5;
      scale = lerp(1, 1.06, easeOutCubic(t));
      applyPlugLandTransform(card, scale, wobble);
    });

    const riseFrom = scale;
    await tweenLeaderboard(PLUG_LAND_RISE_MS, PLUG_LAND_RISE_EASE, (t) => {
      scale = lerp(riseFrom, 1.2, easeOutBack(t));
      applyPlugLandTransform(card, scale, 0);
    });

    const squashFrom = scale;
    await tweenLeaderboard(PLUG_LAND_SQUASH_MS, PLUG_LAND_SQUASH_EASE, (t) => {
      scale = lerp(squashFrom, 0.9, easeInOutCubic(t));
      applyPlugLandTransform(card, scale, 0);
    });

    onUnlockAtSquash?.();

    await tweenLeaderboard(PLUG_LAND_HOLD_MS, [0, 0, 1, 1], () => {
      applyPlugLandTransform(card, 0.9, 0);
    });

    const settleFrom = 0.9;
    await tweenLeaderboard(PLUG_LAND_SETTLE_MS, PLUG_LAND_SETTLE_EASE, (t) => {
      scale = lerp(settleFrom, 1, easeOutBack(t));
      applyPlugLandTransform(card, scale, 0);
    });
  } finally {
    clearPlugLandTransform(card);
    card.classList.remove('is-plug-landing');
    targetWrap.classList.remove('is-plug-landing');
    onComplete?.();
  }
}

function animateCordPlugSettle(seg, onDone, { durationMs = 540 } = {}) {
  const from = seg.plugSettle ?? 0;
  const start = performance.now();
  const duration = durationMs;

  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    seg.plugSettle = from + (1 - from) * easeOutBack(t);
    applyCordRopePaths(cordFloatPhase);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      seg.plugSettle = 1;
      applyCordRopePaths(cordFloatPhase);
      onDone?.();
    }
  };

  requestAnimationFrame(tick);
}

function startCordFloat() {
  if (cordFloatRaf) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (revealedModuleCount(introState.progress) < 1) return;
  if (cordRopeSegments.some((s) => s.isSubway)) return;

  const tick = (now) => {
    if (!cordRopeSegments.length) {
      stopCordFloat();
      return;
    }
    cordFloatPhase = now * 0.00068;
    applyCordRopePaths(cordFloatPhase);
    cordFloatRaf = requestAnimationFrame(tick);
  };
  cordFloatRaf = requestAnimationFrame(tick);
}

function measureIntroCords({ onReady } = {}) {
  if (!pathMapEl || !connectorsEl || !gridEl) {
    onReady?.();
    return;
  }

  if (introState.pluggingEdge && !onReady) return;

  ensurePathMapStage();
  stopCordFloat();
  cordRopeSegments.length = 0;

  const mapRect = pathMapEl.getBoundingClientRect();

  for (const [fromId, toId] of getChapterEdges()) {
    if (!isCordEdgeVisible(fromId, toId)) continue;

    const fromWrap = pathMapEl.querySelector(`[data-module-anchor="${fromId}"]`);
    const toWrap = pathMapEl.querySelector(`[data-module-anchor="${toId}"]`);
    if (!fromWrap || !toWrap) continue;

    const key = edgeKey(fromId, toId);
    const anchorOpts = cordAnchorsForKey(key);
    const fromRect = moduleAnchorRect(fromId);
    const toRect = moduleAnchorRect(toId);
    if (!fromRect || !toRect) continue;
    const p0 = anchorFromRect(fromRect, anchorOpts.from, mapRect, anchorOpts.fromAlong ?? 0.5);
    const p3 = anchorFromRect(toRect, anchorOpts.to, mapRect, anchorOpts.toAlong ?? 0.5);

    const filled = isEdgeFilled(key);
    const isSubway = isCorporateSkin();
    cordRopeSegments.push({
      key,
      p0,
      p3,
      fromSide: anchorOpts.from,
      toSide: anchorOpts.to,
      anchorOpts,
      isSubway,
      phaseOffset: cordPhaseOffset(key),
      sagOffset: cordPhaseOffset(`${key}-sag`),
      breezeSeed: cordPhaseOffset(`${key}-breeze`),
      plugSettle: filled ? 1 : 0,
      stretch: null,
      paths: [],
      centerlinePath: null,
      hitPath: null,
      knotStart: null,
      knotEnd: null
    });
  }

  applySubwayLaneBundles(cordRopeSegments, { cardSizePx: pathCardSizePx() });
  const midPitch = getCurrentChapter() === 3 ? 32 : SUBWAY_MID_LANE_PITCH;
  applySubwayMidXLanes(cordRopeSegments, midPitch);
  applySubwayClearOfCards(cordRopeSegments, pathMapEl);
  sortSubwayCordPaintOrder(cordRopeSegments);

  const w = Math.max(pathMapEl.offsetWidth, mapRect.width);
  const h = Math.max(pathMapEl.offsetHeight, mapRect.height);

  connectorsEl.setAttribute('width', String(w));
  connectorsEl.setAttribute('height', String(h));
  connectorsEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  connectorsEl.innerHTML = '';

  const NS = 'http://www.w3.org/2000/svg';
  const useSubway = isCorporateSkin();
  connectorsEl.classList.toggle('intro-connectors--subway', useSubway);
  ensureCordDefs();

  const subwayLayers = useSubway
    ? ['shadow', 'body', 'sheen', 'hit'].reduce((acc, name) => {
        const layer = document.createElementNS(NS, 'g');
        layer.setAttribute('class', `intro-connectors__layer intro-connectors__layer--${name}`);
        connectorsEl.appendChild(layer);
        acc[name] = layer;
        return acc;
      }, /** @type {Record<string, SVGGElement>} */ ({}))
    : null;

  const makeSubwayCordHost = (seg, filled) => {
    const host = document.createElementNS(NS, 'g');
    host.classList.add('intro-cord', 'intro-cord--subway');
    if (filled) host.classList.add('is-filled');
    if (introState.pluggingEdge === seg.key) host.classList.add('is-plugging');
    host.dataset.cordEdge = seg.key;
    return host;
  };

  for (const seg of cordRopeSegments) {
    const filled = isEdgeFilled(seg.key);

    if (useSubway && seg.isSubway && subwayLayers) {
      seg.cordHosts = {};
      const ropeLayers = [
        { className: 'intro-cord-rope--shadow', filled: false, layerName: 'shadow' },
        { className: 'intro-cord-rope--body', filled: true, layerName: 'body' },
        { className: 'intro-cord-rope--sheen', filled: false, layerName: 'sheen' }
      ];

      for (const layer of ropeLayers) {
        const host = makeSubwayCordHost(seg, filled);
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('class', `intro-cord-rope ${layer.className}`);
        path.setAttribute('fill', 'none');
        if (layer.filled) path.classList.add('intro-cord-rope--active');
        host.appendChild(path);
        seg.paths.push(path);
        subwayLayers[layer.layerName].appendChild(host);
        seg.cordHosts[layer.layerName] = host;
        if (layer.layerName === 'body') seg.group = host;
      }

      const hitHost = makeSubwayCordHost(seg, filled);
      const hit = document.createElementNS(NS, 'path');
      hit.setAttribute('class', 'intro-cord-hit');
      hit.setAttribute('fill', 'none');
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '32');
      hit.setAttribute('stroke-linecap', 'round');
      hit.setAttribute('stroke-linejoin', 'round');
      hitHost.appendChild(hit);
      seg.hitPath = hit;
      subwayLayers.hit.appendChild(hitHost);
      seg.cordHosts.hit = hitHost;
      bindCordHitTooltip(seg);
      continue;
    }

    const group = document.createElementNS(NS, 'g');
    group.classList.add('intro-cord');
    if (seg.isSubway) group.classList.add('intro-cord--subway');
    if (filled) group.classList.add('is-filled');
    if (introState.pluggingEdge === seg.key) group.classList.add('is-plugging');
    group.dataset.edge = seg.key;
    seg.group = group;

    const layers = [
      { className: 'intro-cord-rope--shadow', filled: false },
      { className: 'intro-cord-rope--body', filled: true },
      { className: 'intro-cord-rope--sheen', filled: false }
    ];

    for (const layer of layers) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', `intro-cord-rope ${layer.className}`);
      path.setAttribute('fill', 'none');
      if (layer.filled) path.classList.add('intro-cord-rope--active');
      group.appendChild(path);
      seg.paths.push(path);
    }

    if (!seg.isSubway) {
      const knotStart = document.createElementNS(NS, 'circle');
      knotStart.setAttribute('class', 'intro-cord-knot');
      knotStart.setAttribute('r', '3.5');
      const knotEnd = knotStart.cloneNode();
      group.append(knotStart, knotEnd);
      seg.knotStart = knotStart;
      seg.knotEnd = knotEnd;
    }

    const hit = document.createElementNS(NS, 'path');
    hit.setAttribute('class', 'intro-cord-hit');
    hit.setAttribute('fill', 'none');
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', seg.isSubway ? '32' : '26');
    hit.setAttribute('stroke-linecap', 'round');
    hit.setAttribute('stroke-linejoin', 'round');
    group.appendChild(hit);
    seg.hitPath = hit;
    bindCordHitTooltip(seg);

    connectorsEl.appendChild(group);
  }

  reorderSubwayCordGroups();
  applyCordRopePaths(0);

  requestAnimationFrame(() => {
    for (const seg of cordRopeSegments) {
      const body = seg.paths.find((p) => p.classList.contains('intro-cord-rope--active'));
      if (!body) continue;

      const len = body.getTotalLength();
      const filled = isEdgeFilled(seg.key);
      if (seg.isSubway && !filled) {
        body.style.strokeDasharray = 'none';
        body.style.strokeDashoffset = '0';
      } else {
        body.style.strokeDasharray = String(len);
        body.style.strokeDashoffset = filled ? '0' : String(len);
      }

      const sheen = seg.paths.find((p) => p.classList.contains('intro-cord-rope--sheen'));
      const shadow = seg.paths.find((p) => p.classList.contains('intro-cord-rope--shadow'));
      for (const path of [sheen, shadow]) {
        if (!path) continue;
        const isSubwayGlass =
          seg.isSubway && (path === shadow || (!filled && path === sheen));
        if (isSubwayGlass) {
          path.style.strokeDasharray = 'none';
          path.style.strokeDashoffset = '0';
          continue;
        }
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = filled ? '0' : String(len);
      }
    }
    if (!introState.pluggingEdge) startCordFloat();
    if (cordEdgeHoverKey) {
      setCordEdgeHover(cordEdgeHoverKey);
    } else if (modulePathHoverId) {
      setModulePathHover(modulePathHoverId, {
        incomingEdgeKey: modulePathHoverIncomingKey ?? undefined,
        routeVariantId: modulePathHoverRouteId ?? undefined
      });
    } else {
      syncPersistentPathHighlights();
    }
    onReady?.();
  });
}

let cordLayoutRaf = 0;
function queueIntroCordLayout() {
  if (introState.pluggingEdge || introState.plugActive) return;
  if (introState.autoDriving && !introState.complete) return;
  if (cordLayoutRaf) cancelAnimationFrame(cordLayoutRaf);
  cordLayoutRaf = requestAnimationFrame(() => {
    cordLayoutRaf = 0;
    if (introState.pluggingEdge || introState.plugActive) return;
    if (isCorporateSkin() || isSpaceSkin()) applyCorporateModuleGridLayout({ skipCatalogSync: true });
    measureIntroCords();
    if (
      !introState.autoDriving &&
      introState.progress >= introCfg().dollyEnd &&
      !shouldFreezeModuleReveal()
    ) {
      introState.stops = null;
      applyIntroProgress(introState.progress, { immediate: true });
    }
  });
}

function buildStarLayer(container, count, sizeRange) {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    star.className = `intro-star${Math.random() > 0.82 ? ' intro-star--bright' : ' intro-star--dim'}`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.setProperty('--pulse-dur', `${3 + Math.random() * 5}s`);
    star.style.setProperty('--pulse-delay', `${Math.random() * 4}s`);
    star.style.setProperty('--pulse-min', `${0.25 + Math.random() * 0.25}`);
    star.style.setProperty('--pulse-max', `${0.7 + Math.random() * 0.3}`);
    container.appendChild(star);
  }
}

function buildStarfield() {
  buildStarLayer(document.getElementById('stars-far'), 120, [0.5, 1.2]);
  buildStarLayer(document.getElementById('stars-mid'), 90, [1, 1.8]);
  buildStarLayer(document.getElementById('stars-near'), 45, [1.5, 2.8]);
}

function readCameraY() {
  return (
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--camera-y')) || 0
  );
}

/** Pan the stage so `el`'s top edge sits at `anchorRatio` of the viewport height. */
function cameraYToAlignElement(el, anchorRatio) {
  const vpH = viewport.clientHeight;
  const elTop = el.getBoundingClientRect().top;
  const targetTop = vpH * anchorRatio;
  return readCameraY() + (targetTop - elTop);
}

/** Pan so `el` is vertically centered at `anchorRatio` (0.5 = viewport middle). */
function cameraYToAlignElementCenter(el, anchorRatio) {
  const vpH = viewport.clientHeight;
  const rect = el.getBoundingClientRect();
  const elCenter = rect.top + rect.height / 2;
  const targetCenter = vpH * anchorRatio;
  return readCameraY() + (targetCenter - elCenter);
}

function syncParallax(yPx) {
  const y = yPx;
  const root = document.documentElement.style;
  root.setProperty('--camera-y', `${y}px`);
  root.setProperty('--sky-base-y', `${y * SKY_PARALLAX.base}px`);
  root.setProperty('--sky-glow-y', `${y * SKY_PARALLAX.glow}px`);
  root.setProperty('--sky-dust-y', `${y * SKY_PARALLAX.dust}px`);
  root.setProperty('--sky-stars-far-y', `${y * SKY_PARALLAX.starsFar}px`);
  root.setProperty('--sky-stars-mid-y', `${y * SKY_PARALLAX.starsMid}px`);
  root.setProperty('--sky-stars-near-y', `${y * SKY_PARALLAX.starsNear}px`);
}

function measureCameraStops({ resetStage = true } = {}) {
  stage.classList.remove('is-panning');
  if (resetStage) {
    syncParallax(0);
    stage.style.transform = 'translate3d(0, 0, 0)';
  } else {
    const y = readCameraY();
    syncParallax(y);
    stage.style.transform = `translate3d(0, ${y}px, 0)`;
  }

  const peekAnchor = 0.52;
  const settledAnchor = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--chapter-anchor')
  ) || 0.15;
  const modulesAnchor = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--modules-anchor')
  ) || 0.5;
  const modulesTarget = pathMapEl ?? gridEl;

  const ch2Title = chapterSection2?.querySelector('.intro-chapter');
  const ch2Map = document.getElementById('intro-path-map-c2');
  const chapterAnchorEl = isCorporateSkin()
    ? document.querySelector('.intro-corporate-board__title')
    : chapterEl;

  const pathSettledAnchor =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--space-path-anchor')
    ) || 0.42;

  return {
    home: 0,
    chapterSettled: chapterAnchorEl
      ? cameraYToAlignElement(chapterAnchorEl, settledAnchor)
      : 0,
    chapterMid: chapterAnchorEl ? cameraYToAlignElement(chapterAnchorEl, peekAnchor) : 0,
    pathSettled: pathMapEl
      ? cameraYToAlignElement(pathMapEl, pathSettledAnchor)
      : chapterAnchorEl
        ? cameraYToAlignElement(chapterAnchorEl, settledAnchor)
        : 0,
    modulesSettled: modulesTarget
      ? cameraYToAlignElementCenter(modulesTarget, modulesAnchor)
      : chapterAnchorEl
        ? cameraYToAlignElement(chapterAnchorEl, settledAnchor)
        : 0,
    chapter2Title: ch2Title ? cameraYToAlignElement(ch2Title, settledAnchor) : 0,
    chapter2Modules: ch2Map
      ? cameraYToAlignElementCenter(ch2Map, modulesAnchor)
      : 0
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeOutBack(t) {
  const c1 = 1.525;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function progressFromElapsed(ms) {
  let acc = 0;
  let prevEnd = 0;
  for (const phase of introCfg().phases) {
    if (ms <= acc + phase.durationMs) {
      if (phase.hold) return prevEnd;
      const local = (ms - acc) / phase.durationMs;
      return prevEnd + local * (phase.progressEnd - prevEnd);
    }
    acc += phase.durationMs;
    prevEnd = phase.progressEnd;
  }
  return 1;
}

function moduleRevealProgress(index) {
  return (
    introCfg().dollyEnd +
    introCfg().moduleHoldProgress +
    index * introCfg().moduleStaggerProgress
  );
}

function revealedModuleCount(p) {
  if (getCurrentChapter() === 2 && introState.chapter2SettledAt) {
    const modules = getRuntimeModules();
    const elapsed = performance.now() - introState.chapter2SettledAt;
    let count = 0;
    for (let i = 0; i < modules.length; i++) {
      if (elapsed >= introCfg().modulesSettleDelayMs + i * introCfg().moduleStaggerMs) count = i + 1;
      else break;
    }
    return count;
  }

  const modules = getRuntimeModules();
  const elapsed = introState.chapterSettledAt
    ? performance.now() - introState.chapterSettledAt
    : 0;

  let count = 0;
  for (let i = 0; i < modules.length; i++) {
    const byTime =
      introState.chapterSettledAt &&
      elapsed >= introCfg().modulesSettleDelayMs + i * introCfg().moduleStaggerMs;
    const byScroll = p >= moduleRevealProgress(i);
    if (byTime || byScroll) count = i + 1;
    else break;
  }
  return count;
}

/** Frame-by-frame scenic values tied to scroll progress (parallax). */
function applyScenicStyles(p) {
  const style = document.documentElement.style;
  const cfg = introCfg();
  const heroT = clamp01(p / cfg.heroEnd);
  const heroE = easeOutCubic(heroT);
  const dollyT = clamp01((p - cfg.dollyStart) / (cfg.dollyEnd - cfg.dollyStart));
  const dollyE = easeInOutCubic(dollyT);

  const chapT = clamp01((p - cfg.chapterRevealStart) / (cfg.chapterRevealEnd - cfg.chapterRevealStart));
  const chapE = easeOutCubic(chapT);

  if (isCorporateSkin()) {
    style.setProperty('--wf-opacity', '0');
    style.setProperty('--wf-scale', '1');
    style.setProperty('--wf-y', '0');
    style.setProperty('--wf-blur', '0');
    style.setProperty('--chapter-opacity', '0');
    style.setProperty('--corporate-hero-opacity', chapE.toFixed(4));
    style.setProperty('--corporate-hero-y', lerp(28, 0, chapE).toFixed(2));
    style.setProperty('--corporate-hero-blur', lerp(8, 0, chapE).toFixed(2));
  } else {
    let wfOpacity;
    let wfScale;
    let wfY;
    let wfBlur;
    if (p <= cfg.heroEnd) {
      wfOpacity = lerp(0, 1, heroE);
      wfScale = lerp(0.96, 1, heroE);
      wfY = lerp(40, 0, heroE);
      wfBlur = lerp(8, 0, heroE);
    } else {
      wfOpacity = lerp(1, 0.08, dollyE);
      wfScale = lerp(1, 0.84, dollyE);
      wfY = lerp(0, -64, dollyE);
      wfBlur = lerp(0, 8, dollyE);
    }
    style.setProperty('--wf-opacity', wfOpacity.toFixed(4));
    style.setProperty('--wf-scale', wfScale.toFixed(4));
    style.setProperty('--wf-y', wfY.toFixed(2));
    style.setProperty('--wf-blur', wfBlur.toFixed(2));
    style.setProperty('--chapter-opacity', chapE.toFixed(4));
    style.setProperty('--chapter-y', (lerp(40, 0, chapE) + lerp(0, -16, dollyE)).toFixed(2));
    style.setProperty('--chapter-blur', lerp(10, 0, chapE).toFixed(2));
    style.setProperty('--corporate-hero-opacity', '0');
  }

  const revealed = revealedModuleCount(p);
  const moduleTotal = getRuntimeModules().length;
  const pathScale =
    revealed > 0 ? lerp(0.94, 1, clamp01(revealed / Math.max(1, moduleTotal))) : 0.94;
  style.setProperty('--path-map-scale', pathScale.toFixed(4));
}

function updateModuleReveal(p) {
  if (shouldFreezeModuleReveal()) {
    return gridEl?.querySelectorAll('.intro-module-wrap.is-revealed').length ?? revealedModuleCount(p);
  }

  const modules = getRuntimeModules();
  const count = revealedModuleCount(p);

  modules.forEach((mod, i) => {
    const wrap = gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`);
    if (!wrap) return;

    const shouldShow = i < count;
    const wasShown = wrap.classList.contains('is-revealed');
    wrap.classList.toggle('is-revealed', shouldShow);

    if (shouldShow && !wasShown && !introState.moduleSoundsPlayed.has(mod.id)) {
      introState.moduleSoundsPlayed.add(mod.id);
      playModuleHoverClick({ bypassThrottle: true });
    }
    if (!shouldShow) introState.moduleSoundsPlayed.delete(mod.id);
  });

  return count;
}

function getIntroStops() {
  if (!introState.stops) {
    introState.stops = measureCameraStops({
      resetStage: introState.progress <= 0 && !introState.complete
    });
  }
  return introState.stops;
}

function applyIntroProgress(raw, { immediate = false } = {}) {
  if (isCorporateSkin()) return;
  const p = Math.max(0, Math.min(1, raw));
  introState.progress = p;
  const root = document.documentElement;

  root.classList.toggle('is-intro-scrubbing', immediate);

  if (p >= introCfg().dollyEnd && !introState.chapterSettledAt) {
    introState.chapterSettledAt = performance.now();
  }
  if (p < introCfg().dollyEnd) {
    introState.chapterSettledAt = null;
    introState.moduleSoundsPlayed.clear();
  }

  applyScenicStyles(p);
  const revealedCount = updateModuleReveal(p);

  viewport.classList.toggle('is-hero-visible', p > 0);
  viewport.classList.toggle(
    'is-camera-moving',
    p >= introCfg().dollyStart && p < introCfg().dollyEnd
  );
  viewport.classList.toggle('is-chapter-settled', p >= introCfg().dollyEnd);
  viewport.classList.toggle('is-modules-visible', revealedCount > 0);

  const stops = getIntroStops();
  const cfg = introCfg();
  let cameraY = stops.home;
  if (cfg.modulesCameraStart < 1 && p >= cfg.modulesCameraStart) {
    const span = 1 - cfg.modulesCameraStart;
    const t = span > 0 ? Math.min(1, (p - cfg.modulesCameraStart) / span) : 1;
    cameraY =
      stops.chapterSettled +
      (stops.modulesSettled - stops.chapterSettled) * easeInOutCubic(t);
  } else if (p >= cfg.dollyEnd) {
    if (isSpaceSkin() && revealedCount > 0 && stops.pathSettled != null) {
      const revealT = clamp01((p - cfg.dollyEnd) / Math.max(0.01, 1 - cfg.dollyEnd));
      cameraY = lerp(stops.chapterSettled, stops.pathSettled, easeOutCubic(revealT));
    } else {
      cameraY = stops.chapterSettled;
    }
  } else if (p >= cfg.dollyStart) {
    const span = cfg.dollyEnd - cfg.dollyStart;
    const t = span > 0 ? Math.min(1, (p - cfg.dollyStart) / span) : 1;
    cameraY = stops.home + (stops.chapterSettled - stops.home) * easeInOutCubic(t);
  }

  stage.classList.remove('is-panning');
  root.classList.remove('is-camera-panning');
  syncParallax(cameraY);
  stage.style.transform = `translate3d(0, ${cameraY}px, 0)`;

  if (revealedCount > 0) {
    startCordFloat();
    queueIntroCordLayout();
  } else {
    stopCordFloat();
  }

  updateSpaceSidePanelReveal(p);

  if (p >= 1 && !introState.complete) finishIntro();
}

function finishIntro() {
  if (introState.complete) return;
  introState.complete = true;
  stopIntroAuto();
  introState.chapterSettledAt = introState.chapterSettledAt ?? performance.now();
  const modules = getRuntimeModules();
  modules.forEach((mod) => {
    gridEl?.querySelector(`[data-module-anchor="${mod.id}"]`)?.classList.add('is-revealed');
  });
  if (isSpaceSkin()) {
    introState.stops = null;
    introState.stops = measureCameraStops({ resetStage: false });
  }
  applyIntroProgress(1, { immediate: true });
  if (isSpaceSkin()) revealSpaceSidePanel();
  document.documentElement.classList.remove('is-intro-scrubbing');
  if (isSpaceSkin()) queueIntroCordLayout();
}

function stopIntroAuto() {
  introState.autoDriving = false;
  if (introState.autoRaf) cancelAnimationFrame(introState.autoRaf);
  introState.autoRaf = 0;
}

function introAutoTick(now) {
  if (!introState.autoDriving || introState.complete) return;
  const elapsed = now - introState.autoStartMs;
  const p = progressFromElapsed(elapsed);
  applyIntroProgress(p, { immediate: true });
  if (p < 1) introState.autoRaf = requestAnimationFrame(introAutoTick);
}

function startIntroAuto() {
  stopIntroAuto();
  introState.autoDriving = true;
  introState.autoStartMs = performance.now();
  introState.autoRaf = requestAnimationFrame(introAutoTick);
}

function onIntroWheel(e) {
  if (isCorporateSkin() || introState.complete || isModuleModalOpen()) return;
  e.preventDefault();

  if (introState.autoDriving) stopIntroAuto();

  const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 140);
  applyIntroProgress(introState.progress + delta * introCfg().wheelStep, { immediate: true });
}

function resetSpaceSidePanel() {
  const board = document.getElementById('intro-corporate-board');
  if (!board || !isSpaceSkin()) return;
  board.classList.add('is-pop-pending');
  board.classList.remove('is-side-panel-visible', 'is-pop-complete');
  board.querySelectorAll('.intro-corporate-pop-target:not(.intro-module-wrap)').forEach((el) => {
    el.classList.remove('is-pop-visible');
  });
}

function revealSpaceSidePanel() {
  const board = document.getElementById('intro-corporate-board');
  if (!board || !isSpaceSkin()) return;
  tagCorporatePopTargets();
  board.classList.remove('is-pop-pending');
  board.classList.add('is-side-panel-visible', 'is-pop-complete');
  board.querySelectorAll('.intro-corporate-pop-target:not(.intro-module-wrap)').forEach((el) => {
    el.classList.add('is-pop-visible');
  });
  syncPlayerProfile();
  requestAnimationFrame(() => requestAnimationFrame(syncIntroSideColumnLayout));
}

function updateSpaceSidePanelReveal(p) {
  if (!isSpaceSkin()) return;
  const board = document.getElementById('intro-corporate-board');
  if (!board) return;
  if (p < introCfg().dollyEnd) {
    resetSpaceSidePanel();
    return;
  }
  if (!board.classList.contains('is-side-panel-visible')) revealSpaceSidePanel();
}

function syncCorporateIntroClass() {
  document.documentElement.classList.toggle('is-corporate-intro', isCorporateSkin());
  if (!usesIntroSidePanel()) return;
  wireLeaderboardScopes();
  initIntroActivityLog();
  syncPlayerProfile();
  if (isCorporateSkin()) {
    patchModulesFromRuntime();
    wireSecretChapterTrigger();
  } else {
    setCatalogChapter(null);
  }
  syncCatalogToViewVolume();
  updateCorporateVolumeCopy(getCorporateViewVolume());
  wireCorporateVolumeNav();
  wireCorporateVolumeDrag();
  applyCorporateVolumeCheatUi();
  if (isSpaceSkin()) {
    resetSpaceSidePanel();
    tagCorporatePopTargets();
  }
}

function runIntroSequence() {
  syncCorporateIntroClass();

  if (isCorporateSkin()) {
    introState.stops = null;
    bootstrapCorporateIntro();
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  introState.complete = false;
  introState.stops = null;
  introState.stops = measureCameraStops();

  if (reduced) {
    introState.chapterSettledAt = performance.now();
    finishIntro();
    return;
  }

  applyIntroProgress(0, { immediate: true });
  startIntroAuto();
}

function initIntroScrollControl() {
  viewport?.addEventListener('wheel', onIntroWheel, { passive: false });
}

window.addEventListener('error', (event) => {
  console.error('[wf-map] uncaught error', event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[wf-map] unhandled rejection', event.reason);
});

initCheatPanel();

buildStarfield();
initModuleModal();
wireModulePathHoverMap();
if (usesIntroSidePanel()) syncCatalogToViewVolume();
renderModules();
if (isCorporateSkin()) {
  ensurePathZoomControls();
  syncCorporatePathMapToCatalog();
  bootstrapCorporateIntro();
}
if (usesIntroSidePanel()) syncPlayerProfile();
syncCorporateIntroClass();
initAmbientMusicSync();
initAmbientPlayback();

window.addEventListener('wf-theme-change', () => {
  syncCorporateIntroClass();
  introState.stops = null;
  if (usesIntroSidePanel()) syncCatalogToViewVolume();
  renderModules();

  if (isCorporateSkin()) {
    revealCorporateBoard();
    queueIntroCordLayout();
    return;
  }

  corporatePopRun += 1;
  resetCorporatePop();
  viewport?.classList.remove('is-corporate-board');

  if (isSpaceSkin()) {
    resetSpaceSidePanel();
    tagCorporatePopTargets();
    if (introState.complete || introState.progress >= introCfg().dollyEnd) {
      revealSpaceSidePanel();
    }
  }

  if (!introState.complete) {
    applyIntroProgress(introState.progress, { immediate: true });
  } else {
    queueIntroCordLayout();
  }
});

window.addEventListener('wf-module-layout-change', () => {
  renderModules();
  queueIntroCordLayout();
});

window.addEventListener('wf-layout-cheat-change', () => {
  queueIntroCordLayout();
  if (usesIntroSidePanel()) {
    requestAnimationFrame(() => {
      syncIntroSideColumnLayout();
      requestAnimationFrame(syncIntroSideColumnLayout);
    });
  }
});

window.addEventListener('wf-corporate-volumes-cheat', () => {
  applyCorporateVolumeCheatUi();
  syncCorporatePathMapToCatalog();
  if (isCorporateSkin() && pathMapMatchesCatalog()) queueIntroCordLayout();
});

window.addEventListener('wf-sync-next-play-glow', () => {
  syncNextPlayModuleGlow();
  syncPersistentPathHighlights();
});

window.addEventListener('wf-path-highlight-mode-change', () => {
  clearModulePathHover();
  syncPersistentPathHighlights();
});

window.addEventListener('wf-path-grid-layout-change', () => {
  if (!isCorporateSkin() && !isSpaceSkin()) return;
  renderModules();
  if (isCorporateSkin()) syncCorporatePathViewport();
  queueIntroCordLayout();
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !isCorporateSkin()) return;
  syncCorporatePathMapToCatalog();
  queueIntroCordLayout();
});

window.addEventListener('wf-progress-change', (event) => {
  if (event.detail?.reset) {
    if (getCurrentChapter() >= 2 || isChapterHandoffDone()) {
      window.location.reload();
      return;
    }
    introState.corporateViewVolume = 1;
    setCatalogChapter(null);
    setActiveChapter(1);
    if (usesIntroSidePanel()) applyCorporateVolumeCheatUi();
    renderModules();
    if (isCorporateSkin()) revealCorporateBoard();
    else queueIntroCordLayout();
    return;
  }
  if (event.detail?.unlockAll) {
    const unlocked = getRuntimeModules().filter((m) => !m.locked).map((m) => m.id);
    if (usesIntroSidePanel()) {
      setCorporateVolumeCheatMode('all');
      applyCorporateVolumeCheatUi();
      if (isCorporateSkin() && getCurrentChapter() === 1) revealCorporateBoard();
    }
    if (isCorporateSkin()) {
      syncCorporatePathMapToCatalog();
      if (pathMapMatchesCatalog()) patchModulesFromRuntime(unlocked);
      else queueIntroCordLayout();
    } else {
      patchModulesFromRuntime(unlocked);
    }
    syncPlayerProfile();
    if (isCorporateSkin()) syncPathFocusPanFromProgress();
    queueIntroCordLayout();
    return;
  }
  if (event.detail?.lockVolume != null || event.detail?.unlockVolume != null) {
    if (usesIntroSidePanel()) applyCorporateVolumeCheatUi();
    if (isCorporateSkin()) {
      if (usesIntroSidePanel()) setCatalogChapter(getCorporateViewVolume());
      renderModules();
    } else {
      patchModulesFromRuntime(event.detail?.newlyUnlocked ?? []);
    }
    refreshLeaderboardPanel();
    syncPlayerProfile();
    if (isCorporateSkin()) syncPathFocusPanFromProgress();
    queueIntroCordLayout();
    return;
  }
  patchModulesFromRuntime(event.detail?.newlyUnlocked ?? []);
  refreshLeaderboardPanel();
  syncPlayerProfile();
  if (usesIntroSidePanel()) applyCorporateVolumeCheatUi();
  if (isCorporateSkin()) syncPathFocusPanFromProgress();
  queueIntroCordLayout();
});

window.addEventListener('resize', () => {
  introState.stops = null;
  if (isCorporateSkin()) {
    syncCorporatePathViewport();
    queueIntroCordLayout();
    return;
  }
  if (!introState.complete) {
    applyIntroProgress(introState.progress, { immediate: true });
  }
  queueIntroCordLayout();
});

if (typeof ResizeObserver !== 'undefined') {
  const cordObserver = new ResizeObserver(() => {
    if (isCorporateSkin()) syncCorporatePathViewport();
    queueIntroCordLayout();
  });
  if (pathMapEl) cordObserver.observe(pathMapEl);
  const modulesPathEl = document.getElementById('modules');
  if (modulesPathEl) cordObserver.observe(modulesPathEl);
  const boardMainEl = document.querySelector('.intro-corporate-board__main');
  if (boardMainEl) cordObserver.observe(boardMainEl);
  gridEl?.querySelectorAll('img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', queueIntroCordLayout, { once: true });
  });
}

initIntroScrollControl();

if (isCorporateSkin()) {
  requestAnimationFrame(() => {
    recoverCorporateDashboard();
  });
}

if (getCurrentChapter() === 3 && isChapter3HandoffDone()) {
  if (isCorporateSkin()) bootstrapCorporateChapter3View();
} else if (getCurrentChapter() === 2 && isChapterHandoffDone()) {
  if (isCorporateSkin()) bootstrapCorporateChapter2View();
  else bootstrapChapter2View();
} else {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      runIntroSequence();
    });
  });
}
