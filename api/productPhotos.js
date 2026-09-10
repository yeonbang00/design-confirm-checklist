// POST /api/productPhotos
// Body: { urls: string[] }
// Returns: { photos:[{url,role,hasPerson,colorway,note}], category, cuts:[{name,person,scene}] }
//
// 시안 6종을 서로 다른 '컷'으로 만들려면, 가진 사진이 각각 무엇인지 알아야
// 한다. 단품컷을 모델 재촬영에 넣으면 없던 사람이 생기고, 모델컷을 스튜디오
// 단품에 넣으면 사람이 지워진다. 둘 다 광고로 못 쓰는 결과다.
//
// 비율이나 파일명으로는 구분이 안 된다(모델컷도 1:1이고 단품컷도 1:1이다).
// 그래서 사진을 실제로 보고 역할을 붙인다. 호출은 상품당 한 번이다.

import { callOpenAI, OPENAI_MODEL } from './_openaiClient.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const MAX_PHOTOS = 6;
const ROLES = new Set(['main', 'model', 'packshot', 'flat', 'detail', 'unusable']);

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const PROMPT = `당신은 광고 배너 제작자입니다. 상품 페이지에서 모은 사진들을 보고, 각 사진이 배너에서 어떤 소재로 쓸 수 있는지 분류하세요.

역할(role)은 다음 중 하나입니다.
- "model": 사람이 상품을 착용하거나 사용하고 있는 사진
- "packshot": 사람 없이 상품만 단독으로 찍은 사진 (배경이 단색이거나 스튜디오)
- "flat": 상품을 바닥에 펼쳐 위에서 찍은 사진, 또는 여러 구성품을 늘어놓은 사진
- "detail": 상세 페이지에서 잘라온 사진 — 소재 접사, 부분 확대, 또는 세로로 긴 편집 컷
- "unusable": 배너에 못 쓰는 것 — 정보 고시표, 사이즈 표, 글자가 화면을 채운 이미지, 후기 캡처, 로고만 있는 것

추가로 각 사진에 대해:
- hasPerson: 사람이 보이면 true
- colorway: 상품 색을 한국어 한 단어로 (예: "검정", "크림", "핑크"). 모르면 ""
- burnedText: 사진 위에 덧씌워진 글자나 로고가 있으면 그 글자를 그대로, 없으면 ""
- note: 이 사진을 배너에 쓸 때 주의할 점 한 문장. 없으면 ""

첫 번째 사진이 대표컷입니다. 그 사진이 model이나 packshot에 해당하더라도 role은 "main"으로 하세요.

## 두 번째 일 — 이 상품으로 찍을 만한 컷 후보 10개 쓰기

이 상품으로 배너 시안을 만듭니다. **서로 확실히 다른 촬영 컷 10개**를 제안하세요.
화장품·식품·신발·티셔츠는 어울리는 장면이 전혀 다릅니다. 사진에 보이는 것과
상품 종류에 맞는 장면만 쓰세요.

- category: fashion-top, fashion-outer, fashion-bottom, shoes, bag, accessory, beauty,
  food, kitchen, home, electronics, kids, sports, pet, other 중 하나

- cuts: 10개. 각 항목은
  - name: 한국어 짧은 이름 (4~8자). 예 "아침 주방", "무지 스튜디오", "창가 정물"
  - person: "none"(사람 없이 상품만) / "keep"(원본의 그 사람을 그대로 두고 장소만 바꿈)
  - scene: 영어 40~70단어. 장소·소품·빛·카메라 거리와 각도만.

10개를 이렇게 섞으세요.
- **4개 이상은 person을 "none"** 으로. 사진에 사람이 있으면 **3개 이상은 person을 "keep"** 으로,
  서로 다른 장소에서. 사람이 없는 상품이면 **10개 전부 "none"** 으로 하세요.
- 거리를 섞으세요 — 제품이 화면에 다 안 들어올 만큼 붙은 매크로, 보통 거리, 멀찍이 빠진 넓은 컷.
- 장소·구성을 겹치지 마세요.

**절반 이상은 눈길이 한 번에 가는 연출이어야 합니다.** 예쁜 방에 제품을 올려둔 정물만
열 개 쓰면 무드보드가 됩니다. 아래 같은 것을 적극적으로 섞으세요 —
상품 종류에 안 맞는 것은 빼고, 맞는 것만 고르세요.

- 물·액체가 튀어 오르는 순간에 제품이 있는 컷
- 제품이 공중에 떠 있고 그림자만 바닥에 있는 컷
- 같은 제품을 격자나 대각선으로 반복 배치한 패턴 컷
- 제품 표면에 완전히 붙은 매크로 — 질감만 보이고 전체 형태는 안 보임
- 손이 제품을 들고 있는 컷 (얼굴은 프레임 밖)
- 제품 두 개를 대각선으로 겹쳐 깊이를 만든 컷
- 제품의 내용물·원료·질감만 단독으로 찍은 컷
- 강한 단색 배경에 딱딱한 그림자를 떨어뜨린 그래픽 컷
- 젖은 표면이나 거울에 비친 반사를 쓴 컷
- 역광 실루엣, 또는 빛줄기가 제품을 가로지르는 컷
- 제품을 훨씬 큰 구조물처럼 올려다보는 로우앵글 컷

scene 문장 규칙:
- 상품의 색이나 모양은 쓰지 마세요 — 그건 원본 사진에서 가져옵니다.
- 글자, 로고, 간판, 가격표, 브랜드명을 장면에 넣지 마세요.
- person이 "none"이면 문장 끝에 "No person in the frame."을 붙이세요.

JSON만 출력하세요:
{"photos":[{"index":0,"role":"main","hasPerson":true,"colorway":"검정","burnedText":"","note":""}],
 "category":"fashion-top",
 "cuts":[{"name":"무지 스튜디오","person":"none","scene":"..."}]}`;

