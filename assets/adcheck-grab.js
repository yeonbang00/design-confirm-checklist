/* AdCheck 상품 담기 — 북마클릿용 원본.
 *
 * 쇼핑몰이 서버에서 보낸 요청을 막는 경우가 있다(신세계는 Vercel에서 417).
 * IP나 클라이언트 지문을 보고 막는 것이라 헤더로는 못 뚫고, 뚫으려 드는 것도
 * 옳지 않다. 그래서 방향을 바꾼다 — 사용자가 이미 열어 둔 그 페이지에서,
 * 사용자의 브라우저로 읽는다. 우회가 아니라 원래 볼 수 있는 것을 읽는 것이다.
 *
 * 상품 페이지에서 북마클릿을 누르면 상품 정보를 클립보드에 담고,
 * AdCheck 입력칸에 붙여넣으면 된다.
 */
(async function () {
  /* 상세 페이지 컷은 스크롤해야 뜬다(lazy-load). 안 훑고 읽으면 대표컷
     한 장만 잡히고, 시안 여섯 장이 전부 같은 사진이 된다.
     페이지를 한 번 훑어 내렸다가 원래 자리로 돌아온다. */
  function sweep() {
    var back = window.scrollY, step = Math.round(innerHeight * 0.9), y = 0, n = 0;
    return new Promise(function (done) {
      (function next() {
        if (n++ > 60 || y > document.body.scrollHeight) {
          window.scrollTo(0, back); setTimeout(function () { done(); }, 350); return;
        }
        window.scrollTo(0, y); y += step; setTimeout(next, 90);
      })();
    });
  }

  function meta(p) {
    var el = document.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]');
    return el ? el.content : null;
  }
  function num(v) {
    if (v == null || v === '') return null;
    var d = String(v).replace(/[^\d]/g, '');
    return d ? Number(d) : null;
  }
  function ld() {
    var out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      try {
        var v = JSON.parse(s.textContent);
        if (Array.isArray(v)) out = out.concat(v);
        else if (v && v['@graph']) out = out.concat(v['@graph']);
        else if (v) out.push(v);
      } catch (e) {}
    });
    return out;
  }
  function fromProduct(p) {
    var off = p.offers || {}; if (Array.isArray(off)) off = off[0] || {};
    var sale = num(off.price);
    var orig = num((off.priceSpecification || {}).price);
    var imgs = Array.isArray(p.image) ? p.image.filter(function (i) { return typeof i === 'string'; })
             : (typeof p.image === 'string' ? [p.image] : []);
    var brand = p.brand && typeof p.brand === 'object' ? p.brand.name : p.brand;
    return {
      productName: p.name || null, brand: brand || null,
      salePrice: sale, originalPrice: (orig && sale && orig > sale) ? orig : null,
      discountRate: (orig && sale && orig > sale) ? Math.round((orig - sale) / orig * 100) : null,
      description: p.description || null, mainImage: imgs[0] || null, images: imgs,
    };
  }

  /* og:image나 JSON-LD image[]가 작은 판형인 몰이 있다. 신세계는 og:image가
     275px(_i_)이고 원본은 1254px(_l_)이다. 썸네일을 AI에 넣으면 얼굴이
     40px짜리가 되어 인물이 뭉개진다.
     주소 규칙을 추측하지 않고, 페이지에 실제로 떠 있는 이미지를 재서
     같은 상품의 더 큰 판형이 있으면 그걸 쓴다. */
  function loadedImages() {
    return Array.prototype.slice.call(document.images)
      .filter(function (i) { return i.naturalWidth >= 240 && i.currentSrc; })
      .map(function (i) {
        // 상세 영역 안에 있는지 본다. 상세컷은 배너에서 다른 종류의 소재라
        // 대표컷과 섞지 않고 따로 표시한다.
        var inDetail = !!i.closest('[class*="detail" i],[id*="detail" i],[class*="desc" i],'
                                 + '[id*="desc" i],[class*="prd-info" i],[class*="goods-cont" i]');
        return { url: i.currentSrc.split('?')[0], w: i.naturalWidth, h: i.naturalHeight, detail: inDetail };
      });
  }

  function biggestOf(url, pool) {
    if (!url) return url;
    var bare = String(url).split('?')[0];
    // 파일명에서 숫자·판형 표시를 뺀 '뿌리'가 같으면 같은 사진으로 본다
    var root = bare.replace(/\/[^/]*$/, '') + '/' + (bare.split('/').pop() || '')
                 .replace(/_[a-z]_/i, '_').replace(/\.[a-z]+$/i, '');
    var same = pool.filter(function (p) {
      var r = p.url.replace(/\/[^/]*$/, '') + '/' + (p.url.split('/').pop() || '')
                .replace(/_[a-z]_/i, '_').replace(/\.[a-z]+$/i, '');
      return r === root;
    });
    if (!same.length) return bare;
    same.sort(function (a, b) { return b.w - a.w; });
    return same[0].w > 400 ? same[0].url : bare;
  }

  var busy = document.createElement('div');
  busy.textContent = '상품 사진을 모으는 중… 페이지가 잠깐 스크롤됩니다';
  busy.style.cssText = 'position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:2147483647;'
    + 'background:#12151A;color:#EDEEF0;font:600 13px/1.5 -apple-system,sans-serif;'
    + 'padding:12px 18px;border-radius:10px;border:1px solid #C3FF4D';
  document.body.appendChild(busy);
  await sweep();
  busy.remove();

  var pool = loadedImages();
  var blocks = ld();
  var crumb = blocks.filter(function (b) { return b && b['@type'] === 'BreadcrumbList'; })[0];
  var category = null;
  if (crumb && crumb.itemListElement) {
    category = crumb.itemListElement.map(function (e) {
      return (e.item && typeof e.item === 'object') ? e.item.name : e.name;
    }).filter(function (n) { return n && n !== '홈' && n !== 'Home'; }).join(' > ') || null;
  }

  var list = blocks.filter(function (b) { return b && b['@type'] === 'ItemList'; })[0];
  var prods = blocks.filter(function (b) { return b && b['@type'] === 'Product'; });
  var items = [], strategy = 'og-only';

  if (list && list.itemListElement && list.itemListElement.length) {
    strategy = 'json-ld:ItemList';
    items = list.itemListElement.map(function (e) { return e.item; })
      .filter(Boolean).slice(0, 200).map(fromProduct);
  } else if (prods.length) {
    strategy = 'json-ld:Product';
    var it = fromProduct(prods[0]);
    var og = meta('og:image');
    // image[0]이 제품 뒷면인 몰이 있다. 사람이 고른 대표컷을 우선한다.
    if (og) { it.mainImage = og; if (it.images.indexOf(og) < 0) it.images.unshift(og); }
    it.mainImage = biggestOf(it.mainImage, pool);
    /* 같은 상품의 다른 컷을 모은다.
       예전에는 (가) 대표컷 파일명의 상품 코드가 들어간 것만 남기고
       (나) 세로로 긴 것을 버렸다. 그 두 줄 때문에 SSF처럼 상세 컷이 다른
       경로에 있는 몰에서는 대표컷 한 장만 남았고, 시안 여섯 장이 전부
       같은 사진이 됐다.

       이제는 버리지 않고 점수로 줄을 세운다. 상품 코드가 있으면 강한
       가산점이고, 없어도 상세 영역 안이면 남긴다. 세로로 긴 컷은
       'detail'로 표시해 두고, 배너 비율은 나중에 잘라 쓴다. */
    var code = (String(it.mainImage || '').split('/').pop().match(/\d{6,}/) || [])[0];
    var mainBare = String(it.mainImage || '').split('?')[0];
    var scored = pool.map(function (q) {
      var s = 0, r = q.h / q.w;
      if (code && q.url.indexOf(code) >= 0) s += 100;
      if (q.detail) s += 40;
      if (q.w >= 700) s += 20; else if (q.w >= 400) s += 10;
      if (r > 0.6 && r < 1.8) s += 15;          // 배너에 바로 얹기 좋은 비율
      if (r >= 3) s -= 25;                       // 통짜 스크롤 이미지는 뒤로
      if (/logo|icon|sprite|banner|badge|btn|blank|dummy/i.test(q.url)) s -= 60;
      return { url: q.url, w: q.w, h: q.h, tall: r >= 1.7, score: s };
    }).filter(function (q) {
      return q.score > 0 && q.w >= 400 && q.url.split('?')[0] !== mainBare;
    }).sort(function (a, b) { return b.score - a.score || b.w * b.h - a.w * a.h; });

    // 같은 사진의 다른 판형이 여러 장 잡힌다. 뿌리가 같으면 큰 것만 남긴다.
    var seen = {}, picked = [];
    scored.forEach(function (q) {
      var root = q.url.replace(/\/[^/]*$/, '') + '/' + (q.url.split('/').pop() || '')
                  .replace(/_[a-z]_/i, '_').replace(/\.[a-z]+$/i, '');
      if (seen[root]) return;
      seen[root] = 1; picked.push(q);
    });

    it.meta = [{ url: it.mainImage, w: 0, h: 0, tall: false }].concat(picked.slice(0, 9));
    it.images = it.meta.map(function (q) { return q.url; });
    it.imageCount = it.images.length;
    items = [it];
  } else {
    // 마지막 수단 — 화면에 보이는 것에서 긁는다
    var big = Array.prototype.slice.call(document.images)
      .filter(function (i) { return i.naturalWidth >= 400; })
      .sort(function (a, b) { return b.naturalWidth - a.naturalWidth; });
    var priceText = (document.body.innerText.match(/[\d,]{4,}\s*원/) || [])[0];
    items = [{
      productName: meta('og:title') || document.title, brand: null,
      salePrice: num(priceText), originalPrice: null, discountRate: null,
      description: meta('og:description'),
      mainImage: (big[0] && big[0].currentSrc) || meta('og:image'),
      images: big.slice(0, 8).map(function (i) { return i.currentSrc; }),
      meta: big.slice(0, 8).map(function (i) {
        return { url: i.currentSrc, w: i.naturalWidth, h: i.naturalHeight,
                 tall: i.naturalHeight / i.naturalWidth >= 1.7 };
      }),
    }];
  }

  // 붙여넣을 것이라 작아야 한다. 128개 딜이면 41KB까지 나온다.
  // 고를 만큼만 남기고, 배너에 안 쓰는 필드는 턴다.
  var total = items.length;
  var slim = items.slice(0, 40).map(function (it) {
    return {
      productName: it.productName, brand: it.brand,
      salePrice: it.salePrice, originalPrice: it.originalPrice,
      discountRate: it.discountRate, mainImage: it.mainImage,
      // 상품이 여러 개인 딜 페이지에서도 각 상품의 컷을 담는다. 예전에는
      // 클립보드가 커진다고 단일 상품일 때만 담았는데, 그러면 딜에서 상품을
      // 고른 뒤 원본을 쓸 방법이 없어진다. 개수를 줄여 담는다.
      images: (it.images || []).slice(0, total === 1 ? 10 : 3),
      // 크기와 세로 여부를 함께 보낸다. 분류가 실패해도 이 값만으로
      // 상세컷을 골라낼 수 있어 시안 종류가 무너지지 않는다.
      imageMeta: (it.meta || []).slice(0, total === 1 ? 10 : 3),
      description: (it.description || '').slice(0, 120) || null,
    };
  });
  var payload = {
    _adcheck: 'product', sourceUrl: location.href, strategy: strategy,
    category: category, itemCount: total, truncated: total > slim.length, items: slim,
  };
  var text = JSON.stringify(payload);

  function done(ok) {
    var d = document.createElement('div');
    var imgN = (slim[0] && slim[0].images && slim[0].images.length) || 0;
    d.textContent = ok
      ? '상품 ' + slim.length + (total > slim.length ? '개(전체 ' + total + '개 중)' : '개')
        + (imgN > 1 ? ' · 이미지 ' + imgN + '장' : '')
        + '를 복사했습니다. AdCheck 입력칸에 붙여넣으세요'
      : '복사에 실패했습니다. 아래 상자의 내용을 직접 복사하세요.';
    d.style.cssText = 'position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:2147483647;'
      + 'background:#12151A;color:#EDEEF0;font:600 13px/1.5 -apple-system,sans-serif;'
      + 'padding:12px 18px;border-radius:10px;border:1px solid #C3FF4D;box-shadow:0 12px 40px rgba(0,0,0,.5)';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, ok ? 3000 : 12000);
    if (!ok) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:2147483647;'
        + 'width:min(680px,86vw);height:180px;padding:10px;border-radius:8px;border:1px solid #444;'
        + 'background:#0B0C0E;color:#EDEEF0;font:12px monospace';
      document.body.appendChild(ta); ta.select();
      setTimeout(function () { ta.remove(); }, 30000);
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
  } else { done(false); }
})();
