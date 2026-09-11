// GET /api/referenceImages?category=<categoryId>
// Returns the reference images (with brand name + caption + Blob URLs)
// for ONE category, on demand. Kept separate from referenceCategories.js
// so that list stays light — this is only called when someone actually
// selects a category on the 이미지 레퍼런스 page. Images live in Vercel
// Blob Storage (see _referenceLibrary.js) so both thumbUrl and fullUrl
// are returned directly — no separate "full image" endpoint needed since
// URLs are cheap; the browser only fetches the actual bytes when an
// <img> src is set to one of these URLs.
//
// Merges in team-uploaded images (_referenceUploadsStore.js) alongside the
// curated library so both sources show up in one grid, newest-first within
// each category (curated items keep their original order first, since
// there's no timestamp on them).

import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';
import { getUploadedReferenceImages } from './_referenceUploadsStore.js';
import { getReferenceAxes, axesKey } from './_referenceAxesStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { category } = req.query || {};
  const [uploaded, axes] = await Promise.all([
    getUploadedReferenceImages(),
    getReferenceAxes(),
  ]);
  /* 큐레이션된 978장은 소스 파일에 박혀 있어 런타임에 못 고친다.
     축 태그만 Blob 매니페스트에 따로 두고 여기서 붙여 내려보낸다. */
  /* 한글은 같은 글자를 두 가지로 적을 수 있다. macOS에서 모은 파일이라
     브랜드명 977개 중 398개가 자모 분리형(NFD)이었다. '제로이드'(완성형)와
     '제로이드'(분리형)는 눈에는 같지만 문자열로는 다르다.
     그래서 브랜드 칩이 21개나 둘로 쪼개져 있었고, 한쪽을 누르면 그 브랜드
     소재의 절반만 보였다. 검색과 닮은 컷의 같은 브랜드 제외도 같은 이유로
     헛돌았다. 내보내는 자리에서 한 번 완성형으로 맞춘다. */
  const nfc = (v) => (typeof v === 'string' ? v.normalize('NFC') : v);
  const withAxes = (list) => list.map((it) => {
    const t = axes[axesKey(it.thumbUrl)];
    return {
      ...it,
      brandName: nfc(it.brandName),
      note: nfc(it.note),
      ...(t?.axes ? { axes: t.axes } : {}),
    };
  });

  if (!category || category === 'all') {
    const items = Object.values(REFERENCE_CATEGORIES).flatMap((cat) => cat.items || []);
    res.status(200).json({ items: withAxes([...items, ...uploaded]) });
    return;
  }

  const cat = REFERENCE_CATEGORIES[category];
  if (!cat) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }

  const uploadedForCategory = uploaded.filter((u) => u.category === category);
  res.status(200).json({ items: withAxes([...(cat.items || []), ...uploadedForCategory]) });
}
