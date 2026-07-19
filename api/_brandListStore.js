// Brands added directly from guide.html's "+ 브랜드 추가" UI, layered on
// top of the curated ADVERTISERS in _referenceBanners.js (see
// getAllAdvertisers()/getAdvertiser() there). Stored as one JSON list in
// Vercel Blob at a fixed, overwritable path, so the app always knows where
// to find it without a database.
//
// New brands start with no reference images (added by Claude later, the
// same way curated brands are) — only a name is settable from the
// browser. The guide checklist/customFields/feedback are then edited via
// the existing live brand-guide-state flow (api/_brandGuideStore.js) like
// any other brand.
//
// Protected by the same shared BRAND_GUIDE_EDIT_PASSWORD as guide editing
// (see api/advertisers.js's POST handler) since adding a brand is also a
// write action.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const LIST_URL = `${BLOB_PUBLIC_BASE}/brand-list.json`;

export async function getDynamicBrands() {
  try {
    const resp = await fetch(LIST_URL, { cache: 'no-store' });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.brands) ? data.brands : [];
  } catch (e) {
    return [];
  }
}

function makeBrandId() {
  return 'custom-' + Math.random().toString(36).slice(2, 10);
}

export async function addDynamicBrand(name) {
  const brands = await getDynamicBrands();
  const entry = {
    id: makeBrandId(),
    name,
    note: '아직 기준 배너가 등록되지 않았습니다.',
    images: [],
  };
  const bytes = Buffer.from(JSON.stringify({ brands: [...brands, entry] }), 'utf-8');
  await put('brand-list.json', bytes, 'application/json', { allowOverwrite: true });
  return entry;
}
