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
    id: 'color_full_background',
    section: 'color',
    label: '브랜드 컬러를 배경에도 활용 (포인트 사용 제한 없음)',
    promptText: '이 브랜드는 브랜드 컬러를 배경 전체나 넓은 면적에 적극적으로 사용하는 것을 허용한다. 포인트로만 제한하지 말고 배경 전체 활용도 정상적인 브랜드 표현으로 판단해야 한다.',
  },
  {
    id: 'color_competitor_distinction',
    section: 'color',
    label: '경쟁사 브랜드 컬러와 혼동되지 않도록 사용',
    promptText: '이 배너의 색상이 경쟁사 브랜드 컬러와 혼동될 정도로 비슷하지 않아야 한다. 이 가이드에 경쟁사 컬러 정보가 구체적으로 명시되어 있다면 그 기준으로 확인하고, 명시되어 있지 않다면 이미 널리 알려진 동종 업계 주요 경쟁사의 상징색과 명백히 겹치는 경우에만 지적하며 추측성 판단은 하지 않는다.',
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
    id: 'logo_min_size',
    section: 'vi',
    label: '로고가 알아보기 어려울 만큼 작게 축소되지 않음',
    promptText: '로고가 배너 크기 대비 지나치게 작게 축소되어 알아보기 어려운 상태가 아니어야 한다.',
  },
  {
    id: 'logo_consistent_position',
    section: 'vi',
    label: '로고 위치가 배너마다 일관됨',
    promptText: '로고는 배너마다 일관된 위치에 배치되어야 한다.',
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
  {
    id: 'pixel_alignment',
    section: 'quality',
    label: '픽셀 정렬이 정확하고 여백이 고르게 정리됨',
    promptText: '픽셀 정렬이 정확하고 여백이 고르게 정리되어 있어야 한다.',
  },
  {
    id: 'resolution_sharp',
    section: 'quality',
    label: '저해상도로 깨지거나 흐릿하지 않음',
    promptText: '이미지가 저해상도로 깨지거나 흐릿하지 않고 선명해야 한다.',
  },
  {
    id: 'consistent_radius',
    section: 'quality',
    label: '버튼·카드·아이콘 모서리 radius가 일관됨',
    promptText: '버튼·카드·아이콘 등의 모서리 radius가 일관된 값으로 통일되어 있어야 한다.',
  },
  {
    id: 'asset_fit_purpose',
    section: 'asset',
    label: '사용된 이미지가 배너 목적·메시지와 어울리는 소재로 선택됨',
    promptText: '사용된 이미지·소재가 배너의 목적과 메시지에 어울리는 것으로 선택되어야 한다.',
  },
  {
    id: 'asset_crop_placement',
    section: 'asset',
    label: '이미지 크롭·배치가 어색하지 않고 얼굴·제품·텍스트 공간이 답답하게 잘리거나 눌리지 않음',
    promptText: '이미지 크롭과 배치가 어색하지 않아야 하며, 얼굴·제품·텍스트가 들어갈 공간이 답답하게 잘리거나 눌려서는 안 된다.',
  },
  {
    id: 'asset_collage_cohesion',
    section: 'asset',
    label: '여러 이미지를 합성·콜라주했다면 톤·해상도·스타일이 이질감 없이 어울림',
    promptText: '여러 이미지를 합성하거나 콜라주했다면 각 이미지의 톤·해상도·스타일이 이질감 없이 어울려야 한다.',
  },
  {
    id: 'asset_overlay_readability',
    section: 'asset',
    label: '텍스트·그래픽 오버레이가 이미지를 가리거나 가독성을 해치지 않고 자연스럽게 얹힘',
    promptText: '텍스트·그래픽 오버레이가 이미지의 중요한 부분을 가리거나 가독성을 해치지 않고 자연스럽게 얹혀 있어야 한다.',
  },
  {
    id: 'asset_correction_natural',
    section: 'asset',
    label: '배너 안에서 적용한 색보정·필터·그라데이션 오버레이가 과해서 부자연스럽지 않음',
    promptText: '배너 제작 시 적용한 색보정·필터·그라데이션 오버레이가 과도해서 부자연스러워 보이지 않아야 한다.',
  },
  {
    id: 'mood_recognizable',
    section: 'mood',
    label: '브랜드명을 가려도 우리 브랜드 소재라고 알아볼 수 있는 톤이 유지됨',
    promptText: '브랜드명이나 로고를 가리고 봐도 이 브랜드의 소재라고 알아볼 수 있을 만큼 일관된 톤이 유지되어야 한다.',
  },
  {
    id: 'mood_graphic_style',
    section: 'mood',
    label: '아이콘·배지·버튼 모양·그라데이션 등 그래픽 스타일이 브랜드가 평소 쓰는 룩앤필과 일치함',
    promptText: '아이콘·배지·버튼 모양·그라데이션 등 배너에 쓰인 그래픽 스타일이 브랜드가 평소 사용하는 룩앤필과 일치해야 한다.',
  },
  {
    id: 'mood_copy_image_match',
    section: 'mood',
    label: '카피 톤과 이미지 무드가 서로 어긋나지 않음 (예: 차분한 이미지에 과도하게 들뜬 카피가 붙는 경우 등)',
    promptText: '카피의 어조와 이미지의 무드가 서로 어긋나지 않아야 한다 (예: 차분하고 고급스러운 이미지에 과도하게 들뜬 카피가 붙는 경우는 지적한다).',
  },
  {
    id: 'mood_seasonal_identity',
    section: 'mood',
    label: '시즌·이벤트 그래픽을 넣어도 브랜드 정체성이 묻히지 않음',
    promptText: '시즌·이벤트성 그래픽 요소를 추가하더라도 브랜드 고유의 정체성이 묻히지 않아야 한다.',
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
