// POST /api/bannerConcepts
// Body: { product: {brand, productName, category, features, salePrice, ...},
//         count?: number, baseConcept?: {...} }
// Returns: { concepts: [...] } | { error: string }
//
// 상품에 맞는 광고 컨셉을 AI가 새로 만든다. 여름/겨울/프리미엄 같은 고정
// 목록을 쓰지 않는 게 핵심이다 — 데님 스커트면 Coastal Morning·French
// Cafe·Urban Weekend가 나와야 하고, 삼계탕이면 Black Dining·Rustic
// Kitchen·Modern Marble이 나와야 한다. 카테고리를 코드가 분기하지 않고
// 상품 정보를 그대로 넘겨 AI가 판단하게 둔다.
//
// baseConcept를 주면 그 컨셉의 변주(비슷한 컨셉)를 만든다.
//
// 컨셉은 '무엇을 바꿀지'만 정한다. 제품·모델·의상·포장은 손대지 않는다.
// 그래서 imagePrompt에도 배경/조명/소품만 쓰게 하고, 텍스트 생성은 금지한다.
//
// API 키는 이 서버 환경변수에만 있고 브라우저로 나가지 않는다.

import { callOpenAI, OPENAI_MODEL } from './_openaiClient.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const MAX_COUNT = 8;

function buildPrompt(product, count, baseConcept) {
  const p = product || {};
  const lines = [
    `상품명: ${p.productName || '(미상)'}`,
    `브랜드: ${p.brand || '(미상)'}`,
    `카테고리: ${p.category || '(미상)'}`,
    `특징: ${p.features || '(없음)'}`,
    p.salePrice ? `판매가: ${p.salePrice}원` : null,
    p.imageDescription ? `메인 이미지: ${p.imageDescription}` : null,
  ].filter(Boolean).join('\n');

  const variantBlock = baseConcept ? `
이번에는 새 컨셉을 처음부터 만들지 말고, 아래 컨셉의 변주를 ${count}개 만들어라.
큰 방향(무드·색감)은 유지하고 장소·소품·시간대·조명만 바꾼다.

기준 컨셉: ${baseConcept.name} — ${baseConcept.description}
배경: ${baseConcept.background} / 조명: ${baseConcept.lighting}
` : '';

  return `당신은 커머스 광고 아트디렉터다. 아래 상품에 어울리는 광고 컨셉을 ${count}개 제안하라.

${lines}
${variantBlock}
[반드시 지킬 것]

1. 여름/겨울/프리미엄 같은 계절·등급 상투어를 기본값으로 쓰지 마라.
   상품 카테고리에 실제로 어울리는 촬영 컨셉을 새로 짜라.
   패션이면 장소와 시간대(해변 산책로·유럽 카페·도심 스트리트·미니멀
   스튜디오·노을 자연광)로, 음식이면 상차림과 재질(블랙 테이블·원목·
   대리석·파인다이닝·자연광 아침 식탁)로 갈리는 식이다. 이건 예시일 뿐이니
   그대로 베끼지 말고 이 상품에 맞는 걸 생각하라.

2. ${count}개가 서로 눈에 띄게 달라야 한다. 색감·장소·조명이 겹치면 실패다.
   최소 하나는 배경이 거의 없는 스튜디오형(제품 형태가 가장 정확히 보이는
   안)을 넣어라.

3. 제품 자체는 절대 바꾸지 않는다. 바꾸는 것은 배경·환경·소품·조명·색감뿐이다.
   모델이 있는 사진이면 얼굴·포즈·의상도 그대로 둔다.

4. 상품에 없는 효능·성분·수상·인증을 지어내지 마라.

5. imagePrompt는 영어로 쓴다. 반드시 다음을 포함한다.
   - 피사체(제품/모델)를 그대로 유지하라는 지시
   - 바꿀 배경·조명·소품의 구체적 묘사
   - 이미지 안에 글자·로고·워터마크를 넣지 말라는 지시

6. ink는 그 배경 위에 올릴 본문 글자색이다. 배경이 밝으면 어두운 색,
   어두우면 흰색으로 정한다. ctaBg/ctaInk는 버튼 배경과 글자색이며 둘 사이
   명도대비가 4.5:1 이상이어야 한다.

[출력 형식] 아래 JSON만 출력한다. 설명 문장을 덧붙이지 마라.

{
  "concepts": [
    {
      "id": "kebab-case-영문-id",
      "name": "한글 컨셉명 (12자 이내)",
      "description": "이 컨셉이 어떤 인상을 주는지 한 문장 (40자 이내)",
      "mood": "bright, airy 같은 영어 키워드 2~3개",
      "background": "배경 한 줄 설명 (한글)",
      "lighting": "조명 한 줄 설명 (한글)",
      "colorPalette": ["#RRGGBB", "#RRGGBB", "#RRGGBB"],
      "copyDirection": "이 컨셉에 어울리는 카피 방향 (한글, 20자 이내)",
      "ink": "#RRGGBB",
      "accent": "#RRGGBB",
      "ctaBg": "#RRGGBB",
      "ctaInk": "#RRGGBB",
      "imagePrompt": "영어 이미지 생성 프롬프트"
    }
  ]
}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'AI 컨셉 생성이 설정되지 않았습니다.' });
    return;
  }

  const { product, count, baseConcept } = req.body || {};
  if (!product || !product.productName) {
    res.status(400).json({ error: '상품 정보가 필요합니다.' });
    return;
  }
  const n = Math.max(1, Math.min(MAX_COUNT, Number(count) || 5));

  try {
    const out = await callOpenAI({
      apiKey,
      promptText: buildPrompt(product, n, baseConcept),
      maxOutputTokens: 6000,
      reasoningEffort: 'medium',
    });
    const concepts = Array.isArray(out && out.concepts) ? out.concepts.slice(0, n) : [];
    if (!concepts.length) {
      res.status(502).json({ error: 'AI가 컨셉을 만들지 못했습니다.' });
      return;
    }
    // 색상값이 비거나 형식이 틀린 경우를 대비해 최소한만 보정한다.
    // 여기서 카테고리별 기본 컨셉을 끼워넣지는 않는다 — 그러면 다시
    // 고정 목록이 되어버린다.
    const hex = (v, fb) => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v.toUpperCase() : fb);
    for (const c of concepts) {
      c.ink    = hex(c.ink, '#FFFFFF');
      c.accent = hex(c.accent, '#FFFFFF');
      c.ctaBg  = hex(c.ctaBg, '#FFFFFF');
      c.ctaInk = hex(c.ctaInk, '#111111');
      c.colorPalette = (Array.isArray(c.colorPalette) ? c.colorPalette : [])
        .map((v) => hex(v, null)).filter(Boolean).slice(0, 4);
      if (!c.id) c.id = (c.name || 'concept').replace(/\s+/g, '-').toLowerCase();
    }
    res.status(200).json({ concepts, model: OPENAI_MODEL });
  } catch (err) {
    const status = err && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: err.message || '컨셉 생성에 실패했습니다.' });
  }
}
