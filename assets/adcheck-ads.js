/* AdCheck 광고 담기 — 메타 광고 라이브러리용 북마클릿.
 *
 * 상품 북마클릿(adcheck-grab.js)은 글자만 클립보드에 담는다. 여기서는 그게
 * 안 된다. fbcdn 이미지 주소는 서명이 붙어 있어 나중에 우리 서버가 받으면
 * 403이다. 그 자리에서 이미지 자체를 받아야 하는데 80장이면 클립보드에
 * 넣을 크기가 아니다. 그래서 수집 페이지를 새 탭으로 열고 창끼리 직접 보낸다.
 *
 * 서버에서 이 페이지를 fetch하면 403이다. 렌더된 화면에서만 읽힌다.
 * 크롤러가 아니라 사용자가 이미 열어 둔 페이지에서 한 번 누르는 방식인 이유다.
 *
 * 이 파일은 북마클릿 안에 통째로 들어간다. 상품 담기처럼 우리 서버의 스크립트를
 * 불러오는 방식은 여기서 안 통한다 — 페이스북 CSP가 script-src-elem으로
 * 외부 스크립트를 막고 connect-src로 fetch까지 막는다(둘 다 실측).
 * 그래서 북마크에 코드가 박힌다. 고치면 사용자가 다시 끌어다 놓아야 하므로
 * 버전을 같이 보내고, 수집 페이지가 옛 북마클릿이면 알려 준다.
 */
