import assert from 'node:assert/strict';
import {createV3Plan,matchPlanReferences} from '../assets/studio-v3-plan.mjs';
import {sourceBank,sourceKey,isObject} from '../assets/studio-source-selection.mjs';
import {basicCopy,visualTone,normalizeReferenceStudy,visualInstructions,VISUAL_CONTRACT_VERSION} from '../assets/studio-visual-contract.mjs';
import {generationRequest,completeBannerPrompt} from '../assets/studio-generation-contract.mjs';
import {studyReferences} from '../assets/studio-reference-study.mjs';
import {completeCopy,validatePlannedCopy} from '../assets/studio-evidence.mjs';
import {renderedTypographyIssues} from '../assets/studio-text-check.mjs';
import photoHandler from '../api/productPhotos.js';
import {applyPhotoClassification,selectClassificationPhotos} from '../assets/studio-photo-analysis.mjs';
import {regionExtractionQuotas} from '../assets/studio-photo-regions.mjs';
import imageHandler from '../api/bannerImage.js';
import {studioCopy} from '../api/_studioCopy.js';

const photo=(id,extra={})=>({url:'https://sources.test/'+id,role:'model',personKind:'body',matchesTarget:true,assetKind:'lifestyle',plainBg:false,w:1200,h:2000,provenance:'detail',...extra});
const offer=text=>({id:text,text,quote:text,source:'https://sources.test/item',verified:true});
const fashion={productName:'[26FW최신상] 블루핏 헨리넥 스트라이프 니트 3종',brand:'블루핏',salePrice:79000,quantity:3,category:'fashion-top',
 visualTone:{moods:['serene','premium'],energy:'quiet',description:'차분한 일상 착장, 자연광'},offers:[offer('무료배송'),offer('삼성카드 5% 할인')],facts:[{id:'texture',text:'골지 조직',source:'상품 설명'}],photos:[
 photo('blue-front',{role:'main',provenance:'main',colorway:'블루',pose:'정면 서기'}),
 photo('ivory-side',{colorway:'아이보리',pose:'걷는 측면',shotAngle:'side'}),
 photo('black-seated',{colorway:'블랙',pose:'의자에 앉음'}),
 photo('blue-car',{colorway:'블루',pose:'차에 기대 앉음',shotAngle:'three-quarter'}),
 ...['블루','아이보리','블랙'].map((colorway,i)=>photo('pack'+i,{role:'packshot',personKind:'none',assetKind:'product',plainBg:true,colorway})),
 photo('knit-close',{role:'detail',personKind:'none',assetKind:'detail',shotDistance:'close',sourceRegion:[0,0,1,.5]})]};
let seed=20;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let n=0;n<200;n++){
 const plans=createV3Plan(fashion,{random});assert.equal(plans.length,6);
 assert.equal(plans[0].copyMode,'basic');assert.equal(plans.filter(p=>p.copyMode==='basic').length,1);
 assert.ok(plans.some(p=>p.recipe==='R04'));assert.ok(plans.some(p=>p.recipe==='R05'));
 assert.ok(plans.some(p=>p.designFamily==='graphic'),'do not collapse into six plain photos');
 assert.ok(!plans.some(p=>p.type==='benefit'),'shipping alone never forces a coupon campaign');
 assert.ok(!plans.some(p=>p.recipe==='R19'),'quiet brand never gets a claw machine');
 const selected=plans.flatMap(p=>p.photoSet),uses=selected.filter(i=>i===0).length;
 assert.ok(new Set(selected).size>=6,'rich sources must actually reach the six plans');
 assert.ok(uses<=2,'main pose must not appear everywhere');
 for(const plan of plans)if(['R06','R07','R10','R13','R16','R17','R18','R19','R23'].includes(plan.recipe))assert.ok(plan.photoSet.every(i=>isObject(fashion.photos[i])));
}
assert.equal(isObject(fashion.photos.at(-1)),false,'fabric close-up is not a whole garment for chair/hanger scenes');
assert.ok(sourceBank({photos:[photo('tall',{h:2800})]}).length,'clean full-body photographs must not be rejected by aspect ratio');
assert.equal(sourceBank({photos:[photo('a'),photo('a')]}).length,1);
assert.notEqual(sourceKey(photo('a',{sourceRegion:[0,0,.5,1]})),sourceKey(photo('a',{sourceRegion:[.5,0,.5,1]})));

