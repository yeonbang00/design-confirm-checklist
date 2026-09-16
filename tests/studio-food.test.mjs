import assert from 'node:assert/strict';
import {createV3Plan} from '../assets/studio-v3-plan.mjs';
import {sourceBank} from '../assets/studio-source-selection.mjs';
import {generationRequest,completeBannerPrompt} from '../assets/studio-generation-contract.mjs';
import {foodVerificationRequest,protectFoodLabel,foodContract,foodIdentityPrompt} from '../assets/studio-food-policy.mjs';
import {applyPhotoClassification} from '../assets/studio-photo-analysis.mjs';
import {normalizePhotoRegions,preserveMainFoodPhoto,extractPhotoRegions} from '../assets/studio-photo-regions.mjs';
import {validatePlannedCopy,validateStrategyEvidence} from '../assets/studio-evidence.mjs';
import {unverifiedClaims} from '../assets/studio-text-check.mjs';
import photoHandler from '../api/productPhotos.js';
import {studioCopy} from '../api/_studioCopy.js';
const img=(url,extra)=>({url:'https://food.test/'+url,matchesTarget:true,personKind:'none',assetKind:'product',role:'detail',plainBg:false,w:1000,h:1000,...extra});
const product={category:'food',productName:'조선호텔 양념 LA갈비 400g X 8팩',brand:'조선호텔',salePrice:129900,
 visualTone:{moods:['warm','premium'],energy:'quiet',palette:'earth'},facts:[{id:'f1',text:'400g 개별 트레이',kind:'spec',source:'https://food.test/item'}],photos:[
 img('hero',{role:'main',provenance:'main',foodState:'cooked',foodUse:'served',actualPreparedMeal:true,shotDistance:'close'}),
 img('table',{foodState:'cooked',foodUse:'served',actualPreparedMeal:true}),
 img('package',{foodState:'packaged',foodUse:'package',packageVisible:true,plainBg:true}),
 img('instructions',{foodState:'cooked',actualPreparedMeal:true,foodUse:'info'}),
 img('pour',{foodState:'raw',foodUse:'process'}),
 img('unconfirmed',{foodState:'cooked',actualPreparedMeal:false}),
 img('unknown',{})]};
