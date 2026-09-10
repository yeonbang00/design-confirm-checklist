# 이 저장소에서 작업할 때

AdCheck — 광고 배너를 AI가 검수하고, 배너 소재를 만들어주는 사내 도구.
제품 설명은 `README.md`에 있다. 이 파일은 **코드를 고칠 때 알아야 할 것**만 적는다.

---

## 먼저: 저장소를 통째로 읽지 마라

전체가 약 **120만 토큰**이다. 한 번에 읽으면 컨텍스트가 넘친다.
아래 표를 보고 **필요한 덩어리만** 열어라.

| 하려는 일 | 열어야 할 파일 | 크기 |
|---|---|---|
| 배너 생성(시안 6종) | `banner-studio.html`, `assets/banner-studio-preview.js`, `assets/studio-auto-plan.mjs` | ~85KB |
| 시안 6종이 무슨 컷인가 | `assets/studio-auto-plan.mjs` **한 파일만** | 8KB |
| 생성 이미지 프롬프트 | `api/bannerImage.js` **한 파일만** | 8KB |
| 사진 분류·컷 후보 | `api/productPhotos.js` **한 파일만** | 14KB |
| 로고 제거·누끼·딤 | `api/imageText.js`, `assets/studio-logo-scrub.mjs`, `assets/studio-pixels.mjs` | ~14KB |
| 그림 속 숫자 대조 | `assets/studio-text-check.mjs` **한 파일만** | 3KB |
| 상품 링크 파싱 | `api/productScrape.js`, `assets/adcheck-grab.js` | ~24KB |
| 배너 17개 항목 검수 | `api/analyze.js` **한 파일만** | 110KB |
| 검수 화면 | `index.html` **한 파일만** | 173KB |
| 로그인/계정 | `middleware.js` | 30KB |

**절대 통째로 읽지 말 것**
- `api/_referenceLibrary.js` (594KB) — 레퍼런스 이미지 URL 1,954개 목록. 로직 없음
- `assets/**` 의 이미지 파일 (2.7MB)
- `.layout_raw_cache/` (git에 없음)

---

## 이 프로젝트의 특이한 점

**빌드 도구가 없다.** 번들러도 프레임워크도 트랜스파일도 없다.
정적 HTML을 브라우저가 그대로 읽고, `api/*.js`가 Vercel 서버리스 함수로 돈다.
`package.json`은 `@vercel/edge` 하나만 있고 스크립트가 없다. **이건 의도된 것이다** —
빌드 설정을 "추가해주는" 개선은 하지 마라.

그래서 각 HTML 파일 안에 CSS와 JS가 전부 들어 있다. 파일이 큰 이유다.

**데이터베이스가 없다.** 상태는 Vercel Blob Storage에 JSON 파일로 저장한다.
`api/_blobPut.js`가 공용 쓰기 함수다.

**프롬프트가 곧 로직이다.** `api/analyze.js`의 27,000자짜리 프롬프트가 사실상
제품의 본체다. "너무 길다"고 줄이지 마라 — 문장 하나하나가 오탐을 잡느라
붙은 것이고, 왜 붙었는지는 커밋 메시지에 적혀 있다.

---

## 확인하는 법

테스트 프레임워크가 없다. 로컬에 Node.js도 없다(개발자 맥 기준).

```bash
python3 -m http.server 8899        # 저장소 루트에서
# → http://localhost:8899/banner-draft.html
```

정적 페이지는 이걸로 확인된다. **`/api/*`는 로컬에서 안 돈다** — Vercel 함수라서다.
API가 필요한 흐름은 `window.fetch`를 잠깐 가로채 응답을 흉내내서 확인해 왔다.

배포본(`2026-adcheck.vercel.app`)은 로그인 게이트 뒤에 있어 외부에서 열리지 않는다.

**JS 문법 검사**는 브라우저에서 이렇게 했다.
```js
const src = await fetch('/api/foo.js').then(r => r.text());
new Function(src.replace(/^\s*import .*$/gm,'').replace(/^export default /m,'x=').replace(/^export /gm,''));
```

---

## 규칙

**API 키는 서버에만.** 브라우저 코드에 키가 닿으면 안 된다.
`api/*.js` 안에서 `process.env`로만 읽는다. `.env.local`은 절대 커밋하지 않는다.

**커밋 메시지는 한국어로, 무엇을 고쳤는지가 아니라 왜 그랬는지를 쓴다.**
증상 → 원인 → 고친 방법 순서. 측정한 숫자가 있으면 넣는다.
기존 커밋들을 보면 형식을 알 수 있다.

**AI는 검수와 소재까지, 최종 결과물은 디자이너가 만든다.** 이건 팀이 명시적으로
정한 선이다. 새 기능을 제안할 때 이 경계를 넘는지 먼저 보라.
관련 기록은 `roadmap.html`의 "검토했지만 만들지 않기로 한 기능"에 있다.

**숫자는 코드가, 문장은 AI가.** 가격·할인율·좌표·폰트 크기는 코드가 정한다.
AI에게 숫자를 맡기면 지어낸다 — 실제로 신세계 딜 페이지 제목이 "최대 87% OFF"인데
데이터는 128개 전부 20%였다.

---

## 자주 밟는 함정

**`[hidden]` 특이도.** `.foo{display:grid}`는 브라우저 기본 `[hidden]{display:none}`을
특이도로 눌러버린다. `display`를 지정하는 클래스를 JS로 `hidden` 토글할 거면
반드시 `.foo[hidden]{display:none}`을 같이 써라. 이 저장소에서 네 번 밟았다.

