// GET /api/brandGuides
// Returns each advertiser's name/note/guideline text (and reference image
// count) for the standalone "브랜드 가이드" page. This is the one place
// that returns the full guideline text — advertisers.js intentionally
// keeps its response light for the dropdown, but the guide page needs the
// actual content to display.

import { ADVERTISERS } from './_referenceBanners.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const brands = Object.entries(ADVERTISERS).map(([id, a]) => ({
    id,
    name: a.name,
    note: a.note || '',
    guideline: a.guideline || '',
    imageCount: (a.images || []).length,
  }));

  res.status(200).json({ brands });
}
