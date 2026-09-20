import {dealerPrice, referencePrice} from './domain-v3.mjs';
import {profileProducts} from './profile-catalog.mjs';

export const BUILD_LABEL = 'ПОТОЛКИ · v3 · r8';

const fmt = (value, digits=2) => new Intl.NumberFormat('ru-BY', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits,
}).format(Number(value) || 0);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[c]));
}

function categoryName(db, id) {
  return db?.categories?.find(c => Number(c.id) === Number(id))?.name || '';
}

export function buildProfileOptions(db, selectedId='') {
  const products = profileProducts(db);
  const options = ['<option value="">Без профиля</option>'];
  for (const product of products) {
    const dealer = dealerPrice(product);
    const rr = referencePrice(product);
    const category = categoryName(db, product.category_id);
    const selected = Number(selectedId) === Number(product.id) ? ' selected' : '';
    const label = `${category ? category + ' · ' : ''}${product.name} — ${fmt(dealer.amount)} ${dealer.currency}/${dealer.unit || product.default_unit || ''}${dealer.variant ? ` · ${dealer.variant}` : ''}${rr ? ` · МРЦ ${fmt(rr.amount,0)} ${rr.currency}` : ''}`;
    options.push(`<option value="${product.id}"${selected}>${esc(label)}</option>`);
  }
  return {html:options.join(''), count:products.length, products};
}

export function installProfileSelector(db=globalThis.window?.PRICE_DB) {
  if (typeof document === 'undefined') return null;
  const select = document.getElementById('profileSelect');
  if (!select || !db) return null;
  let applying = false;

  const refresh = () => {
    if (applying) return;
    applying = true;
    const selectedId = select.value;
    const {html, count, products} = buildProfileOptions(db, selectedId);
    const selectedIsValid = !selectedId || products.some(p => Number(p.id) === Number(selectedId));

    if (select.innerHTML !== html) select.innerHTML = html;
    if (selectedIsValid && selectedId) {
      select.value = selectedId;
    } else if (!selectedIsValid) {
      select.value = '';
      queueMicrotask(() => select.dispatchEvent(new Event('change', {bubbles:true})));
    }
    select.dataset.profileCount = String(count);
    applying = false;
  };

  const observer = new MutationObserver(() => refresh());
  observer.observe(select, {childList:true, subtree:true});
  refresh();
  return {refresh, observer};
}

export function installBuildMarker() {
  if (typeof document === 'undefined') return;
  const marker = document.querySelector('.brand small');
  if (marker) marker.textContent = BUILD_LABEL;
}

if (typeof document !== 'undefined') {
  const start = () => {
    installBuildMarker();
    installProfileSelector(globalThis.window?.PRICE_DB);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
}
