// POST /api/generateExampleBanner
// Body: { base64: string, mediaType: string, prompt: string }
// Returns: { imageUrl: string, mimeType: string } | { error: string }
//
// Generates a REFERENCE example banner image using OpenAI's image EDIT
// (reference-conditioned) endpoint — fed both the actual uploaded 기획안
// screenshot (so the brief's own reference imagery/composition gets
// reflected, not ignored) AND a text prompt built client-side
// (brief-helper.html) from the 기획안 direction extracted by
// /api/analyzeBrief (originalCopyTranscript/coreDirection/creativeDirection,
// so the brief's actual copy isn't ignored either). Called AFTER that
// analysis finishes (needs its output), not in parallel with it. Uploads
// the result to Vercel Blob Storage and returns the URL — same storage
// pattern as reference banners/PDFs.
//
// Scope note: even though the prompt asks for an actual polished banner
// attempt (not a deliberately rough/unfinished look), this is still only
// ever a reference for the designer — see the caller (brief-helper.html)
// for the "참고용 러프 시안" framing. The actual deliverable is still made
// by a designer.
//
// The OpenAI API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

import { put } from './_blobPut.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const IMAGE_MODEL = 'gpt-image-2';
const IMAGES_EDIT_URL = 'https://api.openai.com/v1/images/edits';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { base64, mediaType, prompt, size } = req.body || {};
  if (!base64 || !mediaType || !prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: '이미지 또는 프롬프트 데이터가 없습니다.' });
    return;
  }
  // 원본 배너가 정사각형이 아닌데 결과물을 무조건 1:1로 강제하면 완전히 다른
  // 구도를 새로 지어내게 되어 원본과 동떨어진 결과가 나온다 — 클라이언트가
  // 계산한 원본 비율에 가장 가까운 값을 쓰되, 허용 목록 밖의 값은 무시한다.
  const ALLOWED_SIZES = ['1024x1024', '1024x1536', '1536x1024'];
  const imageSize = ALLOWED_SIZES.includes(size) ? size : '1024x1024';

  try {
    const form = new FormData();
    form.append('model', IMAGE_MODEL);
    form.append('image', new Blob([Buffer.from(base64, 'base64')], { type: mediaType }), 'brief.jpg');
    form.append('prompt', prompt);
    form.append('size', imageSize);
    // 참고용 이미지라 최고화질까지는 필요 없어 medium으로 비용 절감.
    form.append('quality', 'medium');
    form.append('n', '1');

    const response = await fetch(IMAGES_EDIT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
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
      res.status(response.status).json({ error: 'OpenAI API 오류: ' + msg, raw: data });
      return;
    }

    const imageB64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!imageB64) {
      res.status(502).json({ error: '응답에서 이미지를 찾지 못했습니다.', raw: data });
      return;
    }

    const outputMimeType = 'image/png';
    const bytes = Buffer.from(imageB64, 'base64');
    const url = await put(`generated/example-${Date.now()}.png`, bytes, outputMimeType);

    res.status(200).json({ imageUrl: url, mimeType: outputMimeType });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
  }
}
