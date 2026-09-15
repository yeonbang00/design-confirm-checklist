// Complete-image design briefs: composition, graphic device and typography are chosen together.
// Requirements describe supplied assets, never permission to invent a product or benefit.
const rows = [
 ['editorial','상단 제목 화보','photo','sans','','Shallow ivory headline strip above a dominant full-width photograph; one quiet information line at the bottom.'],
 ['margin','여백 화보','photo','sans','','Dominant photograph with an unusually generous paper margin on one side; headline crosses only the empty margin, never the subject.'],
 ['fullbleed','전면 사진 캠페인','photo','sans','','Edge-to-edge photograph; a large compact headline in natural negative space, no cards or artificial panel.'],
 ['vertical','세로 브랜드 포스터','photo','sans','','One full-height hero photograph, small vertical brand marker at the edge, large horizontal headline and a restrained bottom information rule.'],
 ['quiet','햇살 화보','photo','serif','','Photographic campaign with warm architectural light, airy large headline in natural empty space, fine information line.'],
 ['portrait','측면 여백 화보','panel','serif','','Hero occupies left two thirds; calm ivory right third contains an elegant large title and fine information rule.'],
 ['arch','아치 윈도','frame','sans','','One dominant photograph inside a tall arch window, large title outside the arch, clean open margins.'],
 ['oval','오벌 프레임','frame','serif','','Oversized oval photograph partially bleeds off one edge; elegant horizontal headline opposite, generous negative space.'],
 ['contact','필름 콘택트','multi','sans','multi','Two supplied photographs form an unequal film contact sheet, one dominant frame and one supporting frame; bold headline in a wide margin.'],
 ['collection','아치 콜라주','multi','serif','multi','Large arch photograph and smaller rectangular secondary photograph, asymmetrical editorial margins and an understated information rule.'],
 ['overlap','겹친 사진 엽서','multi','sans','multi','Two supplied photographs on overlapping paper prints with different scale and slight rotation; headline has its own clear space.'],
 ['diptych','비대칭 두 컷','multi','serif','multi','Two supplied photographs in an asymmetric diptych, narrow gutter, large elegant title above; no equal tile grid.'],
 ['catalogue','컬러 블록 카탈로그','panel','sans','','Strong colored headline block at upper left, warm white elsewhere; large product presentation occupies most of the canvas.'],
 ['diagonal','대각선 캠페인','panel','sans','','A deliberate diagonal boundary separates a bold headline field from the hero image; keep subject intact rather than clipping it at the boundary.'],
 ['ribbon','띠지 에디토리얼','panel','sans','','Large photographic hero with a narrow paper band carrying a confident headline; band stays clear of face and product details.'],
 ['offset','엇갈린 면 편집','panel','serif','','Two offset color planes frame a large hero photograph; elegant title bridges only empty areas, aligned fine information beneath.'],
 ['poster','테이프 포스터','object','sans','','Printed-paper poster on a textured wall, restrained tape at corners, large product photograph and bold headline integrated on the paper.'],
 ['sticker','제품 스티커 캠페인','object','sans','','Actual product as an oversized outlined sticker on clean colored paper; playful bold title, just a few abstract decorative marks.'],
 ['stage','입체 전시대','object','sans','','Hero product on a simple architectural display stage, realistic contact shadow; oversized headline in open upper space. Do not alter product form.'],
 ['spotlight','스포트라이트','object','sans','','Dark campaign stage with a single directional spotlight on the actual product; high-contrast large headline, minimal supporting copy.'],
 ['paper','종이 조형 무대','object','serif','','Folded paper architectural backdrop frames the actual hero; refined large title, soft shadow, restrained information.'],
 ['halo','빛의 원 프레임','frame','serif','','Large luminous circular graphic behind the hero, subtle depth, refined large headline above; circle is decorative, not a product claim.'],
 ['ticket','가격 티켓','type','sans','price','Large verified price on a graphic ticket shape beside the visible hero; strong headline and orderly hierarchy. No invented coupon, discount or deadline.'],
 ['number','소재 숫자','type','sans','quantity','Verified quantity as a giant sculptural numeral with abstract product-inspired material; actual hero remains visible below. Numeral is a graphic symbol, not a real product detail.'],
 ['balloon','풍선 숫자','type','sans','quantity','Giant balloon-style verified quantity with realistic dimensional lighting, actual product separately visible, short bold headline. No invented discount.'],
 ['price','가격 주인공','type','sans','price','Oversized verified price forms the primary graphic, product overlaps a small part without obscuring digits; headline is short and supporting.'],
 ['lookbook','패션 룩북','photo','sans','fashion','Fashion lookbook cover using the supplied garment or wearer as the large hero; confident Gothic headline, sparse brand marker, no invented garment colors.'],
 ['runway','착장 전면','photo','serif','body','Supplied wearer dominates a tall editorial frame; large elegant headline beside the silhouette, face and garment unobstructed. Preserve the person.'],
 ['beauty','뷰티 오브제','object','sans','beauty','Actual cosmetic package on a minimal curved plinth, refined studio reflections, bold clean title. No invented ingredient, cream smear, skin result or extra package.'],
 ['window','제품 쇼윈도','frame','sans','','Large rectangular window with subtle dimensional border holds the actual hero; headline above, small verified information below, no tiny photograph.']
];
export const DESIGN_LIBRARY=Object.freeze(rows.map(([id,label,family,font,requires,design])=>Object.freeze({id,label,family,font,requires,design})));
export function eligibleDesigns(plan,product){
 const photo=product.photos?.[plan.photo];
 const multiple=new Set([plan.photo,...(plan.photoSet||[])]).size>=2;
 return DESIGN_LIBRARY.filter(d=>!d.requires||({
  multi:multiple, price:Number.isFinite(product.salePrice)&&product.salePrice>0,
  quantity:Number.isInteger(product.quantity)&&product.quantity>0,
  fashion:/^fashion/.test(product.category||''),beauty:product.category==='beauty',
  body:photo?.personKind==='body'&&(!plan.scene||plan.keep==='person')
 })[d.requires]);
}
export function artDirect(plans,product,{random=Math.random,recent=[]}={}){
 const selected=[];
 // Shuffle slots, not just the designs: serif does not always occupy the same two cards.
 const fonts=plans.map((_,i)=>i<Math.ceil(plans.length*2/3)?'sans':'serif');
 for(let i=fonts.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[fonts[i],fonts[j]]=[fonts[j],fonts[i]];}
 return plans.map((p,i)=>{
  const candidates=eligibleDesigns(p,product).filter(d=>!selected.some(s=>s.id===d.id));
  const sameFont=candidates.filter(d=>d.font===fonts[i]);
  const pool=sameFont.length?sameFont:candidates;
  if(!pool.length)throw Error('서로 다른 배너 구성을 선택할 수 없습니다.');
  const ranked=pool.map(d=>({d,score:random()*2-(recent.includes(d.id)?12:0)-selected.filter(s=>s.family===d.family).length*8})).sort((a,b)=>b.score-a.score);
  const d=ranked[0].d;selected.push(d);
  const typography=d.font==='sans'?'Use modern Korean sans-serif (Gothic) for all headline and supporting copy. No Korean serif headline.':'Use a refined Korean serif headline with restrained supporting sans-serif text.';
  return {...p,completeBanner:true,designId:d.id,designLabel:d.label,designFamily:d.family,fontFamily:d.font,
   artDirection:d.design+' '+typography+' Make the headline readable on a mobile feed. Follow the supplied scene and keep instructions; these override decorative staging. Never invent additional products, colors, ingredients or cooked food. Use only supplied exact text and verified numbers.',
   copyBrief:(p.copyBrief||'')+' '+d.label+' 구성에 어울리는 짧은 광고 제목. 메인 2줄 이내, 총 18자 안팎. 사진 해설이나 형용사 나열을 피하고 상단 라벨은 비운다. '+(/^fashion/.test(product.category||'')?'패션 광고 어조.':''),
   emphasis:d.family==='type'?'offer':p.emphasis};
 });
}
const HISTORY_KEY='adcheck-design-history-v1';
function productKey(p){return [p.sourceUrl||'',p.brand||'',p.productName||''].join('|');}
export function recentDesigns(product,storage){try{return JSON.parse(storage.getItem(HISTORY_KEY)||'[]').find(x=>x.key===productKey(product))?.ids||[];}catch{return [];}}
export function rememberDesign(product,id,storage){
 try{const all=JSON.parse(storage.getItem(HISTORY_KEY)||'[]'),key=productKey(product),ids=all.find(x=>x.key===key)?.ids||[];
 storage.setItem(HISTORY_KEY,JSON.stringify([{key,ids:[id,...ids.filter(x=>x!==id)].slice(0,12)},...all.filter(x=>x.key!==key)].slice(0,20)));}catch{/* Storage restrictions must not interrupt generation. */}
}
