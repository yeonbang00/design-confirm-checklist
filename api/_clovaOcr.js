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

1) 3번(타이포·정렬): 위아래로 쌓인 제목·부제목처럼 서로 정렬이 의도된 것으로 보이는 텍스트들의 가로중심(중앙정렬 의도) 또는 좌측 좌표(좌측정렬 의도)를 비교해서 정확히 몇 px 차이나는지 계산하세요.

이 px 비교를 적용하기 전에 먼저 아래 두 가지 신뢰도 확인을 거치세요 — 둘 중 하나라도 해당하면 OCR 좌표 차이를 근거로 기계적으로 판정하지 말고, 실제로 눈으로 봤을 때 정렬이 맞아 보이면 pass로 판정하세요 (좌표상 몇 px 차이가 나더라도 육안상 정렬돼 보이면 그게 맞는 판단입니다):
- 비교 대상 확인: 비교하려는 두 좌표가 정말 서로 대응되는 온전한 줄(제목 한 줄 전체 vs 부제목 한 줄 전체) 인지 확인하세요. OCR은 한 줄을 통째로 인식하지 않고 단어·구 단위로 쪼개서 반환할 수 있어서, 줄의 일부 조각과 다른 줄의 일부 조각을 잘못 비교하면 실제로는 안 어긋난 것도 어긋난 것처럼 계산될 수 있습니다.
- 스트록·그림자 효과 확인: 비교하는 텍스트에 외곽선(스트록)이나 그림자 효과가 적용되어 있다면, OCR이 측정하는 좌우 경계는 실제 글자 획뿐 아니라 스트록·그림자 픽셀까지 포함해서 늘어난 값일 수 있습니다. 이런 효과가 보이면 OCR 좌표 차이가 실제 디자인상의 중심 차이보다 부풀려졌을 가능성이 크니, 몇 px 차이가 나와도 곧바로 정렬 오류로 단정하지 마세요.

위 두 확인을 통과해서(대응되는 온전한 줄을 비교했고, 스트록·그림자로 인한 왜곡 가능성도 낮다고 판단되는 경우) 정말 신뢰할 수 있는 비교라면, 비교하는 두 요소가 사각형·직선처럼 대칭적인 형태일 때 아래 기준을 엄격하게 적용하세요:
- 0px(완전 일치): pass
- 1~2px 차이: needsfix
- 3px 이상 차이: reject

단, 비교하는 글자·도형에 뾰족하거나 기울어진 형태(ㅅ, ㅈ, ㅊ 등)와 둥근 형태(ㅇ)처럼 시각적으로 비대칭적인 모양이 섞여 있다면, 1~3px 정도의 차이는 곧바로 문제로 보지 마세요 — 디자이너가 시각적 균형을 맞추기 위해 일부러 미세하게 조정하는 "광학적 정렬"일 수 있습니다. 이런 경우 좌표 차이만으로 기계적으로 판정하지 말고, 실제로 눈으로 봤을 때 한쪽으로 치우쳐 보이는지 시각적 판단을 함께 고려해서 애매하면 needsfix 이하로 낮춰 판정하세요.

note에 어느 텍스트끼리 몇 px 차이나는지 구체적으로 적으세요 (예: "'부하우스'와 '압축파우치·롤링캐리백' 가로중심이 4px 어긋남"). OCR 신뢰도 문제로 좌표 비교 대신 시각적 판단만으로 pass 처리했다면, note에 "OCR 좌표는 차이가 있었으나 스트록/그림자 등의 영향으로 보이며 육안상 정렬은 맞음"처럼 그 이유를 남기세요.

2) 10번(매체 최적화, 세이프존 등 고정 경계선과 비교할 때): 요소의 중심이 아니라 실제로 경계와 맞닿는 가장자리(상단/하단/좌측/우측 중 침범 방향에 맞는 쪽)로 비교하세요. note·differs에는 좌표를 그대로 나열하지 말고 "OO 요소가 세이프존 경계를 N px 침범"처럼 침범량을 직접 계산해서 알아보기 쉽게 적으세요 (예: "CTA 버튼 하단이 세이프존 경계를 15px 침범"). OCR 자체에도 몇 px 수준의 측정 오차가 있을 수 있으니, 경계선과의 차이가 10px 이내면 명확한 침범으로 단정하지 말고 needsfix나 needsCheck로 낮춰 판정하고, 10px을 넘게 침범한 경우만 확실한 위반(reject 등급)으로 판단하세요.

OCR이 텍스트를 잘못 인식했거나 이 좌표만으로 판단하기 애매하면 억지로 판정하지 말고 시각적 판단을 우선하세요.`;
}
