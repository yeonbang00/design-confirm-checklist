// 메타 광고 라이브러리에서 자동 수집한 이미지가 대기하는 큐 — 사람이
// reference-board.html에서 승인해야 실제 이미지 레퍼런스에 반영된다
// (반려사례 아카이브와 같은 "자동 수집 + 수동 승인" 철학).
//
// seenAdIds에는 큐에 올라왔던(승인/거절 여부와 무관하게) 광고 id를 전부
// 기록해서, 크론이 다음에 돌 때 같은 광고를 또 큐에 올리지 않게 한다.
//
// 기존 _referenceUploadsStore.js/_rejectCaseStore.js와 동일한 Blob JSON
// 매니페스트 패턴.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const QUEUE_URL = `${BLOB_PUBLIC_BASE}/import-queue.json`;

async function getState() {
  try {
    const resp = await fetch(QUEUE_URL, { cache: 'no-store' });
    if (!resp.ok) return { pending: [], seenAdIds: [] };
    const data = await resp.json();
    return {
      pending: Array.isArray(data.pending) ? data.pending : [],
      seenAdIds: Array.isArray(data.seenAdIds) ? data.seenAdIds : [],
    };
  } catch (e) {
    return { pending: [], seenAdIds: [] };
  }
}

async function saveState(state) {
  const bytes = Buffer.from(JSON.stringify(state), 'utf-8');
  await put('import-queue.json', bytes, 'application/json', { allowOverwrite: true });
}

export async function getPendingItems() {
  const state = await getState();
  return state.pending;
}

export async function getSeenAdIds() {
  const state = await getState();
  return new Set(state.seenAdIds);
}

// items: [{ adId, entry }] — entry는 큐에 올릴 대기 항목, adId는 dedup용 원본 광고 id.
// skippedAdIds: 이미지가 아니라서(영상 등) 건너뛴 광고 id들 — 이것도 seen 처리해서
// 다음 크론에서 또 확인하지 않게 한다.
export async function addPendingItems(items, skippedAdIds) {
  const state = await getState();
  items.forEach(({ adId, entry }) => {
    state.pending.push(entry);
    state.seenAdIds.push(adId);
  });
  (skippedAdIds || []).forEach((adId) => state.seenAdIds.push(adId));
  await saveState(state);
  return state.pending;
}

// action: 'approve' | 'reject' — 둘 다 pending에서 제거만 하고, 실제 레퍼런스
// 등록(승인 시)은 호출부(importQueue.js)에서 처리한다.
export async function removePendingItem(id) {
  const state = await getState();
  const item = state.pending.find((p) => p.id === id);
  state.pending = state.pending.filter((p) => p.id !== id);
  await saveState(state);
  return item || null;
}
