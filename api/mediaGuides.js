// GET /api/mediaGuides
// Returns the list of ad-platform guidelines for the frontend's
// "매체 가이드" selector dropdown. Never returns nothing sensitive —
// just id/name/note and whether a guideline has actually been filled in.

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
    hasGuideline: !!(m.guideline && m.guideline.trim()),
  }));

  res.status(200).json({ mediaGuides });
}
