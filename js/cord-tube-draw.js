/**
 * SVG stroke "fluid through tube" draw — grows from the source chapter anchor along the cord path.
 */

export function cordRopeBodyPath(seg) {
  if (!seg) return null;
  return (
    seg.centerlinePath ??
    seg.paths?.find((p) => p.classList.contains('intro-cord-rope--body')) ??
    seg.paths?.find((p) => p.classList.contains('intro-cord-rope--active')) ??
    null
  );
}

/** True when path geometry starts at seg.p0 (exit side of source chapter). */
export function pathStartsAtSource(seg, body) {
  if (!seg?.p0 || !seg?.p3 || !body?.getPointAtLength) return true;
  try {
    const start = body.getPointAtLength(0);
    const d0 = Math.hypot(start.x - seg.p0.x, start.y - seg.p0.y);
    const d3 = Math.hypot(start.x - seg.p3.x, start.y - seg.p3.y);
    return d0 <= d3;
  } catch {
    return true;
  }
}

/**
 * @returns {{ body: SVGPathElement, len: number, fromSource: boolean, seg: object } | null}
 */
export function createTubeDrawJob(seg) {
  const body = cordRopeBodyPath(seg);
  if (!body) return null;
  const len = body.getTotalLength() || 1;
  const fromSource = pathStartsAtSource(seg, body);
  return { body, len, fromSource, seg };
}

/** Hide the tube (0% drawn). */
export function setTubeHidden(job) {
  setTubeDrawProgress(job, 0);
}

/** progress 0–1 — fluid fill along the tube from source → target. */
export function setTubeDrawProgress(job, progress) {
  if (!job?.body) return;
  const p = Math.max(0, Math.min(1, progress));
  const { body, len, fromSource } = job;
  const drawLen = len * p;

  if (fromSource) {
    body.style.strokeDasharray = `${len}`;
    body.style.strokeDashoffset = `${len - drawLen}`;
  } else {
    const gap = Math.max(0.001, len - drawLen);
    body.style.strokeDasharray = `${gap} ${drawLen}`;
    body.style.strokeDashoffset = '0';
  }
}

/** Steady state — full stroke, no dash pattern. */
export function clearTubeDraw(job) {
  if (!job?.body) return;
  job.body.style.strokeDasharray = 'none';
  job.body.style.strokeDashoffset = '0';
}

export function markCordTubeHosts(hosts, { growing = false, flowing = false } = {}) {
  const list = hosts instanceof Set ? [...hosts] : Array.isArray(hosts) ? hosts : [hosts];
  for (const host of list) {
    if (!host) continue;
    host.classList.toggle('is-intro-line-growing', growing);
    host.classList.toggle('is-tube-flowing', flowing);
    if (growing || flowing) {
      host.style.opacity = '1';
      host.style.pointerEvents = growing ? 'none' : '';
    }
  }
}

export function cordHostsForSegment(seg, connectorsEl, edgeKeyStr) {
  if (seg?.cordHosts) return Object.values(seg.cordHosts);
  if (seg?.group) return [seg.group];
  if (!connectorsEl || !edgeKeyStr) return [];
  return Array.from(
    connectorsEl.querySelectorAll(`[data-edge="${edgeKeyStr}"], [data-cord-edge="${edgeKeyStr}"]`)
  );
}

/**
 * Animate tube fill with requestAnimationFrame.
 * @param {object} opts
 * @param {() => void} [opts.onFrame] — called each frame after progress update (e.g. applyCordRopePaths)
 */
export function animateTubeDraw(job, durationMs, { ease = easeOutCubic, onFrame } = {}) {
  return new Promise((resolve) => {
    if (!job?.body || durationMs <= 0) {
      setTubeDrawProgress(job, 1);
      clearTubeDraw(job);
      resolve();
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const linearT = Math.min(1, (now - start) / durationMs);
      const t = ease(linearT);
      job.len = job.body.getTotalLength() || job.len;
      setTubeDrawProgress(job, t);
      onFrame?.(t, job);
      if (linearT < 1) requestAnimationFrame(tick);
      else {
        clearTubeDraw(job);
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Point along the visible “fluid front” for tooltips. */
export function tubeFlowPointAt(job, progress) {
  if (!job?.body?.getPointAtLength) return null;
  const p = Math.max(0, Math.min(1, progress));
  const len = job.body.getTotalLength() || job.len;
  const at = job.fromSource ? len * p : len * (1 - p);
  try {
    return job.body.getPointAtLength(Math.max(0, Math.min(len, at)));
  } catch {
    return null;
  }
}