assert.deepEqual(sourceBank(product).map(x=>x.i),[0,1,2]);
let state=3;const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
const combinations=new Set(),allPlans=[],strategySets=new Set();
let common=null;
for(let i=0;i<1000;i++){
 const plans=createV3Plan(product,{random});assert.equal(plans.length,6);assert.equal(new Set(plans.map(p=>p.recipe)).size,6);
 assert.ok(plans.every(p=>p.photoSet[0]<2));
 assert.ok(plans.every(p=>p.photoSet.every(n=>n<3)));assert.ok(!plans.some(p=>p.type==='benefit'));
 assert.ok(plans.filter(p=>p.copyMode==='basic').length<=1);
 for(const p of plans){
  assert.ok(plans.filter(q=>q.strategyId===p.strategyId).length<=2);
  assert.ok(plans.filter(q=>q.presentationId===p.presentationId).length<=2);
  assert.equal(p.foodPolicy.allowAccompaniments,p.presentationId==='table');
 }
 const recipes=new Set(plans.map(p=>p.recipe));common=common===null?recipes:new Set([...common].filter(r=>recipes.has(r)));
 combinations.add(plans.map(p=>p.recipe).sort().join('/'));
 strategySets.add([...new Set(plans.map(p=>p.strategyId))].sort().join('/'));
 allPlans.push(...plans);
}
assert.ok(combinations.size>100);assert.ok(strategySets.size>1);assert.equal(common.size,0,'no fixed strategy/presentation combination');
assert.ok(allPlans.some(p=>p.presentationId==='table'));assert.ok(allPlans.some(p=>p.presentationId==='package'));
state=7;const first=createV3Plan(product,{random});state=7;
const repeated=createV3Plan(product,{random,recent:first.flatMap(p=>[p.designId,p.combinationKey])});
assert.ok(repeated.filter(p=>first.some(q=>q.designId===p.designId)).length<3,'recent combinations penalized before rendering');
for(const photos of [[product.photos[0]],[product.photos[2]],[img('raw',{foodState:'raw',foodUse:'raw'})]]){
 const plans=createV3Plan({...product,photos,facts:[]},{random});assert.equal(plans.length,6);
 assert.ok(plans.every(p=>p.photoSet.every(i=>i===0)));
 if(photos[0].foodState!=='cooked')assert.ok(!plans.some(p=>p.presentationId==='table'));
 if(photos[0].foodState==='packaged')assert.ok(plans.every(p=>p.scene.includes('package-only')));
}
assert.equal(createV3Plan({...product,photos:[product.photos[3],product.photos[4],product.photos[5]]}).length,0);
const offers=[{verified:true,text:'첫 구매 10% 할인',quote:'첫 구매 10% 할인',source:'https://food.test/item'}];
const offerPlans=Array.from({length:80},()=>createV3Plan({...product,offers},{random})).flat();
assert.ok(offerPlans.some(p=>p.strategyId==='benefit'));
assert.ok(!Array.from({length:80},()=>createV3Plan({...product,offers:[{...offers[0],text:'삼성카드 10% 할인'}]},{random})).flat().some(p=>p.strategyId==='benefit'));
const plans=createV3Plan(product,{random});
const pairing=allPlans.find(p=>p.presentationId==='package');
const request=await generationRequest(pairing,product,{main:'조선호텔 LA갈비',sub:'식탁의 중심',cta:'상품 보기'},async p=>p.url.endsWith('package')?{imageUrl:p.url}:{base64:'Y3JvcA==',mediaType:'image/jpeg'});
assert.equal(request.references[0].imageUrl,product.photos[2].url);assert.equal(request.foodPolicy.packageAllowed,true);
const prompt=completeBannerPrompt(request);assert.match(prompt,/Never synthesize cooking, sauce pouring/);assert.match(prompt,/Never turn a tray into a bag/);
const onlyDish=await generationRequest(allPlans.find(p=>p.photoSet.length===1),product,{},async p=>({imageUrl:p.url}));
assert.equal(onlyDish.foodPolicy.packageAllowed,false);assert.match(completeBannerPrompt(onlyDish),/No physical packaging was supplied/);
await assert.rejects(generationRequest({...pairing,photoSet:[3]},product,{},async p=>({imageUrl:p.url})),/조리 과정/);
const verification=foodVerificationRequest(request,'https://food.test/result');
assert.equal(verification.sourceUrls[0],'data:image/jpeg;base64,Y3JvcA==');assert.equal(verification.sourceUrls[1],product.photos[2].url);
assert.equal(protectFoodLabel('food',product.photos[2]),true);assert.equal(protectFoodLabel('food',product.photos[0]),false);
const region=normalizePhotoRegions([{box:[0,0,1,1],complete:true,overlayText:false,role:'detail',personKind:'none',foodState:'cooked',foodUse:'served',actualPreparedMeal:true,packageVisible:false}])[0];
const applied={};applyPhotoClassification(applied,region);assert.equal(applied.foodUse,'served');assert.equal(applied.actualPreparedMeal,true);
assert.throws(()=>validatePlannedCopy({main:'맛의 깊이',sub:'풍미의 차이'},plans[1],product),/상품 종류/);
assert.deepEqual(unverifiedClaims('13% 24% 2% 6%',['129,900원']),['13%','24%','2%','6%'],'do not bypass existing number checks');
const styled=allPlans.find(p=>p.presentationId==='table');
const styledRequest=await generationRequest(styled,product,{},async p=>({imageUrl:p.url}));
assert.equal(styledRequest.foodPolicy.allowAccompaniments,true);
assert.match(completeBannerPrompt(styledRequest),/STYLING FOOD PERMITTED/);
assert.match(foodIdentityPrompt(styledRequest.sourceDescriptions,styledRequest.foodPolicy),/STYLING FOOD PERMITTED/);
assert.equal(foodContract([product.photos[2]],{allowAccompaniments:true}).allowAccompaniments,false);
const fact={id:'review1',kind:'review',text:'갈비가 부드러워서 맛있게 먹었어요.',source:'https://food.test/item/reviews'};
const reviewPlans=Array.from({length:80},()=>createV3Plan({...product,facts:[fact]},{random})).flat().filter(p=>p.strategyId==='review');
assert.ok(reviewPlans.length);assert.ok(reviewPlans.every(p=>p.evidenceIds.includes(fact.id)));
assert.ok(!Array.from({length:40},()=>createV3Plan({...product,facts:[{...fact,source:''}]},{random})).flat().some(p=>p.strategyId==='review'));
assert.throws(()=>validateStrategyEvidence({fact:0,sub:'새로 쓴 찬사'},reviewPlans[0],[fact]),/원문/);
assert.throws(()=>validateStrategyEvidence({fact:-1,sub:fact.text},reviewPlans[0],[fact]),/근거/);
assert.deepEqual(validateStrategyEvidence({fact:0,sub:fact.text},reviewPlans[0],[fact]),{fact:0,sub:fact.text});
// Regression: the LA-rib page has a mixed main dish/package, another plated
// hero, a bite over rice, package crop and recipe panels. State alone cannot
// assign the bite to a primary or satisfy a package strategy.
const foodPage={...product,photos:[
 img('main-round-plate',{provenance:'main',foodState:'cooked',actualPreparedMeal:true,foodVisualRole:'hero',packageVisible:true}),
 img('rectangular-plate',{foodState:'cooked',actualPreparedMeal:true,foodVisualRole:'hero'}),
 img('bite-over-rice',{foodState:'cooked',actualPreparedMeal:true,foodVisualRole:'support',personKind:'hands',shotDistance:'close'}),
 img('tray',{foodState:'packaged',foodVisualRole:'package',packageVisible:true}),
 img('recipe',{foodState:'cooked',actualPreparedMeal:true,foodUse:'info',foodVisualRole:'info'})]};
