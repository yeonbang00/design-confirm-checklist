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

/* 여러 장을 한 번에 합친다. 한 장씩 따로 쓰면 안 된다 — 매니페스트를 읽고
   고쳐 쓰는 구조라, 방금 쓴 내용이 반영되기 전에 다음 요청이 읽으면 그 사이
   것이 통째로 사라진다. 광고 담기로 33장을 올렸는데 12장만 남은 적이 있다.
   이미지는 Blob에 멀쩡히 있었고 매니페스트에서만 빠졌다.
   축 매니페스트에서 같은 사고를 겪고도 이쪽을 안 고쳤던 자리다. */
export async function addUploadedReferenceImages(entries) {
  const list = Array.isArray(entries) ? entries : [entries];
  if (!list.length) return { added: 0, total: 0 };
  const items = await getUploadedReferenceImages();
  const seen = new Set(items.map((x) => x && x.thumbUrl).filter(Boolean));
  let added = 0;
  for (const e of list) {
    if (!e || !e.thumbUrl || seen.has(e.thumbUrl)) continue;
    seen.add(e.thumbUrl);
    items.push(e);
    added += 1;
  }
  const bytes = Buffer.from(JSON.stringify({ items }), 'utf-8');
  await put('reference-uploads.json', bytes, 'application/json', { allowOverwrite: true });
  return { added, total: items.length };
}

// 한 장짜리 기존 호출부(이미지 올리기 모달)를 위해 남겨 둔다.
export async function addUploadedReferenceImage(entry) {
  await addUploadedReferenceImages([entry]);
  return entry;
}
