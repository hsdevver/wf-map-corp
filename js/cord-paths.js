/** Unit normal for exit/entry handles on each card side. */
const SIDE_NORMAL = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1]
};

/**
 * Anchor on a module wrap rect (map-local coordinates).
 * @param {DOMRect} rect
 * @param {'left'|'right'|'top'|'bottom'} side
 * @param {DOMRect} containerRect
 */
/**
 * @param {number} [along] — 0–1 position along vertical sides (left/right) or horizontal (top/bottom)
 */
export function anchorFromRect(rect, side, containerRect, along = 0.5) {
  const left = rect.left - containerRect.left;
  const top = rect.top - containerRect.top;
  const right = rect.right - containerRect.left;
  const bottom = rect.bottom - containerRect.top;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const t = Math.max(0, Math.min(1, along));

  switch (side) {
    case 'left':
      return { x: left, y: top + (bottom - top) * t };
    case 'right':
      return { x: right, y: top + (bottom - top) * t };
    case 'top':
      return { x: left + (right - left) * t, y: top };
    case 'bottom':
      return { x: left + (right - left) * t, y: bottom };
    default:
      return { x: cx, y: cy };
  }
}

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const u2 = u * u;
  const t2 = t * t;
  const u3 = u2 * u;
  const t3 = t2 * t;
  return {
    x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
    y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y
  };
}

function cubicTangentAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
  };
}

/**
 * Cubic centerline control points (shared by rope stroke and organic bridge).
 */
export function cordCurveControls(p0, fromSide, p3, toSide, options = {}) {
  const slack = options.slack ?? 1;
  const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y) || 1;
  const handle = Math.max(38, dist * 0.44) * slack;

  const [ex, ey] = SIDE_NORMAL[fromSide] ?? [1, 0];
  const [ix, iy] = SIDE_NORMAL[toSide] ?? [-1, 0];

  const nx = -(p3.y - p0.y) / dist;
  const ny = (p3.x - p0.x) / dist;

  const phase = options.phase ?? 0;
  const phaseOff = options.phaseOffset ?? 0;
  const breeze = options.breezePhase ?? phase;

  const wobbleAmp = options.wobbleAmp ?? Math.min(4.5, dist * 0.024);
  const wobble =
    Math.sin(breeze + phaseOff) * wobbleAmp +
    Math.sin(breeze * 1.43 + phaseOff * 1.05) * wobbleAmp * 0.36 +
    Math.sin(breeze * 0.68 + phaseOff * 1.55) * wobbleAmp * 0.2;

  const breezeDriftX = Math.sin(breeze * 0.41 + phaseOff * 0.8) * wobbleAmp * 0.28;
  const breezeDriftY = Math.cos(breeze * 0.52 + phaseOff * 1.2) * wobbleAmp * 0.18;

  const sagBase = options.sag ?? dist * 0.17;
  const sagPulse = 1 + Math.sin(phase * 0.62 + (options.sagOffset ?? 0)) * 0.07;
  const plugSettle = Math.max(0, Math.min(1, options.plugSettle ?? 0));

  const gravSign = options.sagSign ?? 1;
  const hang = sagBase * sagPulse * gravSign;
  const gravityY = dist * 0.022 + hang * 0.42 + plugSettle * dist * 0.028;

  const hangX = nx * hang + wobble + breezeDriftX;
  const hangY = ny * hang + breezeDriftY + gravityY;

  const entryShorten = 1 - plugSettle * 0.34;
  const exitShorten = 1 - plugSettle * 0.1;
  const tuckIntoPort = plugSettle * handle * 0.26;

  let p1x = p0.x + ex * handle * exitShorten + hangX;
  let p1y = p0.y + ey * handle * exitShorten + hangY * 0.45;
  let p2x =
    p3.x - ix * handle * entryShorten + hangX * 0.72 - wobble * 0.45 - ix * tuckIntoPort;
  let p2y =
    p3.y - iy * handle * entryShorten + hangY * 0.95 + iy * tuckIntoPort * 0.55;

  const pull = options.stretchPull;
  if (pull && pull.amt > 0.002) {
    const midX = (p0.x + p3.x) * 0.5;
    const midY = (p0.y + p3.y) * 0.5;
    const pullX = (pull.x - midX) * pull.amt * 0.88;
    const pullY = (pull.y - midY) * pull.amt * 0.88;
    p1x += pullX * 0.92;
    p1y += pullY * 0.92;
    p2x += pullX * 0.78;
    p2y += pullY * 0.78;
  }

  return {
    p0,
    p1: { x: p1x, y: p1y },
    p2: { x: p2x, y: p2y },
    p3
  };
}

