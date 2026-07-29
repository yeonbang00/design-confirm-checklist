// POST /api/generateExampleBanner
// Body: { prompt: string }
// Returns: { imageUrl: string, mimeType: string } | { error: string }
//
// Generates a REFERENCE/ROUGH-DRAFT example banner image from a text
// prompt (built client-side from the 기획안 direction) using OpenAI's
// image generation model, then uploads the result to Vercel Blob Storage
// and returns the URL — same storage pattern as reference banners/PDFs.
//
// Scope note: this only ever produces a rough layout/mood reference, never
// a finished deliverable — see the caller (brief-helper.html) for the
// "참고용 러프 시안" framing. The actual banner is still made by a designer.
//
// The OpenAI API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

import { put } from './_blobPut.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const IMAGE_MODEL = 'gpt-image-2';
const IMAGES_URL = 'https://api.openai.com/v1/images/generations';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
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

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: '프롬프트가 없습니다.' });
    return;
  }

  try {
    const response = await fetch(IMAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: '1536x1024',
        // 참고용 러프 시안이라 최고화질까지는 필요 없어 medium으로 비용 절감.
        quality: 'medium',
        n: 1,
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
      res.status(response.status).json({ error: 'OpenAI API 오류: ' + msg, raw: data });
      return;
    }

    const imageB64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!imageB64) {
      res.status(502).json({ error: '응답에서 이미지를 찾지 못했습니다.', raw: data });
      return;
    }

    const mimeType = 'image/png';
    const bytes = Buffer.from(imageB64, 'base64');
    const url = await put(`generated/example-${Date.now()}.png`, bytes, mimeType);

    res.status(200).json({ imageUrl: url, mimeType });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
  }
}
