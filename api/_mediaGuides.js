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
// Claude will fill in the `guideline` field below, and if a PDF was sent,
// upload it to Vercel Blob Storage (via scripts/blob_lib.py, same as
// reference images — see api/_referenceLibrary.js) and set `sourceFile`
// to its URL.
//
// Structure:
// MEDIA_GUIDES = {
//   '<url-safe-id>': {
//     name: '<드롭다운에 표시할 이름>',
//     note: '<선택 메모>',
//     guideline: '<프롬프트에 그대로 들어갈 텍스트. 비어있으면 특별한 매체 규정 없이 일반 기준으로만 평가>',
//     sourceUrl: '<공식 가이드 페이지 URL>' | null,
//     sourceFile: { fileName: '<파일명.pdf>', mimeType: 'application/pdf', fileUrl: '<Blob URL>' } | null,
//     specs: [{ label: '<소재 슬롯 이름, 예: 잠금화면 이미지>', size: '<가로 x 세로px>', format: '<JPG, PNG 등>' | null, maxSize: '<용량 제한, 예: 2MB>' | null }] | [],
//   },
// }
// sourceUrl과 sourceFile은 둘 다 선택사항이며, 있는 것만 채우면 됩니다
// (둘 다 있어도 되고, 하나만 있어도 되고, 둘 다 없어도 됩니다).
// specs는 매체 가이드 페이지 상단에 눈에 띄는 스펙 카드로 보여주는 용도 —
// 사이즈·파일형식·용량처럼 숫자로 딱 떨어지는 값만 뽑아서 채우고, 세이프존
// 같은 서술형 기준은 guideline 텍스트 쪽에 그대로 둡니다.
//
// 팀원이 media-guide.html의 "+ 매체 추가"로 이름/URL/PDF만 직접 등록할 수도
// 있습니다 — 이런 항목은 여기 코드에는 없고 Vercel Blob에 라이브 상태로
// 저장되며(api/_mediaGuideListStore.js), guideline/specs는 비어있는 채로
// 시작합니다. 실제 기준 내용을 채우려면 위 "HOW TO ADD A GUIDELINE" 절차와
// 동일하게 PDF나 링크를 Claude에게 보내주세요.

import { getDynamicMediaGuides } from './_mediaGuideListStore.js';