/**
 * Slack cubic-bezier rope with gravity hang, breeze drift, and plug-in settle.
 */
export function cordPathD(p0, fromSide, p3, toSide, options = {}) {
  const { p0: s, p1, p2, p3: e } = cordCurveControls(p0, fromSide, p3, toSide, options);
  return `M ${s.x} ${s.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${e.x} ${e.y}`;
}

/** Point along the centerline at parameter t ∈ [0, 1]. */
export function cordCenterlinePoint(p0, fromSide, p3, toSide, t, options = {}) {
  const curve = cordCurveControls(p0, fromSide, p3, toSide, options);
  return cubicAt(curve.p0, curve.p1, curve.p2, curve.p3, Math.max(0, Math.min(1, t)));
}

function smoothRibbonEdge(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const mx = (prev.x + curr.x) * 0.5;
    const my = (prev.y + curr.y) * 0.5;
    d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)}, ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
}

/**
 * Organic taffy bridge — filled ribbon bulging at card ends, pinched in the middle.
 * `reveal` (0–1) grows the bridge along the centerline for plug-in animation.
 */
export function cordBridgePathD(p0, fromSide, p3, toSide, options = {}) {
  const curve = cordCurveControls(p0, fromSide, p3, toSide, options);
  const dist = Math.hypot(curve.p3.x - curve.p0.x, curve.p3.y - curve.p0.y) || 1;
  const reveal = Math.max(0.02, Math.min(1, options.reveal ?? 1));

  const endBulge = options.endWidth ?? Math.max(34, dist * 0.155);
  const midPinch = options.midWidth ?? Math.max(8, endBulge * 0.22);

  const phase = options.phase ?? 0;
  const phaseOff = options.phaseOffset ?? 0;
  const breathe = 1 + Math.sin(phase * 0.55 + phaseOff) * 0.035;

  const sampleCount = Math.max(18, Math.min(44, Math.round(dist / 22)));
  const steps = Math.max(3, Math.ceil(sampleCount * reveal));

  const upper = [];
  const lower = [];

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * reveal;
    const pt = cubicAt(curve.p0, curve.p1, curve.p2, curve.p3, t);
    const tan = cubicTangentAt(curve.p0, curve.p1, curve.p2, curve.p3, t);
    const tLen = Math.hypot(tan.x, tan.y) || 1;
    const nx = -tan.y / tLen;
    const ny = tan.x / tLen;

    const pinch = Math.pow(Math.sin(t * Math.PI), 0.68);
    let halfW = (midPinch + (endBulge - midPinch) * (1 - pinch)) * 0.5 * breathe;

    const ripple =
      Math.sin(t * 11 + phase + phaseOff) * dist * 0.0035 +
      Math.sin(t * 6.2 + phaseOff * 1.3) * dist * 0.002;
    halfW += ripple;

    if (reveal < 1 && i === steps) {
      halfW *= 0.42;
    }

    upper.push({ x: pt.x + nx * halfW, y: pt.y + ny * halfW });
    lower.push({ x: pt.x - nx * halfW, y: pt.y - ny * halfW });
  }

  const upperD = smoothRibbonEdge(upper);
  const lowerD = smoothRibbonEdge([...lower].reverse());
  return `${upperD} ${lowerD} Z`;
}

/**
 * Orthogonal “subway map” connector — horizontal lanes, vertical joins, rounded elbows.
 * Matches Vignelli-style diagram paths (flow-map connectorPath, tuned for intro cords).
 */
const SUBWAY_CARD_CLEARANCE = 14;

