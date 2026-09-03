// POST /api/bannerImage
// Body: { imageUrl?: string, base64?: string, mediaType?: string,
//         imagePrompt: string, size?: '1024x1024'|'1024x1536'|'1536x1024' }
// Returns: { imageUrl } | { error }
//
// 컨셉 배경 이미지를 만든다. 제품을 새로 그리지 않는다 — 원본 상품 사진을
// edits 엔드포인트에 넣고 "피사체는 그대로, 배경만 교체"를 시킨다. 텍스트
// 생성도 금지한다. 카피와 가격은 HTML/CSS 레이어가 올린다.
//
// 이렇게 하는 이유는 명세 29번이다. AI가 제품 형태를 바꾸면 그 배너는
// 실물과 다른 광고가 되고, 아이폰·갤럭시처럼 기기 이미지 규정이 센 상품은
// 아예 못 쓴다.
//
// 결과는 Blob에 올려 URL로 돌려준다 (generateExampleBanner.js와 같은 방식).
// 이미지 1장에 비용이 드니 컨셉 5개를 한꺼번에 만들지 않는다. 사용자가
// 고른 컨셉 하나만 만든다.

import { put } from './_blobPut.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const IMAGE_MODEL = 'gpt-image-2';
const EDITS_URL = 'https://api.openai.com/v1/images/edits';
const GEN_URL = 'https://api.openai.com/v1/images/generations';
const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024']);

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

const KEEP = 'Keep the product and any people EXACTLY as they are — same shape, same colour, '
  + 'same packaging, same garment, same faces, same poses. Do not redraw, restyle or replace them. '
  + 'Change ONLY the environment behind and around them.';
const NO_TEXT = 'Do not render any text, letters, numbers, logos or watermarks anywhere in the image.';

async function fetchSource(imageUrl) {
  const r = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
                  + '(KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
  });
  if (!r.ok) throw Object.assign(new Error('원본 이미지를 받지 못했습니다.'), { status: 502 });
  const type = r.headers.get('content-type') || 'image/jpeg';
  return { buf: Buffer.from(await r.arrayBuffer()), type };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(503).json({ error: 'AI 이미지 생성이 설정되지 않았습니다.' }); return; }

  const { imageUrl, base64, mediaType, imagePrompt, size } = req.body || {};
  if (!imagePrompt) { res.status(400).json({ error: '이미지 프롬프트가 필요합니다.' }); return; }
  const outSize = ALLOWED_SIZES.has(size) ? size : '1024x1024';
  const prompt = `${KEEP} ${imagePrompt} ${NO_TEXT}`;

  try {
    let apiRes;
    if (imageUrl || base64) {
      // 원본이 있으면 edits — 제품을 유지한 채 배경만 바꾼다
      let buf, type;
      if (base64) { buf = Buffer.from(base64, 'base64'); type = mediaType || 'image/png'; }
      else { const s = await fetchSource(imageUrl); buf = s.buf; type = s.type; }

      const form = new FormData();
      form.append('model', IMAGE_MODEL);
      form.append('image', new Blob([buf], { type }), 'source.png');
      form.append('prompt', prompt);
      form.append('size', outSize);
      form.append('quality', 'high');
      apiRes = await fetch(EDITS_URL, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    } else {
      // 원본이 없으면 배경만 새로 만든다 (제품은 나중에 얹는다)
      apiRes = await fetch(GEN_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: outSize, quality: 'high', n: 1 }),
      });
    }

    const data = await apiRes.json().catch(() => null);
    if (!apiRes.ok || !data) {
      const msg = data && data.error && data.error.message ? data.error.message : ('status ' + apiRes.status);
      res.status(apiRes.status === 429 ? 429 : 502).json({ error: '이미지 생성 실패: ' + msg });
      return;
    }
    const b64 = data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) { res.status(502).json({ error: 'AI가 이미지를 돌려주지 않았습니다.' }); return; }

    const key = `banner-concepts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const url = await put(key, Buffer.from(b64, 'base64'), 'image/png');   // 문자열 URL을 돌려준다
    res.status(200).json({ imageUrl: url, size: outSize });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || '이미지 생성에 실패했습니다.' });
  }
}
