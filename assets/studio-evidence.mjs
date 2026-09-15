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
 const price=Number.isFinite(product.salePrice)?product.salePrice.toLocaleString('ko-KR')+'원':'';
 const headline=variant.main||'',subline=variant.sub||'';
 if(price&&[headline,subline].join(' ').replace(/\s/g,'').split(price).length>2)throw Error('같은 가격이 반복된 카피입니다. 카피를 다시 생성해주세요.');
 const hasPrice=price&&[headline,subline].some(s=>s.replace(/\s/g,'').includes(price));
 return {headline,subline,offer:plan.emphasis==='offer'&&!hasPrice?price:'',brand:product.brand||'',cta:variant.cta?.trim()||'상품 자세히 보기',footnote:[variant.conditions,variant.footnote].filter(Boolean).join(' · ')};
}
