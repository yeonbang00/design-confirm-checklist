// window.prompt()는 입력값을 그대로 평문으로 보여줘서 비밀번호 입력에는
// 부적합하다(옆에서 보면 그대로 읽힘) — type="password" 인풋을 쓰는 작은
// 모달로 대체한다. 기존 호출부는 `const pw = window.prompt(msg)` 형태였는데,
// 이를 `const pw = await adcheckPromptPassword(msg)`로만 바꾸면 되게
// 반환값 규약(확인=입력값, 취소/닫기=null)을 window.prompt와 동일하게 맞췄다.
(function () {
  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css = document.createElement('style');
    css.textContent =
      '.dc-pw-overlay{position:fixed;inset:0;z-index:9999;background:rgba(10,12,11,.6);' +
      'backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;' +
      'font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;}' +
      '.dc-pw-card{width:min(320px,88vw);background:#1b1f1e;border:1px solid rgba(237,242,236,.14);' +
      'border-radius:12px;padding:20px 20px 16px;box-shadow:0 20px 60px rgba(0,0,0,.45);}' +
      '.dc-pw-msg{color:#ecefec;font-size:14px;line-height:1.5;margin:0 0 12px;}' +
      '.dc-pw-input{width:100%;box-sizing:border-box;background:#14171a;border:1px solid rgba(237,242,236,.2);' +
      'border-radius:8px;color:#ecefec;font-size:15px;padding:10px 12px;outline:none;letter-spacing:.05em;}' +
      '.dc-pw-input:focus{border-color:#c3ff4d;}' +
      '.dc-pw-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}' +
      '.dc-pw-btn{border:none;border-radius:7px;padding:8px 14px;font-size:13.5px;cursor:pointer;}' +
      '.dc-pw-cancel{background:transparent;color:#9aa39a;}' +
      '.dc-pw-cancel:hover{color:#ecefec;}' +
      '.dc-pw-ok{background:#c3ff4d;color:#1c2400;font-weight:600;}' +
      '.dc-pw-ok:hover{filter:brightness(1.08);}';
    document.head.appendChild(css);
  }

  window.adcheckPromptPassword = function (message) {
    injectStyle();
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'dc-pw-overlay';

      var card = document.createElement('div');
      card.className = 'dc-pw-card';

      var msg = document.createElement('p');
      msg.className = 'dc-pw-msg';
      msg.textContent = message || '비밀번호를 입력하세요';

      var input = document.createElement('input');
      input.type = 'password';
      input.className = 'dc-pw-input';
      input.autocomplete = 'off';

      var actions = document.createElement('div');
      actions.className = 'dc-pw-actions';

      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'dc-pw-btn dc-pw-cancel';
      cancelBtn.textContent = '취소';

      var okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'dc-pw-btn dc-pw-ok';
      okBtn.textContent = '확인';

      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      card.appendChild(msg);
      card.appendChild(input);
      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      input.focus();

      function close(result) {
        document.removeEventListener('keydown', onKeydown, true);
        overlay.remove();
        resolve(result);
      }
      function onKeydown(e) {
        if (e.key === 'Enter') { e.preventDefault(); close(input.value); }
        else if (e.key === 'Escape') { e.preventDefault(); close(null); }
      }

      okBtn.addEventListener('click', function () { close(input.value); });
      cancelBtn.addEventListener('click', function () { close(null); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(null); });
      document.addEventListener('keydown', onKeydown, true);
    });
  };
})();
