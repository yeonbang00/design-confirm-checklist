// 인스타그램 DM으로 공유받은 게시물/광고가 대기하는 큐 — 메타 광고 라이브러리
// 자동수집(_importQueueStore.js)과는 데이터 모양이 달라서 별도 파일로 뒀다.
// 그쪽은 "링크만" 쌓지만, 여기는 실제 이미지(thumbUrl/fullUrl)와 AI가
// 추측한 업종·브랜드명까지 같이 들어있다 — DM 첨부파일 URL 자체가 진짜
// 이미지 파일 주소라서 서버가 바로 받아올 수 있기 때문(스냅샷 페이지처럼
// 자바스크립트 렌더링이 필요 없음).
//
// 기존 Blob JSON 매니페스트 패턴과 동일.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const QUEUE_URL = `${BLOB_PUBLIC_BASE}/instagram-import-queue.json`;

async function getState() {
  try {
    const resp = await fetch(QUEUE_URL, { cache: 'no-store' });
    if (!resp.ok) return { pending: [] };
    const data = await resp.json();
    return { pending: Array.isArray(data.pending) ? data.pending : [] };
  } catch (e) {
    return { pending: [] };
  }
}

async function saveState(state) {
  const bytes = Buffer.from(JSON.stringify(state), 'utf-8');
  await put('instagram-import-queue.json', bytes, 'application/json', { allowOverwrite: true });
}

export async function getPendingItems() {
  const state = await getState();
  return state.pending;
}

export async function addPendingItem(entry) {
  const state = await getState();
  state.pending.push(entry);
  await saveState(state);
  return entry;
}

export async function removePendingItem(id) {
  const state = await getState();
  const item = state.pending.find((p) => p.id === id);
  state.pending = state.pending.filter((p) => p.id !== id);
  await saveState(state);
  return item || null;
}
