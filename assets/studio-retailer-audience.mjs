// Explicit user-defined retailer brief. Never infer ethnicity from source faces.
export const RETAILER_AUDIENCE_VERSION='shinsegae-women-3040-v1';
export function retailerAudience(product){
 let host;try{const u=new URL(product.sourceUrl);if(u.protocol!=='https:')return null;host=u.hostname.toLowerCase();}catch{return null;}
 if(!(host==='shinsegaetvshopping.com'||host.endsWith('.shinsegaetvshopping.com')))return null;
 if(!/^fashion-(top|outer|bottom)$/.test(product.category||''))return null;
 if(/남성|남자|맨즈|아동|키즈|남아|여아|유아|\bmen(?:'s)?\b|\bkids\b/i.test(product.productName||''))return null;
 return {id:RETAILER_AUDIENCE_VERSION,age:'30s–40s',casting:'Korean woman',style:'polished contemporary fashion model, composed and refined'};
}
export function modelAdaptationInstructions(profile){
 if(profile?.id!==RETAILER_AUDIENCE_VERSION)return '';
 return ' INTENTIONAL MODEL ADAPTATION: Create one NEW fictional Korean female fashion model in her 30s–40s wearing the exact supplied garment. This is authorized casting, not preservation of the original person. Do not age or morph the source face; do not copy a celebrity. A polished, contemporary professional fashion presentation: refined hair, natural editorial makeup, composed confidence, authentic skin texture, neither elderly styling nor a casual customer-snapshot look. Do not exaggerate age, wrinkles, body shape or youthfulness. The product brand mood still governs the scene. Source images are garment references, not a request to duplicate their people/poses. Keep the exact garment silhouette, neckline, sleeves, length, fastenings, pattern spacing, colour and fabric. Change only model and coherent setting/pose; match light, contact shadows and perspective. No invented garment variants. Do not print demographic labels in advertising copy.';
}
export function garmentIdentityPrompt(){
 return 'The LAST image is the new advertisement; preceding images are actual garment sources. Intentional model replacement is allowed: do NOT reject a different face, apparent age, hair or pose. Compare the advertised GARMENT with the source: silhouette, neckline, sleeves, length, buttons, pattern spacing, colour and fabric. Reject changed clothing, invented patterns/colours, obscured or uncertain identity, impossible anatomy or visibly incoherent composite lighting. Do not determine ethnicity or exact age from a face. Return JSON {"matches":true/false,"reason":"short Korean reason"}.';
}
