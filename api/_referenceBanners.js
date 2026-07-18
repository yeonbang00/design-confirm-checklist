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
// Structure:
// ADVERTISERS = {
//   '<url-safe-id>': {
//     name: '<드롭다운에 표시할 이름>',
//     note: '<선택 메모>',
//     guideline: '<선택, 브랜드 텍스트 가이드>',
//     specs: [{ label: '<예: Primary 컬러>', value: '<예: #FA2993>' }] | [],
//     images: [
//       { mimeType: 'image/jpeg', thumbUrl: '<Blob URL>', fullUrl: '<Blob URL>' },
//       ...
//     ],
//   },
// }
// specs는 브랜드 가이드 페이지 상단에 눈에 띄는 카드로 보여주는 용도 —
// 컬러 코드, 로고 여백 px, 사용 비율처럼 숫자·코드로 딱 떨어지는 값만
// 뽑아서 채우고, 서술형 규칙은 guideline 텍스트 쪽에 그대로 둡니다.

export const ADVERTISERS = {
  'uplus': {
    name: '유플러스',
    note: '성과 좋았던 배너 5건 등록됨',
    specs: [
      { label: 'Primary 컬러', value: '#FA2993 (Bright Magenta)' },
      { label: 'Secondary 컬러', value: '#22171C' },
      { label: '컬러 사용 비율', value: '전체의 5~10% (포인트로만)' },
      { label: 'Radius', value: '8px / 20px / 34px / 50%' },
    ],
    guideline: `[유플러스 브랜드 가이드 — Online Content Design Guideline Dec.2025 Ver 1.0 기반]

항상 엄격하게 적용 (배너 유형과 무관):
- 브랜드 키컬러(Bright Magenta, 마젠타/핑크 계열)가 포인트로 존재하는가
- 마젠타를 배경 전체나 넓은 면적에 쓰지 않고 CTA·포인트 태그 등 1~2곳에만 강조로 썼는가 (전체의 5~10% 권장)
- 빨강=오류/경고, 초록·파랑=긍정/정보, 주황·노랑=주의라는 상태 컬러 의미가 반대로 쓰이지 않았는가
- 로고 비율을 왜곡하거나 다른 색으로 바꾸지 않았는가

배너 유형이 "브랜딩"일 때만 엄격하게 적용 (그 외 프로모션/커머스/이벤트/기타 유형에서는 위반해도 major나 reject로 낮추지 말고, note에 가벼운 참고 의견으로만 언급):
- 타이틀은 Favorit 느낌, 본문은 Pretendard 느낌의 타이포 계층이 명확한가
- 상단 메인 이미지가 하나의 명확한 톤으로 정리되어 산만하지 않은가 (복잡한 콜라주 지양, 목적 없는 과도한 장식 지양)
- Primary 버튼은 마젠타 계열 Solid(#FA2993), Secondary는 블랙 계열(#22171C)을 사용했는가 (버튼이 2개 이상이면 첫 번째만 마젠타)
- Radius는 8px(인풋)/20px(아이콘)/34px(배경)/50%(버튼·원형) 중 하나에 가까운가

이 가이드는 3번(타이포·정렬), 5번(컬러 일관성), 8번(그래픽 완성도), 9번(CTA 및 전환), 18번(로고 사용 규정) 항목을 판정할 때 반영하세요. 배너 유형(bannerType) 분류를 먼저 정한 뒤, 그 결과에 따라 위 두 그룹을 다르게 적용하세요.`,
    images: [
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-001-thumb-yUz1x6kiOuWiOBOwoWh6poLUgUlZ75.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-002-full-LP2bMrc74URSWUL4RDk6thmS0hzCea.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-003-thumb-lv0Zs8GJxWcVFxTfyVxYKUY6SeQv7P.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-004-full-GDLJ7LxatwXphQXydaXphDjG4kmJ0s.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-005-thumb-mHGmfz0fXwt5IgwrLEYmIqKfdWkL9a.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-006-full-TPMxbUgqw17byoT3IL7mBdZWzXy1j7.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-007-thumb-ncgLNwrncvMMM5QnUR0GNS2g9vU85R.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-008-full-pLEy6iP4WIIM26oQALm9F1RGD9F7yH.jpg" },
    { mimeType: 'image/jpeg', thumbUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-009-thumb-VkvqyQV5C4r3VuYbgEEg3fsBz6aJWZ.jpg", fullUrl: "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/brands/migrated-010-full-GC3XYVbtPll2A5i5AV8GmCny0FuoqC.jpg" },
    ],
  },
  'brand-b': {
    name: '브랜드 B',
    note: '아직 기준 배너가 등록되지 않았습니다.',
    guideline: '',
    specs: [],
    images: [],
  },
  'brand-c': {
    name: '브랜드 C',
    note: '아직 기준 배너가 등록되지 않았습니다.',
    guideline: '',
    specs: [],
    images: [],
  },
};
