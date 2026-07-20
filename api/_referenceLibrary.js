// Reference images (competitor ads + NHN's own produced materials),
// grouped by industry category, for the "이미지 레퍼런스" board. Team members
// find competitor ads on Google Ads Transparency Center / Meta Ad Library
// themselves, then send the screenshots to Claude to add here — this is a
// curated library, not a live search of those external sites (neither has
// an accessible API we can call from this app).
//
// HOW TO ADD A REFERENCE IMAGE:
// Send Claude the image and say which category and brand it's for, or name
// files like {카테고리}_{브랜드코드}_{번호}.jpg (e.g. 금융_DB_01.jpg) and send
// several at once — Claude will run scripts/bulk_add_reference_images.py,
// which resizes the image, uploads it to Vercel Blob Storage, and inserts
// the entry here automatically.
//
// If the image is a material NHN itself produced (not a competitor ad),
// add "NHN" as an extra underscore segment anywhere after the brand, e.g.
// 금융_하나카드_NHN_02.jpg — the import script marks it `ownWork: true`,
// which shows a small "NHN" badge on the card in the UI so team-made work
// is visually distinguishable from competitor references at a glance.
//
// Image bytes live in Vercel Blob Storage, not in this file — only the
// URLs are stored here, which is why this file stays small even as the
// library grows to hundreds of images. Each item has two versions:
// - thumbUrl: compressed thumbnail (700px, q74), used for the grid
// - fullUrl: higher quality version (2000px, q92), used in the lightbox
//   when someone clicks a thumbnail (only fetched then, not upfront)
//
// Structure:
// REFERENCE_CATEGORIES = {
//   '<url-safe-id>': {
//     name: '<드롭다운에 표시할 이름>',
//     items: [
//       { brandName: '<브랜드명>', note: '<한 줄 메모>', mimeType: 'image/jpeg', thumbUrl: '<Blob URL>', fullUrl: '<Blob URL>', ownWork: true | undefined },
//       ...
//     ],
//   },
// }
// ownWork는 NHN이 직접 제작한 소재일 때만 true로 채우고, 일반 경쟁사
// 레퍼런스는 그냥 생략하면 됩니다(생략 시 배지 없음).

export const REFERENCE_CATEGORIES = {
  'fashion': { name: "패션", items: [] },
  'finance': { name: "금융", items: [] },
  'shopping': { name: "쇼핑/커머스", items: [] },
  'beauty': { name: "화장품/뷰티", items: [] },
  'telecom': { name: "통신", items: [] },
  'food': { name: "식품/외식", items: [] },
  'travel': { name: "여행", items: [] },
  'electronics': { name: "가전/IT", items: [] },
  'automotive': { name: "자동차", items: [] },
  'education': { name: "교육", items: [] },
  'healthcare': { name: "헬스케어/제약", items: [] },
  'realestate': { name: "부동산", items: [] },
  'gaming': { name: "게임/엔터", items: [] },
};