let packCard;
for(let n=0;n<200;n++){
 const six=createV3Plan(foodPage,{random});
 assert.equal(six.length,6);
 assert.ok(six.filter(p=>p.photo===0).length>=3,'preserve useful main image priority across different strategies');
 assert.ok(six.every(p=>p.photo<2),'bite is not a primary even for close-up');
 for(const p of six.filter(p=>p.strategyId==='pack'||p.presentationId==='package')){
  assert.ok(p.photoSet.includes(3),'explicit package source regardless of visual layout');
  assert.equal(p.foodPolicy.requiresPackage,true);
  if(p.strategyId==='pack'&&p.presentationId==='card')packCard=p;
 }
}
assert.ok(packCard,'pack strategy is allowed with information-card presentation');
const packRequest=await generationRequest(packCard,foodPage,{},async p=>({imageUrl:p.url}));
assert.equal(packRequest.foodPolicy.requiresPackage,true);
assert.match(foodIdentityPrompt(packRequest.sourceDescriptions,packRequest.foodPolicy),/Reject an output missing the supplied package/);
assert.match(completeBannerPrompt(packRequest),/FIRST attachment is the primary/);
assert.equal(packRequest.sourceDescriptions[0].foodVisualRole,'hero');
let reads=0;const read=async p=>{reads++;return {imageUrl:p.url}};
await assert.rejects(generationRequest({...packCard,photoSet:[2,3]},foodPage,{},read),/대표 음식/);
await assert.rejects(generationRequest({...packCard,photoSet:[1]},foodPage,{},read),/포장 사진/);
assert.equal(reads,0,'reject invalid source assignment before any image fetch/generation');
assert.equal(createV3Plan({...foodPage,photos:[foodPage.photos[2]]}).length,0,'support-only page cannot invent a hero');
assert.equal(preserveMainFoodPhoto(foodPage.photos[0]),true);
assert.equal(preserveMainFoodPhoto({...foodPage.photos[0],detailTile:true}),false);
assert.equal(preserveMainFoodPhoto({...foodPage.photos[0],foodVisualRole:'support'}),false);
const supportRegion=normalizePhotoRegions([{box:[0,0,1,1],complete:true,overlayText:false,role:'detail',foodState:'cooked',actualPreparedMeal:true,foodVisualRole:'support'}])[0];
applyPhotoClassification(applied,supportRegion);assert.equal(applied.foodVisualRole,'support');
// Exercise the actual extraction path: a package crop augments, not replaces,
// the full main dish. Mock only browser image/canvas I/O (no network or model).
const previousImage=globalThis.Image,previousDocument=globalThis.document;
try{
 globalThis.Image=class{naturalWidth=1000;naturalHeight=1000;set src(value){queueMicrotask(()=>this.onload());}};
 globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,Y3JvcA=='})};
 const main={...foodPage.photos[0],cleanBase64:'bWFpbg==',cleanType:'image/jpeg',regions:normalizePhotoRegions([{box:[0,0,.4,.4],role:'packshot',complete:true,overlayText:false,foodState:'packaged',foodVisualRole:'package',packageVisible:true}])};
 const cropped=await extractPhotoRegions([main],()=>{throw Error('Unexpected request')});
 assert.equal(cropped.photos.length,2);assert.equal(cropped.photos[0],main);
 assert.equal(cropped.photos[1].foodVisualRole,'package');assert.equal(cropped.extracted,1);
}finally{globalThis.Image=previousImage;globalThis.document=previousDocument;}
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
 response={category:'food',photos:[{index:0,role:'main',matchesTarget:true,foodState:'cooked',foodUse:'served',actualPreparedMeal:true,foodVisualRole:'hero',packageVisible:true,regions:[{box:[0,0,1,1],complete:true,overlayText:false,role:'detail',personKind:'none',foodState:'raw',foodUse:'process',packageVisible:false}]}]};
 await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:{urls:['https://food.test/hero'],productName:product.productName}},res);
 assert.equal(code,200);assert.equal(output.photos[0].foodVisualRole,'hero');assert.equal(output.photos[0].foodUse,'served');assert.equal(output.photos[0].packageVisible,true);assert.equal(output.photos[0].regions[0].foodUse,'process','server must preserve process exclusion on extracted regions');
 const row={main:'조선호텔 LA갈비',sub:'지어낸 후기',cta:'상품 보기',eyebrow:'구매 후기',concept:'실제 구매 후기 인용',fact:0};
 const copyReq={body:{product,layouts:['header'],plans:[reviewPlans[0]],facts:[fact],autoPlan:true}};
 response={copies:[row]};await studioCopy(copyReq,res,'test-only');assert.equal(code,502,'invented review blocked by actual copy handler');
 response={copies:[{...row,sub:fact.text}]};await studioCopy(copyReq,res,'test-only');
 assert.equal(code,200,JSON.stringify(output));assert.equal(output.copies[0].sub,fact.text);assert.deepEqual(output.copies[0].evidenceIds,[fact.id]);
 assert.match(JSON.stringify(sent),/필수근거/);
}finally{globalThis.fetch=before;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
console.log(`PASS: ${combinations.size} distinct food combinations / ${strategySets.size} strategy sets in 1000 plans; no fixed composition`);
console.log('PASS: food source reuse, safe sparse plans, conditional offers/packages, real source routing/classification and identity gate; no paid calls');
