import {profileStockPlan, wallFastenerPlan, buildElectricalPlan} from './field-rules-v1.mjs';
import {buildLumferAutoKit} from './lumfer-kit-adapter.mjs';

export const STATUS_ORDER = ['measurement','approval','installation','completed'];
export const STATUS_LABELS = {
  measurement: 'Замер',
  approval: 'Согласование',
  installation: 'Монтаж',
  completed: 'Завершён',
};

export function uid(prefix='id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
}

export function createRoom(name='Помещение 1') {
  return {
    id: uid('room'), name,
    geometry: { mode: 'rect', length: 4, width: 3, points: [], diagonalMeasurements: [], niches: [] },
    features: [], materials: [], notes: '', photos: [],
    pricing: { membraneCostPerM2: 8, laborCostPerM2: 12, wastePct: 8, profileProductId: null },
  };
}

export function createProject() {
  const now = new Date().toISOString();
  return {
    id: uid('project'), version: 3, title: 'Новый объект', client: { name:'', phone:'', address:'' },
    status: 'measurement', statusHistory: [{status:'measurement', at:now}],
    createdAt: now, updatedAt: now, notes: '', rooms: [createRoom()],
    pricing: { usdBynRate: 3.30, method:'percent', value:30 },
    history: [{at: now, type:'created', label:'Объект создан'}],
  };
}

export function polygonArea(points=[]) {
  if (points.length < 3) return 0;
  let s = 0;
  for (let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length];
    s += a.x*b.y - b.x*a.y;
  }
  return Math.abs(s)/2;
}

export function polygonPerimeter(points=[]) {
  if (points.length < 2) return 0;
  let s=0;
  for (let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length];
    s += Math.hypot(b.x-a.x,b.y-a.y);
  }
  return s;
}

export function interiorAngle(prev, cur, next) {
  const ax=prev.x-cur.x, ay=prev.y-cur.y, bx=next.x-cur.x, by=next.y-cur.y;
  const ma=Math.hypot(ax,ay), mb=Math.hypot(bx,by);
  if (!ma || !mb) return 0;
  const cos=Math.min(1,Math.max(-1,(ax*bx+ay*by)/(ma*mb)));
  return Math.acos(cos)*180/Math.PI;
}

export function allAngles(points=[]) {
  if (points.length<3) return [];
  return points.map((p,i)=>interiorAngle(points[(i-1+points.length)%points.length],p,points[(i+1)%points.length]));
}

export function diagonalLength(points=[], a=0, b=1) {
  const p=points[a], q=points[b];
  return p&&q ? Math.hypot(q.x-p.x,q.y-p.y) : 0;
}

export function geometrySummary(room) {
  const g=room.geometry||{};
  let grossArea=0, perimeter=0, points=[];
  if (g.mode==='rect') {
    const l=Math.max(0,+g.length||0), w=Math.max(0,+g.width||0);
    grossArea=l*w; perimeter=l&&w?2*(l+w):0;
    points=[{x:0,y:0},{x:l,y:0},{x:l,y:w},{x:0,y:w}];
  } else {
    points=(g.points||[]).map(p=>({x:+p.x||0,y:+p.y||0}));
    grossArea=polygonArea(points); perimeter=polygonPerimeter(points);
  }
  let nicheArea=0, nichePerimeter=0;
  for (const n of g.niches||[]) {
    const width=Math.max(0,+n.width||0), depth=Math.max(0,+n.depth||0);
    nicheArea += width*depth;
    nichePerimeter += width + 2*depth;
  }
  const area=Math.max(0,grossArea-nicheArea);
  return {grossArea,nicheArea,area,perimeter:perimeter+nichePerimeter,basePerimeter:perimeter,nichePerimeter,points,angles:allAngles(points)};
}

export function dealerPrice(product) {
  const prices=product?.prices||[];
  return prices.find(x=>x.price_type==='dealer'&&!x.variant) || prices.find(x=>x.price_type==='dealer') || null;
}

export function referencePrice(product) {
  return product?.prices?.find(x=>x.price_type==='mrc') || product?.prices?.find(x=>x.price_type==='rrp') || null;
}

export function unitPriceByn(product, usdBynRate=0) {
  const p=dealerPrice(product);
  if (!p) return 0;
  return p.currency==='USD' ? (+p.amount||0)*(+usdBynRate||0) : (+p.amount||0);
}

export function profileStickLengthM(product, fallback=2) {
  const name=String(product?.name||'').replace(',', '.');
  const match=name.match(/(\d+(?:\.\d+)?)\s*м(?!м)/i);
  const parsed=match ? Number(match[1]) : 0;
  return parsed>0 ? parsed : Math.max(0.001,+fallback||2);
}

