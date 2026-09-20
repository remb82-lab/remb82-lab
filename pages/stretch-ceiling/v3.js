import {
  createProject, createRoom, STATUS_ORDER, STATUS_LABELS, geometrySummary,
  calculateProject, setProjectStatus, touch, dealerPrice, referencePrice,
  diagonalLength, uid,
} from './domain-v3.mjs';
import {
  saveProject, listProjects, deleteProject, savePhoto, getPhotoBlob,
  deletePhoto, exportAll, importAll,
} from './storage-v3.mjs';
import {downloadProjectPdf} from './pdf-v3.mjs';

const DB = window.PRICE_DB || {meta:{}, products:[], categories:[]};
const $ = id => document.getElementById(id);
const qa = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[c]));
const num = value => {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (value, digits=2) => new Intl.NumberFormat('ru-BY', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits,
}).format(num(value));
const money = value => `${fmt(value)} BYN`;

let projects = [];
let project = null;
let roomId = null;
let tool = 'select';
let addVertex = false;
let drag = -1;
let saveTimer = null;
let photoUrls = [];

const room = () => project?.rooms?.find(r => r.id === roomId) || project?.rooms?.[0] || null;
const product = id => DB.products?.find(p => p.id === Number(id)) || null;
const category = id => DB.categories?.find(c => c.id === Number(id)) || null;
const isElectrical = f => f?.type === 'light' || f?.type === 'chandelier';

const featureNames = {
  light: 'Светильник',
  chandelier: 'Люстра',
  pipe: 'Труба',
  track: 'Трек',
  cornice: 'Карниз',
};

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1600);
}

async function persist(label='Изменения сохранены') {
  if (!project) return;
  touch(project, label);
  $('saveState').textContent = 'Сохраняю…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveProject(project);
    projects = await listProjects();
    $('saveState').textContent = 'Сохранено локально';
    renderProjectList();
  }, 250);
}

function calc() {
  const c = calculateProject(project, DB);
  $('totalCost').textContent = money(c.cost);
  $('totalClient').textContent = money(c.clientTotal);
  $('totalProfit').textContent = money(c.profit);
  $('totalMargin').textContent = `${fmt(c.margin, 1)}%`;
  const current = c.rooms.find(x => x.room.id === roomId);
  $('roomCost').textContent = `Текущее помещение: ${money(current?.cost || 0)}`;
  return c;
}

function renderProjectList() {
  const q = $('projectSearch').value.trim().toLowerCase();
  const status = $('projectStatusFilter').value;
  const filtered = projects.filter(p =>
    (!status || p.status === status) &&
    (!q || [p.title, p.client?.name, p.client?.phone, p.client?.address]
      .join(' ').toLowerCase().includes(q))
  );
  $('projectList').innerHTML = filtered.map(p => `
    <div class="project-item ${p.id === project?.id ? 'active' : ''}" data-project="${p.id}">
      <b>${esc(p.title || 'Объект')}</b>
      <small>${esc(p.client?.name || p.client?.address || 'Без клиента')}</small>
      <span class="pill">${STATUS_LABELS[p.status] || p.status}</span>
    </div>
  `).join('') || '<div class="hint">Объекты не найдены</div>';
  qa('[data-project]', $('projectList')).forEach(el => {
    el.onclick = () => loadProject(el.dataset.project);
  });
}

function renderStatus() {
  const activeIndex = STATUS_ORDER.indexOf(project.status);
  $('statusFlow').innerHTML = STATUS_ORDER.map((status, i) => `
    <button data-status="${status}" class="${i < activeIndex ? 'done' : ''} ${status === project.status ? 'active' : ''}">
      ${STATUS_LABELS[status]}
    </button>
  `).join('');
  qa('[data-status]', $('statusFlow')).forEach(button => {
    button.onclick = () => {
      setProjectStatus(project, button.dataset.status);
      persist(`Статус: ${STATUS_LABELS[button.dataset.status]}`);
      renderStatus();
      renderProjectList();
    };
  });
}

