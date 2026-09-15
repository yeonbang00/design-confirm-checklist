import assert from 'node:assert/strict';
import {createV3Plan} from '../assets/studio-v3-plan.mjs';
import {sourceBank} from '../assets/studio-source-selection.mjs';
import {generationRequest,completeBannerPrompt} from '../assets/studio-generation-contract.mjs';
import {foodVerificationRequest,protectFoodLabel} from '../assets/studio-food-policy.mjs';
import {applyPhotoClassification} from '../assets/studio-photo-analysis.mjs';
import {normalizePhotoRegions} from '../assets/studio-photo-regions.mjs';
import {validatePlannedCopy} from '../assets/studio-evidence.mjs';
import {unverifiedClaims} from '../assets/studio-text-check.mjs';
import photoHandler from '../api/productPhotos.js';
const img=(url,extra)=>({url:'https://food.test/'+url,matchesTarget:true,personKind:'none',assetKind:'product',role:'detail',plainBg:false,w:1000,h:1000,...extra});
const product={category:'food',productName:'조선호텔 양념 LA갈비 400g X 8팩',brand:'조선호텔',salePrice:129900,
 visualTone:{moods:['warm','premium'],energy:'quiet',palette:'earth'},facts:[{id:'f1',text:'400g 개별 트레이',kind:'spec'}],photos:[
 img('hero',{role:'main',provenance:'main',foodState:'cooked',foodUse:'served',actualPreparedMeal:true,shotDistance:'close'}),
 img('table',{foodState:'cooked',foodUse:'served',actualPreparedMeal:true}),
 img('package',{foodState:'packaged',foodUse:'package',packageVisible:true,plainBg:true}),
 img('instructions',{foodState:'cooked',actualPreparedMeal:true,foodUse:'info'}),
 img('pour',{foodState:'raw',foodUse:'process'}),
 img('unconfirmed',{foodState:'cooked',actualPreparedMeal:false}),
 img('unknown',{})]};
