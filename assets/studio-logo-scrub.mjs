/* 상품 사진에 덧씌워진 브랜드 로고를 지운다.
 *
 * 왜 픽셀을 직접 덮는가 — 생성 모델에게 "이 로고를 지워라"라고 시켜도
 * 지워지지 않는다. 좌표를 문장으로 적어 줘도 마찬가지였다. 시험한 세 번 모두
 * 원본의 워드마크가 결과물에 그대로 남았다. 픽셀을 먼저 덮은 뒤 생성해야
 * 사라진다.
 *
 * 무엇을 로고로 보는가 — 덧씌운 워드마크는 장면 안의 글자(간판·표지판)보다
 * 훨씬 크게 그려진다. 실측한 사진에서 로고는 79px, 장면 안 간판은 39px
 * 이하였다. 그래서 (가) 가장 큰 글자 뭉치가 나머지보다 1.5배 이상 크고
 * (나) 그 뭉치가 화면 가장자리 띠 안에 있을 때만 지운다.
 * 조건이 안 맞으면 아무것도 지우지 않는다 — 장면 속 간판을 뭉개는 쪽이
 * 로고가 남는 쪽보다 나쁘다.
 */

const EDGE_BAND = 0.25;   // 위아래 각 25% 안에 있어야 덧씌운 것으로 본다
const TIER_GAP = 1.5;     // 가장 큰 글자가 그다음 크기보다 이만큼은 커야 한다
const SAME_TIER = 0.7;    // 가장 큰 것의 70% 이상이면 같은 로고의 일부로 묶는다

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('사진을 열지 못했습니다.'));
    img.src = src;
  });
}

// 상자 둘레의 색을 가져다 상자를 덮는다. 단색 배경 위 로고는 이걸로 사라지고,
// 무늬 위였다면 흐릿한 자국이 남는데 그 자국은 생성 단계에서 다시 그려진다.
function patch(ctx, box, W, H) {
  const pad = Math.max(4, Math.round(box.h * 0.3));
  const x0 = Math.max(0, box.x - pad), y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(W, box.x + box.w + pad), y1 = Math.min(H, box.y + box.h + pad);
  const ring = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const inX0 = box.x - x0, inY0 = box.y - y0, inX1 = inX0 + box.w, inY1 = inY0 + box.h;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < ring.height; y++) {
    for (let x = 0; x < ring.width; x++) {
      if (x >= inX0 && x < inX1 && y >= inY0 && y < inY1) continue;
      const i = (y * ring.width + x) * 4;
      r += ring.data[i]; g += ring.data[i + 1]; b += ring.data[i + 2]; n++;
    }
  }
  if (!n) return;
  ctx.save();
  ctx.filter = 'blur(2px)';
  ctx.fillStyle = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

export function pickOverlay(boxes, W, H) {
  if (!boxes || boxes.length < 1) return [];
  const sorted = [...boxes].sort((a, b) => b.h - a.h);
  const maxh = sorted[0].h;
  const rest = sorted.filter(b => b.h < maxh * SAME_TIER);
  // 글자 크기가 고르면 덧씌운 층이 없다는 뜻이다. 손대지 않는다.
  if (rest.length && maxh / rest[0].h < TIER_GAP) return [];
  if (!rest.length && boxes.length > 3) return [];
  return sorted.filter(b => {
    if (b.h < maxh * SAME_TIER) return false;
    const cy = (b.y + b.h / 2) / H;
    return cy <= EDGE_BAND || cy >= 1 - EDGE_BAND;
  });
}

/* url 하나를 받아 로고를 지운 PNG를 돌려준다.
   지울 것이 없거나 실패하면 null — 호출부는 원본을 그대로 쓴다. */
export async function scrubLogo(url, getJSON) {
  const data = await getJSON('/api/imageText', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!data || !data.base64 || !Array.isArray(data.boxes) || !data.boxes.length) return null;

  const img = await loadImage(`data:${data.mediaType || 'image/jpeg'};base64,${data.base64}`);
  const W = img.naturalWidth, H = img.naturalHeight;
  const hits = pickOverlay(data.boxes, W, H);
  if (!hits.length) return null;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  for (const box of hits) patch(ctx, box, W, H);

  const dataUrl = canvas.toDataURL('image/png');
  return {
    dataUrl,
    base64: dataUrl.split(',')[1],
    mediaType: 'image/png',
    removed: hits.map(h => h.text).filter(Boolean).join(' '),
  };
}
