/* 좌표는 원본 전체 기준 0~1. 애매한 영역은 전체 사진보다 안전하지 않으므로 버린다. */
export function normalizePhotoRegions(rows) {
  const out=[];
  for(const row of (Array.isArray(rows)?rows:[]).slice(0,8)) {
    const b=row?.box;
    if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite))continue;
    const [x,y,w,h]=b;
    if(x<0||y<0||w<=0||h<=0||x+w>1.001||y+h>1.001||w*h<0.035)continue;
    if(!['model','packshot','flat','detail'].includes(row.role))continue;
    if(row.complete!==true||row.overlayText!==false)continue;
    const box=[x,y,Math.min(w,1-x),Math.min(h,1-y)];
    if(out.some(r=>r.box.every((v,i)=>Math.abs(v-box[i])<0.015)))continue;
    const personKind=['none','hands','body'].includes(row.personKind)?row.personKind:'unknown';
    if(row.role==='model'&&personKind!=='body')continue;
    out.push({box,assetKind:['texture','product','detail','lifestyle'].includes(row.assetKind)?row.assetKind:'detail',role:row.role,personKind,hasPerson:personKind==='body'||personKind==='hands',
      colorway:String(row.colorway||'').slice(0,20),plainBg:row.plainBg===true,
      pose:String(row.pose||'').slice(0,100),light:String(row.light||'').slice(0,100),note:String(row.note||'').slice(0,160),
      foodState:['raw','cooked','packaged'].includes(row.foodState)?row.foodState:'unknown',actualPreparedMeal:row.actualPreparedMeal===true,
      shotAngle:String(row.shotAngle||'front').slice(0,20),shotDistance:String(row.shotDistance||'medium').slice(0,20),
      itemCount:Number.isInteger(row.itemCount)&&row.itemCount>0?row.itemCount:1,
      isHero:row.isHero===true,isGift:row.isGift===true});
    if(out.length===3)break;
  }
  return out;
}

export function regionPixels(box,width,height) {
  const x=Math.round(box[0]*width),y=Math.round(box[1]*height);
  const w=Math.min(width-x,Math.round(box[2]*width)),h=Math.min(height-y,Math.round(box[3]*height));
  return w>=240&&h>=240?{x,y,w,h}:null;
}

function loadImage(src) {
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const timer=setTimeout(()=>{img.onload=img.onerror=null;reject(Error('상세사진 읽기 시간 초과'));},12000);
    img.onload=()=>{clearTimeout(timer);resolve(img)};
    img.onerror=()=>{clearTimeout(timer);reject(Error('상세사진을 열지 못했습니다'))};
    img.src=src;
  });
}

export function regionExtractionQuotas(photos,limit=24){
  const quotas=new Map();let budget=limit;
  for(let round=0;round<3;round++)for(const photo of photos){
    if(budget>0&&photo.regions?.[round]&&(!photo.sourceRegion||photo.detailTile)){quotas.set(photo,(quotas.get(photo)||0)+1);budget--;}
  }
  return quotas;
}

export async function extractPhotoRegions(photos,getJSON,isCurrent=()=>true) {
  const output=[],failures=[];let extracted=0;
  // Spread the extraction budget across the whole page before taking second or
  // third crops. Early blue portraits must not consume all slots before ivory.
  const quotas=regionExtractionQuotas(photos);
  // 응답·브라우저 저장 용량을 제한한다. 실패 시 원본을 보존한다.
  for(const photo of photos) {
    if(!isCurrent())return {photos,extracted:0,failures:[],cancelled:true};
    const regions=photo.regions||[];
    if(!regions.length||(photo.sourceRegion&&!photo.detailTile)||!quotas.has(photo)){output.push(photo);continue;}
    try {
      const data=photo.cleanBase64?{base64:photo.cleanBase64,mediaType:photo.cleanType}:await getJSON('/api/imageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:photo.url,ocr:false})});
      if(!isCurrent())return {photos,extracted:0,failures:[],cancelled:true};
      if(!data.base64||!/^image\//.test(data.mediaType||''))throw Error('상세사진 데이터 없음');
      const img=await loadImage(`data:${data.mediaType};base64,${data.base64}`);
      const children=[];
      for(const region of regions.slice(0,quotas.get(photo)||0)) {
        const bounds=regionPixels(region.box,img.naturalWidth,img.naturalHeight);
        if(!bounds)continue;
        const {x,y,w,h}=bounds,scale=Math.min(1,1400/Math.max(w,h));
        const canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
        canvas.getContext('2d').drawImage(img,x,y,w,h,0,0,canvas.width,canvas.height);
        const cleanUrl=canvas.toDataURL('image/jpeg',0.92);
        children.push({...region,matchesTarget:photo.matchesTarget,assetKind:region.assetKind==='detail'&&photo.assetKind==='texture'?'texture':region.assetKind,provenance:photo.provenance,url:photo.url,sourceUrl:photo.sourceUrl||photo.url,detailTile:photo.detailTile,tilePixels:photo.sourcePixels,sourceRegion:region.box,sourcePixels:bounds,
          w:canvas.width,h:canvas.height,kind:'original',burnedText:'',cleanUrl,
          cleanBase64:cleanUrl.split(',')[1],cleanType:'image/jpeg',
          label:[region.colorway,'상세 추출컷',children.length+1].filter(Boolean).join(' ')});
      }
      if(children.length){output.push(...children);extracted+=children.length;}
      else{output.push(photo);failures.push({url:photo.url,reason:'활용할 크기의 사진 영역 없음'});}
    }catch(e){output.push(photo);failures.push({url:photo.url,reason:String(e.message||e).slice(0,100)});}
  }
  return {photos:output,extracted,failures};
}
