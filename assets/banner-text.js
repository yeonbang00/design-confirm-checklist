// AdCheck 배너 텍스트 엔진 — '시안 3종'과 '완성 배너'가 함께 쓴다.
//
// 브라우저의 줄바꿈에 맡기지 않고 직접 계산하는 이유는 두 가지다.
//   ① 한글을 어절이 아니라 글자 단위로 끊으면 "데님 스커/트"가 된다.
//   ② 미리보기(DOM)와 내보내기(캔버스)가 각자 줄을 나누면 결과가 어긋난다.
// 여기서 한 번 계산한 줄을 양쪽이 그대로 쓴다.
//
// 전역에 window.BannerText 로 노출한다. 모듈 시스템을 쓰지 않는 정적
// 사이트라 <script src>로 불러 쓰는 게 가장 단순하다.
(function (global) {
  'use strict';

  var FONT = "Pretendard, -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";

/* ══ 텍스트 엔진 ═══════════════════════════════════════════════════
   ChatGPT 데모 두 개가 똑같이 깨진 지점이 여기다.
     ① 한글을 어절이 아니라 글자 단위로 끊어서 "스커/트"가 됐고
     ② 카피가 한 줄 늘어나도 아래 요소 y가 고정이라 서로 겹쳤다.
   그래서 (1) 줄바꿈을 직접 계산하고 (2) 요소를 흐름으로 쌓는다. */
const _mc = document.createElement('canvas').getContext('2d');
function fontOf(p, size){ return `${p.weight} ${size}px ${FONT}`; }
function textW(s, p, size){
  _mc.font = fontOf(p,size);
  if('letterSpacing' in _mc) _mc.letterSpacing = (p.ls||0)+'px';
  return _mc.measureText(s).width;
}
/* 어절 단위 줄바꿈. CSS의 word-break:keep-all과 같은 규칙이다. */
function wrapLines(text, p, size, width){
  const out=[];
  for(const para of String(text==null?'':text).split('\n')){
    const words = para.split(/\s+/).filter(Boolean);
    if(!words.length){ out.push(''); continue; }
    let line='';
    for(const w of words){
      const cand = line ? line+' '+w : w;
      if(textW(cand,p,size) <= width){ line=cand; continue; }
      if(line){ out.push(line); line=''; }
      // 어절 하나만 남았는데도 폭을 넘으면 그때만 글자 단위로 쪼갠다.
      // (띄어쓰기 없는 긴 문장이 밖으로 삐져나가는 걸 막는다)
      if(textW(w,p,size) <= width){ line=w; continue; }
      let chunk='';
      for(const ch of w){
        if(chunk && textW(chunk+ch,p,size) > width){ out.push(chunk); chunk=ch; }
        else chunk+=ch;
      }
      line=chunk;
    }
    out.push(line);
  }
  return out;
}
/* 줄 수가 한도를 넘으면 글자 크기를 1px씩 줄인다. 바닥까지 줄여도
   안 들어가면 잘라내고 경고를 띄운다. 넘치게 두지는 않는다. */
function fitText(text, p, width){
  let size = p.size, lines = wrapLines(text,p,size,width), shrunk=false;
  const min = p.min || p.size;
  while(lines.length > p.maxLines && size > min){
    size -= 1; shrunk = true;
    lines = wrapLines(text,p,size,width);
  }
  let clipped=false;
  if(lines.length > p.maxLines){
    lines = lines.slice(0,p.maxLines);
    lines[lines.length-1] = lines[lines.length-1].replace(/\s*\S*$/,'') + '…';
    clipped = true;
  }
  return { lines, size, height: lines.length*size*p.lh, shrunk, clipped, from:p.size };
}
const won = n => (n==null||n==='') ? '' : Number(String(n).replace(/[^\d]/g,'')).toLocaleString('ko-KR')+'원';
  global.BannerText = {
    FONT: FONT,
    textW: textW,
    wrapLines: wrapLines,
    fitText: fitText,
    won: won,
    lumOfHex: lumOfHex,
    contrastRatio: contrastRatio,
  };

  /* 색 대비 — 우리 체크리스트 3번이 보는 것과 같은 WCAG 기준이다. */
  function lumOfHex(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return 1;
    var n = parseInt(hex.slice(1), 16);
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }
  function contrastRatio(a, b) {
    var x = lumOfHex(a), y = lumOfHex(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
})(window);
