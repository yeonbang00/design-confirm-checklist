import {VISUAL_CONTRACT_VERSION,normalizeReferenceStudy} from './studio-visual-contract.mjs';
const KEY='adcheck.studio.reference-studies.'+VISUAL_CONTRACT_VERSION;
export const studyKey=r=>JSON.stringify([r.thumbUrl,r.fullUrl||'',r.axes||{},r.updatedAt||'',r.note||'']);
// Reuse geometric observations of unchanged references. New/retagged references
// get a new key; there is no paid inspection of the whole library on every run.
export async function studyReferences(plans,request,storage){
 let cache={};try{cache=JSON.parse(storage?.getItem(KEY)||'{}')}catch{}
 if(!cache||typeof cache!=='object'||Array.isArray(cache))cache={};
 cache=Object.fromEntries(Object.entries(cache).filter(([,v])=>v&&typeof v==='object'));
 const refs=[...new Map(plans.filter(p=>p.reference).map(p=>[studyKey(p.reference),p.reference])).entries()];
 const missing=refs.filter(([key])=>!cache[key]||cache[key].version!==VISUAL_CONTRACT_VERSION);
 if(missing.length){
   const data=await request('/api/productPhotos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'referenceBriefs',entries:missing.map(([,r])=>({url:r.fullUrl||r.thumbUrl}))})});
   for(const [key,r] of missing){const b=data.briefs?.find(b=>b.url===(r.fullUrl||r.thumbUrl));if(!b)throw Error('레퍼런스 배치 분석이 누락됐습니다.');cache[key]={...normalizeReferenceStudy(b),savedAt:Date.now()};}
   cache=Object.fromEntries(Object.entries(cache).sort((a,b)=>(b[1].savedAt||0)-(a[1].savedAt||0)).slice(0,60));
   try{storage?.setItem(KEY,JSON.stringify(cache))}catch{}
 }
 return plans.map(p=>{
   const b=p.reference?cache[studyKey(p.reference)]:null;
   const quiet=!p.visualTone?.moods?.some(m=>['playful','bold','dramatic'].includes(m));
   if(quiet&&b?.moods?.some(m=>['playful','bold','dramatic'].includes(m)))return {...p,reference:null,designObservation:null};
   return {...p,designObservation:b?normalizeReferenceStudy(b):null};
 });
}
