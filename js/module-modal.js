import {
  getChapterCapsLabel,
  MODULE_SKILL_FOCUS,
  MODULE_STAR_UNLOCK_GATES
} from './consequence-flow.js?v=flow-wiring-m8-skills-v1';
import { recordPlayActivity } from './intro-activity-log.js';
import {
  applyPlayOutcome,
  getModuleEmpathyScore,
  getPlayScenario,
  getRuntimeModule,
  hadEarnedStarsBeforePlay,
  leaderboardPointsFromEmpathy,
  playModeBeforeOutcome
} from './consequence-progress.js?v=flex-only-v2';
import {
  computeEmpathyScore,
  EMPATHY_SCORE_CEIL,
  EMPATHY_SCORE_FLOOR,
  EMPATHY_SCORE_FOUR_STARS,
  starsForModule
} from './empathy-score.js';
import { playModuleHoverClick } from './ui-sounds.js';

const MODAL_STAR_SVG =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 1.2 7.47 4.18l3.29.48-2.38 2.32.56 3.27L6 8.3l-2.94 1.55.56-3.27-2.38-2.32 3.29-.48z"/></svg>';

const MODAL_PLAY_ICON_SVG =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M3.15 1.65 10.35 6 3.15 10.35z"/></svg>';

const MODAL_REPEAT_ICON_SVG =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 2.25V1L3.5 3.25 6 5.25V3.75c1.52 0 2.75 1.23 2.75 2.75S7.52 9.25 6 9.25 3.25 8.02 3.25 6.5H2c0 2.21 1.79 4 4 4s4-1.79 4-4-1.79-4-4-4Zm0 7.5V11l2.5-2-2.5-2v1.5c-1.52 0-2.75-1.23-2.75-2.75S4.48 2.75 6 2.75 8.75 3.98 8.75 5.5H10c0-2.21-1.79-4-4-4s-4 1.79-4 4 1.79 4 4 4Z"/></svg>';

/** Sidebar labels for corporate chapter modal (wireframe layout). */
const CORPORATE_MODAL_SKILL_NAV = [
  { label: 'Problem Solving' },
  { label: 'Accountability' },
  { label: 'Communication' },
  { label: 'Enterprise Thinking' }
];

/** Bumped when modal DOM structure changes — stale nodes are rebuilt on load. */
const MODAL_DOM_VERSION = 6;

/** Maps MODULE_SKILL_FOCUS keys to CORPORATE_MODAL_SKILL_NAV row index. */
const CORPORATE_SKILL_FOCUS_INDEX = {
  empathy: 0,
  ownership: 1,
  communication: 2
};

/** Expanded chapter panel — share of main column (width × height), centered. */
const CORPORATE_MODULES_PANEL_RATIO = 0.6;
/** Played-chapter feedback — same panel footprint as chapter detail. */
const CORPORATE_MODULES_PANEL_FEEDBACK_RATIO = 0.6;
/** Taller than width ratio so the hero backdrop feels closer to chapter-card proportions. */
const CORPORATE_MODULES_PANEL_HEIGHT_RATIO = 0.84;
/** Minimum panel height ÷ width (chapter cards are 1:1; modal body sits below the hero). */
const CORPORATE_MODULES_PANEL_MIN_ASPECT = 0.62;
const CORPORATE_MODULES_PANEL_MIN_W = 320;
const CORPORATE_MODULES_PANEL_MIN_H = 280;

const modalState = {
  open: false,
  moduleId: null,
  sourceCard: null,
  mod: null,
  view: 'detail',
  onClose: null,
  onProgress: null,
  onPlugWire: null,
  corporatePathLayout: false
};

let corporateResizeListener = null;

let rootEl = null;
let panelEl = null;
let backdropEl = null;
let closeBtn = null;
let backBtn = null;
let ctaBtn = null;
let heroImg = null;
let heroHeadEl = null;
let headerMetaEl = null;
let headerCertifyEl = null;
let headerPlaytimeEl = null;
let headerStarsEl = null;
let badgeEl = null;
let titleEl = null;
let skillsNavEl = null;
let descEl = null;
let statsEl = null;
let detailBlock = null;
let bodyMainEl = null;
let feedbackBlock = null;
let feedbackTopEl = null;
let feedbackSkillsEl = null;
let feedbackPointsEl = null;
let feedbackPointsCurrentEl = null;
let feedbackPointsMaxEl = null;
let feedbackDescEl = null;
let feedbackTitleEl = null;
let feedbackTextEl = null;
let feedbackBottomEl = null;
let headerPointsEl = null;
let playBlock = null;
let playPromptEl = null;
let choicesEl = null;
let actionsEl = null;

function defaultModalMeta(mod) {
  return {
    badge: mod.start ? 'INTRO' : 'MODULE',
    cta: mod.start ? 'Play volume' : 'Play module',
    showStats: Boolean(mod.completed && mod.lastChoice),
    lastChoice: mod.lastChoice ?? '—',
    playtime: mod.completed ? '12 min' : '—',
    bestRun: mod.progress > 0 ? `${mod.progress}%` : mod.completed ? '100%' : '—'
  };
}

