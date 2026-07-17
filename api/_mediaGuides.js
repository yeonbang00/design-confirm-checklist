// Media/ad-platform creative guidelines for the "매체 가이드" selector.
//
// This is separate from _referenceBanners.js (브랜드 집중비교): that file
// compares a banner against a brand's past high-performing creatives,
// while this file holds each AD PLATFORM's own submission spec (safe zone,
// text ratio limits, aspect ratio, prohibited content, etc.) so the AI can
// check the banner against the platform it's actually being submitted to.
//
// HOW TO ADD A GUIDELINE:
// Send Claude the platform's official creative spec (PDF, doc, or pasted
// text) and say which platform it's for (e.g. "이거 메타 소재 가이드야").
// Claude will fill in the `guideline` field below — same workflow as the
// brand guideline and reference banner updates.
//
// Structure:
// MEDIA_GUIDES = {
//   '<url-safe-id>': {
//     name: '<드롭다운에 표시할 이름>',
//     note: '<선택 메모>',
//     guideline: '<프롬프트에 그대로 들어갈 텍스트. 비어있으면 특별한 매체 규정 없이 일반 기준으로만 평가>',
//   },
// }

export const MEDIA_GUIDES = {
  'meta': {
    name: '메타',
    note: '아직 가이드가 등록되지 않았습니다.',
    guideline: '',
  },
  'buzzvil': {
    name: '버즈빌',
    note: '아직 가이드가 등록되지 않았습니다.',
    guideline: '',
  },
  'criteo': {
    name: '크리테오',
    note: '아직 가이드가 등록되지 않았습니다.',
    guideline: '',
  },
  'naver-brandsearch': {
    name: '네이버 브랜드검색',
    note: '아직 가이드가 등록되지 않았습니다.',
    guideline: '',
  },
};
