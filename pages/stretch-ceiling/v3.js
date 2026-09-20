const base=new URL('.',import.meta.url);
const parts=['v3.part01.txt','v3.part02.txt','v3.part03.txt','v3.part04.txt'];
let source=(await Promise.all(parts.map(async p=>{
  const r=await fetch(new URL(p,base),{cache:'no-cache'});
  if(!r.ok) throw new Error(`V3 chunk ${p}: ${r.status}`);
  return r.text();
}))).join('\n');
source=source.replace(/from\s+(['"])\.\/([^'"]+)\1/g,(_,q,p)=>`from ${q}${new URL(p,base).href}${q}`);
const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
try{await import(url)}finally{URL.revokeObjectURL(url)}
