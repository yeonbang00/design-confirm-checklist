// POST /api/generateExampleBanner
// Body: { prompt: string }
// Returns: { imageUrl: string, mimeType: string } | { error: string }
//
// Generates a reference/example banner image from a text prompt (built
// from the 기획안 direction + brand guideline) using Gemini's image
// generation model, then uploads the result to Vercel Blob Storage and
// returns the URL — same storage pattern as reference banners/PDFs.
//
// The Gemini API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

import { put } from './_blobPut.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: '프롬프트가 없습니다.' });
    return;
  }

  try {
    const response = await fetch(INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        input: [{ type: 'text', text: prompt }],
        response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '1:1' },
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
      res.status(response.status).json({ error: 'Gemini API 오류: ' + msg, raw: data });
      return;
    }

    // Find the first image block in the response steps.
    let imageB64 = null;
    let mimeType = 'image/jpeg';
    const steps = data.steps || [];
    for (const step of steps) {
      const content = step.content || [];
      for (const block of content) {
        if (block.type === 'image' && block.data) {
          imageB64 = block.data;
          mimeType = block.mime_type || mimeType;
          break;
        }
      }
      if (imageB64) break;
    }

    if (!imageB64) {
      res.status(502).json({ error: '응답에서 이미지를 찾지 못했습니다.', raw: data });
      return;
    }

    const bytes = Buffer.from(imageB64, 'base64');
    const url = await put(`generated/example-${Date.now()}.jpg`, bytes, mimeType);

    res.status(200).json({ imageUrl: url, mimeType });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
  }
}
