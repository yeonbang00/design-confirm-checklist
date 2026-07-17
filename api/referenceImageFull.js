// GET /api/referenceImageFull?category=<categoryId>&index=<i>
// Returns ONE reference image's higher-quality "fullData" version, on
// demand. The 경쟁사 레퍼런스 grid only shows compressed thumbnails by
// default (from /api/referenceImages) — this is fetched only when someone
// clicks a thumbnail to view it full-size in the lightbox.

import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { category, index } = req.query || {};
  const cat = category ? REFERENCE_CATEGORIES[category] : null;
  const items = cat && Array.isArray(cat.items) ? cat.items : [];
  const i = parseInt(index, 10);
  const item = Number.isInteger(i) ? items[i] : null;

  if (!item) {
    res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    return;
  }

  res.status(200).json({
    mimeType: item.mimeType || 'image/jpeg',
    data: item.fullData || item.data,
  });
}