function modalMeta(mod) {
  return { ...defaultModalMeta(mod), ...(mod.modal ?? {}) };
}

function teardownModalDom() {
  rootEl?.remove();
  rootEl = null;
  panelEl = null;
  backdropEl = null;
  closeBtn = null;
  backBtn = null;
  ctaBtn = null;
  heroImg = null;
  heroHeadEl = null;
  headerMetaEl = null;
  headerCertifyEl = null;
  headerPlaytimeEl = null;
  headerStarsEl = null;
  badgeEl = null;
  titleEl = null;
  skillsNavEl = null;
  descEl = null;
  statsEl = null;
  detailBlock = null;
  bodyMainEl = null;
  feedbackBlock = null;
  feedbackTopEl = null;
  feedbackSkillsEl = null;
  feedbackPointsEl = null;
  feedbackPointsCurrentEl = null;
  feedbackPointsMaxEl = null;
  feedbackDescEl = null;
  feedbackTitleEl = null;
  feedbackTextEl = null;
  feedbackBottomEl = null;
  headerPointsEl = null;
  playBlock = null;
  playPromptEl = null;
  choicesEl = null;
  actionsEl = null;
}

function modalDomNeedsRebuild() {
  const existing = document.getElementById('module-modal');
  if (!existing) return false;
  if (existing.dataset.domVersion !== String(MODAL_DOM_VERSION)) return true;
  return (
    !existing.querySelector('.module-modal__hero-head') ||
    !existing.querySelector('.module-modal__feedback') ||
    !existing.querySelector('.module-modal__feedback-top') ||
    !existing.querySelector('.module-modal__feedback-bottom') ||
    !existing.querySelector('.module-modal__header') ||
    !existing.querySelector('.module-modal__body-main')
  );
}

