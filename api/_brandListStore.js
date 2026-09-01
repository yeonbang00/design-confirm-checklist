// Brands added directly from guide.html's "+ 브랜드 추가" UI, layered on
// top of the curated ADVERTISERS in _referenceBanners.js (see
// getAllAdvertisers()/getAdvertiser() there). Stored as one JSON file in
// Vercel Blob at a fixed, overwritable path, so the app always knows where
// to find it without a database.
//
// New brands start with no reference images (added by Claude later, the
// same way curated brands are) — only a name is settable from the
// browser. The guide checklist/customFields/feedback are then edited via
// the existing live brand-guide-state flow (api/_brandGuideStore.js) like
// any other brand.
//
// This file also tracks which CURATED brands (the ones hardcoded in
// _referenceBanners.js, like 유플러스) have been hidden via the "삭제"
// button. Curated brands can't be deleted from git at runtime, so
// "deleting" one here just adds its id to hiddenCuratedIds — the brand
// and its reference images stay intact in Blob/code, they're just filtered
// out of every list. Un-hiding isn't exposed in the UI (ask Claude to
// remove the id from this file's stored JSON if a curated brand needs to
// come back).
//
// Protected by the same shared BRAND_GUIDE_EDIT_PASSWORD as guide editing
// (see api/advertisers.js's POST/DELETE handlers) since both adding and
// deleting a brand are write actions.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const LIST_URL = `${BLOB_PUBLIC_BASE}/brand-list.json`;

async function readStore() {
  try {
    const resp = await fetch(`${LIST_URL}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return { brands: [], hiddenCuratedIds: [] };
    const data = await resp.json();
    return {
      brands: Array.isArray(data.brands) ? data.brands : [],
      hiddenCuratedIds: Array.isArray(data.hiddenCuratedIds) ? data.hiddenCuratedIds : [],
    };
  } catch (e) {
    return { brands: [], hiddenCuratedIds: [] };
  }
}

async function writeStore(store) {
  const bytes = Buffer.from(JSON.stringify(store), 'utf-8');
  await put('brand-list.json', bytes, 'application/json', { allowOverwrite: true });
}

function makeBrandId() {
  return 'custom-' + Math.random().toString(36).slice(2, 10);
}

export async function getDynamicBrands() {
  const store = await readStore();
  return store.brands;
}

export async function getHiddenCuratedIds() {
  const store = await readStore();
  return store.hiddenCuratedIds;
}

export async function addDynamicBrand(name) {
  const store = await readStore();
  const entry = {
    id: makeBrandId(),
    name,
    note: '아직 기준 배너가 등록되지 않았습니다.',
    images: [],
  };
  store.brands = [...store.brands, entry];
  await writeStore(store);
  return entry;
}

// Removes a brand that was itself added live (isCustom: true).
export async function removeDynamicBrand(id) {
  const store = await readStore();
  if (!store.brands.some((b) => b.id === id)) return false;
  store.brands = store.brands.filter((b) => b.id !== id);
  await writeStore(store);
  return true;
}

// "Deletes" a curated brand (defined in _referenceBanners.js) by hiding it
// everywhere without touching git or its Blob-hosted reference images.
export async function hideCuratedBrand(id) {
  const store = await readStore();
  if (store.hiddenCuratedIds.includes(id)) return false;
  store.hiddenCuratedIds = [...store.hiddenCuratedIds, id];
  await writeStore(store);
  return true;
}
