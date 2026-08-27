// GET /api/rejectCases
// Returns every saved 반려사례 entry: { items: [{id, itemIds, reasons,
// brandName, thumbUrl, fullUrl, uploadedAt}, ...] }
//
// Unlike referenceImages.js (per-category, potentially hundreds of curated +
// uploaded images), this archive is manually curated by reviewers clicking
// "반려사례로 저장" only on cases worth keeping, so the total volume stays
// small — no need to split into a light "categories" list + per-category
// fetch. reference-board.html fetches this once and computes per-item counts
// and filtering client-side.
//
// DELETE /api/rejectCases
// Body: { id: string, editPassword: string }
// Removes one saved case. Same shared edit password as history-entry
// deletion (referenceCategories.js) — there's no per-user permission system
// on this site, so this is the one check standing between "anyone logged
// in" and deleting a curated archive entry (unlike saving one, which is
// purely additive and needs no extra password).

import { getRejectCases, removeRejectCase } from './_rejectCaseStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const items = await getRejectCases();
    res.status(200).json({ items });
    return;
  }

  if (req.method === 'DELETE') {
    if (rejectIfNotSameOrigin(req, res)) return;

    const expectedPassword = process.env.BRAND_GUIDE_EDIT_PASSWORD;
    if (!expectedPassword) {
      res.status(500).json({ error: '서버에 BRAND_GUIDE_EDIT_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
      return;
    }

    const { id, editPassword } = req.body || {};
    if (editPassword !== expectedPassword) {
      res.status(403).json({ error: '편집 비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: '삭제할 항목을 지정해주세요.' });
      return;
    }

    try {
      const removed = await removeRejectCase(id);
      if (!removed) {
        res.status(400).json({ error: '존재하지 않는 항목입니다.' });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
