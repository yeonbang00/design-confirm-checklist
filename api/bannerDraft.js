// POST /api/bannerDraft
// Body: { product: {...} }
// Returns: { sets: [ {axis, sceneName, scene, dominantColor, copy, ink, ctaBg, ctaInk, imagePrompt} × 3 ] }
//
// 시안 3종의 '설계도'를 한 번에 만든다. 카피와 장면을 따로 부르지 않고 한
// 호출에서 같이 만드는 게 핵심이다 — 그래야 카피가 장면을 설명하고 장면이
// 카피를 뒷받침한다. 지금까지는 컨셉 → 이미지 → 카피 순서라 카피가 이미
// 만들어진 그림에 얹히기만 했다.
//
// 축은 세 개로 고정한다. 어떤 상품에나 성립하고 서로 확실히 다르기 때문이다.
//   A 제품 중심 — 배경 없이 형태·질감이 정확히
//   B 사용 장면 — 실제로 쓰이는 상황
//   C 분위기    — 색과 빛으로 인상
//
// 9개 카테고리(명품잡화·화장품·패션·스포츠·유아동·가전·생활·식품)로 시험해
// 8개는 세 장이 확실히 갈렸다. 걸린 하나는 퍼실 라벤더젤로, 제품 자체가
// 보라색이라 A(라벤더 무광)와 C(보랏빛 밤)가 같은 색조로 수렴했다. 그래서
// 지배색 거리를 서버에서 재고, 너무 가까우면 그 사실을 함께 돌려준다.

import { callOpenAI, OPENAI_MODEL } from './_openaiClient.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

// 축 설명은 원본이 무엇이냐에 따라 달라진다. 모델컷을 받아놓고 "배경 없이
// 제품만"이라고 시키면 모델을 지우고 옷만 남긴다. 실제로 그런 일이 났다.
const AXES = {
  packshot: [
    ['A', '제품 중심', '배경을 거의 두지 않고 제품 형태·질감·색이 가장 정확히 보이게.'],
    ['B', '사용 장면', '이 상품이 실제로 쓰이는 상황. 사람은 넣지 않아도 된다.'],
    ['C', '분위기',   '색과 빛으로 인상을 만든다. 제품은 있되 장면이 감각을 먼저 전한다.'],
  ],
  model: [
    ['A', '제품 중심', '인물은 그대로 두고 배경만 정리해, 착용한 제품이 가장 잘 보이게. 인물을 지우지 마라.'],
    ['B', '사용 장면', '인물이 이 옷을 입고 실제로 있을 법한 장소로 배경을 바꾼다.'],
    ['C', '분위기',   '색과 빛으로 인상을 만든다. 인물과 착장은 그대로 두고 시간대·조명·색조만 바꾼다.'],
  ],
};
const MIN_COLOR_DISTANCE = 90;   // 실측 기준 — 이보다 가까우면 눈으로도 비슷해 보였다

/* 숫자를 아예 금지했더니 "15% 할인받기" 같은 실제 관례를 못 쓰게 됐다.
   그래서 금지 대신 자리표시자만 허용한다 — AI는 문장을 정하고 숫자는
   코드가 상품 데이터에서 채운다. 데이터에 없는 값의 자리표시자는 애초에
   쓸 수 없다고 알려주므로, 지어낸 숫자가 들어갈 자리가 없다. */
