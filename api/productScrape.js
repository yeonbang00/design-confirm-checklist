// GET /api/productScrape?url=<상품 링크>
// Returns: { sourceUrl, strategy, pageTitle, category, ogImage, itemCount, items:[...] }
//
// 상품 페이지를 서버에서 받아 구조화 데이터를 뽑는다. 브라우저에서 직접
// fetch하면 CORS에 막히므로 반드시 서버를 거친다.
//
// 세 단계로 찾는다. 신세계·홈플러스는 ①에서, 더현대는 ②에서 걸린다.
//   ① JSON-LD (Product / ItemList)
//   ② Next.js가 HTML에 심어둔 RSC 페이로드 (self.__next_f.push 조각을 이어붙임)
//   ③ og: 메타 태그
//
// User-Agent 주의: Chrome 데스크톱을 사칭하면 신세계가 403으로 막는다.
// 헤드리스 크롤러를 걸러내는 규칙으로 보이는데, Safari·구글봇·빈 UA는
// 통과한다. 그래서 Safari로 요청한다. (2026-09-03 3사 확인)
//
// 딜/기획전 페이지는 상품이 128개씩 들어있다. 하나만 골라 돌려주지 않고
// 목록을 그대로 넘겨 어떤 상품으로 배너를 만들지는 사람이 고르게 한다.

import { rejectIfNotSameOrigin } from './_originCheck.js';

// 요청 프로필 사다리. 앞에서부터 시도하고 4xx가 나오면 다음 걸로 넘어간다.
// 로컬에서는 Safari 하나로 3사가 다 됐는데, Vercel(데이터센터 IP)에서는
// 신세계가 417을 돌려줬다. 헤더 조합에 따라 통과하는 경우가 있어 몇 벌을
// 준비해뒀다. 그래도 막히면 수동 입력으로 넘어간다 — 클라우드 IP 자체를
// 막는 WAF는 헤더로 뚫을 수 없고, 뚫으려 드는 것도 옳지 않다.
const PROFILES = [
  { name: 'safari', headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9' } },
  { name: 'iphone', headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9' } },
  { name: 'minimal', headers: { 'Accept': '*/*' } },
];
const TIMEOUT_MS = 15000;
const MAX_ITEMS = 200;

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = String(v).replace(/[^\d]/g, '');
  return d ? Number(d) : null;
}

function meta(html, prop) {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + esc + '["\'][^>]*content=["\']([^"\']*)', 'i'));
  if (!m) m = html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + esc + '["\']', 'i'));
  return m ? m[1].trim() : null;
}

function ldjson(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const v = JSON.parse(m[1]);
      if (Array.isArray(v)) out.push(...v);
      else if (v && v['@graph']) out.push(...v['@graph']);
      else if (v) out.push(v);
    } catch (e) { /* 깨진 블록은 건너뛴다 */ }
  }
  return out;
}

// Next.js가 HTML 안에 흘려둔 RSC 스트림을 원문 문자열로 복원한다.
function rscPayload(html) {
  const re = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g;
  let m, out = '';
  while ((m = re.exec(html))) {
    try { out += JSON.parse(m[1]); } catch (e) { /* 조각 하나쯤 깨져도 나머지는 쓴다 */ }
  }
  return out;
}

function fromProduct(p) {
  let off = p.offers || {};
  if (Array.isArray(off)) off = off[0] || {};
  const sale = num(off.price);
  const orig = num((off.priceSpecification || {}).price);
  const imgs = Array.isArray(p.image) ? p.image.filter((i) => typeof i === 'string')
             : (typeof p.image === 'string' ? [p.image] : []);
  const brand = p.brand && typeof p.brand === 'object' ? p.brand.name : p.brand;
  const rat = p.aggregateRating || {};
  return {
    productName: p.name || null,
    brand: brand || null,
    salePrice: sale,
    originalPrice: orig && sale && orig > sale ? orig : null,
    discountAmount: orig && sale && orig > sale ? orig - sale : null,
    discountRate: orig && sale && orig > sale ? Math.round((orig - sale) / orig * 100) : null,
    description: p.description || null,
    mainImage: imgs[0] || null,
    images: imgs,
    rating: rat.ratingValue || null,
    reviewCount: num(rat.reviewCount),
    inStock: !String(off.availability || '').includes('OutOfStock'),
  };
}

