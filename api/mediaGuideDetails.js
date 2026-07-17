// GET /api/mediaGuideDetails
// Returns each media platform's name/note/guideline text (and reference
// link/file metadata) for the standalone "매체 가이드" page. mediaGuides.js
// intentionally keeps its response light (no guideline text) for the
// analyze-form checkboxes; this endpoint returns the full content for
// display. PDF file BYTES are not included here — those are fetched
// on demand from /api/mediaGuideFile so this list stays light even as
// more platforms and larger PDFs get added.

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
    hasFile: !!(m.sourceFile && m.sourceFile.data),
    fileName: m.sourceFile ? m.sourceFile.fileName || null : null,
  }));

  res.status(200).json({ mediaGuides });
}
