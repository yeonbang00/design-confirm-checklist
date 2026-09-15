// The AI designs the type/graphics around these windows. Actual source pixels are
// restored afterwards, so "source use" means compositing, not reference-only generation.
const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('원본 합성 이미지를 읽지 못했습니다.'));img.src=src;});
async function dataUrl(photo,request){
 if(photo.cleanBase64)return `data:${photo.cleanType||'image/jpeg'};base64,${photo.cleanBase64}`;
 if(photo.url.startsWith('data:'))return photo.url;
 const data=await request('/api/imageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:photo.url,ocr:false})});
 if(!data.base64)throw Error('원본 사진을 합성할 수 없습니다.');
 return `data:${data.mediaType};base64,${data.base64}`;
}
export function containRect(width,height,box){const scale=Math.min(box[2]/width,box[3]/height);return [box[0]+(box[2]-width*scale)/2,box[1]+(box[3]-height*scale)/2,width*scale,height*scale].map(Math.round);}
export async function prepareSourcePanels(plan,product,request){
 const ids=[...new Set(plan.photoSet||[plan.photo])].slice(0,3);
 const boxes=ids.length===1?[[50,265,924,620]]:ids.length===2?[[45,280,445,590],[525,280,454,590]]:[[40,300,300,540],[362,300,300,540],[684,300,300,540]];
 const panels=await Promise.all(ids.map(async(id,i)=>{const src=await dataUrl(product.photos[id],request),img=await load(src);return {src,img,rect:containRect(img.naturalWidth,img.naturalHeight,boxes[i])};}));
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#f4f5f7';ctx.fillRect(0,0,1024,1024);
 for(const p of panels)ctx.drawImage(p.img,...p.rect);
 const base64=canvas.toDataURL('image/png').split(',')[1];
 return {base64,mediaType:'image/png',panels,instruction:'Keep the supplied photo windows at these EXACT 1024px canvas coordinates: '+JSON.stringify(panels.map(p=>p.rect))+'. Place headline and supporting copy ONLY in the top 250 pixels, action strip and terms ONLY below y=900. Do not add products, words or graphics inside those windows. Integrate expressive typography, color fields and frames around them. Source photo pixels will be restored in these exact rectangles after generation.'};
}
export async function restoreSourcePanels(url,prepared,request){
 const data=await request('/api/imageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,ocr:false})});
 const img=await load(`data:${data.mediaType};base64,${data.base64}`);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,1024,1024);
 for(const p of prepared.panels)ctx.drawImage(p.img,...p.rect);
 return canvas.toDataURL('image/png');
}
