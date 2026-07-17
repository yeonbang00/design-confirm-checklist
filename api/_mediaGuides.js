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
  'meta-reels': {
    name: '메타(릴스)',
    note: '릴스(Reels) 이미지 소재 등록 기준 반영됨',
    guideline: `[메타 릴스(Reels) 이미지 광고 소재 기준]
※ 메타 공식 페이지(facebook.com/business/help) 직접 열람이 불가해, 해당 페이지를 인용하는 복수의 신뢰할 수 있는 소스를 교차 확인해 정리한 내용입니다. 세이프존 수치와 비율은 여러 소스에서 일치했지만, 정확한 최신 기준은 담당자가 메타 공식 페이지에서 한 번 더 확인하는 것을 권장합니다.

- 화면 비율: 9:16 세로 전체화면 (가로/정사각형 불가)
- 권장 최소 해상도: 1440 x 2560px
- 세이프존(반드시 텍스트·로고·CTA를 피해야 하는 영역): 상단 14%, 하단 35%, 좌우 각 6%
  · 상단: 프로필·사운드 아이콘이 겹침
  · 하단: CTA 버튼, 계정명, 설명 텍스트가 겹침 — 특히 하단 35%는 매우 넓으니 주의
  · 좌우: 기기별 크롭으로 잘릴 수 있음
- 이미지에는 텍스트를 가능한 한 최소화할 것을 권장 (릴스 피드 특성상 작게 보이므로, 꼭 필요한 경우가 아니면 카피는 이미지가 아닌 광고 카피 필드로)
- 이미지 안에 텍스트나 로고, CTA를 넣어야 한다면 반드시 세이프존(중앙 영역) 안에 배치

이 기준은 10번(매체 최적화) 항목을 판정할 때 최우선으로 반영하세요. 특히 로고나 핵심 카피가 상단 14%·하단 35%·좌우 6% 영역에 걸쳐 있으면 major 이상으로 판정하세요.`,
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