function segmentHitsRectAxisAligned(x0, y0, x1, y1, rect, pad) {
  const left = rect.left - pad;
  const right = rect.right + pad;
  const top = rect.top - pad;
  const bottom = rect.bottom + pad;
  const xs = Math.min(x0, x1);
  const xe = Math.max(x0, x1);
  const ys = Math.min(y0, y1);
  const ye = Math.max(y0, y1);

  if (Math.abs(y0 - y1) < 0.5) {
    if (y0 < top || y0 > bottom) return false;
    return xe >= left && xs <= right;
  }
  if (Math.abs(x0 - x1) < 0.5) {
    if (x0 < left || x0 > right) return false;
    return ye >= top && ys <= bottom;
  }
  return false;
}

function subwayVerticalHits(x, y0, y1, obstacles, pad) {
  for (const rect of obstacles) {
    if (segmentHitsRectAxisAligned(x, y0, x, y1, rect, pad)) return true;
  }
  return false;
}

function subwayHorizontalHits(y, x0, x1, obstacles, pad) {
  for (const rect of obstacles) {
    if (segmentHitsRectAxisAligned(x0, y, x1, y, rect, pad)) return true;
  }
  return false;
}

/** Map-local module card rects for overlap checks. */
export function collectPathMapModuleRects(pathMapEl, excludeIds = []) {
  if (!pathMapEl) return [];
  const exclude = new Set(excludeIds);
  const mapRect = pathMapEl.getBoundingClientRect();
  const rects = [];
  pathMapEl.querySelectorAll('[data-module-anchor]').forEach((wrap) => {
    const id = wrap.getAttribute('data-module-anchor');
    if (!id || exclude.has(id)) return;
    const card = wrap.querySelector('.module-card') ?? wrap;
    const r = card.getBoundingClientRect();
    if (!r.width) return;
    rects.push({
      id,
      left: r.left - mapRect.left,
      right: r.right - mapRect.left,
      top: r.top - mapRect.top,
      bottom: r.bottom - mapRect.top
    });
  });
  return rects;
}

function findClearSubwayViaY(seg, obstacles, clearance, gutterLo, gutterHi, midX) {
  const candidates = [];
  candidates.push((seg.p0.y + seg.p3.y) * 0.5);

  const sorted = [...obstacles].sort((a, b) => a.top - b.top);
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapMid = (sorted[i].bottom + sorted[i + 1].top) * 0.5;
    if (gapMid > sorted[i].bottom + clearance) candidates.push(gapMid);
  }

  const seen = new Set();
  for (const y of candidates) {
    const key = Math.round(y);
    if (seen.has(key)) continue;
    seen.add(key);
    if (subwayVerticalHits(midX, seg.p0.y, y, obstacles, clearance)) continue;
    if (subwayVerticalHits(midX, y, seg.p3.y, obstacles, clearance)) continue;
    if (subwayHorizontalHits(y, gutterLo, gutterHi, obstacles, clearance)) continue;
    return y;
  }
  return null;
}

/** Snap map-local points for crisp axis-aligned strokes. */
function snapOrthogonalPoint(p) {
  return { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 };
}

/** Collapse duplicate / collinear polyline points. */
function simplifyOrthogonalPoints(points) {
  if (!points?.length) return [];
  const clean = [snapOrthogonalPoint(points[0])];
  for (let i = 1; i < points.length; i++) {
    const curr = snapOrthogonalPoint(points[i]);
    const prev = clean[clean.length - 1];
    if (Math.abs(prev.x - curr.x) < 0.25 && Math.abs(prev.y - curr.y) < 0.25) continue;
    const prev2 = clean[clean.length - 2];
    if (prev2) {
      const horizontal =
        Math.abs(prev2.y - prev.y) < 0.25 && Math.abs(prev.y - curr.y) < 0.25;
      const vertical =
        Math.abs(prev2.x - prev.x) < 0.25 && Math.abs(prev.x - curr.x) < 0.25;
      if (horizontal || vertical) {
        clean[clean.length - 1] = curr;
        continue;
      }
    }
    clean.push(curr);
  }
  return clean;
}

