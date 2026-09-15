// Keep payment-specific evidence in the source, but do not advertise it by default.
export const OFFER_POLICY_VERSION='2026-09-15-no-card-v1';
export function isCardOffer(offer){
 const text=typeof offer==='string'?offer:[offer?.kind,offer?.text,offer?.condition].filter(Boolean).join(' ');
 return /카드|무이자|할부|청구\s*할인|credit.?card|card.?discount/i.test(text||'');
}
export function advertisingOffers(product){
 return (product.offers||[]).filter(o=>o.verified===true&&o.text&&o.quote&&o.source&&!isCardOffer(o));
}
export function advertisingProduct(product){
 return {...product,offers:advertisingOffers(product),benefitConfirmed:product.benefitConfirmed===true&&!isCardOffer(product.benefitCondition),facts:(product.facts||[]).filter(f=>!isCardOffer(f))};
}
