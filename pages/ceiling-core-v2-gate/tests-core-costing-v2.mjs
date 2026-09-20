import assert from 'node:assert/strict';
import {packPurchasePlan, reinforcedFastenerPlan, validateRoomQuote} from './procurement-v2.mjs';
import {wallFastenerPlan, buildElectricalPlan} from './field-rules-v1.mjs';
import {createRoom, createProject, calculateProject, featureCostBreakdown} from './domain-v3.mjs';

const round2 = value => Math.round(value * 100) / 100;
const usd = (id, amount, name=`item-${id}`, unit='шт.') => ({id,name,default_unit:unit,prices:[{price_type:'dealer',amount,currency:'USD',unit}]});

const pack = packPurchasePlan(181, 1000, 20.77);
assert.equal(pack.packCount, 1);
assert.equal(pack.purchaseQty, 1000);
assert.equal(pack.remainderQty, 819);
assert.equal(pack.total, 20.77);

const twoPacks = packPurchasePlan(1201, 1000, 20.77);
assert.equal(twoPacks.packCount, 2);
assert.equal(twoPacks.purchaseQty, 2000);
assert.equal(twoPacks.remainderQty, 799);
assert.equal(twoPacks.total, 41.54);

const baseFasteners = wallFastenerPlan(18);
const pendingFasteners = reinforcedFastenerPlan(baseFasteners,{cornerCount:4,jointCount:8});
assert.equal(pendingFasteners.baseQty,180);
assert.equal(pendingFasteners.qty,180);
assert.equal(pendingFasteners.reinforcementConfigured,false);

const configuredFasteners = reinforcedFastenerPlan(baseFasteners,{
  cornerCount:4,jointCount:8,extraPerCorner:1,extraPerJoint:2,
});
assert.equal(configuredFasteners.cornerExtraQty,4);
assert.equal(configuredFasteners.jointExtraQty,16);
assert.equal(configuredFasteners.qty,200);
assert.equal(configuredFasteners.reinforcementConfigured,true);

const electrical = buildElectricalPlan([
  {type:'light',qty:2,electricalLineId:'A'},
  {type:'light',qty:2},
]);
assert.equal(electrical.points,4);
assert.equal(electrical.lineCount,2);
assert.equal(electrical.unassignedPoints,2);
assert.equal(electrical.wago.total,12);

const cornice = featureCostBreakdown({type:'cornice',length:4,unitCost:5,materialUnitCost:2,cornerCount:2,cornerUnitCost:3});
assert.equal(cornice.labor,20);
assert.equal(cornice.material,8);
assert.equal(cornice.corners,6);
assert.equal(cornice.total,34);

const pipe = featureCostBreakdown({type:'pipe',qty:2,unitCost:8,materialUnitCost:1.5});
assert.equal(pipe.total,19);

const validation = validateRoomQuote({
  room:{features:[{type:'light',qty:2,unitCost:0},{type:'pipe',qty:1,unitCost:0},{type:'cornice',length:0,unitCost:0}]},
  fasteners:pendingFasteners,
  electrical:buildElectricalPlan([{type:'light',qty:2}]),
  autoKit:{wireM:0},
});
assert.equal(validation.isComplete,false);
assert.ok(validation.blockingIssues.some(x=>x.code==='FASTENER_REINFORCEMENT_UNSET'));
assert.ok(validation.blockingIssues.some(x=>x.code==='ELECTRICAL_LINES_UNASSIGNED'));
assert.ok(validation.blockingIssues.some(x=>x.code==='ELECTRICAL_GROUPED_POINT'));
assert.ok(validation.blockingIssues.some(x=>x.code==='WIRE_MISSING'));
assert.ok(validation.blockingIssues.some(x=>x.code==='PIPE_DIAMETER_MISSING'));
assert.ok(validation.blockingIssues.some(x=>x.code==='CORNICE_LENGTH_MISSING'));
assert.ok(validation.warnings.some(x=>x.code==='LIGHT_WORK_RATE_ZERO'));
assert.ok(validation.warnings.some(x=>x.code==='PIPE_MATERIAL_RATE_ZERO'));
assert.ok(validation.warnings.some(x=>x.code==='CORNICE_MATERIAL_RATE_ZERO'));

