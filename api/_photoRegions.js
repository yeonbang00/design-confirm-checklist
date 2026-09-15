// Server counterpart of assets/studio-photo-regions.mjs; keep normalization identical.
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

