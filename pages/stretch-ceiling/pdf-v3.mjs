const PAGE_W=1240, PAGE_H=1754, M=92;
const PT_W=595.28, PT_H=841.89;

function money(v){return new Intl.NumberFormat('ru-BY',{minimumFractionDigits:2,maximumFractionDigits:2}).format(+v||0)+' BYN'}
function num(v,d=2){return new Intl.NumberFormat('ru-BY',{maximumFractionDigits:d}).format(+v||0)}
function date(v){try{return new Date(v).toLocaleString('ru-RU')}catch{return String(v||'')}}

function wrap(ctx,text,maxWidth){
  const words=String(text??'').split(/\s+/), out=[]; let line='';
  for(const w of words){const next=line?line+' '+w:w;if(ctx.measureText(next).width>maxWidth&&line){out.push(line);line=w}else line=next}
  if(line)out.push(line);return out.length?out:[''];
}

function newPage(title,subtitle){
  const c=document.createElement('canvas');c.width=PAGE_W;c.height=PAGE_H;const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,PAGE_W,PAGE_H);
  ctx.fillStyle='#121820';ctx.font='700 38px Arial, sans-serif';ctx.fillText(title,M,92);
  ctx.fillStyle='#617080';ctx.font='22px Arial, sans-serif';if(subtitle)ctx.fillText(subtitle,M,128);
  ctx.strokeStyle='#dfe5ea';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(M,152);ctx.lineTo(PAGE_W-M,152);ctx.stroke();
  return {c,ctx,y:196};
}

function lineBlock(page,label,value,bold=false){
  const {ctx}=page;ctx.font=`${bold?'700':'400'} 23px Arial, sans-serif`;ctx.fillStyle='#151b22';
  const left=wrap(ctx,String(label),610), right=wrap(ctx,String(value),360);const rows=Math.max(left.length,right.length);const h=34*rows+12;
  if(page.y+h>PAGE_H-100)return false;
  left.forEach((t,i)=>ctx.fillText(t,M,page.y+i*34));ctx.textAlign='right';right.forEach((t,i)=>ctx.fillText(t,PAGE_W-M,page.y+i*34));ctx.textAlign='left';
  page.y+=h;ctx.strokeStyle='#eef1f4';ctx.beginPath();ctx.moveTo(M,page.y-4);ctx.lineTo(PAGE_W-M,page.y-4);ctx.stroke();return true;
}

function heading(page,text){
  if(page.y+64>PAGE_H-100)return false;
  page.ctx.fillStyle='#1a5f5a';page.ctx.font='700 27px Arial, sans-serif';page.ctx.fillText(text,M,page.y+10);page.y+=54;return true;
}
function paragraph(page,text){
  const ctx=page.ctx;ctx.fillStyle='#34404c';ctx.font='22px Arial, sans-serif';const lines=wrap(ctx,text,PAGE_W-2*M);const h=lines.length*31+14;if(page.y+h>PAGE_H-100)return false;lines.forEach((t,i)=>ctx.fillText(t,M,page.y+i*31));page.y+=h;return true;
}

