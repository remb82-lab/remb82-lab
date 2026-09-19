export function num(v){const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:0;}
export function money(v){return Math.round((v+Number.EPSILON)*100)/100;}
export function calculate(p){
 const missing=[];let cost=0,retail=0,materials=0,labor=0;
 const rooms=p.rooms.map(r=>{
  const area=num(r.length)*num(r.width),perimeter=2*(num(r.length)+num(r.width));
  if(!area)missing.push(r.name+': размеры');
  const stick=num(r.stick);if(!stick)missing.push(r.name+': длина хлыста');
  const bars=stick?Math.ceil(perimeter/stick):0;
  const base=[{name:r.canvas||'Полотно',qty:area,unit:'м²',price:r.canvasCost,sell:r.canvasSell,supplier:r.canvasSupplier||''}, {name:r.profile||'Профиль',qty:bars*stick,sellQty:perimeter,unit:'м',price:r.profileCost,sell:r.profileSell,supplier:r.profileSupplier||'',bars,stick}, {name:'Монтаж',qty:area,unit:'м²',price:r.laborCost,sell:r.laborSell,labor:true}];
  const lines=[...base,...r.items.map(i=>({...i,qty:num(i.qty),sellQty:num(i.qty)}))].map(i=>{
   if(i.qty>0&&(i.price===''||i.price==null))missing.push(r.name+': закупка/затраты «'+i.name+'»');
   if(p.mode==='retail'&&i.qty>0&&(i.sell===''||i.sell==null))missing.push(r.name+': розница «'+i.name+'»');
   const rate=i.currency==='USD'?num(p.rate):1;
   if(i.currency==='USD'&&!num(p.rate))missing.push('Курс USD');
   const c=money(i.qty*num(i.price)*rate),s=money((i.sellQty??i.qty)*num(i.sell));cost+=c;retail+=s;i.labor?labor+=c:materials+=c;
   return {...i,cost:c,total:s};
  });return {...r,area,perimeter,bars,lines};
 });
 if(p.deliveryCost==='')missing.push('Затраты на доставку');
 cost+=num(p.deliveryCost);retail+=num(p.deliverySell);
 let gross=p.mode==='retail'?retail:p.mode==='manual'?num(p.manual):p.mode==='mixed'?materials*(1+num(p.markup)/100)+labor+num(p.deliveryCost):cost*(1+num(p.markup)/100);
 if(p.mode==='manual'&&p.manual==='')missing.push('Ручная цена');
 const discount=num(p.discount);if(discount>gross)missing.push('Скидка больше стоимости');
 const total=money(Math.max(num(p.minimum),Math.max(0,gross-discount)));cost=money(cost);
 return {rooms,cost,total,profit:money(total-cost),margin:total?money((total-cost)/total*100):0,missing:[...new Set(missing)]};
}