function renderTabs() {
  $('roomTabs').innerHTML = project.rooms.map(r => `
    <div class="room-tab-wrap">
      <button data-room="${r.id}" class="${r.id === roomId ? 'active' : ''}">${esc(r.name)}</button>
      ${project.rooms.length > 1 ? `<button class="room-del" data-room-del="${r.id}">×</button>` : ''}
    </div>
  `).join('') + '<button class="add-room" id="addRoomBtn">+ Помещение</button>';

  qa('[data-room]', $('roomTabs')).forEach(button => {
    button.onclick = () => {
      roomId = button.dataset.room;
      renderTabs();
      renderRoom();
    };
  });
  qa('[data-room-del]', $('roomTabs')).forEach(button => {
    button.onclick = () => {
      if (!confirm('Удалить помещение?')) return;
      project.rooms = project.rooms.filter(r => r.id !== button.dataset.roomDel);
      roomId = project.rooms[0].id;
      persist('Помещение удалено');
      renderTabs();
      renderRoom();
    };
  });
  $('addRoomBtn').onclick = () => {
    const r = createRoom(`Помещение ${project.rooms.length + 1}`);
    project.rooms.push(r);
    roomId = r.id;
    persist('Добавлено помещение');
    renderTabs();
    renderRoom();
  };
}

function profileOptions() {
  const products = (DB.products || []).filter(p => {
    const d = dealerPrice(p);
    return d && String(d.unit || p.default_unit || '').toLowerCase().includes('м.п');
  });
  return '<option value="">Без профиля</option>' + products.map(p => {
    const d = dealerPrice(p);
    const rr = referencePrice(p);
    return `<option value="${p.id}">${esc(p.name)} — ${fmt(d.amount)} ${d.currency}/${esc(d.unit || p.default_unit || '')}${rr ? ` · МРЦ ${fmt(rr.amount,0)} ${rr.currency}` : ''}</option>`;
  }).join('');
}

