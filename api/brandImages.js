// GET /api/brandImages?id=<brandId>
// Returns the reference banner images (Blob URLs) for ONE brand, on
// demand. Kept separate from brandGuides.js/advertisers.js so those stay
// light — this endpoint is only called when the 브랜드 가이드 page actually
// needs to show images for the brand currently selected in the dropdown.
// Images live in Vercel Blob Storage (see _referenceBanners.js) so both
// thumbUrl and fullUrl are returned directly — no separate "full image"
// endpoint needed since URLs are cheap.

import { ADVERTISERS } from './_referenceBanners.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id } = req.query || {};
  const advertiser = id ? ADVERTISERS[id] : null;

  if (!advertiser) {
    res.status(404).json({ error: '브랜드를 찾을 수 없습니다.' });
    return;
  }

  const images = Array.isArray(advertiser.images) ? advertiser.images : [];
  res.status(200).json({ images });
}
