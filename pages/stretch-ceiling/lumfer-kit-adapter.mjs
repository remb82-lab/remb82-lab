export const LUMFER_ITEM_IDS = Object.freeze({
  ring20to90: 8,
  ring95to150: 9,
  ring155to205: 10,
  ring225to300: 11,
  platformSquare150to200: 14,
  platformSquare90to140: 15,
  platformSquare50to90: 16,
  platformLight60to120: 18,
  platformLight55to105: 19,
  platformLight125to155: 20,
  platformLight165to225: 21,
  platformChandelier: 22,
  platformChandelier120: 24,
  platformChandelierCross: 25,
  wallDowelChapay6x35Pack1000: 53,
  suspension300: 54,
  terminal3Way: 68,
  wire2x075: 76,
});

const n = value => {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
};
const positive = value => Math.max(0, n(value));

function dealerPrice(product) {
  const prices = product?.prices || [];
  return prices.find(x => x.price_type === 'dealer' && !x.variant)
    || prices.find(x => x.price_type === 'dealer')
    || null;
}

function byId(db, id) {
  return db?.products?.find(p => Number(p.id) === Number(id)) || null;
}

function priceByn(product, usdBynRate) {
  const p = dealerPrice(product);
  if (!p) return 0;
  const amount = positive(p.amount);
  return p.currency === 'USD' ? amount * positive(usdBynRate) : amount;
}

function normalizedLine(db, productId, qty, usdBynRate, options = {}) {
  const product = byId(db, productId);
  const packSize = Math.max(1, positive(options.packSize) || 1);
  const rawUnit = priceByn(product, usdBynRate);
  const unitCost = rawUnit / packSize;
  const amount = positive(qty);
  return {
    source: 'lumfer-auto',
    role: options.role || 'material',
    productId,
    product,
    name: product?.name || options.fallbackName || `LumFer #${productId}`,
    qty: amount,
    unit: options.unit || product?.default_unit || 'шт.',
    packSize,
    dealerUnitCostByn: rawUnit,
    unitCost,
    total: amount * unitCost,
  };
}

export function ringProductIdForDiameter(diameterMm = 90) {
  const d = positive(diameterMm) || 90;
  if (d <= 90) return LUMFER_ITEM_IDS.ring20to90;
  if (d <= 150) return LUMFER_ITEM_IDS.ring95to150;
  if (d <= 205) return LUMFER_ITEM_IDS.ring155to205;
  if (d <= 300) return LUMFER_ITEM_IDS.ring225to300;
  return null;
}

export function lightPlatformProductIdForDiameter(diameterMm = 90) {
  const d = positive(diameterMm) || 90;
  if (d <= 90) return LUMFER_ITEM_IDS.platformSquare50to90;
  if (d <= 105) return LUMFER_ITEM_IDS.platformLight55to105;
  if (d <= 120) return LUMFER_ITEM_IDS.platformLight60to120;
  if (d <= 140) return LUMFER_ITEM_IDS.platformSquare90to140;
  if (d <= 155) return LUMFER_ITEM_IDS.platformLight125to155;
  if (d <= 200) return LUMFER_ITEM_IDS.platformSquare150to200;
  if (d <= 225) return LUMFER_ITEM_IDS.platformLight165to225;
  return null;
}

function featureQty(feature) {
  return Math.max(1, Math.ceil(positive(feature?.qty) || 1));
}

function featureDiameter(feature, fallback = 90) {
  return positive(feature?.diameterMm || feature?.ringDiameterMm || feature?.diameter) || fallback;
}

function totalWireM(features = []) {
  let total = 0;
  for (const f of features) {
    if (!f || (f.type !== 'light' && f.type !== 'chandelier')) continue;
    const qty = featureQty(f);
    const exact = positive(f.wireM);
    if (exact) total += exact;
    else total += positive(f.wireMPerPoint) * qty;
  }
  return total;
}

function mergeSameProduct(lines) {
  const map = new Map();
  for (const line of lines) {
    if (!line || !line.productId || line.qty <= 0) continue;
    const key = `${line.productId}:${line.role}:${line.packSize}`;
    const prev = map.get(key);
    if (!prev) map.set(key, {...line});
    else {
      prev.qty += line.qty;
      prev.total += line.total;
    }
  }
  return [...map.values()];
}

export function buildLumferAutoKit({room, electrical, fasteners, db, usdBynRate = 0} = {}) {
  const features = room?.features || [];
  const lines = [];
  const warnings = [];

  for (const f of features) {
    if (!f || (f.type !== 'light' && f.type !== 'chandelier')) continue;
    const qty = featureQty(f);
    const diameter = featureDiameter(f, f.type === 'chandelier' ? 120 : 90);
    const platformId = f.type === 'chandelier'
      ? LUMFER_ITEM_IDS.platformChandelier
      : lightPlatformProductIdForDiameter(diameter);
    const ringId = ringProductIdForDiameter(diameter);

    if (platformId) lines.push(normalizedLine(db, platformId, qty, usdBynRate, {role:'platform'}));
    else warnings.push(`Нет автоподбора платформы для Ø${diameter} мм`);

    if (ringId) lines.push(normalizedLine(db, ringId, qty, usdBynRate, {role:'ring', unit:'шт.'}));
    else warnings.push(`Нет автоподбора кольца для Ø${diameter} мм`);
  }

  const suspensionQty = positive(electrical?.suspensions);
  if (suspensionQty) lines.push(normalizedLine(db, LUMFER_ITEM_IDS.suspension300, suspensionQty, usdBynRate, {role:'suspension'}));

  const wagoQty = positive(electrical?.wago?.total);
  if (wagoQty) lines.push(normalizedLine(db, LUMFER_ITEM_IDS.terminal3Way, wagoQty, usdBynRate, {role:'terminal'}));

  const wireM = totalWireM(features);
  if (wireM) lines.push(normalizedLine(db, LUMFER_ITEM_IDS.wire2x075, wireM, usdBynRate, {role:'wire', unit:'м.п.'}));
  else if (positive(electrical?.points)) warnings.push('Для световых точек не задан метраж провода');

  const fastenerQty = positive(fasteners?.qty);
  if (fastenerQty) {
    lines.push(normalizedLine(db, LUMFER_ITEM_IDS.wallDowelChapay6x35Pack1000, fastenerQty, usdBynRate, {
      role:'wall-fastener',
      unit:'шт.',
      packSize:1000,
      fallbackName:'Дюбель 6×35',
    }));
  }

  const merged = mergeSameProduct(lines);
  const missingProducts = merged.filter(x => !x.product).map(x => x.productId);
  if (missingProducts.length) warnings.push(`Нет товаров LumFer в локальной БД: ${missingProducts.join(', ')}`);

  return {
    lines: merged,
    total: merged.reduce((sum, x) => sum + x.total, 0),
    wireM,
    warnings,
  };
}
