export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function createPlan(product,random=Math.random){
 const hasBenefit=product.benefitConfirmed&&product.benefitRate>0&&product.benefitCondition;
 const types=shuffle(['product','usage','list','question','comparison',...(hasBenefit?['benefit','numbers']:product.salePrice?['numbers']:[])],random);
 const layouts=shuffle(['header','split','split-right','band','top-center','top-left','bottom-right',...(product.salePrice||hasBenefit?['offer']:[])],random).slice(0,6);
 const scenes=shuffle([
  ['차분한 스튜디오','A warm neutral editorial studio, sculptural soft light, generous negative space.'],
  ['자연광 공간','A contemporary daylight interior with natural materials and gentle window shadows.'],
  ['컬러 스튜디오','A refined muted blue studio with a harmonious tonal background, crisp commercial photography.'],
  ['미니멀 갤러리','A minimal gallery space with architectural curves and restrained olive tones.'],
  ['저녁빛 연출','A warm evening interior, indirect amber lighting and rich but natural shadows.'],
  ['밝은 공간','An airy white interior, soft diffused light, clean premium editorial mood.']
 ],random);
 const methods=shuffle(['original','original','newscene','newscene','newscene','newscene'],random);
 // 사진은 방식별로 따로 돌린다. i를 그대로 쓰면 methods가 섞였을 때
 // 원본 2종이 같은 사진을 집어 카드 두 장이 똑같아진다.
 const photoOrder=shuffle(product.photos.map((_,i)=>i),random);
 let originalSeen=0, sceneSeen=0, sceneIndex=0;
 return methods.map((method,i)=>{
  const scene=method==='original'?['상품 원본','']:scenes[sceneIndex++];
  const photo=method==='original'
   ? photoOrder[originalSeen++ % photoOrder.length]
   : photoOrder[(photoOrder.length-1-(sceneSeen++)) % photoOrder.length];
  return {id:i,method,layout:layouts[i],type:types[i%types.length],photo,sceneName:scene[0],scene:scene[1]};
 });
}
