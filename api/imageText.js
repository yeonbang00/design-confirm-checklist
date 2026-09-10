// POST /api/imageText
// Body: { url: string }
// Returns: { base64, mediaType, width?, height?, boxes:[{x,y,w,h,text}] } | { error }
//
// 상품 사진 위에 브랜드가 덧씌운 로고·워터마크의 자리를 알려준다.
//
// 왜 서버가 픽셀을 안 지우고 자리만 알려주는가 — 이 배포에는 이미지 처리
// 라이브러리가 없다(Sharp도 Canvas도 못 쓴다). 대신 브라우저에는 canvas가
// 있다. 그래서 서버는 바이트를 받아오고(몰 CDN이 CORS를 막아 브라우저가
// 직접 못 읽는다) 글자 자리를 찾고, 지우는 일은 화면이 한다.
//
// 프롬프트로 "로고를 지워라"라고 시켜 봤지만 지워지지 않았다. 좌표를 문장에
// 적어 넣어도 마찬가지였다 — BLUE FIT 로고가 세 번 다 그대로 남았다.
// 픽셀을 먼저 덮고 나서 생성해야 사라진다.

import { runOcr } from './_clovaOcr.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

function boxOf(field) {
  const v = field?.boundingPoly?.vertices;
  if (!Array.isArray(v) || v.length < 4) return null;
  const xs = v.map(p => Number(p.x) || 0), ys = v.map(p => Number(p.y) || 0);
  const x = Math.min(...xs), y = Math.min(...ys);
  const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h, text: String(field.inferText || '').slice(0, 40) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (rejectIfNotSameOrigin(req, res)) return;

  const url = typeof req.body?.url === 'string' ? req.body.url : '';
  if (!/^https?:\/\//.test(url)) { res.status(400).json({ error: '사진 주소가 필요합니다.' }); return; }

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
                    + '(KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      },
    });
    if (!r.ok) { res.status(502).json({ error: '원본 사진을 받지 못했습니다.' }); return; }
    const mediaType = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) { res.status(413).json({ error: '사진이 너무 큽니다.' }); return; }
    const base64 = buf.toString('base64');

    const fields = await runOcr(base64, mediaType);
    const boxes = (fields || []).map(boxOf).filter(Boolean);
    res.status(200).json({ base64, mediaType, boxes, ocr: !!fields });
  } catch (err) {
    res.status(500).json({ error: err.message || '사진의 글자를 찾지 못했습니다.' });
  }
}
