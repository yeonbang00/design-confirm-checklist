// GET /api/referenceCategories
// Returns each category's id/name/item-count for the "이미지 레퍼런스"
// dropdown. No image data here — that's fetched on demand per category
// from /api/referenceImages, so this list stays light no matter how many
// images pile up.

import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const categories = Object.entries(REFERENCE_CATEGORIES).map(([id, c]) => ({
    id,
    name: c.name,
    count: (c.items || []).length,
  }));

  res.status(200).json({ categories });
}
