// POST /api/bannerImage
// Body: { imageUrl?: string, base64?: string, mediaType?: string,
//         scene?: string, keep?: 'person'|'item'|'product',
//         imagePrompt?: string, size?: '1024x1024'|'1024x1536'|'1536x1024' }
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

/* 프롬프트를 장면부터 쓴다.
 *
 * 예전에는 "상품을 유지하라"를 1,100자쯤 앞에 깔고 장면을 뒤에 한 줄
 * 붙였다. 그렇게 하면 gpt-image-2는 원본 사진을 거의 그대로 되돌려준다.
 * 실측 — 같은 원본에 "의자에 앉혀라", "가까이 당겨라", "멀리 빼라" 세 가지를
 * 각각 시켰더니 셋 다 원본과 같은 거리, 같은 간판, 같은 포즈가 나왔다.
 * 사용자가 "여섯 컷이 다 똑같다"고 한 것이 이 지점이다.
 *
 * 순서를 뒤집으니 바뀌었다 — (1) 새 장면을 먼저 선언하고 (2) "원본의 장소는
 * 아무것도 남기지 마라"를 박고 (3) 지킬 것을 짧게 뒤에 붙인다. 같은 원본에서
 * 실내 좌식컷과 무인 스튜디오컷이 실제로 나왔다.
 *
 * KEEP은 세 가지뿐이고 서버가 문장으로 바꾼다. 클라이언트가 문장을 통째로
 * 보내면 "사람을 지워라" 같은 지시가 섞여 들어올 수 있다.
 */
const KEEPS = {
  // 사람이 든 사진 — 사람과 입은 것을 전부 지킨다
  person:
    'FROM THE REFERENCE, KEEP ONLY: the same person — same face, hair and body type — wearing '
    + 'exactly the same garments. Every item they wear must stay identical in colour, cut and '
    + 'length, including the trousers and the shoes. Change nothing about what they are wearing.',
  // 사람이 든 사진에서 그 물건만 꺼낸다
  item:
    'FROM THE REFERENCE, KEEP ONLY: the product the person is wearing or holding — its exact '
    + 'colour, material, texture, proportions, printed label and packaging typography. '
    + 'Do not include the person.',
  // 사람이 있는지 확인하지 못한 사진 — 어느 쪽이든 깨지지 않게 둔다
  subject:
    'FROM THE REFERENCE, KEEP ONLY: the product itself — its exact shape and proportions, '
    + 'colour, material and texture, packaging and label design. If a person appears in the '
    + 'reference, keep that same person and exactly the same garments they wear.',
  // 사람이 없는 상품 사진
  product:
    'FROM THE REFERENCE, KEEP ONLY: the product itself — its exact shape and proportions, '
    + 'colour, material and texture, packaging and label design, and the number of items. '
    + 'Do not add a person.',
};

const CUT_TIES =
  'NOTHING from the reference photograph\'s location or setting may appear — none of its '
  + 'background, no part of its street, room, signage, furniture or props. Discard its pose and '
  + 'its camera angle entirely and shoot the scene above from scratch. '
  + 'It must read as one photograph taken on location, not a subject cut out and pasted onto a '
  + 'different background: re-light everything to match the new scene and add contact shadows '
  + 'and reflections consistent with that light.';

/* 예전에는 "이미지 어디에도 글자를 그리지 마라"였다. 그 한 줄이 상품에 원래
 * 인쇄된 라벨까지 지웠다 — 설화수 병에서 제품명이 통째로 사라져 무지 병이
 * 됐다. 배너에 얹을 카피를 AI가 그리지 못하게 하려던 지시가, 상품 정체성인
 * 인쇄 라벨까지 함께 날린 것이다. 둘을 갈라 쓴다. */
const NO_TEXT =
  'Do not add any graphic text overlay to the picture — no headline, no caption, no price, '
  + 'no watermark, no badge, no brand mark laid over the image. '
  + 'But the product\'s OWN printed label, engraving and packaging typography must stay '
  + 'exactly as it appears in the reference: same wording, same lettering, same size and same '
  + 'position on the product. Never blank out, blur or simplify the product\'s own label.';
// 카피가 얹힐 자리를 비워두게 한다. 안 그러면 제품이 화면을 꽉 채워
// 글자를 놓을 곳이 없고, 어두운 영역을 아무리 걸어도 읽기 어려워진다.
const ROOM = 'Compose the frame so that roughly one third of the image is calm, uncluttered '
  + 'background with no important detail — this empty area is reserved for text that will be '
  + 'added later. Keep the product clearly inside the remaining area.';

function buildPrompt({ scene, keep, imagePrompt }) {
  // 예전 호출부는 imagePrompt 한 덩어리만 보낸다. 그대로 받아 준다.
  if (!scene) return `${imagePrompt} ${KEEPS.product} ${ROOM} ${NO_TEXT}`;
  const keeper = KEEPS[keep] || KEEPS.product;
  return `Generate a completely new photograph. THE NEW SCENE: ${scene} `
    + `${CUT_TIES} ${keeper} ${imagePrompt ? imagePrompt + ' ' : ''}${ROOM} ${NO_TEXT}`;
}

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

  const { imageUrl, base64, mediaType, imagePrompt, scene, keep, size } = req.body || {};
  if (!imagePrompt && !scene) { res.status(400).json({ error: '이미지 프롬프트가 필요합니다.' }); return; }
  const outSize = ALLOWED_SIZES.has(size) ? size : '1024x1024';
  const prompt = buildPrompt({
    scene: typeof scene === 'string' ? scene.slice(0, 900) : '',
    keep: typeof keep === 'string' ? keep : '',
    imagePrompt: typeof imagePrompt === 'string' ? imagePrompt.slice(0, 500) : '',
  });

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
