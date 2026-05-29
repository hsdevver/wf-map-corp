/**
 * Corporate dashboard opening sequence — single async director (playIntro).
 * All timing is JS-driven (Web Animations API); no CSS transition on intro targets during playback.
 */

import {
  animateTubeDraw,
  cordHostsForSegment,
  createTubeDrawJob,
  easeInOutCubic,
  markCordTubeHosts,
  setTubeHidden
} from './cord-tube-draw.js';

export let introIsPlaying = false;

const EASE_TITLE = 'cubic-bezier(0, 0, 0.2, 1)';
const EASE_CARD_POP = 'cubic-bezier(0, 0, 0.2, 1)';
const EASE_LINE = 'cubic-bezier(0.42, 0, 0.58, 1)';
/** Act 3 — side cards (profile → activity → leaderboard) */
const INTRO_SIDE_CARD_MS = 560;
const INTRO_SIDE_STAGGER_MS = 140;
const INTRO_SIDE_LEAD_MS = 180;
const EASE_NAV = 'cubic-bezier(0, 0, 0.2, 1)';
/** Act 2 / volume column reveal — line grow (2× opening-chapter pacing, ÷1.5 for refresh intro) */
const INTRO_CORD_GROW_MS = 1120;
/** Column card pop — 0.75× the 2× opening pace, ÷1.5 for refresh intro */
const PATH_COLUMN_CARD_POP_MS = 340;
const PATH_COLUMN_REVEAL_GAP_MS = 107;
const PATH_COLUMN_REVEAL_TAIL_MS = 80;

let directorRun = 0;
let pathColumnRevealToken = 0;

