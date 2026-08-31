// 판정 고도화용 분석 로그 — 분석이 끝날 때마다 "어떤 판정이 나왔는가"를
// 자동으로 쌓아두는 저장소. 프롬프트를 고칠 때 추측이 아니라 실제 분포를
// 근거로 삼기 위한 것이다(예: 특정 항목만 유독 반려율이 높다면 그 항목의
// 판정 기준이 과한지 검토).
//
// **익명 저장이 이 파일의 핵심 설계다.**
// 누가 올렸는지(계정·이메일·세션)는 의도적으로 저장하지 않는다. 고도화에
// 필요한 건 "어떤 배너에 어떤 판정이 나왔나"이지 "누가 올렸나"가 아니고,
// 식별자를 남기지 않으면 개인별 추적이 구조적으로 불가능해져서 팀원이
// 감시당한다고 느낄 이유 자체가 사라진다. 이 원칙은 나중에 기능을 확장할
// 때도 유지할 것 — 사용자 식별자를 여기에 추가하지 말 것.
//
// 이미지 자체도 저장하지 않는다(용량·저작권·유출 위험). 대신 판정 결과와
// 메타데이터만 남긴다.
//
// 저장 방식은 다른 매니페스트(_rejectCaseStore.js 등)와 동일한 패턴 —
// Vercel Blob에 고정 경로의 JSON 파일 하나.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const LOG_URL = `${BLOB_PUBLIC_BASE}/analysis-log.json`;

// 로그가 무한히 커지면 매번 전체를 읽고 쓰는 이 방식이 느려지므로 상한을 둔다.
// 오래된 것부터 버린다(고도화에는 최근 경향이 더 유용).
const MAX_ENTRIES = 2000;

export async function getAnalysisLog() {
  try {
    const resp = await fetch(LOG_URL, { cache: 'no-store' });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    return [];
  }
}

// entry에 사용자 식별 정보를 넣지 말 것 — 위 주석의 익명 원칙 참고.
export async function addAnalysisLog(entry) {
  const items = await getAnalysisLog();
  items.push(entry);
  const trimmed = items.length > MAX_ENTRIES ? items.slice(items.length - MAX_ENTRIES) : items;
  const bytes = Buffer.from(JSON.stringify({ items: trimmed }), 'utf-8');
  await put('analysis-log.json', bytes, 'application/json', { allowOverwrite: true });
  return entry;
}

// 테스트로 돌린 소재나 의미 없는 기록을 지운다 — 그대로 두면 판정 분포가
// 왜곡돼서 "어느 항목을 고쳐야 하나"를 잘못 읽게 된다.
//
// 매니페스트에서만 빼고 썸네일 Blob 파일 자체는 남는다(= 화면에서 사라지고
// 집계에서도 빠지지만, URL을 아는 사람은 파일에 접근 가능). 반려사례
// 삭제(_rejectCaseStore.js)도 지금 같은 방식이라 동작을 맞춘 것이다.
// 파일까지 지우려면 Blob delete API를 별도로 붙여야 한다.
export async function removeAnalysisLog(id) {
  const items = await getAnalysisLog();
  const target = items.find((it) => it.id === id);
  if (!target) return null;
  const next = items.filter((it) => it.id !== id);
  const bytes = Buffer.from(JSON.stringify({ items: next }), 'utf-8');
  await put('analysis-log.json', bytes, 'application/json', { allowOverwrite: true });
  return target;
}

// 리뷰어가 AI 판정을 직접 고친 내역을 해당 기록에 붙인다.
// 같은 항목을 여러 번 고치면 마지막 상태만 남긴다 — 중간 과정은 의미가 없고,
// from은 "AI가 원래 뭐라고 했는지"를 유지해야 하므로 첫 기록의 값을 지킨다.
export async function addVerdictFlip(logId, flip) {
  const items = await getAnalysisLog();
  const target = items.find((it) => it.id === logId);
  if (!target) return false;
  if (!Array.isArray(target.flips)) target.flips = [];
  const existing = target.flips.find((f) => f.itemId === flip.itemId);
  if (existing) {
    existing.to = flip.to;
    existing.at = flip.at;
  } else {
    target.flips.push(flip);
  }
  // AI 판정과 같은 값으로 되돌린 건 "뒤집음"이 아니므로 제거한다
  target.flips = target.flips.filter((f) => {
    const original = (target.verdicts || []).find((v) => v.id === f.itemId);
    return !original || original.status !== f.to;
  });
  const bytes = Buffer.from(JSON.stringify({ items }), 'utf-8');
  await put('analysis-log.json', bytes, 'application/json', { allowOverwrite: true });
  return true;
}

// 항목별 판정 분포를 집계한다 — 관리자 화면에서 "어떤 항목이 자주 걸리는가"를
// 한눈에 보기 위한 것. 저장된 원본을 그대로 훑어 계산하므로 별도 인덱스가 없다.
export function summarizeLog(items) {
  const byItem = {};
  const totals = { pass: 0, needsfix: 0, reject: 0, na: 0 };
  items.forEach((entry) => {
    (entry.verdicts || []).forEach((v) => {
      if (!byItem[v.id]) byItem[v.id] = { id: v.id, pass: 0, needsfix: 0, reject: 0, na: 0, flips: 0 };
      if (byItem[v.id][v.status] !== undefined) byItem[v.id][v.status]++;
      if (totals[v.status] !== undefined) totals[v.status]++;
    });
    // 사람이 AI 판정을 고친 횟수 — 이 수치가 높은 항목이 곧 기준을 손봐야 할 항목
    (entry.flips || []).forEach((f) => {
      if (!byItem[f.itemId]) byItem[f.itemId] = { id: f.itemId, pass: 0, needsfix: 0, reject: 0, na: 0, flips: 0 };
      byItem[f.itemId].flips++;
    });
  });
  const rows = Object.values(byItem).sort((a, b) => a.id - b.id);
  rows.forEach((r) => {
    const n = r.pass + r.needsfix + r.reject + r.na;
    r.total = n;
    // 해당 없음(na)은 분모에서 빼야 "실제로 판정된 것 중 몇 %가 걸렸나"가 나온다
    const judged = n - r.na;
    r.flagRate = judged > 0 ? Math.round(((r.needsfix + r.reject) / judged) * 100) : 0;
  });
  return { rows, totals, count: items.length };
}
