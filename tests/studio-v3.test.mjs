import assert from 'node:assert/strict';
import {normalizeProduct,factSlots} from '../assets/studio-data.mjs';
import {resolveCopy} from '../api/_studioData.js';
import {verifiedPageEvidence,completeCopy} from '../assets/studio-evidence.mjs';
import {createV3Plan,matchPlanReferences,V3_RECIPES} from '../assets/studio-v3-plan.mjs';
const p=normalizeProduct({productName:'익스트림 로션 150ml, 2개',salePrice:35000,originalPrice:50000,discountRate:30,description:'설명'.repeat(500),mainImage:'https://example.com/main',pageSections:[{id:'offer',text:'이 상품 삼성카드 5% 할인 (5만원 이상 결제)'}]},'https://example.com/item');
assert.equal(p.quantity,2);assert.equal(factSlots(p).QUANTITY,'2개');assert.equal(p.description.length,1000);assert.equal(p.originalPrice,50000);assert.equal(p.discountRate,30);assert.equal(factSlots(p).BENEFIT,undefined);
const raw={offers:[{sectionId:'offer',quote:'이 상품 삼성카드 5% 할인 (5만원 이상 결제)',text:'삼성카드 5% 할인',condition:'5만원 이상 결제',matchesTarget:true}]};
const e=verifiedPageEvidence(raw,p.pageSections,p.sourceUrl);assert.equal(e.offers.length,1);
assert.equal(verifiedPageEvidence({offers:[{...raw.offers[0],text:'누구나 50% 할인'}]},p.pageSections,p.sourceUrl).offers.length,0);
assert.equal(verifiedPageEvidence({offers:[{...raw.offers[0],matchesTarget:false}]},p.pageSections,p.sourceUrl).offers.length,0);
p.offers=[{id:'general',verified:true,text:'30% 할인',quote:'9월 17일까지 30% 할인',condition:'9월 17일까지',source:p.sourceUrl}];
const row={main:'{{OFFER_0}}',sub:'로션 구성 살펴보기',cta:'혜택 확인하기',concept:'구매 조건 강조',fact:-1};
const copy=resolveCopy(row,p);assert.equal(copy.main,'30% 할인');assert.match(copy.conditions,/9월 17일까지/);
assert.throws(()=>resolveCopy({...row,main:'누구나 50% 할인'},p));
const fact={id:'clinical',text:'피부톤 11.44% 개선',source:'해당 상품 시험'};
assert.throws(()=>resolveCopy({...row,main:'피부톤 11% 개선',fact:0},p,[fact]));
assert.throws(()=>resolveCopy({...row,main:'피부톤 111.44% 개선',fact:0},p,[fact]));
assert.equal(resolveCopy({...row,main:'피부톤 11.44% 개선',fact:0},p,[fact]).main,'피부톤 11.44% 개선');
const request=completeCopy({main:'35,000원',sub:'제품 구성',cta:'구성 확인하기',conditions:'삼성카드 결제'}, {emphasis:'offer'},p);
assert.equal(request.offer,'');assert.equal(request.cta,'구성 확인하기');assert.equal(request.footnote,'삼성카드 결제');
let state=9;const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
p.category='beauty';p.facts=[{id:'detail',text:'실제 제형 설명',source:'https://example.com/detail'}];p.photos=[{url:'https://example.com/main',provenance:'main',role:'main',plainBg:true,personKind:'none',matchesTarget:true,assetKind:'product'},{url:'https://example.com/detail',provenance:'detail',role:'detail',personKind:'none',matchesTarget:true,assetKind:'texture'},{url:'https://example.com/wrong',role:'packshot',matchesTarget:false}];
assert.equal(V3_RECIPES.length,30);
const sets=new Set();
for(let n=0;n<100;n++){
 const plans=createV3Plan(p,{random});assert.equal(plans.length,6);assert.equal(new Set(plans.map(x=>x.recipe)).size,6);
 assert.ok(plans.some(x=>x.recipe==='R11'));assert.ok(plans.some(x=>x.coverage.graphic));assert.ok(plans.some(x=>x.coverage.template));assert.ok(plans.some(x=>x.type==='benefit'));
 assert.ok(plans.every(x=>x.photo!==2));assert.ok(new Set(plans.map(x=>x.type)).size>=3);sets.add(plans.map(x=>x.recipe).join(','));
 const refs=[{thumbUrl:'https://example.com/match',axes:plans[0].targetAxes},{thumbUrl:'https://example.com/other',axes:{frame:'other'}}];
 assert.equal(matchPlanReferences(plans,refs,p)[0].reference.thumbUrl,refs[0].thumbUrl);
}
assert.ok(sets.size>20);
assert.deepEqual(createV3Plan({photos:[{role:'main',matchesTarget:false}]}),[]);
console.log('PASS v3: evidence provenance, conditional offers, exact numeric validation, CTA/price contract, 100 diverse recipe selections');

