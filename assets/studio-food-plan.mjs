import {angleById} from './studio-angles.mjs';
import {sourceKey} from './studio-source-selection.mjs';
import {foodUse,foodContract,primaryFoodSource,primaryMainFood,hasFoodPackage,foodVisualRole} from './studio-food-policy.mjs';
import {primaryOffers} from './studio-visual-contract.mjs';

// Strategy answers WHY to click. Presentation answers HOW to show it. Neither
// occupies a fixed slot; eligibility depends on actual sources and evidence.
const visuals=[
 ['hero','음식 전면','photo','full','none','A dominant actual product photograph with typography in natural negative space.'],
 ['table','상차림','industry','full','stage','Keep the actual plated food dominant in an inviting dining setting. Use a few quiet accompanying foods only as peripheral serving suggestions, separate from the advertised food.'],
 ['close','음식 접사','photo','full','none','A close crop of the actual appetizing food surface; preserve its cut, texture and original garnish.'],
 ['package','포장과 음식','template','split','none','Pair the exact supplied package with dominant actual food. Never invent a new pack.'],
 ['margin','여백 화보','photo','split','none','A large actual product photograph alongside an airy editorial copy field.'],
 ['card','정보 카드','template','inset','window','A dominant real product photograph with one proportionate concise text card, not a product-information screenshot.'],
 ['graphic','그래픽 포스터','graphic','poster','other','Large actual product with one purposeful colour/material field and expressive readable typography appropriate to the brand mood.'],
 ['texture','질감 배경','graphic','split','stage','Actual product against a restrained paper or stone surface; coherent light and restrained typography.'],
 ['pair','두 구도','photo','grid','none','One large actual food view with a smaller real close crop; no before/after implication.'],
 ['type','타이포 강조','graphic','poster','paper','One clear headline or verified figure with prominent actual product; a proportionate graphic accent, never repeated prices or oversized shipping coupons.']
].map(([id,label,family,frame,motif,design])=>({id,label,family,frame,motif,design}));
const usableFact=f=>f?.id&&f.source&&String(f.text||'').trim().length>=4;
export function foodStrategies(product,bank){
 const facts=(product.facts||[]).filter(usableFact),served=bank.some(x=>primaryFoodSource(x.p)&&foodUse(x.p)==='served'),packs=bank.some(x=>hasFoodPackage(x.p));
 const feature=facts.filter(f=>!['review','authority','comparison','beforeafter','usage'].includes(f.kind)&&!/제조일|유통기한|보관|해동|조리법/.test(f.text));
 const out=[];
 const add=(id,label,type,brief,evidence=[])=>out.push({id,label,type,brief,evidence});
 add('basic','상품명·가격','product','상품명과 판매가를 그대로 전달한다.');
 add('product','상품 매력','product','실제 상품 이름과 사진에 보이는 매력을 간결하게 전달한다. 맛·성분·효능을 추측하지 않는다.');
 if(served)add('meal','식사 제안','usage','이 상품을 중심으로 즐기는 식사 상황을 제안한다. 인분·건강효과·조리시간을 만들지 않는다.');
 if(packs)add('pack','포장·구성','list','실제 포장이나 확인된 구성을 소개한다. 포장만 보고 보존성·간편조리를 추론하지 않는다.');
 if(Number(product.salePrice)>0||Number(product.quantity)>0)add('value','가격·구성','numbers','확인된 가격 또는 구성 하나를 중심으로 구매 이유를 전달한다. 할인으로 바꾸지 않는다.');
 if(feature.length)add('feature','상품 특징','product','확인된 상품 특징 하나로 구매 이유를 설명한다.',feature);
 if(primaryOffers(product).length||product.benefitConfirmed)add('benefit','구매 혜택','benefit','확인된 일반 구매 혜택을 조건과 함께 전달한다. 카드할인과 배송 중심 대형 강조는 제외.');
 for(const [kind,id,label,type,brief] of [
  ['review','review','구매 후기','testimonial','선택한 실제 후기 원문을 그대로 인용한다. 새로운 후기나 화자를 만들지 않는다.'],
  ['authority','trust','품질 근거','authority','선택한 인증·수상 등 근거를 정확히 소개한다. 브랜드 이름만으로 인증을 만들지 않는다.'],
  ['comparison','compare','차이 비교','comparison','명시된 비교 근거만 설명한다. 서로 다른 사진이라는 이유로 우열·전후를 주장하지 않는다.']]){
  const evidence=facts.filter(f=>f.kind===kind&&(kind!=='review'||f.text.length<=100));
  if(evidence.length)add(id,label,type,brief,evidence);
 }
 const gifts=feature.filter(f=>/선물|gift/i.test(f.text));
 if(packs&&gifts.length)add('gift','선물 제안','usage','실제 제공되는 선물 포장과 확인된 상품 정보를 바탕으로 선물 상황을 제안한다.',gifts);
 return out;
}
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(36);};
export function createFoodPlan(product,bank,tone,{random=Math.random,recent=[],references=[]}={}){
 const served=bank.filter(x=>primaryFoodSource(x.p)&&foodUse(x.p)==='served'),raw=bank.filter(x=>primaryFoodSource(x.p)&&foodUse(x.p)==='raw'),packs=bank.filter(x=>hasFoodPackage(x.p));
 const heroes=served.length?served:raw.length?raw:packs.filter(x=>foodVisualRole(x.p)==='package');if(!heroes.length)return [];
 const strategies=foodStrategies(product,bank),hasDish=served.length>0,hasFood=served.length+raw.length>0;
 const presentations=visuals.filter(v=>!(['table','close','pair'].includes(v.id)&&!hasDish)&&!(v.id==='package'&&(!hasFood||!packs.length)));
 const candidates=strategies.flatMap(s=>presentations.filter(v=>!(s.id==='basic'&&v.id==='type')).map(v=>({s,v,tie:random()})));
 const chosen=[],sourceUses=new Map(),strategyPriority=new Map(strategies.map(s=>[s.id,random()*4]));
 const count=(key,value)=>chosen.filter(x=>x[key]===value).length;
 for(let id=0;id<6;id++){
  const ranked=candidates.filter(c=>!chosen.some(p=>p.strategyId===c.s.id&&p.presentationId===c.v.id)).map(c=>{
   const {s,v}=c;
   const rankedSources=[...heroes].sort((a,b)=>{
    const score=x=>(sourceUses.get(sourceKey(x.p))||0)*2-(primaryMainFood(x.p)?5:0)+(v.id==='close'&&x.p.shotDistance!=='close'?0.5:0);
    return score(a)-score(b);
   });
   const selected=rankedSources.slice(0,v.id==='pair'?Math.min(2,heroes.length):1);
   const requiresPackage=v.id==='package'||s.id==='pack'||s.id==='gift';
   if(requiresPackage){
    const pack=packs.find(x=>foodUse(x.p)==='package')||packs[0];
    if(pack&&!selected.some(x=>sourceKey(x.p)===sourceKey(pack.p)))selected.push(pack);
   }
   const key=`food/${s.id}/${v.id}`,sourceToken=hash(selected.map(x=>sourceKey(x.p)).join('|'));
   const combinationKey=`combo/${key}/${sourceToken}`;
   const refFit=references.some(r=>r.axes?.frame===v.frame&&r.type===s.type)?1.5:0;
   const score=c.tie*4+strategyPriority.get(s.id)-count('strategyId',s.id)*3-count('presentationId',v.id)*4-count('designFamily',v.family)*1.2
    -(recent.includes(key)?4:0)-(recent.includes(combinationKey)?4:0)+refFit;
   return {...c,selected,key,combinationKey,requiresPackage,score};
  }).filter(c=>count('presentationId',c.v.id)<2&&count('strategyId',c.s.id)<(c.s.id==='basic'?1:Math.max(2,Math.ceil(5/Math.max(1,strategies.length-1)))));
  ranked.sort((a,b)=>b.score-a.score);const hit=ranked[0];if(!hit)break;
  const {s,v,selected,key,combinationKey,requiresPackage}=hit;
  const primary=s.evidence.length?s.evidence[Math.floor(random()*s.evidence.length)]:null;
  const photoSet=selected.map(x=>x.i),scene=v.design+(!hasFood?' This is package-only photography: keep the sealed product; do not imagine unpackaged contents.':'');
  selected.forEach(x=>sourceUses.set(sourceKey(x.p),(sourceUses.get(sourceKey(x.p))||0)+1));
  const label=s.label+' · '+v.label;
  chosen.push({id,recipe:key,plannerVersion:'v3.4-source-roles',strategyId:s.id,presentationId:v.id,combinationKey,
   label,sceneName:label,designId:key,designLabel:label,designFamily:v.family,
   targetAxes:{frame:v.frame,focus:s.type==='numbers'||s.type==='benefit'?'number':'product',motif:v.motif,mood:tone.moods[0],palette:tone.palette,person:'none',subject:selected.length>1?'multiple':'single',space:'balanced',letter:'gothic',appeal:s.type==='benefit'?'discount':s.type==='testimonial'?'popular':s.type==='numbers'?'price':'feature'},
   sourceMode:['table','texture'].includes(v.id)?'reference':'preserve',method:['table','texture'].includes(v.id)?'newscene':'original',photo:photoSet[0],photoSet,layout:'header',scene,artDirection:scene,keep:'product',
   emphasis:['numbers','benefit'].includes(s.type)?'offer':'product',type:s.type,angle:{...angleById(s.type),how:s.brief},completeBanner:true,fontFamily:'sans',copyMode:s.id==='basic'?'basic':'creative',visualTone:tone,
   foodPolicy:foodContract(selected.map(x=>x.p),{allowAccompaniments:v.id==='table',requiresPackage}),evidenceIds:primary?[primary.id]:[],
   sourceSummary:{role:selected[0].p.role,photos:selected.map(x=>({index:x.i,role:x.p.role,foodState:x.p.foodState,foodUse:foodUse(x.p),foodVisualRole:foodVisualRole(x.p),note:x.p.note}))},
   copyBrief:`${s.brief} 표현은 ${v.label}. 상품 종류를 명확히 드러낸다. 조리 과정을 묘사하지 않는다. 연출용 곁들임은 판매 구성·함유재료로 말하지 않는다. ${primary?.text||''}`,
   coverage:{main:selected.some(x=>x.p.role==='main'||x.p.provenance==='main'),detail:selected.some(x=>x.p.provenance==='detail'||x.p.sourceRegion),template:v.family==='template',graphic:v.family==='graphic',industry:v.family==='industry'},desc:label,render:'layer'});
 }
 return chosen;
}
