// R01–R30 are recipes, not six mutually exclusive asset-source slots.
const rows=[
 ['R01','전면 화보','photo','full','person','none','product','photo','A dominant real photograph with a large headline in a separate top band.'],
 ['R02','비대칭 편집 화보','photo','split','person','none','usage','photo','Asymmetric real-photo panel and contrasting copy field.'],
 ['R03','디테일 확대창','detail','inset','product','window','list','detail','Large actual detail photograph beside the product; explain the corresponding feature with a callout.'],
 ['R04','포즈 연속 화보','photo','grid','person','none','usage','poses','Two actual wearer photographs with unequal scale, short strong headline and CTA band.'],
 ['R05','옵션 컬렉션','template','grid','group','none','list','options','Actual options as a collection; labels from verified option information only.'],
 ['R06','의자 스타일링','industry','full','product','stage','usage','fashion','Place the exact garment on a chair in directional light, with a strong headline and CTA.'],
 ['R07','행거 진열','industry','full','group','stage','list','fashion','Exact supplied garments on hangers, readable silhouettes; no invented colors or set count.'],
 ['R08','모델 착장','industry','full','person','none','usage','body','Preserve the supplied wearer and exact garment in a new fashion setting.'],
 ['R09','생활 장면','scene','full','scene','none','usage','any','A relevant everyday setting for the exact product; no invented efficacy or included accessories.'],
 ['R10','스튜디오 정물','scene','split','product','stage','product','any','Graphic studio still life with strong title and purposeful contrasting CTA field.'],
 ['R11','실제 제형 그래픽','detail','inset','product','window','list','texture','Actual photographed texture in a large detail panel beside the exact package. No synthetic formula.'],
 ['R12','사용 순서 카드','template','grid','type','paper','list','instructions','Verified usage steps in visual cards with the actual product and clear action strip.'],
 ['R13','원물 테이블','industry','full','product','stage','product','food','Exact food in its original raw/cooked state on a tabletop; no garnish or added food.'],
 ['R14','실제 조리컷','detail','full','product','none','usage','cooked','Use the supplied actual prepared-meal photo, never cook or alter it with AI.'],
 ['R15','구성품 펼치기','template','grid','group','none','list','collection','Show only verified included items as an organized collection with one offer panel.'],
 ['R16','패키지 무대','industry','bands','product','stage','product','any','Exact product packaging on a bold graphic stage, with benefit panel and CTA.'],
 ['R17','선물상자 군집','graphic','bands','group','gift','product','any','Oversized open decorative giftbox, ribbon and exact product; box is scenery, not a gift claim.'],
 ['R18','나무상자 진열','graphic','bands','group','stage','list','any','Actual products inside a decorative wooden display crate, bold promotion-board typography.'],
 ['R19','집게로 고르기','graphic','split','product','other','question','any','Playful 3D claw selecting the exact product, large question headline and contrasting CTA. No prize claim.'],
 ['R20','소재 숫자','graphic','bands','number','balloon','numbers','number','One verified quantity, price or benefit as a giant inflated/material numeral, products below; never repeat the numeral elsewhere.'],
 ['R21','쿠폰·티켓 포스터','template','poster','number','paper','benefit','offer','One verified offer on an oversized graphic ticket, actual product and terms with an obvious CTA.'],
 ['R22','대형 타이포','graphic','poster','type','sticker','question','any','Oversized condensed Gothic headline, outlined keyword, exact product and a bright CTA strip.'],
 ['R23','스포트라이트','graphic','full','product','spotlight','product','any','Dramatic spotlight and stage, bold high contrast product headline with CTA.'],
 ['R24','원형 후광 컬렉션','graphic','bands','group','moon','benefit','offer','Circular halo frames exact product, verified benefit badge, strong lower CTA band.'],
 ['R25','시즌 그래픽','graphic','poster','product','other','product','any','Playful abstract graphic frame with 3D decorative shapes, two-tone Gothic headline and CTA; no invented seasonal sale.'],
 ['R26','사진 틀','photo','inset','scene','window','usage','photo','Actual photograph inside an expressive window shape with clear large title and CTA outside it.'],
 ['R27','서비스 상징','graphic','split','symbol','other','product','service','Generic 3D service symbols and verified service features, with clear CTA.'],
 ['R28','메시지 은유','graphic','split','symbol','other','question','service','Visual metaphor for the verified service; no invented benefit or promise.'],
 ['R29','안내 캐릭터','graphic','split','symbol','other','list','service','Original generic guide character and signboards carrying verified information, not an existing brand mascot.'],
 ['R30','질문·답변 카드','template','poster','type','paper','question','facts','One relevant question and concise verified answer with actual product and CTA.']
];
export const V3_RECIPES=rows.map(([id,label,family,frame,focus,motif,type,requires,design])=>({id,label,family,targetAxes:{frame,focus,motif},type,requires,design}));
const usable=p=>p.matchesTarget===true&&p.role!=='unusable'&&!p.isGift&&p.assetKind!=='info'&&(p.sourceRegion||!(p.w&&p.h&&p.h/p.w>1.7));
export function createV3Plan(product,{random=Math.random,recent=[]}={}){
 const photos=product.photos||[],bank=photos.map((p,i)=>({p,i})).filter(x=>usable(x.p));
 if(!bank.length)return [];
 const main=bank.find(x=>x.p.provenance==='main'||x.p.role==='main')||bank.find(x=>x.p.assetKind!=='texture')||bank[0];
 const detail=bank.find(x=>x.i!==main.i&&x.p.assetKind==='texture')||bank.find(x=>x.i!==main.i&&(x.p.sourceRegion||x.p.provenance==='detail'||x.p.role==='detail'));
 const facts=(product.facts||[]).filter(f=>!/(개봉|사용기한|유통기한|제조일|제조사|용기 디자인|리뉴얼)/.test(f.text)&&!(f.kind==='clinical'&&!f.source)),offer=product.offers?.some(o=>o.verified)||product.benefitConfirmed;
 const requirements={any:true,photo:!main.p.plainBg,detail:!!detail,texture:product.category==='beauty'&&bank.some(x=>x.p.assetKind==='texture'),multi:bank.length>1,poses:bank.filter(x=>x.p.personKind==='body').length>1,options:/^fashion/.test(product.category)&&new Set(bank.map(x=>x.p.colorway).filter(Boolean)).size>1,collection:bank.some(x=>x.p.itemCount>1),fashion:/^fashion/.test(product.category),body:bank.some(x=>x.p.personKind==='body'),food:product.category==='food',cooked:bank.some(x=>x.p.foodState==='cooked'&&x.p.actualPreparedMeal===true),instructions:facts.some(f=>f.kind==='usage'),number:!!(product.quantity||product.salePrice||offer),offer:!!offer,facts:facts.length>0,service:product.category==='service'};
 const candidates=V3_RECIPES.filter(r=>requirements[r.requires]).map(r=>({...r,tie:random()}));
 const chosen=[];
 function take(predicate){const pool=candidates.filter(r=>!chosen.includes(r)&&predicate(r));pool.sort((a,b)=>score(b)-score(a));if(pool[0])chosen.push(pool[0]);}
 function score(r){return r.tie*7+(chosen.some(x=>x.type===r.type)?0:7)+(chosen.some(x=>x.family===r.family)?0:6)-(recent.includes(r.id)?10:0)-chosen.filter(x=>x.targetAxes.motif===r.targetAxes.motif).length*3;}
 // Source use and design method overlap: a main packshot can satisfy the template goal.
 take(r=>main.p.plainBg?r.family==='template'||r.id==='R16':r.id==='R01'||r.id==='R02');
 if(detail)take(r=>r.id===(product.category==='beauty'&&detail.p.assetKind==='texture'?'R11':'R03'));
 if(offer)take(r=>r.requires==='offer');
 if(!chosen.some(r=>r.family==='graphic'))take(r=>r.family==='graphic');
 if(!chosen.some(r=>r.family==='template'))take(r=>r.family==='template');
 if(!chosen.some(r=>r.family==='detail'||r.family==='industry'))take(r=>r.family==='industry');
 while(chosen.length<6&&candidates.length>chosen.length)take(()=>true);
 return chosen.slice(0,6).map((r,id)=>{
  const isDetail=r.family==='detail',photo=r.id==='R08'?(bank.find(x=>x.p.personKind==='body')||main).i:isDetail?detail.i:main.i;
  const original=id===0||r.family==='photo'||isDetail;
  const relevant=isDetail?(photos[photo].assetKind==='texture'?/제형|텍스처|산뜻|마무리/:/소재|원단|골지|리브|면 |폴리|디테일/):r.id==='R12'?/사용|바르|세안|순서/:null;
  const purchaseFacts=[...facts].sort((a,b)=>(({ingredient:4,clinical:3,spec:1}[b.kind]||0)+(/보습|장벽|산뜻|리브|골지|소재/.test(b.text)?3:0))-(({ingredient:4,clinical:3,spec:1}[a.kind]||0)+(/보습|장벽|산뜻|리브|골지|소재/.test(a.text)?3:0)));
  const primary=(relevant?purchaseFacts.find(f=>relevant.test(f.text)):null)||purchaseFacts[id%Math.max(1,purchaseFacts.length)];
  const targetAxes={...r.targetAxes,appeal:r.type==='benefit'?'discount':r.type==='numbers'?'price':isDetail?'material':r.type==='question'?'worry':r.type==='usage'?'ease':'feature'};
  return {id,recipe:r.id,plannerVersion:'v3',label:r.label,sceneName:r.label,designId:r.id,designLabel:r.label,designFamily:r.family,targetAxes,
   sourceMode:original?'preserve':'reference',method:original?'original':'newscene',photo,photoSet:isDetail?[main.i,photo]:r.id==='R04'?bank.filter(x=>x.p.personKind==='body').slice(0,2).map(x=>x.i):r.id==='R05'?[...new Map(bank.filter(x=>x.p.colorway).map(x=>[x.p.colorway,x])).values()].slice(0,3).map(x=>x.i):r.id==='R15'?[(bank.find(x=>x.p.itemCount>1)||main).i]:null,
   layout:isDetail?'duo-panel':'header',scene:original?'Use the prepared source photograph panels without changing their contents.':r.design,keep:photos[photo].personKind==='body'?'person':'product',emphasis:['benefit','numbers'].includes(r.type)?'offer':'product',
   type:r.type,angle:{id:r.type,ko:r.label,how:r.design},completeBanner:true,fontFamily:'sans',
   evidenceIds:primary?[primary.id]:[],sourceSummary:{role:photos[photo].role,colorway:photos[photo].colorway||''},
   copyBrief:`${r.label}. ${r.type==='benefit'?'확인된 OFFER 또는 BENEFIT 토큰을 반드시 주인공으로 쓴다.':r.type==='numbers'?'확인된 가격 또는 구성 숫자 하나를 강조한다.':'해당 상품의 실제 특징·설명을 구매 이유로 사용한다.'} 가격은 한 번만. CTA를 반드시 포함한다. 추천 근거: ${primary?.text||'상품명과 구성만 확인됨'}`,
   artDirection:r.design+' Use Korean Gothic typography: '+(r.family==='graphic'?'dimensional or outlined headline, oversized keyword, contrasting badge; supporting text flat.':'bold headline with clear hierarchy; supporting text readable.')+' Visible contrasting CTA button or action strip is required. Keep the exact supplied copy, actual product identity and food state. No invented products, claims or sales. ',
   coverage:{main:original,detail:isDetail,template:r.family==='template',graphic:r.family==='graphic',industry:isDetail||r.family==='industry'},desc:r.label,render:'layer'};
 });
}
export function matchPlanReferences(plans,refs,product){
 const used=new Set();
 return plans.map(p=>{
  const ranked=refs.filter(r=>r.thumbUrl).map(r=>({r,score:Object.entries(p.targetAxes||{}).reduce((s,[k,v])=>s+(r.axes?.[k]===v?({frame:6,focus:5,motif:6,appeal:4}[k]||1):0),0)+(r.type===p.type?6:0)+(String(r.brandName||r.brand||'').normalize('NFC').toLowerCase()===String(product.brand||'').normalize('NFC').toLowerCase()?2:0)-(used.has(r.thumbUrl)?25:0)})).sort((a,b)=>b.score-a.score);
  const hit=ranked[0];if(hit)used.add(hit.r.thumbUrl);
  return {...p,reference:hit?{...hit.r,matchScore:hit.score}:null};
 });
}