export function profilePurchasePlan(product, requiredM, usdBynRate=0) {
  const dealer=dealerPrice(product);
  const unit=String(dealer?.unit||product?.default_unit||'').toLowerCase();
  const stickLengthM=profileStickLengthM(product,2);
  const stock=profileStockPlan(requiredM,stickLengthM);
  const dealerUnitPriceByn=unitPriceByn(product,usdBynRate);
  const byPiece=unit.includes('шт');
  const chargeQty=byPiece ? stock.pieces : stock.purchaseM;
  const pricingBasis=byPiece ? 'stick' : 'meter';
  const cost=chargeQty*dealerUnitPriceByn;
  return {
    ...stock,
    pricingBasis,
    chargeQty,
    dealerUnit: dealer?.unit||product?.default_unit||'',
    dealerUnitPriceByn,
    cost,
  };
}

export function featureCost(f) {
  const unit=Math.max(0,+f.unitCost||0);
  if (f.type==='track' || f.type==='cornice') return Math.max(0,+f.length||0)*unit;
  return Math.max(1,+f.qty||1)*unit;
}

export function calculateRoom(room, db={products:[]}, settings={usdBynRate:0}) {
  const geom=geometrySummary(room);
  const factor=1+Math.max(0,+room.pricing?.wastePct||0)/100;
  const membraneQty=geom.area*factor;
  const membraneCost=membraneQty*Math.max(0,+room.pricing?.membraneCostPerM2||0);
  const laborCost=geom.area*Math.max(0,+room.pricing?.laborCostPerM2||0);
  const profile=db.products?.find(p=>p.id===Number(room.pricing?.profileProductId));
  const profileStock=profilePurchasePlan(profile,geom.perimeter,settings.usdBynRate);
  const profileQty=profileStock.purchaseM;
  const profileCost=profileStock.cost;
  const fasteners=wallFastenerPlan(geom.perimeter);
  const electrical=buildElectricalPlan(room.features||[]);
  const autoKit=buildLumferAutoKit({room,electrical,fasteners,db,usdBynRate:settings.usdBynRate});
  const materials=(room.materials||[]).map(line=>{
    const product=db.products?.find(p=>p.id===Number(line.productId));
    const qty=Math.max(0,+line.qty||0), unit=unitPriceByn(product,settings.usdBynRate);
    return {...line, product, qty, unitCost:unit, total:qty*unit};
  });
  const materialsCost=materials.reduce((s,x)=>s+x.total,0);
  const features=(room.features||[]).map(x=>({...x,total:featureCost(x)}));
  const featuresCost=features.reduce((s,x)=>s+x.total,0);
  const autoMaterialsCost=autoKit.total;
  const cost=membraneCost+laborCost+profileCost+materialsCost+featuresCost+autoMaterialsCost;
  return {room,geom,factor,membraneQty,membraneCost,laborCost,profile,profileQty,profileStock,profileCost,fasteners,electrical,autoKit,autoMaterialsCost,materials,materialsCost,features,featuresCost,cost};
}

export function calculateProject(project, db={products:[]}) {
  const usdBynRate=+project.pricing?.usdBynRate||0;
  const rooms=(project.rooms||[]).map(r=>calculateRoom(r,db,{usdBynRate}));
  const cost=rooms.reduce((s,r)=>s+r.cost,0);
  const method=project.pricing?.method||'percent', value=+project.pricing?.value||0;
  let clientTotal=cost;
  if (method==='percent') clientTotal=cost*(1+value/100);
  else if (method==='fixed') clientTotal=cost+value;
  else if (method==='manual') clientTotal=value;
  const profit=clientTotal-cost, margin=clientTotal?profit/clientTotal*100:0;
  return {rooms,cost,clientTotal,profit,margin,totalArea:rooms.reduce((s,r)=>s+r.geom.area,0),totalPerimeter:rooms.reduce((s,r)=>s+r.geom.perimeter,0)};
}

export function setProjectStatus(project,status) {
  if (!STATUS_ORDER.includes(status)) throw new Error('Unknown status');
  if (project.status===status) return project;
  const at=new Date().toISOString();
  project.status=status;
  project.statusHistory=project.statusHistory||[];
  project.statusHistory.push({status,at});
  project.history=project.history||[];
  project.history.push({at,type:'status',label:`Статус: ${STATUS_LABELS[status]}`});
  project.updatedAt=at;
  return project;
}

export function touch(project,label='Изменения сохранены') {
  const at=new Date().toISOString();
  project.updatedAt=at;
  project.history=project.history||[];
  const last=project.history[project.history.length-1];
  if (!last || last.label!==label || (Date.now()-Date.parse(last.at))>15000) project.history.push({at,type:'edit',label});
  return project;
}

export function isValidPolygon(points=[]) {
  if (points.length<3) return false;
  return polygonArea(points)>0.01;
}
