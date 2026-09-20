const DB=window.PRICE_DB||{products:[],categories:[],meta:{}};
const $=id=>document.getElementById(id);
const n=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0};
const pos=v=>Math.max(0,n(v));
const ceilSafe=v=>v>0?Math.ceil(v-1e-9):0;
const money=v=>`${new Intl.NumberFormat('ru-BY',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n(v))} BYN`;
const fmt=(v,d=2)=>new Intl.NumberFormat('ru-BY',{maximumFractionDigits:d}).format(n(v));
const raw=id=>DB.products?.find(p=>Number(p.id)===Number(id))||null;
const dealer=p=>(p?.prices||[]).find(x=>x.price_type==='dealer'&&!x.variant)||(p?.prices||[]).find(x=>x.price_type==='dealer')||null;
const priceByn=(p,rate)=>{const d=dealer(p);if(!d)return 0;return d.currency==='USD'?pos(d.amount)*rate:pos(d.amount)};
const val=id=>$(id).value;
const num=id=>pos(val(id));
const isSet=id=>val(id)!==''&&Number.isFinite(Number(val(id)));

const IDS={ring90:8,ring150:9,ring205:10,ring300:11,platform200:14,platform140:15,platform90:16,platform120:18,platform105:19,platform155:20,platform225:21,chandelierPlatform:22,screwPack:50,dowelPack:53,suspension:54,terminal:68,wire:76};

function ringId(d){d=pos(d)||90;return d<=90?IDS.ring90:d<=150?IDS.ring150:d<=205?IDS.ring205:d<=300?IDS.ring300:null}
function platformId(d){d=pos(d)||90;return d<=90?IDS.platform90:d<=105?IDS.platform105:d<=120?IDS.platform120:d<=140?IDS.platform140:d<=155?IDS.platform155:d<=200?IDS.platform200:d<=225?IDS.platform225:null}
function stickLength(product){const m=String(product?.name||'').replace(',','.').match(/(\d+(?:\.\d+)?)\s*м(?!м)/i);return m&&Number(m[1])>0?Number(m[1]):2}
function profileProducts(){return (DB.products||[]).filter(p=>/(профил|багет)/i.test(String(p.name||''))&&dealer(p));}

function initProfiles(){
  const list=profileProducts();
  $('profile').innerHTML='<option value="">Выберите профиль</option>'+list.map(p=>{const d=dealer(p);return `<option value="${p.id}">${p.name} — ${fmt(d.amount)} ${d.currency}/${d.unit||p.default_unit||''}</option>`}).join('');
  $('dbMeta').textContent=`${DB.meta?.productCount||DB.products?.length||0} товаров`;
}

function unitLine(productId,qty,rate,label,unit='шт.'){
  const product=raw(productId),unitCost=priceByn(product,rate);
  return {productId,name:product?.name||label||`LumFer #${productId}`,required:qty,buy:qty,remainder:0,unit,unitCost,total:qty*unitCost,missing:!product};
}
function packLine(productId,required,rate,label){
  const product=raw(productId),packCost=priceByn(product,rate),packSize=1000,packs=ceilSafe(required/packSize),buy=packs*packSize;
  return {productId,name:product?.name||label,required,buy,remainder:Math.max(0,buy-required),unit:'шт.',unitCost:packSize?packCost/packSize:0,total:packs*packCost,packCost,packSize,packs,missing:!product};
}
function mergeLines(lines){
  const map=new Map();
  for(const line of lines){
    if(!line||!line.required)continue;
    const key=`${line.productId}:${line.packSize||1}`;
    const prev=map.get(key);
    if(!prev){map.set(key,{...line});continue}
    if(line.packSize){
      const required=prev.required+line.required,packs=ceilSafe(required/line.packSize),buy=packs*line.packSize;
      prev.required=required;prev.packs=packs;prev.buy=buy;prev.remainder=buy-required;prev.total=packs*prev.packCost;
    }else{prev.required+=line.required;prev.buy+=line.buy;prev.total+=line.total}
  }
  return [...map.values()];
}

