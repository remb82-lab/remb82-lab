import {dealerPrice} from './domain-v3.mjs';

export function isProfileProduct(product) {
  const name = String(product?.name || '').trim().toLowerCase();
  if (!name) return false;
  const looksLikeProfile = name.startsWith('профил') || name.startsWith('profile');
  return looksLikeProfile && Boolean(dealerPrice(product));
}

export function profileProducts(db={products:[]}) {
  return (db.products || [])
    .filter(isProfileProduct)
    .slice()
    .sort((a,b) => {
      const ac = Number(a.category_id) || 999;
      const bc = Number(b.category_id) || 999;
      if (ac !== bc) return ac - bc;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
}
