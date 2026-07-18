// Competitor reference images, grouped by industry category, for the
// "경쟁사 레퍼런스" board. Team members find ads on Google Ads Transparency
// Center / Meta Ad Library themselves, then send the screenshots to Claude
// to add here — this is a curated library, not a live search of those
// external sites (neither has an accessible API we can call from this app).
//
// HOW TO ADD A REFERENCE IMAGE:
// Send Claude the image and say which category and brand it's for, or name
// files like {카테고리}_{브랜드코드}_{번호}.jpg (e.g. 금융_DB_01.jpg) and send
// several at once — Claude will run scripts/add_reference_image.py, which
// resizes the image, uploads it to Vercel Blob Storage, and inserts the
// entry here automatically.
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
//       { brandName: '<브랜드명>', note: '<한 줄 메모>', mimeType: 'image/jpeg', thumbUrl: '<Blob URL>', fullUrl: '<Blob URL>' },
//       ...
//     ],
//   },
// }

export const REFERENCE_CATEGORIES = {
  'fashion': { name: "패션", items: [] },
  'finance': {
    name: "금융",
    items: [
      {
        brandName: "하나카드",
        note: "경품 여러 개를 태그 형태로 정리한 레이아웃 참고할만함",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-001-thumb-QBOE2IPQtgJYQctKNaj8fJCRLlKXhh.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-002-full-Z7spkJygsle4YCFRMfvi2eHzFZNuLs.jpg",
      },
      {
        brandName: "SK증권",
        note: "실물 굿즈(키링) 활용한 이벤트 비주얼과 유머러스한 카피 톤",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-003-thumb-jEqbTt2oBierkvS2JIaCa8P2XLOTUs.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-004-full-PWlzTxWBXVVwyD3bwqvz7AUsIAUvsW.jpg",
      },
      {
        brandName: "DB손해보험",
        note: "AI 생성 이미지 활용 사례, 유머러스한 상황극 카피 톤 참고",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-005-thumb-HIHhcGbbh4IggBqdp8w9mHSRngGBJd.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-006-full-hUSIjCAZ9Qtg4bPkMkYDVnBzu9P3ig.jpg",
      },
      {
        brandName: "KB국민카드",
        note: "캐릭터(마스코트) 활용해 혜택을 스토리텔링으로 전달하는 방식 참고",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-007-thumb-GoTwS1wruNN595pW0gqvq6JPV4lFWU.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-008-full-hy2lIo6zU2NGvWGXXsaAIIWgc59MYo.jpg",
      },
    ],
  },
  'shopping': {
    name: "쇼핑/커머스",
    items: [
      {
        brandName: "스파클웨이브",
        note: "심플한 좌우 분할 레이아웃, 1+1 배지 강조 방식 참고",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-009-thumb-099jYNYcCwPIP0124FOuEHRdutY5XW.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-010-full-FMcu8Jwv5BFKW01LIper9cezoPs78C.jpg",
      },
    ],
  },
  'beauty': { name: "화장품/뷰티", items: [] },
  'telecom': { name: "통신", items: [] },
  'food': { name: "식품/외식", items: [] },
  'travel': {
    name: "여행",
    items: [
      {
        brandName: "인스파이어",
        note: "여행 이미지 위 텍스트 오버레이, 할인율 강조 배지 위치 참고",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-011-thumb-2ifnGZMJizk9FxofTxHfr5dfWu2Ehe.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-012-full-AP3KNyihuDb935nDxOVRU4Umbje0hC.jpg",
      },
    ],
  },
  'electronics': { name: "가전/IT", items: [] },
  'automotive': { name: "자동차", items: [] },
  'education': { name: "교육", items: [] },
  'healthcare': {
    name: "헬스케어/제약",
    items: [
      {
        brandName: "베러(BETTER) · 동화약품",
        note: "고객 후기 인용구 + 페이백 배지 + 취소선 가격 강조 레이아웃 참고할만함",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-013-thumb-RszvnXG7hpyCauNMUy0XklxJoBoEAo.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-014-full-kEelLX1FbSnUJ5THHM2oesuCQF3WtV.jpg",
      },
      {
        brandName: "MgLAB · 동화약품",
        note: "드라마틱한 배경과 슈퍼히어로 컨셉으로 브랜드 임팩트를 준 비주얼",
        mimeType: "image/jpeg",
        thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-015-thumb-84tbB7nxD8wXvUEVo0kQWrxv1lDPez.jpg",
        fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/migrated-016-full-sLm1T3fuMH2FcY1VvQUuCbtq2H8YWA.jpg",
      },
    ],
  },
  'realestate': { name: "부동산", items: [] },
  'gaming': { name: "게임/엔터", items: [] },
};