(async function () {
  var ADS_V = 1;
  var HOST = 'https://2026-adcheck.vercel.app';
  var COLLECT = HOST + '/reference-collect.html';

  function toast(msg, ms) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:2147483647;'
      + 'background:#12151A;color:#EDEEF0;font:600 13px/1.5 -apple-system,sans-serif;'
      + 'padding:12px 18px;border-radius:10px;border:1px solid #C3FF4D;box-shadow:0 12px 40px rgba(0,0,0,.5)';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, ms || 3000);
    return d;
  }

  if (!/facebook\.com\/ads\/library/.test(location.href)) {
    toast('메타 광고 라이브러리에서 눌러주세요.', 5000);
    return;
  }

  /* 더 불러오려면 끝까지 내려야 한다. 29장에서 41장으로 늘어나는 것을 실측했다. */
  function sweep(rounds) {
    var back = window.scrollY, n = 0;
    return new Promise(function (done) {
      (function next() {
        if (n++ >= rounds) {
          window.scrollTo(0, back); setTimeout(done, 600); return;
        }
        window.scrollTo(0, document.body.scrollHeight);
        setTimeout(next, 1100);
      })();
    });
  }

  function cardOf(el) {
    var n = el;
    for (var i = 0; i < 14 && n; i++) {
      if (n.querySelector && (n.querySelector('img[src*="fbcdn"]') || n.querySelector('video'))) return n;
      n = n.parentElement;
    }
    return null;
  }

  /* 영상 판별. 110장을 훑었을 때 신호 넷이 같이 움직였고 어긋난 카드가 1장이었다.
     그중 svg 개수는 빼고 확실한 셋만 쓴다. 신호 하나가 헛짚으면 멀쩡한 이미지를
     통째로 버리는데, 반대로 영상이 하나 새어 들어와도 9:16이라 기본 선택에서
     빠지고 사람이 한 번 더 보고 고른다. 놓치는 쪽이 더 싸다. */
  function isVideo(c) {
    return c.querySelectorAll('video').length > 0
      || /\d:\d\d \/ \d:\d\d/.test(c.innerText)
      || !!c.querySelector('[aria-label*="재생"],[aria-label*="Play"]');
  }

  function ratioName(w, h) {
    var r = w / h;
    if (r >= 0.95 && r <= 1.05) return '1:1';
    if (r >= 0.75 && r < 0.95) return '4:5';
    if (r < 0.75) return '9:16';
    return 'wide';
  }

  /* 64비트 지문. 같은 소재가 광고마다 다른 파일명으로 올라오므로 파일명으로는 못 잡는다.
     축소를 drawImage에 맡기면 안 된다. 캔버스 옵션(willReadFrequently)에 따라
     GPU와 소프트웨어 경로가 갈리고, 같은 그림인데 지문이 17비트까지 벌어진다(실측).
     임계 8을 훌쩍 넘어 대조가 아예 안 된다. 기계나 브라우저가 바뀌어도 같은 문제다.
     그래서 1:1로 그려 픽셀을 그대로 읽고 9x8 평균은 직접 낸다. 두 경로 차이 0비트. */
  function hashOf(bm) {
    var cv = document.createElement('canvas');
    cv.width = bm.width; cv.height = bm.height;
    var cx = cv.getContext('2d');
    cx.drawImage(bm, 0, 0);
    var d = cx.getImageData(0, 0, bm.width, bm.height).data;
    var W = 9, H = 8, g = new Float64Array(W * H), n = new Float64Array(W * H);
    for (var y = 0; y < bm.height; y++) {
      var gy = Math.min(H - 1, (y * H / bm.height) | 0);
      for (var x = 0; x < bm.width; x++) {
        var gx = Math.min(W - 1, (x * W / bm.width) | 0);
        var i = (y * bm.width + x) * 4, k = gy * W + gx;
        g[k] += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        n[k]++;
      }
    }
    var bits = '';
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W - 1; xx++) {
      bits += (g[yy * W + xx] / n[yy * W + xx]) > (g[yy * W + xx + 1] / n[yy * W + xx + 1]) ? '1' : '0';
    }
    return bits;
  }

  function dist(a, b) { var n = 0; for (var i = 0; i < 64; i++) if (a[i] !== b[i]) n++; return n; }

  var busy = toast('광고를 훑는 중… 페이지가 스크롤됩니다', 60000);
  await sweep(8);

  var marks = [].filter.call(document.querySelectorAll('span,div'), function (e) {
    return /^라이브러리 ID: \d+$/.test(e.textContent.trim()) && e.children.length === 0;
  });

  var raw = [];
  marks.forEach(function (m) {
    var c = cardOf(m); if (!c || isVideo(c)) return;
    var imgs = [].filter.call(c.querySelectorAll('img[src*="fbcdn"]'), function (i) { return i.naturalWidth >= 200; });
    if (!imgs.length) return;
    imgs.sort(function (a, b) { return b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight; });
    var t = c.innerText;
    var lines = t.split('\n').filter(function (x) { return x.trim() && x !== '\u200b'; });
    var bi = lines.indexOf('광고');
    var link = [].filter.call(c.querySelectorAll('a'), function (a) {
      return /l\.facebook\.com\/l\.php/.test(a.getAttribute('href') || '');
    })[0];
    raw.push({
      id: (t.match(/ID: (\d+)/) || [])[1] || '',
      brand: bi > 0 ? lines[bi - 1] : '',
      started: (t.match(/(\d{4}\. \d+\. \d+\.)/) || [])[1] || '',
      copy: lines.slice(bi + 1).join(' ').replace(/\s+/g, ' ').slice(0, 400),
      cta: (t.match(/\n(지금 구매하기|Shop Now|더 알아보기|Learn More|자세히 알아보기|주문하기|신청하기|Sign Up|Install Now|지금 개통하기)/) || [])[1] || '',
      landing: (t.match(/\n([A-Z0-9.\-]+\.(?:CO\.KR|COM|KR|NET|IO))\n/) || [])[1] || '',
      adUrl: link ? link.getAttribute('href') : '',
      src: imgs[0].src,
    });
  });

  if (!raw.length) { busy.remove(); toast('이미지 광고를 찾지 못했습니다. 영상만 있는 브랜드일 수 있습니다.', 7000); return; }

  // 이미지를 실제로 받아 온다. 이 페이지에서만 받을 수 있다(서명이 붙어 있다).
  var items = [];
  for (var i = 0; i < raw.length; i++) {
    try {
      var r = await fetch(raw[i].src);
      if (!r.ok) continue;
      var blob = await r.blob();
      var bm = await createImageBitmap(blob);
      items.push(Object.assign({}, raw[i], {
        bytes: await blob.arrayBuffer(), mime: blob.type || 'image/jpeg',
        w: bm.width, h: bm.height, ratio: ratioName(bm.width, bm.height), hash: hashOf(bm),
      }));
      bm.close && bm.close();
    } catch (e) { /* 한 장 실패해도 계속 */ }
    busy.textContent = '이미지 받는 중 ' + items.length + ' / ' + raw.length;
  }
  busy.remove();
  if (!items.length) { toast('이미지를 받지 못했습니다.', 6000); return; }

  /* 같은 그림끼리 묶는다. 임계 8에서 45장 중 6장이 걸렸고, 9~16 구간이 거의
     비어 있어 값에 민감하지 않다. 묶인 것은 첫 장만 기본 선택으로 둔다. */
  items.forEach(function (x, i) { x.dup = 0; x.i = i; });
  for (var a = 0; a < items.length; a++) {
    if (items[a].dup) continue;
    for (var b = a + 1; b < items.length; b++) {
      if (!items[b].dup && dist(items[a].hash, items[b].hash) <= 8) items[b].dup = items[a].i + 1;
    }
  }
  pick(items);

  /* 그냥 다 담으면 안 쓸 것까지 들어온다. 영상을 걸러도 세로형과 중복과
     남의 브랜드가 남는다. 담기 전에 눈으로 보고 고르는 자리를 둔다. */
  function pick(list) {
    var brands = [];
    list.forEach(function (x) { if (x.brand && brands.indexOf(x.brand) < 0) brands.push(x.brand); });
    var chosen = {};
    // 세로형과 중복은 기본으로 꺼 둔다. 1:1과 4:5만 배너 조판 힌트로 쓸 수 있다.
    list.forEach(function (x) { chosen[x.i] = !x.dup && x.ratio !== '9:16' && x.ratio !== 'wide'; });

    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(8,9,11,.96);'
      + 'overflow:auto;padding:20px;font:13px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;color:#EDEEF0';
    ov.innerHTML = '<div style="max-width:1180px;margin:0 auto">'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
      + '<b style="font-size:17px">AdCheck 광고 담기</b>'
      + '<span id="ac-count" style="color:#A2A7B0;font-size:12.5px"></span>'
      + '<span style="flex:1"></span>'
      + '<select id="ac-brand" style="font:inherit;padding:7px 10px;border-radius:8px;background:#14171C;color:#EDEEF0;border:1px solid #30343B"></select>'
      + '<button id="ac-all" style="font:inherit;font-weight:600;padding:8px 13px;border-radius:8px;background:#14171C;color:#EDEEF0;border:1px solid #30343B;cursor:pointer">전체 선택</button>'
      + '<button id="ac-none" style="font:inherit;font-weight:600;padding:8px 13px;border-radius:8px;background:#14171C;color:#EDEEF0;border:1px solid #30343B;cursor:pointer">전체 해제</button>'
      + '<button id="ac-go" style="font:inherit;font-weight:700;padding:8px 18px;border-radius:8px;background:#C3FF4D;color:#10120C;border:0;cursor:pointer">담기</button>'
      + '<button id="ac-x" style="font:inherit;padding:8px 13px;border-radius:8px;background:none;color:#A2A7B0;border:1px solid #30343B;cursor:pointer">닫기</button>'
      + '</div>'
      + '<div id="ac-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:14px"></div>'
      + '</div>';
    document.body.appendChild(ov);

    var sel = ov.querySelector('#ac-brand');
    sel.innerHTML = '<option value="">광고주 전체</option>'
      + brands.map(function (b) { return '<option>' + b.replace(/</g, '&lt;') + '</option>'; }).join('');

    var grid = ov.querySelector('#ac-grid');
    var urls = [];
    list.forEach(function (x) {
      var u = URL.createObjectURL(new Blob([x.bytes], { type: x.mime }));
      urls.push(u);
      var card = document.createElement('label');
      card.dataset.brand = x.brand;
      card.style.cssText = 'display:block;cursor:pointer;min-width:0';
      card.innerHTML = '<span style="position:relative;display:block">'
        + '<img src="' + u + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:9px;display:block">'
        + '<input type="checkbox" data-i="' + x.i + '"' + (chosen[x.i] ? ' checked' : '')
        + ' style="position:absolute;top:8px;left:8px;width:19px;height:19px;accent-color:#C3FF4D">'
        + '<span style="position:absolute;top:8px;right:8px;background:#0B0C0Ecc;border-radius:5px;padding:2px 6px;font-size:10.5px">'
        + x.ratio + '</span></span>'
        + '<span style="display:block;margin-top:6px;font-size:11.5px;font-weight:600;color:#EDEEF0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + (x.brand || '').replace(/</g, '&lt;') + '</span>'
        + '<span style="display:block;font-size:10.5px;color:#7E838C;line-height:1.45;max-height:2.9em;overflow:hidden">'
        + (x.dup ? '같은 그림 · ' : '') + (x.copy || '').slice(0, 48).replace(/</g, '&lt;') + '</span>';
      grid.appendChild(card);
    });

    function boxes() { return [].slice.call(grid.querySelectorAll('input')); }
    function shown(cb) {
      var b = sel.value;
      return !b || cb.closest('label').dataset.brand === b;
    }
    function count() {
      var n = boxes().filter(function (c) { return c.checked && shown(c); }).length;
      ov.querySelector('#ac-count').textContent = '이미지 ' + list.length + '장 · 고른 것 ' + n + '장';
      ov.querySelector('#ac-go').textContent = '담기 (' + n + ')';
    }
    grid.addEventListener('change', count);
    sel.addEventListener('change', function () {
      boxes().forEach(function (c) { c.closest('label').style.display = shown(c) ? '' : 'none'; });
      count();
    });
    ov.querySelector('#ac-all').onclick = function () { boxes().forEach(function (c) { if (shown(c)) c.checked = true; }); count(); };
    ov.querySelector('#ac-none').onclick = function () { boxes().forEach(function (c) { if (shown(c)) c.checked = false; }); count(); };
    ov.querySelector('#ac-x').onclick = function () { urls.forEach(URL.revokeObjectURL); ov.remove(); };
    count();

    ov.querySelector('#ac-go').onclick = function () {
      var take = boxes().filter(function (c) { return c.checked && shown(c); })
        .map(function (c) { return list[Number(c.dataset.i)]; });
      if (!take.length) { toast('고른 것이 없습니다.', 3000); return; }
      var payload = take.map(function (x) {
        return {
          brand: x.brand, libraryId: x.id, started: x.started, copy: x.copy,
          cta: x.cta, landing: x.landing, adUrl: x.adUrl,
          w: x.w, h: x.h, ratio: x.ratio, hash: x.hash, mime: x.mime, bytes: x.bytes,
        };
      });
      var win = window.open(COLLECT, 'adcheck-collect');
      if (!win) { toast('팝업이 막혔습니다. 이 사이트의 팝업을 허용해주세요.', 8000); return; }
      var sent = false;
      function handshake(e) {
        if (e.source !== win || e.data !== 'adcheck-collect-ready' || sent) return;
        sent = true;
        win.postMessage({ kind: 'adcheck-ads', v: ADS_V, items: payload }, HOST);
        window.removeEventListener('message', handshake);
        urls.forEach(URL.revokeObjectURL);
        ov.remove();
        toast(payload.length + '장을 보냈습니다. 새 탭에서 업종을 고르고 등록하세요.', 6000);
      }
      window.addEventListener('message', handshake);
      setTimeout(function () {
        if (!sent) toast('수집 페이지가 응답하지 않습니다. 로그인 상태를 확인해주세요.', 8000);
      }, 20000);
    };
  }
})();
