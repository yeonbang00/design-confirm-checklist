// POST /api/generateExampleBanner
// Body: { base64: string, mediaType: string } — the uploaded 기획안 image
// Returns: { imageUrl: string, mimeType: string } | { error: string }
//
// Generates a REFERENCE/ROUGH-DRAFT example banner image from the uploaded
// 기획안 screenshot itself (via OpenAI's image EDIT/reference endpoint, not
// plain text-to-image), then uploads the result to Vercel Blob Storage and
// returns the URL — same storage pattern as reference banners/PDFs.
//
// Using the image-edit endpoint (rather than building a prompt from the
// separately-extracted coreDirection/creativeDirection text) means the
// caller can fire this at the same time as /api/analyzeBrief instead of
// waiting for it to finish first — cuts total wait time roughly in half.
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
const IMAGES_EDIT_URL = 'https://api.openai.com/v1/images/edits';

const FIXED_PROMPT = '첨부된 기획안(PPT 캡처) 이미지의 내용과 분위기에 어울리는 광고 배너의 러프 목업 이미지를 1:1 정사각형 비율로 만들어줘. 기획안 속 실제 문구·가격·로고는 그대로 옮기지 말고, 텍스트는 최소화하거나 의미 없는 더미 텍스트만 사용해. 완성된 배너가 아니라 톤·무드·레이아웃 구도만 보여주는 참고용 러프 시안으로 만들어줘.';

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

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }

  try {
    const form = new FormData();
    form.append('model', IMAGE_MODEL);
    form.append('image', new Blob([Buffer.from(base64, 'base64')], { type: mediaType }), 'brief.jpg');
    form.append('prompt', FIXED_PROMPT);
    form.append('size', '1024x1024');
    // 참고용 러프 시안이라 최고화질까지는 필요 없어 medium으로 비용 절감.
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
