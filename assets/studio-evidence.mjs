import {brandCopy} from './studio-brand-identity.mjs';
import {basicCopy,isSupportingOffer,displayProductName} from './studio-visual-contract.mjs';
import {isCardOffer} from './studio-offer-policy.mjs';
// Source text is evidence, never instructions. Only exact, attributable excerpts survive.
export function evidenceSections(p){
 const rows=[...(p.pageSections||[])];
 if(p.description)rows.unshift({id:'description',kind:'description',text:p.description,source:p.sourceUrl});
 return rows.slice(0,41);
}
export function verifiedPageEvidence(raw,sections,source){
 const facts=[],offers=[];
 for(const [kind,rows] of [['facts',raw?.pageFacts],['offers',raw?.offers]])for(const row of (Array.isArray(rows)?rows:[]).slice(0,24)){
  const section=sections.find(s=>s.id===row.sectionId),quote=String(row.quote||'').trim();
  if(!section||quote.length<4||quote.length>450||!section.text.includes(quote)||row.matchesTarget!==true)continue;
  // Requiring the entire text/condition as source excerpts avoids invented qualifier changes.
  const text=String(row.text||'').trim(),condition=String(row.condition||'').trim();
  if(!text||!quote.includes(text)||condition&&!quote.includes(condition))continue;
  const item={id:`${kind}/${section.id}/${(kind==='facts'?facts:offers).length}`,text,quote,condition,source,sectionId:section.id,kind:String(row.kind||'spec'),verified:true};
  (kind==='facts'?facts:offers).push(item);
 }
 return {facts,offers};
}
export function chooseCopyFacts(facts=[],plans=[]){
 const selected=new Set(plans.flatMap(p=>p.evidenceIds||[]));
 return facts.filter(f=>!isCardOffer(f)).sort((a,b)=>Number(selected.has(b.id))-Number(selected.has(a.id))).slice(0,32);
}
export function completeCopy(variant,plan,product){
 if(plan.copyMode==='basic')variant=basicCopy(product);
 const price=Number.isFinite(product.salePrice)?product.salePrice.toLocaleString('ko-KR')+'원':'';
 const headline=variant.main||'',subline=variant.sub||'';
 if(isSupportingOffer(headline))throw Error('배송 혜택은 메인 제목이 아니라 보조 문구로 사용해주세요.');
 if(price&&[headline,subline].join(' ').replace(/\s/g,'').split(price).length>2)throw Error('같은 가격이 반복된 카피입니다. 카피를 다시 생성해주세요.');
 return {headline,subline,...brandCopy(product,headline,subline),offer:'',brand:'',cta:variant.cta?.trim()||'상품 자세히 보기',footnote:[variant.conditions,variant.footnote].filter(Boolean).join(' · ')};
}

export function validatePlannedCopy(copy,plan,product){
 if(isSupportingOffer(copy.main))throw Error('배송 혜택은 제목에 쓰지 말고 작은 보조 문구로만 사용하세요.');
 if(plan.copyMode==='basic')return basicCopy(product);
 // The creative headline may be emotional, but the product must still be named.
 const nouns=(displayProductName(product).match(/니트|티셔츠|셔츠|가디건|팬츠|스커트|코트|재킷|자켓|원피스|로션|크림|세럼|토너|앰플|선크림|클렌징|김치|불고기|고기|밀키트|청소기|이어폰|보험|카드/g)||[]);
 if(nouns.length&&!nouns.some(n=>[copy.main,copy.sub].join(' ').includes(n)))throw Error('메인 또는 서브에 실제 상품 종류를 명확하게 넣으세요.');
 return copy;
}
