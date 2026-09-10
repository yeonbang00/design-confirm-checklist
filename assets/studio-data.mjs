export function safeUrl(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''; } catch { return ''; }
}
export function normalizeProduct(raw={}, source='') {
  const number=v=>{const n=Number(String(v??'').replace(/[,원\s]/g,''));return Number.isFinite(n)&&n>0?n:null};
  const urls=[raw.mainImage,...(Array.isArray(raw.images)?raw.images:[])].map(safeUrl).filter(Boolean);
  // 북마클릿이 보낸 크기 정보. 분류가 실패해도 이것만으로 상세컷을 가른다.
  const meta=new Map((Array.isArray(raw.imageMeta)?raw.imageMeta:[]).map(m=>[safeUrl(m?.url),m]).filter(([u])=>u));
  return {productName:String(raw.productName||'').trim().slice(0,80),brand:String(raw.brand||'').slice(0,40),salePrice:number(raw.salePrice),quantity:number(raw.quantity),description:String(raw.description||'').slice(0,600),sourceUrl:safeUrl(source||raw.sourceUrl),photos:[...new Set(urls)].slice(0,12).map((url,i)=>{const m=meta.get(url)||{};return {url,label:`상품 원본 ${i+1}`,kind:'original',w:Number(m.w)||0,h:Number(m.h)||0,role:i===0?'main':(m.tall?'detail':'')}}),benefitRate:null,benefitCondition:'',benefitKind:'정률',benefitConfirmed:false};
}
export function factSlots(p) {
  const slots={};
  if(Number.isFinite(p.salePrice)&&p.salePrice>0)slots.PRICE=p.salePrice.toLocaleString('ko-KR')+'원';
  if(Number.isInteger(p.quantity)&&p.quantity>0)slots.QUANTITY=p.quantity+'종';
  if(p.benefitConfirmed&&p.benefitRate>0&&p.benefitRate<=100&&p.benefitCondition?.trim())slots.BENEFIT=(p.benefitKind==='최대'?'최대 ':'')+p.benefitRate+'% 혜택';
  return slots;
}
export function resolveCopy(row,p) {
  const slots=factSlots(p), out={};
  for(const key of ['main','sub','cta','concept']) {
    let text=row?.[key];
    if(typeof text!=='string'||text.length>(key==='concept'?180:100))throw Error('카피 형식 또는 길이가 맞지 않습니다. 다시 생성해주세요.');
    const remaining=text.replace(/\{\{(PRICE|QUANTITY|BENEFIT)\}\}/g,'');
    if(/[0-9０-９%％]|무료|쿠폰|첫\s*구매|최저|최고|보장|한정|마감|배송|증정|캐시백/.test(remaining))throw Error('확인되지 않은 숫자나 혜택이 포함되어 적용하지 않았습니다. 다시 생성해주세요.');
    text=text.replace(/\{\{(\w+)\}\}/g,(_,k)=>{if(!slots[k])throw Error('확인하지 않은 수치가 포함되어 적용하지 않았습니다.');return slots[k]});
    if(/[{}]/.test(text)||!text.trim())throw Error('카피가 비어 있거나 형식이 맞지 않습니다.');
    // Tokens already include units; models occasionally append the unit again.
    text=text.replace(/(\d+)종\s*(?:가지|종)/g,'$1종').replace(/원\s*원/g,'원').replace(/% 혜택\s*혜택/g,'% 혜택');
    out[key]=text.trim();
  }
  // Conditions belong to code, so they cannot be dropped by generated copy.
  if(Object.values(out).some(s=>s.includes(slots.BENEFIT))&&slots.BENEFIT)out.sub=p.benefitCondition;
  return out;
}