function ensureDom() {
  if (modalDomNeedsRebuild()) teardownModalDom();
  if (rootEl) return;

  rootEl = document.createElement('div');
  rootEl.id = 'module-modal';
  rootEl.className = 'module-modal';
  rootEl.dataset.domVersion = String(MODAL_DOM_VERSION);
  rootEl.hidden = true;

  backdropEl = document.createElement('button');
  backdropEl.type = 'button';
  backdropEl.className = 'module-modal__backdrop';
  backdropEl.setAttribute('aria-label', 'Close dialog');

  panelEl = document.createElement('div');
  panelEl.className = 'module-modal__panel';
  panelEl.setAttribute('role', 'dialog');
  panelEl.setAttribute('aria-modal', 'true');
  panelEl.setAttribute('aria-labelledby', 'module-modal-title');

  closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'module-modal__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';

  const hero = document.createElement('div');
  hero.className = 'module-modal__hero';
  heroImg = document.createElement('img');
  heroImg.className = 'module-modal__hero-img';
  heroImg.alt = '';
  hero.appendChild(heroImg);

  heroHeadEl = document.createElement('div');
  heroHeadEl.className = 'module-modal__hero-head';

  const heroMainEl = document.createElement('div');
  heroMainEl.className = 'module-modal__hero-main';

  titleEl = document.createElement('h2');
  titleEl.className = 'module-modal__title';
  titleEl.id = 'module-modal-title';

  headerMetaEl = document.createElement('div');
  headerMetaEl.className = 'module-modal__hero-meta';
  headerCertifyEl = document.createElement('span');
  headerCertifyEl.className = 'module-modal__hero-meta-item';
  headerPlaytimeEl = document.createElement('span');
  headerPlaytimeEl.className = 'module-modal__hero-meta-item';
  headerMetaEl.append(headerCertifyEl, headerPlaytimeEl);

  heroMainEl.append(titleEl, headerMetaEl);

  headerPointsEl = document.createElement('div');
  headerPointsEl.className = 'module-modal__hero-points';
  headerPointsEl.hidden = true;

  headerStarsEl = document.createElement('div');
  headerStarsEl.className = 'module-modal__hero-stars';
  headerStarsEl.setAttribute('aria-hidden', 'true');

  const heroAsideEl = document.createElement('div');
  heroAsideEl.className = 'module-modal__hero-aside';
  heroAsideEl.append(headerPointsEl, headerStarsEl);

  heroHeadEl.append(heroMainEl, heroAsideEl);

  const header = document.createElement('div');
  header.className = 'module-modal__header';
  header.appendChild(heroHeadEl);

  const body = document.createElement('div');
  body.className = 'module-modal__body';

  bodyMainEl = document.createElement('div');
  bodyMainEl.className = 'module-modal__body-main';

  detailBlock = document.createElement('div');
  detailBlock.className = 'module-modal__detail';

  badgeEl = document.createElement('span');
  badgeEl.className = 'module-modal__badge';

  skillsNavEl = document.createElement('nav');
  skillsNavEl.className = 'module-modal__skills';
  skillsNavEl.setAttribute('aria-label', 'Skills');

  descEl = document.createElement('p');
  descEl.className = 'module-modal__desc';

  statsEl = document.createElement('dl');
  statsEl.className = 'module-modal__stats';
  for (const [label, key] of [
    ['Your last choice', 'lastChoice'],
    ['Playtime', 'playtime'],
    ['Best run', 'bestRun']
  ]) {
    const wrap = document.createElement('div');
    wrap.className = 'module-modal__stat';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.dataset.stat = key;
    wrap.append(dt, dd);
    statsEl.appendChild(wrap);
  }

  detailBlock.append(badgeEl, skillsNavEl, descEl, statsEl);

  feedbackBlock = document.createElement('div');
  feedbackBlock.className = 'module-modal__feedback';
  feedbackBlock.hidden = true;

  feedbackTopEl = document.createElement('div');
  feedbackTopEl.className = 'module-modal__feedback-top';

  feedbackSkillsEl = document.createElement('div');
  feedbackSkillsEl.className = 'module-modal__feedback-skills';
  feedbackSkillsEl.setAttribute('role', 'list');
  feedbackSkillsEl.setAttribute('aria-label', 'Skills tested');

  const feedbackAsideEl = document.createElement('div');
  feedbackAsideEl.className = 'module-modal__feedback-aside';
  feedbackAsideEl.append(feedbackSkillsEl);

  feedbackDescEl = document.createElement('p');
  feedbackDescEl.className = 'module-modal__feedback-desc';

  feedbackTitleEl = document.createElement('h3');
  feedbackTitleEl.className = 'module-modal__feedback-heading';
  feedbackTitleEl.textContent = 'Feedback';
  feedbackTitleEl.hidden = true;

  feedbackTextEl = document.createElement('p');
  feedbackTextEl.className = 'module-modal__feedback-text';

  const feedbackMainEl = document.createElement('div');
  feedbackMainEl.className = 'module-modal__feedback-main';
  feedbackMainEl.append(feedbackDescEl, feedbackTextEl);

  feedbackTopEl.append(feedbackAsideEl, feedbackMainEl);

  feedbackPointsEl = document.createElement('p');
  feedbackPointsEl.className = 'module-modal__feedback-points';
  feedbackPointsCurrentEl = document.createElement('span');
  feedbackPointsCurrentEl.className = 'module-modal__feedback-points-current';
  feedbackPointsMaxEl = document.createElement('span');
  feedbackPointsMaxEl.className = 'module-modal__feedback-points-max';
  feedbackPointsEl.append(feedbackPointsCurrentEl, feedbackPointsMaxEl);

  feedbackBottomEl = document.createElement('div');
  feedbackBottomEl.className = 'module-modal__feedback-bottom';
  feedbackBottomEl.hidden = true;
  feedbackBottomEl.append(feedbackPointsEl);

  feedbackBlock.append(feedbackTopEl, feedbackBottomEl);

  playBlock = document.createElement('div');
  playBlock.className = 'module-modal__play';
  playBlock.hidden = true;

  playPromptEl = document.createElement('p');
  playPromptEl.className = 'module-modal__play-prompt';

  choicesEl = document.createElement('div');
  choicesEl.className = 'module-modal__choices';

  playBlock.append(playPromptEl, choicesEl);

  actionsEl = document.createElement('div');
  actionsEl.className = 'module-modal__actions';

  backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'module-modal__back';
  backBtn.textContent = 'Back';

  ctaBtn = document.createElement('button');
  ctaBtn.type = 'button';
  ctaBtn.className = 'module-modal__cta';
  ctaBtn.hidden = true;
  const ctaLabelEl = document.createElement('span');
  ctaLabelEl.className = 'module-modal__cta-label';
  const ctaIconEl = document.createElement('span');
  ctaIconEl.className = 'module-modal__cta-icon';
  ctaIconEl.setAttribute('aria-hidden', 'true');
  ctaIconEl.innerHTML = MODAL_PLAY_ICON_SVG;
  ctaBtn.append(ctaLabelEl, ctaIconEl);

  actionsEl.append(backBtn, ctaBtn);
  bodyMainEl.append(detailBlock, feedbackBlock, playBlock, actionsEl);
  body.append(bodyMainEl, hero);
  panelEl.append(closeBtn, header, body);
  syncModalDomLayout();
  rootEl.append(backdropEl, panelEl);
  document.body.appendChild(rootEl);

  backdropEl.addEventListener('click', () => closeModuleModal());
  closeBtn.addEventListener('click', () => closeModuleModal());
  backBtn.addEventListener('click', () => onBackClick());
  ctaBtn.addEventListener('click', () => onCtaClick());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalState.open) closeModuleModal();
  });
}

function syncCorpCtaPresentation(view) {
  const ctaLabel = ctaBtn?.querySelector('.module-modal__cta-label');
  const ctaIcon = ctaBtn?.querySelector('.module-modal__cta-icon');
  if (!ctaLabel || !ctaIcon) return;

  if (view === 'feedback') {
    ctaLabel.textContent = 'Play again';
    ctaIcon.innerHTML = MODAL_REPEAT_ICON_SVG;
    ctaIcon.classList.remove('is-hidden');
    return;
  }

  if (view === 'detail') {
    ctaLabel.textContent = 'Play';
    ctaIcon.innerHTML = MODAL_PLAY_ICON_SVG;
    ctaIcon.classList.remove('is-hidden');
  }
}

