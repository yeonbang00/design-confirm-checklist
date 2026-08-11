// POST /api/analyze
// Body: { base64: string, mediaType: string, advertiserId?: string, mediaGuideIds?: string[], imageWidth?: number, imageHeight?: number, briefImages?: [{base64, mediaType}], fileSizeBytes?: number }
// Returns: { items: [...], summary: string, comparison: {...} | null, briefAlignment: {...} | null, briefError?: string }
//
// briefImages (optional): 기획안(PPT 캡처) 이미지. 있으면 배너 분석 전에 먼저
// extractBriefDirection()으로 기획 방향을 뽑아내고, 그 방향에 비추어 새
// briefAlignment 판정을 추가로 채운다. 기획안 추출이 실패해도 배너 분석
// 자체는 막지 않고 briefError만 채워서 응답한다.
//
// The OpenAI API key lives ONLY in this server-side environment variable.
// It is never sent to, or reachable from, the browser.

import { getAdvertiser } from './_referenceBanners.js';
import { MEDIA_GUIDES } from './_mediaGuides.js';
import { extractBriefDirection } from './_briefAnalysis.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';
import { getBrandGuideState } from './_brandGuideStore.js';
import { callOpenAI } from './_openaiClient.js';
import { runOcr, formatOcrForPrompt } from './_clovaOcr.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