const SLOTS = {
  '{할인율}':  (p) => (p.discountRate != null ? String(p.discountRate) : null),
  '{판매가}':  (p) => (p.salePrice != null ? Number(p.salePrice).toLocaleString('ko-KR') : null),
  '{정상가}':  (p) => (p.originalPrice != null ? Number(p.originalPrice).toLocaleString('ko-KR') : null),
  '{할인액}':  (p) => (p.discountAmount != null ? Number(p.discountAmount).toLocaleString('ko-KR')
                     : (p.originalPrice && p.salePrice && p.originalPrice > p.salePrice
                        ? Number(p.originalPrice - p.salePrice).toLocaleString('ko-KR') : null)),
};
function availableSlots(p) {
  return Object.keys(SLOTS).filter((k) => SLOTS[k](p) != null);
}
function fillSlots(text, p) {
  let out = String(text || '');
  for (const k of Object.keys(SLOTS)) {
    const v = SLOTS[k](p);
    // 값이 없는 자리표시자는 문구째로 지운다 — "% 할인받기"가 남으면 더 나쁘다
    out = v != null ? out.split(k).join(v) : out.replace(new RegExp('[^\\s]*' + k.replace(/[{}]/g, '\\$&') + '[^\\s]*\\s?', 'g'), '');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/* 몰마다 쓰는 말이 다르다. 신세계쇼핑은 서브카피에 혜택·할인을 넣고
   CTA를 "…혜택 받기"로 맺는 패턴이 굳어 있다. 실제 배너에서 관찰한 것을
   그대로 적었다. */
const COPY_STYLES = {
  default: { label: '기본', hint: '' },
  'shinsegae-shopping': {
    label: '신세계쇼핑',
    hint: `이 몰의 카피 관례를 따른다.
  - 서브카피에는 혜택이나 할인을 넣는다. 예: "첫 구매 {할인율}% 할인",
    "더블멤버십 추가 할인", "{할인액}원 웰컴 혜택".
  - CTA는 '받기'로 맺는 혜택형을 쓴다. 예: "혜택 받기", "멤버십 할인 받기",
    "가입 혜택 받고 구매하기", "단독 혜택 확인하기".
  - 메인 카피는 상품이나 시즌을 말하고, 혜택은 서브카피와 CTA가 맡는다.`,
  },
  benefit: {
    label: '혜택 강조',
    hint: `혜택을 앞세운다. 서브카피와 CTA 모두 지금 사면 무엇이 좋은지를 말한다.
  숫자는 반드시 자리표시자로만 쓴다.`,
  },
  brand: {
    label: '브랜드 톤',
    hint: `할인·혜택을 말하지 않는다. 상품과 브랜드의 인상만 남긴다.
  자리표시자를 쓰지 마라.`,
  },
};

function buildPrompt(p, retryNote) {
  const kind = p.imageType === 'model' ? 'model' : 'packshot';
  const axes = AXES[kind];
  const slots = availableSlots(p);
  const style = COPY_STYLES[p.copyStyle] || COPY_STYLES.default;
  const facts = [
    `상품명: ${p.productName || '(미상)'}`,
    `브랜드: ${p.brand || '(미상)'}`,
    `카테고리: ${p.category || '(미상)'}`,
    `특징: ${p.features || '(없음)'}`,
  ].join('\n');

  return `당신은 커머스 광고 아트디렉터다. 아래 상품으로 배너 소재 3종을 만든다.
3종은 아래 세 축을 하나씩 맡는다. 축은 고정이고, 각 축 안에서 이 상품에 맞는
구체적인 장면을 정한다.

${axes.map(([k, l, d]) => `  ${k} ${l} — ${d}`).join('\n')}

[반드시 지킬 것]

1. 세 장이 한눈에 달라 보여야 한다. 지배색·밝기·배경 재질이 서로 겹치면 실패다.
   카피도 마찬가지다. 세 장의 메인·서브·CTA가 각각 서로 달라야 한다. 특히
   서브카피와 CTA를 세 장에 똑같이 복사해 넣지 마라 — 같은 혜택을 말하더라도
   축마다 다른 말로 쓴다. (예: "멤버십 할인 받기" / "가입하고 할인받기" /
   "단독 혜택 확인하기")
   특히 제품 자체 색이 강한 상품(보라색 세제, 빨간 포장 등)은 A와 C가 그 색으로
   수렴하기 쉽다. C의 지배색은 제품 색과 명확히 다른 색조로 잡아라.

2. 제품 자체는 바꾸지 않는다. 형태·색·포장·개수는 그대로다. 바꾸는 것은
   배경·소품·조명·카메라 앵글뿐이다. 원본이 위에서 내려다본 상품컷이어도
   장면에 맞는 앵글로 다시 잡아라.
${kind === 'model' ? `
2-1. 원본은 사람이 착용한 사진이다. 세 장 모두 그 인물을 그대로 둔다.
   얼굴·머리·포즈·착장을 바꾸지 말고, 인물을 지우고 옷만 남기지도 마라.
   바꾸는 것은 인물 뒤와 주변뿐이다.` : ''}

3. 상품 정보에 없는 효능·성분·수상·인증·순위를 지어내지 마라.

4. 각 축마다 카피도 함께 쓴다. 카피와 장면이 서로를 설명해야 한다.
   - 메인 22자 이내 최대 2줄(\n으로 구분), 서브 30자 이내 1줄, CTA 12자 이내.
   - 배송·교환·적립 같은 거래 조건은 쓰지 마라. [특징]에 섞여 있어도 무시하라.

4-1. 숫자는 직접 쓰지 말고 아래 자리표시자만 쓴다. 실제 값은 코드가 상품
   데이터에서 채운다. 목록에 없는 자리표시자를 쓰면 그 문구가 통째로 지워진다.
   ${slots.length ? '이 상품에 쓸 수 있는 것: ' + slots.join(', ')
                  : '이 상품은 쓸 수 있는 자리표시자가 없다. 숫자를 아예 쓰지 마라.'}
   예: "첫 구매 {할인율}% 할인", "{판매가}원부터", "{할인액}원 혜택"
   자리표시자 밖의 숫자(순위·재구매율·판매량·기간)는 여전히 금지다.

4-2. ${style.hint || '몰 특유의 관례 없이 일반적인 커머스 카피로 쓴다.'}

5. imagePrompt는 영어로 쓴다. 반드시 포함한다.
   - 피사체(제품)를 그대로 유지하라는 지시
   - 바꿀 배경·소품·조명·카메라 앵글의 구체적 묘사
   - 카피가 들어갈 빈 영역을 어디에 얼마나 둘지 (예: left third kept empty)
   - 이미지 안에 글자·로고·워터마크를 넣지 말라는 지시

6. ink는 그 장면 위에 올릴 본문 글자색이다. 배경이 밝으면 어두운 색, 어두우면
   흰색으로 정한다. ctaBg/ctaInk는 버튼 배경과 글자색이며 둘 사이 명도대비가
   4.5:1 이상이어야 한다.
${retryNote ? '\n[직전 시도에서 아래가 겹쳤다. 색조를 확실히 벌려서 다시 만들어라]\n' + retryNote : ''}

[출력] JSON만 출력한다.

{"sets":[{
  "axis":"A", "axisLabel":"제품 중심",
  "sceneName":"한글 8자 이내 장면 이름",
  "scene":"장면 한 줄 설명(한글)",
  "dominantColor":"#RRGGBB",
  "brightness":"밝음|중간|어두움",
  "copy":{"headline":"메인 카피\\n둘째 줄","subcopy":"서브 카피","cta":"버튼 문구"},
  "ink":"#RRGGBB","ctaBg":"#RRGGBB","ctaInk":"#RRGGBB",
  "imagePrompt":"영어 이미지 생성 프롬프트"
}]}

[상품]
${facts}`;
}

const hex = (v, fb) => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v.toUpperCase() : fb);
function colorDistance(a, b) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}
function tooClose(sets) {
  const bad = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const d = colorDistance(sets[i].dominantColor, sets[j].dominantColor);
      if (d < MIN_COLOR_DISTANCE) {
        bad.push(`${sets[i].axis}(${sets[i].dominantColor}) ↔ ${sets[j].axis}(${sets[j].dominantColor}) 거리 ${d}`);
      }
    }
  }
  return bad;
}
function normalize(sets, kind, product) {
  const axes = AXES[kind === 'model' ? 'model' : 'packshot'];
  return sets.slice(0, 3).map((s, i) => {
    const ax = axes[i] || axes[0];
    const c = s.copy || {};
    return {
      axis: s.axis || ax[0],
      axisLabel: s.axisLabel || ax[1],
      sceneName: s.sceneName || ax[1],
      scene: s.scene || '',
      dominantColor: hex(s.dominantColor, '#888888'),
      brightness: s.brightness || '중간',
      copy: {
        headline: c.headline || '', subcopy: c.subcopy || '', cta: c.cta || '자세히 보기',
      },
      ink: hex(s.ink, '#FFFFFF'),
      ctaBg: hex(s.ctaBg, '#FFFFFF'),
      ctaInk: hex(s.ctaInk, '#111111'),
      imagePrompt: s.imagePrompt || '',
    };
  }).map(function (t) {
    // 자리표시자를 실제 값으로 바꾼다. 여기서만 숫자가 들어간다.
    t.copyRaw = { headline: t.copy.headline, subcopy: t.copy.subcopy, cta: t.copy.cta };
    t.copy.headline = fillSlots(t.copy.headline, product);
    t.copy.subcopy  = fillSlots(t.copy.subcopy, product);
    t.copy.cta      = fillSlots(t.copy.cta, product) || '자세히 보기';
    return t;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(503).json({ error: 'AI 시안 생성이 설정되지 않았습니다.' }); return; }

  const { product } = req.body || {};
  if (!product || !product.productName) {
    res.status(400).json({ error: '상품 정보가 필요합니다.' });
    return;
  }

  try {
    let out = await callOpenAI({
      apiKey, promptText: buildPrompt(product, null),
      maxOutputTokens: 6000, reasoningEffort: 'medium',
    });
    const kind = product.imageType === 'model' ? 'model' : 'packshot';
    let sets = normalize(Array.isArray(out && out.sets) ? out.sets : [], kind, product);
    if (sets.length < 3) { res.status(502).json({ error: 'AI가 시안 3종을 만들지 못했습니다.' }); return; }

    // 색이 겹치면 한 번만 다시 시킨다
    let clash = tooClose(sets);
    if (clash.length) {
      const retry = await callOpenAI({
        apiKey, promptText: buildPrompt(product, clash.join('\n')),
        maxOutputTokens: 6000, reasoningEffort: 'medium',
      }).catch(() => null);
      if (retry && Array.isArray(retry.sets)) {
        const s2 = normalize(retry.sets, kind, product);
        if (s2.length === 3 && tooClose(s2).length < clash.length) {
          sets = s2; clash = tooClose(s2);
        }
      }
    }

    res.status(200).json({ sets, colorClash: clash, imageType: kind,
      copyStyle: COPY_STYLES[product.copyStyle] ? product.copyStyle : 'default',
      slots: availableSlots(product), model: OPENAI_MODEL });
  } catch (err) {
    const status = err && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: err.message || '시안 생성에 실패했습니다.' });
  }
}
