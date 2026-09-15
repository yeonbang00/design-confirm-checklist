// Keep the original image unchanged. Reopening a result reuses it without another API call.
const results = new Map();
export function attachCopyRemoval(card, photo, {request, source, download}) {
  if (!source) return;
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '제거 결과'; summary.hidden=true; details.hidden=true;
  details.append(summary);
  const note = document.createElement('p');
  note.textContent = ''; note.hidden=true;
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const action = document.createElement('button'); action.type='button'; action.className='btn'; action.textContent='광고 글자 제거 실행';
  const compare = document.createElement('div'); compare.hidden=true;
  const out = document.createElement('img'); out.alt='광고 글자 제거 결과';
  const before = document.createElement('img'); before.src=source; before.alt='제거 전 원본'; before.loading='lazy';
  for (const img of [before,out]) {img.style.width='100%';img.style.height='auto';}
  const figures = document.createElement('div');figures.style.cssText='display:flex;flex-wrap:wrap;gap:12px';
  for (const [label,img] of [['제거 결과',out]]) {
    const f=document.createElement('figure');f.style.cssText='margin:0;flex:1 1 180px;min-width:0';
    const c=document.createElement('figcaption');c.textContent=label;f.append(c,img);figures.append(f);
  }
  const warning=document.createElement('p');warning.textContent='제품 로고·모양·작은 글자와 배경을 원본과 비교해주세요. AI 복원 과정에서 달라질 수 있습니다.';
  const save=document.createElement('button');save.type='button';save.className='btn';save.textContent='텍스트 없는 이미지 다운로드';
  compare.append(figures,save);details.append(note,action,status,compare);card.append(details);
  const show=url=>{out.src=url;compare.hidden=false;action.hidden=true;status.textContent='';details.hidden=false;details.open=true;save.onclick=()=>download(url);};
  const cached=results.get(source); if(cached?.url)show(cached.url);
  const execute=async()=>{
    details.hidden=false;details.open=true;
    action.hidden=true;action.disabled=true;status.textContent='글자 제거 중…';
    try {
      let job=results.get(source);
      if(!job){
        const input=photo.cleanBase64?{base64:photo.cleanBase64,mediaType:photo.cleanType}:{imageUrl:source};
        job={pending:request('/api/bannerImage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,operation:'remove-ad-copy',quality:'medium',size:'1024x1024'})})};
        results.set(source,job);
      }
      const data=job.url?{imageUrl:job.url}:await job.pending;
      const url=new URL(data.imageUrl);if(url.protocol!=='https:'&&url.protocol!=='http:')throw Error('결과 이미지 주소를 확인할 수 없습니다.');
      job.url=url.href;show(job.url);await download(job.url);
    } catch(e) {const ready=!!results.get(source)?.url;if(!ready)results.delete(source);status.textContent=(ready?'다운로드 실패: ':'글자 제거 실패: ')+e.message+' 다시 시도할 수 있습니다.';action.textContent='다시 시도';action.hidden=false;}
    finally{action.disabled=false;}
  };
  action.onclick=execute;
  const trigger=card.querySelector('[data-dlimg]');
  if(trigger){trigger.title='추가 이미지 생성 비용이 발생합니다';trigger.onclick=execute;}
}
