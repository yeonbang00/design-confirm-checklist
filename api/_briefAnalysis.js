// Shared logic for reading a planning document (기획안, usually PPT slides
// captured as screenshots) and turning it into actionable creative
// direction. Used by:
// - api/analyzeBrief.js: standalone 기획안 헬퍼 page (brief only, no banner)
// - api/analyze.js: when a banner is uploaded together with a brief, to
//   extract direction first and then judge whether the banner matches it

import { listNonEmptyCategories, pickReferenceImages } from './_referenceLibrary.js';

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const VISUAL_REF_COUNT = 3;

function categoryListText() {
  return listNonEmptyCategories().map((c) => `${c.id}(${c.name})`).join(', ');
}

const BRIEF_PROMPT_BODY = `다음 이미지는 배너 제작을 위한 기획안(PPT 캡처)입니다. 여러 장이라면 하나의 기획안으로 이어서 읽으세요.

중요: 기획안 내용을 그대로 요약하거나 나열하지 마세요. 어차피 제작자가 기획안 원본을 직접 볼 수 있으니, 내용을 다시 읽어주는 건 의미가 없습니다. 대신 이 기획안을 바탕으로 "배너를 어떻게 만들면 더 잘 만들 수 있을지" 실질적인 제작 방향을 제시하세요. 기획안에 이미 나와 있는 필수 요소(상품명·가격·기간·로고 등)를 다시 나열하는 건 하지 마세요 — 제작자가 원본에서 이미 확인할 수 있는 정보입니다.

가장 먼저 originalCopyTranscript 필드를 채우세요: 기획안에 등장하는 배너 문구(헤드카피·서브카피 등 실제로 배너에 들어갈 문구로 보이는 텍스트)를 이미지에 적힌 그대로 정확히 옮겨 적으세요. 문맥상 "이런 말이겠지"로 자동으로 고쳐 쓰거나 매끄럽게 다듬지 말고, 진짜 눈에 보이는 글자 그대로 옮기세요 (자음·모음 하나 차이로 다른 글자가 되는 경우를 특히 조심하세요 — 스치듯 읽으면 놓치기 쉽습니다). 해당 문구가 명확히 안 보이면 빈 문자열로 두세요. 아래 creativeDirection의 [카피 제안]은 반드시 이 필드에 옮겨 적은 문구를 기준으로 작성하세요 — 기억이나 인상으로 다시 쓰지 마세요.

나머지는 다음을 각각 채우세요. 모두 자연스러운 구어체 한국어로 작성하세요:

- coreDirection: 이 배너가 궁극적으로 무엇을 전달해야 하는지, 제작 시 가장 먼저 잡아야 할 핵심 방향을 1~2문장으로. 단순 목적 나열이 아니라 "이런 인상을 주는 게 핵심이다" 같은 실전 조언 톤으로.

- creativeDirection: coreDirection에서 이미 말한 핵심 방향·톤을 다시 풀어 쓰지 말고, 그 방향을 실제로 어떻게 구현할지 구체적인 제안만 담으세요. 아래 형식을 그대로 지켜서 체계적으로 작성하세요. 대괄호로 시작하는 헤더 줄과 "- "로 시작하는 항목들로 구성하고, 섹션 사이는 빈 줄로 구분하세요:

[비주얼 제안]
- (기획안에 참고 이미지가 포함되어 있어도, 그 레퍼런스를 어떻게 더 잘 구현할지·잘 살릴지를 설명하는 건 이 섹션의 역할이 아닙니다. 그 레퍼런스에는 없는 새로운 비주얼 아이디어를 추가로 제안하세요 — 다른 구도·앵글, 레퍼런스에 없는 이미지 소재나 연출, 레퍼런스와 다른 색감·톤 시도 등 기획 의도에는 맞으면서 레퍼런스가 놓치고 있는 관점 위주로 1~3개, 왜 이 아이디어가 이 기획 의도에 어울리는지 근거와 함께. 레퍼런스가 아예 없다면 이 기획 의도에 맞는 새로운 비주얼 콘셉트를 처음부터 제안하세요)

카피 제안 섹션은 기획안에 등장하는 배너 문구(헤드카피·서브카피 등)가 한 줄 배너에 담기엔 너무 길거나, 추상적·모호해서 그대로 쓰기 어려운 경우에만 추가하세요:

[카피 제안]
- (원본 카피의 어떤 부분이 길거나 추상적인지 짧게 짚고, 기획 의도와 제작 방향은 그대로 유지한 채 배너용으로 간결하게 다듬은 대안 카피를 큰따옴표로 1~2개 제시. 원본의 의미나 소재를 새로 지어내지 말고 표현만 다듬는 카피라이팅에 그치세요)

원본 카피가 이미 배너 길이에 적합하고 명확하다면 [카피 제안] 섹션 자체를 통째로 생략하세요 — 억지로 고칠 카피를 만들어내지 마세요.

- visualRefCategory: 이 기획안의 업종·톤에 가장 잘 맞는 카테고리 하나를 아래 목록에서 정확히 골라 id 그대로 쓰세요 (목록에 없는 값은 절대 쓰지 마세요): ${categoryListText()}
- visualRefReason: 왜 그 카테고리·톤의 이미지가 이 기획안에 어울리는지 1문장, 30단어 이내로 (예: "미니멀한 톤에 제품 클로즈업 위주 레이아웃이 프리미엄 스킨케어 톤과 잘 맞아요"). 실제 참고 이미지 몇 장이 이 문장과 함께 제공될 예정이니 "찾아보세요"가 아니라 "이런 이유로 이 스타일이 어울립니다"는 어투로 쓰세요. 이 이미지들은 레이아웃·무드 참고용일 뿐이니, 컬러까지 그대로 따라야 한다는 뉘앙스는 넣지 마세요.

- pitfalls: 이 기획안 특성상 제작자가 실제로 놓치기 쉬운 지점 중 가장 중요한 것 2개만 배열로 작성하세요. 각 항목은 "무엇을 놓치기 쉬운지"와 "왜 그런지 또는 어떻게 방지하는지"를 함께 담아 20~40단어 정도로 구체적으로 쓰세요. "가독성에 유의하세요" 같은 일반론은 금지 — 반드시 이 기획안 내용에 실제로 근거한 지적이어야 합니다.

- briefGaps: 위 항목들과는 다른 관점입니다 — "배너를 어떻게 만들지"가 아니라 "이 기획안 자체에 부족하거나 애매한 부분이 있는지"를 짚으세요. 필수 정보 누락(가격·기간·타겟이 불명확함), 상충되는 지시사항, 제작에 필요한데 빠진 정보(사이즈·매체·마감일 등)가 있다면 무엇이 왜 문제인지 구체적으로 2~3문장으로 짚으세요. 기획안이 충분히 명확하고 빠진 게 없다면 "기획안 내용이 충분히 명확합니다"라고만 답하세요. 억지로 문제를 만들어내지 마세요.

기획안에 명시되지 않아 확인이 필요한 부분은 추측해서 채우지 말고, 해당 필드에서 "기획안에 명시되지 않아 담당자 확인 필요"라고 분명히 표시하세요.`;

