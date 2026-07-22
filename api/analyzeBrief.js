// POST /api/analyzeBrief
// Body: { images: [{ base64: string, mediaType: string }, ...], advertiserId?: string }
// Returns: { coreDirection, creativeDirection, visualRefs, visualRefReason, pitfalls, briefGaps }
//
// This is separate from /api/analyze (which grades a FINISHED banner
// against 19 checklist items). This endpoint instead reads a planning
// document (기획안, usually PPT slides captured as screenshots) and turns
// it into actionable creative direction for the designer — deliberately
// NOT a restatement/summary of the brief, since the team can already read
// the brief itself.
//
// advertiserId (optional): 기획안이 어느 브랜드용인지 알면, 기획안 속
// 레퍼런스 이미지(경쟁사/클립아트코리아/핀터레스트 등에서 가져온 스타일
// 참고용)의 색상·톤이 그 브랜드 공식 가이드와 다른 경우를 짚어준다.
//
// The actual prompt + Gemini call lives in _briefAnalysis.js so it can be
// reused by api/analyze.js (when a brief is uploaded alongside a banner).
//
// The Gemini API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

import { extractBriefDirection } from './_briefAnalysis.js';
import { getAdvertiser } from './_referenceBanners.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';
import { getBrandGuideState } from './_brandGuideStore.js';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { images, advertiserId } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }
  if (images.length > 1) {
    res.status(400).json({ error: '기획안 이미지는 1장만 업로드할 수 있습니다.' });
    return;
  }

  const advertiser = advertiserId ? await getAdvertiser(advertiserId) : null;
  let brandContext = null;
  if (advertiser) {
    const { composedGuideline } = await getBrandGuideState(advertiserId);
    if (composedGuideline) brandContext = { name: advertiser.name, guideline: composedGuideline };
  }

  try {
    const parsed = await extractBriefDirection(images, apiKey, brandContext);
    res.status(200).json(parsed);
  } catch (err) {
    const status = (err && err.status) || 500;
    const body = { error: err && err.message ? err.message : '알 수 없는 서버 오류' };
    if (err && err.raw) body.raw = err.raw;
    res.status(status).json(body);
  }
}
