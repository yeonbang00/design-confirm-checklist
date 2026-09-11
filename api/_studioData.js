// Browser counterpart: assets/studio-data.mjs. Keep pure fact validation in sync.
export function safeUrl(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''; } catch { return ''; }
}
export function normalizeProduct(raw={}, source='') {
  const number=v=>{const n=Number(String(v??'').replace(/[,원\s]/g,''));return Number.isFinite(n)&&n>0?n:null};
  const urls=[raw.mainImage,...(Array.isArray(raw.images)?raw.images:[])].map(safeUrl).filter(Boolean);
  return {productName:String(raw.productName||'').trim().slice(0,80),brand:String(raw.brand||'').slice(0,40),salePrice:number(raw.salePrice),quantity:number(raw.quantity),description:String(raw.description||'').slice(0,600),sourceUrl:safeUrl(source||raw.sourceUrl),photos:[...new Set(urls)].slice(0,12).map((url,i)=>({url,label:`상품 원본 ${i+1}`,kind:'original'})),benefitRate:null,benefitCondition:'',benefitKind:'정률',benefitConfirmed:false};
}
export function factSlots(p) {
  const slots={};
  if(Number.isFinite(p.salePrice)&&p.salePrice>0)slots.PRICE=p.salePrice.toLocaleString('ko-KR')+'원';
  if(Number.isInteger(p.quantity)&&p.quantity>0)slots.QUANTITY=p.quantity+'종';
  if(p.benefitConfirmed&&p.benefitRate>0&&p.benefitRate<=100&&p.benefitCondition?.trim())slots.BENEFIT=(p.benefitKind==='최대'?'최대 ':'')+p.benefitRate+'% 혜택';
  return slots;
}
/* 사진에서 읽은 사실에 들어 있는 숫자만 화이트리스트로 연다.
   확인되지 않은 숫자를 막는 규칙은 그대로 두고, 근거가 있는 숫자만 통과시킨다.
   "11.44%"는 되고 "11%"는 안 된다. 반올림도 우리가 하지 않는다. */
const NUM=/\d[\d.,]*\s*(?:%|％|원|점|배|위|호|초|분|시간|일|개|종|매|겹|mL|ml|L|g|kg|cm|mm|년|월)?/g;
const tight=s=>String(s??'').replace(/\s+/g,'');
export function factNumbers(fact){return fact?[...new Set((String(fact.text||'').match(NUM)||[]).map(tight))].sort((a,b)=>b.length-a.length):[]}

export function resolveCopy(row,p,facts=[]) {
  const slots=factSlots(p), out={};
  const list=Array.isArray(facts)?facts:[];
  const idx=Number.isInteger(row?.fact)&&row.fact>=0&&row.fact<list.length?row.fact:-1;
  const fact=idx>=0?list[idx]:null;
  const allowed=factNumbers(fact);
  for(const key of ['main','sub','cta','concept','eyebrow']) {
    let text=row?.[key];
    if(key==='eyebrow'&&(text===undefined||text===null||text===''))
      {out.eyebrow='';continue}
    if(typeof text!=='string'||text.length>(key==='concept'?180:key==='eyebrow'?14:100))throw Error('카피 형식 또는 길이가 맞지 않습니다. 다시 생성해주세요.');
    let probe=tight(text.replace(/\{\{(PRICE|QUANTITY|BENEFIT)\}\}/g,''));
    for(const n of allowed)probe=probe.split(n).join('');
    if(/[0-9０-９%％]|무료|첫\s*구매|최저|최고|보장|한정|마감|배송|증정|캐시백|쿠폰/.test(probe))throw Error('확인되지 않은 숫자나 혜택이 포함되어 적용하지 않았습니다. 다시 생성해주세요.');
    text=text.replace(/\{\{(\w+)\}\}/g,(_,k)=>{if(!slots[k])throw Error('확인하지 않은 수치가 포함되어 적용하지 않았습니다.');return slots[k]});
    if(/[{}]/.test(text)||!text.trim())throw Error('카피가 비어 있거나 형식이 맞지 않습니다.');
    // Tokens already include units; models occasionally append the unit again.
    text=text.replace(/(\d+)종\s*(?:가지|종)/g,'$1종').replace(/원\s*원/g,'원').replace(/% 혜택\s*혜택/g,'% 혜택');
    // 줄표와 슬래시로 이은 문장은 사람이 쓴 카피로 안 읽힌다. 프롬프트로 막지만
    // 새어 나오는 경우가 있어 여기서 한 번 더 끊는다.
    text=text.replace(/\s*[—–]\s*/g,', ').replace(/(\S)\s*\/\s*(\S)/g,'$1, $2').replace(/,\s*,/g,',');
    out[key]=text.trim();
  }
  /* 각주는 모델이 쓰지 않는다. 고른 사실의 출처를 우리가 그대로 붙인다.
     출처를 지어낼 여지를 아예 없앤다. */
  out.footnote=fact?String(fact.source||'').slice(0,120):'';
  out.factText=fact?fact.text:'';
  // Conditions belong to code, so they cannot be dropped by generated copy.
  if(Object.values(out).some(s=>typeof s==='string'&&slots.BENEFIT&&s.includes(slots.BENEFIT))&&slots.BENEFIT)out.sub=p.benefitCondition;
  return out;
}
