const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Unfinished generations have no downloadable design. Never dress a source
// photo in a CSS template and present it as a generated fallback.
export function unfinishedResult(v){
 if(v.imageReady!==false&&!v.imageFailed)return '';
 const failed=!!v.imageFailed;
 const title=failed?'이미지를 완성하지 못했습니다':v.autoStatus==='이미지 생성 중'?'이미지 생성 중':'생성 준비 중';
 const reason=failed?v.imageError||'아래 버튼에서 이 이미지만 다시 시도할 수 있습니다.':'';
 return `<div class="result-state" role="status"><strong>${title}</strong>${reason?`<span>${escape(reason)}</span>`:''}</div>`;
}