function geometryGraphic(page,roomCalc){
  if(page.y+330>PAGE_H-100)return false;
  const ctx=page.ctx, pts=roomCalc.geom.points||[];const x0=M,y0=page.y,w=460,h=280;
  ctx.fillStyle='#f6f8f9';ctx.fillRect(x0,y0,w,h);ctx.strokeStyle='#ccd5dc';ctx.strokeRect(x0,y0,w,h);
  if(pts.length>=3){let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));const sx=(w-70)/Math.max(.1,maxX-minX),sy=(h-70)/Math.max(.1,maxY-minY),s=Math.min(sx,sy);const map=p=>({x:x0+35+(p.x-minX)*s,y:y0+35+(p.y-minY)*s});ctx.beginPath();pts.forEach((p,i)=>{const q=map(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();ctx.fillStyle='rgba(35,160,145,.10)';ctx.fill();ctx.strokeStyle='#16877c';ctx.lineWidth=4;ctx.stroke();pts.forEach((p,i)=>{const q=map(p);ctx.fillStyle='#16877c';ctx.beginPath();ctx.arc(q.x,q.y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1b2630';ctx.font='18px Arial';ctx.fillText(String.fromCharCode(65+i),q.x+9,q.y-8)});}
  ctx.fillStyle='#1b2630';ctx.font='22px Arial';ctx.fillText(`Площадь: ${num(roomCalc.geom.area)} м²`,x0+w+38,y0+46);ctx.fillText(`Периметр: ${num(roomCalc.geom.perimeter)} м`,x0+w+38,y0+84);ctx.fillText(`Углов: ${pts.length}`,x0+w+38,y0+122);ctx.fillText(`Ниш: ${roomCalc.room.geometry?.niches?.length||0}`,x0+w+38,y0+160);ctx.fillText(`Элементов: ${roomCalc.room.features?.length||0}`,x0+w+38,y0+198);
  page.y+=310;return true;
}

function procurementText(line){
  return `${num(line.qty)} ${line.unit||'шт.'}`;
}

function buildSections(project,calc,type){
  const pages=[];let page=newPage(type==='client'?'Смета клиенту':type==='installer'?'Монтажный лист':'Внутренний расчёт',`${project.title||'Объект'} • ${new Date().toLocaleDateString('ru-RU')}`);pages.push(page);
  const ensure=(fn,...args)=>{if(!fn(page,...args)){page=newPage(type==='client'?'Смета клиенту':type==='installer'?'Монтажный лист':'Внутренний расчёт',project.title||'Объект');pages.push(page);fn(page,...args)}};
  ensure(heading,'Объект');ensure(lineBlock,'Клиент',project.client?.name||'—');ensure(lineBlock,'Телефон',project.client?.phone||'—');ensure(lineBlock,'Адрес',project.client?.address||'—');ensure(lineBlock,'Статус',project.status||'—');
  if(project.notes)ensure(paragraph,project.notes);

  for(const rc of calc.rooms){
    ensure(heading,rc.room.name||'Помещение');ensure(geometryGraphic,rc);

    if(type==='installer'){
      const pts=rc.geom.points||[];
      if(pts.length)ensure(paragraph,'Вершины: '+pts.map((p,i)=>`${String.fromCharCode(65+i)}(${num(p.x)}; ${num(p.y)})`).join(', '));
      const diags=rc.room.geometry?.diagonalMeasurements||[];if(diags.length)ensure(paragraph,'Контрольные диагонали: '+diags.map(d=>`${String.fromCharCode(65+d.a)}-${String.fromCharCode(65+d.b)} = ${num(d.length)} м`).join('; '));
      const niches=rc.room.geometry?.niches||[];if(niches.length)ensure(paragraph,'Ниши: '+niches.map((n,i)=>`№${i+1} ${num(n.width)}×${num(n.depth)} м`).join('; '));
      const fs=rc.features||[];if(fs.length)ensure(paragraph,'Элементы: '+fs.map(f=>`${f.label||f.type}${f.diameterMm?` Ø${num(f.diameterMm,0)} мм`:''}${f.length?` ${num(f.length)} м`:''}${f.qty?` ×${f.qty}`:''}${f.wireM?` · провод ${num(f.wireM)} м`:''}`).join('; '));
      if(rc.room.notes)ensure(paragraph,'Заметки: '+rc.room.notes);

      ensure(heading,'Монтаж и закупка');
      if(rc.profile){
        const ps=rc.profileStock||{};
        ensure(lineBlock,'Профиль',`${num(ps.requiredM)} м по замеру → ${num(ps.purchaseM)} м закупка · ${ps.pieces||0} хлыст. по ${num(ps.stickLengthM)} м`);
        if(ps.offcutM)ensure(lineBlock,'Остаток профиля',`${num(ps.offcutM)} м`);
      }
      ensure(lineBlock,'Крепёж по стене',`${rc.fasteners?.qty||0} шт. · шаг ${num((rc.fasteners?.stepM||0)*1000,0)} мм`);
      if(rc.electrical?.points){
        ensure(lineBlock,'Световые точки',`${rc.electrical.points} шт.`);
        ensure(lineBlock,'WAGO / клеммы',`${rc.electrical.wago?.total||0} шт. (${rc.electrical.wago?.pointWago||0} на точки + ${rc.electrical.wago?.inputWago||0} на вход линий)`);
        ensure(lineBlock,'Подвесы',`${num(rc.electrical.suspensions,0)} шт.`);
      }
      if(rc.autoKit?.lines?.length){
        ensure(heading,'Автокомплект LumFer');
        for(const line of rc.autoKit.lines)ensure(lineBlock,line.name,procurementText(line));
      }
      for(const warning of rc.autoKit?.warnings||[])ensure(paragraph,'Внимание: '+warning);
    } else if(type==='client'){
      const roomShare=calc.cost?rc.cost/calc.cost*calc.clientTotal:0;ensure(lineBlock,'Площадь',`${num(rc.geom.area)} м²`);ensure(lineBlock,'Стоимость помещения',money(roomShare),true);
      if(rc.features.length)ensure(paragraph,'Включено: '+rc.features.map(f=>f.label||f.type).join(', '));
    } else {
      ensure(lineBlock,'Полотно',money(rc.membraneCost));ensure(lineBlock,'Профиль',money(rc.profileCost));ensure(lineBlock,'Монтаж',money(rc.laborCost));ensure(lineBlock,'Материалы из прайса',money(rc.materialsCost));ensure(lineBlock,'Автокомплект LumFer',money(rc.autoMaterialsCost));ensure(lineBlock,'Доп. элементы / работа',money(rc.featuresCost));ensure(lineBlock,'Себестоимость помещения',money(rc.cost),true);
      if(rc.profile){const ps=rc.profileStock||{};ensure(lineBlock,'Профиль: закупка',`${num(ps.purchaseM)} м · ${ps.pieces||0} хлыст. · остаток ${num(ps.offcutM)} м`)}
      for(const m of rc.materials)ensure(lineBlock,m.product?.name||'Материал',`${num(m.qty)} × ${money(m.unitCost)} = ${money(m.total)}`);
      for(const line of rc.autoKit?.lines||[])ensure(lineBlock,`AUTO · ${line.name}`,`${num(line.qty)} ${line.unit||''} × ${money(line.unitCost)} = ${money(line.total)}`);
      for(const warning of rc.autoKit?.warnings||[])ensure(paragraph,'Предупреждение расчёта: '+warning);
    }
  }

  ensure(heading,'Итого');
  if(type==='client'){
    ensure(lineBlock,'Общая площадь',`${num(calc.totalArea)} м²`);ensure(lineBlock,'Итого к оплате',money(calc.clientTotal),true);
  } else if(type==='installer'){
    ensure(lineBlock,'Помещений',String(calc.rooms.length));ensure(lineBlock,'Общая площадь',`${num(calc.totalArea)} м²`);ensure(lineBlock,'Общий периметр',`${num(calc.totalPerimeter)} м`);ensure(paragraph,'Документ сформирован из актуального сохранённого замера. Перед раскроем и закупкой сверить контрольные размеры и метраж провода на объекте.');
  } else {
    ensure(lineBlock,'Себестоимость',money(calc.cost));ensure(lineBlock,'Цена клиенту',money(calc.clientTotal));ensure(lineBlock,'Прибыль',money(calc.profit),true);ensure(lineBlock,'Маржа',`${num(calc.margin,1)}%`);ensure(lineBlock,'Курс USD/BYN',num(project.pricing?.usdBynRate,4));ensure(lineBlock,'Обновлено',date(project.updatedAt));
  }
  return pages.map(x=>x.c);
}

async function canvasJpegBytes(canvas){
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('JPEG encode failed')),'image/jpeg',0.88));
  return new Uint8Array(await blob.arrayBuffer());
}
const ascii=s=>new TextEncoder().encode(s);
function concat(parts){const n=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}

async function canvasesToPdf(canvases){
  const jpgs=[];for(const c of canvases)jpgs.push(await canvasJpegBytes(c));
  const objects=[];const kids=[];
  objects[1]=ascii('<< /Type /Catalog /Pages 2 0 R >>');
  let obj=3;
  for(let i=0;i<jpgs.length;i++){const pageObj=obj++,imgObj=obj++,contentObj=obj++;kids.push(`${pageObj} 0 R`);const stream=`q\n${PT_W} 0 0 ${PT_H} 0 0 cm\n/Im0 Do\nQ\n`;objects[pageObj]=ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PT_W} ${PT_H}] /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>`);objects[imgObj]=concat([ascii(`<< /Type /XObject /Subtype /Image /Width ${PAGE_W} /Height ${PAGE_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgs[i].length} >>\nstream\n`),jpgs[i],ascii('\nendstream')]);objects[contentObj]=ascii(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)}
  objects[2]=ascii(`<< /Type /Pages /Count ${jpgs.length} /Kids [${kids.join(' ')}] >>`);
  const parts=[ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offsets=[0];let offset=parts[0].length;
  const count=objects.length-1;
  for(let i=1;i<=count;i++){const chunk=concat([ascii(`${i} 0 obj\n`),objects[i],ascii('\nendobj\n')]);offsets[i]=offset;parts.push(chunk);offset+=chunk.length}
  const xrefOffset=offset;let xref=`xref\n0 ${count+1}\n0000000000 65535 f \n`;for(let i=1;i<=count;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';xref+=`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;parts.push(ascii(xref));return new Blob([concat(parts)],{type:'application/pdf'});
}

export async function makeProjectPdf(project,calc,type='client'){
  const canvases=buildSections(project,calc,type);return canvasesToPdf(canvases);
}

export async function downloadProjectPdf(project,calc,type='client'){
  const blob=await makeProjectPdf(project,calc,type);const names={client:'smeta-klient',installer:'montazhny-list',internal:'vnutrenniy-raschet'};const safe=(project.title||'object').replace(/[^a-zA-Zа-яА-Я0-9_-]+/g,'_').slice(0,40);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safe}-${names[type]||type}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),15000);
}
