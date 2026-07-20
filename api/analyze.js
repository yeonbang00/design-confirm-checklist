// POST /api/analyze
// Body: { base64: string, mediaType: string, advertiserId?: string, mediaGuideIds?: string[], imageWidth?: number, imageHeight?: number, briefImages?: [{base64, mediaType}], fileSizeBytes?: number }
// Returns: { items: [...], summary: string, comparison: {...} | null, briefAlignment: {...} | null, briefError?: string }
//
// briefImages (optional): 기획안(PPT 캡처) 이미지. 있으면 배너 분석 전에 먼저
// extractBriefDirection()으로 기획 방향을 뽑아내고, 그 방향에 비추어 새
// briefAlignment 판정을 추가로 채운다. 기획안 추출이 실패해도 배너 분석
// 자체는 막지 않고 briefError만 채워서 응답한다.
//
// The Gemini API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

import { getAdvertiser } from './_referenceBanners.js';
import { MEDIA_GUIDES } from './_mediaGuides.js';
import { extractBriefDirection } from './_briefAnalysis.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';
import { getBrandGuideState } from './_brandGuideStore.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 19 items = 11 core design/strategy checks + 6 AI-generation artifact checks
// + 2 agency-delivery checks (logo compliance, mandatory legal/compliance copy).
// Kept as ONE list so every item shares the same pass/minor/major/reject/na scale.
const BASE_PROMPT = `다음은 광고대행사가 광고주에게 전달하기 전 최종 검수하는 배너 시안 이미지입니다. 목적은 광고주 전달 후 발생할 수정 요청을 사전에 줄이는 것입니다. 아래 19개 항목을 기준으로 평가하세요.

1 전략 적합성 - 캠페인 목적/타깃 톤앤매너 일치, 핵심 메시지 1개로 정리
2 위계 및 구조 - 헤드라인→서브→CTA 시선 동선, 3초 내 파악 가능 여부
3 타이포·정렬 - 폰트 2~3종 이내, 정렬 안정성
4 정보 정확성 - 가격/날짜/단위 등 오탈자 여부
5 컬러 일관성 - 브랜드 컬러 준수, 색상 3~4개 제한, 대비
6 합성 리얼리티 - 광원/그림자 일치, 공간감 (사진 합성이 아니면 na)
7 피사체 보정 - 제품/모델 텍스처 자연스러움 (실사 피사체가 없으면 na)
8 그래픽 완성도 - 해상도, 아이콘/스타일 일관성
9 CTA 및 전환 - CTA 문구/위치 명확성
10 매체 최적화 - 세이프존, 모바일 가독성, 크롭 시 잘림 위험
11 최종 디테일 - 픽셀 정렬, 여백, 오탈자 등 마감
12 신체 비율 왜곡 - AI 생성/보정 특유의 신체 왜곡 (인물이 없으면 na)
13 텍스트·로고 렌더링 - 문자·로고가 의미 없이 깨지지 않았는가, 잘 알려진 제3자 로고는 색상도 정확한지
14 배경 패턴 반복 - AI 생성 특유의 부자연스러운 반복/대칭 패턴 여부
15 워터마크·서명 흔적 - 생성형 워터마크나 스톡 이미지 서명 잔여 여부
16 오브젝트 경계 이음새 - 합성된 요소의 경계가 자연스럽게 블렌딩되었는가
17 광원-그림자 방향 일치 - 여러 피사체의 그림자 방향이 서로 모순되지 않는가
18 로고 사용 규정 - 로고 최소 여백 확보, 변형·왜곡 없이 사용 (로고가 없으면 na)
19 법적고지·심의 문구 - 금융/대출/의료/주류/게임 등 규제 업종에 필요한 고지·심의 문구 포함 여부 (해당 업종이 아니면 na)

19개 항목은 pass/minor/major/reject/na 중 하나로 판정하세요. na는 해당 시안에 명백히 적용되지 않는 항목에만 사용하세요 (예: 인물 없는 시안의 12번, 로고 없는 시안의 18번, 비규제 업종의 19번).

4번(정보 정확성)과 11번(최종 디테일)의 오탈자·숫자·단위 확인은 특히 신중하게 판단하세요. 이미지 속 모든 텍스트를 한 글자씩 두 번, 세 번 다시 읽어 가격·날짜·단위·맞춤법에 오류가 없는지 재확인한 뒤 판정하세요. 확신이 서지 않는 글자는 추측하지 말고 메모에 "확인 필요"라고 남기세요.

13번(텍스트·로고 렌더링)을 판정하기 전에, 반드시 아래 절차를 순서대로 실행하세요 — 이건 다른 항목처럼 전체적인 인상만 보고 넘어가지 말고, 이미지 안의 정사각형 앱 아이콘들을 하나씩 개별적으로 짚어가며 확인하는 별도의 검사 단계입니다:
1) 이미지 안에 정사각형(둥근 모서리) 앱 아이콘이 몇 개 있는지, 각각 어떤 서비스인지 먼저 나열하세요.
2) 나열한 아이콘 각각에 대해, 아래 목록에 해당하는 서비스가 있는지 확인하고, 있다면 그 아이콘의 실제 배경색을 아래 정답과 비교하세요:
- 넷플릭스(Netflix): 검정 배경 + 빨간 N 로고
- 디즈니+(Disney+): 청록색/틸(teal) 계열 배경 — 2024년 리브랜딩 이후 기존의 남색·블루가 아니라 초록빛이 도는 청록색이 정답입니다. 파란색으로만 나왔다면 오히려 구버전 색상이니 확인이 필요합니다.
- 티빙(TVING): 빨간색 계열 배경
- 웨이브(wavve): 파란색 계열 배경
- 쿠팡플레이(Coupang Play): 파란색 계열 배경, 흰색 재생 아이콘
3) 나열한 아이콘 전부에 대해 2)를 빠짐없이 반복하세요 — 하나에서 오류를 찾았다고 나머지 아이콘 확인을 멈추지 마세요. 여러 아이콘에서 동시에 색상 오류가 발견되는 경우가 실제로 자주 있습니다.
4) 배경색이 위 정답과 명확히 다르면(예: 넷플릭스가 빨간 배경, 디즈니+가 순수 블루나 보라색 등) 13번을 major 이상으로 판정하세요. 오류가 발견된 아이콘이 여러 개면 메모에 전부 짧게 나열하세요 (예: "넷플릭스·디즈니+ 배경색 오류"). 하나만 골라서 적지 마세요.
5) 목록에 없는 서비스 아이콘은 추측해서 판정하지 말고 넘어가세요.

각 항목에 10단어 이내 한국어 메모를 작성하세요.
전체 요약은 15단어 이내로 작성하세요.

배너 유형 분류: 먼저 이 배너가 다음 중 어떤 유형에 가장 가까운지 판단하세요.
- 프로모션: 할인·혜택·기간 한정 등을 강조
- 커머스: 특정 제품 판매, 구매 유도가 핵심
- 브랜딩: 직접적 판매 목적 없이 브랜드 인지도·이미지 전달이 핵심
- 이벤트: 행사·캠페인 참여 유도가 핵심
- 기타: 위에 해당하지 않음
bannerType 필드에 이 중 하나를 한국어로 응답하세요.

유형별 평가 기준 조정: 배너 유형이 "브랜딩"으로 판단되면, CTA나 구매 유도 문구가 없다는 이유만으로 2번(위계 및 구조)과 9번(CTA 및 전환)을 major나 reject로 판정하지 마세요 — 브랜딩 배너는 CTA 부재가 의도된 디자인입니다. 대신 브랜드 메시지 전달력과 톤 일관성을 기준으로 평가하세요. "프로모션", "커머스", "이벤트" 유형은 기존 기준대로 CTA와 혜택 명확성을 엄격하게 평가하세요.`;