const raw={category:'food',productName:'생고기 500g',salePrice:12000,photos:[photo('raw',{role:'main',personKind:'none',foodState:'raw',assetKind:'product'}),photo('cooked',{role:'packshot',personKind:'none',foodState:'cooked',actualPreparedMeal:true,assetKind:'product'})]};
assert.ok(sourceBank(raw).every(x=>x.p.foodState!=='cooked'));
assert.ok(createV3Plan(raw,{random}).every(p=>p.photoSet.every(i=>i!==1)));
assert.ok(sourceBank({...raw,productName:'불고기 밀키트'}).some(x=>x.p.actualPreparedMeal));
const beauty={category:'beauty',productName:'익스트림 로션 150ml 2개',salePrice:35000,photos:[photo('lotion',{role:'main',personKind:'none',plainBg:true,assetKind:'product'}),photo('texture',{role:'detail',personKind:'none',assetKind:'texture',sourceRegion:[0,0,1,1]}),photo('wrong',{matchesTarget:false,role:'packshot',personKind:'none'})]};
for(let i=0;i<50;i++){
 const plans=createV3Plan(beauty,{random});assert.equal(plans.length,6);assert.ok(plans.some(p=>p.recipe==='R11'&&p.photoSet.includes(1)));assert.ok(plans.every(p=>!p.photoSet.includes(2)));
}
for(const category of ['electronics','home','pet','service','other'])assert.equal(createV3Plan({...beauty,category},{random}).length,6);

const plans=createV3Plan(fashion,{random});
const refs=[{thumbUrl:'https://refs.test/bad',axes:{...plans[0].targetAxes,mood:'playful'}},{thumbUrl:'https://refs.test/good',fullUrl:'https://refs.test/full',axes:{...plans[0].targetAxes,mood:'serene'}}];
assert.equal(matchPlanReferences(plans,refs,fashion)[0].reference.thumbUrl,refs[1].thumbUrl);
assert.deepEqual(basicCopy(fashion).main,'블루핏 헨리넥 스트라이프 니트 3종');
assert.equal(completeCopy({main:'엉뚱한 카피'},plans[0],fashion).headline,basicCopy(fashion).main);
assert.equal(completeCopy(basicCopy(fashion),plans[0],fashion).brand,'');
assert.throws(()=>validatePlannedCopy({main:'무료배송',sub:'니트'},plans[1],fashion));
assert.throws(()=>validatePlannedCopy({main:'정돈된 하루',sub:'편안한 선택'},plans[1],fashion));
assert.deepEqual(visualTone(null).moods,['clean']);
assert.deepEqual(visualTone({moods:'invalid'}).moods,['clean']);
assert.equal(normalizeReferenceStudy({headline:null,moods:null}).headline.lines,2);
const detailPages=Array.from({length:16},(_,i)=>({url:'page'+i,regions:[{},{},{}]}));
const quotas=regionExtractionQuotas(detailPages);
assert.equal([...quotas.values()].reduce((a,b)=>a+b,0),24);
assert.ok(detailPages.every(p=>quotas.get(p)>=1),'last colour page must get a crop before earlier pages take three');
const manyPhotos=Array.from({length:40},(_,i)=>photo('page'+i));
assert.equal(selectClassificationPhotos(manyPhotos,24).length,24);
assert.equal(selectClassificationPhotos(manyPhotos,24).at(-1).url,manyPhotos.at(-1).url);

const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};let inspections=0;
const inspect=async(path,req)=>{inspections++;return {briefs:JSON.parse(req.body).entries.map(({url})=>({url,moods:['serene'],headline:{lines:2,size:.06,box:[.05,.05,.5,.2]},support:{lines:1,size:.03},cta:{present:false,shape:'text',size:.025},imageShare:.75}))}};
const matched=matchPlanReferences(plans,refs,fashion);
const studied=await studyReferences(matched,inspect,storage);await studyReferences(matched,inspect,storage);assert.equal(inspections,1,'unchanged reference observations reused without paid call');
await studyReferences(matched.map(p=>p.reference?({...p,reference:{...p.reference,axes:{...p.reference.axes,letter:'serif'}}}):p),inspect,storage);assert.equal(inspections,2,'retagging invalidates the observation key');
assert.equal(studied[0].designObservation.cta.present,false);
const payload=await generationRequest(studied[1],fashion,basicCopy(fashion),async p=>({imageUrl:p.url}));
assert.equal(payload.imageUrl,fashion.photos[studied[1].photoSet[0]].url);
assert.deepEqual(payload.references.map(r=>r.imageUrl),studied[1].photoSet.slice(1).map(i=>fashion.photos[i].url));
assert.equal(payload.styleReference.imageUrl,'https://refs.test/full');
const prompt=completeBannerPrompt(payload);assert.match(prompt,/LAST attached image is a DESIGN REFERENCE ONLY/);assert.match(prompt,/same size and weight/);assert.match(prompt,/coherent lighting/);assert.match(visualInstructions({sourceMode:'reference'}),/light direction/);assert.match(prompt,/Shipping is ONLY/);assert.doesNotMatch(prompt,/top 250 pixels|below y=900|Brand mark, small/);
assert.match(visualInstructions({visualTone:fashion.visualTone,sourceMode:'preserve'}),/retain each selected pose/);
assert.equal(normalizeReferenceStudy({cta:{present:false},headline:{size:99}}).headline.size,.22);
const check={boxes:[{text:'부드러운',x:10,y:10,w:100,h:60},{text:'니트의선택',x:10,y:100,w:100,h:25},{text:'골지조직',x:10,y:200,w:100,h:10}]};
assert.ok(renderedTypographyIssues(check,{headline:'부드러운 니트의선택',subline:'골지조직'}).length===2);

