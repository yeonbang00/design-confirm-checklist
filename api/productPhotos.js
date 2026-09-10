// POST /api/productPhotos
// Body: { urls: string[] }
// Returns: { photos: [{ url, role, hasPerson, colorway, note }] } | { error }
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

JSON만 출력하세요:
{"photos":[{"index":0,"role":"main","hasPerson":true,"colorway":"검정","burnedText":"","note":""}]}`;

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
      maxOutputTokens: 1400, reasoningEffort: 'low',
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
    res.status(200).json({ photos, model: OPENAI_MODEL });
  } catch (err) {
    res.status(err.status === 429 ? 429 : (err.status || 500))
      .json({ error: err.message || '상품 사진을 분류하지 못했습니다.' });
  }
}
