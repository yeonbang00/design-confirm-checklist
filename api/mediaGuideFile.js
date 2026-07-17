// GET /api/mediaGuideFile?id=<mediaGuideId>
// Returns the downloadable PDF (base64) for ONE media guide, on demand.
// Kept separate from mediaGuideDetails.js so that endpoint stays light —
// this is only called when someone actually clicks the download button
// for a specific platform's guide on the 매체 가이드 page.

import { MEDIA_GUIDES } from './_mediaGuides.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id } = req.query || {};
  const mediaGuide = id ? MEDIA_GUIDES[id] : null;

  if (!mediaGuide || !mediaGuide.sourceFile || !mediaGuide.sourceFile.data) {
    res.status(404).json({ error: '등록된 파일을 찾을 수 없습니다.' });
    return;
  }

  res.status(200).json({
    fileName: mediaGuide.sourceFile.fileName || 'guide.pdf',
    mimeType: mediaGuide.sourceFile.mimeType || 'application/pdf',
    data: mediaGuide.sourceFile.data,
  });
}
