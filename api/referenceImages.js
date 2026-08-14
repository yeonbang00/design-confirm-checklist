// GET /api/referenceImages?category=<categoryId>
// Returns the reference images (with brand name + caption + Blob URLs)
// for ONE category, on demand. Kept separate from referenceCategories.js
// so that list stays light — this is only called when someone actually
// selects a category on the 이미지 레퍼런스 page. Images live in Vercel
// Blob Storage (see _referenceLibrary.js) so both thumbUrl and fullUrl
// are returned directly — no separate "full image" endpoint needed since
// URLs are cheap; the browser only fetches the actual bytes when an
// <img> src is set to one of these URLs.

import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { category } = req.query || {};

  if (!category || category === 'all') {
    const items = Object.values(REFERENCE_CATEGORIES).flatMap((cat) => cat.items || []);
    res.status(200).json({ items });
    return;
  }

  const cat = REFERENCE_CATEGORIES[category];
  if (!cat) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }

  res.status(200).json({ items: cat.items || [] });
}
