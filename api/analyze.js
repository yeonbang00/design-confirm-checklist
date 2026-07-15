// POST /api/analyze
// Body: { base64: string, mediaType: "image/jpeg" | "image/png" | ... }
// Returns: { items: [...], ai_artifacts: [...], summary: string }
//
// The Gemini API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = `다음은 광고/디자인 시안 이미지입니다. 아래 11개 항목과 6개 AI 아티팩트 항목을 기준으로 평가하세요.

11개 항목:
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

AI 아티팩트 점검:
a 신체 비율 왜곡 여부 (인물이 없으면 flag는 false)
b 텍스트/로고 깨짐 여부
c 배경 패턴 부자연스러운 반복 여부
d 워터마크/서명 흔적 여부
e 오브젝트 경계 이음새 여부
f 광원-그림자 불일치 여부

11개 항목은 pass/minor/major/reject/na 중 하나로 판정하세요. na는 해당 시안에 적용되지 않는 항목에만 사용하세요.
각 항목에 10단어 이내 한국어 메모를 작성하세요.
AI 아티팩트 6개 항목은 flag(true=문제의심/false=정상)와 6단어 이내 메모를 작성하세요.
전체 요약은 15단어 이내로 작성하세요.

반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요:
{"items":[{"id":1,"status":"pass","note":"..."}],"ai_artifacts":[{"id":"a","flag":false,"note":"..."}],"summary":"..."}`;

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

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType: mediaType, data: base64 } },
            ],
          },
        ],
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
    const parts = candidate && candidate.content && candidate.content.parts;
    const textBlock = (parts || []).map((p) => p.text || '').join('');
    const clean = textBlock.replace(/```json|```/g, '').trim();

    if (!clean) {
      // Common cause: the response was blocked by safety filters.
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
