// Food is identified by its photographed state, not by a recipe inferred from copy.
export const FOOD_POLICY_VERSION='food-source-v1';
export function foodUse(p={}){
 if(['process','info'].includes(p.foodUse))return p.foodUse;
 if(p.foodState==='cooked'&&p.actualPreparedMeal===true)return 'served';
 if(p.foodState==='packaged')return 'package';
 if(p.foodState==='raw')return 'raw';
 return 'unknown';
}
export const usableFoodSource=p=>!['process','info','unknown'].includes(foodUse(p));
export function foodContract(photos){
 return {version:FOOD_POLICY_VERSION,states:photos.map(p=>p.foodState),uses:photos.map(foodUse),packageAllowed:photos.some(p=>foodUse(p)==='package'||p.packageVisible===true)};
}
export function foodInstructions(contract){
 if(!contract)return '';
 return ' FOOD SOURCE CONTRACT (overrides generic scene suggestions): Build the composition around the supplied actual food photograph. Reuse the appetizing prepared dish across designs; vary crop, scale, negative space, tabletop and graphic framing, not the food itself. '
 +'Keep the photographed raw/cooked state, cut, bone shape, thickness, surface, glaze, browning, portion and existing garnish. Never synthesize cooking, sauce pouring, marinating, grilling, steam, cutting or preparation steps from written product facts. No recipe illustrations or new ingredients. Keep the original plate and its food together when changing the surrounding setting; use plausible perspective, light and contact shadows. Table, linen, empty crockery and cutlery may support the scene; do not invent side dishes or imply additional included items. Do not redesign food into a generic similar dish or perfectly repeated slices. '
 +(contract.packageAllowed?'Packaging may appear ONLY by using the supplied actual package: preserve its tray/pouch/box shape, material, colour and printed label. Never turn a tray into a bag or box. A package is a supporting element, not a source for imagining its contents. ':'No physical packaging was supplied for this composition. Do not add any pouch, tray package, gift box, label or branded container. ')
 +'Source roles in attachment order: '+JSON.stringify(contract.uses)+'. A prepared serving is a serving suggestion, not evidence that the delivered product is cooked. Keep main copy about the named product; no unsupported cooking claims, reviews, discounts or ingredient percentages.';
}
export function foodIdentityPrompt(descriptions=[]){
 return 'Compare ALL source images before the LAST image (generated advertisement). Return JSON {"matches":true/false,"reason":"short Korean reason"}. '
 +'Every advertised food and package must match a supplied source. Source roles/state: '+JSON.stringify(descriptions)+'. '
 +'Reject newly invented packaging, changed tray/pouch/box/label, different meat cuts/bones, raw-to-cooked or cooked-to-raw changes, invented ingredients/garnish, sauce pouring, cooking or preparation actions, implausibly repeated pieces and uncertain food identity. A faithful crop, larger view or new tabletop is allowed with coherent lighting. Empty tableware is scenery, not a different product. If no package is in the sources, no package may appear. Do not demand a package in a food-only banner. Do not confuse advertising copy with physical package labels.';
}

// Reuse the exact generation inputs, including extracted photo bytes. A whole
// long-detail URL would compare a different source than the model actually saw.
export function foodVerificationRequest(request,resultUrl){
 return {mode:'verifyProduct',category:'food',sourceUrls:[request,...(request.references||[])].map(s=>s.base64?`data:${s.mediaType};base64,${s.base64}`:s.imageUrl),sourceDescriptions:request.sourceDescriptions,resultUrl,productName:request.productName};
}
export const protectFoodLabel=(category,p)=>category==='food'&&(foodUse(p)==='package'||p.packageVisible===true);
