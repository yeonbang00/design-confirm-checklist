import {advertisingProduct} from './studio-offer-policy.mjs';
import {AXES} from './reference-axes.mjs';
import {visualTone,primaryOffers} from './studio-visual-contract.mjs';
import {sourceBank,sourceAllocator,isWearer,isObject,isFeature} from './studio-source-selection.mjs';
// R01–R30 are recipes, not six mutually exclusive asset-source slots.
const rows=[
 ['R01','전면 화보','photo','full','person','none','product','photo','A dominant real photograph with concise typography in natural negative space; no mandatory header band.'],
 ['R02','비대칭 편집 화보','photo','split','person','none','usage','photo','Asymmetric real-photo panel and contrasting copy field.'],
 ['R03','디테일 확대창','detail','inset','product','window','list','detail','Large actual detail photograph beside the product; explain the corresponding feature with a callout.'],
 ['R04','포즈 연속 화보','photo','grid','person','none','usage','poses','Two different actual wearer photographs with editorial scale contrast and concise typography; preserve both poses and scenes.'],
 ['R05','옵션 컬렉션','template','grid','group','none','list','options','Actual options as a collection; labels from verified option information only.'],
 ['R06','의자 스타일링','industry','full','product','stage','usage','fashion','Place the exact garment on a chair in directional light, with a strong headline and CTA.'],
 ['R07','행거 진열','industry','full','group','stage','list','fashion','Exact supplied garments on hangers, readable silhouettes; no invented colors or set count.'],
 ['R08','모델 착장','industry','full','person','none','usage','body','Use a different actual wearer photograph and its original setting, coherent light and pose; editorial crop, restrained typography.'],
 ['R09','생활 장면','scene','full','scene','none','usage','any','A relevant everyday setting for the exact product; no invented efficacy or included accessories.'],
 ['R10','스튜디오 정물','scene','split','product','stage','product','any','Graphic studio still life with strong title and purposeful contrasting CTA field.'],
 ['R11','실제 제형 그래픽','detail','inset','product','window','list','texture','Actual photographed texture in a large detail panel beside the exact package. No synthetic formula.'],
 ['R12','사용 순서 카드','template','grid','type','paper','list','instructions','Verified usage steps in visual cards with the actual product and clear action strip.'],
 ['R13','원물 테이블','industry','full','product','stage','product','food','Exact food in its original raw/cooked state on a tabletop; no garnish or added food.'],
 ['R14','실제 조리컷','detail','full','product','none','usage','cooked','Use the supplied actual prepared-meal photo, never cook or alter it with AI.'],
 ['R15','구성품 펼치기','template','grid','group','none','list','collection','Show only verified included items as an organized collection with one offer panel.'],
 ['R16','패키지 무대','industry','bands','product','stage','product','any','Exact product packaging on a graphic stage whose material and scale match the brand mood, with concise copy and modest CTA.'],
 ['R17','선물상자 군집','graphic','bands','group','gift','product','any','A single decorative open box with the exact product; material, scale and optional ribbon follow brand mood. Box is scenery, not a gift or included-item claim.'],
 ['R18','나무상자 진열','graphic','bands','group','stage','list','any','Actual products inside a decorative wooden display crate; typography and lighting follow the product mood, without an invented sale.'],
 ['R19','집게로 고르기','graphic','split','product','other','question','any','Playful 3D claw selecting the exact product, large question headline and contrasting CTA. No prize claim.'],
 ['R20','소재 숫자','graphic','bands','number','balloon','numbers','number','One verified quantity, price or benefit as a dimensional material numeral, balanced with prominent actual products. Use fabric/paper/metal or inflation only as appropriate to the brand mood; never repeat the numeral elsewhere.'],
 ['R21','쿠폰·티켓 포스터','template','poster','number','paper','benefit','offer','One verified purchase incentive on a proportionate ticket, actual product remains prominent; shipping alone is not a coupon campaign.'],
 ['R22','대형 타이포','graphic','poster','type','sticker','question','any','An expressive typographic composition whose weight and effect fit the brand mood; retain readable natural Hangul proportions.'],
 ['R23','스포트라이트','graphic','full','product','spotlight','product','any','Dramatic spotlight and stage, bold high contrast product headline with CTA.'],
 ['R24','원형 후광 컬렉션','graphic','bands','group','moon','benefit','offer','One simple circular field frames actual products; purchase incentive and modest CTA. No repeated rings or certification seals.'],
 ['R25','시즌 그래픽','graphic','poster','product','other','product','any','A material or abstract graphic treatment matched to the product mood, with one purposeful dimensional object; no invented seasonal sale.'],
 ['R26','사진 틀','photo','inset','scene','window','usage','photo','Actual photograph inside one simple editorial frame with proportionate title and CTA; preserve photograph dominance and natural whitespace.'],
 ['R27','서비스 상징','graphic','split','symbol','other','product','service','Generic 3D service symbols and verified service features, with clear CTA.'],
 ['R28','메시지 은유','graphic','split','symbol','other','question','service','Visual metaphor for the verified service; no invented benefit or promise.'],
 ['R29','안내 캐릭터','graphic','split','symbol','other','list','service','Original generic guide character and signboards carrying verified information, not an existing brand mascot.'],
 ['R30','질문·답변 카드','template','poster','type','paper','question','facts','One relevant question and concise verified answer with actual product and CTA.']
];
export const V3_RECIPES=rows.map(([id,label,family,frame,focus,motif,type,requires,design])=>({id,label,family,targetAxes:{frame,focus,motif},type,requires,design}));
export function createV3Plan(product,{random=Math.random,recent=[]}={}){
 product=advertisingProduct(product);
 const bank=sourceBank(product);if(!bank.length)return [];
 const fashion=/^fashion/.test(product.category),tone=visualTone(product.visualTone,product.tone);
 const wearers=bank.filter(x=>isWearer(x.p)),objects=bank.filter(x=>isObject(x.p)),features=bank.filter(x=>isFeature(x.p));
 const photos=bank.filter(x=>!isFeature(x.p)),photoPool=photos.length?photos:bank;
 const lifestyle=photoPool.filter(x=>!x.p.plainBg),texture=features.filter(x=>x.p.assetKind==='texture');
 const main=photoPool.find(x=>x.p.provenance==='main'||x.p.role==='main')||photoPool[0];
 const facts=(product.facts||[]).filter(f=>!/(개봉|사용기한|유통기한|제조일|제조사|용기 디자인|리뉴얼)/.test(f.text)&&!(f.kind==='clinical'&&!f.source));
 const offer=primaryOffers(product).length>0||product.benefitConfirmed===true;
 const variants=pool=>new Set(pool.map(x=>x.p.colorway).filter(Boolean)).size;
 const options=variants(objects)>1?objects:wearers;
 const cooked=bank.filter(x=>x.p.foodState==='cooked'&&x.p.actualPreparedMeal===true);
 const requirements={any:true,photo:lifestyle.length>0,detail:features.length>0,texture:product.category==='beauty'&&texture.length>0,
  poses:wearers.length>1,options:fashion&&variants(options)>1,collection:bank.some(x=>x.p.itemCount>1),fashion:fashion&&objects.length>0,
  body:wearers.length>0,food:product.category==='food'&&objects.length>0,cooked:cooked.length>0,
  instructions:facts.some(f=>f.kind==='usage'),number:!!(product.quantity||product.salePrice||offer),offer,facts:facts.length>0,service:product.category==='service'};
 const objectRecipes=new Set(['R06','R07','R10','R13','R16','R17','R18','R19','R23']);
 const candidates=V3_RECIPES.filter(r=>requirements[r.requires]&&(!objectRecipes.has(r.id)||objects.length)&&
   (!['R19','R23'].includes(r.id)||tone.energy==='expressive')).map(r=>({...r,tie:random()}));
 const chosen=[];
 function score(r){return r.tie*7+(chosen.some(x=>x.type===r.type)?0:5)+(chosen.some(x=>x.family===r.family)?0:5)-(recent.includes(r.id)?8:0)-chosen.filter(x=>x.targetAxes.motif===r.targetAxes.motif).length*2;}
 function take(predicate){const pool=candidates.filter(r=>!chosen.includes(r)&&predicate(r));pool.sort((a,b)=>score(b)-score(a));if(pool[0])chosen.push(pool[0]);}
 // Always one factual baseline. Rich fashion pages earn actual pose/colour slots,
 // not only optional recipes that might never get sampled.
 take(r=>lifestyle.length?['R01','R02'].includes(r.id):['R05','R15','R16','R22'].includes(r.id));
 if(fashion&&wearers.length>1)take(r=>r.id==='R04');
 if(product.category==='beauty'&&texture.length)take(r=>r.id==='R11');
 else if(fashion&&variants(options)>1)take(r=>r.id==='R05');
 else if(features.length)take(r=>r.id==='R03');
 if(offer)take(r=>r.requires==='offer');
 if(!chosen.some(r=>r.family==='graphic'))take(r=>r.family==='graphic');
 if(!chosen.some(r=>r.family==='template'))take(r=>r.family==='template');
 if(chosen.length<6&&!chosen.some(r=>['detail','industry'].includes(r.family)))take(r=>r.family==='industry');
 while(chosen.length<6&&candidates.length>chosen.length)take(()=>true);
 const allocator=sourceAllocator(bank);
 return chosen.slice(0,6).map((r,id)=>{
  let selected;
  if(r.id==='R11'||r.id==='R03')selected=[...allocator.pick(objects.length?objects:photoPool),...allocator.pick(r.id==='R11'?texture:features)];
  else if(r.id==='R04')selected=allocator.pick(wearers,2);
  else if(r.id==='R05')selected=allocator.pick(options,3,{distinctColors:true});
  else if(r.id==='R07')selected=allocator.pick(objects,3,{distinctColors:true});
  else if(r.id==='R15')selected=allocator.pick(bank.filter(x=>x.p.itemCount>1));
  else if(r.id==='R14')selected=allocator.pick(cooked);
  else if(r.id==='R08')selected=allocator.pick(wearers);
  else if(objectRecipes.has(r.id))selected=allocator.pick(objects);
  else if(r.family==='photo')selected=allocator.pick(id===0?[lifestyle.includes(main)?main:lifestyle[0]]:lifestyle);
  else selected=allocator.pick(photoPool);
  const photoSet=selected.map(x=>x.i),photo=photoSet[0];
  const original=r.family==='photo'||r.family==='detail'||r.id==='R05'||r.id==='R08'||id===0;
  const detail=r.family==='detail',primary=detail?facts.find(f=>/제형|텍스처|소재|골지|원단|리브/.test(f.text)):facts[id%Math.max(1,facts.length)];
  const type=id===0?'product':r.type;
  const targetAxes={...r.targetAxes,mood:tone.moods[0],palette:tone.palette,
   person:selected.every(x=>!isWearer(x.p))?'none':selected.length>1?'many':'one',
   subject:selected.length>1?'multiple':isWearer(selected[0].p)?'inuse':'single',
   space:tone.energy==='expressive'?'balanced':'airy',letter:'gothic',
   appeal:type==='benefit'?'discount':type==='numbers'?'price':detail?'material':type==='usage'?'ease':'feature'};
  const plan={id,recipe:r.id,plannerVersion:'v3.1',label:r.label,sceneName:r.label,designId:r.id,designLabel:r.label,designFamily:r.family,targetAxes,
   sourceMode:original?'preserve':'reference',method:original?'original':'newscene',photo,photoSet,
   layout:detail?'duo-panel':'header',scene:r.design,keep:selected.some(x=>isWearer(x.p))?'person':'product',
   emphasis:type==='benefit'||type==='numbers'?'offer':'product',type,angle:{id:type,ko:r.label,how:r.design},completeBanner:true,fontFamily:'sans',
   copyMode:id===0?'basic':'creative',visualTone:tone,evidenceIds:primary?[primary.id]:[],
   sourceSummary:{role:selected[0].p.role,colorway:selected[0].p.colorway||'',colors:selected.map(x=>x.p.colorway||''),
    photos:selected.map(x=>({index:x.i,role:x.p.role,color:x.p.colorway,pose:x.p.pose,angle:x.p.shotAngle,distance:x.p.shotDistance,light:x.p.light,note:x.p.note}))},
   copyBrief:id===0?'상품명과 판매가를 그대로 전달하는 기본안. 추상적인 슬로건으로 바꾸지 않는다.':`${r.label}. ${type==='benefit'?'확인된 일반 할인·쿠폰·증정 중 하나를 사용. 무료배송은 보조 문구만.':'상품이 무엇인지 드러내는 자연스러운 제목과 실제 구매 이유.'} 사진과 무드에 맞으면 같은 상품명·CTA를 써도 좋다. 억지 질문이나 소재 수치 나열은 금지. 추천 근거: ${primary?.text||'상품명과 구성'}`,
   coverage:{main:photoSet.includes(main.i),detail:selected.some(x=>x.p.provenance==='detail'||x.p.sourceRegion),template:r.family==='template',graphic:r.family==='graphic',industry:detail||r.family==='industry'},desc:r.label,render:'layer'};
  plan.artDirection=r.design;return plan;
 });
}
export function matchPlanReferences(plans,refs,product){
 const used=new Set();
 return plans.map(p=>{
  const tone=visualTone(p.visualTone),quiet=!tone.moods.some(x=>['playful','bold','dramatic'].includes(x));
  const pool=refs.filter(r=>r.thumbUrl&&(!quiet||!['playful','bold','dramatic'].includes(r.axes?.mood))&&
   !(p.targetAxes.person==='none'&&['one','many','character'].includes(r.axes?.person))&&
   !(p.targetAxes.person!=='none'&&r.axes?.person==='character'));
  const ranked=pool.map(r=>({r,score:Object.entries(p.targetAxes||{}).reduce((s,[k,v])=>s+(r.axes?.[k]===v?(AXES[k]?.weight||1):0),0)
   +(tone.moods.includes(r.axes?.mood)?12:0)+(r.type===p.type?4:0)+(String(r.brandName||r.brand||'').normalize('NFC').toLowerCase()===String(product.brand||'').normalize('NFC').toLowerCase()?2:0)-(used.has(r.thumbUrl)?10:0)})).sort((a,b)=>b.score-a.score);
  const hit=ranked[0];if(hit)used.add(hit.r.thumbUrl);
  return {...p,reference:hit?{...hit.r,matchScore:hit.score}:null};
 });
}
