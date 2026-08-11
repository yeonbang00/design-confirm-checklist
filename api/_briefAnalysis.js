// Shared logic for reading a planning document (기획안, usually PPT slides
// captured as screenshots) and turning it into actionable creative
// direction. Used by:
// - api/analyzeBrief.js: standalone 기획안 헬퍼 page (brief only, no banner)
// - api/analyze.js: when a banner is uploaded together with a brief, to
//   extract direction first and then judge whether the banner matches it

import { listNonEmptyCategories, pickReferenceImages } from './_referenceLibrary.js';
import { callOpenAI } from './_openaiClient.js';

const VISUAL_REF_COUNT = 3;

function categoryListText() {
  return listNonEmptyCategories().map((c) => `${c.id}(${c.name})`).join(', ');
}

const BRIEF_PROMPT_BODY = `다음 이미지는 배너 제작을 위한 기획안(PPT 캡처) 1장입니다.

중요: 기획안 내용을 그대로 요약하거나 나열하지 마세요. 어차피 제작자가 기획안 원본을 직접 볼 수 있으니, 내용을 다시 읽어주는 건 의미가 없습니다. 대신 이 기획안을 바탕으로 "배너를 어떻게 만들면 더 잘 만들 수 있을지" 실질적인 제작 방향을 제시하세요. 기획안에 이미 나와 있는 필수 요소(상품명·가격·기간·로고 등)를 다시 나열하는 건 하지 마세요 — 제작자가 원본에서 이미 확인할 수 있는 정보입니다.

가장 먼저 originalCopyTranscript 필드를 채우세요: 기획안에 등장하는 배너 문구(실제로 배너에 들어갈 문구로 보이는 텍스트)를 이미지에 적힌 그대로 정확히 옮겨 적으세요. 문맥상 "이런 말이겠지"로 자동으로 고쳐 쓰거나 매끄럽게 다듬지 말고, 진짜 눈에 보이는 글자 그대로 옮기세요 (자음·모음 하나 차이로 다른 글자가 되는 경우를 특히 조심하세요 — 스치듯 읽으면 놓치기 쉽습니다). 각 줄 맨 앞에 그 문구의 역할을 "메인카피:", "서브카피:", "부가설명:" 중 하나로 반드시 표시하세요 (예: 메인카피: 요금제 하나에 싹 다 담았어요 / 서브카피: 콘텐츠 찾느라 헤맬 필요 없이 / 부가설명: #디즈니+티빙 너겟65 #무약정 #무제한5G). 역할 구분이 애매하면 가장 크고 중심적인 문구를 메인카피로, 그 위아래의 보조 문구를 서브카피로, 해시태그·각주성 문구를 부가설명으로 판단하세요. 배너 문구가 아예 안 보이면 이 필드는 빈 문자열로 두세요. 아래 creativeDirection의 [카피 제안]은 반드시 이 필드에 옮겨 적은 문구와 역할 라벨을 기준으로 작성하세요 — 기억이나 인상으로 다시 쓰지 마세요.

나머지는 다음을 각각 채우세요. 모두 자연스러운 구어체 한국어로 작성하세요:

- coreDirection: 이 배너가 궁극적으로 무엇을 전달해야 하는지, 제작 시 가장 먼저 잡아야 할 핵심 방향을 1~2문장으로. 단순 목적 나열이 아니라 "이런 인상을 주는 게 핵심이다" 같은 실전 조언 톤으로.

- creativeDirection: coreDirection에서 이미 말한 핵심 방향·톤을 다시 풀어 쓰지 말고, 그 방향을 실제로 어떻게 구현할지 구체적인 제안만 담으세요. 아래 형식을 그대로 지켜서 체계적으로 작성하세요. 대괄호로 시작하는 헤더 줄과 "- "로 시작하는 항목들로 구성하고, 섹션 사이는 빈 줄로 구분하세요:

[비주얼 제안]
- (기획안에 참고 이미지가 포함되어 있어도, 그 레퍼런스를 어떻게 더 잘 구현할지·잘 살릴지를 설명하는 건 이 섹션의 역할이 아닙니다. 그 레퍼런스에는 없는 새로운 비주얼 아이디어를 추가로 제안하세요 — 다른 구도·앵글, 레퍼런스에 없는 이미지 소재나 연출, 레퍼런스와 다른 색감·톤 시도 등 기획 의도에는 맞으면서 레퍼런스가 놓치고 있는 관점 위주로 1~3개, 왜 이 아이디어가 이 기획 의도에 어울리는지 근거와 함께. 레퍼런스가 아예 없다면 이 기획 의도에 맞는 새로운 비주얼 콘셉트를 처음부터 제안하세요)

creativeDirection에는 [카피 제안] 헤더도 반드시 포함하세요 — 절대 생략하지 말고, 아래 두 경우 중 해당하는 하나로 채우세요:

[카피 제안]
- 원본 카피(메인카피·서브카피·부가설명) 중 한 줄 배너에 담기엔 너무 길거나 추상적·모호해서 그대로 쓰기 어려운 문구가 있다면: 역할 라벨과 원본 문구를 먼저 쓰고 화살표(→)로 다듬은 대안 카피를 이어서 한 줄에 쓰세요. 형식 예시: 메인카피 "요금제 하나에 싹 다 담았어요" → "디즈니+부터 넷플릭스까지, 요금제 하나로 싹 다!" (원본이 서술형으로 길어 한눈에 안 들어와 축약). 역할 라벨은 originalCopyTranscript에 적은 메인카피/서브카피/부가설명 중 실제로 고치는 것 하나만 쓰고, 왜 고치는지 이유도 괄호 안에 짧게 덧붙이세요. 1~2개까지만 제시하고, 기획 의도와 제작 방향은 그대로 유지한 채 표현만 다듬는 카피라이팅에 그치세요. 원본의 의미나 소재를 새로 지어내지 마세요.
- 원본 카피가 이미 배너 길이에 적합하고 명확해서 고칠 필요가 없다면: 억지로 고칠 카피를 만들어내지 말고, 대신 "원본 카피가 이미 배너 길이에 적합하고 명확해 별도 제안이 필요 없습니다."라고만 쓰세요.

- visualRefCategory: 이 기획안의 업종·톤에 가장 잘 맞는 카테고리 하나를 아래 목록에서 정확히 골라 id 그대로 쓰세요 (목록에 없는 값은 절대 쓰지 마세요): ${categoryListText()}
- visualRefKeywords: 이 기획안의 비주얼 컨셉을 나타내는 한국어 키워드 2~4개를 배열로 쓰세요(예: ["미니멀","제품 클로즈업","화이트톤"]). 업종이 달라도 컨셉·구도가 비슷하면 참고하는 경우가 많아서, 이 키워드로 업종 경계와 무관하게 컨셉이 가까운 이미지를 우선 추천하는 데 씁니다 — 업종명을 반복하지 말고 레이아웃·색감·분위기·구도·연출 방식처럼 실제로 이미지에서 구분되는 컨셉 키워드 위주로 쓰세요.
- visualRefReason: 왜 그 카테고리·톤의 이미지가 이 기획안에 어울리는지 1문장, 30단어 이내로 (예: "미니멀한 톤에 제품 클로즈업 위주 레이아웃이 프리미엄 스킨케어 톤과 잘 맞아요"). 실제 참고 이미지 몇 장이 이 문장과 함께 제공될 예정이니 "찾아보세요"가 아니라 "이런 이유로 이 스타일이 어울립니다"는 어투로 쓰세요. 이 이미지들은 레이아웃·무드 참고용일 뿐이니, 컬러까지 그대로 따라야 한다는 뉘앙스는 넣지 마세요.

- pitfalls: 이 기획안 특성상 제작자가 실제로 놓치기 쉬운 지점 중 가장 중요한 것 2개만 배열로 작성하세요. 각 항목은 "무엇을 놓치기 쉬운지"와 "왜 그런지 또는 어떻게 방지하는지"를 함께 담아 20~40단어 정도로 구체적으로 쓰세요. "가독성에 유의하세요" 같은 일반론은 금지 — 반드시 이 기획안 내용에 실제로 근거한 지적이어야 합니다.

- briefGaps: 위 항목들과는 다른 관점입니다 — "배너를 어떻게 만들지"가 아니라 "이 기획안 자체에 부족하거나 애매한 부분이 있는지"를 짚으세요. 필수 정보 누락(가격·기간·타겟이 불명확함), 상충되는 지시사항, 제작에 필요한데 빠진 정보(사이즈·매체·마감일 등)가 있다면 무엇이 왜 문제인지 구체적으로 2~3문장으로 짚으세요. 기획안이 충분히 명확하고 빠진 게 없다면 "기획안 내용이 충분히 명확합니다"라고만 답하세요. 억지로 문제를 만들어내지 마세요.

기획안에 명시되지 않아 확인이 필요한 부분은 추측해서 채우지 말고, 해당 필드에서 "기획안에 명시되지 않아 담당자 확인 필요"라고 분명히 표시하세요.`;

