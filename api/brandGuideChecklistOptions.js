// GET /api/brandGuideChecklistOptions
// Returns the fixed checklist item catalog for the 브랜드 가이드 edit form:
// { id, section, label } only — promptText stays server-side, never sent
// to the browser, since it's just internal AI-prompt wording.

import { CHECKLIST_ITEMS } from './_brandGuideChecklist.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const items = CHECKLIST_ITEMS.map(({ id, section, label }) => ({ id, section, label }));
  res.status(200).json({ items });
}