// 17 items = 9 core design/strategy checks + 4 AI-generation artifact checks
// + 4 agency-delivery checks (media spec, text/logo rendering fidelity, logo
// compliance, mandatory legal/compliance copy). Kept as ONE list so every
// item shares the same pass/needsfix/reject/na scale.
const BASE_PROMPT = `다음은 광고대행사가 광고주에게 전달하기 전 최종 검수하는 배너 시안 이미지입니다. 목적은 광고주 전달 후 발생할 수정 요청을 사전에 줄이는 것입니다. 아래 17개 항목을 기준으로 평가하세요.

1 전략 적합성 - 캠페인 목적/타깃 톤앤매너 일치, 여러 혜택 포인트가 하나의 오퍼로 수렴하는지 (서로 다른 오퍼·캠페인이 경쟁하지 않는지)
2 위계 및 구조 - 헤드라인→서브→CTA 시선 동선, 3초 내 파악 가능 여부
3 타이포·정렬·여백·간격 - 폰트 2~3종 이내, 요소 간 상대 정렬과 캔버스 기준 중앙정렬, CTA 도형·내부 텍스트 정렬, 강조가 필요한 핵심 정보의 시각적 구분, 텍스트-배경 명도 대비, 요소 간 여백·간격 일관성, 텍스트 줄바꿈 위치
4 정보 정확성 - 가격/날짜/단위 등 오탈자 여부
5 컬러 일관성 - 브랜드 컬러 준수, 색상 3~4개 제한
6 합성 리얼리티 - 광원/그림자 일치, 공간감 (사진 합성이 아니면 na)
7 피사체 보정 - 실사 피사체의 리터칭·질감 품질, 형태 자체가 아니라 표면 텍스처가 과도하게 매끈하거나 부자연스러운지 (실사 피사체가 없으면 na)
8 그래픽 완성도 - 해상도, 아이콘/스타일 일관성
9 CTA 및 전환 - CTA가 있다면 문구/위치 명확성 (매체가 별도로 CTA 버튼을 붙여주는 경우 이미지 안에 CTA가 없는 것도 정상)
10 신체 비율 왜곡 - AI 생성/보정 특유의 얼굴·신체·의상·소품 형태·구조 왜곡, 7번과 달리 형태·비율 자체가 물리적으로 말이 안 되는 경우 (인물이 없으면 na)
11 배경 패턴 반복 - AI 생성 특유의 부자연스러운 반복/대칭 패턴 여부
12 워터마크·서명 흔적 - 생성형 워터마크나 스톡 이미지 서명 잔여 여부
13 광원-그림자 방향 일치 - 여러 피사체의 그림자 방향이 서로 모순되지 않는가 (그림자를 가진 피사체가 하나뿐이면 na)
14 매체 최적화 - 세이프존, 모바일 가독성 (일부 매체는 기기별 화면비율에 맞춰 자동으로 크롭될 수 있음 — 해당 매체 기준이 제공된 경우에만 확인)
15 텍스트·로고 렌더링 - 문자·로고가 의미 없이 깨지지 않았는가, 잘 알려진 제3자 로고는 색상도 정확한지
16 로고 사용 규정 - 로고 최소 여백 확보, 변형·왜곡 없이 사용, 로고 자체가 누락되지 않았는지
17 법적고지·심의 문구 - 금융/대출/의료/주류/게임 등 규제 업종에 필요한 고지·심의 문구 포함 여부 (해당 업종이 아니면 na)

17개 항목은 pass/needsfix/reject/na 중 하나로 판정하세요.
- pass: 문제 없음
- needsfix: 고쳐도 되고 안 고쳐도 무방하지만, 고치면 디자인 퀄리티가 한 단계 올라가는 수준의 선택적 개선 여지 — 강제 사항이 아니라 제안입니다.
- reject: 광고주 전달 전 무조건 확인·수정해야 하는 문제입니다. "시안을 통째로 다시 만들어야 할 정도"라는 뜻이 아니라, 고치는 것 자체는 쉽더라도 반드시 짚고 넘어가야 하는 항목이라는 뜻입니다. 아래 두 기준 중 하나에 해당하면 reject로 판정하세요:
  1) 3번(정렬·여백·간격 관련 부분)·4번·16번에서 발견된 문제는 크기와 무관하게 무조건 reject로 판정하세요(needsfix로 낮추지 마세요) — 오탈자, 여백·정렬, 로고 사용 규정처럼 객관적으로 확인 가능한 필수 준수 사항이기 때문입니다.
  2) 그 외 항목(1,2,5,6,7,8,9,10,11,12,13,15)은 문제가 대부분의 사람이 봐도 명백하게 눈에 띄는 저퀄리티(AI 생성 아티팩트가 뚜렷하거나 합성이 확연히 부자연스러운 경우 등)일 때만 reject로 판정하고, 미묘하거나 선택적으로 더 다듬으면 좋은 수준이라면 needsfix로 판정하세요.
14번(매체 최적화)은 매체 선택 여부에 따라 기준이 다릅니다 — 매체를 선택해서 구체적인 등록 기준(세이프존 %, 사이즈 등)이 제공된 경우, 그 기준을 명확하고 크게 벗어났다면 reject로 판정하세요. 반면 매체를 선택하지 않아 "세이프존, 모바일 가독성"이라는 일반 기준만 있는 경우에는, 구체적인 수치 기준 없이 AI 스스로의 판단("여백이 부족해 보인다" 등)에 의존하는 것이므로 reject로 단정하지 말고 needsfix로 판정하세요 — 디자인 선택의 여지를 존중하되, 개선하면 좋을 부분으로만 짚어주세요.
크롭 관련 주의는 메타(1080x1920)처럼 실제로 기기별 화면비율에 따라 자동 크롭이 발생하는 매체를 선택했고, 그 매체 가이드에 크롭 관련 안내가 있는 경우에만 언급하세요. 매체를 선택하지 않았거나 선택한 매체 가이드에 크롭 관련 언급이 없다면, 크롭 위험을 임의로 지어내서 언급하지 마세요 — 대부분의 게재 매체는 고정 사이즈로 그대로 노출되고 자동으로 잘리지 않습니다.
17번(법적고지·심의 문구)은 예외입니다 — 이미지만 보고 어떤 문구가 정확히 필요한지, 표기가 규정에 맞는지까지는 확신할 수 없으므로 reject로 단정하지 마세요. 고지 문구가 아예 안 보이거나 너무 작아 알아보기 어려운 경우 needsfix로 판정하고, note에 "정확한 필요 문구·표기 기준은 담당자 확인 필요"라고 남기세요. 문구가 있고 육안으로 특별히 이상해 보이지 않으면 pass로 판정하세요.
- na: 해당 시안에 명백히 적용되지 않는 항목 (예: 인물 없는 시안의 10번, 비규제 업종의 17번)

판정 태도: 이 도구가 그동안 너무 관대하게 판정해왔다는 피드백이 있었습니다. "전체적으로 괜찮아 보인다"는 인상만으로 pass를 주지 마세요. 각 항목의 해당 영역을 확대해서 들여다보듯 세밀하게 뜯어보고, 조금이라도 부자연스럽거나 눈에 걸리는 부분이 있으면 pass가 아니라 최소 needsfix로 판정하세요. pass는 "이대로 광고주에게 나가도 아무도 문제 삼지 않는다"고 확신할 때만 주세요. 특히 아래처럼 얼핏 보면 괜찮아 보이지만 자세히 보면 문제인 패턴을 주의하세요 (6번·7번 판정 시 특히 유의):
- 물방울·수분 표현의 크기와 분포가 부자연스럽게 균일해서 텍스처를 입힌 것처럼 보이는 경우 (신선함을 과장하려다 오히려 땀 찬 것처럼 보이는 경우)
- 차량·사물의 경계선이나 형태가 자연스럽게 이어지지 않고 뭉개지거나 비율이 어긋난 경우
- 인물의 옷·소품이 물리적으로 말이 안 되게 접히거나 뭉쳐 있는 경우
- AI 이미지 생성 도구(예: ChatGPT/DALL-E 계열) 특유의 미세한 노이즈·그레인 — 매끈해야 할 피부·원단·배경 표면에 지글거리는 잔노이즈나 얼룩덜룩한 결이 껴 있는 경우 (사진처럼 보이지만 자세히 보면 표면 전체에 자잘한 잡티·정전기 같은 텍스처가 낀 느낌). 이 노이즈는 특히 6번·7번에서 확인하세요.
- AI 이미지 생성 도구 특유의 울퉁불퉁한 표면 질감 — 매끈해야 할 헬멧·재킷·플라스틱·피부 표면이 마치 오돌토돌한 요철이 있는 것처럼 부자연스럽게 울퉁불퉁해 보이는 경우 (특히 3D 캐릭터·일러스트풍 인물이나 소품에서 자주 나타남). 이것도 6번·7번에서 확인하세요.

주의: 위 노이즈·그레인, 울퉁불퉁한 표면 질감 패턴은 사진 합성이 아니라 처음부터 AI로 생성된 일러스트·3D 그래픽 스타일 배너에서도 똑같이 나타날 수 있습니다. 이런 배너는 6번·7번이 "사진 합성/실사 피사체가 아님" 기준으로 na 처리되지만, 그렇다고 이 문제들을 그냥 넘어가지 마세요 — 6번·7번은 그대로 na로 두고, 대신 8번(그래픽 완성도, 이미지 스타일과 무관하게 항상 평가하는 항목)에서 같은 문제를 지적하세요.

반대로 결함으로 오인하지 말아야 할 경우도 있습니다: 동전·나뭇잎·컨페티 같은 작은 장식 요소가 입체감이나 움직임을 표현하기 위해 의도적으로 모션 블러(흩날리는 느낌의 흐림 효과) 처리된 경우는 결함이 아니니 "흐릿하다/뭉개졌다"고 지적하지 마세요. 이런 의도적 모션 블러는 주요 피사체(제품·인물·로고 등) 자체의 초점이 안 맞거나 이미지가 전반적으로 뭉개진 경우와는 다릅니다 — 후자만 문제로 판정하세요.

6번(합성 리얼리티)과 13번(광원-그림자 방향 일치)은 둘 다 "그림자"를 보지만 서로 다른 질문입니다 — 헷갈리지 말고 구분하세요:
- 6번은 "합성 퀄리티" 문제입니다: 피사체의 그림자·반사가 배경과 자연스럽게 어우러져서 합성이 티 안 나는지(질감·톤·공간감 포함), 사진 합성이 아니면 na입니다.
- 13번은 "광원 방향의 일관성" 문제입니다: 이미지 안에 그림자를 가진 피사체가 2개 이상 있을 때, 그 그림자들이 서로 다른 방향의 광원을 가리키며 모순되지 않는지를 봅니다. 그림자를 가진 피사체가 하나뿐이거나 아예 없다면 "비교할 대상"이 없는 것이므로 13번은 na로 판정하세요 — 억지로 pass를 주지 마세요.

4번(정보 정확성), 14번(매체 최적화), 3번(타이포·정렬·여백·간격)은 팀이 가장 중요하게 보는 기준입니다. 4번을 판정하기 전에, 다른 항목처럼 인상만 보고 넘어가지 말고 반드시 아래 절차를 실행하세요:
1) textTranscript 필드에 이미지 안에 보이는 모든 한글·숫자 텍스트를 헤드라인부터 가장 작은 글씨까지 하나도 빠짐없이 실제로 옮겨 적으세요 (내부적으로 생각만 하지 말고 반드시 이 필드에 문자 그대로 출력하세요 — 요소마다 줄바꿈으로 구분).
2) 그렇게 적은 textTranscript를 다시 처음부터 훑으면서, 각 단어가 실제 존재하는 자연스러운 한국어 단어·표현인지 하나씩 대조하세요. 특히 자음·모음 하나만 다른 유사 글자를 조심하세요 (예: "구매하고"가 "구매햐고"로, "소개"가 "쇼개"로 잘못 표기되는 식 — 획 하나 차이라 스치듯 보면 놓치기 쉽습니다).
3) 가격·날짜·단위·맞춤법 오류도 함께 재확인하세요.
확신이 서지 않는 글자는 추측하지 말고 메모에 "확인 필요"라고 남기세요. 4번의 note는 다른 항목보다 더 구체적으로 — 어느 글자·숫자·영역이 문제인지 짚어서 — 작성하세요.

3번(타이포·정렬·여백·간격)의 여백·간격 부분을 판정할 때는 다음 두 가지를 확인하세요:
1) 여백·간격 일관성: 비슷한 성격의 요소들(카드·버튼·아이콘·텍스트 블록 등) 사이의 간격이 서로 고르게 정리되어 있는지. 일부만 유독 붙어 있거나 떨어져 있으면 needsfix 이상으로 판정하세요.
2) 텍스트 줄바꿈 위치: 문구가 단어나 자연스러운 어절 중간에서 끊겨 다음 줄로 넘어가지 않는지 (예: "최대 할" / "인 57만원"처럼 의미 단위가 아닌 곳에서 끊긴 경우). 어색하게 끊겼다면 needsfix 이상으로 판정하세요.

금액 표기 띄어쓰기: "3만원대", "3만원 대"는 팀 표기 컨벤션 위반입니다. "숫자+공백+원+대"(예: "3만 원대", "10만 원대")가 올바른 표기이니, 이미지 속 금액 표기가 이 형식과 다르면 4번에서 지적하세요. 단, 이 규칙은 "원"을 표기에 포함한 경우에만 적용됩니다 — "23.5만 페이백", "3만 캐시백"처럼 "원"을 아예 생략하고 숫자+단위(만/억 등)만 쓰는 것도 광고 카피에서 흔히 쓰이는 정상적인 표기이니, "원"이 없다는 이유만으로 4번을 지적하지 마세요.

물결표(~) 띄어쓰기: "~" 뒤에 바로 숫자가 오는 표기(예: "~70% 할인", "~50%")는 물결표와 숫자 사이에 공백이 없어야 올바른 표기입니다. "~ 70% 할인"처럼 물결표와 숫자 사이에 공백이 있으면 4번에서 지적하세요. (숫자와 숫자 사이의 범위 표기, 예: "1~2개", "3~5일"도 마찬가지로 물결표 양옆에 공백이 없어야 합니다.)

말줄임표 표기: "통신비까지.."처럼 점 두 개(..)로 말줄임을 표현한 경우, 정식 문장부호 규정(점 세 개 "..." 또는 여섯 개 "……")과는 다르지만 캐주얼한 광고 카피에서 흔히 쓰이는 약식 표기이니 4번에서 지적하지 마세요.

4번(정보 정확성)에는 최상급·순위·비교 표현의 실증 표기 여부도 포함하세요(네이버 광고 심사 기준을 참고해 정리한 원칙입니다). textTranscript에 "최고", "최상", "최적", "최초", "완벽", "초일류", "가장", "제일", "1위", "1등" 같은 최상급·순위 표현이 있는지 확인하세요:
- 이런 표현이 있는데 그 근거(수상 내역, 조사기관·조사기간, 언론 보도 등)를 알 수 있는 표기가 이미지 안 어디에도 (아무리 작게라도) 없다면 4번을 reject로 판정하고, note에 "OO 표현에 근거 표기 없음"이라고 구체적으로 남기세요.
- 근거 표기가 이미지 안에 작게라도 있다면(예: "2026.01~06 기준, OOO리서치 조사") 그 내용의 사실 여부까지 검증할 필요는 없으니 통과로 판정하세요.
- 경쟁사와 직접 비교하지 않고 자사 상품·서비스만 강조하는 표현("베스트셀러", "우리 매장 대표 상품" 등)이나, 상품명 자체에 포함된 고유명사(예: 상품명이 "베스트클리너")는 근거 표기가 없어도 문제 삼지 마세요 — 순위·비교를 주장하는 표현일 때만 이 규칙을 적용하세요.

3번(타이포·정렬·여백·간격)을 판정할 때 폰트 위계도 함께 확인하세요:
1) 서브텍스트 가독성: 서브카피·부가 문구가 눈에 띄게 작아서 읽기 불편한 수준이라면 needsfix 이상으로 판정하세요.
2) 메인-서브 조화: 메인카피와 서브카피가 반드시 굵기 차이를 가져야 하는 것은 아닙니다. 같은 굵기·계열로 통일감 있게 처리된 것도 정상적인 선택이니, 굵기 대비가 없다는 이유만으로 문제 삼지 마세요.
3) 강조 요소 판단: 이미지 안에 가격·할인율·기간 한정·핵심 혜택처럼 특별히 강조해야 할 것으로 보이는 정보가 있는지 먼저 판단하세요. 그런 요소가 있다면, 색상 하이라이트·굵기 강화·크기 확대 중 최소 하나의 방법으로 주변 텍스트와 명확히 구분되게 강조되어 있는지 확인하세요. 강조돼야 할 핵심 정보인데 주변 텍스트와 구분 없이 묻혀 있다면 needsfix 이상으로 판정하고, note에 어떤 정보가 묻혀 있는지 적으세요. 특별히 강조할 요소가 없는 배너라면 이 기준 자체를 적용하지 말고 억지로 위계를 요구하지 마세요.

3번(타이포·정렬·여백·간격)의 텍스트-배경 대비(가독성)를 판정할 때: 브라우저가 직접 측정한 명도 대비 수치가 아래 안내되어 있다면 그 수치를 우선 참고하세요. 수치가 없는 경우에는, 텍스트 색상과 배경 색상이 비슷한 톤이라 눈으로 봐도 명백하게 글자가 묻혀 보이는 경우(예: 어두운 파란 배경 위 검정 텍스트, 밝은 배경 위 연한 회색 텍스트)를 확인하세요. 대비가 근소하게 낮은 수준까지 잡을 필요는 없고, 실제로 읽기 불편할 정도로 명백한 경우만 needsfix 이상으로 판정하고 note에 "텍스트-배경 대비 부족: OO 텍스트가 OO 배경에 묻힘"이라고 적으세요.

3번(타이포·정렬·여백·간격)을 판정할 때, 텍스트 안에 가운데점(·)·하이픈(-)·별표(*) 같은 구분 기호가 쓰였다면 확대해서 보듯 자세히 확인하세요: 그 기호가 양쪽 글자 사이에 수직으로 정확히 가운데 위치하는지, 기호 양옆 여백이 대칭적으로 자연스러운지를 보세요 (예: "코인·배지"에서 점이 위아래 중앙에 있고, 점과 "코인" 사이 간격과 점과 "배지" 사이 간격이 비슷한지). 기호가 한쪽으로 치우쳐 있거나 양옆 여백이 눈에 띄게 다르면 3번을 reject로 판정하고, note에 어느 구분 기호가 어떻게 치우쳤는지 구체적으로 적으세요.

2번(위계 및 구조)·3번(타이포·정렬·여백·간격)을 판정할 때 예외: "(특약)" 같은 부가조건 표기, 법적고지·심의 문구, 지급조건·면책사항 안내 같은 필수 고지성 텍스트는 메인 카피와 다른 기준으로 보세요. 이런 텍스트는 원래 크게 강조하지 않고 작게, 카피 끝이나 화면 구석에 붙여서 시각적으로 눈에 덜 띄게 처리하는 게 업계 관행입니다 — 광고주가 꼭 넣어야 해서 넣는 것이지 강조하고 싶어서 넣는 게 아니기 때문입니다. 그러니 이런 텍스트가 메인 카피처럼 가운데 정렬되어 있지 않거나, 헤드라인 시선 동선 밖에 작게 붙어 있다고 해서 정렬 오류나 위계 문제로 판정하지 마세요. 완전히 안 보이거나 잘려나가지 않는 이상, 작게·구석에·낮은 비중으로 배치된 것 자체는 정상입니다.

3번(타이포·정렬·여백·간격)을 판정할 때, CTA 버튼처럼 도형(배경) 안에 텍스트가 들어간 요소가 있다면 그 텍스트가 버튼 도형 안에서 좌우·상하로 치우침 없이 고르게 배치되어 있는지도 확인하세요. 이건 OCR 좌표로 판단할 수 없는 부분입니다 — OCR은 텍스트 자체의 좌표만 주고 버튼 도형의 테두리 좌표는 주지 않으니, 이미지를 직접 보고 텍스트가 버튼 안에서 한쪽으로 쏠려 보이는지 시각적으로 판단하세요. 뚜렷하게 치우쳐 보이면 needsfix 이상으로 판정하고, note에 "CTA 텍스트가 버튼 안에서 왼쪽/오른쪽/위/아래로 치우침"처럼 어느 방향으로 치우쳤는지 적으세요. 육안으로 봤을 때 고르게 배치되어 있다면 지적하지 마세요.

9번(CTA 및 전환)을 판정할 때, 이미지 안에 명시적인 CTA 문구·버튼이 없다고 해서 곧바로 문제로 단정하지 마세요 — 메타(Meta)처럼 광고 플랫폼이 소재 이미지와 별도로 CTA 버튼을 자동으로 붙여주는 매체가 많아서, 크리에이티브 안에 CTA를 직접 그려 넣지 않는 것도 정상적인 활용 방식입니다. 이미지 안에 CTA가 아예 없으면 reject로 판정하지 말고, "있으면 더 좋았을 것 같다"는 정도의 참고 제안으로 note에 남기면서 needsfix 이하로 낮춰 판정하세요(예: "이미지 안에 행동 유도 문구를 추가하면 전환에 도움이 될 수 있습니다"). CTA가 이미지 안에 있는데 텍스트에 묻히거나 버튼이 잘 안 보이는 경우에만 명확한 문제로 판정하세요.

CTA가 이미지 안에 있는 경우, 화살표(>, >>, → 등)가 함께 쓰였는지 확인하세요. 화살표는 "다음 행동으로 넘어간다"는 느낌을 가장 쉽게 주는 장치라, CTA 문구 끝에 화살표가 없다면 문제로 지적하지는 말고 note에 참고 제안으로 가볍게 덧붙이세요(예: "CTA 끝에 '>' 화살표를 추가하면 행동 유도가 더 명확해질 수 있습니다"). 이미 화살표가 있거나 CTA 자체가 없는 경우에는 이 제안을 하지 마세요.

12번(워터마크·서명 흔적)을 판정할 때 중요한 예외: "AI로 생성된 이미지입니다", "AI로 생성된 제작물", "Made with AI", "AI-generated", "* AI 생성" 등 AI 생성 사실을 알리는 고지 문구(한글·영문 표현 모두 포함)는 12번이 잡으려는 "결함"이 아닙니다 — 오히려 의도적으로 넣은 필수 고지 문구입니다. 이런 문구가 이미지 구석에 작게 적혀 있다고 해서 12번을 reject나 needsfix로 판정하지 마세요. 12번은 원래 목적대로, 광고주가 의도하지 않은 스톡 이미지 사이트의 워터마크(예: Shutterstock, Getty Images 로고)나 생성 도구가 실수로 남긴 서명·로고(예: 의도치 않게 찍힌 "Midjourney" 같은 텍스트)가 남아있는지만 확인하세요.

16번(로고 사용 규정)을 판정할 때, 이미지 전체를 꼼꼼히 살펴 브랜드 로고나 워드마크가 어디에도 없다면 na로 넘어가지 말고 reject로 판정하세요 — note에 "로고가 보이지 않음 — 브랜드 로고 누락 여부 확인 필요"라고 남기세요. 로고가 있는데 여백·변형 등에 문제가 없다면 pass로 판정하세요.

16번의 "최소 여백" 판단에는 정해진 px 기준이 없습니다 — 로고가 다른 요소(텍스트·다른 그래픽·이미지 가장자리)와 부자연스럽게 겹치거나 바짝 붙어 보이지는 않는지, 반대로 너무 작거나 크게 배치돼 어색해 보이지는 않는지를 순전히 육안으로만 판단하세요. 특정 px 수치를 근거로 들지 마세요 — "N px 미달" 같은 표현은 쓰지 말고, 여백이 부자연스러우면 note에 "로고가 OO 요소와 너무 가깝게 배치됨"처럼 구체적으로 어디가 어떻게 부자연스러운지 서술하세요. (참고: 3번의 "캔버스 기준 중앙정렬" 규칙에 나오는 10px 기준은 로고가 캔버스 좌우 중앙에서 벗어났는지를 재는 별개의 정렬 판정이니, 16번의 여백 판정과 혼동하지 마세요.)

5번(컬러 일관성)을 판정할 때는 다음을 확인하세요 — 이 항목은 배경/텍스트/제품 등 이미지 전체의 색상 팔레트가 브랜드·톤에 맞는지를 보는 것이고, 텍스트 자체의 가독성 대비는 3번(타이포·정렬·여백·간격) 소관이니 여기서는 다루지 마세요:
1) 요소 구분: 색상 문제를 지적할 때는 반드시 ① 배경/전체 톤, ② 텍스트(폰트) 컬러, ③ 제품·이미지 요소 컬러 중 어디에 해당하는지 note에 명시하세요. "색이 안 어울린다"처럼 뭉뚱그리지 말고 "헤드라인 텍스트 색상이 배경과 유사해 구분이 어렵다"처럼 위치를 구체적으로 적으세요.
2) 브랜드 컬러 예외: 브랜드 컬러 가이드가 제공된 경우 원칙적으로 그 기준을 따르되, 이미지에서 여름(바다·해변 등 파란 계열), 크리스마스·연말(레드·그린·골드 계열)처럼 명확한 시즌·테마 컨셉이 드러난다면 브랜드 컬러와 다른 계열을 쓴 것을 미준수로 단정하지 말고, 시즌 컨셉과 잘 어울리는 배색인지로 판단하세요.
3) 색상 조합 제안: 지금 배색이 눈에 잘 띄지 않거나 개선 여지가 있다고 판단되면, 아래 참고 배색 중 배너 톤에 맞는 조합을 구체적으로 언급하며 제안하세요. 다만 "이렇게 바꾸세요"처럼 단정하지 말고 "이런 계열도 고려해볼 만하다"는 참고용 제안으로 표현하세요 — 최종 색상 선택은 디자이너의 몫입니다. 브랜드 컬러가 지정된 시안이라면 그 브랜드 컬러 범위 안에서만 제안하세요.

[참고 배색 — 컬러 가이드 페이지에 정리된 조합, RGB 값]
- 눈에 잘 띄는 조합: 옐로우×블랙(rgb(255,212,0)·rgb(17,17,17)), 레드×화이트(rgb(230,57,70)·rgb(255,255,255)), 네온그린×블랙(rgb(180,255,57)·rgb(13,13,13)), 핫핑크×퍼플(rgb(255,62,165)·rgb(123,47,247)), 오렌지×딥블루(rgb(255,122,0)·rgb(11,37,69)), 민트×네이비(rgb(0,217,163)·rgb(10,31,68)), 코랄×틸(rgb(255,107,107)·rgb(26,83,92)), 라임×퍼플(rgb(198,255,0)·rgb(74,20,140)), 골드×블랙(rgb(255,195,0)·rgb(0,0,0)), 스카이블루×화이트(rgb(72,202,228)·rgb(255,255,255))
- 시즌·업종별: 여름(rgb(0,119,182)·rgb(255,214,10)), 크리스마스·연말(rgb(179,0,27)·rgb(27,67,50)·rgb(201,162,39)), 설날·신년(rgb(192,57,43)·rgb(241,196,15)), 가을(rgb(217,72,15)·rgb(244,162,97)), 뷰티·코스메틱(rgb(247,202,208)·rgb(200,182,255)), 금융·보험(rgb(10,38,71)·rgb(32,82,149)), 푸드·배달(rgb(214,40,40)·rgb(247,127,0)), IT·테크(rgb(45,45,45)·rgb(0,229,255)), 육아·키즈(rgb(255,181,167)·rgb(168,218,220)), 헬스·피트니스(rgb(6,214,160)·rgb(7,59,76))
- 그라데이션: 선셋(rgb(255,122,0)→rgb(255,62,165)→rgb(123,47,247)), 블루(rgb(11,37,69)→rgb(30,96,145)), 퍼플-핑크(rgb(123,47,247)→rgb(255,62,165)), 그린-틸(rgb(0,78,100)→rgb(0,168,150)), 피치(rgb(255,175,189)→rgb(255,195,160)), 다크테크(rgb(15,32,39)→rgb(32,58,67)→rgb(44,83,100)), 캔디(rgb(255,154,158)→rgb(250,208,196)), 오로라(rgb(0,201,255)→rgb(146,254,157))

15번(텍스트·로고 렌더링)을 판정하기 전에, 반드시 아래 절차를 순서대로 실행하세요:
1) 기본 확인(모든 배너에 항상 적용): 이미지 안의 모든 문자·브랜드 로고·워드마크를 확대해서 보듯 하나씩 훑으며, 의미 없이 깨지거나 뭉개지거나 이상한 글자로 렌더링된 부분이 없는지 확인하세요. 문제가 있으면 note에 어느 텍스트·로고가 어떻게 깨졌는지 구체적으로 적고 needsfix 이상으로 판정하세요. 이 기본 확인은 앱 아이콘 유무와 무관하게 항상 수행하세요.
2) 앱 아이콘 확인(정사각형 둥근 모서리 앱 아이콘이 있는 배너에만 해당): 이미지 안에 정사각형(둥근 모서리) 앱 아이콘이 있다면 몇 개인지, 각각 어떤 서비스인지 나열하세요. 앱 아이콘이 하나도 없다면 이 단계는 그냥 건너뛰고, "앱 아이콘 없음" 같은 문구를 note에 남기지 마세요 — 앱 아이콘 유무는 15번 판정과 무관한 정보입니다.
3) 나열한 아이콘 각각에 대해, 아래 목록에 해당하는 서비스가 있는지 확인하고, 있다면 그 아이콘의 실제 배경색을 아래 정답과 비교하세요:
- 넷플릭스(Netflix): 검정 배경 + 빨간 N 로고
- 디즈니+(Disney+): 청록색/틸(teal) 계열 배경 — 2024년 리브랜딩 이후 기존의 남색·블루가 아니라 초록빛이 도는 청록색이 정답입니다. 파란색으로만 나왔다면 오히려 구버전 색상이니 확인이 필요합니다.
- 티빙(TVING): 빨간색 계열 배경
- 웨이브(wavve): 파란색 계열 배경
- 쿠팡플레이(Coupang Play): 파란색 계열 배경, 흰색 재생 아이콘
4) 나열한 아이콘 전부에 대해 3)을 빠짐없이 반복하세요 — 하나에서 오류를 찾았다고 나머지 아이콘 확인을 멈추지 마세요. 여러 아이콘에서 동시에 색상 오류가 발견되는 경우가 실제로 자주 있습니다.
5) 배경색이 위 정답과 명확히 다르면(예: 넷플릭스가 빨간 배경, 디즈니+가 순수 블루나 보라색 등) 15번을 최소 검토필요로 판정하세요. 오류가 발견된 아이콘이 여러 개면 메모에 전부 짧게 나열하세요 (예: "넷플릭스·디즈니+ 배경색 오류"). 하나만 골라서 적지 마세요.
5) 목록에 없는 서비스 아이콘은 추측해서 판정하지 말고 넘어가세요.

10·11·13번(AI 생성 아티팩트)을 판정하기 전에도 인상만 보고 넘어가지 말고 아래 절차를 실행하세요:
1) 이미지 안에 있는 사람·동물·차량·제품 등 개별 피사체와, 물방울·연기·빛번짐 같은 질감 효과를 모두 나열하세요. 그중 이미지에서 가장 크고 중심에 있는 주요 인물·피사체가 무엇인지 먼저 표시하세요 — 작은 소품 확인에 집중하다가 정작 가장 눈에 띄는 메인 피사체를 놓치는 경우가 있으니, 메인 피사체는 절대 빠뜨리지 말고 확인하세요.
2) 나열한 것 각각을 확대해서 보듯 뜯어보며 확인하세요 — 인물이면 얼굴(눈·코·입 위치와 비율이 좌우로 부자연스럽게 뒤틀리지 않았는지, 표정과 이목구비가 물리적으로 말이 되는지)과 신체 비율뿐 아니라 옷·손·소품까지 물리적으로 자연스러운지, 차량·사물이면 경계선과 비율이 뭉개지지 않았는지, 배경이면 패턴이 부자연스럽게 반복되지 않는지.
3) 하나라도 부자연스러운 지점을 발견하면 해당 항목을 최소 needsfix로 판정하고, note에 정확히 어느 피사체의 어느 부분이 문제인지 짚으세요 (예: "우측 차량 뒷유리~트렁크 경계가 뭉개짐", "치마 포켓 주름이 비물리적으로 뭉침").

7번(피사체 보정)과 10번(신체 비율 왜곡)은 서로 다른 문제를 봅니다 — 같은 부자연스러운 부분이라도 아래 기준으로 구분해서 하나의 항목에만 명확히 배정하세요, 두 항목에 같은 내용을 중복해서 적지 마세요:
- 7번은 "질감·보정 품질" 문제입니다: 피부·재질이 과도하게 매끈하거나 플라스틱처럼 보이는 등, 형태 자체는 정상인데 표면 텍스처만 부자연스러운 경우.
- 10번은 "형태·비율" 문제입니다: 손가락 개수·팔다리 길이·얼굴 이목구비 위치처럼 구조 자체가 물리적으로 말이 안 되는 경우.
같은 부분에서 질감 문제와 형태 문제가 동시에 보이면(예: 손 모양도 뒤틀리고 질감도 부자연스러움) 각각 7번과 10번에 따로 적으세요.

각 항목에 10단어 이내 한국어 메모를 작성하세요.
전체 요약은 15단어 이내로 작성하세요.

1번(전략 적합성)을 판정하기 전에, "산만해 보이나?" 같은 인상만으로 판단하지 말고 반드시 아래 절차를 실행하세요:
1) 이미지 안의 모든 문구(헤드라인·서브카피·뱃지·CTA·부가 문구 등)를 나열하고, 각각이 전달하는 메시지를 한 단어로 요약하세요.
2) 나열한 메시지들이 하나의 핵심 오퍼·방향을 뒷받침하는지, 아니면 서로 다른 방향의 오퍼·캠페인이 동시에 경쟁하고 있는지 확인하세요. 이 둘을 구분하세요:
- 문제 없음: 할인율·가격·기간·사은품처럼 여러 개의 혜택 포인트가 강조되어 있어도, 그게 전부 "이 상품을 지금 사라" 같은 하나의 오퍼를 뒷받침하는 근거라면 핵심 메시지는 여전히 1개입니다. 퍼포먼스 배너에서 혜택 포인트가 여러 개 강조되는 것은 정상이니 개수만으로 문제 삼지 마세요.
- 문제 있음: "반값 할인"과 "신제품 출시"와 "이벤트 참여"처럼 서로 다른 목적·방향의 캠페인이 한 배너에 동시에 크게 들어가 서로 주목을 다투는 경우만 메시지 분산으로 보세요.
3) 서로 다른 방향의 오퍼·캠페인이 동시에 경쟁하고 있으면 1번을 최소 needsfix로 판정하고, note에 어떤 메시지들이 충돌하는지 구체적으로 적으세요. 혜택 포인트가 여러 개여도 하나의 오퍼로 수렴하면 pass를 주세요.`;

