// POST /api/saveBrandGuideState
// Body: { id: string, checklist: {[itemId]: boolean}, customFields: [{label, value}], feedbackLog: [{date, text}], editPassword: string }
// Returns: { ok: true, composedGuideline: string } | { error: string }
//
// Protected by a shared team password (BRAND_GUIDE_EDIT_PASSWORD env var) —
// there's no per-user login on this site, so this is the one check standing
// between "anyone with the link" and overwriting a brand's live guide.

import { ADVERTISERS } from './_referenceBanners.js';
import { saveBrandGuideState } from './_brandGuideStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const expectedPassword = process.env.BRAND_GUIDE_EDIT_PASSWORD;
  if (!expectedPassword) {
    res.status(500).json({ error: '서버에 BRAND_GUIDE_EDIT_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { id, checklist, customFields, feedbackLog, editPassword } = req.body || {};

  if (!id || !ADVERTISERS[id]) {
    res.status(400).json({ error: '알 수 없는 브랜드입니다.' });
    return;
  }
  if (editPassword !== expectedPassword) {
    res.status(403).json({ error: '편집 비밀번호가 올바르지 않습니다.' });
    return;
  }

  try {
    const saved = await saveBrandGuideState(id, { checklist, customFields, feedbackLog });
    res.status(200).json({ ok: true, composedGuideline: saved.composedGuideline });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
  }
}