const BRIEF_SCHEMA = `반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요:
{"originalCopyTranscript":"...","coreDirection":"...","creativeDirection":"...","visualRefCategory":"...","visualRefReason":"...","pitfalls":["...","..."],"briefGaps":"..."}`;

// 기획안은 팀이 경쟁사 레퍼런스·클립아트코리아·핀터레스트 등에서 스타일
// 참고 이미지를 긁어와 만드는 경우가 많아서, 정작 그 레퍼런스의 색상/톤이
// 해당 브랜드 공식 가이드와 다른 경우가 흔하다. 이걸 그대로 놔두면
// "레퍼런스대로 만들었는데 왜 지적받냐"는 상황이 생기므로, 브랜드
// 가이드라인을 알 때는 이 불일치를 브리프 단계에서 먼저 짚어준다.
function brandGuidelineCrossCheckInstruction(brandName, guideline) {
  return `

브랜드 가이드 참고: 이 기획안은 "${brandName}" 브랜드의 배너 제작을 위한 것입니다. 아래는 이 브랜드의 공식 디자인 가이드입니다:

${guideline}

기획안에 포함된 레퍼런스 이미지(경쟁사 벤치마킹, 클립아트코리아, 핀터레스트 등에서 가져온 스타일 참고용 이미지일 수 있습니다)의 색상·톤이 위 브랜드 공식 가이드와 다르다면, creativeDirection에서 레퍼런스의 색상을 그대로 따르라고 제안하지 마세요. 대신 "레퍼런스는 구도·레이아웃 참고용으로만 쓰고, 컬러는 브랜드 공식 컬러를 우선 적용해야 한다"는 점을 명확히 하세요. 이런 불일치가 있다면 briefGaps에도 예를 들어 "기획안 레퍼런스는 블루 톤이지만 브랜드 공식 컬러는 마젠타라 그대로 적용하면 안 됨"처럼 구체적으로 지적하세요. 레퍼런스와 브랜드 가이드가 일치하거나 레퍼런스에 특정 색상 지정이 없다면 이 지적은 생략하세요.`;
}