const NO_COMPARISON_INSTRUCTION = `\n\n비교할 참고 배너는 제공되지 않았습니다. comparison 필드는 반드시 null로 응답하세요.`;

function comparisonInstruction(advertiserName) {
  return `\n\n비교 안내: 이 요청에는 텍스트 뒤에 "${advertiserName}"의 성과가 좋았던 참고 배너 이미지들이 먼저 포함되고, 그 다음 새로 평가할 시안 이미지가 포함됩니다. 새 시안을 참고 배너들과 비교해서 comparison 필드를 자연스러운 구어체 한국어로, 근거를 들어가며 채우세요.

참고 배너는 5~10장 내외로 표본이 많지 않습니다. 그러니 참고 배너에 없던 시도를 곧바로 "부족한 점"이나 "잘못된 점"으로 단정하지 마세요 — 참고 배너와 다른 부분은 어디까지나 "다른 점"으로만 서술하고, 그게 브랜드 컬러·아이덴티티에서 확실히 벗어난 경우(예: 브랜드 컬러가 아예 안 쓰였다, 로고가 참고 배너들과 다른 버전이다)에만 우려로 짚어주세요. 새로운 시도 자체는 좋고 나쁨을 판단하지 말고 담담하게 "이런 점이 다르다"고만 전달하세요.

비교 시 가장 먼저, 가장 비중 있게 확인할 것은 브랜드 컬러(참고 배너들에서 반복적으로 쓰인 주요 색상·톤)와 브랜드 아이덴티티(로고 사용 방식, 서체 느낌, 톤앤매너, 무드)가 새 시안에서 일관되게 유지되었는지입니다. 이 두 가지를 반드시 언급한 뒤, 레이아웃 구조, 카피 톤앤매너, CTA 방식 등 나머지 요소는 보조적으로 짚어주세요 (예: "브랜드 컬러인 핑크·블루 톤은 잘 지켜졌고, 참고 배너들과 달리 로고 위치를 하단으로 옮긴 점이 다른데 이건 새로운 시도로 보인다" 같은 어투).
- similarities: 브랜드 컬러·아이덴티티를 중심으로, 참고 배너들과 비슷한 점과 그렇게 판단한 근거를 2~3문장, 50~70단어 정도로 설명
- gaps: 브랜드 컬러·아이덴티티를 중심으로, 참고 배너와 다른 점과 그 이유를 2~3문장, 50~70단어 정도로 설명 (표본이 적으니 "부족하다"는 단정 대신 "다르다"는 사실 위주로. 브랜드 컬러·아이덴티티에서 명확히 벗어난 경우에만 보완 방향을 짧게 덧붙이세요)`;
}

