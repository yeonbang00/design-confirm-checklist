// Media guides added directly from media-guide.html's "+ 매체 추가" UI,
// layered on top of the curated MEDIA_GUIDES in _mediaGuides.js (see
// getAllMediaGuides()/getMediaGuide() there). Stored as one JSON file in
// Vercel Blob at a fixed, overwritable path, so the app always knows where
// to find it without a database.
//
// New media guides start with empty guideline/specs (same as the curated
// placeholder entries like 크리테오) — only name/sourceUrl/sourceFile are
// settable from the browser. Filling in the actual size/format/guideline
// content still requires sending Claude the PDF or page link so it can be
// read and turned into structured spec cards + AI prompt text (the same
// process used for today's 모비온/쿠키오븐/토스 additions).
//
// Protected by the same shared BRAND_GUIDE_EDIT_PASSWORD as brand-guide
// and brand-list editing (see api/mediaGuides.js's POST handler).

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const LIST_URL = `${BLOB_PUBLIC_BASE}/media-guide-list.json`;

async function readStore() {
  try {
    const resp = await fetch(LIST_URL, { cache: 'no-store' });
    if (!resp.ok) return { mediaGuides: [] };
    const data = await resp.json();
    return { mediaGuides: Array.isArray(data.mediaGuides) ? data.mediaGuides : [] };
  } catch (e) {
    return { mediaGuides: [] };
  }
}

async function writeStore(store) {
  const bytes = Buffer.from(JSON.stringify(store), 'utf-8');
  await put('media-guide-list.json', bytes, 'application/json', { allowOverwrite: true });
}

function makeMediaGuideId() {
  return 'custom-' + Math.random().toString(36).slice(2, 10);
}

export async function getDynamicMediaGuides() {
  const store = await readStore();
  return store.mediaGuides;
}

export async function addDynamicMediaGuide({ name, sourceUrl, sourceFile }) {
  const store = await readStore();
  const entry = {
    id: makeMediaGuideId(),
    name,
    note: '아직 가이드가 등록되지 않았습니다.',
    sourceUrl: sourceUrl || null,
    sourceFile: sourceFile || null,
    specs: [],
    guideline: '',
  };
  store.mediaGuides = [...store.mediaGuides, entry];
  await writeStore(store);
  return entry;
}
