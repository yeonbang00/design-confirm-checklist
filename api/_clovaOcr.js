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
//
// scaleX/scaleY: OCR runs on the (possibly downscaled) image actually sent
// for analysis, but safe-zone px thresholds elsewhere in the prompt are
// expressed in the ORIGINAL upload's dimensions — pass origWidth/analyzedWidth
// (and same for height) here so the reported coordinates land in the same
// coordinate space as those thresholds. Default 1 (no rescaling) when the
// caller doesn't know both sizes.
export function formatOcrForPrompt(fields, scaleX, scaleY) {
  if (!fields || !fields.length) return '';
  scaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  scaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;
  const lines = fields.slice(0, 60).map((f) => {
    const text = (f.inferText || '').trim();
    if (!text) return null;
    const verts = (f.boundingPoly && f.boundingPoly.vertices) || [];
    if (!verts.length) return null;
    const xs = verts.map((v) => v.x * scaleX);
    const ys = verts.map((v) => v.y * scaleY);
    const left = Math.round(Math.min(...xs));
    const right = Math.round(Math.max(...xs));
    const top = Math.round(Math.min(...ys));
    const bottom = Math.round(Math.max(...ys));
    const centerX = Math.round((left + right) / 2);
    const centerY = Math.round((top + bottom) / 2);
    return `"${text}" — 좌측 ${left}px, 우측 ${right}px, 상단 ${top}px, 하단 ${bottom}px (가로중심 ${centerX}px, 세로중심 ${centerY}px)`;
  }).filter(Boolean);
  if (!lines.length) return '';

  return `\n\nOCR 측정 텍스트 위치 (원본 이미지 픽셀 기준으로 환산된 정확한 좌표, 참고용 — 이미지를 직접 측정한 값이니 시각적 추측보다 신뢰하세요. 위에 안내된 "실제 원본 크기"와 동일한 좌표계입니다):
${lines.join('\n')}

이 좌표를 아래 두 가지 용도로 활용하세요:

1) 3번(타이포·정렬): 위아래로 쌓인 제목·부제목처럼 서로 정렬이 의도된 것으로 보이는 텍스트들의 가로중심(중앙정렬 의도) 또는 좌측 좌표(좌측정렬 의도)를 비교해서 정확히 몇 px 차이나는지 계산하세요. 비교하는 두 요소가 사각형·직선처럼 대칭적인 형태라면 아래 기준을 엄격하게 적용하세요:
- 0px(완전 일치): pass
- 1~2px 차이: needsfix
- 3px 이상 차이: reject

단, 비교하는 글자·도형에 뾰족하거나 기울어진 형태(ㅅ, ㅈ, ㅊ 등)와 둥근 형태(ㅇ)처럼 시각적으로 비대칭적인 모양이 섞여 있다면, 1~3px 정도의 차이는 곧바로 문제로 보지 마세요 — 디자이너가 시각적 균형을 맞추기 위해 일부러 미세하게 조정하는 "광학적 정렬"일 수 있습니다. 이런 경우 좌표 차이만으로 기계적으로 판정하지 말고, 실제로 눈으로 봤을 때 한쪽으로 치우쳐 보이는지 시각적 판단을 함께 고려해서 애매하면 needsfix 이하로 낮춰 판정하세요.

note에 어느 텍스트끼리 몇 px 차이나는지 구체적으로 적으세요 (예: "'부하우스'와 '압축파우치·롤링캐리백' 가로중심이 4px 어긋남").

2) 10번(매체 최적화, 세이프존 등 고정 경계선과 비교할 때): 요소의 중심이 아니라 실제로 경계와 맞닿는 가장자리(상단/하단/좌측/우측 중 침범 방향에 맞는 쪽)로 비교하세요. note·differs에는 좌표를 그대로 나열하지 말고 "OO 요소가 세이프존 경계를 N px 침범"처럼 침범량을 직접 계산해서 알아보기 쉽게 적으세요 (예: "CTA 버튼 하단이 세이프존 경계를 15px 침범"). OCR 자체에도 몇 px 수준의 측정 오차가 있을 수 있으니, 경계선과의 차이가 10px 이내면 명확한 침범으로 단정하지 말고 needsfix나 needsCheck로 낮춰 판정하고, 10px을 넘게 침범한 경우만 확실한 위반(reject 등급)으로 판단하세요.

OCR이 텍스트를 잘못 인식했거나 이 좌표만으로 판단하기 애매하면 억지로 판정하지 말고 시각적 판단을 우선하세요.`;
}
