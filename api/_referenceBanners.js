// Reference "성과 좋았던" banners, grouped by "집중비교" category.
//
// HOW TO ADD REFERENCE IMAGES TO A CATEGORY:
// Send the images to Claude in chat and say which brand they belong to
// (e.g. "브랜드 A 기준 배너로 추가해줘"). Claude will run
// scripts/add_brand_image.py, which resizes the image, uploads it to
// Vercel Blob Storage, and inserts the entry here automatically.
//
// Categories with an empty `images` array still show up in the dropdown
// (so the team can see what's available), but won't produce a comparison
// until at least one image is added.
//
// Image bytes live in Vercel Blob Storage, not in this file — only the
// URLs are stored here. Each image has two versions:
// - thumbUrl: compressed thumbnail (700px, q74), used for the AI
//   comparison call and the 브랜드 가이드 gallery grid
// - fullUrl: higher quality version (2000px, q92), used in the lightbox
//   when someone clicks a thumbnail (only fetched then, not upfront)
//
// The brand's design guideline (컬러/VI/USP/퀄리티 체크리스트, 커스텀 필드,
// 피드백 로그) is NOT stored here anymore — it's live, team-editable state
// kept in Vercel Blob (see api/_brandGuideStore.js and
// api/_brandGuideChecklist.js), editable directly from guide.html.
//
// Brands can also be added live from guide.html's "+ 브랜드 추가" UI — those
// don't live here, they're stored in Blob (see api/_brandListStore.js) and
// layered on top of this curated list by getAllAdvertisers()/getAdvertiser()
// below, so every caller sees one merged list regardless of where a given
// brand's entry actually lives. Add a brand here only when you also have
// real reference images to attach (e.g. via scripts/add_brand_image.py) —
// otherwise just use the "+ 브랜드 추가" button on the page.
//
// Structure:
// ADVERTISERS = {
//   '<url-safe-id>': {
//     name: '<드롭다운에 표시할 이름>',
//     note: '<선택 메모>',
//     images: [
//       { mimeType: 'image/jpeg', thumbUrl: '<Blob URL>', fullUrl: '<Blob URL>' },
//       ...
//     ],
//   },
// }

import { getDynamicBrands, getHiddenCuratedIds } from './_brandListStore.js';

export const ADVERTISERS = {
  'uplus': {
    name: '유플러스',
    note: '',
    images: [
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-001-thumb-yUz1x6kiOuWiOBOwoWh6poLUgUlZ75.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-002-full-LP2bMrc74URSWUL4RDk6thmS0hzCea.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-003-thumb-lv0Zs8GJxWcVFxTfyVxYKUY6SeQv7P.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-004-full-GDLJ7LxatwXphQXydaXphDjG4kmJ0s.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-005-thumb-mHGmfz0fXwt5IgwrLEYmIqKfdWkL9a.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-006-full-TPMxbUgqw17byoT3IL7mBdZWzXy1j7.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-007-thumb-ncgLNwrncvMMM5QnUR0GNS2g9vU85R.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-008-full-pLEy6iP4WIIM26oQALm9F1RGD9F7yH.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-009-thumb-VkvqyQV5C4r3VuYbgEEg3fsBz6aJWZ.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-010-full-GC3XYVbtPll2A5i5AV8GmCny0FuoqC.jpg" },
    ],
  },
  'db-direct': {
    name: 'DB다이렉트',
    note: '아직 기준 배너가 등록되지 않았습니다.',
    images: [],
  },
  'shinsegae-shopping': {
    name: '신세계쇼핑',
    note: '아직 기준 배너가 등록되지 않았습니다.',
    images: [],
  },
};

// Merges the curated ADVERTISERS above with brands added live from the
// browser, minus any curated brands hidden via the "삭제" button, so every
// caller sees one list regardless of where a brand's entry actually lives.
export async function getAllAdvertisers() {
  const [dynamic, hidden] = await Promise.all([getDynamicBrands(), getHiddenCuratedIds()]);
  const merged = {};
  for (const [id, a] of Object.entries(ADVERTISERS)) {
    if (!hidden.includes(id)) merged[id] = a;
  }
  for (const b of dynamic) {
    merged[b.id] = { name: b.name, note: b.note, images: b.images || [], isCustom: true };
  }
  return merged;
}

export async function getAdvertiser(id) {
  if (!id) return null;
  if (ADVERTISERS[id]) {
    const hidden = await getHiddenCuratedIds();
    return hidden.includes(id) ? null : ADVERTISERS[id];
  }
  const dynamic = await getDynamicBrands();
  const found = dynamic.find(b => b.id === id);
  return found ? { name: found.name, note: found.note, images: found.images || [], isCustom: true } : null;
}