const NO_COMPARISON_INSTRUCTION = `\n\n비교할 참고 배너는 제공되지 않았습니다. comparison 필드는 반드시 null로 응답하세요.`;

function comparisonInstruction(advertiserName) {
  return `\n\n비교 안내: 이 요청에는 텍스트 뒤에 "${advertiserName}"의 성과가 좋았던 참고 배너 이미지들이 먼저 포함되고, 그 다음 새로 평가할 시안 이미지가 포함됩니다. 새 시안을 참고 배너들과 비교해서 comparison 필드를 자연스러운 구어체 한국어로, 근거를 들어가며 채우세요.

비교 시 가장 먼저, 가장 비중 있게 확인할 것은 브랜드 컬러(참고 배너들에서 반복적으로 쓰인 주요 색상·톤)와 브랜드 아이덴티티(로고 사용 방식, 서체 느낌, 톤앤매너, 무드)가 새 시안에서 일관되게 유지되었는지입니다. 이 두 가지를 반드시 언급한 뒤, 레이아웃 구조, 카피 톤앤매너, CTA 방식 등 나머지 요소는 보조적으로 짚어주세요 (예: "브랜드 컬러인 핑크·블루 톤은 잘 지켜졌는데, 로고 여백이 기준보다 좁아서 아이덴티티 측면에서는 아쉽다" 같은 어투).
- similarities: 브랜드 컬러·아이덴티티를 중심으로, 참고 배너들과 닮은 점과 그렇게 판단한 근거를 2~3문장, 50~70단어 정도로 설명
- gaps: 브랜드 컬러·아이덴티티를 중심으로, 참고 배너 대비 부족하거나 다른 점과 그 이유를 2~3문장, 50~70단어 정도로 설명. 가능하면 어떻게 보완하면 좋을지도 짧게 덧붙이세요`;
}