/** Axis-aligned polyline with rounded 90° elbows (H/V segments only). */
function orthogonalPathWithRoundedCorners(points, radius = 26) {
  const clean = simplifyOrthogonalPoints(points);
  if (clean.length < 2) return '';

  let d = `M ${clean[0].x.toFixed(2)} ${clean[0].y.toFixed(2)}`;
  for (let i = 1; i < clean.length; i++) {
    const prev = clean[i - 1];
    const curr = clean[i];
    const next = clean[i + 1];
    if (!next) {
      d += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
      break;
    }
    const r = Math.min(
      radius,
      Math.hypot(curr.x - prev.x, curr.y - prev.y) * 0.42,
      Math.hypot(next.x - curr.x, next.y - curr.y) * 0.42
    );
    if (r < 2) {
      d += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
      continue;
    }
    const inDx = curr.x - prev.x;
    const inDy = curr.y - prev.y;
    const inLen = Math.hypot(inDx, inDy) || 1;
    const outDx = next.x - curr.x;
    const outDy = next.y - curr.y;
    const outLen = Math.hypot(outDx, outDy) || 1;
    const pIn = {
      x: curr.x - (inDx / inLen) * r,
      y: curr.y - (inDy / inLen) * r
    };
    const pOut = {
      x: curr.x + (outDx / outLen) * r,
      y: curr.y + (outDy / outLen) * r
    };
    d += ` L ${pIn.x.toFixed(2)} ${pIn.y.toFixed(2)}`;
    d += ` Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${pOut.x.toFixed(2)} ${pOut.y.toFixed(2)}`;
  }
  return d;
}

function resolveSubwayCornerRadius(fromX, fromY, toX, toY, options = {}, laneGap = 28) {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  return (
    options.radius ??
    Math.min(40, Math.max(20, Math.abs(dy) * 0.22, Math.abs(dx) * 0.1, laneGap * 0.55))
  );
}

function appendOrthogonalCorner(pts, x, y) {
  const last = pts[pts.length - 1];
  if (!last) {
    pts.push({ x, y });
    return;
  }
  if (Math.abs(last.x - x) < 0.25 && Math.abs(last.y - y) < 0.25) return;
  pts.push({ x, y });
}

/** Right→left detour — bend only on the mid gutter (no Z across exit lane). */
function subwayPathRightLeftViaY(fromX, fromY, toX, toY, laneGap, radius, midX, viaY) {
  const dirX = toX >= fromX ? 1 : -1;
  const exitX = fromX + dirX * laneGap;
  const entryX = toX - dirX * laneGap;
  const pts = [{ x: fromX, y: fromY }];
  appendOrthogonalCorner(pts, exitX, fromY);
  appendOrthogonalCorner(pts, midX, fromY);
  if (Math.abs(fromY - viaY) > 0.5) appendOrthogonalCorner(pts, midX, viaY);
  if (Math.abs(viaY - toY) > 0.5) appendOrthogonalCorner(pts, midX, toY);
  appendOrthogonalCorner(pts, entryX, toY);
  appendOrthogonalCorner(pts, toX, toY);
  return orthogonalPathWithRoundedCorners(pts, radius);
}

/** Same-row gutter bus — one horizontal lane between columns. */
function subwayPathRightLeftFlat(fromX, fromY, toX, toY, laneGap, radius, busY) {
  const dirX = toX >= fromX ? 1 : -1;
  const exitX = fromX + dirX * laneGap;
  const entryX = toX - dirX * laneGap;
  const y = busY ?? (fromY + toY) * 0.5;
  return orthogonalPathWithRoundedCorners(
    [
      { x: fromX, y },
      { x: exitX, y },
      { x: entryX, y },
      { x: toX, y }
    ],
    radius
  );
}

/** Right→left subway trunk — horizontal stubs, vertical gutter, horizontal entry. */
function subwayPathRightLeft(fromX, fromY, toX, toY, laneGap = 28, radius = 26, midXOverride = null) {
  if (Math.abs(fromY - toY) < 1) {
    return orthogonalPathWithRoundedCorners(
      [
        { x: fromX, y: fromY },
        { x: toX, y: toY }
      ],
      radius
    );
  }

  const dirX = toX >= fromX ? 1 : -1;
  const exitX = fromX + dirX * laneGap;
  const entryX = toX - dirX * laneGap;
  const midX = midXOverride ?? (exitX + entryX) / 2;

  const pts = [{ x: fromX, y: fromY }];
  appendOrthogonalCorner(pts, exitX, fromY);
  appendOrthogonalCorner(pts, midX, fromY);
  appendOrthogonalCorner(pts, midX, toY);
  appendOrthogonalCorner(pts, entryX, toY);
  appendOrthogonalCorner(pts, toX, toY);
  return orthogonalPathWithRoundedCorners(pts, radius);
}

