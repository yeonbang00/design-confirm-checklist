// POST /api/uploadReferenceImage
// Body: { category, brandName, note?, type?, ownWork?, thumb: {base64, mimeType}, full: {base64, mimeType} }
// Returns: { ok: true, item: {...} } | { error: string }
//
// Lets a signed-in team member add a reference image themselves, instead of
// sending it to Claude to add via the local curation script. The site's
// login gate (middleware.js) already restricts every page/API to approved
// team members, so no extra password check is needed here — this is purely
// additive (never overwrites or deletes existing entries).
//
// The client resizes the image into a thumb (~700px) and full (~2000px)
// version before calling this (same two-size convention as the curated
// library), so this endpoint just uploads both to Blob Storage and appends
// one entry to the uploads manifest (_referenceUploadsStore.js).

import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';
import { put } from './_blobPut.js';
import { addUploadedReferenceImage } from './_referenceUploadsStore.js';
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

  const { category, brandName, note, type, ownWork, thumb, full } = req.body || {};

  if (!category || !REFERENCE_CATEGORIES[category]) {
    res.status(400).json({ error: '알 수 없는 업종 카테고리입니다.' });
    return;
  }
  if (!brandName || !brandName.trim()) {
    res.status(400).json({ error: '브랜드명을 입력해주세요.' });
    return;
  }

  let thumbBytes, fullBytes;
  try {
    thumbBytes = decodeImage(thumb, '썸네일');
    fullBytes = decodeImage(full, '원본');
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }

  const ext = full.mimeType.split('/')[1] || 'jpg';
  const slug = brandName.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '') || 'upload';
  const basePath = `reference/${category}/upload-${slug}`;

  try {
    const [thumbUrl, fullUrl] = await Promise.all([
      put(`${basePath}-thumb.${ext}`, thumbBytes, thumb.mimeType),
      put(`${basePath}-full.${ext}`, fullBytes, full.mimeType),
    ]);

    const item = {
      id: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      category,
      brandName: brandName.trim(),
      note: (note || '').trim() || undefined,
      mimeType: full.mimeType,
      thumbUrl,
      fullUrl,
      type: type || undefined,
      ownWork: ownWork ? true : undefined,
      uploadedAt: new Date().toISOString(),
    };

    await addUploadedReferenceImage(item);
    res.status(200).json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '업로드 중 알 수 없는 오류가 발생했습니다.' });
  }
}