function brandGuidelineInstruction(advertiserName, guideline) {
  return `\n\n${guideline}\n\n(참고: 위 가이드는 "${advertiserName}" 브랜드 전용입니다. 다른 브랜드 시안에는 적용하지 마세요 — 이 요청은 ${advertiserName} 시안이므로 그대로 적용합니다.)`;
}

function brandGuideReviewInstruction(advertiserName) {
  return `\n\n추가로 brandGuideReview 필드를 자연스러운 구어체 한국어로 채우세요 — 위에서 안내된 "${advertiserName}" 브랜드 가이드에 적힌 구체적인 기준(로고 규정, 컬러, 톤앤매너 등)에 이 시안이 얼마나 부합하는지 요약합니다. 참고 배너 이미지와의 시각적 비교(comparison 필드)와는 별개로, 브랜드 가이드 문서에 명시된 기준 자체의 충족 여부를 봅니다.
- satisfied: 브랜드 가이드 기준을 충족하는 부분과 근거를 2~3문장(40~60단어)으로 설명
- differs: 브랜드 가이드 기준과 다르거나 위반하는 부분과 그 이유를 2~3문장(40~60단어)으로 설명. 구체적으로 어느 기준이 어떻게 다른지 짚으세요. 위반 사항이 없다면 "브랜드 가이드 기준에서 벗어난 부분이 없습니다"라고만 답하세요.
- needsCheck: 이미지만으로는 판단이 애매하거나 추가 확인이 필요한 부분을 1~2문장(20~40단어)으로 설명. 없다면 "—"로 답하세요.`;
}