function setView(view) {
  modalState.view = view;
  panelEl.dataset.view = view;

  const corp = usesCorpDetailLayout();
  detailBlock.hidden = view !== 'detail';
  if (feedbackBlock) feedbackBlock.hidden = view !== 'feedback';
  if (feedbackBottomEl) feedbackBottomEl.hidden = view !== 'feedback';
  playBlock.hidden = view !== 'choices';
  syncFeedbackActionsPlacement(view);

  if (corp) {
    ctaBtn.hidden = view === 'choices';
    backBtn.hidden = view === 'detail' || view === 'feedback';
    syncCorpCtaPresentation(view);
    applyCorporatePanelFrameForCurrentView();
    return;
  }

  ctaBtn.hidden = view !== 'detail';
  backBtn.hidden = false;
  ctaBtn.querySelector('.module-modal__cta-icon')?.classList.remove('is-hidden');
}

function syncFeedbackActionsPlacement(view = modalState.view) {
  if (!actionsEl || !feedbackBottomEl || !bodyMainEl) return;
  const corpFeedback = usesCorpDetailLayout() && view === 'feedback';
  if (corpFeedback) {
    if (actionsEl.parentElement !== feedbackBottomEl) feedbackBottomEl.append(actionsEl);
    return;
  }
  if (actionsEl.parentElement !== bodyMainEl) bodyMainEl.append(actionsEl);
}

function usesCorpDetailLayout() {
  return (
    isCorporateSkin() &&
    (modalState.corporatePathLayout || Boolean(rootEl?.classList.contains('module-modal--corporate-path')))
  );
}

function syncModalDomLayout() {
  if (!panelEl || !titleEl || !detailBlock) return;
  const corpDetail = usesCorpDetailLayout();
  panelEl.classList.toggle('module-modal__panel--corp-detail', corpDetail);
  rootEl?.classList.toggle('module-modal--corp-detail', corpDetail);

  if (!heroHeadEl || !skillsNavEl) return;

  const heroEl = panelEl.querySelector('.module-modal__hero');
  const bodyEl = panelEl.querySelector('.module-modal__body');

  if (corpDetail) {
    heroHeadEl.querySelector('.module-modal__hero-main')?.prepend(titleEl);
    if (skillsNavEl.parentElement !== detailBlock) {
      detailBlock.insertBefore(skillsNavEl, descEl);
    }
    if (heroEl && bodyEl && heroEl.parentElement === bodyEl) {
      panelEl.insertBefore(heroEl, panelEl.firstChild);
    }
    heroEl?.classList.add('module-modal__hero--corp-bg');
    return;
  }

  heroEl?.classList.remove('module-modal__hero--corp-bg');
  if (heroEl && bodyEl && heroEl.parentElement === panelEl) {
    bodyEl.appendChild(heroEl);
  }

  if (titleEl.parentElement !== detailBlock) {
    detailBlock.insertBefore(titleEl, skillsNavEl);
  }
}

function renderModalHeaderStars(count) {
  if (!headerStarsEl) return;
  headerStarsEl.innerHTML = '';
  headerStarsEl.setAttribute('aria-hidden', count ? 'false' : 'true');
  if (count) headerStarsEl.setAttribute('aria-label', `${count} of 5 stars earned`);
  else headerStarsEl.removeAttribute('aria-label');

  for (let i = 0; i < 5; i++) {
    const star = document.createElement('span');
    star.className = `module-star${i < count ? ' is-filled' : ''}`;
    star.innerHTML = MODAL_STAR_SVG;
    headerStarsEl.appendChild(star);
  }
}

function certifyLabelForModule(mod) {
  const gate = MODULE_STAR_UNLOCK_GATES[mod.id];
  if (gate?.minStars) return `${gate.minStars}★ to certify`;
  if (mod.modal?.certifyLabel) return mod.modal.certifyLabel;
  return '4★ to certify';
}

function playtimeLabelForMeta(meta, mod) {
  if (meta.playtime && meta.playtime !== '—') {
    const raw = String(meta.playtime).trim();
    const withTilde = raw.startsWith('~') ? raw : `~${raw}`;
    return /\bplaytime\b/i.test(withTilde) ? withTilde : `${withTilde} playtime`;
  }
  if (mod.start) return '~1min playtime';
  return '~1min playtime';
}

function corporateSkillsForModule(mod) {
  if (Array.isArray(mod.modal?.skills)) {
    return mod.modal.skills.filter((item) => item?.label);
  }

  const meta = modalMeta(mod);
  if (mod.start && !meta.showStats) return [];

  const focus = MODULE_SKILL_FOCUS[mod.id];
  const idx = focus != null ? CORPORATE_SKILL_FOCUS_INDEX[focus] : null;
  if (idx == null) return [];

  return [{ label: CORPORATE_MODAL_SKILL_NAV[idx].label }];
}

