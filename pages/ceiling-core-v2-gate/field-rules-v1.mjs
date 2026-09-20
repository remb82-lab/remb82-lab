export const FIELD_RULES_V1 = Object.freeze({
  profileStickLengthM: 2,
  wallFastenerStepM: 0.1,
  wagoPerPoint: 2,
  wagoPerLineInput: 2,
  defaultSuspensionsPerPoint: 2,
});

const EPS = 1e-9;
const safeNumber = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const positive = value => Math.max(0, safeNumber(value));
const ceilRatio = (value, unit) => value > 0 ? Math.ceil((value - EPS) / unit) : 0;

export function profileStockPlan(requiredM, stickLengthM = FIELD_RULES_V1.profileStickLengthM) {
  const required = positive(requiredM);
  const stick = Math.max(0.001, positive(stickLengthM));
  const pieces = ceilRatio(required, stick);
  const purchaseM = pieces * stick;
  return {
    requiredM: required,
    stickLengthM: stick,
    pieces,
    purchaseM,
    offcutM: Math.max(0, purchaseM - required),
  };
}

export function wallFastenerPlan(perimeterM, stepM = FIELD_RULES_V1.wallFastenerStepM) {
  const perimeter = positive(perimeterM);
  const step = Math.max(0.001, positive(stepM));
  const qty = ceilRatio(perimeter, step);
  return { perimeterM: perimeter, stepM: step, qty };
}

export function wagoPlan(pointCount, lineCount = 1) {
  const points = Math.max(0, Math.ceil(positive(pointCount)));
  const lines = points > 0 ? Math.max(1, Math.ceil(positive(lineCount) || 1)) : 0;
  const pointWago = points * FIELD_RULES_V1.wagoPerPoint;
  const inputWago = lines * FIELD_RULES_V1.wagoPerLineInput;
  return { points, lines, pointWago, inputWago, total: pointWago + inputWago };
}

export function lightPointKit({
  points = 1,
  lineCount = 1,
  wireMPerPoint = 0,
  suspensionsPerPoint = FIELD_RULES_V1.defaultSuspensionsPerPoint,
  platformPerPoint = 1,
  ringPerPoint = 1,
} = {}) {
  const qty = Math.max(0, Math.ceil(positive(points)));
  const wago = wagoPlan(qty, lineCount);
  return {
    points: qty,
    platforms: qty * positive(platformPerPoint),
    rings: qty * positive(ringPerPoint),
    wireM: qty * positive(wireMPerPoint),
    wago,
    suspensions: qty * positive(suspensionsPerPoint),
    laborUnits: qty,
  };
}

export function chandelierKit({
  points = 1,
  lineCount = 1,
  wireMPerPoint = 0,
  suspensionsPerPoint = FIELD_RULES_V1.defaultSuspensionsPerPoint,
  platformPerPoint = 1,
  ringPerPoint = 1,
} = {}) {
  return lightPointKit({points, lineCount, wireMPerPoint, suspensionsPerPoint, platformPerPoint, ringPerPoint});
}

export function buildElectricalPlan(features = [], options = {}) {
  const electrical = (features || []).filter(f => f && (f.type === 'light' || f.type === 'chandelier'));
  const pointCount = electrical.reduce((sum, f) => sum + Math.max(1, Math.ceil(positive(f.qty) || 1)), 0);
  const assignedLineIds = new Set();
  let unassignedPoints = 0;
  for (const f of electrical) {
    const qty = Math.max(1, Math.ceil(positive(f.qty) || 1));
    const id = String(f.electricalLineId ?? '').trim();
    if (id) assignedLineIds.add(id);
    else unassignedPoints += qty;
  }
  const inferredLineCount = assignedLineIds.size + (unassignedPoints > 0 ? 1 : 0);
  const lineCount = pointCount ? Math.max(1, inferredLineCount || positive(options.lineCount) || 1) : 0;
  const kit = lightPointKit({
    points: pointCount,
    lineCount,
    wireMPerPoint: positive(options.wireMPerPoint),
    suspensionsPerPoint: options.suspensionsPerPoint ?? FIELD_RULES_V1.defaultSuspensionsPerPoint,
  });
  return {
    ...kit,
    lineCount,
    assignedLineIds:[...assignedLineIds],
    unassignedPoints,
  };
}

function distribute(count, start, end) {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  const step = (end - start) / (count - 1);
  return Array.from({length: count}, (_, i) => start + i * step);
}

function pointOnRectPerimeter(distance, width, height, margin) {
  const left = margin, right = Math.max(left, width - margin);
  const top = margin, bottom = Math.max(top, height - margin);
  const w = Math.max(0, right - left), h = Math.max(0, bottom - top);
  const perimeter = 2 * (w + h) || 1;
  let d = ((distance % perimeter) + perimeter) % perimeter;
  if (d <= w) return {x:left + d, y:top};
  d -= w;
  if (d <= h) return {x:right, y:top + d};
  d -= h;
  if (d <= w) return {x:right - d, y:bottom};
  d -= w;
  return {x:left, y:bottom - d};
}

export function layoutTemplate(template, {count = 1, width = 4, height = 3, margin = 0.5} = {}) {
  const n = Math.max(0, Math.ceil(positive(count)));
  const w = Math.max(0.1, positive(width));
  const h = Math.max(0.1, positive(height));
  const m = Math.max(0, Math.min(positive(margin), Math.min(w, h) / 2));
  if (!n) return [];

  if (template === 'line') {
    return distribute(n, m, Math.max(m, w - m)).map(x => ({x, y:h / 2}));
  }

  if (template === 'two-lines') {
    const first = Math.ceil(n / 2), second = n - first;
    const y1 = h / 3, y2 = 2 * h / 3;
    return [
      ...distribute(first, m, Math.max(m, w - m)).map(x => ({x, y:y1})),
      ...distribute(second, m, Math.max(m, w - m)).map(x => ({x, y:y2})),
    ];
  }

  if (template === 'perimeter') {
    const usableW = Math.max(0, w - 2 * m), usableH = Math.max(0, h - 2 * m);
    const perimeter = 2 * (usableW + usableH) || 1;
    return Array.from({length:n}, (_, i) => pointOnRectPerimeter(i * perimeter / n, w, h, m));
  }

  if (template === 'circle') {
    const cx = w / 2, cy = h / 2;
    const radius = Math.max(0, Math.min(w, h) / 2 - m);
    if (n === 1) return [{x:cx, y:cy}];
    return Array.from({length:n}, (_, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / n;
      return {x:cx + Math.cos(a) * radius, y:cy + Math.sin(a) * radius};
    });
  }

  if (template === 'grid') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * w / h)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const xs = distribute(cols, m, Math.max(m, w - m));
    const ys = distribute(rows, m, Math.max(m, h - m));
    const points = [];
    for (const y of ys) for (const x of xs) if (points.length < n) points.push({x, y});
    return points;
  }

  throw new Error(`Unknown layout template: ${template}`);
}