// Calls Gemini with the brief prompt + the given images and returns
// {coreDirection, creativeDirection, visualRefs, visualRefReason, pitfalls, briefGaps}.
// visualRefs is resolved server-side from our own curated reference-image
// library (api/_referenceLibrary.js) based on the category Gemini picked —
// this points designers at reference material we've already vetted instead
// of them grabbing random competitor/Pinterest images.
// brandContext (optional): { name, guideline } — when the brand this brief
// is for is known, cross-checks the brief's reference visuals against the
// brand's official guide (see brandGuidelineCrossCheckInstruction above).
// Throws an Error with a user-facing Korean message on any failure — the
// error's `.status` is set when it maps cleanly to an HTTP status.
export async function extractBriefDirection(images, apiKey, brandContext) {
  const hasBrandGuideline = !!(brandContext && brandContext.guideline);
  const promptText = BRIEF_PROMPT_BODY +
    (hasBrandGuideline ? brandGuidelineCrossCheckInstruction(brandContext.name, brandContext.guideline) : '') +
    '\n\n' + BRIEF_SCHEMA;

  const parts = [{ text: promptText }];
  for (const img of images) {
    if (!img || !img.base64 || !img.mediaType) continue;
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
  }

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
        // 2560/low였을 때 응답 JSON이 끝부분에서 종종 깨지는 현상이
        // 실측으로 확인돼(브랜드 가이드 대조까지 들어가면 더 자주),
        // 여유를 늘림. originalCopyTranscript 필드 추가로 조금 더 늘림.
        maxOutputTokens: 4608,
        // PPT 캡처는 텍스트 밀도가 높아 정확히 읽어야 하는 부담이 커서
        // (analyze.js에서 확인된 "자동교정하며 읽는" 문제와 같은 리스크),
        // medium보다 여유를 둠.
        thinkingConfig: { thinkingLevel: 'high' },
      },
    }),
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    const err = new Error('서버 응답을 읽지 못했습니다 (status ' + response.status + ').');
    err.status = response.status;
    throw err;
  }

  if (!response.ok) {
    const msg = (data && data.error && data.error.message) ? data.error.message : ('status ' + response.status);
    const err = new Error('Gemini API 오류: ' + msg);
    err.status = response.status;
    throw err;
  }

  const candidate = data.candidates && data.candidates[0];
  const responseParts = candidate && candidate.content && candidate.content.parts;
  const textBlock = (responseParts || []).map((p) => p.text || '').join('');
  const clean = textBlock.replace(/```json|```/g, '').trim();

  if (!clean) {
    const finishReason = candidate && candidate.finishReason;
    const err = new Error('AI로부터 빈 응답을 받았습니다' + (finishReason ? ` (사유: ${finishReason})` : '') + '.');
    err.status = 502;
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    const err = new Error('AI 응답을 해석하지 못했습니다.');
    err.status = 502;
    err.raw = textBlock;
    throw err;
  }

  const visualRefs = pickReferenceImages(parsed.visualRefCategory, VISUAL_REF_COUNT);
  delete parsed.visualRefCategory;
  if (!visualRefs.length) delete parsed.visualRefReason;
  return { ...parsed, visualRefs };
}