function populateSkillsNav(mod) {
  if (!skillsNavEl) return;
  const items = corporateSkillsForModule(mod);

  skillsNavEl.innerHTML = '';
  skillsNavEl.hidden = items.length === 0;
  detailBlock?.classList.toggle('module-modal__detail--solo', items.length === 0);

  for (const item of items) {
    const row = document.createElement('p');
    row.className = 'module-modal__skill';
    row.textContent = item.label;
    skillsNavEl.appendChild(row);
  }
}

function shouldShowModuleFeedback(mod) {
  if (!usesCorpDetailLayout()) return false;
  if (!hadEarnedStarsBeforePlay(mod.id)) return false;
  if (starsForModule(mod) < 1) return false;
  const score = getModuleEmpathyScore(mod.id);
  if (score != null) return true;
  return Boolean(mod.modal?.showStats);
}

function modulePointsForDisplay(mod) {
  const score = getModuleEmpathyScore(mod.id);
  if (score != null) return leaderboardPointsFromEmpathy(score);
  const estimated = computeEmpathyScore(mod, null);
  return estimated != null ? leaderboardPointsFromEmpathy(estimated) : 0;
}

function moduleMaxPointsForDisplay() {
  return leaderboardPointsFromEmpathy(EMPATHY_SCORE_CEIL);
}

function focusSkillRowIndex(mod) {
  const items = corporateSkillsForModule(mod);
  if (items.length <= 1) return 0;

  const focus = MODULE_SKILL_FOCUS[mod.id];
  const focusIdx = focus != null ? CORPORATE_SKILL_FOCUS_INDEX[focus] : null;
  const focusLabel =
    focusIdx != null ? CORPORATE_MODAL_SKILL_NAV[focusIdx]?.label : null;
  if (!focusLabel) return 0;

  const rowIdx = items.findIndex((item) => item.label === focusLabel);
  return rowIdx >= 0 ? rowIdx : 0;
}

/** Per-skill bar fill (0–100) derived from module empathy score. */
function skillBarRowsForModule(mod) {
  const items = corporateSkillsForModule(mod);
  if (!items.length) return [];

  const score =
    getModuleEmpathyScore(mod.id) ?? computeEmpathyScore(mod, null) ?? EMPATHY_SCORE_FOUR_STARS;
  const span = EMPATHY_SCORE_CEIL - EMPATHY_SCORE_FLOOR;
  const base = Math.max(
    30,
    Math.min(90, Math.round(((score - EMPATHY_SCORE_FLOOR) / span) * 100))
  );
  const focusIdx = focusSkillRowIndex(mod);
  const deltas = [-14, 6, -4, 10];

  return items.map((item, i) => {
    let percent = items.length === 1 ? base : base + (deltas[i] ?? 0);
    if (i === focusIdx) percent = Math.min(96, percent + (items.length === 1 ? 8 : 20));
    else if (items.length > 1) percent = Math.max(20, percent - 6);
    return {
      label: item.label,
      percent: Math.max(18, Math.min(96, percent))
    };
  });
}

function feedbackCopyForModule(mod) {
  if (mod.modal?.feedback) return mod.modal.feedback;
  const scenario = getPlayScenario(mod.id);
  const last = mod.lastChoice;
  if (scenario && last) {
    const outcome = scenario.outcomes.find((o) => o.lastChoice === last);
    if (outcome?.result) return outcome.result;
  }
  return (
    mod.modal?.feedbackDefault ??
    'Your choices shaped how this scenario played out. Replay the module to try a different path and improve your skill balance.'
  );
}

function renderFeedbackSkillBars(mod) {
  if (!feedbackSkillsEl) return;
  feedbackSkillsEl.innerHTML = '';
  for (const row of skillBarRowsForModule(mod)) {
    const item = document.createElement('div');
    item.className = 'module-modal__feedback-skill';
    item.setAttribute('role', 'listitem');

    const label = document.createElement('p');
    label.className = 'module-modal__feedback-skill-label';
    label.textContent = row.label;

    const track = document.createElement('div');
    track.className = 'module-modal__feedback-skill-track';
    track.setAttribute('role', 'meter');
    track.setAttribute('aria-label', row.label);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(row.percent));

    const fill = document.createElement('div');
    fill.className = 'module-modal__feedback-skill-fill';
    fill.style.width = `${row.percent}%`;

    track.appendChild(fill);
    item.append(label, track);
    feedbackSkillsEl.appendChild(item);
  }
}

function populateFeedbackView(mod) {
  renderFeedbackSkillBars(mod);
  const current = modulePointsForDisplay(mod);
  const max = moduleMaxPointsForDisplay();
  if (feedbackPointsCurrentEl) {
    feedbackPointsCurrentEl.textContent = current.toLocaleString('en-US');
  }
  if (feedbackPointsMaxEl) {
    feedbackPointsMaxEl.textContent = ` / ${max.toLocaleString('en-US')}`;
  }
  if (feedbackDescEl) feedbackDescEl.textContent = mod.description ?? '';
  if (feedbackTextEl) {
    const coaching = feedbackCopyForModule(mod);
    feedbackTextEl.textContent = coaching;
    feedbackTextEl.hidden = !coaching || coaching === (mod.description ?? '');
  }
}