function brandGuidelineInstruction(advertiserName, guideline) {
  return `\n\n${guideline}\n\n(참고: 위 가이드는 "${advertiserName}" 브랜드 전용입니다. 다른 브랜드 시안에는 적용하지 마세요 — 이 요청은 ${advertiserName} 시안이므로 그대로 적용합니다.)`;
}

function mediaGuidelineInstruction(mediaGuides, hasSize) {
  const names = mediaGuides.map((m) => m.name).join(', ');
  const withGuideline = mediaGuides.filter((m) => m.guideline && m.guideline.trim());
  const withoutGuideline = mediaGuides.filter((m) => !(m.guideline && m.guideline.trim()));
  const sizeLine = hasSize
    ? `\n\n위에서 안내한 정확한 이미지 크기를 참고하세요. 아래 매체 기준에 사이즈별로 다른 규칙(예: 300x250, 728x90 등 배너 규격별 규칙)이 있다면, 그 크기와 일치하거나 가장 가까운 규격의 규칙만 찾아서 적용하세요. 정확히 일치하는 규격이 없다면 가장 유사한 비율의 규칙을 참고하되, needsCheck에 "정확히 일치하는 사이즈 규정을 찾지 못해 가장 유사한 사이즈 기준으로 참고했다"고 남기세요.`
    : '';

  let text = `\n\n매체 가이드 안내: 이 시안은 다음 매체에 게재될 예정입니다: ${names}. 10번(매체 최적화) 항목을 판정할 때 아래 각 매체 기준을 모두 반영하세요.${sizeLine}

아래 4가지를 우선순위로 확인하세요 — 이 중 1~3번(사이즈·용량·여백)이 특히 중요하니 가장 먼저, 가장 엄격하게 확인하세요:
1. 사이즈: 매체가 요구하는 정확한 규격(가로x세로)과 일치하는지
2. 용량: 매체 기준에 파일 용량 제한이 명시돼 있다면, 위 이미지 크기 정보에 안내된 정확한 원본 파일 용량과 비교해서 초과 여부를 판정하세요. 파일 용량 정보가 안내되지 않았거나 매체 기준에 용량 제한이 없다면 이 항목은 판단하지 말고 넘어가세요 (추측 금지)
3. 텍스트 여백(안전노출영역/세이프존): 텍스트·로고·CTA가 매체 UI 요소와 겹칠 수 있는 여백 구간을 침범하지 않는지
4. 버튼·광고표시 영역: 매체 시스템이 CTA 버튼이나 "광고"/"Ad" 표시, 계정명·아이콘 등을 소재 위에 자동으로 얹는 경우(매체 기준에 그런 안내가 있다면), 이미지 안에 그와 중복·혼동되는 버튼이나 문구를 넣지 않았는지, 그 자동 생성 영역과 겹치는 자리에 로고·핵심 카피 같은 중요한 정보를 배치하지 않았는지

추가로 mediaGuideReview 필드를 자연스러운 구어체 한국어로 채우세요. 매체가 2개 이상 선택된 경우, 어떤 내용이 어느 매체 기준인지 매체 이름을 언급하며 구분해서 설명하세요.
- satisfied: 시안이 매체 기준을 충족하는 부분과 그 근거를 2~3문장(40~60단어)으로 설명 (예: "메타(릴스) 기준으로는 로고가 세이프존 안에 잘 들어와 있다")
- differs: 시안이 매체 기준과 다르거나 위반하는 부분과 그 이유를 2~3문장(40~60단어)으로 설명. 구체적으로 어느 영역이 어떻게 다른지 짚으세요
- needsCheck: 이미지만으로는 판단이 애매하거나, 실제 게재 시 추가로 확인이 필요한 부분을 1~2문장(20~40단어)으로 설명 (예: "실제 업로드 시 자동 크롭 여부는 이미지만으로 확인이 어려우니 매체 관리자 화면에서 재확인 필요")

아래 매체 기준에 세이프존 비율·여백 등 공간적 위치 기준이 포함되어 있다면, 이는 이미지의 정확한 픽셀 측정이 아니라 대략적인 위치 판단이라는 점을 감안하세요. 요소가 기준 경계를 명확하고 크게 벗어난 경우에만 위반(major 이상)으로 판정하고, 경계에 살짝 걸치거나 침범 정도를 이미지만으로 확신하기 어려운 경우에는 major로 단정하지 말고 minor로 낮추거나 needsCheck로 돌리세요. 애매한 경우 과도하게 반려·주요수정으로 판정하지 마세요.`;

  for (const m of withGuideline) {
    text += `\n\n[${m.name} 소재 등록 기준]\n${m.guideline}`;
  }

  if (withoutGuideline.length > 0) {
    const namesWithout = withoutGuideline.map((m) => m.name).join(', ');
    text += `\n\n다음 매체는 아직 구체적인 소재 등록 기준이 등록되지 않았습니다: ${namesWithout}. 이 매체들에 대해서는 10번 항목을 일반적인 세이프존·가독성·크롭 기준으로만 평가하고, needsCheck에 "${namesWithout}는 전용 가이드가 아직 없어 일반 기준으로 평가했다"는 점을 포함하세요.`;
  }

  return text;
}

