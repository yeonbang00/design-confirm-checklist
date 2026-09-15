import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advertisingOffers,advertisingProduct} from '../assets/studio-offer-policy.mjs';
import {resolveCopy} from '../assets/studio-copy-validation.mjs';
import {createV3Plan} from '../assets/studio-v3-plan.mjs';
import {getDesignKnowledge,parseCriteriaGuide} from '../api/_designKnowledge.js';
import {referenceSnapshot} from '../api/_referenceSnapshot.js';
import {getUploadedReferenceImages} from '../api/_referenceUploadsStore.js';
import {getReferenceAxes} from '../api/_referenceAxesStore.js';
const offer=(text,condition='')=>({id:text,text,condition,quote:text+' '+condition,source:'https://example.com/item',verified:true});
const card=offer('삼성카드 5% 할인','5만원 이상 결제');
const general=offer('30% 할인');
const product={offers:[card,general,offer('무료배송'),offer('무이자 12개월')],benefitRate:5,benefitCondition:'삼성카드 결제',benefitConfirmed:true};
assert.deepEqual(advertisingOffers(product).map(x=>x.text),['30% 할인','무료배송']);
assert.equal(advertisingProduct(product).benefitConfirmed,false);
assert.equal(product.offers.length,4,'source evidence is retained');
// Context may mention a card elsewhere; a separately extracted general offer remains valid.
assert.equal(advertisingOffers({offers:[{...general,quote:'30% 할인 삼성카드 별도 할인'}]}).length,1);
const row={main:'{{OFFER_0}}',sub:'상품 구성 살펴보기',cta:'상품 보기',concept:'구성 소개',fact:-1};
assert.equal(resolveCopy(row,product).main,'30% 할인');
assert.throws(()=>resolveCopy({...row,main:'{{BENEFIT}}'},product));
assert.throws(()=>resolveCopy(row,{offers:[card]}));
assert.throws(()=>resolveCopy({...row,main:'카드 혜택 보기'},product));
assert.throws(()=>resolveCopy({...row,fact:0},product,[{text:'삼성카드 5% 할인'}]));
const photos=[{url:'x',role:'main',assetKind:'product',plainBg:true,matchesTarget:true}];
for(let i=0;i<20;i++)assert.ok(!createV3Plan({...product,offers:[card],photos},{random:()=>i/20}).some(p=>p.type==='benefit'));

const html=readFileSync(new URL('../criteria-guide.html',import.meta.url),'utf8');
const guide=parseCriteriaGuide(html);
assert.equal(guide.rules.length,17);
assert.ok(guide.rules.every(r=>r.checks.length>5));
const updated=parseCriteriaGuide(html.replace('목적과 타깃 톤이 일치하는가','목적과 타깃 톤이 일치하는가 — 변경한 기준'));
assert.notEqual(guide.version,updated.version);
assert.throws(()=>parseCriteriaGuide('<main>가이드가 없습니다</main>'));
const copy=getDesignKnowledge('copy'),image=getDesignKnowledge('image'),analysis=getDesignKnowledge('analysis');
assert.equal(copy.metadata.version,image.metadata.version);
assert.equal(image.metadata.version,analysis.metadata.version);
assert.ok(copy.prompt.includes(guide.rules.find(r=>r.id===3).evidence));
assert.equal(copy.metadata.excerpted,false);
assert.match(copy.prompt,/전략 적합성/);assert.match(image.prompt,/CTA/);
assert.doesNotMatch(image.prompt,/<svg|<script|gnb-/);
const a={thumbUrl:'a',type:'product',axes:{frame:'full'}};
assert.notEqual(referenceSnapshot([a]).version,referenceSnapshot([{...a,axes:{frame:'split'}}]).version);
assert.notEqual(referenceSnapshot([a]).version,referenceSnapshot([a,{thumbUrl:'b'}]).version);
assert.equal(referenceSnapshot([a,{thumbUrl:'b'}]).version,referenceSnapshot([{thumbUrl:'b'},a]).version);
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async()=>({ok:false,status:503});
 await assert.rejects(()=>getUploadedReferenceImages({strict:true}));
 await assert.rejects(()=>getReferenceAxes({strict:true}));
 // Legacy callers keep their established fallback; the generation catalog is strict.
 assert.deepEqual(await getReferenceAxes(),{});
}finally{globalThis.fetch=originalFetch;}
console.log('PASS: card offers excluded without losing source, shared published guide versions, reference upload/tag fingerprints');
