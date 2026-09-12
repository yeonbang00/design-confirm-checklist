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
import { addUploadedReferenceImage, addUploadedReferenceImages } from './_referenceUploadsStore.js';
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

  /* 여러 장을 올릴 때는 올리는 것과 목록에 적는 것을 나눈다. 한 장마다 목록을
     고쳐 쓰면 뒤 저장이 앞 저장을 덮어 소재가 조용히 사라진다(33장 중 12장만
     남은 적이 있다). defer로 올리기만 하고, 마지막에 register로 한 번에 적는다. */
  if (Array.isArray(req.body?.register)) {
    /* 없는 업종으로 적히면 어느 탭에서도 안 보인다. 조용히 사라지는 것과 같다.
       업종을 보낼 거면 아는 값이어야 하고, 아니면 아예 보내지 말아야 한다. */
    const bad = req.body.register.find(
      (x) => x && x.category && !REFERENCE_CATEGORIES[x.category]
    );
    if (bad) {
      res.status(400).json({ error: `모르는 업종입니다: ${String(bad.category).slice(0, 24)}` });
      return;
    }
    try {
      const out = await addUploadedReferenceImages(req.body.register.slice(0, 300));
      res.status(200).json({ ok: true, ...out });
    } catch (err) {
      res.status(502).json({ error: err?.message || '레퍼런스 목록을 저장하지 못했습니다.' });
    }
    return;
  }

  const { category, brandName, note, type, ownWork, thumb, full, defer, hash,
    liveAt, libraryId, cta, landing, adUrl, ratio, w, h } = req.body || {};

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
      /* 64비트 지문. 다음에 같은 브랜드를 다시 담을 때 이미 있는 것을 가려낸다.
         같은 소재도 광고마다 CDN 파일명이 달라 파일명으로는 못 잡는다. */
      hash: (typeof hash === 'string' && /^[01]{64}$/.test(hash)) ? hash : undefined,
      /* 광고 라이브러리에서 담아 온 소재의 출처 정보. 게재일이 있어야
         최근 것만 골라 볼 수 있고, 원본 링크가 있어야 되짚을 수 있다. */
      liveAt: (typeof liveAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(liveAt)) ? liveAt : undefined,
      libraryId: (typeof libraryId === 'string' && /^\d{6,25}$/.test(libraryId)) ? libraryId : undefined,
      cta: cta ? String(cta).slice(0, 30) : undefined,
      landing: landing ? String(landing).slice(0, 60) : undefined,
      adUrl: (typeof adUrl === 'string' && /^https:\/\//.test(adUrl)) ? adUrl.slice(0, 400) : undefined,
      ratio: ['1:1', '4:5', '9:16', 'wide'].includes(ratio) ? ratio : undefined,
      w: Number.isFinite(Number(w)) && Number(w) > 0 ? Math.round(Number(w)) : undefined,
      h: Number.isFinite(Number(h)) && Number(h) > 0 ? Math.round(Number(h)) : undefined,
      ownWork: ownWork ? true : undefined,
      uploadedAt: new Date().toISOString(),
    };

    if (!defer) await addUploadedReferenceImage(item);
    res.status(200).json({ ok: true, item, deferred: !!defer });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : '업로드 중 알 수 없는 오류가 발생했습니다.' });
  }
}
