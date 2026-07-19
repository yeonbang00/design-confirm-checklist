// Fixed catalog of brand-guideline checklist items shown on the 브랜드
// 가이드 page. A team member checks the ones that apply to a brand (plus
// free-text custom fields for things like exact color codes, and a running
// feedback log) — see api/_brandGuideStore.js for how this turns into the
// live, editable brand guide state, and composeGuideline() below for how
// it turns into the text actually injected into the AI prompt.
//
// promptText is only ever sent to the server/AI, never to the browser (see
// api/brandGuideChecklistOptions.js) — the UI only needs id/label/section.
//
// To add a new checklist item: just add an entry here. No other file needs
// to change.
export const CHECKLIST_ITEMS = [
  {
    id: 'color_point_only',
    section: 'color',
    label: '브랜드 컬러는 배경 전체가 아니라 포인트로만 사용 (전체의 5~10% 이내)',
    promptText: '브랜드 컬러는 배경 전체나 넓은 면적이 아니라 CTA·포인트 태그 등 1~2곳에만 강조로 사용해야 하며, 전체 면적의 5~10% 이내를 권장한다.',
  },
  {
    id: 'color_status_meaning',
    section: 'color',
    label: '상태 컬러 의미(빨강=경고 등)를 반대로 쓰지 않음',
    promptText: '빨강은 오류/경고, 초록·파랑은 긍정/정보, 주황·노랑은 주의를 나타내는 상태 컬러 의미가 반대로 쓰이지 않아야 한다.',
  },
  {
    id: 'logo_min_margin',
    section: 'vi',
    label: '로고 최소 여백 확보, 변형·왜곡·색상 변경 금지',
    promptText: '로고는 최소 여백을 확보하고 비율을 왜곡하거나 색상을 변경하지 않고 원본 그대로 사용해야 한다.',
  },
  {
    id: 'logo_bg_contrast',
    section: 'vi',
    label: '로고가 묻히지 않도록 배경과 충분한 대비 확보',
    promptText: '로고가 배경 색상이나 이미지에 묻히지 않도록 충분한 대비를 확보해야 한다.',
  },
  {
    id: 'typo_hierarchy',
    section: 'vi',
    label: '타이틀/본문 타이포 계층이 명확, 폰트 2~3종 이내',
    promptText: '타이틀과 본문의 타이포 계층이 명확해야 하며, 폰트는 2~3종 이내로 통일해야 한다.',
  },
  {
    id: 'branding_no_cta_penalty',
    section: 'usp',
    label: '브랜딩 유형은 CTA 없어도 반려하지 않음 (톤·메시지 전달력 위주로 평가)',
    promptText: '배너 유형이 브랜딩으로 판단되면, CTA나 구매 유도 문구가 없다는 이유만으로 반려하지 않고 브랜드 메시지 전달력과 톤 일관성을 기준으로 평가한다.',
  },
  {
    id: 'promo_cta_strict',
    section: 'usp',
    label: '프로모션/커머스/이벤트 유형은 CTA·혜택 명확성을 엄격히 평가',
    promptText: '배너 유형이 프로모션, 커머스, 이벤트로 판단되면 CTA 문구와 혜택 명확성을 엄격하게 평가한다.',
  },
  {
    id: 'avoid_collage',
    section: 'quality',
    label: '복잡한 콜라주·과도한 장식 지양, 하나의 명확한 톤으로 정리',
    promptText: '복잡한 콜라주나 목적 없는 과도한 장식을 지양하고, 메인 이미지는 하나의 명확한 톤으로 정리되어야 한다.',
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Turns the saved checklist/customFields/feedbackLog state into the plain
// text that gets injected into the AI prompt (same role _referenceBanners.js
// `guideline` used to play).
export function composeGuideline(state) {
  const checklist = (state && state.checklist) || {};
  const customFields = (state && state.customFields) || [];
  const feedbackLog = (state && state.feedbackLog) || [];

  const parts = [];

  const checkedItems = CHECKLIST_ITEMS.filter((item) => checklist[item.id]);
  if (checkedItems.length) {
    parts.push('브랜드 가이드 기준:\n' + checkedItems.map((item) => '- ' + item.promptText).join('\n'));
  }

  const fieldLines = customFields.filter((f) => f && f.label && f.value).map((f) => `- ${f.label}: ${f.value}`);
  if (fieldLines.length) {
    parts.push('추가 세부 기준:\n' + fieldLines.join('\n'));
  }

  const recentFeedback = feedbackLog.slice(-5);
  if (recentFeedback.length) {
    const fbLines = recentFeedback.map((f) => `- (${f.date || todayIso()}) ${f.text}`);
    parts.push('광고주 피드백 이력 (참고용 — 반복되는 지적이 있다면 특히 주의해서 반영):\n' + fbLines.join('\n'));
  }

  return parts.join('\n\n');
}