function populateCorporateHeader(mod, meta, { feedback = false } = {}) {
  if (!usesCorpDetailLayout()) return;
  const earned = starsForModule(mod);
  renderModalHeaderStars(earned);
  if (headerCertifyEl) headerCertifyEl.textContent = certifyLabelForModule(mod);
  if (headerPlaytimeEl) {
    headerPlaytimeEl.hidden = false;
    headerPlaytimeEl.textContent = playtimeLabelForMeta(meta, mod);
  }
  if (headerPointsEl) headerPointsEl.hidden = true;
  if (!feedback) populateSkillsNav(mod);
}

function isCorporateSkin() {
  return document.documentElement.dataset.skin === 'corporate';
}

function getCorporatePathHost() {
  return (
    document.querySelector('.intro-corporate-board__main') ??
    document.getElementById('modules')
  );
}

function rectWithinHost(host, el) {
  const hostRect = host.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    left: elRect.left - hostRect.left,
    top: elRect.top - hostRect.top,
    width: elRect.width,
    height: elRect.height
  };
}

/** Expanded chapter panel — ~60% of main column (detail) or wider for played feedback. */
function corporatePanelTargetRect({ feedback = false } = {}) {
  const host = getCorporatePathHost();
  if (!host) return null;

  const w = host.clientWidth;
  const h = host.clientHeight;
  if (w < 1 || h < 1) return null;

  const ratio = feedback ? CORPORATE_MODULES_PANEL_FEEDBACK_RATIO : CORPORATE_MODULES_PANEL_RATIO;
  const width = Math.max(CORPORATE_MODULES_PANEL_MIN_W, Math.round(w * ratio));
  let height = Math.max(CORPORATE_MODULES_PANEL_MIN_H, Math.round(h * CORPORATE_MODULES_PANEL_HEIGHT_RATIO));
  const aspectFloor = Math.round(width * CORPORATE_MODULES_PANEL_MIN_ASPECT);
  const aspectCeil = Math.round(h * 0.92);
  height = Math.min(aspectCeil, Math.max(height, aspectFloor));
  const left = Math.round((w - width) * 0.5);
  const top = Math.round((h - height) * 0.5);

  return { left, top, width, height };
}

function applyCorporatePanelFrameForCurrentView() {
  if (!modalState.open || !modalState.corporatePathLayout || !panelEl) return;
  const target = corporatePanelTargetRect({ feedback: panelEl.dataset.view === 'feedback' });
  if (!target) return;
  applyCorporatePanelFrame(target);
}

function applyCorporatePanelFrame(target) {
  if (!panelEl || !target) return;
  panelEl.style.position = 'absolute';
  panelEl.style.left = `${target.left}px`;
  panelEl.style.top = `${target.top}px`;
  panelEl.style.width = `${target.width}px`;
  panelEl.style.height = `${target.height}px`;
  panelEl.style.maxWidth = 'none';
  panelEl.style.maxHeight = 'none';
  panelEl.style.margin = '0';
}

function clearCorporatePanelFrame() {
  if (!panelEl) return;
  for (const prop of ['position', 'left', 'top', 'width', 'height', 'maxWidth', 'maxHeight', 'margin']) {
    panelEl.style[prop] = '';
  }
}

function mountCorporatePathModal() {
  const host = getCorporatePathHost();
  if (!host || !rootEl) return false;
  if (rootEl.parentElement !== host) host.appendChild(rootEl);
  modalState.corporatePathLayout = true;
  rootEl.classList.add('module-modal--corporate-path');
  syncModalDomLayout();
  return true;
}

function unmountCorporatePathModal() {
  if (!rootEl) return;
  modalState.corporatePathLayout = false;
  rootEl.classList.remove('module-modal--corporate-path');
  if (rootEl.parentElement !== document.body) document.body.appendChild(rootEl);
  syncModalDomLayout();
}

function bindCorporateResize() {
  if (corporateResizeListener) return;
  corporateResizeListener = () => {
    if (!modalState.open || !modalState.corporatePathLayout) return;
    applyCorporatePanelFrameForCurrentView();
  };
  window.addEventListener('resize', corporateResizeListener);
}

function unbindCorporateResize() {
  if (!corporateResizeListener) return;
  window.removeEventListener('resize', corporateResizeListener);
  corporateResizeListener = null;
}

function corporateOriginWrap(sourceCard) {
  return sourceCard?.closest('.intro-module-wrap') ?? sourceCard;
}

function runCorporatePathOpen(sourceCard) {
  const host = getCorporatePathHost();
  const target = corporatePanelTargetRect({ feedback: panelEl?.dataset.view === 'feedback' });
  if (!host || !target) {
    unmountCorporatePathModal();
    sourceCard.classList.add('is-modal-source');
    runFlipOpen(sourceCard);
    return;
  }

  bindCorporateResize();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const origin = rectWithinHost(host, corporateOriginWrap(sourceCard));

  rootEl.classList.add('is-visible');
  rootEl.hidden = false;
  applyCorporatePanelFrame(target);

  if (reduced) {
    panelEl.style.transition = '';
    panelEl.style.transform = '';
    return;
  }

  const dx = origin.left - target.left;
  const dy = origin.top - target.top;
  const sx = origin.width / target.width;
  const sy = origin.height / target.height;

  panelEl.style.transition = 'none';
  panelEl.style.transformOrigin = 'top left';
  panelEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panelEl.style.transition = 'transform 0.5s cubic-bezier(0.16, 0.92, 0.18, 1)';
      panelEl.style.transform = '';
    });
  });
}