// Reference banner images are stored in Vercel Blob Storage (see
// _referenceBanners.js) as URLs, not inline base64. Gemini's inlineData
// needs raw base64, so fetch each one and encode it at request time.
async function fetchAsBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`참고 배너 이미지를 불러오지 못했습니다 (${resp.status}): ${url}`);
  }
  const buf = await resp.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
  return Math.round(bytes / 1024) + 'KB';
}

function imageSizeInstruction(width, height, fileSizeBytes) {
  const sizeLabel = formatFileSize(fileSizeBytes);
  const capacityLine = sizeLabel
    ? ` 원본 파일 용량은 정확히 ${sizeLabel}입니다(업로드된 파일에서 직접 측정한 값).`
    : '';
  return `\n\n이미지 크기 정보: 업로드된 이미지의 실제 원본 크기는 정확히 ${width} x ${height}px입니다.${capacityLine} 이는 프로그램이 파일에서 직접 측정한 정확한 값이니, 이미지를 보고 크기나 용량을 다시 추측하지 말고 이 값을 그대로 사용하세요. 10번(매체 최적화) 항목과 매체 가이드 판정 시 이 정확한 크기·용량을 기준으로 삼으세요.`;
}

function briefAlignmentInstruction(direction) {
  const mustIncludeText = (direction.mustInclude && direction.mustInclude.length)
    ? direction.mustInclude.join(', ')
    : '명시된 필수 요소 없음';
  return `\n\n기획안 부합도 안내: 이 시안은 아래 기획 방향을 바탕으로 제작되었습니다.
- 핵심 방향: ${direction.coreDirection || '명시되지 않음'}
- 필수 포함 요소: ${mustIncludeText}
- 제작 방향 제안: ${direction.creativeDirection || '명시되지 않음'}

위 기획 방향에 비추어 이 시안이 얼마나 부합하는지 판단해서 briefAlignment 필드를 채우세요.
- verdict: 전체적으로 기획 의도에 "aligned"(잘 부합), "partial"(부분적으로 부합, 일부 아쉬움), "misaligned"(기획 의도에서 벗어남) 중 하나
- summary: 판정 이유를 1문장으로 요약
- matches: 기획 방향과 부합하는 부분과 근거를 2~3문장으로
- gaps: 기획 방향에서 벗어나거나 필수 요소가 누락된 부분을 2~3문장으로. 문제 없다면 "기획 의도에서 벗어난 부분이 없습니다"라고만 답하세요.`;
}

