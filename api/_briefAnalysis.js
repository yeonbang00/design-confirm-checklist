// Shared logic for reading a planning document (기획안, usually PPT slides
// captured as screenshots) and turning it into actionable creative
// direction. Used by:
// - api/analyzeBrief.js: standalone 기획안 헬퍼 page (brief only, no banner)
// - api/analyze.js: when a banner is uploaded together with a brief, to
//   extract direction first and then judge whether the banner matches it

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const BRIEF_PROMPT_BODY = `다음 이미지는 배너 제작을 위한 기획안(PPT 캡처)입니다. 여러 장이라면 하나의 기획안으로 이어서 읽으세요.

중요: 기획안 내용을 그대로 요약하거나 나열하지 마세요. 어차피 제작자가 기획안 원본을 직접 볼 수 있으니, 내용을 다시 읽어주는 건 의미가 없습니다. 대신 이 기획안을 바탕으로 "배너를 어떻게 만들면 더 잘 만들 수 있을지" 실질적인 제작 방향을 제시하세요.

다음 5가지를 각각 채우세요. 모두 자연스러운 구어체 한국어로 작성하세요:

- coreDirection: 이 배너가 궁극적으로 무엇을 전달해야 하는지, 제작 시 가장 먼저 잡아야 할 핵심 방향을 1~2문장으로. 단순 목적 나열이 아니라 "이런 인상을 주는 게 핵심이다" 같은 실전 조언 톤으로.
- mustInclude: 기획안에서 언급된 필수 포함 요소들(상품명, 가격, 기간, 법적고지, 로고, 프로모션 코드 등)을 배열로. 각 항목은 10단어 이내 짧은 구절로. 기획안에 명시된 것만 포함하고 추측하지 마세요.
- creativeDirection: 톤앤무드, 레이아웃 우선순위, 컬러·비주얼 방향 등 실제로 어떻게 디자인하면 좋을지 구체적인 제안을 3~5문장으로. "이 기획 의도라면 이런 톤이 어울리고, 이 요소를 가장 크게 배치하는 게 좋겠다" 같은 실전 방향 제시.
- pitfalls: 이 기획안 특성상 제작자가 놓치기 쉽거나 흔히 실수하는 지점, 주의해야 할 점을 2~3문장으로.
- briefGaps: 위 4가지와는 다른 관점입니다 — "배너를 어떻게 만들지"가 아니라 "이 기획안 자체에 부족하거나 애매한 부분이 있는지"를 짚으세요. 예를 들어 필수 정보 누락(가격·기간·타겟이 불명확함), 상충되는 지시사항, 제작에 필요한데 빠진 정보(사이즈·매체·마감일 등) 같은 것들을 2~3문장으로. 기획안이 충분히 명확하고 빠진 게 없다면 "기획안 내용이 충분히 명확합니다"라고만 답하세요. 억지로 문제를 만들어내지 마세요.

기획안에 명시되지 않아 확인이 필요한 부분은 추측해서 채우지 말고, 해당 필드에서 "기획안에 명시되지 않아 담당자 확인 필요"라고 분명히 표시하세요.`;

const BRIEF_SCHEMA = `반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요:
{"coreDirection":"...","mustInclude":["...","..."],"creativeDirection":"...","pitfalls":"...","briefGaps":"..."}`;

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

// Calls Gemini with the brief prompt + the given images and returns the
// parsed {coreDirection, mustInclude, creativeDirection, pitfalls, briefGaps}.
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
        maxOutputTokens: 2560,
        thinkingConfig: { thinkingLevel: 'low' },
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

  try {
    return JSON.parse(clean);
  } catch (e) {
    const err = new Error('AI 응답을 해석하지 못했습니다.');
    err.status = 502;
    err.raw = textBlock;
    throw err;
  }
}