function runCorporatePathClose(onDone) {
  const host = getCorporatePathHost();
  const sourceCard = modalState.sourceCard;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!host || !sourceCard || !modalState.corporatePathLayout || reduced) {
    onDone();
    return;
  }

  const target = corporatePanelTargetRect({ feedback: panelEl?.dataset.view === 'feedback' });
  if (!target) {
    onDone();
    return;
  }

  applyCorporatePanelFrame(target);
  const origin = rectWithinHost(host, corporateOriginWrap(sourceCard));
  const dx = origin.left - target.left;
  const dy = origin.top - target.top;
  const sx = origin.width / target.width;
  const sy = origin.height / target.height;

  panelEl.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  panelEl.style.transformOrigin = 'top left';
  panelEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

  const onEnd = () => {
    panelEl.removeEventListener('transitionend', onEnd);
    onDone();
  };
  panelEl.addEventListener('transitionend', onEnd);
  window.setTimeout(onEnd, 450);
}

function populatePanel(mod, imageUrl) {
  const meta = modalMeta(mod);
  const scenario = getPlayScenario(mod.id);
  const chapterLabel = getChapterCapsLabel(mod);

  syncModalDomLayout();
  heroImg.src = imageUrl;
  heroImg.alt = mod.title ? `${mod.title} preview` : '';
  badgeEl.textContent = isCorporateSkin() && chapterLabel ? chapterLabel : meta.badge;
  titleEl.textContent = mod.title;
  descEl.textContent = mod.description;
  const hideLegacyStats = usesCorpDetailLayout();
  statsEl.classList.toggle('is-hidden', hideLegacyStats || !meta.showStats);
  if (meta.showStats) {
    statsEl.querySelector('[data-stat="lastChoice"]').textContent = meta.lastChoice ?? '—';
    statsEl.querySelector('[data-stat="playtime"]').textContent = meta.playtime ?? '—';
    statsEl.querySelector('[data-stat="bestRun"]').textContent = meta.bestRun ?? '—';
  }

  const showFeedback = shouldShowModuleFeedback(mod);
  populateCorporateHeader(mod, meta, { feedback: showFeedback });

  panelEl.style.setProperty('--module-hue', String(mod.hue ?? 205));

  const ctaLabel = ctaBtn.querySelector('.module-modal__cta-label');
  if (showFeedback) {
    populateFeedbackView(mod);
    setView('feedback');
  } else {
    const ctaText = scenario ? (usesCorpDetailLayout() ? 'Play' : meta.cta) : 'Close';
    if (ctaLabel) ctaLabel.textContent = ctaText;
    else ctaBtn.textContent = ctaText;
    setView('detail');
  }
  choicesEl.innerHTML = '';
  syncModalDomLayout();
}

function onOutcomePick(outcome) {
  playModuleHoverClick({ bypassThrottle: true });

  if (outcome.plugWire && modalState.onPlugWire) {
    const { mod, sourceCard, onPlugWire } = modalState;
    closeModuleModal(() => {
      onPlugWire(mod, outcome, sourceCard);
    });
    return;
  }

  const { mod, onProgress } = modalState;
  const playMode = playModeBeforeOutcome(mod.id);
  const { newlyUnlocked, starGateBlocked } = applyPlayOutcome(mod.id, outcome);
  recordPlayActivity(mod, outcome, newlyUnlocked, { playMode });
  closeModuleModal(() => {
    onProgress?.(newlyUnlocked, mod.id, { starGateBlocked });
  });
}