/** Body stroke width — parallel lanes touch with no gutter (corporate subway). */
export const SUBWAY_LANE_PITCH = 11;

/** Horizontal spacing between vertical subway trunks (avoids tube crossings). */
export const SUBWAY_MID_LANE_PITCH = 28;

/** @deprecated Use subwayJunctionLanePitch — kept for older imports */
export const SUBWAY_FROM_FAN_PITCH = 15;

/** Junction bands on card edges (keep in sync with consequence-flow SUBWAY_JUNCTION_ALONG). */
const SUBWAY_JUNCTION_ALONG_UPPER = 0.38;
const SUBWAY_JUNCTION_ALONG_LOWER = 0.62;

/**
 * Centerline spacing for tubes sharing a card edge (fork out / merge in).
 * Equal steps between upper · center · lower on a chapter card.
 */
export function subwayJunctionLanePitch(cardSizePx = 194) {
  const span = SUBWAY_JUNCTION_ALONG_LOWER - SUBWAY_JUNCTION_ALONG_UPPER;
  return Math.max(14, Math.round(cardSizePx * span * 0.5));
}

/**
 * Equal-spaced stack on one card edge — preserves upper→lower order from anchor along.
 */
function bundleJunctionEndpoints(list, end, pitch) {
  if (list.length < 2) return;
  const alongKey = end === 'p0' ? 'fromAlong' : 'toAlong';
  list.sort((a, b) => {
    const aa = a.anchorOpts?.[alongKey] ?? 0.5;
    const bb = b.anchorOpts?.[alongKey] ?? 0.5;
    if (Math.abs(aa - bb) > 0.001) return aa - bb;
    const ay = end === 'p0' ? a.p0.y : a.p3.y;
    const by = end === 'p0' ? b.p0.y : b.p3.y;
    return ay - by;
  });

  const ys = list.map((s) => (end === 'p0' ? s.p0.y : s.p3.y));
  const centerY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  const n = list.length;
  list.forEach((seg, i) => {
    const y = centerY + (i - (n - 1) / 2) * pitch;
    if (end === 'p0') seg.p0 = { x: seg.p0.x, y };
    else seg.p3 = { x: seg.p3.x, y };
  });
}

/**
 * Standard fork/merge spacing on shared card edges (same pitch for in and out).
 * @param {{ key: string, isSubway?: boolean, fromSide: string, toSide: string, p0: {x:number,y:number}, p3: {x:number,y:number}, anchorOpts?: object }[]} segments
 * @param {{ cardSizePx?: number, junctionPitch?: number } | number} [options] — legacy: number = junctionPitch override
 */
export function applySubwayLaneBundles(segments, options) {
  if (!segments?.length) return;

  let opts = options;
  if (typeof options === 'number') opts = { junctionPitch: options };
  opts = opts ?? {};

  const pitch = opts.junctionPitch ?? subwayJunctionLanePitch(opts.cardSizePx);

  const fromBuckets = new Map();
  const toBuckets = new Map();

  for (const seg of segments) {
    if (!seg.isSubway) continue;
    const [fromId, toId] = seg.key.split('|');
    const fromKey = `${fromId}\0${seg.fromSide}`;
    const toKey = `${toId}\0${seg.toSide}`;
    if (!fromBuckets.has(fromKey)) fromBuckets.set(fromKey, []);
    fromBuckets.get(fromKey).push(seg);
    if (!toBuckets.has(toKey)) toBuckets.set(toKey, []);
    toBuckets.get(toKey).push(seg);
  }

  for (const list of fromBuckets.values()) {
    if (list.length > 1) bundleJunctionEndpoints(list, 'p0', pitch);
  }
  for (const list of toBuckets.values()) {
    if (list.length > 1) bundleJunctionEndpoints(list, 'p3', pitch);
  }
}

