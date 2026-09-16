import assert from 'node:assert/strict';
import handler from '../api/productPhotos.js';
const priorFetch=globalThis.fetch,priorKey=process.env.OPENAI_API_KEY;
let response,prompt;
async function run(body){let result,code;await handler({method:'POST',headers:{host:'test.local',origin:'https://test.local'},body},{status(c){code=c;return this},json(x){result=x;return this}});return {code,result};}
try{
 process.env.OPENAI_API_KEY='test-only';
 globalThis.fetch=async(url,options={})=>{
  if(String(url).startsWith('https://example.test/'))return new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/png'}});
  if(String(url).includes('/responses')){prompt=JSON.stringify(JSON.parse(options.body));return Response.json({output_text:JSON.stringify(response)});}
  throw Error('Unexpected network '+url);
 };
 response={category:'beauty',photos:[{index:0,matchesTarget:true,role:'main'},{index:1,matchesTarget:false,role:'packshot'},{index:2,role:'detail'}]};
 const result=await run({urls:['https://example.test/a','https://example.test/b','https://example.test/c'],productName:'리얼베리어 로션',brand:'리얼베리어'});
 assert.equal(result.code,200);assert.equal(result.result.photos[0].role,'main');assert.equal(result.result.photos[1].role,'unusable');assert.equal(result.result.photos[2].role,'unusable');assert.ok(prompt.includes('리얼베리어 로션'));
 for(const matches of [true,false,undefined]){response={matches,reason:'검사'};const r=await run({mode:'verifyProduct',sourceUrl:'https://example.test/a',resultUrl:'https://example.test/b'});assert.equal(r.result.matches,matches===true);}
}finally{globalThis.fetch=priorFetch;if(priorKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=priorKey;}
const {createCreativePlan}=await import('../assets/studio-creative-plan.mjs');assert.equal(createCreativePlan({category:'beauty',photos:[{role:'main',personKind:'none',matchesTarget:false}]}),null);
console.log('PASS: target identity passed to analysis, unrelated/uncertain sources excluded, output comparison fails closed');
