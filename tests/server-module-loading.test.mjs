import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Vercel compiles .js as CommonJS without this explicit declaration, even when
// newer local Node versions successfully infer ESM. Do not strip imports here.
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.type,'module','Vercel must preserve native ESM for shared .mjs contracts');
for(const name of ['productPhotos','bannerCopy','bannerImage','analyze','productScrape','referenceImages']){
 const module=await import(`../api/${name}.js`);
 assert.equal(typeof module.default,'function',`${name} must load with its real imports`);
}
const {getDesignKnowledge}=await import('../api/_designKnowledge.js');
assert.equal(getDesignKnowledge('image').metadata.source,'criteria-guide.html');
console.log('PASS: native server ESM entrypoints and shared browser contracts load without import rewriting');
