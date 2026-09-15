// Read long detail pages at useful resolution instead of squeezing the entire page
// into one vision image. The original URL and pixel coordinates stay attributable.
export function detailTileBounds(width,height){
 if(!(width>0&&height/width>4))return [];
 const heightLimit=Math.round(width*1.8),step=heightLimit-Math.round(width*.12),out=[];
 for(let y=0;y<height;y+=step){out.push({x:0,y,w:width,h:Math.min(heightLimit,height-y)});if(y+heightLimit>=height)break;}
 return out;
}
const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('상세 이미지를 읽지 못했습니다.'));img.src=src;});
export async function tileDetailPhotos(photos,request,isCurrent=()=>true){
 const out=[];let remaining=24-photos.filter(p=>!(p.h/p.w>4)).length;
 for(const photo of photos){
  const bounds=detailTileBounds(photo.w,photo.h);
  if(!bounds.length){out.push(photo);continue;}
  if(bounds.length>remaining)throw Error('상세 이미지가 분석 범위를 초과합니다. 상품과 관련된 상세 이미지만 담아주세요.');
  const data=await request('/api/imageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:photo.url,ocr:false})});
  if(!isCurrent())return photos;
  const img=await load(`data:${data.mediaType};base64,${data.base64}`);
  for(const [i,b] of bounds.entries()){
   const scale=Math.min(1,1200/b.w),c=document.createElement('canvas');c.width=Math.round(b.w*scale);c.height=Math.round(b.h*scale);
   c.getContext('2d').drawImage(img,b.x,b.y,b.w,b.h,0,0,c.width,c.height);
   const cleanUrl=c.toDataURL('image/jpeg',.9);
   out.push({...photo,url:photo.url.split('#')[0]+'#adcheck-detail-'+i,sourceUrl:photo.url,sourcePixels:b,detailTile:true,provenance:'detail',w:c.width,h:c.height,cleanUrl,cleanBase64:cleanUrl.split(',')[1],cleanType:'image/jpeg'});
  }
  remaining-=bounds.length;
 }
 return out;
}
