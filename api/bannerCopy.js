// POST /api/bannerCopy
// Body: { product: {...}, tone: 'product'|'emotion'|'benefit'|'price'|'season',
//         concept?: {...}, limits?: {...} }
// Returns: { copy: {headline, subcopy, badge, cta} } | { error }
//
// 광고 카피를 만든다. AI가 만드는 것은 문장뿐이고, 숫자는 절대 만들지 않는다.
// 가격·정상가·할인율·할인금액·재구매율·판매량·배송혜택은 전부 상품 데이터에서
// 오고, 코드가 조판한다 (명세 29번).
//
// 이걸 굳이 프롬프트로 한 번 더 막는 이유가 있다. 신세계 딜 페이지 제목이
// "최대 ~87% OFF"였는데 실제 데이터는 128개 전부 정확히 20%였다. 제목만 읽고
// 카피를 맡겼으면 배너에 87%가 박혔을 것이다.
//
// 길이 제한은 프롬프트에도 넣고 서버에서 다시 재서, 넘치면 한 번 더 시킨다.
// 그래도 넘치면 넘친 채로 돌려준다 — 조판 쪽에 폰트를 줄이고 경고를 띄우는
// 장치가 이미 있으므로 레이아웃이 깨지지는 않는다.

import { callOpenAI, OPENAI_MODEL } from './_openaiClient.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const DEFAULT_LIMITS = {
  headline: { maxChars: 22, maxLines: 2 },
  subcopy:  { maxChars: 30, maxLines: 2 },
  badge:    { maxChars: 14, maxLines: 1 },
  cta:      { maxChars: 10, maxLines: 1 },
};

const TONES = {
  product: '상품 자체의 쓰임과 장점을 말한다. 과장 없이 구체적으로.',
  emotion: '상황과 감정을 그린다. 제품 설명보다 장면이 먼저 떠오르게.',
  benefit: '지금 사면 무엇이 좋은지를 말한다. 다만 숫자는 쓰지 않는다.',
  price:   '가격 부담이 낮다는 인상을 준다. 숫자는 쓰지 않고 표현으로만.',
  season:  '지금 계절·시기에 맞는 이유를 말한다.',
};

function overLimit(copy, limits) {
  const bad = [];
  for (const [key, lim] of Object.entries(limits)) {
    const v = String(copy[key] || '');
    const lines = v.split('\n');
    if (lines.length > lim.maxLines) bad.push(`${key}: ${lines.length}줄 (최대 ${lim.maxLines}줄)`);
    const longest = Math.max(...lines.map((l) => l.length), 0);
    if (longest > lim.maxChars) bad.push(`${key}: ${longest}자 (최대 ${lim.maxChars}자)`);
  }
  return bad;
}

// AI가 숫자를 지어냈는지 본다. 상품 데이터에 실제로 있는 숫자는 통과시킨다.
// 가격 필드뿐 아니라 상품명·특징에 적힌 숫자도 실제 값이다 — "SPF50+"의
// 50이나 "800g"의 800을 지어낸 숫자로 잡으면 오탐만 쌓인다.
function inventedNumbers(copy, product) {
  const known = new Set();
  for (const v of [product.salePrice, product.originalPrice, product.discountRate, product.discountAmount]) {
    if (v == null) continue;
    known.add(String(v));
    known.add(Number(v).toLocaleString('ko-KR'));
  }
  const text = [product.productName, product.features, product.category, product.brand, product.description]
    .filter(Boolean).join(' ');
  for (const m of text.matchAll(/\d[\d,]*/g)) {
    known.add(m[0]);
    known.add(m[0].replace(/,/g, ''));
  }
  const hits = [];
  for (const key of ['headline', 'subcopy', 'badge', 'cta']) {
    for (const m of String(copy[key] || '').matchAll(/\d[\d,]*/g)) {
      const raw = m[0];
      if (!known.has(raw) && !known.has(raw.replace(/,/g, ''))) hits.push(`${key}: "${raw}"`);
    }
  }
  return hits;
}

