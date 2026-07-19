// GET /api/mediaGuides
// Returns the list of ad-platform guidelines (curated + live-added) for
// the frontend's "매체 가이드" selector dropdown. Never returns anything
// sensitive — just id/name/note and whether a guideline has actually been
// filled in.
//
// POST /api/mediaGuides
// Body: { name: string, sourceUrl?: string, fileBase64?: string, fileName?: string, editPassword: string }
// Adds a new media guide live from media-guide.html's "+ 매체 추가" UI (see
// api/_mediaGuideListStore.js). Registers just the name + optional source
// link/PDF — the actual spec cards/guideline text still need to be sent to
// Claude to read and fill in (same process as the curated entries below).
// Reuses the same shared edit password as brand-guide editing — there's no
// per-user login on this site, so this is the one check standing between
// "anyone with the link" and adding media guides. Piggybacks on this
// existing route (instead of a new endpoint file) to stay under Vercel
// Hobby's serverless function count limit.

import { getAllMediaGuides } from './_mediaGuides.js';
import { addDynamicMediaGuide } from './_mediaGuideListStore.js';
import { put } from './_blobPut.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mediaGuidesMap = await getAllMediaGuides();
    const mediaGuides = Object.entries(mediaGuidesMap).map(([id, m]) => ({
      id,
      name: m.name,
      note: m.note || '',
      hasGuideline: !!(m.guideline && m.guideline.trim()),
    }));
    res.status(200).json({ mediaGuides });
    return;
  }

  if (req.method === 'POST') {
    if (rejectIfNotSameOrigin(req, res)) return;

    const expectedPassword = process.env.BRAND_GUIDE_EDIT_PASSWORD;
    if (!expectedPassword) {
      res.status(500).json({ error: '서버에 BRAND_GUIDE_EDIT_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
      return;
    }

    const { name, sourceUrl, fileBase64, fileName, editPassword } = req.body || {};
    if (editPassword !== expectedPassword) {
      res.status(403).json({ error: '편집 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      res.status(400).json({ error: '매체 이름을 입력해주세요.' });
      return;
    }

    try {
      const mediaGuidesMap = await getAllMediaGuides();
      const duplicate = Object.values(mediaGuidesMap).some((m) => m.name === trimmedName);
      if (duplicate) {
        res.status(400).json({ error: '이미 등록된 매체 이름입니다.' });
        return;
      }

      let sourceFile = null;
      if (fileBase64) {
        const bytes = Buffer.from(fileBase64, 'base64');
        const safeName = (fileName || 'guide.pdf').trim() || 'guide.pdf';
        const fileUrl = await put(`media-guides/${safeName}`, bytes, 'application/pdf');
        sourceFile = { fileName: safeName, mimeType: 'application/pdf', fileUrl };
      }

      const trimmedUrl = (sourceUrl || '').trim();
      const mediaGuide = await addDynamicMediaGuide({
        name: trimmedName,
        sourceUrl: trimmedUrl || null,
        sourceFile,
      });
      res.status(200).json({ ok: true, mediaGuide });
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