// Exercise the actual API handlers with real imports and intercepted transport.
// No real external endpoint or paid model is used by this test.
const fetchBefore=globalThis.fetch,keyBefore=process.env.OPENAI_API_KEY,blobBefore=process.env.BLOB_READ_WRITE_TOKEN;
let form,copyCalls=0,visionResponse=null;
try{
 process.env.OPENAI_API_KEY='test-only';process.env.BLOB_READ_WRITE_TOKEN='test-only';
 globalThis.fetch=async(url,init={})=>{
   const u=String(url);
   if(u.startsWith('https://sources.test/')||u.startsWith('https://refs.test/'))return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}});
   if(u.includes('/images/edits')){form=init.body;return Response.json({data:[{b64_json:'dGVzdA=='}]});}
   if(u.startsWith('https://blob.vercel-storage.com/'))return Response.json({url:'https://output.test/banner.png'});
   if(u.includes('/responses')){if(visionResponse)return Response.json({output_text:JSON.stringify(visionResponse)});copyCalls++;return Response.json({output_text:JSON.stringify({copies:[{main:'BAD',sub:'BAD',cta:'BAD',concept:'BAD',fact:-1}]})});}
   throw Error('Unexpected network request: '+u);
 };
 let result,code;const res={status(n){code=n;return this},json(x){result=x;return this}};
 await imageHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:payload},res);
 assert.equal(code,200,JSON.stringify(result));assert.equal(form.getAll('image[]').length,studied[1].photoSet.length+1);
 assert.equal(form.getAll('image[]').at(-1).name,'design-reference-only.png');
 assert.equal(form.getAll('image[]')[0].name,'source.png');
 await studioCopy({body:{product:fashion,layouts:['header'],plans:[plans[0]],autoPlan:true}},res,'test-only');
 assert.equal(code,200,JSON.stringify(result));assert.equal(result.copies[0].main,basicCopy(fashion).main);assert.equal(result.copies[0].sub,'79,000원');assert.equal(copyCalls,1);
 visionResponse={photos:[{index:0,role:'main',matchesTarget:true,assetKind:'lifestyle',personKind:'body',pose:'의자에 앉음',light:'왼쪽 자연광',regions:[{box:[0,0,.5,1],role:'model',personKind:'body',complete:true,overlayText:false,colorway:'아이보리',pose:'걷는 측면',light:'역광'}]}],visualTone:fashion.visualTone};
 await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:{urls:[fashion.photos[0].url],productName:fashion.productName}},res);
 assert.equal(code,200,JSON.stringify(result));assert.equal(result.visualTone.moods[0],'serene');
 const classified={...fashion.photos[0]};applyPhotoClassification(classified,result.photos[0]);
 assert.equal(classified.pose,'의자에 앉음');assert.equal(classified.regions[0].colorway,'아이보리');assert.equal(classified.regions[0].light,'역광');
 visionResponse={briefs:[{index:0,moods:['serene'],headline:{lines:2,size:.07},cta:{present:false}}]};
 await photoHandler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body:{mode:'referenceBriefs',entries:[{url:refs[1].fullUrl}]}},res);
 assert.equal(code,200,JSON.stringify(result));assert.equal(result.briefs[0].headline.size,.07);assert.equal(result.briefs[0].cta.present,false);
}finally{globalThis.fetch=fetchBefore;if(keyBefore===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=keyBefore;if(blobBefore===undefined)delete process.env.BLOB_READ_WRITE_TOKEN;else process.env.BLOB_READ_WRITE_TOKEN=blobBefore;}
console.log('PASS: 200 rich-fashion plans, 50 beauty plans, raw food/meal kit and other categories, actual source routing, basic copy, typography, mood-safe references, reusable studies, native API multipart wiring (zero paid calls)');