function schemaInstruction(hasComparison, hasMediaGuides, hasBrief) {
  const comparisonSchema = hasComparison ? `{"similarities":"...","gaps":"..."}` : `null`;
  const mediaGuideSchema = hasMediaGuides ? `{"satisfied":"...","differs":"...","needsCheck":"..."}` : `null`;
  const briefSchema = hasBrief ? `{"verdict":"aligned","summary":"...","matches":"...","gaps":"..."}` : `null`;
  return `\n\n반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요:
{"items":[{"id":1,"status":"pass","note":"..."}],"bannerType":"...","summary":"...","comparison":${comparisonSchema},"mediaGuideReview":${mediaGuideSchema},"briefAlignment":${briefSchema}}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { base64, mediaType, advertiserId, mediaGuideIds, imageWidth, imageHeight, briefImages, fileSizeBytes } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }

  const advertiser = advertiserId ? await getAdvertiser(advertiserId) : null;
  const refImages = advertiser && Array.isArray(advertiser.images) ? advertiser.images : [];
  const hasComparison = refImages.length > 0;

  // Brand guideline text is now live/editable (see _brandGuideStore.js),
  // not a static field on ADVERTISERS — fetch it fresh for this request.
  const brandGuidelineText = advertiser ? (await getBrandGuideState(advertiserId)).composedGuideline : '';
  const hasGuideline = !!brandGuidelineText;

  const selectedMediaGuides = Array.isArray(mediaGuideIds)
    ? mediaGuideIds.map((id) => MEDIA_GUIDES[id]).filter(Boolean)
    : [];
  const hasMediaGuides = selectedMediaGuides.length > 0;

  const hasSize = Number.isFinite(imageWidth) && Number.isFinite(imageHeight) && imageWidth > 0 && imageHeight > 0;

  let briefDirection = null;
  let briefError = null;
  if (Array.isArray(briefImages) && briefImages.length > 0) {
    try {
      const brandContext = hasGuideline ? { name: advertiser.name, guideline: brandGuidelineText } : null;
      briefDirection = await extractBriefDirection(briefImages, apiKey, brandContext);
    } catch (err) {
      briefError = '기획안 분석에 실패해 부합도 판정 없이 진행했습니다: ' + (err && err.message ? err.message : '알 수 없는 오류');
    }
  }
  const hasBrief = !!briefDirection;

  const promptText =
    BASE_PROMPT +
    (hasSize ? imageSizeInstruction(imageWidth, imageHeight, fileSizeBytes) : '') +
    (hasComparison ? comparisonInstruction(advertiser.name) : NO_COMPARISON_INSTRUCTION) +
    (hasGuideline ? brandGuidelineInstruction(advertiser.name, brandGuidelineText) : '') +
    (hasMediaGuides ? mediaGuidelineInstruction(selectedMediaGuides, hasSize) : '') +
    (hasBrief ? briefAlignmentInstruction(briefDirection) : '') +
    schemaInstruction(hasComparison, hasMediaGuides, hasBrief);

  const parts = [{ text: promptText }];

  if (hasComparison) {
    parts.push({ text: `[참고 배너 시작 — ${advertiser.name}, ${refImages.length}장]` });
    const refImageData = await Promise.all(refImages.map((img) => fetchAsBase64(img.thumbUrl)));
    refImages.forEach((img, i) => {
      parts.push({ inlineData: { mimeType: img.mimeType, data: refImageData[i] } });
    });
    parts.push({ text: `[참고 배너 끝. 아래가 평가할 새 시안입니다]` });
  }

  parts.push({ inlineData: { mimeType: mediaType, data: base64 } });

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          // 기획안 부합도까지 포함되면 응답 필드가 늘어나 4608으로는
          // 가끔 끝부분에서 JSON이 끊기는 경우가 있어 여유를 더 둠.
          maxOutputTokens: hasBrief ? 7168 : 4608,
          // 기획안 부합도 판정은 방향 텍스트와 시안을 같이 놓고 비교하는
          // 더 복잡한 추론이라 thinking 여유를 한 단계 올림.
          thinkingConfig: { thinkingLevel: hasBrief ? 'medium' : 'low' },
        },
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      res.status(502).json({ error: '서버 응답을 읽지 못했습니다 (status ' + response.status + ').' });
      return;
    }

    if (!response.ok) {
      const msg = (data && data.error && data.error.message) ? data.error.message : ('status ' + response.status);
      res.status(response.status).json({ error: 'Gemini API 오류: ' + msg });
      return;
    }

    const candidate = data.candidates && data.candidates[0];
    const responseParts = candidate && candidate.content && candidate.content.parts;
    const textBlock = (responseParts || []).map((p) => p.text || '').join('');
    const clean = textBlock.replace(/```json|```/g, '').trim();

    if (!clean) {
      const finishReason = candidate && candidate.finishReason;
      res.status(502).json({ error: 'AI로부터 빈 응답을 받았습니다' + (finishReason ? ` (사유: ${finishReason})` : '') + '.' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      res.status(502).json({ error: 'AI 응답을 해석하지 못했습니다.', raw: textBlock });
      return;
    }

    if (briefError) parsed.briefError = briefError;
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
  }
}