function mediaGuidelineInstruction(mediaGuides, hasSize) {
  const names = mediaGuides.map((m) => m.name).join(', ');
  const withGuideline = mediaGuides.filter((m) => m.guideline && m.guideline.trim());
  const withoutGuideline = mediaGuides.filter((m) => !(m.guideline && m.guideline.trim()));
  const sizeLine = hasSize
    ? `\n\n위에서 안내한 정확한 이미지 크기를 참고하세요. 아래 매체 기준에 사이즈별로 다른 규칙(예: 300x250, 728x90 등 배너 규격별 규칙)이 있다면, 그 크기와 일치하거나 가장 가까운 규격의 규칙만 찾아서 적용하세요. 정확히 일치하는 규격이 없다면 가장 유사한 비율의 규칙을 참고하되, needsCheck에 "정확히 일치하는 사이즈 규정을 찾지 못해 가장 유사한 사이즈 기준으로 참고했다"고 남기세요.`
    : '';

  let text = `\n\n매체 가이드 안내: 이 시안은 다음 매체에 게재될 예정입니다: ${names}. 14번(매체 최적화) 항목을 판정할 때 아래 각 매체 기준을 모두 반영하세요.${sizeLine}

아래 4가지를 우선순위로 확인하세요 — 이 중 1~3번(사이즈·용량·여백)이 특히 중요하니 가장 먼저, 가장 엄격하게 확인하세요:
1. 사이즈: 매체가 요구하는 정확한 규격(가로x세로)과 일치하는지
2. 용량: 매체 기준에 파일 용량 제한이 명시돼 있다면, 위 이미지 크기 정보에 안내된 정확한 원본 파일 용량과 비교해서 초과 여부를 판정하세요. 파일 용량 정보가 안내되지 않았거나 매체 기준에 용량 제한이 없다면 이 항목은 판단하지 말고 넘어가세요 (추측 금지)
3. 텍스트 여백(안전노출영역/세이프존): 텍스트·로고·CTA가 매체 UI 요소와 겹칠 수 있는 여백 구간을 침범하지 않는지
4. 버튼·광고표시 영역: 매체 시스템이 CTA 버튼이나 "광고"/"Ad" 표시, 계정명·아이콘 등을 소재 위에 자동으로 얹는 경우(매체 기준에 그런 안내가 있다면), 이미지 안에 그와 중복·혼동되는 버튼이나 문구를 넣지 않았는지, 그 자동 생성 영역과 겹치는 자리에 로고·핵심 카피 같은 중요한 정보를 배치하지 않았는지

추가로 mediaGuideReview 필드를 자연스러운 구어체 한국어로 채우세요. 매체가 2개 이상 선택된 경우, 어떤 내용이 어느 매체 기준인지 매체 이름을 언급하며 구분해서 설명하세요.
- satisfied: 시안이 매체 기준을 충족하는 부분과 그 근거를 2~3문장(40~60단어)으로 설명 (예: "메타(1080x1920) 기준으로는 로고가 세이프존 안에 잘 들어와 있다")
- differs: 시안이 매체 기준과 다르거나 위반하는 부분과 그 이유를 2~3문장(40~60단어)으로 설명. 구체적으로 어느 영역이 어떻게 다른지 짚으세요
- needsCheck: 이미지만으로는 판단이 애매하거나, 실제 게재 시 추가로 확인이 필요한 부분을 1~2문장(20~40단어)으로 설명 (예: "실제 업로드 시 자동 크롭 여부는 이미지만으로 확인이 어려우니 매체 관리자 화면에서 재확인 필요")

아래 매체 기준에 세이프존 비율·여백 등 공간적 위치 기준이 포함되어 있다면, 이는 이미지의 정확한 픽셀 측정이 아니라 대략적인 위치 판단이라는 점을 감안하세요. 요소가 기준 경계를 명확하고 크게 벗어난 경우에만 위반(검토필요 이상)으로 판정하고, 경계에 살짝 걸치거나 침범 정도를 이미지만으로 확신하기 어려운 경우에는 반려로 단정하지 말고 needsCheck로 돌리세요. 애매한 경우 과도하게 반려로 판정하지 마세요.`;

  for (const m of withGuideline) {
    text += `\n\n[${m.name} 소재 등록 기준]\n${m.guideline.replace(/^-!\s*/gm, '- ')}`;
  }

  if (withoutGuideline.length > 0) {
    const namesWithout = withoutGuideline.map((m) => m.name).join(', ');
    text += `\n\n다음 매체는 아직 구체적인 소재 등록 기준이 등록되지 않았습니다: ${namesWithout}. 이 매체들에 대해서는 14번 항목을 일반적인 세이프존·가독성 기준으로만 평가하고(크롭 위험은 임의로 언급하지 마세요), needsCheck에 "${namesWithout}는 전용 가이드가 아직 없어 일반 기준으로 평가했다"는 점을 포함하세요.`;
  }

  return text;
}

