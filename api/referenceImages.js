// GET /api/referenceImages?category=<categoryId>
// Returns the reference images (with brand name + caption) for ONE
// category, on demand. Kept separate from referenceCategories.js so that
// list stays light — this is only called when someone actually selects a
// category on the 경쟁사 레퍼런스 page.

import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { category } = req.query || {};
  const cat = category ? REFERENCE_CATEGORIES[category] : null;

  if (!cat) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }

  res.status(200).json({ items: cat.items || [] });
}
