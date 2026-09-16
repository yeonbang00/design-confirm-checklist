import assert from 'node:assert/strict';
import {retailerAudience,RETAILER_AUDIENCE_VERSION} from '../assets/studio-retailer-audience.mjs';
import {createV3Plan,matchPlanReferences} from '../assets/studio-v3-plan.mjs';
import {generationRequest,completeBannerPrompt} from '../assets/studio-generation-contract.mjs';
import {foodVerificationRequest} from '../assets/studio-food-policy.mjs';
import {recentDesigns,rememberProductionPlan} from '../assets/studio-art-direction.mjs';
import {normalizePhotoRegions} from '../assets/studio-photo-regions.mjs';
import {applyPhotoClassification} from '../assets/studio-photo-analysis.mjs';
import photoHandler from '../api/productPhotos.js';
const product={sourceUrl:'https://www.shinsegaetvshopping.com/display/detail/123',category:'fashion-top',productName:'블루핏 헨리넥 스트라이프 니트 3종',brand:'블루핏',quantity:3,salePrice:79000,
 visualTone:{moods:['serene','premium'],energy:'quiet',palette:'warm-neutral'},photos:[
 {role:'main',personKind:'body',colorway:'blue',pose:'standing'},
 {role:'model',personKind:'body',colorway:'red',pose:'sitting'},
 {role:'model',personKind:'body',colorway:'cream',pose:'walking'},
 {role:'product',personKind:'none',colorway:'blue'},
 {role:'product',personKind:'none',colorway:'red'},
 {role:'product',personKind:'none',colorway:'cream'}
 ].map((p,i)=>({...p,url:'https://garment.test/'+i,matchesTarget:true,assetKind:'product',garmentComplete:true,shotDistance:'medium',w:1000,h:1000}))};
assert.equal(retailerAudience(product).id,RETAILER_AUDIENCE_VERSION);
for(const change of [{sourceUrl:'https://shinsegaetvshopping.com.evil.test/item'},{sourceUrl:'https://other.test/item'},{sourceUrl:''},{category:'food'},{category:'fashion-shoes'},{productName:'남성 니트'},{productName:'키즈 티셔츠'},{productName:"Men's shirt"}])assert.equal(retailerAudience({...product,...change}),null);
let state=9;const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
for(let i=0;i<200;i++){
 const plans=createV3Plan(product,{random});assert.equal(plans.length,6);
 const adapted=plans.filter(p=>p.modelAdaptation);assert.equal(adapted.length,1);
 assert.equal(adapted[0].sourceMode,'model-adaptation');assert.equal(adapted[0].keep,'product');
 assert.ok(plans.some(p=>p.recipe==='R04'&&p.photoSet.length===2&&p.sourceMode==='preserve'),'original poses have priority');
 assert.ok(plans.some(p=>p.recipe==='R05'&&p.photoSet.length===3),'real colour options retained');
 assert.equal(plans[0].copyMode,'basic');
 assert.ok(plans.filter(p=>p.sourceMode==='preserve').length>=3);
}
for(const update of [{garmentComplete:false},{garmentComplete:undefined},{shotDistance:'close'}]){
 const plans=createV3Plan({...product,photos:product.photos.map(p=>({...p,...update}))},{random});
 assert.ok(!plans.some(p=>p.modelAdaptation),'insufficient garment evidence must not trigger recasting');
}
assert.ok(!createV3Plan({...product,sourceUrl:'https://other.test/product'},{random}).some(p=>p.modelAdaptation));
const plans=createV3Plan(product,{random}),plan=plans.find(p=>p.modelAdaptation);
const request=await generationRequest(plan,product,{main:'블루핏 스트라이프 니트',sub:'헨리넥 디자인',cta:'착장 보기'},async p=>({imageUrl:p.url}));
const prompt=completeBannerPrompt(request);
assert.equal(request.modelAdaptation.id,RETAILER_AUDIENCE_VERSION);
assert.match(prompt,/NEW fictional Korean female fashion model in her 30s–40s/);
assert.match(prompt,/Do not age or morph the source face/);
assert.match(prompt,/Keep the exact garment silhouette/);
assert.doesNotMatch(prompt,/retain each selected pose/);
assert.equal((await generationRequest(plans[0],product,{},async p=>({imageUrl:p.url}))).modelAdaptation,null);
const region=normalizePhotoRegions([{box:[0,0,1,1],complete:true,overlayText:false,role:'model',personKind:'body',garmentComplete:true}])[0];
const classified={};applyPhotoClassification(classified,region);assert.equal(classified.garmentComplete,true);
// History records the real produced combination and reference; legacy ids still work.
let stored='[]';const storage={getItem(){return stored},setItem(k,v){stored=v}};
rememberProductionPlan(product,{designId:'food/meal/table',combinationKey:'combo/food/meal/table/a',reference:{thumbUrl:'https://ref.test/a'}},storage);
assert.deepEqual(recentDesigns(product,storage),['food/meal/table','combo/food/meal/table/a','ref/https://ref.test/a']);
rememberProductionPlan(product,{designId:'R31'},storage);assert.equal(recentDesigns(product,storage)[0],'R31');
const refs=['a','b'].map(id=>({thumbUrl:'https://ref.test/'+id,type:plan.type,axes:plan.targetAxes}));
assert.equal(matchPlanReferences([plan],refs,product,{recent:['ref/https://ref.test/a']})[0].reference.thumbUrl,'https://ref.test/b');
// Run the actual handler; only transport is mocked. No paid image or vision call.
const before=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY;let sent,response={matches:false,reason:'단추와 줄무늬 변경'};
try{
 process.env.OPENAI_API_KEY='test-only';
 globalThis.fetch=async(url,options={})=>{
  if(String(url).startsWith('https://garment.test/'))return new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/jpeg'}});
  if(String(url).includes('/responses')){sent=JSON.parse(options.body);return Response.json({output_text:JSON.stringify(response)});}
  throw Error('Unexpected network '+url);
 };
 let output,code;const res={status(n){code=n;return this},json(v){output=v;return this}};
 const body={...foodVerificationRequest(request,'https://garment.test/result'),category:'fashion-model-adaptation'};
 for(const matches of [false,true,undefined]){
  response={matches};await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body},res);
  assert.equal(code,200);assert.equal(output.matches,matches===true);
  assert.match(JSON.stringify(sent),/Intentional model replacement is allowed/);
  assert.match(JSON.stringify(sent),/pattern spacing/);
 }
 response={category:'fashion-top',photos:[{index:0,role:'model',personKind:'body',matchesTarget:true,garmentComplete:true,regions:[{box:[0,0,1,1],complete:true,overlayText:false,role:'model',personKind:'body',garmentComplete:true}]}]};
 await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:{urls:['https://garment.test/0'],productName:product.productName}},res);
 assert.equal(code,200);assert.equal(output.photos[0].garmentComplete,true);assert.equal(output.photos[0].regions[0].garmentComplete,true);
}finally{globalThis.fetch=before;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
console.log('PASS: 200 retailer plans preserve source poses/colours with one eligible 30s–40s Korean model adaptation; excluded stores/categories/incomplete clothes, actual handler garment checks, history/reference selection; no paid calls');
