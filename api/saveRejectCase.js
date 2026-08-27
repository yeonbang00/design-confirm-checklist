// POST /api/saveRejectCase
// Body: { itemIds: number[], reasons?: {itemId: string}, brandName?: string,
//         thumb: {base64, mimeType}, full: {base64, mimeType} }
// Returns: { ok: true, item: {...} } | { error: string }
//
// Called from index.html's "반려사례로 저장" button, which only appears after
// an analysis result contains at least one reject-status item. The reviewer
// picks which of the reject items are worth archiving (not every reject is
// instructive — a stray typo isn't, a real hierarchy/alignment failure is),
// so this never fires automatically on every analysis.
//
// Same login-gate reasoning as uploadReferenceImage.js: middleware.js already
// restricts the whole site to approved team members, so no extra password
// check here — this is purely additive.

import { put } from './_blobPut.js';
import { addRejectCase } from './_rejectCaseStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

function decodeImage(field, label) {
  if (!field || !field.base64 || !field.mimeType) {
    throw new Error(`${label} 이미지가 없습니다.`);
  }
  if (!field.mimeType.startsWith('image/')) {
    throw new Error(`${label} 이미지 형식이 올바르지 않습니다.`);
  }
  return Buffer.from(field.base64, 'base64');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const { itemIds, reasons, brandName, thumb, full } = req.body || {};

  const cleanItemIds = Array.isArray(itemIds)
    ? [...new Set(itemIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 17))]
    : [];
  if (!cleanItemIds.length) {
    res.status(400).json({ error: '저장할 반려 항목을 하나 이상 선택해주세요.' });
    return;
  }

  const cleanReasons = {};
  if (reasons && typeof reasons === 'object') {
    cleanItemIds.forEach((id) => {
      const text = reasons[id] ?? reasons[String(id)];
      if (typeof text === 'string' && text.trim()) cleanReasons[id] = text.trim();
    });
  }

  let thumbBytes, fullBytes;
  try {
    thumbBytes = decodeImage(thumb, '썸네일');
    fullBytes = decodeImage(full, '원본');
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }

  const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  const ext = full.mimeType.split('/')[1] || 'jpg';
  const basePath = `reference/reject-cases/case-${id}`;

  try {
    const [thumbUrl, fullUrl] = await Promise.all([
      put(`${basePath}-thumb.${ext}`, thumbBytes, thumb.mimeType),
      put(`${basePath}-full.${ext}`, fullBytes, full.mimeType),
    ]);

    const item = {
      id,
      itemIds: cleanItemIds,
      reasons: cleanReasons,
      brandName: (brandName || '').trim() || undefined,
      mimeType: full.mimeType,
      thumbUrl,
      fullUrl,
      uploadedAt: new Date().toISOString(),
    };

    await addRejectCase(item);
    res.status(200).json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '저장 중 알 수 없는 오류가 발생했습니다.' });
  }
}
