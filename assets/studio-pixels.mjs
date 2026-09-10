/* 픽셀을 재서 정하는 것들.
 *
 * 서버에는 이미지 처리 라이브러리가 없다(Sharp도 Canvas도 못 쓴다). 그런데
 * 브라우저에는 canvas가 있다. 몰 CDN은 CORS를 막아 브라우저가 직접 못 읽으니,
 * 서버가 바이트를 받아 base64로 주고(`/api/imageText`, ocr:false) 화면이 읽는다.
 * data: URL이라 캔버스가 오염되지 않는다.
 */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('사진을 열지 못했습니다.'));
    img.src = src;
  });
}

const cache = new Map();
export async function pixelsOf(url, getJSON) {
  if (cache.has(url)) return cache.get(url);
  const data = await getJSON('/api/imageText', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, ocr: false }),
  });
  if (!data || !data.base64) throw new Error('사진 바이트를 받지 못했습니다.');
  const img = await loadImage(`data:${data.mediaType || 'image/jpeg'};base64,${data.base64}`);
  // 큰 원본을 그대로 훑으면 느리다. 재는 데는 이 정도면 충분하다.
  const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const out = { img, canvas, ctx, w, h, full: { w: img.naturalWidth, h: img.naturalHeight } };
  cache.set(url, out);
  return out;
}

/* ---- 딤(스크림) 세기 ----
   조판마다 딤을 고정값으로 두고 있었다. 밝은 스튜디오컷에는 너무 진하고
   어두운 야외컷에는 모자란다. 글자가 놓일 자리의 밝기를 재서 정한다.
   WCAG 4.5:1을 목표로, 흰 글자면 그 자리를 얼마나 어둡게 해야 하는지 푼다. */
