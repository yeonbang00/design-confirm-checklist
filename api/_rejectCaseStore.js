// "항목별 반려사례" — 체크리스트 분석에서 반려가 나온 배너를 리뷰어가 직접
// 골라 저장해두는 아카이브. 업종/유형별 이미지 레퍼런스(_referenceUploadsStore.js)
// 와는 다른 축(어떤 체크리스트 항목에서 반려됐는가)으로 분류되므로 별도 매니페스트를
// 쓴다. 저장은 항상 리뷰어가 "반려사례로 저장" 버튼을 눌렀을 때만 일어나는
// 큐레이션이고, 분석할 때마다 자동으로 쌓이지 않는다.
//
// 같은 이유로 저장 방식도 동일한 패턴: Vercel Blob에 고정 경로의 JSON
// 매니페스트 파일 하나로 관리한다(API 라우트가 자기 소스 파일을 런타임에
// 못 고치므로).

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const CASES_URL = `${BLOB_PUBLIC_BASE}/reject-cases.json`;

export async function getRejectCases() {
  try {
    const resp = await fetch(`${CASES_URL}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    return [];
  }
}

export async function addRejectCase(entry) {
  const items = await getRejectCases();
  items.push(entry);
  const bytes = Buffer.from(JSON.stringify({ items }), 'utf-8');
  await put('reject-cases.json', bytes, 'application/json', { allowOverwrite: true });
  return entry;
}

export async function removeRejectCase(id) {
  const items = await getRejectCases();
  if (!items.some((it) => it.id === id)) return false;
  const next = items.filter((it) => it.id !== id);
  const bytes = Buffer.from(JSON.stringify({ items: next }), 'utf-8');
  await put('reject-cases.json', bytes, 'application/json', { allowOverwrite: true });
  return true;
}
