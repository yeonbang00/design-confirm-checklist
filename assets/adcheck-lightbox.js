// 이미지를 "원본 크기"로 확인하기 위한 공용 라이트박스.
//
// 왜 필요한가 — 브라우저는 이미지를 CSS 픽셀로 그린다. 레티나 화면
// (devicePixelRatio 2)에서 1080px 이미지를 그대로 두면 CSS 1080px, 즉 실제
// 2160 디바이스 픽셀을 차지해서 포토샵 100%(이미지 1픽셀 = 화면 1픽셀)보다
// 정확히 두 배 크게 보인다. 코드가 이미지를 확대하는 게 아니라 이게 원인이다.
// 그래서 여기서는 100% 보기를 naturalWidth / devicePixelRatio 로 계산해
// 포토샵 100%와 실제로 일치시킨다.
//
// 기본값은 100%(원본 크기)다 — 소재를 검수하는 화면이라 "지금 보는 게 원본
// 대비 몇 배인가"가 흐려지면 안 되기 때문. 전체 구도를 볼 땐 화면 맞춤으로
// 전환할 수 있고, 상단에 실제 픽셀 크기와 현재 배율을 항상 띄워둔다.
//
// 사용: adcheckLightbox('https://.../full.jpg', '캡션(선택)')
(function () {
  var overlay = null, stage = null, img = null, dimEl = null, capEl = null;
  var modeBtns = {};
  var mode = 'one';           // 'one' = 원본 100%, 'fit' = 화면 맞춤
  var styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css = document.createElement('style');
    css.textContent =
      // 배경이 비치면 소재의 색을 잘못 읽게 되므로 불투명한 단색으로 덮는다
      '.dc-lb{position:fixed;inset:0;z-index:9998;background:#0B0C0E;' +
      'display:flex;flex-direction:column;' +
      'font-family:-apple-system,"Pretendard","Apple SD Gothic Neo",sans-serif;}' +
      '.dc-lb-bar{flex:none;display:flex;align-items:center;gap:16px;padding:14px 20px;' +
      'border-bottom:1px solid rgba(255,255,255,.09);}' +
      '.dc-lb-dim{font:500 12px/1 ui-monospace,"JetBrains Mono",monospace;letter-spacing:.06em;' +
      'color:#EDEEF0;white-space:nowrap;}' +
      '.dc-lb-dim s{text-decoration:none;color:#7E838C;margin-left:9px;}' +
      '.dc-lb-modes{display:flex;gap:2px;padding:3px;border-radius:999px;' +
      'background:rgba(255,255,255,.06);margin-left:auto;}' +
      '.dc-lb-mode{border:none;background:none;cursor:pointer;font-family:inherit;' +
      'font-size:12px;font-weight:500;color:#A2A7B0;padding:6px 13px;border-radius:999px;' +
      'transition:background .2s ease,color .2s ease;}' +
      '.dc-lb-mode:hover{color:#EDEEF0;}' +
      '.dc-lb-mode.is-on{background:#EDEEF0;color:#0B0C0E;font-weight:700;}' +
      '.dc-lb-close{border:none;background:none;cursor:pointer;color:#A2A7B0;' +
      'font-size:26px;line-height:1;padding:2px 4px;}' +
      '.dc-lb-close:hover{color:#EDEEF0;}' +
      '.dc-lb-stage{flex:1;min-height:0;overflow:auto;display:flex;align-items:center;' +
      'justify-content:center;padding:28px;}' +
      '.dc-lb-stage img{display:block;flex:none;margin:auto;' +
      'box-shadow:0 24px 70px rgba(0,0,0,.55);image-rendering:auto;}' +
      '.dc-lb-cap{flex:none;padding:0 20px 18px;text-align:center;font-size:12.5px;' +
      'line-height:1.6;color:#7E838C;}' +
      '.dc-lb-cap:empty{display:none;}' +
      '@media (max-width:640px){.dc-lb-bar{gap:10px;padding:12px 14px;}' +
      '.dc-lb-mode{padding:6px 10px;}.dc-lb-stage{padding:14px;}}';
    document.head.appendChild(css);
  }

  function ratio() { return window.devicePixelRatio || 1; }

  // 두 배율 모두 "원본 대비 몇 배인가"로 통일해서 계산한다. 원본 크기(=100%)는
  // CSS 픽셀로는 naturalWidth / devicePixelRatio 라는 점이 이 함수의 핵심.
  function apply() {
    if (!img.naturalWidth) return;
    var d = ratio();
    var trueW = img.naturalWidth / d;
    var trueH = img.naturalHeight / d;
    var scale = 1;
    if (mode === 'fit') {
      // 스테이지 패딩(28px * 2)을 빼고 남는 영역에 맞춘다
      var availW = stage.clientWidth - 56;
      var availH = stage.clientHeight - 56;
      if (availW > 0 && availH > 0) scale = Math.min(availW / trueW, availH / trueH);
    }
    img.style.width = Math.round(trueW * scale) + 'px';
    img.style.height = Math.round(trueH * scale) + 'px';
    dimEl.innerHTML = img.naturalWidth + ' × ' + img.naturalHeight +
      '<s>' + Math.round(scale * 100) + '%</s>';
  }

  function setMode(next) {
    mode = next;
    modeBtns.one.classList.toggle('is-on', next === 'one');
    modeBtns.fit.classList.toggle('is-on', next === 'fit');
    apply();
  }

  function close() {
    if (!overlay) return;
    overlay.style.display = 'none';
    img.src = '';
    document.body.style.overflow = '';
  }

  function build() {
    injectStyle();
    overlay = document.createElement('div');
    overlay.className = 'dc-lb';

    var bar = document.createElement('div');
    bar.className = 'dc-lb-bar';

    dimEl = document.createElement('span');
    dimEl.className = 'dc-lb-dim';

    var modes = document.createElement('div');
    modes.className = 'dc-lb-modes';
    ['one', 'fit'].forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dc-lb-mode';
      b.textContent = m === 'one' ? '원본 100%' : '화면 맞춤';
      b.addEventListener('click', function () { setMode(m); });
      modes.appendChild(b);
      modeBtns[m] = b;
    });

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dc-lb-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', close);

    bar.appendChild(dimEl);
    bar.appendChild(modes);
    bar.appendChild(closeBtn);

    stage = document.createElement('div');
    stage.className = 'dc-lb-stage';
    img = document.createElement('img');
    img.alt = '확대된 이미지';
    img.addEventListener('load', apply);
    stage.appendChild(img);
    // 이미지 바깥(여백)을 누르면 닫는다 — 이미지 자체는 드래그 스크롤 대상이라 제외
    stage.addEventListener('click', function (e) { if (e.target === stage) close(); });

    capEl = document.createElement('div');
    capEl.className = 'dc-lb-cap';

    overlay.appendChild(bar);
    overlay.appendChild(stage);
    overlay.appendChild(capEl);
    document.body.appendChild(overlay);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.style.display !== 'none') close();
    });
    // 창 크기나 모니터가 바뀌면 배율이 달라진다(외장 모니터는 dpr이 1인 경우가 많음)
    window.addEventListener('resize', function () {
      if (overlay.style.display !== 'none') apply();
    });
  }

  window.adcheckLightbox = function (src, caption) {
    if (!src) return;
    if (!overlay) build();
    capEl.textContent = caption || '';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    dimEl.textContent = '불러오는 중';
    setMode('one');
    img.style.width = '';
    img.style.height = '';
    img.src = src;
  };
})();
