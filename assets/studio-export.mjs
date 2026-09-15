// Rendering runs locally: no image-generation call or export service.
let renderer;
function loadRenderer(){
 if(!renderer)renderer=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/assets/vendor/html-to-image-1.11.13.js';
  script.onload=()=>resolve(window.htmlToImage);script.onerror=()=>{script.remove();renderer=null;reject(Error('저장 도구를 불러오지 못했습니다. 다시 시도해주세요.'))};document.head.append(script);
 });
 return renderer;
}
async function embedImage(src,request){
 if(src.startsWith('data:'))return src;
 try{const r=await fetch(src);if(!r.ok)throw Error();const b=await r.blob();return await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(b)})}
 catch{const d=await request('/api/imageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:src,ocr:false})});if(!d.base64)throw Error('상품 이미지를 받지 못했습니다.');return `data:${d.mediaType||'image/png'};base64,${d.base64}`;}
}
const fontCache=new Map();
async function embedFonts(node){
 const families=new Set([node,...node.querySelectorAll('*')].flatMap(el=>getComputedStyle(el).fontFamily.toLowerCase().replace(/["']/g,'').split(',').map(x=>x.trim())));
 const sheets=await Promise.all([...document.styleSheets].map(async sheet=>{
  try{return {css:[...sheet.cssRules].map(r=>r.cssText).join('\n'),base:sheet.href||location.href}}
  catch{const r=await fetch(sheet.href);if(!r.ok)throw Error('웹폰트를 불러오지 못했습니다.');return {css:await r.text(),base:sheet.href}}
 }));
 const rules=[];
 for(const {css,base} of sheets)for(const [rule] of css.matchAll(/@font-face\s*\{[^}]+\}/gi)){
  const family=rule.match(/font-family\s*:\s*([^;]+)/i)?.[1].replace(/["']/g,'').trim().toLowerCase();if(!families.has(family))continue;
  const urls=[...rule.matchAll(/url\(["']?([^)'"\s]+)["']?\)\s*(?:format\(["']?([^)'"\s]+)["']?\))?/gi)];
  const chosen=urls.find(m=>m[2]==='woff2')||urls[0];if(!chosen)continue;
  const url=new URL(chosen[1],base).href;
  if(!fontCache.has(url))fontCache.set(url,embedImage(url,()=>{throw Error('웹폰트 다운로드 실패')}));
  let data;try{data=await fontCache.get(url)}catch(e){fontCache.delete(url);throw e}
  rules.push(rule.replace(/src\s*:[^;]+;?/i,`src:url("${data}");`));
 }
 return rules.join('\n');
}
export async function exportBanner(node,request){
 if(!node)throw Error('저장할 배너를 찾지 못했습니다.');
 await document.fonts.ready;
 const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)throw Error('배너가 화면에 표시된 후 다시 시도해주세요.');
 const host=document.createElement('div');host.style.cssText=`position:fixed;left:-20000px;top:0;width:${rect.width}px;pointer-events:none;`;
 const clone=node.cloneNode(true);clone.style.width=rect.width+'px';clone.style.height=rect.height+'px';clone.style.animation='none';clone.style.transition='none';
 host.append(clone);document.body.append(host);
 try{
  await Promise.all([...clone.querySelectorAll('img')].map(async img=>{img.loading='eager';img.removeAttribute('srcset');img.src=await embedImage(img.src,request);await img.decode()}));
  const api=await loadRenderer();
  const fontEmbedCSS=await embedFonts(clone);
  const blob=await api.toBlob(clone,{canvasWidth:1080,canvasHeight:Math.round(1080*rect.height/rect.width),pixelRatio:1,fontEmbedCSS});
  if(!blob||blob.size<100)throw Error('PNG를 만들지 못했습니다.');return blob;
 }finally{host.remove()}
}
export function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
