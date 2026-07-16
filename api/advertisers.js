// GET /api/advertisers
// Returns the list of advertisers that have reference banners registered,
// for the frontend's advertiser-selector dropdown. Never returns the image
// data itself (keeps the response small and fast).

import { ADVERTISERS } from './_referenceBanners.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const advertisers = Object.entries(ADVERTISERS).map(([id, a]) => ({
    id,
    name: a.name,
    note: a.note || '',
    imageCount: (a.images || []).length,
  }));

  res.status(200).json({ advertisers });
}
