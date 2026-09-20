const n = value => {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
};

const positive = value => Math.max(0, n(value));
const ceilSafe = value => value > 0 ? Math.ceil(value - 1e-9) : 0;
const isConfiguredNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export function packPurchasePlan(requiredQty, packSize, packUnitCost = 0) {
  const required = positive(requiredQty);
  const size = Math.max(1, positive(packSize) || 1);
  const packs = ceilSafe(required / size);
  const purchaseQty = packs * size;
  const remainderQty = Math.max(0, purchaseQty - required);
  const purchaseUnitCost = positive(packUnitCost);
  const total = packs * purchaseUnitCost;
  return {
    requiredQty: required,
    packSize: size,
    packCount: packs,
    purchaseQty,
    remainderQty,
    purchaseUnitCost,
    unitCost: size ? purchaseUnitCost / size : 0,
    total,
  };
}

export function reinforcedFastenerPlan(basePlan = {}, {
  cornerCount = 0,
  jointCount = 0,
  extraPerCorner = null,
  extraPerJoint = null,
} = {}) {
  const baseQty = Math.max(0, Math.ceil(positive(basePlan.qty)));
  const corners = Math.max(0, Math.ceil(positive(cornerCount)));
  const joints = Math.max(0, Math.ceil(positive(jointCount)));
  const cornerConfigured = isConfiguredNumber(extraPerCorner);
  const jointConfigured = isConfiguredNumber(extraPerJoint);
  const cornerExtraPer = cornerConfigured ? positive(extraPerCorner) : 0;
  const jointExtraPer = jointConfigured ? positive(extraPerJoint) : 0;
  const cornerExtraQty = Math.ceil(corners * cornerExtraPer);
  const jointExtraQty = Math.ceil(joints * jointExtraPer);
  const reinforcementRequired = corners > 0 || joints > 0;
  const reinforcementConfigured = !reinforcementRequired || (cornerConfigured && jointConfigured);
  return {
    ...basePlan,
    baseQty,
    cornerCount: corners,
    jointCount: joints,
    extraPerCorner: cornerConfigured ? cornerExtraPer : null,
    extraPerJoint: jointConfigured ? jointExtraPer : null,
    cornerExtraQty,
    jointExtraQty,
    reinforcementQty: cornerExtraQty + jointExtraQty,
    qty: baseQty + cornerExtraQty + jointExtraQty,
    reinforcementRequired,
    reinforcementConfigured,
  };
}

function issue(code, message, blocking = true, meta = {}) {
  return {code, message, blocking, ...meta};
}

export function validateRoomQuote({room, fasteners, electrical, autoKit} = {}) {
  const issues = [];
  const features = room?.features || [];

  if (fasteners?.reinforcementRequired && !fasteners?.reinforcementConfigured) {
    issues.push(issue(
      'FASTENER_REINFORCEMENT_UNSET',
      'Не задано усиление крепежа на углах и стыках профиля',
      true,
      {cornerCount: fasteners.cornerCount || 0, jointCount: fasteners.jointCount || 0},
    ));
  }

  if (positive(electrical?.points) && positive(electrical?.unassignedPoints)) {
    issues.push(issue(
      'ELECTRICAL_LINES_UNASSIGNED',
      'Для световых точек не назначены электрические линии',
      true,
      {unassignedPoints: electrical.unassignedPoints},
    ));
  }

  if (positive(electrical?.points) && !(positive(autoKit?.wireM) > 0)) {
    issues.push(issue('WIRE_MISSING', 'Для световых точек не задан метраж провода', true));
  }

  features.forEach((f, index) => {
    const qty = Math.max(1, Math.ceil(positive(f?.qty) || 1));

    if ((f?.type === 'light' || f?.type === 'chandelier') && qty !== 1) {
      issues.push(issue(
        'ELECTRICAL_GROUPED_POINT',
        `${f.type === 'chandelier' ? 'Люстра' : 'Светильник'} ${index + 1}: одна отметка на схеме должна соответствовать одной точке`,
        true,
        {featureIndex:index, qty},
      ));
    }

    if (f?.type === 'pipe') {
      if (!(positive(f.diameterMm) > 0)) {
        issues.push(issue('PIPE_DIAMETER_MISSING', `Труба ${index + 1}: не задан диаметр`, true, {featureIndex:index}));
      }
      if (!(positive(f.unitCost) > 0)) {
        issues.push(issue('PIPE_WORK_RATE_ZERO', `Труба ${index + 1}: работа не оценена`, false, {featureIndex:index}));
      }
      if (!(positive(f.materialUnitCost) > 0)) {
        issues.push(issue('PIPE_MATERIAL_RATE_ZERO', `Труба ${index + 1}: материал обхода не оценён`, false, {featureIndex:index}));
      }
    }

    if (f?.type === 'cornice') {
      if (!(positive(f.length) > 0)) {
        issues.push(issue('CORNICE_LENGTH_MISSING', `Карниз ${index + 1}: не задана длина`, true, {featureIndex:index}));
      }
      if (!(positive(f.unitCost) > 0)) {
        issues.push(issue('CORNICE_WORK_RATE_ZERO', `Карниз ${index + 1}: работа не оценена`, false, {featureIndex:index}));
      }
      if (!(positive(f.materialUnitCost) > 0)) {
        issues.push(issue('CORNICE_MATERIAL_RATE_ZERO', `Карниз ${index + 1}: материал не оценён`, false, {featureIndex:index}));
      }
      if (positive(f.cornerCount) && !(positive(f.cornerUnitCost) > 0)) {
        issues.push(issue('CORNICE_CORNER_RATE_ZERO', `Карниз ${index + 1}: повороты не оценены`, false, {featureIndex:index}));
      }
    }

    if ((f?.type === 'light' || f?.type === 'chandelier') && !(positive(f.unitCost) > 0)) {
      issues.push(issue('LIGHT_WORK_RATE_ZERO', `${f.type === 'chandelier' ? 'Люстра' : 'Светильник'} ${index + 1}: работа не оценена`, false, {featureIndex:index, qty}));
    }
  });

  return {
    issues,
    blockingIssues: issues.filter(x => x.blocking),
    warnings: issues.filter(x => !x.blocking),
    isComplete: !issues.some(x => x.blocking),
  };
}