const BRIEF_SCHEMA = `반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요:
{"originalCopyTranscript":"...","coreDirection":"...","creativeDirection":"...","visualRefCategory":"...","visualRefKeywords":["...","..."],"visualRefReason":"...","pitfalls":["...","..."],"briefGaps":"..."}`;

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

// Calls OpenAI with the brief prompt + the given images and returns
// {coreDirection, creativeDirection, visualRefs, visualRefReason, pitfalls, briefGaps}.
// visualRefs is resolved server-side from our own curated reference-image
// library (api/_referenceLibrary.js) based on the category the AI picked —
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

  // reasoning 모델은 눈에 보이는 JSON 출력뿐 아니라 내부 reasoning 토큰도
  // 이 예산 안에서 함께 소비되므로 여유 있게 잡음(실사용량만큼만 과금).
  // PPT 캡처는 텍스트 밀도가 높아 정확히 읽어야 하는 부담이 커서(자동교정하며
  // 읽는 문제 리스크), reasoning effort는 medium보다 여유를 둔 high로.
  const parsed = await callOpenAI({
    apiKey,
    promptText,
    images,
    maxOutputTokens: 10000,
    reasoningEffort: 'high',
  });

  const visualRefs = pickReferenceImages(parsed.visualRefCategory, VISUAL_REF_COUNT, parsed.visualRefKeywords);
  delete parsed.visualRefCategory;
  delete parsed.visualRefKeywords;
  if (!visualRefs.length) delete parsed.visualRefReason;
  return { ...parsed, visualRefs };
}
