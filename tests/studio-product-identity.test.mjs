import assert from 'node:assert/strict';
import fs from 'node:fs';
let src=fs.readFileSync(new URL('../api/productPhotos.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('const apiKey = process.env.OPENAI_API_KEY;',"const apiKey='test';");
src=src.slice(0,src.indexOf('async function fetchImage(url)'))+'const fetchImage=async()=>({base64:"dGVzdA==",mediaType:"image/png"});\n'+src.slice(src.indexOf('export default async function handler'));
src='const normalizePhotoRegions=()=>[];const rejectIfNotSameOrigin=()=>false;const OPENAI_MODEL="mock";const callOpenAI=async o=>{globalThis.identityPrompt=o.promptText;return globalThis.identityResponse};\n'+src;
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
async function run(body){let result,code;await handler({method:'POST',body},{status(c){code=c;return this},json(x){result=x;return this}});return {code,result};}
globalThis.identityResponse={category:'beauty',photos:[{index:0,matchesTarget:true,role:'main'},{index:1,matchesTarget:false,role:'packshot'},{index:2,role:'detail'}]};
const result=await run({urls:['https://example.test/a','https://example.test/b','https://example.test/c'],productName:'리얼베리어 로션',brand:'리얼베리어'});
assert.equal(result.code,200);assert.equal(result.result.photos[0].role,'main');assert.equal(result.result.photos[1].role,'unusable');assert.equal(result.result.photos[2].role,'unusable');assert.ok(globalThis.identityPrompt.includes('리얼베리어 로션'));
for(const matches of [true,false,undefined]){globalThis.identityResponse={matches,reason:'검사'};const r=await run({mode:'verifyProduct',sourceUrl:'https://example.test/a',resultUrl:'https://example.test/b'});assert.equal(r.result.matches,matches===true);}
const {createCreativePlan}=await import('../assets/studio-creative-plan.mjs');assert.equal(createCreativePlan({category:'beauty',photos:[{role:'main',personKind:'none',matchesTarget:false}]}),null);
console.log('PASS: target identity passed to analysis, unrelated/uncertain sources excluded, output comparison fails closed');
