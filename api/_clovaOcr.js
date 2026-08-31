// Optional precision layer for 3번(타이포·정렬·여백·명도대비): Naver CLOVA General OCR gives
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
// 텍스트 박스 높이를 "같은 크기로 쓰인 것으로 보이는" 묶음(계층)으로
// 클러스터링한다 — OCR이 같은 헤드라인도 단어별로 살짝 다른 높이를
// 보고하는 경우가 있어서, 값이 그냥 다르다고 다른 계층으로 보면 안 된다.
// 서로 15% 이내로 가까운 높이는 같은 계층으로 묶는다.
function clusterHeightTiers(heights) {
  const sorted = [...heights].sort((a, b) => b - a);
  const tiers = [];
  for (const h of sorted) {
    const last = tiers[tiers.length - 1];
    if (last && h >= last.min * 0.85) {
      last.heights.push(h);
      last.min = Math.min(last.min, h);
    } else {
      tiers.push({ min: h, max: h, heights: [h] });
    }
  }
  return tiers.map((t) => Math.round(t.heights.reduce((a, b) => a + b, 0) / t.heights.length));
}

export function formatOcrForPrompt(fields, scaleX, scaleY, canvasWidth, canvasHeight) {
  if (!fields || !fields.length) return '';
  scaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  scaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;
  const heights = [];
  let totalTextArea = 0;
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
    const height = bottom - top;
    if (height > 2) heights.push(height);
    totalTextArea += Math.max(0, right - left) * Math.max(0, bottom - top);
    return `"${text}" — 좌측 ${left}px, 우측 ${right}px, 상단 ${top}px, 하단 ${bottom}px (가로중심 ${centerX}px, 세로중심 ${centerY}px)`;
  }).filter(Boolean);
  if (!lines.length) return '';

  const tiers = clusterHeightTiers(heights);
  let hierarchyBlock = '';
  if (tiers.length >= 2) {
    const ratio = Math.round((tiers[0] / tiers[1]) * 100) / 100;
    hierarchyBlock = `\n\n3) 2번(위계 및 구조): 감지된 텍스트 높이를 크기별로 묶으면 가장 큰 계층이 약 ${tiers[0]}px, 두 번째로 큰 계층이 약 ${tiers[1]}px로, 비율은 약 ${ratio}배입니다. 타이포그래피 모듈러 스케일 이론(Major Third=1.25배가 "뚜렷하게 인지되는 최소 크기 단계"로 통용됨)에 따르면, 이 비율이 1.25배 이상이면 크기 차이만으로도 위계가 명확하게 인지될 가능성이 높고, 1.25배 미만이면 크기만으로는 위계가 약하게 느껴질 수 있습니다. 단, 이건 통계적 참고 기준일 뿐입니다 — 색상·굵기·배치로 이미 위계가 명확하다면 크기 비율이 1.25배 미만이어도 문제 삼지 마세요. 반대로 비율이 낮은데 색상·굵기 구분도 없어서 실제로 위계가 흐릿해 보인다면 needsfix 이상으로 판정하고, note에 "가장 큰 텍스트와 다음 텍스트의 높이 비율이 약 ${ratio}배로 낮아 크기만으로는 위계가 약함"처럼 근거를 남기세요.`;
  }

  const hasCanvasSize = Number.isFinite(canvasWidth) && Number.isFinite(canvasHeight) && canvasWidth > 0 && canvasHeight > 0;
  const smallestHeight = tiers.length ? tiers[tiers.length - 1] : (heights.length ? Math.min(...heights) : null);
  let densityBlock;
  if (hasCanvasSize) {
    const densityPct = Math.round((totalTextArea / (canvasWidth * canvasHeight)) * 1000) / 10;
    const smallHeightPct = smallestHeight ? Math.round((smallestHeight / canvasHeight) * 1000) / 10 : null;
    densityBlock = `\n\n4) 3번(타이포·정렬·여백·명도대비)의 텍스트 밀도·절대 크기·로컬 간격:

가) 레이아웃 밀도: 감지된 텍스트 영역의 합이 전체 이미지 면적의 약 ${densityPct}%입니다(OCR 박스 넓이 합계 기준의 참고 수치일 뿐, 실제 여백을 정확히 반영하지는 않으니 이 수치 하나로 기계적으로 판정하지 마세요). 이 수치를 참고하면서 이미지를 직접 보고, 요소 사이 여백이 부족해 실제로 답답해 보이는지 시각적으로 판단하세요. 명백히 답답해 보이는 경우만 needsfix 이상으로 판정하고 note에 "텍스트 밀도가 높고 여백이 부족해 답답해 보임"처럼 적으세요. 단, 리뷰·후기 화면, 신문기사, 시험지·문제풀이, 채팅 대화창처럼(예시일 뿐이며 이 목록에 없는 형식도 같은 논리로 판단하세요) 원래 텍스트가 많이 들어가는 게 자연스러운 컨셉을 재현한 배너라면, 밀도가 높아 보여도 정상으로 보고 지적하지 마세요 — 이런 컨셉인지 먼저 이미지 전체 맥락(구도, 톤, 카피 성격)으로 판단한 뒤 이 기준을 적용하세요.${smallHeightPct !== null ? `

나) 절대 크기: 가장 작은 텍스트 계층의 높이가 이미지 세로 크기의 약 ${smallHeightPct}%입니다(참고 수치). 이 비율이 유난히 작고, 실제로 눈으로 봤을 때도 읽기 불편할 정도로 작아 보인다면 needsfix 이상으로 판정하세요. 단, 위에서 다룬 부가조건·고지성 텍스트(법적고지, 유효기간 등)는 원래 작게 넣는 게 정상이니 이 기준에서 제외하세요.` : ''}

다) 로컬 자간·행간: OCR 좌표로 잴 수 없는 부분이니 이미지를 직접 보고 판단하세요 — 특정 텍스트 블록 안에서 글자끼리 너무 붙어있거나(자간 부족) 줄 사이 간격이 거의 닿을 듯 좁아서(행간 부족) 그 블록만 답답해 보이는 곳이 있는지 확인하세요. 이건 가)의 "이미지 전체 밀도"와는 다른 체크입니다 — 캔버스 전체는 여백이 충분해도 특정 블록 안에서만 자간·행간이 좁아 답답해 보일 수 있습니다. 명백한 경우만 needsfix 이상으로 판정하고, note에 "OO 텍스트 블록의 줄간격/자간이 좁아 답답해 보임"처럼 적으세요.

라) 예외: 위 가)·나)·다)는 디자이너가 배치·타이핑한 배너 카피에만 적용하세요. 제품 패키지·라벨처럼 실제 사물에 인쇄되어 촬영된 문구(예: 제품 성분표, 패키지 설명문구)는 디자이너가 편집할 수 있는 대상이 아니라 사실 그대로 존재하는 원본이니, 작거나 빽빽해 보여도 문제 삼지 마세요.`;
  } else {
    densityBlock = `\n\n4) 3번(타이포·정렬·여백·명도대비)의 텍스트 밀도·절대 크기·로컬 간격: 레이아웃/텍스트가 답답해 보이거나 절대적으로 너무 작아 보이는지, 특정 텍스트 블록 안에서 자간·행간이 좁아 그 블록만 답답해 보이는지를 이미지를 직접 보고 판단하세요. 리뷰·후기 화면, 신문기사, 시험지·문제풀이, 채팅 대화창처럼(예시일 뿐이며 이 목록에 없는 형식도 같은 논리로 판단하세요) 원래 텍스트가 많이 들어가는 게 자연스러운 컨셉이면 밀도가 높아 보여도 정상으로 보세요. 단, 제품 패키지·라벨처럼 실제 사물에 인쇄되어 촬영된 문구는 디자이너가 편집할 수 없는 원본이니 작거나 빽빽해 보여도 문제 삼지 마세요. 명백한 경우만 needsfix 이상으로 판정하세요.`;
  }

  return `\n\nOCR 측정 텍스트 위치 (원본 이미지 픽셀 기준으로 환산된 정확한 좌표, 참고용 — 이미지를 직접 측정한 값이니 시각적 추측보다 신뢰하세요. 위에 안내된 "실제 원본 크기"와 동일한 좌표계입니다):
${lines.join('\n')}

이 좌표를 아래 용도로 활용하세요:

1) 3번(타이포·정렬·여백·명도대비): 아래 세 가지는 서로 다른 종류의 정렬 체크입니다 — 하나만 확인하고 넘어가지 말고 해당되는 요소가 있으면 전부 확인하세요.

가) 요소 간 상대 정렬: 위아래로 쌓인 제목·부제목·CTA 문구처럼 서로 정렬이 의도된 것으로 보이는 요소들을 비교하기 전에, 먼저 이 요소들이 가운데 정렬인지 좌측 정렬인지 우측 정렬인지 시각적으로 판단하세요. 판단한 정렬 방식에 맞는 좌표만 비교하세요:
- 가운데 정렬로 보이면: 가로중심끼리 비교
- 좌측 정렬로 보이면: 좌측 좌표끼리 비교
- 우측 정렬로 보이면: 우측 좌표끼리 비교
좌측 정렬이나 우측 정렬인 요소에는 가로중심을 비교하지 마세요 — 좌우 정렬된 소재에 중앙정렬 기준(가로중심)을 적용하면 실제로는 문제없는 디자인도 어긋난 것처럼 보이고, note를 읽는 사람도 왜 가로중심을 따지는지 헷갈립니다. note에도 실제로 비교한 기준(가로중심/좌측/우측)을 명시하세요. 이렇게 정렬 방식을 정한 뒤, 해당 좌표를 기준으로 정확히 몇 px 차이나는지 계산하세요.

이 px 비교를 적용하기 전에 먼저 아래를 확인하세요:
- 비교 대상 확인: 비교하려는 두 좌표가 정말 서로 대응되는 온전한 요소(제목 한 줄 전체 vs 부제목 한 줄 전체) 인지 확인하세요. OCR은 한 줄을 통째로 인식하지 않고 단어·구 단위로 쪼개서 반환할 수 있어서, 일부 조각끼리 잘못 비교하면 실제로는 안 어긋난 것도 어긋난 것처럼 계산될 수 있습니다. 대응 관계 자체가 잘못됐다고 판단되면 이 좌표 비교는 건너뛰고 육안 판단만으로 정렬 여부를 결정하세요.
- 스트록(외곽선) 효과 확인: 비교하는 텍스트에 굵은 외곽선(스트록)이 적용되어 있다면, 실측 테스트 결과 CLOVA OCR이 보고하는 좌표 자체가 최대 9px까지 어긋날 수 있는 것으로 확인됐습니다 — 이건 디자인 결함이 아니라 OCR 측정 신뢰도 문제입니다. 스트록이 적용된 요소가 비교 대상에 포함되면 OCR px 수치를 근거로 pass/reject를 판정하지 말고, 아래 표 대신 이미지를 직접 보고 육안으로만 정렬 여부를 판단하세요. note에도 특정 px 수치를 인용하지 말고 육안 판단 결과만 적으세요(예: "스트록 적용 요소라 OCR 좌표 대신 육안으로 확인 — 정렬 어긋나 보임"). 그림자 효과는 이 판정과 무관합니다 — 그림자는 텍스트 자체가 아니라 OCR 좌표 측정에 영향을 주지 않으며, 그림자가 있다는 이유만으로 아래 기준을 완화하지 마세요.

대응 관계가 확실하고 스트록도 없는 비교라면, 비교하는 두 요소가 사각형·직선처럼 대칭적인 형태일 때 아래 기준을 엄격하게 적용하세요 — 3px 차이는 육안으로도 확인되는 수준이니 봐주지 마세요:
- 0px(완전 일치): pass
- 1~2px 차이: needsfix
- 3px 이상 차이: reject

비교 대상의 맞닿는 변 모양이 서로 달라서 의도적인 "광학적 정렬"이 의심되는 경우는, 위 표의 등급을 완전히 무시하는 예외가 아니라 등급을 한 단계 낮추는 참고 사유로만 쓰세요. 판단 원칙은 이렇습니다 — 자모를 외워서 찾지 말고, 비교하는 두 요소에서 실제로 맞닿는 쪽 변의 모양을 보고 스스로 판단하세요: 한쪽은 변이 평평하게 떨어지는데(ㄹ, ㄴ, ㅁ, ㅂ, ㅌ, ㅍ, ㅋ 등 또는 사각형) 다른 쪽은 둥글거나(ㅇ, ㅎ) 뾰족·기울어진(ㅅ, ㅈ, ㅊ, ㅆ 등) 형태라면 광학적 정렬 대상입니다. 둥글거나 뾰족한 글자는 시각적으로 안쪽으로 들어가 보여서 좌표상 조금 더 밀어내야 눈에는 정렬돼 보이기 때문이고, 이건 디자이너가 일부러 넣는 보정입니다. 특히 평평한 변과 둥근 변의 조합(예: '리'의 ㄹ과 '안'의 ㅇ이 좌측에서 만나는 경우)이 실무에서 가장 흔하니 빠뜨리지 마세요. 반대로 양쪽 다 평평한 변끼리 만나는 경우(ㄹ과 ㄴ, 사각형과 사각형)는 광학 보정이 필요 없으니 이 예외를 적용하지 마세요.

단, 이 경우의 허용 오차는 고정된 px 수치가 아니라 비교하는 텍스트의 실제 높이(하단 좌표 - 상단 좌표)에 비례해서 판단하세요 — 폰트 크기가 클수록 같은 광학보정이라도 절대 px 차이가 커지는 게 정상이라, 작은 텍스트와 큰 헤드라인에 같은 px 기준을 적용하면 안 됩니다. 차이를 텍스트 높이로 나눈 비율을 계산해서: 텍스트 높이의 약 6% 이내 차이는 광학적 정렬로 설명 가능한 정상적인 수준이니 pass로 낮추지 말고 최소 needsfix로 판정하고, 6%를 초과하는 차이는 광학적 정렬로 설명하기엔 너무 크므로 이 예외를 적용하지 말고 reject로 판정하세요. (예: 텍스트 높이가 약 90px일 때 5px 차이는 약 5.6%로 정상 범위지만, 텍스트 높이가 약 24px일 때 4px 차이는 약 17%로 과도한 차이입니다.) 광학적 정렬 요소가 섞이지 않은 일반 비교(평평한 변끼리, 사각형·직선처럼 대칭적인 형태끼리)에는 이 비율 기준을 적용하지 말고 위의 고정 0/1~2/3px 기준을 그대로 적용하세요.

note에 어느 요소끼리 몇 px 차이나는지 적으세요 — 판정에 쓴 원본 좌표(가로중심 값 등) 자체는 적지 말고 최종 차이(px)만 결과로 적으세요 (예: "'부하우스'와 '압축파우치·롤링캐리백' 가로중심이 4px 어긋남" — "496px와 493px로 4px 차이"처럼 원본 좌표를 나열하지 마세요). 광학적 정렬 가능성 때문에 needsfix로 낮춰 판정했다면, note에 "OCR상 OOpx 차이가 있으나 광학적 정렬 영향으로 추정, 확인 권장"처럼 그 이유를 남기세요 — "정렬 맞음"처럼 문제가 없다고 단정하는 표현은 쓰지 마세요.

나) 캔버스 기준 중앙정렬: 로고, 헤드라인, CTA처럼 이미지 전체 폭 안에서 가운데 배치된 것으로 보이는 요소는, 왼쪽 여백(요소의 좌측 좌표 - 0)과 오른쪽 여백(위에 안내된 이미지 원본 가로 크기 - 요소의 우측 좌표)을 각각 계산해서 비교하세요. 위아래로 쌓인 여러 요소를 함께 비교할 때뿐 아니라, 로고 하나처럼 단독으로 놓인 요소도 캔버스 중앙에서 벗어나 있는지 반드시 확인하세요 — 가) 항목은 "요소끼리" 비교이고, 나) 항목은 "요소 대 캔버스 전체" 비교라 서로 다른 체크입니다. 이 비교도 가)와 동일한 기준을 엄격하게 적용하세요 — 3px 차이는 육안으로도 확인되는 수준이니 봐주지 마세요: 좌우 여백 차이가 0px이면 pass, 1~2px 차이면 needsfix, 3px 이상 차이면 reject로 판정하고 note에 "OO 요소가 캔버스 중앙에서 3px 벗어남"처럼 최종 차이(px)만 적으세요 — "좌측 여백 496px, 우측 여백 493px"처럼 판정에 쓴 원본 여백 수치를 나열하지 마세요. 단, 이 요소에 스트록(외곽선)이 적용돼 있거나 커스텀 서체·장식이 섞인 로고 워드마크처럼 OCR이 경계를 안정적으로 잡기 어려워 보이는 경우는, 가)의 스트록 규칙과 동일하게 이 px 표를 적용하지 말고 이미지를 직접 보고 육안으로만 캔버스 중앙정렬 여부를 판단하세요.

다) CTA 버튼의 정렬: CTA처럼 도형(배경) 안에 텍스트가 들어간 요소는 위 OCR 좌표가 텍스트 자체의 경계일 뿐, 버튼 도형의 실제 테두리가 아닐 수 있습니다 — 버튼에 좌우 패딩이 있으면 텍스트 좌표만으로 캔버스 여백(나)이나 다른 요소와의 정렬(가)을 계산하면 실제 버튼 위치와 오차가 생깁니다. CTA에 가)·나) 기준을 적용할 때는 OCR 좌표를 출발점으로만 삼고, 반드시 이미지를 직접 보고 버튼 도형 자체의 좌우 여백까지 시각적으로 확인해서 최종 판단하세요.

라) 코너 배지·스티커의 가장자리 여백: "올영 PICK", "BEST", 할인율 스티커처럼 캔버스 모서리에 붙어있는 원형·사각형 배지가 있다면, OCR 좌표(배지 안 텍스트 경계)로는 배지 도형 전체의 크기를 알 수 없으니 반드시 이미지를 직접 보고 판단하세요. 이런 배지는 맞닿은 두 가장자리(예: 좌상단 배지라면 위쪽과 왼쪽)로부터의 여백이 서로 비슷하거나 최소한 일관된 간격 규칙을 따라야 자연스럽습니다. 두 방향의 여백이 눈에 띄게 다르면(예: 위쪽은 거의 안 붙어있는데 왼쪽은 많이 떨어져 있음) needsfix 이상으로 판정하고, note에 "OO 배지가 위쪽 여백은 좁고 왼쪽은 넓어 비대칭"처럼 구체적으로 적으세요. 배지를 프레임 밖으로 일부 걸쳐놓거나 잘라낸 게 의도적인 연출로 보이면 예외로 보고 문제 삼지 마세요.

2) 14번(매체 최적화, 세이프존 등 고정 경계선과 비교할 때): 요소의 중심이 아니라 실제로 경계와 맞닿는 가장자리(상단/하단/좌측/우측 중 침범 방향에 맞는 쪽)로 비교하세요. note·differs에는 좌표를 그대로 나열하지 말고 "OO 요소가 세이프존 경계를 N px 침범"처럼 침범량을 직접 계산해서 알아보기 쉽게 적으세요 (예: "CTA 버튼 하단이 세이프존 경계를 15px 침범"). OCR 자체에도 몇 px 수준의 측정 오차가 있을 수 있으니, 경계선과의 차이가 2px 이내면 명확한 침범으로 단정하지 말고 needsfix나 needsCheck로 낮춰 판정하고, 3px 이상 침범한 경우부터 확실한 위반(reject 등급)으로 판단하세요.${hierarchyBlock}${densityBlock}

OCR이 텍스트를 잘못 인식했거나 이 좌표만으로 판단하기 애매하면 억지로 판정하지 말고 시각적 판단을 우선하세요.`;
}