function setMode(mode, save=true) {
  const r = room();
  r.geometry.mode = mode;
  qa('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  $('rectEditor').classList.toggle('hidden', mode !== 'rect');
  $('polygonEditor').classList.toggle('hidden', mode !== 'polygon');
  addVertex = false;
  $('addVertexMode').classList.remove('active');
  if (save) persist('Геометрия изменена');
  renderPlan();
  recalc();
}

function renderVertices() {
  const r = room();
  const pts = r.geometry.points || [];
  $('vertexTable').innerHTML = r.geometry.mode !== 'polygon' ? '' : pts.length ? pts.map((p, i) => `
    <div class="data-row">
      <div class="row-fields">
        <label>${String.fromCharCode(65+i)} · X<input data-vx="${i}" type="number" step="0.01" value="${p.x}"></label>
        <label>Y<input data-vy="${i}" type="number" step="0.01" value="${p.y}"></label>
      </div>
      <button class="remove" data-vdel="${i}">×</button>
    </div>
  `).join('') : '<div class="hint">Нажмите «+ Вершина на схеме», затем ставьте точки по контуру.</div>';

  qa('[data-vx]').forEach(input => input.oninput = () => {
    r.geometry.points[+input.dataset.vx].x = Math.max(0, num(input.value));
    persist(); renderPlan(); recalc();
  });
  qa('[data-vy]').forEach(input => input.oninput = () => {
    r.geometry.points[+input.dataset.vy].y = Math.max(0, num(input.value));
    persist(); renderPlan(); recalc();
  });
  qa('[data-vdel]').forEach(button => button.onclick = () => {
    r.geometry.points.splice(+button.dataset.vdel, 1);
    r.geometry.diagonalMeasurements = [];
    persist('Удалена вершина');
    renderVertices(); renderDiagonals(); renderPlan(); recalc();
  });
}

function renderDiagonals() {
  const r = room();
  const pts = geometrySummary(r).points;
  const ds = r.geometry.diagonalMeasurements || [];
  $('diagonalList').innerHTML = ds.length ? ds.map((d, i) => {
    const calculated = diagonalLength(pts, d.a, d.b);
    const delta = d.length ? Math.abs(calculated - num(d.length)) : 0;
    return `<div class="data-row"><div><b>${String.fromCharCode(65+d.a)}–${String.fromCharCode(65+d.b)}</b><small>расчёт ${fmt(calculated)} м${d.length ? ` · Δ ${fmt(delta)} м` : ''}</small><div class="row-fields"><label>От<input data-da="${i}" type="number" min="1" step="1" value="${d.a+1}"></label><label>До<input data-db="${i}" type="number" min="1" step="1" value="${d.b+1}"></label><label>Замер, м<input data-dl="${i}" type="number" min="0" step="0.01" value="${d.length || ''}"></label></div></div><button class="remove" data-ddel="${i}">×</button></div>`;
  }).join('') : '<div class="hint">Контрольных диагоналей нет.</div>';

  qa('[data-da]').forEach(input => input.onchange = () => {
    ds[+input.dataset.da].a = Math.max(0, Math.min(pts.length-1, Math.round(num(input.value))-1));
    persist(); renderDiagonals(); renderPlan();
  });
  qa('[data-db]').forEach(input => input.onchange = () => {
    ds[+input.dataset.db].b = Math.max(0, Math.min(pts.length-1, Math.round(num(input.value))-1));
    persist(); renderDiagonals(); renderPlan();
  });
  qa('[data-dl]').forEach(input => input.oninput = () => {
    ds[+input.dataset.dl].length = Math.max(0, num(input.value));
    persist(); renderPlan();
  });
  qa('[data-ddel]').forEach(button => button.onclick = () => {
    ds.splice(+button.dataset.ddel, 1);
    persist('Диагональ удалена'); renderDiagonals(); renderPlan();
  });
}

function renderNiches() {
  const niches = room().geometry.niches || [];
  $('nicheList').innerHTML = niches.length ? niches.map((niche, i) => `
    <div class="data-row"><div class="row-fields">
      <label>Ширина<input data-nw="${i}" type="number" step="0.01" value="${niche.width || 0}"></label>
      <label>Глубина<input data-nd="${i}" type="number" step="0.01" value="${niche.depth || 0}"></label>
      <label>X<input data-nx="${i}" type="number" step="0.01" value="${niche.x || 0}"></label>
      <label>Y<input data-ny="${i}" type="number" step="0.01" value="${niche.y || 0}"></label>
    </div><button class="remove" data-ndel="${i}">×</button></div>
  `).join('') : '<div class="hint">Ниш нет.</div>';

  for (const key of ['nw','nd','nx','ny']) {
    qa(`[data-${key}]`).forEach(input => input.oninput = () => {
      const niche = niches[+input.dataset[key]];
      const map = {nw:'width', nd:'depth', nx:'x', ny:'y'};
      niche[map[key]] = Math.max(0, num(input.value));
      persist(); renderPlan(); recalc();
    });
  }
  qa('[data-ndel]').forEach(button => button.onclick = () => {
    niches.splice(+button.dataset.ndel, 1);
    persist('Ниша удалена'); renderNiches(); renderPlan(); recalc();
  });
}

function featureCard(f, i) {
  const electrical = isElectrical(f);
  return `<div class="feature-card">
    <header><b>${esc(f.label || featureNames[f.type] || f.type)}</b><button class="remove" data-fdel="${i}">×</button></header>
    <div class="feature-fields">
      <label>Кол-во<input data-fqty="${i}" type="number" min="0" step="1" value="${f.qty || 1}"></label>
      <label>Длина, м<input data-flen="${i}" type="number" min="0" step="0.01" value="${f.length || 0}"></label>
      <label>Угол°<input data-fang="${i}" type="number" step="1" value="${f.angle || 0}"></label>
      <label>Работа/ед., BYN<input data-fcost="${i}" type="number" min="0" step="0.01" value="${f.unitCost || 0}"></label>
    </div>
    ${electrical ? `<div class="electrical-fields">
      <label>Диаметр, мм<input data-fdiam="${i}" type="number" min="20" step="5" value="${f.diameterMm || (f.type === 'chandelier' ? 120 : 90)}"></label>
      <label>Провод всего, м<input data-fwire="${i}" type="number" min="0" step="0.1" value="${f.wireM || 0}"></label>
      <div class="field-note">Платформа, кольцо, WAGO и подвесы считаются автоматически.</div>
    </div>` : ''}
  </div>`;
}

function renderFeatures() {
  const features = room().features || [];
  $('featureList').innerHTML = features.length
    ? features.map(featureCard).join('')
    : '<div class="hint">Элементов на схеме нет.</div>';

  for (const [key, field] of [['fqty','qty'],['flen','length'],['fang','angle'],['fcost','unitCost']]) {
    qa(`[data-${key}]`).forEach(input => input.oninput = () => {
      features[+input.dataset[key]][field] = num(input.value);
      persist(); renderPlan(); recalc();
    });
  }
  qa('[data-fdiam]').forEach(input => input.oninput = () => {
    features[+input.dataset.fdiam].diameterMm = Math.max(20, num(input.value));
    persist('Диаметр световой точки изменён');
    recalc();
  });
  qa('[data-fwire]').forEach(input => input.oninput = () => {
    features[+input.dataset.fwire].wireM = Math.max(0, num(input.value));
    persist('Метраж провода изменён');
    recalc();
  });
  qa('[data-fdel]').forEach(button => button.onclick = () => {
    features.splice(+button.dataset.fdel, 1);
    persist('Элемент удалён'); renderFeatures(); renderPlan(); recalc();
  });
}

function renderMaterials() {
  const materials = room().materials || [];
  $('materialList').innerHTML = materials.length ? materials.map((m, i) => {
    const p = product(m.productId);
    const d = dealerPrice(p);
    return `<div class="data-row"><div><b>${esc(p?.name || 'Позиция')}</b><small>${d ? `${fmt(d.amount)} ${d.currency}/${esc(d.unit || p?.default_unit || '')}` : 'нет цены'}</small></div><div class="row-fields"><label>Кол-во<input data-mqty="${i}" type="number" min="0" step="0.01" value="${m.qty}"></label></div><button class="remove" data-mdel="${i}">×</button></div>`;
  }).join('') : '<div class="hint">Дополнительных материалов нет.</div>';

  qa('[data-mqty]').forEach(input => input.oninput = () => {
    materials[+input.dataset.mqty].qty = Math.max(0, num(input.value));
    persist(); recalc();
  });
  qa('[data-mdel]').forEach(button => button.onclick = () => {
    materials.splice(+button.dataset.mdel, 1);
    persist('Материал удалён'); renderMaterials(); recalc();
  });
}

function renderAutoKit(roomCalc) {
  const kit = roomCalc?.autoKit || {lines:[], warnings:[], total:0};
  $('autoKitList').innerHTML = kit.lines?.length ? kit.lines.map(line => `
    <div class="data-row auto-kit-line">
      <div><b>${esc(line.name)}</b><small>${fmt(line.qty)} ${esc(line.unit || '')} · ${money(line.unitCost)} / ед.</small></div>
      <strong>${money(line.total)}</strong>
    </div>
  `).join('') : '<div class="hint">Автоматических комплектующих пока нет.</div>';
  $('autoKitWarnings').innerHTML = (kit.warnings || []).map(w => `<div class="kit-warning">${esc(w)}</div>`).join('');
  $('autoKitTotal').textContent = money(roomCalc?.autoMaterialsCost || 0);
}

function bounds(points) {
  if (!points.length) return {x:0,y:0,w:6,h:4};
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {x:minX-.7, y:minY-.7, w:Math.max(3,maxX-minX+1.4), h:Math.max(3,maxY-minY+1.4)};
}

function renderPlan() {
  const r = room();
  const g = geometrySummary(r);
  const pts = g.points;
  const b = bounds(pts);
  const svg = $('planSvg');
  const W = 1000, H = 650;
  const s = Math.min((W-100)/b.w, (H-100)/b.h);
  const map = p => ({x:50+(p.x-b.x)*s, y:50+(p.y-b.y)*s});
  let html = '<rect width="1000" height="650" fill="#071114"/>';

  for (let x=0; x<=1000; x+=25) html += `<line x1="${x}" y1="0" x2="${x}" y2="650" stroke="${x%100===0?'#1f353a':'#122126'}"/>`;
  for (let y=0; y<=650; y+=25) html += `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="${y%100===0?'#1f353a':'#122126'}"/>`;

  if (pts.length) {
    const pp = pts.map(map);
    html += `<polygon points="${pp.map(p=>`${p.x},${p.y}`).join(' ')}" fill="rgba(101,225,207,.08)" stroke="#65e1cf" stroke-width="4"/>`;
    pp.forEach((p, i) => {
      const q = pp[(i+1)%pp.length];
      const mid = {x:(p.x+q.x)/2, y:(p.y+q.y)/2};
      const len = Math.hypot(pts[(i+1)%pts.length].x-pts[i].x, pts[(i+1)%pts.length].y-pts[i].y);
      html += `<text x="${mid.x}" y="${mid.y-8}" text-anchor="middle" fill="#d9e7e6" font-size="17">${fmt(len)} м</text><circle data-vertex="${i}" cx="${p.x}" cy="${p.y}" r="10" fill="#b8ff6d"/><text x="${p.x+13}" y="${p.y-13}" fill="#fff" font-size="18">${String.fromCharCode(65+i)} ${g.angles[i] ? fmt(g.angles[i],0)+'°' : ''}</text>`;
    });
    (r.geometry.diagonalMeasurements || []).forEach(d => {
      if (!pp[d.a] || !pp[d.b]) return;
      html += `<line x1="${pp[d.a].x}" y1="${pp[d.a].y}" x2="${pp[d.b].x}" y2="${pp[d.b].y}" stroke="#889ca0" stroke-width="2" stroke-dasharray="8 8"/>`;
    });
  }

  (r.geometry.niches || []).forEach(niche => {
    const p = map(niche), w = num(niche.width)*s, h = num(niche.depth)*s;
    html += `<rect x="${p.x}" y="${p.y}" width="${w}" height="${h}" fill="rgba(255,190,80,.16)" stroke="#ffbd58" stroke-width="2"/><text x="${p.x+4}" y="${p.y+18}" fill="#ffd99b" font-size="15">ниша</text>`;
  });
  (r.features || []).forEach(f => {
    const p = map(f);
    const symbol = {light:'●', chandelier:'✦', pipe:'◎', track:'━', cornice:'═'}[f.type] || '◆';
    html += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="middle" fill="#ffda76" font-size="${f.type==='track'||f.type==='cornice'?30:24}" transform="rotate(${num(f.angle)} ${p.x} ${p.y})">${symbol}</text>`;
  });
  svg.innerHTML = html;
}

function world(e) {
  const svg = $('planSvg');
  const rect = svg.getBoundingClientRect();
  const g = geometrySummary(room());
  const b = bounds(g.points);
  const s = Math.min(900/b.w, 550/b.h);
  const px = (e.clientX-rect.left)/rect.width*1000;
  const py = (e.clientY-rect.top)/rect.height*650;
  const snap = v => Math.max(0, Math.round(v*4)/4);
  return {x:snap((px-50)/s+b.x), y:snap((py-50)/s+b.y)};
}

async function renderPhotos() {
  for (const url of photoUrls) URL.revokeObjectURL(url);
  photoUrls = [];
  const r = room();
  $('photoGrid').innerHTML = '';
  for (const p of r.photos || []) {
    try {
      const blob = await getPhotoBlob(p.id);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      photoUrls.push(url);
      const div = document.createElement('div');
      div.className = 'photo';
      div.innerHTML = `<img src="${url}" alt="Фото"><button data-photo="${p.id}">×</button>`;
      $('photoGrid').append(div);
    } catch {}
  }
  qa('[data-photo]', $('photoGrid')).forEach(button => {
    button.onclick = async () => {
      await deletePhoto(button.dataset.photo);
      r.photos = r.photos.filter(x => x.id !== button.dataset.photo);
      await persist('Фото удалено');
      renderPhotos();
    };
  });
}

function recalc() {
  const r = room();
  if (!r) return;
  const g = geometrySummary(r);
  $('metricArea').textContent = `${fmt(g.area)} м²`;
  $('metricPerimeter').textContent = `${fmt(g.perimeter)} м`;
  $('metricCorners').textContent = String(g.points.length);
  $('metricNiches').textContent = String(r.geometry.niches?.length || 0);

  const c = calc();
  const rc = c.rooms.find(x => x.room.id === roomId);
  renderAutoKit(rc);

  const p = product(r.pricing.profileProductId);
  const d = dealerPrice(p);
  const rr = referencePrice(p);
  $('profileHint').textContent = p && d
    ? `Поставщик ${fmt(d.amount)} ${d.currency}/${d.unit || p.default_unit}${rr ? ` · МРЦ ${fmt(rr.amount,0)} ${rr.currency}` : ''}${rc?.profileStock ? ` · закупка ${fmt(rc.profileStock.purchaseM)} м (${rc.profileStock.pieces} хлыст.)` : ''}`
    : 'Профиль не выбран';
  return c;
}

function renderRoom() {
  const r = room();
  if (!r) return;
  $('roomHeading').textContent = r.name;
  $('rectLength').value = r.geometry.length ?? '';
  $('rectWidth').value = r.geometry.width ?? '';
  $('wastePct').value = r.pricing.wastePct ?? 8;
  $('membraneCost').value = r.pricing.membraneCostPerM2 ?? 8;
  $('laborCost').value = r.pricing.laborCostPerM2 ?? 12;
  $('roomNotes').value = r.notes || '';
  $('profileSelect').innerHTML = profileOptions();
  $('profileSelect').value = r.pricing.profileProductId ?? '';
  setMode(r.geometry.mode || 'rect', false);
  renderVertices();
  renderDiagonals();
  renderNiches();
  renderFeatures();
  renderMaterials();
  renderPlan();
  renderPhotos();
  recalc();
}

function renderAll() {
  syncFields();
  $('dbMeta').textContent = `БД: ${DB.meta?.productCount || DB.products?.length || 0} товаров · ${DB.meta?.priceCount || '—'} цен`;
  renderStatus();
  renderTabs();
  renderRoom();
  renderProjectList();
}

function syncFields() {
  $('projectTitle').value = project.title || '';
  $('clientName').value = project.client?.name || '';
  $('clientPhone').value = project.client?.phone || '';
  $('clientAddress').value = project.client?.address || '';
  $('usdRate').value = project.pricing?.usdBynRate ?? 3.3;
  $('priceMethod').value = project.pricing?.method || 'percent';
  $('priceValue').value = project.pricing?.value ?? 30;
}

function renderHistory() {
  $('historyList').innerHTML = (project.history || []).slice().reverse().map(item => `
    <div class="timeline-item"><b>${esc(item.label || item.type)}</b><small>${new Date(item.at).toLocaleString('ru-RU')}</small></div>
  `).join('') || '<div class="hint">История пуста</div>';
}

function initCatalog() {
  const cats = $('catalogCategory');
  cats.innerHTML = '<option value="">Все категории</option>' + (DB.categories || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const render = () => {
    const q = $('catalogSearch').value.toLowerCase().trim();
    const cid = num(cats.value);
    const products = (DB.products || []).filter(p =>
      (!cid || (p.category_ids || [p.category_id]).includes(cid)) &&
      (!q || p.name.toLowerCase().includes(q)) &&
      dealerPrice(p)
    ).slice(0,120);
    $('catalogResults').innerHTML = products.map(p => {
      const d = dealerPrice(p), rr = referencePrice(p);
      return `<article class="catalog-card"><h4>${esc(p.name)}</h4><p>${esc(category(p.category_id)?.name || '')}</p><p>${fmt(d.amount)} ${d.currency}/${esc(d.unit || p.default_unit || '')}${rr ? ` · МРЦ ${fmt(rr.amount,0)} ${rr.currency}` : ''}</p><footer><button class="ghost small" data-add-product="${p.id}">Добавить</button></footer></article>`;
    }).join('') || '<div class="hint">Ничего не найдено</div>';
    qa('[data-add-product]', $('catalogResults')).forEach(button => {
      button.onclick = () => {
        const r = room();
        const id = +button.dataset.addProduct;
        const existing = r.materials.find(m => m.productId === id);
        existing ? existing.qty++ : r.materials.push({productId:id, qty:1});
        persist('Материал добавлен');
        renderMaterials();
        recalc();
      };
    });
  };
  $('catalogSearch').oninput = render;
  cats.onchange = render;
  render();
}

async function loadProject(id) {
  project = structuredClone(projects.find(p => p.id === id) || projects[0]);
  if (!project) return;
  roomId = project.rooms?.[0]?.id;
  if (!roomId) {
    project.rooms = [createRoom()];
    roomId = project.rooms[0].id;
  }
  renderAll();
  if (innerWidth < 760) $('sidebar').classList.remove('open');
}

function newFeature(type, p) {
  const electrical = type === 'light' || type === 'chandelier';
  return {
    id: uid('feature'),
    type,
    label: featureNames[type],
    x: p.x,
    y: p.y,
    qty: 1,
    length: (type === 'track' || type === 'cornice') ? 1 : 0,
    angle: 0,
    unitCost: 0,
    ...(electrical ? {diameterMm:type === 'chandelier' ? 120 : 90, wireM:0} : {}),
  };
}

function bind() {
  for (const [id, apply] of [
    ['projectTitle', v => project.title = v],
    ['clientName', v => project.client.name = v],
    ['clientPhone', v => project.client.phone = v],
    ['clientAddress', v => project.client.address = v],
  ]) {
    $(id).oninput = e => { apply(e.target.value); persist(); };
  }

  $('usdRate').oninput = e => { project.pricing.usdBynRate = Math.max(0, num(e.target.value)); persist(); recalc(); };
  $('priceMethod').onchange = e => { project.pricing.method = e.target.value; persist(); recalc(); };
  $('priceValue').oninput = e => { project.pricing.value = num(e.target.value); persist(); recalc(); };
  qa('[data-mode]').forEach(button => button.onclick = () => setMode(button.dataset.mode));

  for (const id of ['rectLength','rectWidth']) {
    $(id).oninput = e => {
      room().geometry[id === 'rectLength' ? 'length' : 'width'] = Math.max(0, num(e.target.value));
      persist(); renderPlan(); recalc();
    };
  }
  for (const [id, key] of [['wastePct','wastePct'],['membraneCost','membraneCostPerM2'],['laborCost','laborCostPerM2']]) {
    $(id).oninput = e => { room().pricing[key] = Math.max(0, num(e.target.value)); persist(); recalc(); };
  }

  $('profileSelect').onchange = e => { room().pricing.profileProductId = e.target.value ? +e.target.value : null; persist(); recalc(); };
  $('roomNotes').oninput = e => { room().notes = e.target.value; persist(); };
  $('addVertexMode').onclick = () => {
    addVertex = !addVertex;
    tool = 'select';
    $('addVertexMode').classList.toggle('active', addVertex);
    $('planHint').textContent = addVertex ? 'Ставьте точки контура по порядку' : 'Схема готова к разметке';
  };
  $('undoVertex').onclick = () => {
    room().geometry.points.pop();
    room().geometry.diagonalMeasurements = [];
    persist('Отмена вершины'); renderVertices(); renderDiagonals(); renderPlan(); recalc();
  };
  $('clearPolygon').onclick = () => {
    if (!confirm('Очистить все вершины?')) return;
    room().geometry.points = [];
    room().geometry.diagonalMeasurements = [];
    persist('Геометрия очищена'); renderVertices(); renderDiagonals(); renderPlan(); recalc();
  };
  $('addDiagonal').onclick = () => {
    const pts = geometrySummary(room()).points;
    if (pts.length < 3) return toast('Добавьте минимум 3 угла');
    room().geometry.diagonalMeasurements.push({a:0,b:Math.min(2,pts.length-1),length:0});
    persist('Добавлена диагональ'); renderDiagonals(); renderPlan();
  };
  $('addNiche').onclick = () => {
    room().geometry.niches.push({id:uid('niche'),x:1,y:1,width:1,depth:.3});
    persist('Добавлена ниша'); renderNiches(); renderPlan(); recalc();
  };

  qa('[data-tool]').forEach(button => button.onclick = () => {
    tool = button.dataset.tool;
    addVertex = false;
    $('addVertexMode').classList.remove('active');
    qa('[data-tool]').forEach(x => x.classList.toggle('active', x === button));
    $('planHint').textContent = tool === 'select' ? 'Перетаскивайте вершины пальцем' : `Коснитесь плана: ${featureNames[tool]}`;
  });

  const svg = $('planSvg');
  svg.onpointerdown = e => {
    const vertex = e.target.closest?.('[data-vertex]');
    if (vertex && tool === 'select') {
      drag = +vertex.dataset.vertex;
      svg.setPointerCapture?.(e.pointerId);
      return;
    }
    const p = world(e);
    if (addVertex && room().geometry.mode === 'polygon') {
      room().geometry.points.push(p);
      persist('Добавлена вершина'); renderVertices(); renderPlan(); recalc();
    } else if (tool !== 'select') {
      room().features.push(newFeature(tool, p));
      persist('Добавлен элемент'); renderFeatures(); renderPlan(); recalc();
    }
  };
  svg.onpointermove = e => {
    if (drag < 0) return;
    const p = world(e), vertex = room().geometry.points[drag];
    if (vertex) { vertex.x = p.x; vertex.y = p.y; renderPlan(); recalc(); }
  };
  svg.onpointerup = () => {
    if (drag >= 0) { drag = -1; persist('Вершина перемещена'); renderVertices(); }
  };
  svg.onpointercancel = svg.onpointerup;

  $('photoInput').onchange = async e => {
    for (const file of [...e.target.files]) {
      if (!file.type.startsWith('image/')) continue;
      const meta = await savePhoto(project.id, room().id, file);
      room().photos.push(meta);
    }
    e.target.value = '';
    await persist('Добавлены фото');
    renderPhotos();
  };
  $('openCatalog').onclick = () => $('catalogDialog').showModal();
  $('historyBtn').onclick = () => { renderHistory(); $('historyDialog').showModal(); };
  $('deleteProject').onclick = async () => {
    if (!confirm('Удалить объект и локальные фото?')) return;
    await deleteProject(project.id);
    projects = await listProjects();
    if (!projects.length) {
      const p = createProject();
      await saveProject(p);
      projects = [p];
    }
    await loadProject(projects[0].id);
    $('historyDialog').close();
  };
  qa('.pdf-btn').forEach(button => button.onclick = async () => {
    button.disabled = true;
    try {
      await saveProject(project);
      await downloadProjectPdf(project, recalc(), button.dataset.pdf);
      toast('PDF готов');
    } catch (e) {
      console.error(e);
      toast('Ошибка PDF');
    } finally {
      button.disabled = false;
    }
  });
  $('newProject').onclick = async () => {
    const p = createProject();
    await saveProject(p);
    projects = await listProjects();
    await loadProject(p.id);
    toast('Создан новый объект');
  };
  $('projectSearch').oninput = renderProjectList;
  $('projectStatusFilter').onchange = renderProjectList;
  $('exportBackup').onclick = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stretch-ceiling-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('importBackup').onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      const count = await importAll(data);
      projects = await listProjects();
      await loadProject(projects[0].id);
      toast(`Восстановлено: ${count}`);
    } catch {
      toast('Ошибка резервной копии');
    }
    e.target.value = '';
  };
  $('openSidebar').onclick = () => $('sidebar').classList.add('open');
  $('closeSidebar').onclick = () => $('sidebar').classList.remove('open');
}

async function init() {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    document.body.classList.add('in-telegram');
  }
  projects = await listProjects();
  if (!projects.length) {
    project = createProject();
    await saveProject(project);
    projects = [project];
  } else {
    project = structuredClone(projects[0]);
  }
  roomId = project.rooms?.[0]?.id;
  if (!roomId) {
    project.rooms = [createRoom()];
    roomId = project.rooms[0].id;
  }
  bind();
  initCatalog();
  renderAll();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init().catch(e => {
  console.error(e);
  document.body.innerHTML = '<main style="padding:30px;color:white">Ошибка запуска локального приложения. Обновите страницу.</main>';
});