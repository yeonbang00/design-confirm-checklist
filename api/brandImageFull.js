// GET /api/brandImageFull?id=<brandId>&index=<i>
// Returns ONE reference image's higher-quality "fullData" version, on
// demand. The 브랜드 가이드 gallery only shows compressed thumbnails by
// default (from /api/brandImages) — this is fetched only when someone
// clicks a thumbnail to view it full-size in the lightbox, so the gallery
// itself stays fast to load even as more images pile up.

import { ADVERTISERS } from './_referenceBanners.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id, index } = req.query || {};
  const advertiser = id ? ADVERTISERS[id] : null;
  const images = advertiser && Array.isArray(advertiser.images) ? advertiser.images : [];
  const i = parseInt(index, 10);
  const img = Number.isInteger(i) ? images[i] : null;

  if (!img) {
    res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    return;
  }

  res.status(200).json({
    mimeType: img.mimeType || 'image/jpeg',
    data: img.fullData || img.data,
  });
}
