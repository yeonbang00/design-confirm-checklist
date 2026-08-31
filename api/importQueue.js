// GET /api/importQueue
// Returns: { items: [{id, brandName, snapshotUrl, adDeliveryStartTime, fetchedAt}, ...] }
// 메타 광고 라이브러리에서 매일 자동 수집된, 아직 확인 안 한 광고 링크 목록.
// 이미지는 들어있지 않다 — snapshotUrl을 열어 직접 보고, 마음에 들면 화면을
// 캡처/저장해서 이미지 레퍼런스 업로드 기능으로 등록하면 된다.
//
// POST /api/importQueue
// Body: { id }
// 확인 완료 처리 — 대기 큐에서만 제거한다(같은 광고 id는 seenAdIds에 이미
// 기록돼 있어서 다음 크론에서 다시 올라오지 않음).

import { getPendingItems, removePendingItem, getLastRun } from './_importQueueStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

// 사이트 로그인만 되면 누구나 대기 큐(다른 광고주 미공개 크리에이티브 링크가
// 섞여 있음)를 열어볼 수 있던 걸 막기 위해, 관리자 비밀번호를 별도로 요구한다.
function checkAdminPassword(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: '서버에 ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
    return false;
  }
  if (req.headers['x-admin-password'] !== expected) {
    res.status(403).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!checkAdminPassword(req, res)) return;
    const items = await getPendingItems();
    // lastRun은 관리자 페이지의 "메타 수집 상태" 배너에서 쓴다
    const lastRun = await getLastRun();
    res.status(200).json({ items, lastRun });
    return;
  }

  if (req.method === 'POST') {
    if (rejectIfNotSameOrigin(req, res)) return;
    if (!checkAdminPassword(req, res)) return;

    const { id } = req.body || {};
    if (!id) {
      res.status(400).json({ error: '요청이 올바르지 않습니다.' });
      return;
    }

    await removePendingItem(id);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