function calculate(){
  const length=num('length'),width=num('width'),area=length*width,perimeter=length&&width?2*(length+width):0,corners=perimeter?4:0;
  const rate=num('usd'),waste=num('waste'),membraneQty=area*(1+waste/100),membraneCost=membraneQty*num('membrane'),laborCost=area*num('labor');

  const profile=raw(val('profile'));
  let pieces=0,purchaseM=0,offcutM=0,profileCost=0,joints=0;
  if(profile&&perimeter){
    const stick=stickLength(profile);pieces=ceilSafe(perimeter/stick);purchaseM=pieces*stick;offcutM=Math.max(0,purchaseM-perimeter);joints=Math.max(0,pieces-1);
    const d=dealer(profile),unit=String(d?.unit||profile.default_unit||'').toLowerCase(),p=priceByn(profile,rate);
    profileCost=(unit.includes('шт')?pieces:purchaseM)*p;
  }
  const baseFasteners=profile?ceilSafe(perimeter/.1):0;
  const reinforcementSet=isSet('cornerExtra')&&isSet('jointExtra');
  const fasteners=baseFasteners+(reinforcementSet?ceilSafe(corners*num('cornerExtra'))+ceilSafe(joints*num('jointExtra')):0);

  const lights=Math.floor(num('lights')),chandeliers=Math.floor(num('chandeliers')),points=lights+chandeliers,lines=points?Math.floor(num('lines')):0;
  const wago=points*2+Math.max(0,lines)*2,suspensions=points*2;
  const lightWire=lights*num('wirePerLight'),chandelierWire=chandeliers*num('wirePerChandelier'),wire=lightWire+chandelierWire;
  const featureWork=lights*num('lightWork')+chandeliers*num('chandelierWork');

  const pipeQty=Math.floor(num('pipeQty')),pipeCost=pipeQty*(num('pipeWork')+num('pipeMaterial'));
  const corniceLength=num('corniceLength'),corniceTurns=Math.floor(num('corniceCorners'));
  const corniceCost=corniceLength*(num('corniceWork')+num('corniceMaterial'))+corniceTurns*num('corniceCornerCost');
  const featuresCost=featureWork+pipeCost+corniceCost;

  const kit=[];
  const lightDiameter=num('lightDiameter')||90;
  if(lights){const pid=platformId(lightDiameter),rid=ringId(lightDiameter);if(pid)kit.push(unitLine(pid,lights,rate,'Платформа светильника'));if(rid)kit.push(unitLine(rid,lights,rate,'Кольцо','шт.'))}
  if(chandeliers){kit.push(unitLine(IDS.chandelierPlatform,chandeliers,rate,'Платформа для люстры'));const rid=ringId(120);if(rid)kit.push(unitLine(rid,chandeliers,rate,'Кольцо','шт.'))}
  if(suspensions)kit.push(unitLine(IDS.suspension,suspensions,rate,'Подвес'));
  if(wago)kit.push(unitLine(IDS.terminal,wago,rate,'Клеммник 3-разъёмный'));
  if(wire)kit.push(unitLine(IDS.wire,wire,rate,'Провод 2×0,75','м.п.'));
  if(fasteners){kit.push(packLine(IDS.dowelPack,fasteners,rate,'Дюбель Чапай 6×35'));kit.push(packLine(IDS.screwPack,fasteners,rate,'Саморез 3,5×35'))}
  const autoLines=mergeLines(kit),autoCost=autoLines.reduce((s,x)=>s+x.total,0);

  const cost=membraneCost+laborCost+profileCost+featuresCost+autoCost;
  const method=val('priceMethod'),pv=num('priceValue');
  let client=cost;if(method==='percent')client=cost*(1+pv/100);else if(method==='fixed')client=cost+pv;else if(method==='manual')client=pv;
  const profit=client-cost,margin=client?profit/client*100:0;

  const issues=[];
  if(!(length>0&&width>0))issues.push({text:'Задайте длину и ширину помещения',blocking:true});
  if(!profile)issues.push({text:'Выберите профиль из локального прайса',blocking:true});
  if(profile&&!reinforcementSet)issues.push({text:'Не задано усиление крепежа на углах и стыках профиля',blocking:true});
  if(points&&!lines)issues.push({text:'Для световых точек не задано количество электрических линий',blocking:true});
  if(points&&!wire)issues.push({text:'Для световых точек не задан метраж провода',blocking:true});
  if(lights&&!num('lightWork'))issues.push({text:'Работа по светильникам пока 0 BYN',blocking:false});
  if(chandeliers&&!num('chandelierWork'))issues.push({text:'Работа по люстрам пока 0 BYN',blocking:false});
  if(pipeQty&&!num('pipeDiameter'))issues.push({text:'Для трубы не задан диаметр',blocking:true});
  if(pipeQty&&!num('pipeWork'))issues.push({text:'Работа по трубе пока 0 BYN',blocking:false});
  if(corniceLength&&!num('corniceWork'))issues.push({text:'Работа по карнизу пока 0 BYN/м',blocking:false});
  const missing=autoLines.filter(x=>x.missing).map(x=>x.productId);if(missing.length)issues.push({text:`В локальной БД не найдены позиции LumFer: ${[...new Set(missing)].join(', ')}`,blocking:true});
  const complete=!issues.some(x=>x.blocking);

  $('areaOut').textContent=`${fmt(area)} м²`;$('perimeterOut').textContent=`${fmt(perimeter)} м`;
  $('sticksOut').textContent=profile?`${pieces} × ${fmt(stickLength(profile))} м`:'—';
  $('profileBuyOut').textContent=profile?`${fmt(purchaseM)} м · остаток ${fmt(offcutM)} м · ${money(profileCost)}`:'—';
  $('fastenerBaseOut').textContent=`${baseFasteners} шт.`;$('fastenerOut').textContent=reinforcementSet?`${fasteners} шт.`:'нужно правило усиления';
  $('pointsOut').textContent=`${points} шт.`;$('wagoOut').textContent=`${wago} шт.`;$('suspensionsOut').textContent=`${suspensions} шт.`;$('wireOut').textContent=`${fmt(wire)} м`;
  $('autoTotal').textContent=money(autoCost);
  $('autoRows').innerHTML=autoLines.length?autoLines.map(x=>`<tr><td>${x.name}</td><td>${fmt(x.required)} ${x.unit}</td><td>${x.packSize?`${x.packs} уп. = `:''}${fmt(x.buy)} ${x.unit}</td><td>${fmt(x.remainder)} ${x.unit}</td><td>${money(x.total)}</td></tr>`).join(''):'<tr><td colspan="5">Автозакупка пока пуста</td></tr>';
  $('costOut').textContent=money(cost);$('clientOut').textContent=complete?money(client):'—';$('profitOut').textContent=complete?money(profit):'—';$('marginOut').textContent=complete?`${fmt(margin,1)}%`:'—';
  $('statusText').textContent=complete?(issues.length?'Готово с замечаниями':'Смета готова'):'Смета неполная';
  $('statusCard').classList.toggle('ready',complete);$('statusCard').classList.toggle('blocked',!complete);
  $('issues').innerHTML=issues.map(x=>`<div class="issue ${x.blocking?'':'warn'}">${x.blocking?'Обязательно: ':'Замечание: '}${x.text}</div>`).join('')||'<div class="issue">Обязательных замечаний нет.</div>';
}

initProfiles();
document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calculate));
document.querySelectorAll('select').forEach(el=>el.addEventListener('change',calculate));
calculate();