// Reference banner images are stored in Vercel Blob Storage (see
// _referenceBanners.js) as URLs, not inline base64. Gemini's inlineData
// needs raw base64, so fetch each one and encode it at request time.
async function fetchAsBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`참고 배너 이미지를 불러오지 못했습니다 (${resp.status}): ${url}`);
  }
  const buf = await resp.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
  return Math.round(bytes / 1024) + 'KB';
}

function imageSizeInstruction(width, height, fileSizeBytes) {
  const sizeLabel = formatFileSize(fileSizeBytes);
  const capacityLine = sizeLabel
    ? ` 원본 파일 용량은 정확히 ${sizeLabel}입니다(업로드된 파일에서 직접 측정한 값).`
    : '';
  return `\n\n이미지 크기 정보: 업로드된 이미지의 실제 원본 크기는 정확히 ${width} x ${height}px입니다.${capacityLine} 이는 프로그램이 파일에서 직접 측정한 정확한 값이니, 이미지를 보고 크기나 용량을 다시 추측하지 말고 이 값을 그대로 사용하세요. 14번(매체 최적화) 항목과 매체 가이드 판정 시 이 정확한 크기·용량을 기준으로 삼으세요.`;
}

function briefAlignmentInstruction(direction) {
  return `\n\n기획안 부합도 안내: 이 시안은 아래 기획 방향을 바탕으로 제작되었습니다.
- 핵심 방향: ${direction.coreDirection || '명시되지 않음'}
- 제작 방향 제안: ${direction.creativeDirection || '명시되지 않음'}

위 기획 방향에 비추어 이 시안이 얼마나 부합하는지 판단해서 briefAlignment 필드를 채우세요.
- verdict: 전체적으로 기획 의도에 "aligned"(잘 부합), "partial"(부분적으로 부합, 일부 아쉬움), "misaligned"(기획 의도에서 벗어남) 중 하나
- summary: 판정 이유를 1문장으로 요약
- matches: 기획 방향과 부합하는 부분과 근거를 2~3문장으로
- gaps: 기획 방향에서 벗어나거나 필수 요소가 누락된 부분을 2~3문장으로. 문제 없다면 "기획 의도에서 벗어난 부분이 없습니다"라고만 답하세요.`;
}

