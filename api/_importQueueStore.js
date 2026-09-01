// 메타 광고 라이브러리에서 자동 수집한 "브랜드명 + 스냅샷 링크"가 대기하는
// 큐 — 이미지는 들어있지 않다(reference-board.html에서 사람이 링크를 열어
// 직접 확인하고, 마음에 들면 이미지 레퍼런스 업로드 기능으로 따로 등록).
//
// seenAdIds에는 큐에 올라왔던 광고 id를 전부 기록해서, 크론이 다음에 돌 때
// 같은 광고를 또 큐에 올리지 않게 한다.
//
// 기존 _referenceUploadsStore.js/_rejectCaseStore.js와 동일한 Blob JSON
// 매니페스트 패턴.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const QUEUE_URL = `${BLOB_PUBLIC_BASE}/import-queue.json`;

async function getState() {
  try {
    const resp = await fetch(`${QUEUE_URL}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return { pending: [], seenAdIds: [], cursor: 0 };
    const data = await resp.json();
    // lastRun까지 여기서 같이 복원해야 한다 — getState()가 아는 키만 추려서
    // 돌려주기 때문에, 빠뜨리면 다음 saveState() 때 통째로 지워진다.
    return {
      pending: Array.isArray(data.pending) ? data.pending : [],
      seenAdIds: Array.isArray(data.seenAdIds) ? data.seenAdIds : [],
      cursor: Number.isInteger(data.cursor) ? data.cursor : 0,
      lastRun: data.lastRun || null,
    };
  } catch (e) {
    return { pending: [], seenAdIds: [], cursor: 0, lastRun: null };
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

// 크론 1회 실행이 시간 제한 안에 브랜드 목록을 전부 못 도는 게 실측으로
// 확인돼서(광고 라이브러리 API가 느리거나 타임아웃되는 브랜드가 많음),
// 매번 0번부터 시작하면 뒤쪽 브랜드는 영원히 처리되지 못한다. 이번 실행이
// 어디까지 처리했는지 커서로 남겨서 다음 실행이 그 이어서 시작하게 한다.
export async function getBrandCursor() {
  const state = await getState();
  return state.cursor;
}

export async function saveBrandCursor(cursor) {
  const state = await getState();
  state.cursor = cursor;
  await saveState(state);
}

// 크론이 마지막으로 언제·어떻게 끝났는지 기록한다. 메타 토큰은 최대 60일짜리라
// 만료되면 수집이 조용히 멈추는데(에러가 어디에도 안 뜸), 실제로 그 상태로
// 며칠을 흘려보낸 적이 있어서 만든 장치다. 관리자 페이지에서 이 값을 읽어
// "마지막 수집: 성공/실패"를 보여준다.
export async function getLastRun() {
  const state = await getState();
  return state.lastRun || null;
}

export async function saveLastRun(lastRun) {
  const state = await getState();
  state.lastRun = lastRun;
  await saveState(state);
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

// 확인 완료 처리 — pending에서 제거만 한다(실제 레퍼런스 등록은 별도의
// 업로드 기능에서 처리하므로 여기서는 관여하지 않는다).
export async function removePendingItem(id) {
  const state = await getState();
  const item = state.pending.find((p) => p.id === id);
  state.pending = state.pending.filter((p) => p.id !== id);
  await saveState(state);
  return item || null;
}

// pageName 필드가 없는 항목(= media_type/page_name 필터를 추가하기 전에
// 쌓인 옛 항목, 영상·무관 계정이 섞여 노이즈가 많음)을 한꺼번에 정리할 때
// 쓰는 일회성 도구. cronImportAds.js에서 CRON_SECRET으로만 호출 가능.
export async function clearStaleQueueItems() {
  const state = await getState();
  const before = state.pending.length;
  state.pending = state.pending.filter((p) => !!p.pageName);
  await saveState(state);
  return { removed: before - state.pending.length, remaining: state.pending.length };
}

// 특정 검색어(brandName)로 쌓인 항목을 통째로 지울 때 쓰는 일회성 도구 —
// META_AD_BRANDS에서 검색어 자체를 제외하기로 한 브랜드(예: 검색 결과가
// 거의 다 무관한 계정으로 확인된 경우)의 기존 대기 항목을 정리할 때 사용.
export async function clearQueueItemsByBrand(brandNames) {
  const state = await getState();
  const before = state.pending.length;
  state.pending = state.pending.filter((p) => !brandNames.includes(p.brandName));
  await saveState(state);
  return { removed: before - state.pending.length, remaining: state.pending.length };
}