async function fetchOnce(url, profile) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: profile.headers });
    return { status: r.status, ok: r.ok, text: r.ok ? await r.text() : null };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url) {
  const tried = [];
  for (const profile of PROFILES) {
    let r;
    try {
      r = await fetchOnce(url, profile);
    } catch (e) {
      tried.push(profile.name + ':' + (e.name === 'AbortError' ? 'timeout' : 'error'));
      continue;
    }
    if (r.ok && r.text) return r.text;
    tried.push(profile.name + ':' + r.status);
    if (r.status === 404) break;   // 없는 페이지면 다른 프로필로도 없다
  }
  const err = new Error(
    '이 쇼핑몰이 서버에서 보낸 요청을 막았습니다 (' + tried.join(', ') + ').'
  );
  err.status = 502;
  err.blocked = true;
  throw err;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const raw = (req.query && req.query.url) || '';
  let target;
  try {
    target = new URL(raw);
    if (!/^https?:$/.test(target.protocol)) throw new Error('bad protocol');
  } catch (e) {
    res.status(400).json({ error: '올바른 상품 링크가 아닙니다.' });
    return;
  }

  let html;
  try {
    html = await fetchHtml(target.href);
  } catch (err) {
    res.status(err.status || 502).json({
      error: err.name === 'AbortError'
        ? '상품 페이지 응답이 너무 느립니다.'
        : (err.message || '상품 정보를 가져오지 못했습니다.'),
    });
    return;
  }

  const blocks = ldjson(html);
  const ogImage = meta(html, 'og:image');
  const ogTitle = meta(html, 'og:title')
    || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim()
    || null;

  // 카테고리 (빵부스러기)
  let category = null;
  const crumb = blocks.find((b) => b && b['@type'] === 'BreadcrumbList');
  if (crumb && Array.isArray(crumb.itemListElement)) {
    const names = crumb.itemListElement
      .map((e) => (e && e.item && typeof e.item === 'object' ? e.item.name : e && e.name))
      .filter((n) => n && n !== '홈' && n !== 'Home');
    category = names.join(' > ') || null;
  }

  const out = { sourceUrl: target.href, strategy: null, pageTitle: ogTitle, category, ogImage, items: [] };

  const list = blocks.find((b) => b && b['@type'] === 'ItemList');
  const prods = blocks.filter((b) => b && b['@type'] === 'Product');

  if (list && Array.isArray(list.itemListElement) && list.itemListElement.length) {
    out.strategy = 'json-ld:ItemList';
    out.pageTitle = list.name || ogTitle;
    out.items = list.itemListElement
      .map((e) => e && e.item).filter(Boolean).slice(0, MAX_ITEMS).map(fromProduct);
  } else if (prods.length) {
    out.strategy = 'json-ld:Product';
    out.pageTitle = prods[0].name || ogTitle;
    const it = fromProduct(prods[0]);
    // image[0]이 제품 뒷면(성분표)인 몰이 있다. 홈플러스 초코하임이 그랬다.
    // 단일 상품 페이지에서는 사람이 고른 대표컷인 og:image를 우선한다.
    if (ogImage) {
      it.mainImage = ogImage;
      if (!it.images.includes(ogImage)) it.images = [ogImage, ...it.images];
    }
    out.items = [it];
  } else {
    const pl = rscPayload(html);
    const grab = (k) => {
      const m = pl.match(new RegExp('"' + k + '"\\s*:\\s*"?([^",}\\]]*)'));
      return m ? m[1] : null;
    };
    const name = grab('slitmNm') || grab('itemNm') || grab('goodsNm');
    if (name) {
      out.strategy = 'next-rsc';
      out.pageTitle = name;
      const imgs = [...new Set((pl.match(/https:\/\/image\.[a-z.]+\/[^\s"\\<>)]+?\.(?:jpg|jpeg|png)/gi) || []))];
      const sale = num(grab('sellPrc') || grab('dcPrc'));
      const orig = num(grab('csmPrc'));
      out.items = [{
        productName: name, brand: null, salePrice: sale,
        originalPrice: orig && sale && orig > sale ? orig : null,
        discountAmount: orig && sale && orig > sale ? orig - sale : null,
        discountRate: orig && sale && orig > sale ? Math.round((orig - sale) / orig * 100) : null,
        description: null, mainImage: ogImage || imgs[0] || null, images: imgs,
        rating: null, reviewCount: null, inStock: true,
      }];
    }
  }

  if (!out.items.length) {
    out.strategy = 'og-only';
    out.items = [{
      productName: ogTitle, brand: null, salePrice: null, originalPrice: null,
      discountAmount: null, discountRate: null,
      description: meta(html, 'og:description'), mainImage: ogImage, images: ogImage ? [ogImage] : [],
      rating: null, reviewCount: null, inStock: true,
    }];
  }

  out.itemCount = out.items.length;
  res.status(200).json(out);
}
