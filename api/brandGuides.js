// GET /api/brandGuides
// Returns each advertiser's name/note/live guide state (checklist +
// custom fields + feedback log + composed guideline text) for the
// standalone "브랜드 가이드" page. advertisers.js intentionally keeps its
// response light for the dropdown, but the guide page needs the actual
// content to display and edit.
//
// The guide content itself is no longer static — see
// api/_brandGuideStore.js — so this fetches each brand's live state.

import { ADVERTISERS } from './_referenceBanners.js';
import { getBrandGuideState } from './_brandGuideStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const brands = await Promise.all(Object.entries(ADVERTISERS).map(async ([id, a]) => {
      const state = await getBrandGuideState(id);
      return {
        id,
        name: a.name,
        note: a.note || '',
        imageCount: (a.images || []).length,
        guideline: state.composedGuideline,
        checklist: state.checklist,
        customFields: state.customFields,
        feedbackLog: state.feedbackLog,
        updatedAt: state.updatedAt,
      };
    }));

    res.status(200).json({ brands });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
  }
}