// contrastFacts: [{ text, ratio }, ...] — 클라이언트가 브라우저 캔버스에서
// OCR 텍스트 영역의 실제 픽셀을 읽어 Otsu 이진화로 글자/배경을 분리한 뒤
// WCAG 명도 대비 공식으로 계산한 값. 서버는 이 숫자를 그대로 프롬프트에
// "사실"로 주입만 하고, 계산 자체는 하지 않는다(이미지 디코딩 라이브러리가
// 없어도 되도록 클라이언트에서 처리).
function formatContrastForPrompt(contrastFacts) {
  const lines = contrastFacts.map((f) => {
    const flag = Number.isFinite(f.ratio) && f.ratio < 4.5 ? ' — WCAG AA 기준(4.5:1) 미달' : '';
    return `"${f.text}" — 추정 명도 대비 약 ${f.ratio}:1${flag}`;
  });
  return `\n\n브라우저에서 직접 측정한 텍스트별 명도 대비 (텍스트 영역 안의 밝기 분포를 이진화해서 계산한 근사치입니다 — 정확한 픽셀 단위는 아니지만 시각적 추측보다 신뢰할 수 있습니다):
${lines.join('\n')}

3번(타이포·정렬·여백·간격)의 텍스트-배경 대비를 판정할 때 이 수치를 참고하세요. 4.5:1 미만이면 WCAG 기준상 가독성이 부족한 것으로 보고, 특히 3:1 미만처럼 명확히 낮은 값은 needsfix 이상으로 판정하세요. 다만 이 수치는 근사치이니 애매한 값(3.5~4.5 사이 등)이면 실제로 눈으로 봤을 때도 읽기 불편한지 시각적으로 한 번 더 확인해서 판단하세요.

이 수치를 근거로 지적할 때는 note에 "묻힘"·"안 보임"처럼 육안으로 봐도 명백히 안 보인다는 식으로 쓰지 마세요 — 실제로는 눈에 잘 보이는데 측정치만 기준 미달인 경우도 많습니다(그라데이션 배경처럼 측정이 어려운 경우 특히 그렇습니다). 대신 "WCAG 기준으로 봤을 때 대비가 OO:1로 기준(4.5:1) 미달"처럼, 이게 접근성 기술 기준상의 미달이라는 걸 명확히 밝히는 식으로 표현하세요.`;
}

