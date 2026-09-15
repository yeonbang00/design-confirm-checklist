// Keep the original image unchanged. Reopening a result reuses it without another API call.
const results = new Map();
export function attachCopyRemoval(card, photo, {request, source, download}) {
  if (!source) return;
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '이미지 안의 광고 글자 제거';
  details.append(summary);
  const note = document.createElement('p');
  note.textContent = '화면에 얹힌 카피는 기존 이미지 다운로드에 포함되지 않습니다. 사진 자체에 글자가 있을 때만 실행하세요. OpenAI API 비용이 발생합니다.';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const action = document.createElement('button'); action.type='button'; action.className='btn'; action.textContent='광고 글자 제거 실행';
  const compare = document.createElement('div'); compare.hidden=true;
  const out = document.createElement('img'); out.alt='광고 글자 제거 결과';
  const before = document.createElement('img'); before.src=source; before.alt='제거 전 원본'; before.loading='lazy';
  for (const img of [before,out]) {img.style.width='100%';img.style.height='auto';}
  const figures = document.createElement('div');figures.style.cssText='display:flex;flex-wrap:wrap;gap:12px';
  for (const [label,img] of [['원본',before],['제거 결과',out]]) {
    const f=document.createElement('figure');f.style.cssText='margin:0;flex:1 1 180px;min-width:0';
    const c=document.createElement('figcaption');c.textContent=label;f.append(c,img);figures.append(f);
  }
  const warning=document.createElement('p');warning.textContent='제품 로고·모양·작은 글자와 배경을 원본과 비교해주세요. AI 복원 과정에서 달라질 수 있습니다.';
  const save=document.createElement('button');save.type='button';save.className='btn';save.textContent='결과 이미지 다운로드';
  compare.append(figures,warning,save);details.append(note,action,status,compare);card.append(details);
  const show=url=>{out.src=url;compare.hidden=false;action.hidden=true;status.textContent='제거 결과를 확인한 뒤 내려받으세요.';save.onclick=()=>download(url);};
  const cached=results.get(source); if(cached?.url)show(cached.url);
  action.onclick=async()=>{
    action.disabled=true;status.textContent='광고 글자를 제거하는 중입니다. 원본은 그대로 보관됩니다.';
    try {
      let job=results.get(source);
      if(!job){
        const input=photo.cleanBase64?{base64:photo.cleanBase64,mediaType:photo.cleanType}:{imageUrl:source};
        job={pending:request('/api/bannerImage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,operation:'remove-ad-copy',quality:'medium',size:'1024x1024'})})};
        results.set(source,job);
      }
      const data=job.url?{imageUrl:job.url}:await job.pending;
      const url=new URL(data.imageUrl);if(url.protocol!=='https:'&&url.protocol!=='http:')throw Error('결과 이미지 주소를 확인할 수 없습니다.');
      job.url=url.href;show(job.url);
    } catch(e) {results.delete(source);status.textContent='글자 제거 실패: '+e.message+' 다시 시도할 수 있습니다.';action.textContent='광고 글자 제거 다시 시도';}
    finally{action.disabled=false;}
  };
}
