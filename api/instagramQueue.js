// GET /api/instagramQueue
// Returns: { items: [{id, brandName, suggestedCategory, note, mimeType,
//   thumbUrl, fullUrl, fetchedAt}, ...] }
// 인스타그램 DM으로 공유돼 자동 수집된, 아직 확인 안 한 이미지 목록.
// 메타 광고 라이브러리 자동수집(importQueue.js)과 달리 실제 이미지가 이미
// 들어있어서, 승인하면 바로 이미지 레퍼런스에 등록된다.
//
// POST /api/instagramQueue
// Body: { id, action: 'approve' | 'reject', category? }
// approve면 카테고리를 확정해 실제 이미지 레퍼런스(_referenceUploadsStore.js)에
// 등록하고 대기 큐에서 제거, reject면 대기 큐에서만 제거.

import { getPendingItems, removePendingItem } from './_instagramImportStore.js';
import { addUploadedReferenceImage } from './_referenceUploadsStore.js';
import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const items = await getPendingItems();
    res.status(200).json({ items });
    return;
  }

  if (req.method === 'POST') {
    if (rejectIfNotSameOrigin(req, res)) return;

    const { id, action, category, brandName } = req.body || {};
    if (!id || (action !== 'approve' && action !== 'reject')) {
      res.status(400).json({ error: '요청이 올바르지 않습니다.' });
      return;
    }

    const items = await getPendingItems();
    const item = items.find((it) => it.id === id);
    if (!item) {
      res.status(400).json({ error: '이미 처리된 항목이거나 존재하지 않습니다.' });
      return;
    }

    if (action === 'reject') {
      await removePendingItem(id);
      res.status(200).json({ ok: true });
      return;
    }

    // approve — 먼저 카테고리·브랜드명을 확정하고, 유효하지 않으면 큐에서
    // 아직 지우지 않은 채로 에러를 돌려준다(지운 뒤 실패하면 데이터가 사라짐).
    const finalCategory = (category && REFERENCE_CATEGORIES[category]) ? category : item.suggestedCategory;
    if (!finalCategory || !REFERENCE_CATEGORIES[finalCategory]) {
      res.status(400).json({ error: '업종 카테고리를 선택해주세요.' });
      return;
    }
    const finalBrandName = (brandName && brandName.trim()) || item.brandName;
    if (!finalBrandName || !finalBrandName.trim()) {
      res.status(400).json({ error: '브랜드명을 입력해주세요.' });
      return;
    }

    try {
      const refEntry = {
        id: item.id,
        category: finalCategory,
        brandName: finalBrandName.trim(),
        note: item.note || undefined,
        mimeType: item.mimeType,
        thumbUrl: item.thumbUrl,
        fullUrl: item.fullUrl,
        uploadedAt: new Date().toISOString(),
      };
      await addUploadedReferenceImage(refEntry);
      await removePendingItem(id);
      res.status(200).json({ ok: true, item: refEntry });
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : '승인 처리 중 알 수 없는 오류가 발생했습니다.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