export function waitFrames(frameCount = 1) {
  return new Promise((resolve) => {
    let left = frameCount;
    const tick = () => {
      if (--left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function freezeIntroStyles(el) {
  if (!el) return;
  el.style.transition = 'none';
}

function setHiddenCard(el) {
  if (!el) return;
  freezeIntroStyles(el);
  el.style.opacity = '0';
  el.style.transform = 'none';
}

function setHiddenCopy(el) {
  if (!el) return;
  freezeIntroStyles(el);
  el.style.opacity = '0';
  el.style.transform = 'translate3d(0, 12px, 0)';
}

function setHiddenSide(el) {
  if (!el) return;
  freezeIntroStyles(el);
  el.style.opacity = '0';
  el.style.transform = 'translate3d(0, 14px, 0)';
}

function setHiddenNav(el) {
  if (!el) return;
  freezeIntroStyles(el);
  el.style.opacity = '0';
  el.style.transform = 'translate3d(0, 6px, 0)';
}

function commitKeyframeStyle(el, frame) {
  if (!el || !frame) return;
  if (frame.opacity != null) el.style.opacity = String(frame.opacity);
  if (frame.transform != null) el.style.transform = frame.transform;
}

function commitFinalStyles(el) {
  if (!el) return;
  el.style.opacity = '1';
  el.style.transform = 'none';
  el.style.removeProperty('transition');
  el.classList.add('is-pop-visible');
}

/** Synchronous hide — call before first paint (module init + paint-guard CSS). */
export function applyIntroInitialHiddenState(board, gridEl) {
  if (!board) return;

  board.classList.add('is-intro-director', 'is-pop-pending');
  board.classList.remove(
    'is-pop-complete',
    'is-path-pop-active',
    'is-side-pop-active',
    'is-nav-pop-active'
  );

  const copy = board.querySelector('.intro-corporate-board__copy');
  setHiddenCopy(copy);

  board.querySelectorAll('.intro-corporate-nav__item, .intro-corporate-nav__connector').forEach(setHiddenNav);

  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.remove('is-pop-visible');
    setHiddenCard(wrap);
  });

  board.querySelectorAll(
    '.intro-corporate-player-profile, .intro-corporate-activity, .intro-corporate-leaderboard'
  ).forEach(setHiddenSide);
}

function parseOpacity(value) {
  if (value == null) return 1;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 1;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function parseTranslateYPx(transform) {
  if (!transform || transform === 'none') return 0;
  const m3 = transform.match(/translate3d\(\s*[^,]+,\s*(-?[\d.]+)px/i);
  if (m3) return Number.parseFloat(m3[1]) || 0;
  const mY = transform.match(/translateY\(\s*(-?[\d.]+)px/i);
  if (mY) return Number.parseFloat(mY[1]) || 0;
  return 0;
}

/** Smooth opacity + translateY (no scale — keeps glass side cards performant). */
function tweenFadeSlide(el, keyframes, durationMs) {
  if (!el) return Promise.resolve();
  const from = keyframes[0];
  const to = keyframes[keyframes.length - 1];
  const fromOpacity = parseOpacity(from.opacity);
  const toOpacity = parseOpacity(to.opacity);
  const fromY = parseTranslateYPx(from.transform);
  const toY = parseTranslateYPx(to.transform);

  if (prefersReducedMotion() || durationMs <= 0) {
    freezeIntroStyles(el);
    commitKeyframeStyle(el, to);
    el.style.willChange = '';
    el.classList.add('is-pop-visible');
    return Promise.resolve();
  }

  freezeIntroStyles(el);
  commitKeyframeStyle(el, from);
  el.style.willChange = 'opacity, transform';

  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const linearT = Math.min(1, (now - start) / durationMs);
      const t = easeOutCubic(linearT);
      const y = fromY + (toY - fromY) * t;
      el.style.opacity = String(fromOpacity + (toOpacity - fromOpacity) * t);
      el.style.transform = y === 0 ? 'none' : `translate3d(0, ${y}px, 0)`;
      if (linearT < 1) requestAnimationFrame(step);
      else {
        el.style.willChange = '';
        commitKeyframeStyle(el, to);
        el.classList.add('is-pop-visible');
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

/** Inline-style tween — avoids WAAPI vs CSS / inline opacity conflicts. */
function tween(el, keyframes, durationMs, easingMode = 'ease-out') {
  if (!el) return Promise.resolve();
  const from = keyframes[0];
  const to = keyframes[keyframes.length - 1];
  const fromOpacity = parseOpacity(from.opacity);
  const toOpacity = parseOpacity(to.opacity);
  const fromTransform = from.transform ?? 'none';
  const toTransform = to.transform ?? 'none';
  const fromY = parseTranslateYPx(fromTransform);
  const toY = parseTranslateYPx(toTransform);
  const hasSlide = fromY !== toY;
  const opacityOnly = fromTransform === 'none' && toTransform === 'none';

  if (hasSlide && !fromTransform.includes('scale')) {
    return tweenFadeSlide(el, keyframes, durationMs);
  }

  if (prefersReducedMotion() || durationMs <= 0) {
    freezeIntroStyles(el);
    commitKeyframeStyle(el, to);
    el.classList.add('is-pop-visible');
    return Promise.resolve();
  }

  freezeIntroStyles(el);
  commitKeyframeStyle(el, from);

  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const linearT = Math.min(1, (now - start) / durationMs);
      const t = easingMode === 'linear' ? linearT : easeOutCubic(linearT);
      el.style.opacity = String(fromOpacity + (toOpacity - fromOpacity) * t);
      if (opacityOnly) {
        el.style.transform = 'none';
      } else {
        el.style.transform = linearT >= 1 ? toTransform : fromTransform;
      }
      if (linearT < 1) requestAnimationFrame(step);
      else {
        commitKeyframeStyle(el, to);
        el.classList.add('is-pop-visible');
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

async function act1Title(board, runId) {
  const copy = board.querySelector('.intro-corporate-board__copy');
  if (!copy || runId !== directorRun) return;

  await tween(
    copy,
    [
      { opacity: 0, transform: 'translate3d(0, 12px, 0)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' }
    ],
    480,
    EASE_TITLE
  );
  if (runId !== directorRun) return;
  await delay(320);
}

/** Hide path cards before column-by-column reveal (volume switch or intro act 2). */
export function preparePathMapColumnReveal(gridEl) {
  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.remove('is-pop-visible');
    setHiddenCard(wrap);
  });
}

/** Restore path cards and cords after a standalone column reveal (e.g. volume switch). */
export function finalizePathMapColumnReveal(board, gridEl) {
  board?.classList.remove('is-path-pop-active');
  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.add('is-revealed', 'is-pop-visible');
    commitFinalStyles(wrap);
  });
  board?.querySelectorAll('.intro-cord').forEach((cord) => {
    cord.style.removeProperty('opacity');
    cord.style.removeProperty('pointer-events');
    cord.classList.add('is-intro-revealed');
    cord.classList.remove('is-intro-line-growing', 'is-tube-flowing');
  });
}

export function cancelPathMapColumnReveal() {
  pathColumnRevealToken += 1;
  return pathColumnRevealToken;
}

/**
 * Intro act 2 / volume switch — columns of cards, then tubes to the next column.
 * @param {object} [options]
 * @param {number} [options.revealToken] — invalidate via cancelPathMapColumnReveal()
 * @param {() => boolean} [options.shouldContinue] — extra guard (intro director run id)
 * @param {boolean} [options.includePathPopActive=true] — path-pop-active + modules-visible (intro only)
 */
export async function playPathMapColumnReveal(deps, board, options = {}) {
  const { revealToken, shouldContinue, includePathPopActive = true } = options;
  const { gridEl, getRuntimeModules, corporatePathColumns, corporateModuleIdsInColumn, corporateIntroCordKeysFromColumn } =
    deps;

  const ok = () => {
    if (shouldContinue && !shouldContinue()) return false;
    if (revealToken != null && revealToken !== pathColumnRevealToken) return false;
    return true;
  };

  deps.applyCorporateModuleGridLayout();
  if (!ok()) return;

  if (includePathPopActive) {
    board.classList.add('is-path-pop-active');
    deps.viewport?.classList.add('is-modules-visible');
  }

  deps.allowCordMeasure(true);
  await deps.measureIntroCordsAsync();
  deps.allowCordMeasure(false);
  if (!ok()) return;

  const modules = getRuntimeModules();
  const columns = corporatePathColumns(modules);
  const revealedCordKeys = new Set();

  for (const col of columns) {
    if (!ok()) return;

    const moduleIds = corporateModuleIdsInColumn(col, modules);
    const wraps = moduleIds
      .map((id) => gridEl?.querySelector(`[data-module-anchor="${id}"]`))
      .filter(Boolean);

    await Promise.all(
      wraps.map((wrap) =>
        tween(
          wrap,
          [
            { opacity: 0, transform: 'none' },
            { opacity: 1, transform: 'none' }
          ],
          PATH_COLUMN_CARD_POP_MS,
          EASE_CARD_POP
        )
      )
    );
    if (!ok()) return;

    const edgeKeys = corporateIntroCordKeysFromColumn(col, modules).filter((k) => !revealedCordKeys.has(k));
    if (!edgeKeys.length) continue;

    await delay(PATH_COLUMN_REVEAL_GAP_MS);
    if (!ok()) return;

    const jobs = [];
    const growingHosts = [];
    for (const key of edgeKeys) {
      const seg = deps.findCordSegment(key);
      if (!seg) continue;
      const hosts = cordHostsForSegment(seg, deps.connectorsEl, key);
      markCordTubeHosts(hosts, { growing: true });
      growingHosts.push(...hosts);
      const job = createTubeDrawJob(seg);
      if (!job) continue;
      setTubeHidden(job);
      jobs.push(job);
    }

    deps.applyCordRopePaths(deps.getCordFloatPhase());
    await Promise.all(
      jobs.map((job) =>
        animateTubeDraw(job, INTRO_CORD_GROW_MS, { ease: easeInOutCubic }).then(() => {
          if (!ok()) return;
          const hosts = cordHostsForSegment(job.seg, deps.connectorsEl, job.seg.key);
          for (const host of hosts) {
            host.classList.add('is-intro-revealed');
            host.classList.remove('is-intro-line-growing');
          }
        })
      )
    );
    markCordTubeHosts(growingHosts, { growing: false });
    if (!ok()) return;

    for (const key of edgeKeys) {
      revealedCordKeys.add(key);
    }

    await delay(PATH_COLUMN_REVEAL_TAIL_MS);
  }
}

async function act2PathMap(deps, board, runId) {
  await playPathMapColumnReveal(deps, board, {
    shouldContinue: () => runId === directorRun,
    includePathPopActive: true
  });
}

async function act3SideColumn(board, runId, deps) {
  await delay(INTRO_SIDE_LEAD_MS);
  if (runId !== directorRun) return;

  board.classList.add('is-side-pop-active', 'is-intro-side-tweening');

  const blocks = [
    board.querySelector('.intro-corporate-player-profile'),
    board.querySelector('.intro-corporate-activity'),
    board.querySelector('.intro-corporate-leaderboard')
  ].filter(Boolean);

  const sideKeyframes = [
    { opacity: 0, transform: 'translate3d(0, 14px, 0)' },
    { opacity: 1, transform: 'translate3d(0, 0, 0)' }
  ];

  await Promise.all(
    blocks.map((block, index) =>
      delay(index * INTRO_SIDE_STAGGER_MS).then(async () => {
        if (runId !== directorRun) return;
        await tweenFadeSlide(block, sideKeyframes, INTRO_SIDE_CARD_MS);
      })
    )
  );

  if (runId !== directorRun) return;

  board.classList.remove('is-intro-side-tweening');
  deps.syncIntroSideColumnLayout?.();
}

async function act4Nav(board, runId) {
  await delay(160);
  if (runId !== directorRun) return;

  board.classList.add('is-nav-pop-active');
  const nav = board.querySelector('.intro-corporate-nav');
  if (!nav) return;

  const steps = [...nav.children].filter((el) =>
    el.matches('.intro-corporate-nav__item, .intro-corporate-nav__connector')
  );

  for (const el of steps) {
    if (runId !== directorRun) return;
    await tween(
      el,
      [
        { opacity: 0, transform: 'translate3d(0, 6px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
      ],
      260,
      EASE_NAV
    );
    if (runId !== directorRun) return;
    await delay(60);
  }
}

function finalizeVisibleState(board, gridEl) {
  board.classList.add('is-intro-director-active');
  board.classList.remove('is-pop-pending', 'is-path-pop-active', 'is-side-pop-active', 'is-nav-pop-active');
  board.classList.add('is-pop-complete');

  board.querySelectorAll(
    '.intro-corporate-board__copy, .intro-corporate-nav__item, .intro-corporate-nav__connector, .intro-corporate-player-profile, .intro-corporate-activity, .intro-corporate-leaderboard'
  ).forEach(commitFinalStyles);

  gridEl?.querySelectorAll('.intro-module-wrap').forEach((wrap) => {
    wrap.classList.add('is-revealed', 'is-pop-visible');
    commitFinalStyles(wrap);
  });

  board.querySelectorAll('.intro-cord').forEach((cord) => {
    cord.style.removeProperty('opacity');
    cord.style.removeProperty('pointer-events');
    cord.classList.add('is-intro-revealed');
    cord.classList.remove('is-intro-line-growing', 'is-tube-flowing');
  });
}

/** Clear director hidden inline styles when intro is skipped (ch2/3 bootstrap, cheats, recovery). */
export function forceRevealIntroElements(board, gridEl) {
  if (!board) return;
  introIsPlaying = false;
  finalizeVisibleState(board, gridEl);
}

/**
 * @param {object} deps — hooks from workflow-intro.js (cords, layout, completion).
 */
export async function playIntro(deps) {
  const board = document.getElementById('intro-corporate-board');
  if (!board || board.classList.contains('is-pop-complete')) return;

  const runId = ++directorRun;
  introIsPlaying = true;

  deps.stopIntroAuto?.();
  deps.stage && (deps.stage.style.transform = 'none');
  deps.syncParallax?.(0);
  document.documentElement.classList.remove('is-intro-scrubbing');
  deps.viewport?.classList.remove('is-hero-visible', 'is-camera-moving');

  deps.tagCorporatePopTargets?.();
  applyIntroInitialHiddenState(board, deps.gridEl);
  board.classList.add('is-intro-director-active');
  deps.stopCordFloat?.();
  deps.clearPlugState?.();

  if (prefersReducedMotion()) {
    finalizeVisibleState(board, deps.gridEl);
    introIsPlaying = false;
    deps.completeIntro();
    deps.queueIntroCordLayout();
    return;
  }

  try {
    await act1Title(board, runId);
    if (runId !== directorRun) return;

    await act2PathMap(deps, board, runId);
    if (runId !== directorRun) return;

    await act3SideColumn(board, runId, deps);
    if (runId !== directorRun) return;

    await act4Nav(board, runId);
    if (runId !== directorRun) return;

    finalizeVisibleState(board, deps.gridEl);
    introIsPlaying = false;
    deps.completeIntro();
    deps.queueIntroCordLayout();
  } catch (err) {
    console.error('[wf-map] intro director failed', err);
    if (runId === directorRun) {
      finalizeVisibleState(board, deps.gridEl);
      introIsPlaying = false;
      deps.completeIntro();
      deps.queueIntroCordLayout();
    }
  }
}

export function cancelIntroDirector() {
  directorRun += 1;
  introIsPlaying = false;
  cancelPathMapColumnReveal();
}
