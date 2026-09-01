// Live, team-editable brand guide state — replaces the old static
// `guideline`/`specs` fields that used to live in _referenceBanners.js.
// Stored as one JSON file per brand in Vercel Blob Storage at a fixed,
// overwritable path (brand-guide-state/{brandId}.json), so the app always
// knows where to fetch it without needing a database.
//
// Before every overwrite, the previous state is archived to
// brand-guide-state/{brandId}-history/{timestamp}.json (not overwritten)
// as a lightweight recovery trail — there's no git history for these edits
// since they happen live from the browser.

import { put } from './_blobPut.js';
import { composeGuideline } from './_brandGuideChecklist.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';

function stateUrl(brandId) {
  return `${BLOB_PUBLIC_BASE}/brand-guide-state/${encodeURIComponent(brandId)}.json`;
}

function defaultState() {
  return { checklist: {}, customFields: [], feedbackLog: [], updatedAt: null };
}

// Returns { checklist, customFields, feedbackLog, updatedAt, composedGuideline }.
// composedGuideline is always recomputed fresh from the raw state, so it
// stays in sync even if CHECKLIST_ITEMS wording changes later.
export async function getBrandGuideState(brandId) {
  let state = defaultState();
  try {
    const resp = await fetch(stateUrl(brandId), { cache: 'no-store' });
    if (resp.ok) {
      const stored = await resp.json();
      state = { ...state, ...stored };
    }
  } catch (e) {
    // Blob not reachable / brand has no saved state yet — fall back to default.
  }
  return { ...state, composedGuideline: composeGuideline(state) };
}

export async function saveBrandGuideState(brandId, { checklist, customFields, feedbackLog }) {
  const prev = await getBrandGuideState(brandId);
  if (prev.updatedAt) {
    const backupBytes = Buffer.from(JSON.stringify({
      checklist: prev.checklist, customFields: prev.customFields, feedbackLog: prev.feedbackLog, updatedAt: prev.updatedAt,
    }), 'utf-8');
    await put(`brand-guide-state/${brandId}-history/${Date.now()}.json`, backupBytes, 'application/json');
  }

  const nextState = {
    checklist: checklist || {},
    customFields: Array.isArray(customFields) ? customFields : [],
    feedbackLog: Array.isArray(feedbackLog) ? feedbackLog : [],
    updatedAt: new Date().toISOString(),
  };
  const bytes = Buffer.from(JSON.stringify(nextState), 'utf-8');
  await put(`brand-guide-state/${brandId}.json`, bytes, 'application/json', { allowOverwrite: true });

  return { ...nextState, composedGuideline: composeGuideline(nextState) };
}
