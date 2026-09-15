import assert from 'node:assert/strict';
import {brandCopy,mentionsBrand,productBrand} from '../assets/studio-brand-identity.mjs';
import {completeCopy} from '../assets/studio-evidence.mjs';
import {generationRequest,completeBannerPrompt} from '../assets/studio-generation-contract.mjs';
import {renderedCopyIssues,renderedTypographyIssues} from '../assets/studio-text-check.mjs';

const product={productName:'블루핏 헨리넥 스트라이프 니트 3종',brand:'블루핏',salePrice:79000,sourceUrl:'https://www.shinsegaetvshopping.com/item',photos:[{url:'https://product.test/actual.jpg',matchesTarget:true}]};
const variants=[
 {main:product.productName,sub:'79,000원'},
 {main:'헨리넥 니트의 또 다른 분위기',sub:'서로 다른 컬러로 담은 스트라이프 디자인'},
 {main:'한눈에 보는 스트라이프 니트',sub:'헨리넥 여밈과 스트라이프 디자인'},
 {main:'어떤 스트라이프를 고를까?',sub:'버건디 컬러의 헨리넥 니트'},
 {main:'의자 위에 놓인 버건디 니트',sub:'선명한 스트라이프와 헨리넥 여밈'},
 {main:'그래픽하게 담은 스트라이프 니트',sub:'헨리넥 여밈이 더해진 니트 디자인'}
].map(v=>({...v,cta:'상품 자세히 보기'}));
for(const [i,v] of variants.entries()){
 const copy=completeCopy(v,{},product);
 assert.equal(copy.requiredBrand,'블루핏');assert.equal(copy.brandLine,i===0?'':'블루핏');
 assert.equal(copy.brand,'','legacy logo field stays empty');
 assert.equal(copy.headline,v.main);assert.equal(copy.subline,v.sub,'do not rewrite the approved mood/copy');
 const payload=await generationRequest({photo:0,reference:{thumbUrl:'https://reference.test/otherbrand.jpg'}},product,v,async p=>({imageUrl:p.url}));
 const prompt=completeBannerPrompt(payload);
 assert.match(prompt,new RegExp('"brandLine":"'+(i===0?'':'블루핏')+'"'));
 assert.match(prompt,/readable ordinary text/);assert.match(prompt,/retailer\/advertiser logo later/);
 assert.doesNotMatch(prompt,/"requiredBrand"/,'validation metadata is not extra advertising copy');
 const present={read:[copy.headline,copy.subline,copy.brandLine,copy.cta].join(' '),claims:[],boxes:[]};
 assert.deepEqual(renderedCopyIssues(present,copy),[]);
 assert.ok(renderedCopyIssues({...present,read:present.read.replaceAll('블루핏','')},copy).includes('상품 브랜드명 누락 또는 오탈자'));
}
assert.equal(brandCopy(product,'새로운 니트','블루핏의 스트라이프').brandLine,'');
assert.equal(brandCopy({brand:'Auralee'},'AURALEE 팬츠','추가 쿠폰').brandLine,'');
assert.equal(brandCopy({brand:'8 seconds'},'부드러운 캐시미어','8seconds 올데이 캐시미어').brandLine,'');
assert.equal(mentionsBrand('COSMETIC','COS'),false);
assert.equal(mentionsBrand('블 루 핏 니트','블루핏'),true);
assert.equal(productBrand({brand:'노브랜드'}),'노브랜드','actual brand is not an unknown sentinel');
assert.deepEqual(brandCopy({brand:null,sourceUrl:product.sourceUrl,reference:{brand:'Nike'}},'니트','상품'),{requiredBrand:'',brandLine:''});
assert.equal(productBrand({brand:'unknown'}),'');
assert.ok(renderedTypographyIssues({boxes:[{text:'블루핏',h:10,y:10}]},{brandLine:'블루핏'}).includes('상품 브랜드명이 읽기 어려운 크기'));
console.log('PASS: six supplied concepts retain copy; each carries product brand once; retailer/logo separate; missing/unknown brands and existing OCR covered without paid calls');
