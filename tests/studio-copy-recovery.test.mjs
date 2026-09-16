import test from 'node:test';
import assert from 'node:assert/strict';
import {studioCopy} from '../api/_studioCopy.js';
import {restoreProductKind,validatePlannedCopy} from '../assets/studio-evidence.mjs';
import {unfinishedResult} from '../assets/studio-result-state.mjs';
import {createProgressClock,formatElapsed} from '../assets/studio-progress.mjs';

const product={productName:'[26FW최신상] 블루핏 헨리넥 스트라이프 니트 3종',brand:'블루핏',salePrice:79000,quantity:3};
const row={main:'일상에 더한 여유',sub:'헨리넥과 스트라이프의 만남',cta:'상품 자세히 보기',concept:'착장 사진을 중심으로 구성',fact:-1};

test('실제 API: 한 시안의 상품 종류 누락을 추가 호출 없이 보완한다',async()=>{
 const previous=globalThis.fetch;let calls=0,result,status;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({output_text:JSON.stringify({copies:Array.from({length:6},()=>({...row}))})});};
  await studioCopy({body:{product,layouts:Array(6).fill('header'),plans:[{copyMode:'basic'},...Array.from({length:5},()=>({}))],autoPlan:true}},
   {status(n){status=n;return this},json(value){result=value}},'test-only');
  assert.equal(status,200,JSON.stringify(result));assert.equal(calls,1);assert.equal(result.copies.length,6);
  assert.equal(result.copies[0].main,'블루핏 헨리넥 스트라이프 니트 3종');
  assert.equal(result.copies[1].main,row.main);assert.equal(result.copies[1].sub,'니트 · '+row.sub);
 }finally{globalThis.fetch=previous;}
});

test('실제 API: 누락 보완으로 미확인 가격·혜택 검증을 우회하지 못한다',async()=>{
 const previous=globalThis.fetch;
 try{
  for(const sub of ['단돈 999원','무료배송','최대 90% 할인']){
   let status,calls=0;
   globalThis.fetch=async()=>{calls++;return Response.json({output_text:JSON.stringify({copies:[{...row,sub}]})});};
   await studioCopy({body:{product,layouts:['header'],plans:[{}]}},{status(n){status=n;return this},json(){}},'test-only');
   assert.equal(status,502,sub);assert.equal(calls,2);
  }
 }finally{globalThis.fetch=previous;}
});

test('후기 원문과 이미 유효한 문구는 유지하고 업종의 실제 명칭만 보완한다',()=>{
 const review=restoreProductKind(row,{strategyId:'review'},product);
 assert.equal(review.sub,row.sub);assert.match(review.main,/니트/);
 const valid={...row,main:'스트라이프 니트의 여유'};
 assert.equal(restoreProductKind(valid,{},product),valid);
 assert.equal(restoreProductKind(row,{}, {productName:'한국 감성 의류'}),row);
 for(const noun of ['갈비','로션','선크림','이어폰']){
  const p={productName:'브랜드 '+noun};
  assert.match(restoreProductKind(row,{},p).sub,new RegExp('^'+noun));
 }
 assert.throws(()=>validatePlannedCopy(row,{},product),/상품 종류/,'the strict validator remains strict');
});

test('카피 중단·이미지 대기·검수 상태를 구분하고 오류 문구를 이스케이프한다',()=>{
 assert.match(unfinishedResult({imageReady:false,copyFailed:true}),/카피 확인에서 중단됨/);
 assert.doesNotMatch(unfinishedResult({imageReady:false,copyFailed:true}),/생성 준비 중/);
 for(const autoStatus of ['카피 기획 중','이미지 생성 대기','상품·문구 확인 중'])assert.ok(unfinishedResult({imageReady:false,autoStatus}).includes(autoStatus));
 assert.match(unfinishedResult({imageReady:false,imageFailed:true,imageError:'<script>'}),/&lt;script&gt;/);
 assert.equal(unfinishedResult({imageReady:true}),'');
});

test('경과 시간은 단계 변경·백그라운드 지연·중단·재시작을 정확히 반영한다',()=>{
 let now=1000;const clock=createProgressClock(()=>now);
 assert.equal(clock.read().started,false);clock.start();clock.stage('사진 분석');now+=65000;
 assert.equal(formatElapsed(clock.read().total),'01:05');clock.stage('카피 기획');now+=10000;
 assert.equal(clock.read().total,75000);assert.equal(clock.read().stage,10000);
 clock.stop();now+=120000;assert.equal(clock.read().total,75000);assert.equal(clock.read().running,false);
 clock.stage('오류 표시');assert.equal(clock.read().stage,10000);
 clock.start();assert.equal(clock.read().total,0);assert.equal(clock.read().running,true);
});
