// Team-uploaded reference images — added through the "이미지 올리기" button on
// reference-board.html, as opposed to the curated library in
// _referenceLibrary.js (which Claude adds via a local script). Since this
// site's API routes can't edit their own source files at runtime, uploads
// are recorded as one JSON manifest file in Vercel Blob at a fixed,
// overwritable path — same pattern as _historyStore.js.
//
// referenceImages.js merges this list with the curated library's items for
// each category at request time, so both sources show up in one grid.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const UPLOADS_URL = `${BLOB_PUBLIC_BASE}/reference-uploads.json`;

export async function getUploadedReferenceImages() {
  try {
    const resp = await fetch(UPLOADS_URL, { cache: 'no-store' });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    return [];
  }
}

export async function addUploadedReferenceImage(entry) {
  const items = await getUploadedReferenceImages();
  items.push(entry);
  const bytes = Buffer.from(JSON.stringify({ items }), 'utf-8');
  await put('reference-uploads.json', bytes, 'application/json', { allowOverwrite: true });
  return entry;
}
