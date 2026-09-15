import {sourceAllocator} from './studio-source-selection.mjs';
import {foodUse,foodContract} from './studio-food-policy.mjs';
import {primaryOffers} from './studio-visual-contract.mjs';

// Limited source count is normal for food. Reuse a good plated photograph rather
// than invent six foods or treat every detail-page panel as a different shot.
const recipes=[
 ['F01','음식 중심 기본안','photo','full','product','none','A dominant actual food photograph with concise product name, one price and modest CTA in natural negative space.'],
 ['F02','상차림 연출','industry','full','usage','stage','Use the actual plated dish as the hero on a warm dining table with linen and empty tableware. Keep the dish and its contents intact. No additional food or preparation action.'],
 ['F03','음식 접사','photo','full','product','none','Crop into the supplied food photograph to show its actual appetizing texture. Retain the real cut and surface; short copy in quiet negative space. No newly generated food detail.'],
 ['F04','패키지와 음식','template','split','product','none','Pair the exact supplied package with the actual plated food, food dominant and package supporting. Clear product title, no manufactured labels.'],
 ['F05','여백 화보','photo','split','product','none','Large actual dish photograph beside a calm editorial text field. Refined spacing, compact headline, restrained CTA; do not shrink the food into a thumbnail.'],
 ['F06','혜택과 음식','template','bands','benefit','paper','Prominent actual food with one proportionate verified benefit panel and modest CTA. No invented membership or coupon.'],
 ['F07','음식 그래픽 포스터','graphic','poster','product','other','Combine a large actual food photograph with one material or colour field suited to the product mood. Expressive but readable typography; graphic effect stays behind the food, no toy or fake package.'],
 ['F08','상품 정보 카드','template','inset','list','window','Dominant actual food photograph with one concise verified product feature in a small card. No reviews, diagrams, preparation steps or speculative ingredient claims.'],
 ['F09','음식과 질감','graphic','split','product','stage','The actual plated dish against a restrained tactile paper or stone backdrop. Directional light consistent with the food, balanced title and quiet CTA.'],
 ['F10','사진 두 구도','photo','grid','product','none','An unequal editorial pair of the supplied food photos: one dominant plate view and one actual close crop. Reusing the same source at two crop scales is allowed. No implied before/after.']
].map(([id,label,family,frame,type,motif,design])=>({id,label,family,frame,type,motif,design}));
export function createFoodPlan(product,bank,tone,{random=Math.random,recent=[]}={}){
 const served=bank.filter(x=>foodUse(x.p)==='served'),raw=bank.filter(x=>foodUse(x.p)==='raw'),packs=bank.filter(x=>foodUse(x.p)==='package');
 const heroes=served.length?served:raw.length?raw:packs;
 if(!heroes.length)return [];
 const hasDish=served.length>0,hasFood=served.length+raw.length>0;
 const offers=primaryOffers(product).length>0||product.benefitConfirmed===true;
 const facts=(product.facts||[]).filter(f=>f.kind!=='usage'&&!/조리|숙성|해동|굽|구워|절단|슬라이스|제조|유통기한/.test(f.text));
 const pool=recipes.filter(r=>!(['F02','F03','F10'].includes(r.id)&&!hasDish)&&!(r.id==='F04'&&(!hasFood||!packs.length))&&!(r.id==='F06'&&!offers)&&!(r.id==='F08'&&!facts.length)).map(r=>({...r,tie:random()}));
 const selected=[];
 const take=predicate=>{const candidates=pool.filter(r=>!selected.includes(r)&&predicate(r));candidates.sort((a,b)=>{
  const score=r=>r.tie*3-(recent.includes(r.id)?2:0)+(selected.some(x=>x.family===r.family)?0:4);
  return score(b)-score(a);
 });if(candidates[0])selected.push(candidates[0]);};
 take(r=>r.id==='F01');if(hasDish){take(r=>r.id==='F02');take(r=>r.id==='F03');}
 if(hasFood&&packs.length)take(r=>r.id==='F04');
 if(offers)take(r=>r.id==='F06');
 take(r=>r.family==='graphic');
 while(selected.length<6&&selected.length<pool.length)take(()=>true);
 // Raw/package-only products do not unlock cooked scenes to fill the set.
 for(const r of recipes.filter(r=>['F03','F10'].includes(r.id))){
  if(selected.length>=6)break;
  selected.push({...r,label:r.id==='F03'?'상품 확대':'상품 두 구도',design:'Use only the supplied actual product photograph in an editorial composition. Vary crop and scale, keep its photographed state. Never unpack, cook or infer hidden contents.'});
 }
 const allocator=sourceAllocator(bank);
 return selected.slice(0,6).map((r,id)=>{
  const source=allocator.pick(heroes,r.id==='F10'?Math.min(2,heroes.length):1);
  if(r.id==='F04')source.push(...allocator.pick(packs));
  const photoSet=source.map(x=>x.i),fact=r.id==='F08'?facts[0]:null;
  const design=(hasDish?r.design:r.design.replace(/actual plated dish|actual dish|plated dish|actual food|food photograph/g,'actual product'))+(hasFood?'':' This is package-only photography. Keep the sealed package; do not imagine or show unpackaged contents.');
  return {id,recipe:r.id,plannerVersion:'v3.2-food',label:r.label,sceneName:r.label,designId:r.id,designLabel:r.label,designFamily:r.family,
   targetAxes:{frame:r.frame,focus:r.id==='F06'?'number':'product',motif:r.motif,mood:tone.moods[0],palette:tone.palette,person:'none',subject:source.length>1?'multiple':'single',space:'balanced',letter:'gothic',appeal:r.type==='benefit'?'discount':'feature'},
   sourceMode:['F02','F09'].includes(r.id)?'reference':'preserve',method:['F02','F09'].includes(r.id)?'newscene':'original',
   photo:photoSet[0],photoSet,layout:'header',scene:design,artDirection:design,keep:'product',emphasis:r.type==='benefit'?'offer':'product',type:r.type,
   angle:{id:r.type,ko:r.label,how:design},completeBanner:true,fontFamily:'sans',copyMode:id===0?'basic':'creative',visualTone:tone,
   foodPolicy:foodContract(source.map(x=>x.p)),evidenceIds:fact?[fact.id]:[],
   sourceSummary:{role:source[0].p.role,photos:source.map(x=>({index:x.i,role:x.p.role,foodState:x.p.foodState,foodUse:foodUse(x.p),note:x.p.note}))},
   copyBrief:id===0?'상품명과 판매가를 그대로 쓰는 기본안.':`${r.label}. 실제 상품 이름을 알 수 있게 쓰고 사진 설명이나 억지 질문보다 먹고 싶은 이유를 짧게 전달한다. 조리 행동을 묘사하지 않는다. ${r.type==='benefit'?'확인된 일반 구매 혜택만 사용한다.':'가격·수치를 의무적으로 넣지 않는다.'} 후기는 이 안에서는 만들지 않는다. ${fact?.text||''}`,
   coverage:{main:source.some(x=>x.p.role==='main'||x.p.provenance==='main'),detail:source.some(x=>x.p.provenance==='detail'||x.p.sourceRegion),template:r.family==='template',graphic:r.family==='graphic',industry:r.family==='industry'},desc:r.label,render:'layer'};
 });
}