function renderPlayChoices(scenario) {
  playPromptEl.textContent = scenario.choicesPrompt;
  choicesEl.innerHTML = '';

  for (const outcome of scenario.outcomes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const dir = outcome.direction ? ` module-modal__choice--${outcome.direction}` : '';
    btn.className = `module-modal__choice${dir}`;

    if (outcome.direction) {
      const dirEl = document.createElement('span');
      dirEl.className = 'module-modal__choice-dir';
      dirEl.setAttribute('aria-hidden', 'true');
      dirEl.textContent = outcome.direction === 'up' ? '↑' : '↓';
      btn.appendChild(dirEl);
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'module-modal__choice-label';
    labelEl.textContent = outcome.label;
    btn.appendChild(labelEl);

    if (outcome.hint) {
      const hintEl = document.createElement('span');
      hintEl.className = 'module-modal__choice-hint';
      hintEl.textContent = outcome.hint;
      btn.appendChild(hintEl);
    }

    btn.addEventListener('click', () => onOutcomePick(outcome));
    choicesEl.appendChild(btn);
  }

  setView('choices');
}

function onCtaClick() {
  const scenario = getPlayScenario(modalState.mod?.id);
  if (!scenario) {
    closeModuleModal();
    return;
  }
  playModuleHoverClick({ bypassThrottle: true });
  renderPlayChoices(scenario);
}

function onBackClick() {
  if (modalState.view === 'choices') {
    const mod = modalState.mod;
    if (mod && shouldShowModuleFeedback(mod)) {
      populateFeedbackView(mod);
      populateCorporateHeader(mod, modalMeta(mod), { feedback: true });
      setView('feedback');
    } else {
      setView('detail');
    }
    return;
  }
  closeModuleModal();
}

function runFlipOpen(sourceCard) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const first = sourceCard.getBoundingClientRect();

  panelEl.style.transition = 'none';
  panelEl.style.transformOrigin = 'top left';
  rootEl.classList.add('is-visible');
  rootEl.hidden = false;

  const last = panelEl.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;

  if (reduced) {
    panelEl.style.transform = '';
    panelEl.style.transition = '';
    return;
  }

  panelEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panelEl.style.transition = 'transform 0.48s cubic-bezier(0.16, 0.92, 0.18, 1)';
      panelEl.style.transform = '';
    });
  });
}

function runFlipClose(onDone) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sourceCard = modalState.sourceCard;

  if (!sourceCard || reduced || !panelEl) {
    onDone();
    return;
  }

  const first = panelEl.getBoundingClientRect();
  const last = sourceCard.getBoundingClientRect();
  const dx = last.left - first.left;
  const dy = last.top - first.top;
  const sx = last.width / first.width;
  const sy = last.height / first.height;

  panelEl.style.transition = 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)';
  panelEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

  const onEnd = () => {
    panelEl.removeEventListener('transitionend', onEnd);
    onDone();
  };
  panelEl.addEventListener('transitionend', onEnd);
  window.setTimeout(onEnd, 420);
}

/**
 * @param {object} mod — runtime module
 * @param {HTMLElement} sourceCard
 * @param {{ imageUrl?: string, onClose?: () => void, onProgress?: (unlockedIds: string[], moduleId: string) => void, onPlugWire?: (mod: object, outcome: object, sourceCard: HTMLElement) => void }} [options]
 */
export function openModuleModal(mod, sourceCard, options = {}) {
  if (!mod || !sourceCard || modalState.open) return;

  ensureDom();

  modalState.open = true;
  modalState.moduleId = mod.id;
  modalState.mod = mod;
  modalState.sourceCard = sourceCard;
  modalState.onClose = options.onClose ?? null;
  modalState.onProgress = options.onProgress ?? null;
  modalState.onPlugWire = options.onPlugWire ?? null;

  sourceCard.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('is-module-modal-open');

  const imageUrl = options.imageUrl ?? sourceCard.querySelector('img')?.src ?? '';
  const canUsePathModal =
    isCorporateSkin() && Boolean(getCorporatePathHost()) && Boolean(corporatePanelTargetRect());

  if (canUsePathModal && mountCorporatePathModal()) {
    const originWrap = corporateOriginWrap(sourceCard);
    originWrap?.classList.add('is-modal-origin');
    originWrap?.classList.remove('intro-module-wrap--next-play');
    populatePanel(mod, imageUrl);
    runCorporatePathOpen(sourceCard);
  } else {
    unmountCorporatePathModal();
    syncModalDomLayout();
    populatePanel(mod, imageUrl);
    sourceCard.classList.add('is-modal-source');
    runFlipOpen(sourceCard);
  }

  closeBtn.focus();
}

export function closeModuleModal(afterClose) {
  if (!modalState.open) return;

  const { sourceCard, onClose } = modalState;
  const done = typeof afterClose === 'function' ? afterClose : onClose;

  const finish = () => {
    rootEl.classList.remove('is-visible');
    rootEl.hidden = true;
    panelEl.style.transition = '';
    panelEl.style.transform = '';
    clearCorporatePanelFrame();
    unmountCorporatePathModal();
    unbindCorporateResize();
    document.documentElement.classList.remove('is-module-modal-open');

    if (sourceCard) {
      sourceCard.classList.remove('is-modal-source', 'is-modal-origin');
      corporateOriginWrap(sourceCard)?.classList.remove('is-modal-origin');
      sourceCard.removeAttribute('aria-expanded');
    }

    modalState.open = false;
    modalState.moduleId = null;
    modalState.mod = null;
    modalState.sourceCard = null;
    modalState.onClose = null;
    modalState.onProgress = null;
    modalState.onPlugWire = null;
    modalState.corporatePathLayout = false;
    setView('detail');
    if (typeof window !== 'undefined' && document.getElementById('intro-columns')) {
      window.dispatchEvent(new CustomEvent('wf-sync-next-play-glow'));
    }
    done?.();
  };

  if (modalState.corporatePathLayout) {
    runCorporatePathClose(finish);
    return;
  }

  rootEl.classList.remove('is-visible');
  runFlipClose(finish);
}

export function isModuleModalOpen() {
  return modalState.open;
}

export function initModuleModal() {
  ensureDom();
}