assert.deepEqual(sourceBank(product).map(x=>x.i),[0,1,2]);
let state=3;const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
const combinations=new Set();
for(let i=0;i<200;i++){
 const plans=createV3Plan(product,{random});assert.equal(plans.length,6);assert.equal(new Set(plans.map(p=>p.recipe)).size,6);
 assert.equal(plans[0].copyMode,'basic');assert.ok(plans.some(p=>p.recipe==='F02'));assert.ok(plans.some(p=>p.recipe==='F03'));
 assert.ok(plans.some(p=>p.recipe==='F04'&&p.photoSet.includes(2)));
 assert.ok(plans.some(p=>p.designFamily==='graphic'));assert.ok(plans.every(p=>p.photoSet[0]<2));
 assert.ok(plans.every(p=>p.photoSet.every(n=>n<3)));assert.ok(!plans.some(p=>p.type==='benefit'));
 assert.equal(new Set(plans.flatMap(p=>p.photoSet)).size,3,'reuse the three viable photos instead of recipes/process panels');
 combinations.add(plans.map(p=>p.recipe).join('/'));
}
assert.ok(combinations.size>1);
for(const photos of [[product.photos[0]],[product.photos[2]],[img('raw',{foodState:'raw',foodUse:'raw'})]]){
 const plans=createV3Plan({...product,photos,facts:[]},{random});assert.equal(plans.length,6);
 assert.ok(plans.every(p=>p.photoSet.every(i=>i===0)));
 if(photos[0].foodState!=='cooked')assert.ok(!plans.some(p=>p.recipe==='F02'));
 if(photos[0].foodState==='packaged')assert.ok(plans.every(p=>p.scene.includes('package-only')));
}
assert.equal(createV3Plan({...product,photos:[product.photos[3],product.photos[4],product.photos[5]]}).length,0);
const offers=[{verified:true,text:'첫 구매 10% 할인',quote:'첫 구매 10% 할인',source:'https://food.test/item'}];
assert.ok(createV3Plan({...product,offers},{random}).some(p=>p.recipe==='F06'));
assert.ok(!createV3Plan({...product,offers:[{...offers[0],text:'삼성카드 10% 할인'}]},{random}).some(p=>p.recipe==='F06'));
const plans=createV3Plan(product,{random});
const pairing=plans.find(p=>p.recipe==='F04');
const request=await generationRequest(pairing,product,{main:'조선호텔 LA갈비',sub:'식탁의 중심',cta:'상품 보기'},async p=>p.url.endsWith('package')?{imageUrl:p.url}:{base64:'Y3JvcA==',mediaType:'image/jpeg'});
assert.equal(request.references[0].imageUrl,product.photos[2].url);assert.equal(request.foodPolicy.packageAllowed,true);
const prompt=completeBannerPrompt(request);assert.match(prompt,/Never synthesize cooking, sauce pouring/);assert.match(prompt,/Never turn a tray into a bag/);
const onlyDish=await generationRequest(plans[0],product,{},async p=>({imageUrl:p.url}));
assert.equal(onlyDish.foodPolicy.packageAllowed,false);assert.match(completeBannerPrompt(onlyDish),/No physical packaging was supplied/);
await assert.rejects(generationRequest({...pairing,photoSet:[3]},product,{},async p=>({imageUrl:p.url})),/조리 과정/);
const verification=foodVerificationRequest(request,'https://food.test/result');
assert.equal(verification.sourceUrls[0],'data:image/jpeg;base64,Y3JvcA==');assert.equal(verification.sourceUrls[1],product.photos[2].url);
assert.equal(protectFoodLabel('food',product.photos[2]),true);assert.equal(protectFoodLabel('food',product.photos[0]),false);
const region=normalizePhotoRegions([{box:[0,0,1,1],complete:true,overlayText:false,role:'detail',personKind:'none',foodState:'cooked',foodUse:'served',actualPreparedMeal:true,packageVisible:false}])[0];
const applied={};applyPhotoClassification(applied,region);assert.equal(applied.foodUse,'served');assert.equal(applied.actualPreparedMeal,true);
assert.throws(()=>validatePlannedCopy({main:'맛의 깊이',sub:'풍미의 차이'},plans[1],product),/상품 종류/);
assert.deepEqual(unverifiedClaims('13% 24% 2% 6%',['129,900원']),['13%','24%','2%','6%'],'do not bypass existing number checks');
// Mock only transport: real server imports, source fetches and food verification.
const before=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY;let response={matches:false,reason:'트레이가 봉지로 바뀜'},sent;
try{
 process.env.OPENAI_API_KEY='test-only';
 globalThis.fetch=async(url,options={})=>{
  if(String(url).startsWith('https://food.test/'))return new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/jpeg'}});
  if(String(url).includes('/responses')){sent=JSON.parse(options.body);return Response.json({output_text:JSON.stringify(response)});}
  throw Error('Unexpected network '+url);
 };
 let output,code;const res={status(n){code=n;return this},json(v){output=v;return this}};
 await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:verification},res);
 assert.equal(code,200);assert.equal(output.matches,false);assert.match(JSON.stringify(sent),/LAST image/);assert.match(JSON.stringify(sent),/raw-to-cooked/);
 for(const matches of [true,undefined]){response={matches};await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:verification},res);assert.equal(output.matches,matches===true);}
 response={category:'food',photos:[{index:0,role:'main',matchesTarget:true,foodState:'cooked',foodUse:'served',actualPreparedMeal:true,packageVisible:true,regions:[{box:[0,0,1,1],complete:true,overlayText:false,role:'detail',personKind:'none',foodState:'raw',foodUse:'process',packageVisible:false}]}]};
 await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:{urls:['https://food.test/hero'],productName:product.productName}},res);
 assert.equal(code,200);assert.equal(output.photos[0].foodUse,'served');assert.equal(output.photos[0].packageVisible,true);assert.equal(output.photos[0].regions[0].foodUse,'process','server must preserve process exclusion on extracted regions');
}finally{globalThis.fetch=before;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
console.log('PASS: food source reuse, safe sparse plans, conditional offers/packages, real source routing/classification and identity gate; no paid calls');
