import {usableFoodSource} from './studio-food-policy.mjs';
// Source identity includes crop coordinates; two crops from one detail page are
// distinct assets, but the same crop under another URL must not earn diversity.
export function sourceKey(p){return JSON.stringify([String(p.sourceUrl||p.url||'').split('?')[0],p.tilePixels||null,p.sourceRegion||null]);}
export const isWearer=p=>p.personKind==='body'||p.role==='model';
export const isObject=p=>p.personKind==='none'&&p.assetKind!=='texture'&&p.assetKind!=='info'&&p.role!=='unusable'&&!((p.assetKind==='detail'||p.role==='detail')&&p.shotDistance==='close');
export const isFeature=p=>p.assetKind==='texture'||(!isWearer(p)&&(p.assetKind==='detail'||p.role==='detail')&&p.shotDistance==='close');
export function sourceBank(product){
 const seen=new Set();
 return (product.photos||[]).map((p,i)=>({p,i})).filter(({p})=>{
   const key=sourceKey(p);
   if(seen.has(key)||p.matchesTarget!==true||p.role==='unusable'||p.isGift||p.assetKind==='info'||(!p.sourceRegion&&p.role==='detail'&&p.w&&p.h&&p.h/p.w>1.85)||product.category==='food'&&!usableFoodSource(p))return false;
   seen.add(key);return true;
 });
}
export function sourceAllocator(bank){
 const usage=new Map(),colors=new Map(),poses=new Map();
 const pose=p=>[p.pose||'',p.shotAngle||'',p.shotDistance||''].join('|');
 function pick(pool,count=1,{distinctColors=false}={}){
   const selected=[],localColors=new Set();
   for(let n=0;n<count;n++){
     const eligible=pool.filter(x=>!selected.includes(x)&&(!distinctColors||!localColors.has(x.p.colorway)));
     const score=x=>(usage.get(sourceKey(x.p))||0)*100+(colors.get(x.p.colorway)||0)*6+(poses.get(pose(x.p))||0)*3+(x.p.burnedText?12:0);
     eligible.sort((a,b)=>score(a)-score(b));
     const x=eligible[0];if(!x)break;
     selected.push(x);localColors.add(x.p.colorway);usage.set(sourceKey(x.p),(usage.get(sourceKey(x.p))||0)+1);colors.set(x.p.colorway,(colors.get(x.p.colorway)||0)+1);poses.set(pose(x.p),(poses.get(pose(x.p))||0)+1);
   }
   return selected;
 }
 return {pick,usage};
}