const lum = (r, g, b) => {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export function regionLuminance(px, box) {
  const x0 = Math.max(0, Math.round(box.x * px.w)), y0 = Math.max(0, Math.round(box.y * px.h));
  const x1 = Math.min(px.w, Math.round((box.x + box.w) * px.w));
  const y1 = Math.min(px.h, Math.round((box.y + box.h) * px.h));
  if (x1 <= x0 || y1 <= y0) return 0.5;
  const d = px.ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let sum = 0, n = 0;
  // 한 픽셀도 빠짐없이 볼 이유가 없다. 네 픽셀에 하나씩 본다.
  for (let i = 0; i < d.length; i += 16) { sum += lum(d[i], d[i + 1], d[i + 2]); n++; }
  return n ? sum / n : 0.5;
}

/* 흰 글자를 얹을 때 필요한 검은 딤의 불투명도.
   합성 후 밝기 L' = L*(1-a) 이고, 흰 글자 대비는 1.05/(L'+0.05) 이다.
   목표 대비 4.5를 만족하는 최소 a를 푼다. */
export function scrimAlpha(luminance, target = 4.5) {
  const need = 1.05 / target - 0.05;          // 배경이 이 밝기 아래여야 한다
  if (luminance <= need) return 0;
  const a = 1 - need / Math.max(luminance, 1e-6);
  return Math.min(0.82, Math.round(a * 100) / 100);
}

export async function scrimFor(url, box, getJSON) {
  try {
    const px = await pixelsOf(url, getJSON);
    const l = regionLuminance(px, box);
    return { alpha: scrimAlpha(l), luminance: Math.round(l * 100) / 100 };
  } catch { return null; }
}

/* ---- 누끼 ----
   가장자리에서 색이 비슷한 곳을 타고 들어가며 지운다. 흰 배경 단품컷에서
   된다. 실측으로 40개 상품 중 65%가 단색 배경 단품컷이었다.
   배경이 복잡하면 되지 않는다. 되는지 먼저 재고, 안 되면 손대지 않는다.
   억지로 지운 누끼는 원본보다 나쁘다. */
export function borderUniformity(px) {
  const d = px.ctx.getImageData(0, 0, px.w, px.h).data;
  const at = (x, y) => { const i = (y * px.w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const samples = [];
  const step = Math.max(1, Math.floor(px.w / 60));
  for (let x = 0; x < px.w; x += step) { samples.push(at(x, 0)); samples.push(at(x, px.h - 1)); }
  for (let y = 0; y < px.h; y += step) { samples.push(at(0, y)); samples.push(at(px.w - 1, y)); }
  const mean = samples.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
    .map(v => v / samples.length);
  const dev = Math.sqrt(samples.reduce((a, c) =>
    a + ((c[0] - mean[0]) ** 2 + (c[1] - mean[1]) ** 2 + (c[2] - mean[2]) ** 2) / 3, 0) / samples.length);
  return { mean, dev };
}

/* 배경 편차가 이 값보다 크면 단색 배경이 아니다. 실측 — 흰 배경 단품컷은
   3 이하, 실내 연출컷은 30 이상이었다. 사이 값은 그라데이션 배경이라
   지우면 얼룩이 남는다. 넉넉히 잡아 12에서 끊는다. */
export const UNIFORM_LIMIT = 12;

export async function cutout(url, getJSON, tolerance = 34) {
  const px = await pixelsOf(url, getJSON);
  const { mean, dev } = borderUniformity(px);
  if (dev > UNIFORM_LIMIT) return { ok: false, reason: '배경이 단색이 아닙니다', dev: Math.round(dev) };

  // 원본 크기로 다시 그려서 지운다. 재는 것과 쓰는 것은 크기가 다르다.
  const canvas = document.createElement('canvas');
  canvas.width = px.full.w; canvas.height = px.full.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(px.img, 0, 0);
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = im.data, W = canvas.width, H = canvas.height;

  const near = i => {
    const dr = d[i] - mean[0], dg = d[i + 1] - mean[1], db = d[i + 2] - mean[2];
    return Math.sqrt((dr * dr + dg * dg + db * db) / 3) <= tolerance;
  };
  // 가장자리에서 시작해 배경색이 이어지는 곳만 지운다. 상품 안쪽의 흰색은
  // 가장자리와 이어져 있지 않으므로 남는다.
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
  for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y); }
  let cleared = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (seen[p]) continue;
    const i = p * 4;
    if (!near(i)) continue;
    seen[p] = 1; d[i + 3] = 0; cleared++;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  const ratio = cleared / (W * H);
  // 다 지웠으면 상품까지 날아간 것이고, 거의 못 지웠으면 배경을 못 찾은 것이다
  if (ratio > 0.92 || ratio < 0.05) {
    return { ok: false, reason: '지운 넓이가 이상합니다', ratio: Math.round(ratio * 100) };
  }
  ctx.putImageData(im, 0, 0);
  return { ok: true, dataUrl: canvas.toDataURL('image/png'), ratio: Math.round(ratio * 100), dev: Math.round(dev) };
}


/* ---- 상품에서 색을 뽑는다 ----
   조판에 색을 박아 놨었다. type-diagonal은 빈폴 배너의 파랑, 숫자 띠는
   SSF의 주황, 하이라이트는 우리 라임. 레퍼런스에서 구조를 가져오면서 색까지
   같이 가져온 것이다. 그래서 설화수 배너에 빈폴 파랑이 떴다.
   색은 상품 사진에서 나와야 한다.

   방법 — 픽셀을 성기게 훑어 색을 모으고, 무채색(바탕)과 유채색(제품)을
   갈라 각각 대표값을 뽑는다. 바탕은 판의 바닥색이 되고, 제품에서 나온
   가장 진한 유채색이 강조색이 된다. */

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, sat, l];
}
const hslToHex = (h, s, l) => {
  const f = n => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export async function paletteFrom(url, getJSON) {
  try {
    const px = await pixelsOf(url, getJSON);
    const d = px.ctx.getImageData(0, 0, px.w, px.h).data;
    const chroma = [], grey = [];
    for (let i = 0; i < d.length; i += 40) {
      if (d[i + 3] < 200) continue;              // 누끼로 지운 자리
      const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      if (l < 0.06 || l > 0.97) continue;        // 완전한 검정·흰색은 바탕이다
      (s > 0.22 ? chroma : grey).push([h, s, l]);
    }
    if (!chroma.length && !grey.length) return null;

    // 색상환은 원형이라 평균을 그냥 내면 빨강과 자주가 초록이 된다. 벡터로 더한다.
    const hueOf = list => {
      let x = 0, y = 0;
      for (const [h] of list) { x += Math.cos(h * 2 * Math.PI); y += Math.sin(h * 2 * Math.PI); }
      const a = Math.atan2(y, x) / (2 * Math.PI);
      return a < 0 ? a + 1 : a;
    };
    const mid = (list, k) => {
      const v = list.map(c => c[k]).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)] || 0;
    };

    /* 인물이 있으면 피부가 화면의 상당 부분이라 그게 대표색이 된다. 살구빛
       계열(색상 15~45도, 채도 낮고 밝음)을 빼고 본다. 뺐더니 남는 게 거의
       없으면 그 상품은 정말 그 색이니 도로 넣는다. */
    const skin = ([h, s, l]) => h * 360 >= 12 && h * 360 <= 46 && s < 0.55 && l > 0.42;
    const notSkin = chroma.filter(c => !skin(c));
    const pool = notSkin.length > chroma.length * 0.25 ? notSkin : chroma;
    const src = pool.length > grey.length * 0.08 ? pool : grey;
    const h = hueOf(src);
    const s = mid(src, 1), l = mid(src, 2);

    // 강조색은 읽혀야 한다. 채도를 올리고 명도를 중간으로 당긴다.
    const accent = hslToHex(h, Math.min(0.92, Math.max(0.52, s * 1.6)), Math.min(0.52, Math.max(0.36, l * 0.8)));
    // 바닥은 같은 색상의 아주 옅은 판. 제품과 같은 계열이라 겉돌지 않는다.
    const ground = hslToHex(h, Math.min(0.16, s * 0.35), 0.945);
    const groundDeep = hslToHex(h, Math.min(0.22, s * 0.45), 0.9);
    const ink = hslToHex(h, Math.min(0.3, s * 0.5), 0.12);
    return { accent, ground, groundDeep, ink, hue: Math.round(h * 360), sat: Math.round(s * 100) };
  } catch { return null; }
}
