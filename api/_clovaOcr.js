// Optional precision layer for 3번(타이포·정렬): Naver CLOVA General OCR gives
// exact pixel bounding boxes for each detected text element, which lets us
// hand the AI real px coordinates instead of relying purely on its visual
// estimate (vision models can't measure exact pixels — see the currency/
// safe-zone px instructions elsewhere in analyze.js for the same pattern).
//
// Fails soft everywhere: if CLOVA_OCR_INVOKE_URL/CLOVA_OCR_SECRET_KEY aren't
// set, or the call errors for any reason, returns null and the caller falls
// back to AI-vision-only judgment for alignment — this never blocks the
// main analysis.
//
// The CLOVA OCR secret key lives ONLY in this server-side environment
// variable. It is never sent to, or reachable from, the browser.

const CLOVA_LANG = 'ko';

export async function runOcr(base64, mediaType) {
  const invokeUrl = process.env.CLOVA_OCR_INVOKE_URL;
  const secretKey = process.env.CLOVA_OCR_SECRET_KEY;
  if (!invokeUrl || !secretKey || !base64 || !mediaType) return null;

  const format = (mediaType.split('/')[1] || 'jpg').toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'tif', 'tiff', 'pdf'].includes(format)) return null;

  try {
    const response = await fetch(invokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': secretKey,
      },
      body: JSON.stringify({
        version: 'V2',
        requestId: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        timestamp: Date.now(),
        lang: CLOVA_LANG,
        images: [{ format, name: 'banner', data: base64 }],
      }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    const fields = data && data.images && data.images[0] && data.images[0].fields;
    if (!Array.isArray(fields) || !fields.length) return null;
    return fields;
  } catch (e) {
    return null;
  }
}

// Turns raw CLOVA fields into a compact, prompt-ready text block listing
// each detected text element's exact pixel bounding box. Deliberately does
// NOT try to cluster words into lines or guess which elements should align
// with which — the AI can see the actual image and decide that; this just
// supplies ground-truth coordinates it can't measure itself.
export function formatOcrForPrompt(fields) {
  if (!fields || !fields.length) return '';
  const lines = fields.slice(0, 60).map((f) => {
    const text = (f.inferText || '').trim();
    if (!text) return null;
    const verts = (f.boundingPoly && f.boundingPoly.vertices) || [];
    if (!verts.length) return null;
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    const left = Math.round(Math.min(...xs));
    const right = Math.round(Math.max(...xs));
    const top = Math.round(Math.min(...ys));
    const bottom = Math.round(Math.max(...ys));
    const centerX = Math.round((left + right) / 2);
    const centerY = Math.round((top + bottom) / 2);
    return `"${text}" — 좌측 ${left}px, 우측 ${right}px, 가로중심 ${centerX}px, 세로중심 ${centerY}px`;
  }).filter(Boolean);
  if (!lines.length) return '';

  return `\n\nOCR 측정 텍스트 위치 (정확한 픽셀 좌표, 참고용 — 이미지를 직접 측정한 값이니 시각적 추측보다 신뢰하세요):
${lines.join('\n')}

3번(타이포·정렬) 판정 시 이 좌표를 활용하세요: 위아래로 쌓인 제목·부제목처럼 서로 정렬이 의도된 것으로 보이는 텍스트들의 가로중심(중앙정렬 의도) 또는 좌측 좌표(좌측정렬 의도)를 비교하세요. 5px 이내 차이는 정상적인 렌더링 오차로 간주해 문제 삼지 마세요. 그보다 크게 차이나면(대략 8px 이상) 3번을 reject로 판정하고, note에 어느 텍스트끼리 몇 px 차이나는지 구체적으로 적으세요 (예: "'부하우스'와 '압축파우치·롤링캐리백' 가로중심이 12px 어긋남"). OCR이 텍스트를 잘못 인식했거나 이 좌표만으로 판단하기 애매하면 억지로 반려하지 말고 시각적 판단을 우선하세요.`;
}