/**
 * Stagger each edge's vertical trunk (midX) so parallel tubes between the same columns do not cross.
 * @param {{ key: string, isSubway?: boolean, fromSide: string, toSide: string, p0: {x:number,y:number}, p3: {x:number,y:number}, anchorOpts?: object }[]} segments
 */
export function applySubwayMidXLanes(segments, pitch = SUBWAY_MID_LANE_PITCH) {
  if (!segments?.length) return;

  const buckets = new Map();

  for (const seg of segments) {
    if (!seg.isSubway) continue;
    const rl = seg.fromSide === 'right' && seg.toSide === 'left';
    const lr = seg.fromSide === 'left' && seg.toSide === 'right';
    if (!rl && !lr) continue;

    const fromX = rl ? seg.p0.x : seg.p3.x;
    const toX = rl ? seg.p3.x : seg.p0.x;
    const key = `${Math.round(fromX / 12)}|${Math.round(toX / 12)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ seg, rl });
  }

  for (const list of buckets.values()) {
    const n = list.length;
    const lanePitch = pitch + Math.max(0, n - 2) * 6;

    list.sort((a, b) => {
      const al = a.seg.anchorOpts?.subwayLane;
      const bl = b.seg.anchorOpts?.subwayLane;
      if (al != null && bl != null && al !== bl) return al - bl;
      const aMid = (a.seg.p0.y + a.seg.p3.y) * 0.5;
      const bMid = (b.seg.p0.y + b.seg.p3.y) * 0.5;
      if (aMid !== bMid) return aMid - bMid;
      const ay = a.seg.p0.y;
      const by = b.seg.p0.y;
      if (ay !== by) return ay - by;
      return a.seg.p3.y - b.seg.p3.y;
    });

    list.forEach((item) => {
      const { seg, rl } = item;
      const from = rl ? seg.p0 : seg.p3;
      const to = rl ? seg.p3 : seg.p0;
      const dx = to.x - from.x;
      const dirX = dx >= 0 ? 1 : -1;
      const laneGap = Math.min(72, Math.max(28, Math.abs(dx) * 0.26 + Math.max(0, n - 2) * 3));
      const exitX = from.x + dirX * laneGap;
      const entryX = to.x - dirX * laneGap;
      const baseMidX = (exitX + entryX) * 0.5;
      const lane = seg.anchorOpts?.subwayLane;
      const offset = lane != null ? (lane - 1) * lanePitch : 0;
      const midX = baseMidX + offset;
      seg.anchorOpts = { ...seg.anchorOpts, subwayMidX: midX, subwayLaneGap: laneGap };
    });
  }
}

/**
 * Keep subway trunks in column gutters and bend around cards (never over module faces).
 * @param {{ key: string, isSubway?: boolean, fromSide: string, toSide: string, p0: {x:number,y:number}, p3: {x:number,y:number}, anchorOpts?: object }[]} segments
 * @param {HTMLElement | null} pathMapEl
 */
export function applySubwayClearOfCards(segments, pathMapEl, clearance = SUBWAY_CARD_CLEARANCE) {
  if (!pathMapEl || !segments?.length) return;

  const allRects = collectPathMapModuleRects(pathMapEl);

  for (const seg of segments) {
    if (!seg.isSubway) continue;
    const rl = seg.fromSide === 'right' && seg.toSide === 'left';
    const lr = seg.fromSide === 'left' && seg.toSide === 'right';
    if (!rl && !lr) continue;

    const [fromId, toId] = seg.key.split('|');
    const from = rl ? seg.p0 : seg.p3;
    const to = rl ? seg.p3 : seg.p0;
    const obstacles = allRects.filter((r) => r.id !== fromId && r.id !== toId);

    const dx = to.x - from.x;
    const dirX = dx >= 0 ? 1 : -1;
    const dist = Math.abs(dx) || 1;
    const laneGap =
      seg.anchorOpts?.subwayLaneGap ??
      Math.min(92, Math.max(40, dist * 0.34 + clearance));
    const exitX = from.x + dirX * laneGap;
    const entryX = to.x - dirX * laneGap;
    let gutterLo = Math.min(exitX, entryX);
    let gutterHi = Math.max(exitX, entryX);

    const fromRect = allRects.find((r) => r.id === fromId);
    const toRect = allRects.find((r) => r.id === toId);
    if (fromRect && toRect) {
      const innerLo = fromRect.right + clearance;
      const innerHi = toRect.left - clearance;
      if (innerHi > innerLo + 6) {
        gutterLo = Math.max(gutterLo, innerLo);
        gutterHi = Math.min(gutterHi, innerHi);
      }
    }

    if (gutterHi <= gutterLo + 4) {
      gutterLo = Math.min(exitX, entryX);
      gutterHi = Math.max(exitX, entryX);
    }

    let midX = seg.anchorOpts?.subwayMidX ?? (exitX + entryX) * 0.5;
    midX = Math.max(gutterLo + 2, Math.min(gutterHi - 2, midX));

    const y0 = from.y;
    const y1 = to.y;

    let laneGapOut = laneGap;
    for (let attempt = 0; attempt < 4; attempt++) {
      const ex = from.x + dirX * laneGapOut;
      if (!subwayHorizontalHits(y0, from.x, ex, obstacles, clearance)) break;
      laneGapOut = Math.min(96, laneGapOut + 10);
    }

    const exitX2 = from.x + dirX * laneGapOut;
    const entryX2 = to.x - dirX * laneGapOut;
    gutterLo = Math.min(exitX2, entryX2);
    gutterHi = Math.max(exitX2, entryX2);
    if (fromRect && toRect) {
      const innerLo = fromRect.right + clearance;
      const innerHi = toRect.left - clearance;
      if (innerHi > innerLo + 6) {
        gutterLo = Math.max(gutterLo, innerLo);
        gutterHi = Math.min(gutterHi, innerHi);
      }
    }
    midX = Math.max(gutterLo + 2, Math.min(gutterHi - 2, midX));

    const sameRowEps = 14;
    if (Math.abs(y0 - y1) <= sameRowEps) {
      const busY = (y0 + y1) * 0.5;
      if (!subwayHorizontalHits(busY, exitX2, entryX2, obstacles, clearance)) {
        seg.anchorOpts = {
          ...seg.anchorOpts,
          subwayMidX: midX,
          subwayLaneGap: laneGapOut,
          subwayViaY: undefined,
          subwayBusY: busY
        };
        continue;
      }
    }

    if (!subwayVerticalHits(midX, y0, y1, obstacles, clearance)) {
      seg.anchorOpts = {
        ...seg.anchorOpts,
        subwayMidX: midX,
        subwayLaneGap: laneGapOut,
        subwayViaY: undefined,
        subwayBusY: undefined
      };
      continue;
    }

    const steps = 28;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i <= steps; i++) {
      const x = gutterLo + (i / steps) * (gutterHi - gutterLo);
      if (!subwayVerticalHits(x, y0, y1, obstacles, clearance)) {
        const distMid = Math.abs(x - (seg.anchorOpts?.subwayMidX ?? midX));
        if (distMid < bestDist) {
          bestDist = distMid;
          best = x;
        }
      }
    }
    midX = best ?? midX;

    if (!subwayVerticalHits(midX, y0, y1, obstacles, clearance)) {
      seg.anchorOpts = {
        ...seg.anchorOpts,
        subwayMidX: midX,
        subwayLaneGap: laneGapOut,
        subwayViaY: undefined,
        subwayBusY: undefined
      };
      continue;
    }

    const viaY = findClearSubwayViaY(seg, obstacles, clearance, gutterLo, gutterHi, midX);
    seg.anchorOpts = {
      ...seg.anchorOpts,
      subwayMidX: midX,
      subwayLaneGap: laneGapOut,
      subwayViaY: viaY ?? undefined,
      subwayBusY: undefined
    };
  }
}

const SUBWAY_PAINT_DY_EPS = 4;

/** Signed vertical travel for a right→left subway edge (source → target). */
function subwayTrunkDy(seg) {
  const rl = seg.fromSide === 'right' && seg.toSide === 'left';
  return rl ? seg.p3.y - seg.p0.y : seg.p0.y - seg.p3.y;
}

/**
 * Paint-order for subway cords: downward edges under upward edges at elbows.
 * SVG stacks later siblings on top; call after lane bundling / midX stagger.
 * @param {{ key: string, isSubway?: boolean, fromSide: string, toSide: string, p0: {x:number,y:number}, p3: {x:number,y:number} }[]} segments
 */
export function sortSubwayCordPaintOrder(segments) {
  if (!segments?.length) return;

  const tier = (seg) => {
    if (!seg.isSubway) return 1;
    const dy = subwayTrunkDy(seg);
    if (dy > SUBWAY_PAINT_DY_EPS) return 0;
    if (dy < -SUBWAY_PAINT_DY_EPS) return 2;
    return 1;
  };

  segments.sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (a.p0.y !== b.p0.y) return a.p0.y - b.p0.y;
    if (a.p3.y !== b.p3.y) return a.p3.y - b.p3.y;
    return a.key.localeCompare(b.key);
  });
}

/**
 * Subway-style cord path for corporate intro — orthogonal H/V segments, softly rounded elbows.
 */
export function subwayCordPathD(p0, fromSide, p3, toSide, options = {}) {
  const dx = p3.x - p0.x;

  if (fromSide === 'right' && toSide === 'left') {
    const laneGap =
      options.subwayLaneGap ??
      options.laneGap ??
      Math.min(92, Math.max(40, Math.abs(dx) * 0.34));
    const radius = resolveSubwayCornerRadius(p0.x, p0.y, p3.x, p3.y, options, laneGap);
    if (options.subwayBusY != null) {
      return subwayPathRightLeftFlat(
        p0.x,
        p0.y,
        p3.x,
        p3.y,
        laneGap,
        radius,
        options.subwayBusY
      );
    }
    if (options.subwayViaY != null) {
      const dirX = p3.x >= p0.x ? 1 : -1;
      const exitX = p0.x + dirX * laneGap;
      const entryX = p3.x - dirX * laneGap;
      const mid =
        options.subwayMidX ??
        Math.max(Math.min(exitX, entryX), Math.min(Math.max(exitX, entryX), (exitX + entryX) * 0.5));
      return subwayPathRightLeftViaY(
        p0.x,
        p0.y,
        p3.x,
        p3.y,
        laneGap,
        radius,
        mid,
        options.subwayViaY
      );
    }
    return subwayPathRightLeft(p0.x, p0.y, p3.x, p3.y, laneGap, radius, options.subwayMidX);
  }

  if (fromSide === 'left' && toSide === 'right') {
    const laneGap =
      options.subwayLaneGap ??
      options.laneGap ??
      Math.min(92, Math.max(40, Math.abs(dx) * 0.34));
    const radius = resolveSubwayCornerRadius(p3.x, p3.y, p0.x, p0.y, options, laneGap);
    if (options.subwayBusY != null) {
      return subwayPathRightLeftFlat(
        p3.x,
        p3.y,
        p0.x,
        p0.y,
        laneGap,
        radius,
        options.subwayBusY
      );
    }
    if (options.subwayViaY != null) {
      const dirX = p0.x >= p3.x ? 1 : -1;
      const exitX = p3.x + dirX * laneGap;
      const entryX = p0.x - dirX * laneGap;
      const mid =
        options.subwayMidX ?? Math.max(Math.min(exitX, entryX), Math.min(Math.max(exitX, entryX), (exitX + entryX) * 0.5));
      return subwayPathRightLeftViaY(
        p3.x,
        p3.y,
        p0.x,
        p0.y,
        laneGap,
        radius,
        mid,
        options.subwayViaY
      );
    }
    return subwayPathRightLeft(p3.x, p3.y, p0.x, p0.y, laneGap, radius, options.subwayMidX);
  }

  return cordPathD(p0, fromSide, p3, toSide, options);
}

/** Stable phase offset per edge so ropes drift out of sync. */
export function cordPhaseOffset(edgeKey) {
  let hash = 0;
  for (let i = 0; i < edgeKey.length; i++) hash = (hash * 31 + edgeKey.charCodeAt(i)) | 0;
  return (hash % 628) / 100;
}

export function edgeKey(a, b) {
  return `${a}|${b}`;
}
