// POST /api/analyzeBrief
// Body: { images: [{ base64: string, mediaType: string }, ...] }
// Returns: { coreDirection, mustInclude, creativeDirection, pitfalls }
//
// This is separate from /api/analyze (which grades a FINISHED banner
// against 19 checklist items). This endpoint instead reads a planning
// document (기획안, usually PPT slides captured as screenshots) and turns
// it into actionable creative direction for the designer — deliberately
// NOT a restatement/summary of the brief, since the team can already read
// the brief itself.
//
// The Gemini API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const BRIEF_PROMPT = `다음 이미지는 배너 제작을 위한 기획안(PPT 캡처)입니다. 여러 장이라면 하나의 기획안으로 이어서 읽으세요.

중요: 기획안 내용을 그대로 요약하거나 나열하지 마세요. 어차피 제작자가 기획안 원본을 직접 볼 수 있으니, 내용을 다시 읽어주는 건 의미가 없습니다. 대신 이 기획안을 바탕으로 "배너를 어떻게 만들면 더 잘 만들 수 있을지" 실질적인 제작 방향을 제시하세요.

다음 4가지를 각각 채우세요. 모두 자연스러운 구어체 한국어로 작성하세요:

- coreDirection: 이 배너가 궁극적으로 무엇을 전달해야 하는지, 제작 시 가장 먼저 잡아야 할 핵심 방향을 1~2문장으로. 단순 목적 나열이 아니라 "이런 인상을 주는 게 핵심이다" 같은 실전 조언 톤으로.
- mustInclude: 기획안에서 언급된 필수 포함 요소들(상품명, 가격, 기간, 법적고지, 로고, 프로모션 코드 등)을 배열로. 각 항목은 10단어 이내 짧은 구절로. 기획안에 명시된 것만 포함하고 추측하지 마세요.
- creativeDirection: 톤앤무드, 레이아웃 우선순위, 컬러·비주얼 방향 등 실제로 어떻게 디자인하면 좋을지 구체적인 제안을 3~5문장으로. "이 기획 의도라면 이런 톤이 어울리고, 이 요소를 가장 크게 배치하는 게 좋겠다" 같은 실전 방향 제시.
- pitfalls: 이 기획안 특성상 제작자가 놓치기 쉽거나 흔히 실수하는 지점, 주의해야 할 점을 2~3문장으로.

기획안에 명시되지 않아 확인이 필요한 부분은 추측해서 채우지 말고, 해당 필드에서 "기획안에 명시되지 않아 담당자 확인 필요"라고 분명히 표시하세요.

반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요:
{"coreDirection":"...","mustInclude":["...","..."],"creativeDirection":"...","pitfalls":"..."}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { images } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }
  if (images.length > 12) {
    res.status(400).json({ error: '이미지는 한 번에 최대 12장까지 분석할 수 있습니다.' });
    return;
  }

  const parts = [{ text: BRIEF_PROMPT }];
  for (const img of images) {
    if (!img || !img.base64 || !img.mediaType) continue;
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
  }

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
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingLevel: 'low' },
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

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
  }
}
