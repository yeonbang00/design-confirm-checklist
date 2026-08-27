// GET /api/rejectCases
// Returns every saved 반려사례 entry: { items: [{id, itemIds, reasons,
// brandName, thumbUrl, fullUrl, uploadedAt}, ...] }
//
// Unlike referenceImages.js (per-category, potentially hundreds of curated +
// uploaded images), this archive is manually curated by reviewers clicking
// "반려사례로 저장" only on cases worth keeping, so the total volume stays
// small — no need to split into a light "categories" list + per-category
// fetch. reference-board.html fetches this once and computes per-item counts
// and filtering client-side.

import { getRejectCases } from './_rejectCaseStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const items = await getRejectCases();
  res.status(200).json({ items });
}
