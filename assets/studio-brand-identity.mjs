// Product identity and the retailer's later-added logo have different roles.
// Only the collected/user-confirmed product brand is eligible; never infer it
// from the shopping-mall domain or borrow a brand from the design reference.
export const BRAND_COPY_VERSION='2026-09-15-product-brand-1';
export function productBrand(product={}){
 const name=typeof product.brand==='string'?product.brand.normalize('NFC').trim():'';
 return !name||name.length>40||/^(unknown|null|undefined|n\/?a|미상|알\s*수\s*없음|브랜드)$/i.test(name)?'':name;
}
export function mentionsBrand(text,brand){
 const compact=s=>String(s||'').normalize('NFKC').replace(/\s/g,'').toLocaleUpperCase('en-US');
 const name=compact(brand);if(!name)return false;
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 // COS inside COSMETIC is not a brand mention. Korean particles are allowed.
 return new RegExp((/^[A-Z0-9]/.test(name)?'(?<![A-Z0-9])':'')+escaped+(/[A-Z0-9]$/.test(name)?'(?![A-Z0-9])':'')).test(compact(text));
}
export function brandCopy(product,headline,subline){
 const requiredBrand=productBrand(product);
 return {requiredBrand,brandLine:requiredBrand&&![headline,subline].some(s=>mentionsBrand(s,requiredBrand))?requiredBrand:''};
}
export function renderedBrandIssues(check,copy){
 if(!copy.requiredBrand||!check)return [];
 return mentionsBrand(check.read,copy.requiredBrand)?[]:['상품 브랜드명 누락 또는 오탈자'];
}
export const BRAND_COPY_INSTRUCTION='The product brand and the retailer logo are different. Render brandLine, when supplied, ONCE as readable ordinary text near the headline/subline or product information, with supporting hierarchy. It is not a logo, wordmark, badge, watermark or extra large headline. If brandLine is empty, do not add a separate brand label: the brand is already in our copy or is unknown. Do not replace the product brand with the retailer name. Do not invent or translate a brand. The designer adds the retailer/advertiser logo later; do not draw that logo. Tiny wording physically printed on a garment or package is not a substitute for readable advertising copy.';