function schemaInstruction(hasComparison, hasMediaGuides, hasBrief, hasGuideline) {
  const comparisonSchema = hasComparison ? `{"similarities":"...","gaps":"..."}` : `null`;
  const mediaGuideSchema = hasMediaGuides ? `{"satisfied":"...","differs":"...","needsCheck":"..."}` : `null`;
  const briefSchema = hasBrief ? `{"verdict":"aligned","summary":"...","matches":"...","gaps":"..."}` : `null`;
  const brandGuideSchema = hasGuideline ? `{"satisfied":"...","differs":"...","needsCheck":"..."}` : `null`;
  return `\n\n반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요:
{"textTranscript":"...","items":[{"id":1,"status":"pass","note":"..."}],"summary":"...","comparison":${comparisonSchema},"brandGuideReview":${brandGuideSchema},"mediaGuideReview":${mediaGuideSchema},"briefAlignment":${briefSchema}}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { base64, mediaType, advertiserId, mediaGuideIds, imageWidth, imageHeight, briefImages, fileSizeBytes, analyzedWidth, analyzedHeight, ocrOnly, precomputedOcrFields, contrastFacts } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }

  // 클라이언트가 3번(타이포·정렬·여백·간격)의 명도 대비를 직접 계산하려면 먼저 OCR
  // 텍스트 위치를 알아야 하는데, GPT 호출 없이 OCR 결과만 빠르게 돌려주는
  // 경량 모드. 새 서버리스 함수를 만들지 않고 기존 엔드포인트에 분기만 추가.
  if (ocrOnly) {
    const fields = await runOcr(base64, mediaType);
    res.status(200).json({ ocrFields: fields || [] });
    return;
  }

  const advertiser = advertiserId ? await getAdvertiser(advertiserId) : null;
  const refImages = advertiser && Array.isArray(advertiser.images) ? advertiser.images : [];
  const hasComparison = refImages.length > 0;

  // Brand guideline text is now live/editable (see _brandGuideStore.js),
  // not a static field on ADVERTISERS — fetch it fresh for this request.
  const brandGuidelineText = advertiser ? (await getBrandGuideState(advertiserId)).composedGuideline : '';
  const hasGuideline = !!brandGuidelineText;

  const selectedMediaGuides = Array.isArray(mediaGuideIds)
    ? mediaGuideIds.map((id) => MEDIA_GUIDES[id]).filter(Boolean)
    : [];
  const hasMediaGuides = selectedMediaGuides.length > 0;

  const hasSize = Number.isFinite(imageWidth) && Number.isFinite(imageHeight) && imageWidth > 0 && imageHeight > 0;

  // 3번(타이포·정렬·여백·간격) 판정용 정밀 좌표 — 텍스트 분석/기획안 추출과 동시에
  // 병렬로 실행해서 대기 시간을 늘리지 않음. CLOVA_OCR_* 환경변수가 없거나
  // 실패해도 null만 반환하고 아래 로직은 그대로 AI 시각 판단으로 넘어감.
  // 클라이언트가 명도 대비 계산을 위해 이미 ocrOnly 모드로 OCR을 한 번
  // 호출했다면 그 결과를 그대로 재사용하고, CLOVA OCR을 두 번 호출하지 않음.
  const ocrPromise = Array.isArray(precomputedOcrFields) ? Promise.resolve(precomputedOcrFields) : runOcr(base64, mediaType);

  let briefDirection = null;
  let briefError = null;
  if (Array.isArray(briefImages) && briefImages.length > 0) {
    try {
      const brandContext = hasGuideline ? { name: advertiser.name, guideline: brandGuidelineText } : null;
      briefDirection = await extractBriefDirection(briefImages, apiKey, brandContext);
    } catch (err) {
      briefError = '기획안 분석에 실패해 부합도 판정 없이 진행했습니다: ' + (err && err.message ? err.message : '알 수 없는 오류');
    }
  }
  const hasBrief = !!briefDirection;

  const ocrFields = await ocrPromise;
  // 클라이언트가 업로드 전 이미지를 리사이즈해서 보내기 때문에(긴 변 최대
  // 1280px), OCR이 실제로 측정하는 이미지 크기(analyzedWidth/Height)와
  // 원본 크기(imageWidth/Height)가 다를 수 있음 — 이 배율을 곱해서 OCR
  // 좌표를 원본 기준 픽셀로 환산하지 않으면, 세이프존 px 기준(원본 기준으로
  // 계산된 값)과 직접 비교했을 때 틀린 값이 나옴.
  const hasAnalyzedSize = Number.isFinite(analyzedWidth) && Number.isFinite(analyzedHeight) && analyzedWidth > 0 && analyzedHeight > 0;
  const scaleX = (hasSize && hasAnalyzedSize) ? imageWidth / analyzedWidth : 1;
  const scaleY = (hasSize && hasAnalyzedSize) ? imageHeight / analyzedHeight : 1;
  const ocrInstruction = ocrFields ? formatOcrForPrompt(ocrFields, scaleX, scaleY) : '';
  const contrastInstruction = Array.isArray(contrastFacts) && contrastFacts.length ? formatContrastForPrompt(contrastFacts) : '';

  const promptText =
    BASE_PROMPT +
    (hasSize ? imageSizeInstruction(imageWidth, imageHeight, fileSizeBytes) : '') +
    (hasComparison ? comparisonInstruction(advertiser.name) : NO_COMPARISON_INSTRUCTION) +
    (hasGuideline ? brandGuidelineInstruction(advertiser.name, brandGuidelineText) : '') +
    (hasGuideline ? brandGuideReviewInstruction(advertiser.name) : '') +
    (hasMediaGuides ? mediaGuidelineInstruction(selectedMediaGuides, hasSize) : '') +
    (hasBrief ? briefAlignmentInstruction(briefDirection) : '') +
    ocrInstruction +
    contrastInstruction +
    schemaInstruction(hasComparison, hasMediaGuides, hasBrief, hasGuideline);

  // 순서가 중요합니다 — comparisonInstruction()에서 이미 "참고 배너가 먼저,
  // 마지막이 새 시안"이라고 안내하므로 images 배열도 그 순서를 그대로 지켜야 함.
  const images = [];
  if (hasComparison) {
    const refImageData = await Promise.all(refImages.map((img) => fetchAsBase64(img.thumbUrl)));
    refImages.forEach((img, i) => {
      images.push({ mediaType: img.mimeType, base64: refImageData[i] });
    });
  }
  images.push({ mediaType, base64 });

  try {
    const parsed = await callOpenAI({
      apiKey,
      promptText,
      images,
      // reasoning 모델은 눈에 보이는 JSON 출력뿐 아니라 내부 reasoning
      // 토큰도 이 예산 안에서 함께 소비되므로, 기존 Gemini 대비 여유를 넉넉히 둠
      // (실제 사용량만큼만 과금되므로 상한을 넉넉히 잡아도 비용은 늘지 않음).
      maxOutputTokens: hasBrief ? 16000 : 12000,
      // 오탈자 확인(4번)이 팀 최우선 기준인데, effort가 낮으면 17개
      // 항목을 동시에 판정하면서 글자 단위 재확인까지 할 여유가 부족해
      // 실제로 오탈자를 놓치는 사례가 확인됨 — 항상 medium 이상.
      reasoningEffort: hasBrief ? 'high' : 'medium',
    });

    if (briefError) parsed.briefError = briefError;
    res.status(200).json(parsed);
  } catch (err) {
    const status = (err && err.status) || 500;
    const body = { error: err && err.message ? err.message : '알 수 없는 서버 오류' };
    if (err && err.raw) body.raw = err.raw;
    res.status(status).json(body);
  }
}
