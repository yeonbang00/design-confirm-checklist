// GET /api/referenceCategories
// Returns each category's id/name/item-count for the "이미지 레퍼런스"
// dropdown. No image data here — that's fetched on demand per category
// from /api/referenceImages, so this list stays light no matter how many
// images pile up.
//
// GET /api/referenceCategories?feed=history
// Returns the "히스토리" log entries (newest first) for history.html.
// Piggybacks on this existing route instead of a new endpoint file to
// stay under Vercel Hobby's serverless function count limit.
//
// DELETE /api/referenceCategories
// Body: { id: string, editPassword: string }
// Removes one history entry. Reuses the same shared edit password as
// brand-guide editing — there's no per-user login on this site, so this
// is the one check standing between "anyone with the link" and deleting
// history entries. New entries are added by Claude via a local script,
// not through this API — there's no POST here on purpose.

import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';
import { getHistoryEntries, removeHistoryEntry } from './_historyStore.js';
import { getUploadedReferenceImages } from './_referenceUploadsStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query && req.query.feed === 'history') {
      const entries = await getHistoryEntries();
      const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
      res.status(200).json({ entries: sorted });
      return;
    }

    const uploaded = await getUploadedReferenceImages();
    const categories = Object.entries(REFERENCE_CATEGORIES).map(([id, c]) => ({
      id,
      name: c.name,
      count: (c.items || []).length + uploaded.filter((u) => u.category === id).length,
    }));
    res.status(200).json({ categories });
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
      const removed = await removeHistoryEntry(id);
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