**HTML 속성 안의 따옴표.** `style="background-image:url(\"...\")"` 는 속성이 조기에
닫힌다. `url('...')`로 써라.

**쇼핑몰 요청 차단.** 신세계는 Chrome 데스크톱 UA를 403으로 막고, Vercel에서
보낸 요청은 417로 막는다. `api/productScrape.js`가 프로필 사다리로 시도하고,
막히면 북마클릿(`assets/adcheck-grab.js`)으로 사용자 브라우저에서 담아온다.

**생성 프롬프트는 장면부터.** `images/edits`에 "상품을 유지하라"를 길게 앞에 깔고
장면을 뒤에 붙이면 원본이 거의 그대로 돌아온다. 실측 — 같은 원본에 "의자에 앉혀라 /
가까이 당겨라 / 멀리 빼라"를 각각 시켰더니 셋 다 원본과 같은 거리·간판·포즈였다.
순서를 뒤집자(장면 → "원본 장소는 남기지 마라" → 짧은 KEEP) 실제로 바뀌었다.
`api/bannerImage.js`의 `buildPrompt()`가 이 순서를 강제한다.

**"글자를 그리지 마라"는 상품 라벨까지 지운다.** `NO_TEXT`가 "이미지 어디에도
글자를 그리지 마라"였을 때 설화수 병에서 인쇄된 제품명이 통째로 사라져 무지 병이
됐다. 배너에 얹을 카피를 AI가 그리지 못하게 하려던 지시가 상품 정체성까지 날린
것이다. 지금은 "덧씌우는 그래픽 텍스트 금지 / 상품 자체의 인쇄 라벨은 그대로"로
갈라 놨다.

**한글 타이포는 생성된다. 단 두 번에 나눠야 한다(2026-09-10 실측).**
gpt-image-2가 대형 고딕도 스티커풍 둥근 레터링도 음절 구조까지 정확히 그린다.
그런데 "제품 유지 + 새 장면 + 글자"를 한 프롬프트에 넣으면 글자가 통째로 빠지고
원본 사진이 거의 그대로 돌아온다(두 번 시험, 순서를 바꿔도 같음).
장면을 먼저 만들고 그 결과에 글자만 얹는 두 번째 호출로 나누면 된다.
한 장에 생성이 두 번 들어간다(1024 고화질 약 600원).
그림에 박힌 금액·퍼센트는 `assets/studio-text-check.mjs`가 OCR로 다시 읽어 대조한다.

**로고는 프롬프트로 안 지워진다.** "이 워드마크를 지워라"도, 좌표를 문장에 적어
넣어도 세 번 다 그대로 남았다. 픽셀을 먼저 덮어야 사라진다. 서버에 이미지
라이브러리가 없으므로(Sharp·Canvas 불가) `api/imageText.js`가 바이트와 OCR 좌표만
주고, `assets/studio-logo-scrub.mjs`가 브라우저 canvas에서 덮는다.

**Blob CDN 캐시.** 공개 URL은 엣지에 30일 캐시되고 **쿼리스트링은 캐시 키에 들어가지
않는다**. `?ts=` 같은 캐시 무력화는 통하지 않는다. 덮어쓰는 파일은
`api/_blobPut.js`가 쓰기 시점에 `x-cache-control-max-age: 0`을 붙인다.

---

## 지금 상태 (2026-09-10)

**배너 생성은 `banner-studio.html` 한 페이지다.** `banner-draft.html`과
`banner-maker.html`은 삭제됐다.

흐름 — 링크/북마클릿 → 사진 수확 → 사진 분류(`/api/productPhotos`) →
로고 제거(`/api/imageText` + canvas) → 계획(`createPlan`) → 카피(`/api/bannerCopy`)와
이미지(`/api/bannerImage`) 동시 생성 → 이미지만 내려받아 포토샵에서 조판.

시안 6종은 **서로 다른 종류의 컷**이다. 컷 종류는 코드에 없다 — 사진을 본
`/api/productPhotos`가 이 상품으로 찍을 만한 후보 10여 개를 만들고 `createPlan`이
거기서 뽑는다. 코드가 지키는 건 구조뿐이다: 대표컷은 그대로, 상세컷이 있으면
그것도 그대로, 스타일링 세트는 상품 종류별 고정(색상별로 돌리면 한 시리즈가 된다).

조판은 열여덟이다. 카피 **위치**만 다른 것과 판의 **짜임**이 다른 것을 섞는다.
`EMPHASIS`가 조판을 혜택·제품·무드 셋으로 묶고, 배합(혜택 3장이냐 제품 4장이냐)도
매 회차 뽑는다.

**랜덤은 축을 나눠야 랜덤이 된다.** 컷 후보를 문장 하나로 받으면 모델이 비슷한
장면만 쓴다(실측: 후보 12개 중 location 4개). `/api/productPhotos`가 mount·angle·
crop·person·light·mood를 따로 돌려주고, `createPlan`이 같은 mount를 두 번 쓰지 않는
식으로 고른다. 사진 4장·후보 12개로 400회 → 400회 전부 다른 조합.

**아직 실제 서버에서 한 번도 실행되지 않은 코드가 있다.** 로그인 게이트 때문에
개발자가 배포본을 열지 못해서다. 아래는 로컬 정적 서버와 OpenAI 직접 호출까지만
확인됐다 — `/api/productPhotos`와 `/api/imageText`는 배포본에서 첫 실행이다.
