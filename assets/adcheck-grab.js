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
(function () {
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
    d.textContent = ok
      ? '상품 ' + slim.length + (total > slim.length ? '개(전체 ' + total + '개 중)' : '개')
        + '를 복사했습니다 — AdCheck 입력칸에 붙여넣으세요'
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