const db={products:[
  usd(1,.7,'Профиль 2 м','м.п.'),
  usd(8,.06,'Кольцо армирующее Ø20-90 мм'),
  usd(16,.72,'Платформа универсальная D50-90'),
  usd(50,6.8,'Саморез 3,5*35 мм (упаковка 1000 шт.)'),
  usd(53,6.7,'Дюбель Чапай 6*35 мм (упаковка 1000 шт.)'),
  usd(54,.15,'Подвес 07*300 мм'),
  usd(68,.12,'Клеммник 3-х разъемный'),
  usd(76,.35,'Провод 2*0,75 медь','м.п.'),
]};

const emptyRoom=createRoom();
emptyRoom.geometry={mode:'rect',length:4,width:5,points:[],diagonalMeasurements:[],niches:[]};
const emptyProject=createProject();
emptyProject.rooms=[emptyRoom];
emptyProject.pricing={usdBynRate:3.1,method:'percent',value:66};
const emptyCalc=calculateProject(emptyProject,db).rooms[0];
assert.equal(emptyCalc.profile == null,true);
assert.equal(emptyCalc.fasteners.qty,0);
assert.equal(emptyCalc.autoKit.lines.some(x=>x.productId===50||x.productId===53),false);
assert.equal(emptyCalc.validation.blockingIssues.some(x=>x.code==='FASTENER_REINFORCEMENT_UNSET'),false);

const room=createRoom();
room.geometry={mode:'rect',length:4,width:5,points:[],diagonalMeasurements:[],niches:[]};
room.pricing.profileProductId=1;
room.pricing.fastenerExtraPerCorner=1;
room.pricing.fastenerExtraPerJoint=2;
room.pricing.membraneCostPerM2=8;
room.pricing.laborCostPerM2=12;
room.features=[
  {type:'light',qty:1,x:1,y:1,diameterMm:90,wireM:2,electricalLineId:'L1',unitCost:10},
  {type:'light',qty:1,x:3,y:1,diameterMm:90,wireM:2,electricalLineId:'L1',unitCost:10},
  {type:'light',qty:1,x:1,y:4,diameterMm:90,wireM:2,electricalLineId:'L1',unitCost:10},
  {type:'light',qty:1,x:3,y:4,diameterMm:90,wireM:2,electricalLineId:'L1',unitCost:10},
  {type:'pipe',qty:1,x:2,y:2,diameterMm:50,pipeKind:'bypass',unitCost:15,materialUnitCost:3},
  {type:'cornice',qty:1,x:2,y:4.5,length:4,cornerCount:2,unitCost:10,materialUnitCost:20,cornerUnitCost:5},
];
const project=createProject();
project.rooms=[room];
project.pricing={usdBynRate:3.1,method:'percent',value:66};
const calc=calculateProject(project,db);
const rc=calc.rooms[0];
assert.equal(rc.geom.area,20);
assert.equal(rc.geom.perimeter,18);
assert.equal(rc.profileStock.pieces,9);
assert.equal(rc.fasteners.baseQty,180);
assert.equal(rc.fasteners.cornerExtraQty,4);
assert.equal(rc.fasteners.jointExtraQty,16);
assert.equal(rc.fasteners.qty,200);
assert.equal(rc.electrical.points,4);
assert.equal(rc.electrical.lineCount,1);
assert.equal(rc.electrical.wago.total,10);
assert.equal(rc.autoKit.wireM,8);
assert.equal(rc.autoKit.lines.find(x=>x.productId===53)?.qty,1000);
assert.equal(rc.autoKit.lines.find(x=>x.productId===50)?.qty,1000);
assert.equal(round2(rc.membraneCost),172.8);
assert.equal(round2(rc.laborCost),240);
assert.equal(round2(rc.profileCost),39.06);
assert.equal(round2(rc.autoMaterialsCost),67.64);
assert.equal(round2(rc.featuresCost),188);
assert.equal(round2(rc.cost),707.5);
assert.equal(round2(calc.clientTotal),1174.45);
assert.equal(rc.isComplete,true);
assert.equal(calc.isComplete,true);

console.log('CORE_COSTING_V2_TESTS_PASS');
console.log(`CONTROL_4X5_COST=${round2(rc.cost)} BYN`);
console.log(`CONTROL_4X5_CLIENT=${round2(calc.clientTotal)} BYN`);