const CATEGORIES = new Set(['fashion-top', 'fashion-outer', 'fashion-bottom', 'shoes', 'bag',
  'accessory', 'beauty', 'food', 'kitchen', 'home', 'electronics', 'kids', 'sports', 'pet', 'other']);
// 장면에 글자가 들어가면 배너 조판 자리가 망가진다. 뚫고 들어오면 그 컷만 버린다.
const BANNED = /\b(text|letter|word|logo|sign|signage|label|price tag|billboard|poster|brand name)\b/i;

function cleanCuts(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [], seen = new Set();
  for (const row of raw) {
    const scene = typeof row?.scene === 'string' ? row.scene.trim().replace(/\s+/g, ' ') : '';
    const name = typeof row?.name === 'string' ? row.name.trim().slice(0, 16) : '';
    if (scene.length < 40 || scene.length > 700 || !name) continue;
    if (BANNED.test(scene)) continue;
    // 같은 장면을 이름만 바꿔 두 번 낸 경우를 막는다
    const finger = scene.slice(0, 70).toLowerCase();
    if (seen.has(finger)) continue;
    seen.add(finger);
    out.push({ name, person: row.person === 'keep' ? 'keep' : 'none', scene });
    if (out.length >= 14) break;
  }
  return out;
}

async function fetchImage(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
                  + '(KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
  });
  if (!r.ok) return null;
  const type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\//.test(type)) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  // 8MB 넘는 것은 상세페이지 통짜 이미지다. 분류에 넣으면 요청만 커진다.
  if (!buf.length || buf.length > 8 * 1024 * 1024) return null;
  return { base64: buf.toString('base64'), mediaType: type };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(503).json({ error: 'AI 분류가 설정되지 않았습니다.' }); return; }

  const urls = Array.isArray(req.body?.urls)
    ? req.body.urls.filter(u => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, MAX_PHOTOS)
    : [];
  if (!urls.length) { res.status(400).json({ error: '분류할 사진 주소가 필요합니다.' }); return; }

  try {
    const fetched = await Promise.all(urls.map(u => fetchImage(u).catch(() => null)));
    const images = [], kept = [];
    fetched.forEach((img, i) => { if (img) { images.push(img); kept.push(urls[i]); } });
    if (!images.length) { res.status(502).json({ error: '상품 사진을 받아오지 못했습니다.' }); return; }

    const data = await callOpenAI({
      apiKey, promptText: PROMPT, images,
      maxOutputTokens: 5000, reasoningEffort: 'low',
    });

    const rows = Array.isArray(data?.photos) ? data.photos : [];
    const photos = kept.map((url, i) => {
      const row = rows.find(r => Number(r?.index) === i) || rows[i] || {};
      const role = ROLES.has(row.role) ? row.role : (i === 0 ? 'main' : 'packshot');
      return {
        url,
        role: i === 0 ? 'main' : role,
        hasPerson: !!row.hasPerson,
        colorway: String(row.colorway || '').slice(0, 12),
        burnedText: String(row.burnedText || '').slice(0, 60),
        note: String(row.note || '').slice(0, 120),
      };
    });
    res.status(200).json({
      photos,
      category: CATEGORIES.has(data?.category) ? data.category : 'other',
      cuts: cleanCuts(data?.cuts),
      model: OPENAI_MODEL,
    });
  } catch (err) {
    res.status(err.status === 429 ? 429 : (err.status || 500))
      .json({ error: err.message || '상품 사진을 분류하지 못했습니다.' });
  }
}