function buildPrompt(product, tone, concept, limits, retryNote) {
  const p = product || {};
  const facts = [
    `상품명: ${p.productName || '(미상)'}`,
    `브랜드: ${p.brand || '(미상)'}`,
    `카테고리: ${p.category || '(미상)'}`,
    `특징: ${p.features || '(없음)'}`,
  ].join('\n');

  const conceptBlock = concept ? `
[이 배너의 비주얼 컨셉]
${concept.name} — ${concept.description || ''}
배경: ${concept.background || ''} / 조명: ${concept.lighting || ''}
카피 방향 힌트: ${concept.copyDirection || ''}
카피가 이 화면 위에 얹힌다는 걸 전제로 써라.` : '';

  const limitLines = Object.entries(limits)
    .map(([k, v]) => `  ${k}: 한 줄 ${v.maxChars}자 이내, 최대 ${v.maxLines}줄`).join('\n');

  return `당신은 커머스 배너 카피라이터다. 아래 상품의 배너 카피를 쓴다.

${facts}
${conceptBlock}

[톤] ${TONES[tone] || TONES.product}

[절대 하지 말 것]

1. 숫자를 쓰지 마라. 가격·정상가·할인율·할인금액·재구매율·판매량·후기수·
   배송일·기간을 카피에 넣지 마라. 이 값들은 상품 데이터에서 가져와 코드가
   따로 조판한다. AI가 쓴 숫자는 틀릴 수 있고, 틀린 숫자가 박힌 광고는
   심의에 걸린다.
   ("반값" "최저가" "역대급" 같은 수치 뉘앙스 표현도 쓰지 마라.)

2. 상품 정보에 없는 효능·성분·수상·인증·순위를 지어내지 마라.
   "1위" "베스트셀러" "검증된" 같은 표현도 근거가 없으면 쓰지 마라.

2-1. 배송·교환·환불·적립·쿠폰 같은 거래 조건을 카피에 쓰지 마라.
   "당일 배송" "무료배송" "첫구매 혜택" 류가 여기 해당한다. 아래 [특징]에
   그런 문구가 섞여 있어도 무시하라 — 쇼핑몰이 모든 상품에 똑같이 붙이는
   판매 문구이지 이 상품의 특징이 아니다. 이 조건들은 실제 정책에서 와야
   하고 코드가 따로 조판한다.

3. 다른 카테고리의 상투어를 가져오지 마라. 상품이 무엇인지 보고 그 상품의
   말로 써라. 옷이 아닌데 "입은 듯", 음식이 아닌데 "한 끼" 같은 식으로
   어긋나면 실패다.

[길이] 넘으면 레이아웃이 깨진다. 반드시 지켜라.
${limitLines}
  headline은 \\n 으로 줄을 나눈다. 의미가 끊기는 자리에서 나눠라.
${retryNote ? '\n[직전 시도가 길이를 넘었다. 반드시 줄여라]\n' + retryNote : ''}

[출력] 아래 JSON만 출력한다.

{
  "headline": "메인 카피\\n둘째 줄",
  "subcopy": "보조 설명 한 줄",
  "badge": "짧은 강조 문구 (없으면 빈 문자열)",
  "cta": "버튼 문구"
}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(503).json({ error: 'AI 카피 생성이 설정되지 않았습니다.' }); return; }

  const { product, tone, concept, limits } = req.body || {};
  if (!product || !product.productName) {
    res.status(400).json({ error: '상품 정보가 필요합니다.' });
    return;
  }
  const lim = { ...DEFAULT_LIMITS, ...(limits || {}) };

  try {
    let copy = await callOpenAI({
      apiKey, promptText: buildPrompt(product, tone, concept, lim, null),
      maxOutputTokens: 2000, reasoningEffort: 'medium',
    });

    // 길이를 넘으면 한 번만 다시 시킨다
    let over = overLimit(copy, lim);
    if (over.length) {
      const retry = await callOpenAI({
        apiKey, promptText: buildPrompt(product, tone, concept, lim, over.join('\n')),
        maxOutputTokens: 2000, reasoningEffort: 'medium',
      }).catch(() => null);
      if (retry) {
        const overAgain = overLimit(retry, lim);
        if (overAgain.length < over.length) { copy = retry; over = overAgain; }
      }
    }

    const invented = inventedNumbers(copy, product);
    res.status(200).json({
      copy: {
        headline: copy.headline || '',
        subcopy: copy.subcopy || '', badge: copy.badge || '', cta: copy.cta || '',
      },
      overLimit: over,          // 조판 쪽에서 경고로 띄운다
      inventedNumbers: invented, // 지어낸 숫자가 있으면 그대로 알려준다
      model: OPENAI_MODEL,
    });
  } catch (err) {
    const status = err && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: err.message || '카피 생성에 실패했습니다.' });
  }
}
