// Live "히스토리" entries shown on history.html — a running log of
// substantive updates to the app (checklist logic changes, brand/media
// guide additions, new features), NOT cosmetic polish (spacing, alignment,
// colors). Entries are added by Claude via scripts/add_history_entry.py
// whenever a qualifying change ships — there's no "add" UI on the site,
// only "삭제" (delete), so anyone with the shared edit password can prune
// an entry but not fabricate new ones through the browser.
//
// Stored as one JSON file in Vercel Blob at a fixed, overwritable path,
// same pattern as _brandListStore.js / _brandGuideStore.js.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const HISTORY_URL = `${BLOB_PUBLIC_BASE}/history.json`;

export async function getHistoryEntries() {
  try {
    const resp = await fetch(`${HISTORY_URL}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.entries) ? data.entries : [];
  } catch (e) {
    return [];
  }
}

export async function removeHistoryEntry(id) {
  const entries = await getHistoryEntries();
  if (!entries.some((e) => e.id === id)) return false;
  const next = entries.filter((e) => e.id !== id);
  const bytes = Buffer.from(JSON.stringify({ entries: next }), 'utf-8');
  await put('history.json', bytes, 'application/json', { allowOverwrite: true });
  return true;
}
