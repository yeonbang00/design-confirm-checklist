export function safeUrl(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''; } catch { return ''; }
}
// 상품명에 명확히 적힌 한 가지 구성 수만 읽는다. 1+1이나 서로 다른 종 수는 추정하지 않는다.
export function productQuantity(raw={}) {
  const explicit=Number(raw.quantity);
  if(Number.isInteger(explicit)&&explicit>0)return explicit;
  const matches=[...String(raw.productName||'').matchAll(/(?:^|[^0-9])([1-9][0-9]?)(종|개)(?=$|[^가-힣0-9])/g)];
  return matches.length===1?Number(matches[0][1]):null;
}
export function normalizeProduct(raw={}, source='') {
  const number=v=>{const n=Number(String(v??'').replace(/[,원\s]/g,''));return Number.isFinite(n)&&n>0?n:null};
  const urls=[raw.mainImage,...(Array.isArray(raw.images)?raw.images:[])].map(safeUrl).filter(Boolean);
  const meta=new Map((Array.isArray(raw.imageMeta)?raw.imageMeta:[]).map(m=>[safeUrl(m?.url),m]).filter(([u])=>u));
  const sourceUrl=safeUrl(source||raw.sourceUrl);
  const sections=(Array.isArray(raw.pageSections)?raw.pageSections:[]).slice(0,40).map((x,i)=>({id:String(x.id||'section-'+i).slice(0,60),kind:String(x.kind||'detail').slice(0,24),text:String(x.text||'').slice(0,3000),source:sourceUrl})).filter(x=>x.text.trim());
  const benefitConfirmed=raw.benefitConfirmed===true&&!!String(raw.benefitCondition||'').trim();
  return {productName:String(raw.productName||'').trim().slice(0,80),brand:String(raw.brand||'').slice(0,40),salePrice:number(raw.salePrice),originalPrice:number(raw.originalPrice),discountRate:number(raw.discountRate),discountSource:raw.discountSource||'unverified',quantity:productQuantity(raw),quantityUnit:raw.quantityUnit==='개'||/\d+개(?:$|[^가-힣])/.test(raw.productName||'')?'개':'종',description:String(raw.description||'').slice(0,12000),pageSections:sections,collectionStatus:raw.collectionStatus||{},sourceUrl,
    photos:[...new Set(urls)].slice(0,24).map((url,i)=>{const m=meta.get(url)||{};return {url,label:`상품 원본 ${i+1}`,kind:'original',provenance:i===0?'main':'detail',w:Number(m.w)||0,h:Number(m.h)||0,role:i===0?'main':(m.tall?'detail':'')}}),
    benefitRate:benefitConfirmed?number(raw.benefitRate):null,benefitCondition:benefitConfirmed?String(raw.benefitCondition).slice(0,300):'',benefitKind:raw.benefitKind==='최대'?'최대':'정률',benefitConfirmed};
}
export function factSlots(p) {
  const slots={};
  if(Number.isFinite(p.salePrice)&&p.salePrice>0)slots.PRICE=p.salePrice.toLocaleString('ko-KR')+'원';
  if(Number.isInteger(p.quantity)&&p.quantity>0)slots.QUANTITY=p.quantity+(p.quantityUnit==='개'?'개':'종');
  if(p.benefitConfirmed&&p.benefitRate>0&&p.benefitRate<=100&&p.benefitCondition?.trim())slots.BENEFIT=(p.benefitKind==='최대'?'최대 ':'')+p.benefitRate+'% 혜택';
  return slots;
}
export {resolveCopy} from './studio-copy-validation.mjs';