const {detailTileBounds}=await import('../assets/studio-detail-tiles.mjs');
const {containRect}=await import('../assets/studio-source-panels.mjs');
const {renderedCopyIssues,unverifiedClaims}=await import('../assets/studio-text-check.mjs');
const tiles=detailTileBounds(848,20591);
assert.equal(tiles.length,15);
assert.equal(tiles[0].y,0);
assert.equal(tiles.at(-1).y+tiles.at(-1).h,20591);
assert.ok(tiles.every((t,i)=>!i||t.y<tiles[i-1].y+tiles[i-1].h));
assert.deepEqual(detailTileBounds(1000,1000),[]);
assert.deepEqual(containRect(1000,2000,[0,0,600,600]),[150,0,300,600]);
assert.deepEqual(unverifiedClaims('11.44% 35,000원',['11.44% 개선','35,000원']),[]);
assert.deepEqual(unverifiedClaims('11.4%',['11.44%']),['11.4%']);
assert.deepEqual(unverifiedClaims('5.07 41% 35,000 원',['41%','35,000원']),[]);
assert.ok(renderedCopyIssues({read:'혜택 35,000원',claims:[]},{cta:'혜택 확인하기'}).length);
assert.ok(renderedCopyIssues({read:'35,000원 35,000원 상품 확인하기',claims:[]},{headline:'35,000원',cta:'상품 확인하기'}).includes('같은 가격 중복'));
assert.deepEqual(renderedCopyIssues({read:'35,000원 상품 확인하기',claims:[]},{headline:'35,000원',cta:'상품 확인하기'}),[]);
assert.throws(()=>completeCopy({main:'35,000원',sub:'35,000원',cta:'확인하기'},{},{salePrice:35000}));
for(let seed=0;seed<40;seed++){
 const photos=[{url:'a',matchesTarget:true,role:'main',assetKind:'product',plainBg:true},{url:'b',matchesTarget:true,role:'packshot',assetKind:'product',plainBg:true}];
 const plan=createV3Plan({category:'beauty',photos,salePrice:35000},{random:()=>seed/40});
 assert.ok(!plan.some(p=>['R04','R05','R06','R07','R08','R14','R15'].includes(p.recipe)));
}
console.log('PASS: long-page coverage, source containment, CTA/money quality gate, category-specific recipe eligibility');

const rationaleCopy=resolveCopy({...row,concept:'배송 정보를 배지로 정리하는 내부 제작 설명'},p);
assert.match(rationaleCopy.concept,/배송/);
assert.ok(!JSON.stringify(completeCopy(rationaleCopy,{},p)).includes('내부 제작 설명'));
assert.throws(()=>resolveCopy({...row,sub:'무료배송 50% 쿠폰'},p));
assert.throws(()=>resolveCopy({...row,sub:'혜택 패널에 배치합니다'},p));
