const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Unfinished generations have no downloadable design. Never dress a source
// photo in a CSS template and present it as a generated fallback.
export function unfinishedResult(v){
 if(v.imageReady!==false&&!v.imageFailed)return '';
 const failed=!!v.imageFailed;
 const title=v.copyFailed?'카피 확인에서 중단됨':failed?'이미지를 완성하지 못했습니다':['카피 기획 중','이미지 생성 대기','이미지 생성 중','상품·문구 확인 중'].includes(v.autoStatus)?v.autoStatus:'생성 준비 중';
 const reason=v.copyFailed?'상단의 ‘카피 다시 시도’로 이어서 진행하세요.':failed?v.imageError||'아래 버튼에서 이 이미지만 다시 시도할 수 있습니다.':'';
 return `<div class="result-state" role="status"><strong>${title}</strong>${reason?`<span>${escape(reason)}</span>`:''}</div>`;
}