export const MEDIA_GUIDES = {
  'meta-reels': {
    name: '메타(릴스)',
    note: '릴스(Reels) 이미지 소재 등록 기준 반영됨',
    sourceUrl: 'https://www.facebook.com/business/help/980593475366490?id=1240182842783684',
    sourceFile: null,
    specs: [
      { label: '릴스 이미지', size: '1080 x 1920px (9:16)', format: null, maxSize: null },
    ],
    guideline: `[메타 릴스(Reels) 이미지 광고 소재 기준]
※ 메타 공식 페이지(facebook.com/business/help) 직접 열람이 불가해, 해당 페이지를 인용하는 복수의 신뢰할 수 있는 소스를 교차 확인해 정리한 내용입니다. 세이프존 수치와 비율은 여러 소스에서 일치했지만, 정확한 최신 기준은 담당자가 메타 공식 페이지에서 한 번 더 확인하는 것을 권장합니다.

- 화면 비율: 9:16 세로 전체화면 (가로/정사각형 불가)
- 제작 해상도: 1080 x 1920px (팀 실제 제작 기준)
- 세이프존(반드시 텍스트·로고·CTA를 피해야 하는 영역): 상단 14%, 하단 35%, 좌우 각 6%
  · 상단: 프로필·사운드 아이콘이 겹침
  · 하단: CTA 버튼, 계정명, 설명 텍스트가 겹침 — 특히 하단 35%는 매우 넓으니 주의
  · 좌우: 기기별 크롭으로 잘릴 수 있음
- 이미지에는 텍스트를 가능한 한 최소화할 것을 권장 (릴스 피드 특성상 작게 보이므로, 꼭 필요한 경우가 아니면 카피는 이미지가 아닌 광고 카피 필드로)
- 이미지 안에 텍스트나 로고, CTA를 넣어야 한다면 반드시 세이프존(중앙 영역) 안에 배치

이 기준은 10번(매체 최적화) 항목을 판정할 때 최우선으로 반영하세요. 세이프존 비율(상단 14%, 하단 35%, 좌우 6%)은 정확한 픽셀 측정이 아니라 대략적인 위치 판단이라는 점을 감안하세요. 판정 전에 이미지를 세로로 나눠 상단 14%, 하단 35% 지점이 대략 어디쯤인지 먼저 가늠한 뒤 비교하세요.
- 로고·CTA·핵심 카피가 세이프존 경계를 명확하고 크게 벗어나 있다면(예: 세이프존 절반 이상을 침범) major 이상으로 판정하고, 어느 요소가 얼마나 벗어났는지 구체적으로 적으세요.
- 경계에 살짝 걸치는 정도이거나 정확한 침범 여부를 이미지만으로 확신하기 어렵다면 major로 단정하지 말고 minor로 판정하거나, needsCheck에 "세이프존 경계 부근이라 정확한 침범 여부는 실제 업로드 후 매체 미리보기에서 재확인 필요"라고 남기세요. 애매한 경우 과도하게 반려·주요수정으로 판정하지 마세요.`,
  },
  'buzzvil': {
    name: '버즈빌',
    note: '잠금화면·인앱 소재 등록 기준 반영됨 (라이브커머스 포함)',
    sourceUrl: null,
    sourceFile: { fileName: '버즈빌_CPM_CPC_소재제작가이드.pdf', mimeType: 'application/pdf', fileUrl: 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/media-guides/buzzvil-RSlpOzGDkK1iKVOD6sXvfshbODQHoX.pdf' },
    specs: [
      { label: '잠금화면 이미지', size: '1080 x 2340px', format: 'JPG, PNG', maxSize: '2MB' },
      { label: '인앱 이미지', size: '1200 x 627px (로고 320 x 320px)', format: 'JPG, PNG', maxSize: '2MB' },
    ],
    guideline: `[버즈빌 CPM/CPC 소재 제작 가이드 (라이브커머스 광고 상품 포함)]

■ 잠금화면 이미지 소재
- 이미지 사이즈: 1080 x 2340px (배경을 투명(transparent)으로 설정하면 사용 불가)
- 파일형식: JPG, PNG / 용량 제한 2MB (저장 시 Quality 100% 기준)
- 텍스트 소재: 없음 (이미지 안에 별도 텍스트를 넣지 않음)
- 잠금화면 UI에 겹치지 않도록 상/하단 630px 여백 확보
- 브랜드를 명확히 인지할 수 있는 로고나 BI/CI 포함 권장
- 두 가지 이상 내용이 들어가는 편집 지양
- 광고 이미지 소재 내 CTA 박스나 버튼 삽입 지양
- 타 캠페인 유형으로 오인될 수 있는 소재 불가 (예: 네이버 퀴즈 검색 유도 등)
- 기본 UI에 스와이프(화살표) 안내가 이미 있으므로 이미지 내 별도 스와이프 안내 금지
- 이미지 내 "다운", "내려받기", "인스톨", "Install", "오픈", "설치", "앱" 단어 사용 불가

■ 인앱 이미지/텍스트 소재
- 이미지 사이즈: 1200 x 627px (배경 투명 설정 시 사용 불가), 로고 사이즈 320 x 320px
- 파일형식: JPG, PNG / 용량 제한 2MB (저장 시 Quality 100% 기준)
- 텍스트 소재 글자수 제한: 타이틀 15자 이내(띄어쓰기·특수문자 포함, 이모지 불가), 설명 40자 이내(줄바꿈 불가, 이모지 불가), CTA 7자 이내(이모지 불가, 숫자가 들어가면 문구 뒤쪽에 배치)
- 타이틀·설명·CTA·이미지 내 "다운", "내려받기", "인스톨", "Install", "오픈", "설치", "앱" 단어 사용 불가
- 두 가지 이상 내용이 들어가는 편집 지양
- CTA는 별도 버튼으로 이미 존재하므로 이미지 내 CTA와 혼동될 수 있는 문구 삽입 불가
- 타 캠페인 유형으로 오인될 수 있는 소재 불가
- 브랜드를 명확히 인지할 수 있는 로고나 BI/CI 포함 권장

■ 공통 안내 (평가 대상은 아니지만 참고)
- 랜딩 URL: 잠금화면·인앱 지면 모두 동일한 URL 하나로 진행 가능 (일반 웹 또는 원링크 중 1개). 라이브커머스는 SNS 채널 랜딩 비권장
- 소재 내 리워드 금액 표기 불가
- 소재/랜딩 교체는 최소 집행예산 월 500만원 기준 월 2회, 정시 단위로만 적용(분 단위 불가)

이 기준은 10번(매체 최적화) 항목을 판정할 때 반영하세요. 시안이 잠금화면용인지 인앱용인지 이미지 크기·비율로 우선 판단한 뒤, 해당하는 규격(잠금화면 1080x2340 / 인앱 1200x627)과 여백·금지어 기준으로 평가하세요. 어느 쪽인지 이미지만으로 판단하기 애매하면 needsCheck에 "잠금화면/인앱 중 어느 지면용인지 확인 필요"라고 남기세요. 텍스트 글자수 제한(타이틀 15자, 설명 40자, CTA 7자)은 이미지 안에 실제로 삽입된 문구에만 적용하고, 시안에 그런 텍스트 소재가 없다면 이 기준으로 반려하지 마세요.`,
  },
  'mobon': {
    name: '모비온',
    note: '고정배너/리뷰배너/동영상소재/인사이트마케팅 소재 등록 기준 반영됨',
    sourceUrl: 'https://www.mobon.net/main/download/mobon_intro.pdf?240905',
    sourceFile: null,
    specs: [
      { label: '고정배너 (마스터 사이즈)', size: '850 x 850px', format: 'PSD (리사이징 서비스용)', maxSize: null },
      { label: '리뷰배너', size: '300 x 600px / 800 x 1500px', format: null, maxSize: null },
      { label: '동영상소재', size: '1920x1080 / 1080x1080 / 1080x1920', format: 'MP4', maxSize: '7MB 미만' },
      { label: '인사이트마케팅 소재', size: '850x850 / 1200x628 / 970x250 / 800x1500', format: null, maxSize: null },
    ],
    guideline: `[모비온(MOBON) 광고 소재 제작 기준]
※ 모비온 상품소개서(PDF) 기준으로 정리한 내용이며, 매체 자체의 세이프존·텍스트 비율에 대한 구체적 규정은 명시되어 있지 않습니다. 표준 배너 디자인 원칙(가독성, 여백)을 기본으로 참고하세요.

■ 고정배너 (스태틱 이미지 배너)
- 필수 사이즈(13종): 120x600, 160x600, 250x250, 300x150, 336x280, 300x180, 320x100, 720x1230, 720x120, 800x1500, 850x850, 970x250, 1456x180
- 전체 사이즈를 다 만들기 어려우면 PSD 850x850 마스터 사이즈로 전달 시 모비온에서 리사이징 베리에이션 가능 (영업일 기준 3일 소요, 수정 불가, 월 300만원 이상 소진 광고주에 한해 월 1회)

■ 상품화배너 (다이나믹 피드형)
- AI가 실제 클릭이 발생한 상품 이미지를 자동 조합해 노출하는 방식이라 별도 사이즈 규정 없음 (고정배너와 동일 지면 사용)

■ 리뷰배너
- 사이즈: 300 x 600px, 800 x 1500px
- 평점 5점 후기 또는 BEST 리뷰를 스크랩핑해 노출하는 다이나믹 형태 (5개 리뷰 1.5초 롤링)

■ 동영상소재
- 사이즈: 1920 x 1080px(16:9), 1080 x 1080px(1:1), 1080 x 1920px(9:16)
- 파일형식: MP4 / 용량: 7MB 미만
- 15초 이내 권장, 사이즈별로 각각 전달 필요

■ 인사이트마케팅 (팝업 / 상품상세 추천)
- 필수 소재 사이즈: 850 x 850px, 1200 x 628px, 970 x 250px, 800 x 1500px

이 기준은 10번(매체 최적화) 항목을 판정할 때 반영하세요. 시안 사이즈가 위 고정배너 필수 사이즈 13종 또는 리뷰배너·동영상·인사이트마케팅 사이즈 중 하나와 정확히 일치하는지 우선 확인하고, 일치하지 않으면 needsCheck에 "모비온 필수 사이즈 목록과 정확히 일치하지 않음, 리사이징 서비스 이용 여부 확인 필요"라고 남기세요. 모비온 자료에는 텍스트 비율·세이프존에 대한 구체적 수치 규정이 없으므로, 이 항목만으로 major 반려 판정을 내리지 말고 일반적인 가독성 기준으로 참고 의견을 남기세요.`,
  },
  'cookieoven': {
    name: '쿠키오븐(네이버웹툰)',
    note: '광고 목록/상세화면, 동영상, 멀티미션, 퀴즈, 띠배너 등 소재 등록 기준 반영됨',
    sourceUrl: 'https://guides.advertising.webtoon.com/J1suphMzPP344bYELGyP/naverwebtoon/creative-guidelines/cookieoven',
    sourceFile: null,
    specs: [
      { label: '광고 목록화면', size: '720 x 360px', format: 'PNG, JPG (+PSD)', maxSize: '200KB' },
      { label: '광고 상세화면', size: '720 x 780px', format: 'PNG, JPG (+PSD)', maxSize: '400KB' },
      { label: '동영상 상세화면', size: '9:16 / 1:1 / 16:9', format: 'MP4', maxSize: '10MB (최대 30초)' },
    ],
    guideline: `[쿠키오븐(네이버웹툰) 광고 소재 제작 기준]

■ 광고 목록화면
- 사이즈: 720 x 360px / 용량: 200KB 이하 / 형식: PNG, JPG (PSD 함께 제출)
- 텍스트: 타이틀 최대 15자, 서브텍스트 최대 19자(띄어쓰기 포함)
- 여백: 쿠키 아이콘(하단 22px, 우측 30px), 심의필(하단 22px, 우측 36px) 피해서 배치
- 배경색 제한 (웹툰 기본 배경색 #fefefe, #f6f6f6 사용 금지), 앱 설치/다운로드 텍스트·디바이스 목업 금지

■ 광고 상세화면
- 사이즈: 720 x 780px / 용량: 400KB 이하 / 형식: PNG, JPG (PSD 함께 제출)
- 텍스트: 타이틀 최대 15자, 서브텍스트1 최대 17자, 서브텍스트2 최대 48자
- 배경색 제한 동일 적용, 앱 설치 문구·과대광고·허위사실 금지

■ 동영상 상세화면
- 사이즈: 9:16형 / 1:1형 / 16:9형 중 선택
- 용량: 10MB 이하(최대 30초) / 형식: MP4(1080p 권장, 최소 720p)
- 동반 필수: 이미지 소재(720 x 780px)를 함께 제출해야 함

■ 참여중 영역(멀티미션)
- 사이즈: 144 x 144px / 용량: 100KB 이하 / 형식: PNG, JPG

■ 퀴즈 상품
- 사이즈: 720 x 780px / 용량: 400KB 이하
- 텍스트: 퀴즈 정답 최대 10자, 추가 설명 최대 48자(힌트·이벤트 내용 기재 가능)

■ 영상형 띠배너
- 사이즈: 720 x 210px(표기에 따라 720 x 200px로도 안내됨) / 용량: 200KB 이하 / 형식: PNG, JPG (PSD 함께 제출)
- 영상 내 여백이 없으면 상단에 10px 흰색 여백 추가

■ 2차 팝업
- 사이즈: 720 x 360px / 용량: 200KB 이하 / 형식: PNG, JPG, GIF
- 텍스트: 서브문구 최대 19자, 버튼 최대 12자
- 구독형, CPQ, SNS 바이럴형 상품에만 사용 가능 (다른 상품 유형에는 부적용)

■ 상세화면 설명 이미지
- 사이즈: 720 x 가변 / 용량: 400KB 이하
- 라이트모드·다크모드 이미지 둘 다 필수 제작 (다크모드는 배경 제거)
- 폰트: 나눔고딕 26pt, 행간 38pt

이 기준은 10번(매체 최적화) 항목을 판정할 때 반영하세요. 먼저 시안이 위 8가지 소재 유형 중 어느 것에 해당하는지 이미지 크기·비율로 판단한 뒤, 해당 유형의 사이즈·용량·글자수·여백 기준으로 평가하세요. 어느 유형인지 애매하면 needsCheck에 "쿠키오븐 소재 유형(목록/상세/멀티미션/퀴즈/띠배너/팝업/설명이미지) 확인 필요"라고 남기세요. 글자수 제한은 이미지 안에 실제로 삽입된 문구에만 적용하고, 시안에 해당 텍스트 소재가 없다면 이 기준으로 반려하지 마세요.`,
  },
  'toss': {
    name: '토스',
    note: '디스플레이 광고 이미지 소재(가로형/정사각형/세로형/브랜드로고) 등록 기준 반영됨',
    sourceUrl: 'https://toss-ads.gitbook.io/guide/a-d/display-ads/creative-guidelines/image',
    sourceFile: null,
    specs: [
      { label: '가로형 이미지', size: '1200 x 628px 이상 (1.91:1 또는 16:9)', format: 'JPG, PNG', maxSize: '10MB' },
      { label: '정사각형 이미지', size: '1080 x 1080px 이상 (1:1)', format: 'JPG, PNG', maxSize: '10MB' },
      { label: '세로형 이미지', size: '1080 x 1920px 이상 (9:16)', format: 'JPG, PNG', maxSize: '10MB' },
      { label: '브랜드 로고', size: '800 x 800px 이상 (1:1)', format: 'JPG, PNG', maxSize: null },
    ],
    guideline: `[토스(Toss) 디스플레이 광고 이미지 소재 제작 기준]

■ 브랜드 로고
- 비율 1:1, 최소 800 x 800px / 형식: jpg, jpeg, png
- 배경이 있는 이미지 필수(투명 배경 불가), 심볼이나 짧은 텍스트 형태 권장

■ 광고 이미지 (3가지 유형 중 선택)
- 가로형: 1.91:1 또는 16:9, 최소 1200 x 628px — 이미지 안에 메시지를 직접 담아야 함(별도 문구가 노출되지 않음)
- 정사각형: 1:1, 최소 1080 x 1080px
- 세로형: 9:16, 최소 1080 x 1920px
- 공통: jpg, jpeg, png / 10MB 이하 / 배경 필수(투명 배경 불가)

■ 텍스트 규격
- 주요 문구: 5~28자(한 줄 최대 14자)
- 보조 문구: 5~18자
- CTA 버튼: 13개 고정 옵션 중 선택(자유 문구 불가)

■ 금지사항
- 배경 없는(투명) 이미지
- 과도한 빨간색·형광색 등 고채도 색상
- 텍스트 겹침·가독성 불량
- 과한 크롭·클로즈업
- 토스 서비스로 오인 가능한 UI 모방
- 신조어·밈·초성 사용
- 특수문자 반복 사용(!!!, ???, ~~)
- 마침표(.)로 문장 끝내기
- 단축 URL·앱플라이 원링크 사용

이 기준은 10번(매체 최적화) 항목을 판정할 때 반영하세요. 시안 비율이 가로형(1.91:1/16:9)·정사각형(1:1)·세로형(9:16) 중 어디에 해당하는지 먼저 확인하고, 해당 유형의 최소 해상도 충족 여부와 배경 유무(투명 배경 금지)를 우선 판단하세요. 텍스트 글자수·CTA 문구 제한은 이미지 안에 실제로 삽입된 문구에만 적용하고, 시안에 해당 텍스트가 없다면 이 기준으로 반려하지 마세요. 금지 색상(과도한 빨강/형광)은 명확하게 두드러지는 경우에만 지적하고, 브랜드 컬러상 불가피하게 포함된 정도라면 minor로 판정하세요.`,
  },
  'criteo': {
    name: '크리테오',
    note: '아직 가이드가 등록되지 않았습니다.',
    sourceUrl: null,
    sourceFile: null,
    specs: [],
    guideline: '',
  },
  'naver-brandsearch': {
    name: '네이버 브랜드검색',
    note: '아직 가이드가 등록되지 않았습니다.',
    sourceUrl: null,
    sourceFile: null,
    specs: [],
    guideline: '',
  },
};

// Merges the curated MEDIA_GUIDES above with media guides added live from
// the browser (media-guide.html "+ 매체 추가"), so every caller sees one
// list regardless of where a media guide's entry actually lives.
export async function getAllMediaGuides() {
  const dynamic = await getDynamicMediaGuides();
  const merged = { ...MEDIA_GUIDES };
  for (const m of dynamic) {
    merged[m.id] = {
      name: m.name,
      note: m.note,
      sourceUrl: m.sourceUrl,
      sourceFile: m.sourceFile,
      specs: m.specs || [],
      guideline: m.guideline || '',
      isCustom: true,
    };
  }
  return merged;
}

export async function getMediaGuide(id) {
  if (!id) return null;
  if (MEDIA_GUIDES[id]) return MEDIA_GUIDES[id];
  const dynamic = await getDynamicMediaGuides();
  const found = dynamic.find((m) => m.id === id);
  return found
    ? {
        name: found.name,
        note: found.note,
        sourceUrl: found.sourceUrl,
        sourceFile: found.sourceFile,
        specs: found.specs || [],
        guideline: found.guideline || '',
        isCustom: true,
      }
    : null;
}
