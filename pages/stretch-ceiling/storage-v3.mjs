const DB_NAME='stretch-ceiling-v3';
const DB_VERSION=1;
const PROJECTS='projects';
const MEDIA='media';

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in globalThis)) return reject(new Error('IndexedDB unavailable'));
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(PROJECTS)){
        const s=db.createObjectStore(PROJECTS,{keyPath:'id'});
        s.createIndex('updatedAt','updatedAt');
        s.createIndex('status','status');
      }
      if(!db.objectStoreNames.contains(MEDIA)){
        const m=db.createObjectStore(MEDIA,{keyPath:'id'});
        m.createIndex('projectId','projectId');
        m.createIndex('roomId','roomId');
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function tx(store,mode,fn){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(store,mode); const s=t.objectStore(store);
    let result;
    try{result=fn(s,t);}catch(e){db.close();reject(e);return;}
    t.oncomplete=()=>{db.close();resolve(result)};
    t.onerror=()=>{db.close();reject(t.error)};
    t.onabort=()=>{db.close();reject(t.error||new Error('transaction aborted'))};
  });
}

function fallbackRead(){
  try{return JSON.parse(localStorage.getItem('stretch-ceiling-v3-projects')||'[]')}catch{return []}
}
function fallbackWrite(items){localStorage.setItem('stretch-ceiling-v3-projects',JSON.stringify(items))}

export async function saveProject(project){
  const clean=structuredClone(project);
  try{await tx(PROJECTS,'readwrite',s=>s.put(clean));}
  catch{const a=fallbackRead().filter(x=>x.id!==clean.id);a.push(clean);fallbackWrite(a)}
  return clean;
}

export async function getProject(id){
  try{
    const db=await openDb();
    return await new Promise((resolve,reject)=>{const t=db.transaction(PROJECTS,'readonly'),r=t.objectStore(PROJECTS).get(id);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}});
  }catch{return fallbackRead().find(x=>x.id===id)||null}
}

export async function listProjects(){
  try{
    const db=await openDb();
    const rows=await new Promise((resolve,reject)=>{const t=db.transaction(PROJECTS,'readonly'),r=t.objectStore(PROJECTS).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);t.oncomplete=()=>db.close()});
    return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }catch{return fallbackRead().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
}

export async function deleteProject(id){
  try{
    const db=await openDb();
    await new Promise((resolve,reject)=>{const t=db.transaction([PROJECTS,MEDIA],'readwrite');t.objectStore(PROJECTS).delete(id);const idx=t.objectStore(MEDIA).index('projectId'),r=idx.openCursor(IDBKeyRange.only(id));r.onsuccess=()=>{const c=r.result;if(c){c.delete();c.continue()}};t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>{db.close();reject(t.error)}});
  }catch{fallbackWrite(fallbackRead().filter(x=>x.id!==id))}
}

export async function savePhoto(projectId,roomId,file){
  const id=`photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  const rec={id,projectId,roomId,name:file.name||'photo.jpg',type:file.type||'image/jpeg',size:file.size||0,createdAt:new Date().toISOString(),blob:file};
  await tx(MEDIA,'readwrite',s=>s.put(rec));
  return {id,name:rec.name,type:rec.type,size:rec.size,createdAt:rec.createdAt};
}

export async function getPhotoBlob(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{const t=db.transaction(MEDIA,'readonly'),r=t.objectStore(MEDIA).get(id);r.onsuccess=()=>{db.close();resolve(r.result?.blob||null)};r.onerror=()=>{db.close();reject(r.error)}});
}

export async function deletePhoto(id){
  try{await tx(MEDIA,'readwrite',s=>s.delete(id))}catch{}
}

export async function exportAll(){
  const projects=await listProjects();
  return {schema:'stretch-ceiling-v3',exportedAt:new Date().toISOString(),projects};
}

export async function importAll(payload){
  if(!payload || payload.schema!=='stretch-ceiling-v3' || !Array.isArray(payload.projects)) throw new Error('Неверный формат резервной копии');
  for(const p of payload.projects) if(p?.id) await saveProject(p);
  return payload.projects.length;
}
