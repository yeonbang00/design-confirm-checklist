// GET /api/mediaGuideDetails
// Returns each media platform's name/note/guideline text (and reference
// link/file metadata) for the standalone "매체 가이드" page. mediaGuides.js
// intentionally keeps its response light (no guideline text) for the
// analyze-form checkboxes; this endpoint returns the full content for
// display. PDF files live in Vercel Blob Storage (see _mediaGuides.js) so
// the URL is returned directly — no separate on-demand endpoint needed.

import { MEDIA_GUIDES } from './_mediaGuides.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const mediaGuides = Object.entries(MEDIA_GUIDES).map(([id, m]) => ({
    id,
    name: m.name,
    note: m.note || '',
    guideline: m.guideline || '',
    sourceUrl: m.sourceUrl || null,
    fileName: m.sourceFile ? m.sourceFile.fileName || null : null,
    fileUrl: m.sourceFile ? m.sourceFile.fileUrl || null : null,
  }));

  res.status(200).json({ mediaGuides });
}
