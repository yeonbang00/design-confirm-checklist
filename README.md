# AdCheck (구 디자인 히어로, GPT-5.6 연동 웹앱)

광고 배너 시안을 AI가 자동 검수하고, 브랜드/매체 가이드를 팀이 직접 키워나가면서 관리하는 사내 도구입니다. 정적 HTML + Vercel 서버리스 함수로만 구성돼 있고, 별도 데이터베이스 없이 Vercel Blob Storage에 상태를 저장합니다.

## 구성 페이지

| 페이지 | 설명 |
|---|---|
| `index.html` | 디자인 체크리스트 — 배너 시안을 올리면 18개 항목을 AI가 자동 판정 |
| `brief-helper.html` | 기획안 헬퍼 — 기획안(PPT) 캡처를 올리면 제작 방향 + 비주얼 레퍼런스 추천 |
| `guide.html` | 브랜드 가이드 — 브랜드별 디자인 기준을 팀이 체크리스트로 직접 편집 |
| `media-guide.html` | 매체 가이드 — 매체별 소재 등록 규격 참고 |
| `reference-board.html` | 이미지 레퍼런스 — 업종별 경쟁사·자사 제작 소재 라이브러리 |
| `color-guide.html` | 컬러 가이드 — 눈에 잘 띄는 배색·시즌별 컬러·그라데이션 참고 자료 |
| `history.html` | 히스토리 — 체크리스트 판정 로직 등 실질적인 업데이트 내역 기록 |
| `roadmap.html` | 업데이트 예정 — 사용 중인 기능, 검토했지만 아직/영영 적용 안 한 기능과 이유 |

## 왜 이렇게 구성했나요

이미지 분석용 API 키는 절대 브라우저(프론트엔드)에 있으면 안 됩니다. 그래서 각 페이지는 우리 서버의 `/api/*`만 호출하고, 그 서버 함수 안에서만 OpenAI API를 진짜 키로 호출하는 구조입니다. 키는 배포 플랫폼의 "환경변수"에만 저장되고, 코드나 브라우저 어디에도 노출되지 않습니다.

```
브라우저 ──POST 이미지──▶ /api/analyze (우리 서버) ──API 키로 호출──▶ OpenAI API (GPT-5.6 Sol)
```

정적 자산(이미지, 브랜드 가이드 상태, 히스토리 등)은 Vercel Blob Storage에 저장됩니다 — 별도 데이터베이스가 없습니다.

## 필요한 환경변수 (Vercel 대시보드 → Settings → Environment Variables)

| 이름 | 용도 |
|---|---|
| `OPENAI_API_KEY` | 배너/기획안 분석용 OpenAI API 키 (GPT-5.6 Sol) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage 읽기/쓰기 (Blob Storage를 프로젝트에 연결하면 자동 생성됨) |
| `BRAND_GUIDE_EDIT_PASSWORD` | 브랜드/매체 가이드 저장, 히스토리 삭제 등 편집 작업에 쓰는 팀 공유 비밀번호 |
| `ADMIN_PASSWORD` | `admin.html`(가입 승인 관리 페이지) 접근 비밀번호 — 사이트 로그인과 별개 |
| `CLOVA_OCR_INVOKE_URL` | 3번(타이포·정렬) 픽셀 정밀 측정용 네이버 클로바 OCR Invoke URL — 선택사항, 없으면 OCR 없이 AI 시각 판단만 사용 |
| `CLOVA_OCR_SECRET_KEY` | 위 클로바 OCR 도메인의 Secret Key — 선택사항 |

값 자체는 절대 코드나 채팅에 붙여넣지 말고, Vercel 대시보드에 직접 입력하세요.

## Vercel로 배포

1. https://vercel.com 가입 (GitHub 계정으로 가능)
2. 이 저장소를 Vercel 프로젝트로 연결 ("Add New Project" → 저장소 선택)
3. 프로젝트에 Blob Storage 추가 (Storage 탭 → Create → Blob) → `BLOB_READ_WRITE_TOKEN`이 자동으로 채워짐
4. "Environment Variables"에 위 표의 나머지 값 추가
5. Deploy → 몇 분 뒤 `https://프로젝트명.vercel.app` 같은 URL 생성됨

## 사이트 접근

사이트 전체(페이지+API)는 개별 계정 로그인이 필요합니다 (`middleware.js`).

1. 처음 접속하면 로그인/가입 신청 화면이 뜹니다. "가입 신청" 탭에서 이름·이메일·비밀번호로 신청하면 "승인 대기" 상태가 됩니다.
2. 관리자가 `/admin.html`(`ADMIN_PASSWORD`로 보호됨, GNB에 노출 안 됨)에서 대기 목록을 보고 승인/거절합니다.
3. 승인되면 그 계정으로 로그인 가능 — 통과하면 30일간 쿠키로 기억되어 재입력이 필요 없습니다.
4. 관리자는 이미 승인된 계정도 `/admin.html`에서 "권한 해제"할 수 있고, 해제 즉시 그 계정의 기존 세션도 무효화됩니다.

계정 데이터는 Vercel Blob Storage의 `users.json`에 저장됩니다(비밀번호는 PBKDF2로 해시해서 저장, 평문 저장 안 함).

## 체크리스트 구성

10개 전략·디자인 기본기 + 4개 AI 생성 아티팩트 + 4개 광고주 전달 전 필수 확인(매체 최적화, 텍스트·로고 렌더링, 로고 사용 규정, 법적고지·심의 문구) — 총 18개 항목을 하나의 목록으로 판정합니다. 각 항목은 **통과 / 검토필요 / 반려 / 해당없음** 중 하나로 표시됩니다.

브랜드를 선택하면 그 브랜드의 성과 좋았던 배너들과 비교해서 비슷한 점/다른 점을 함께 보여주고, 매체를 선택하면 매체별 규격 기준으로도 함께 검수합니다.

## 브랜드/매체 가이드 관리

`guide.html`과 `media-guide.html`은 팀이 웹 화면에서 직접 편집합니다 (Claude와의 채팅으로 코드를 고치는 방식이 아닙니다). 편집 저장에는 `BRAND_GUIDE_EDIT_PASSWORD`가 필요합니다. 저장된 내용은 배너를 분석할 때 AI가 참고하는 기준과 그대로 연결됩니다.

이미지 레퍼런스 라이브러리(`reference-board.html`)에 이미지를 대량으로 추가하고 싶을 때는 Claude에게 이미지 폴더 경로를 알려주면 `scripts/` 안의 스크립트로 일괄 업로드해줍니다.

## Vercel Hobby 플랜 제약

Vercel Hobby 플랜은 **서버리스 함수를 정확히 12개까지만** 허용합니다. `api/` 안에서 `_`로 시작하는 파일(예: `_blobPut.js`)은 라우팅되지 않는 헬퍼 모듈이라 이 한도에 안 걸립니다. 새 기능을 추가할 때는 새 엔드포인트 파일을 만들기보다, 기존 엔드포인트에 쿼리 파라미터나 HTTP 메서드 분기를 추가하는 방식(예: `referenceCategories.js`가 `GET`은 카테고리 목록을, `GET ?feed=history`는 히스토리를 반환)을 우선 고려하세요.

## 문제 해결

- **"서버에 OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다"** → Vercel 환경변수 설정을 확인하고 재배포하세요.
- **분석이 계속 실패함** → 화면에 뜨는 에러 문구를 그대로 확인하세요. OpenAI API 자체 오류 메시지가 그대로 노출되도록 만들어져 있어서, 원인(권한/쿼터/이미지 형식 등)을 바로 알 수 있습니다.
- **로그인이 안 됨** → 계정이 아직 "승인 대기" 상태인지 확인하세요 (`/admin.html`에서 승인 필요). 승인된 계정인데도 안 되면 이메일·비밀번호 오타를 먼저 확인하세요.
- **`/admin.html`에서 비밀번호를 넣어도 안 들어가짐** → `ADMIN_PASSWORD` 값이 정확한지, 최근에 값을 바꿨다면 재배포했는지 확인하세요.

## 파일 구조

```
01designclaude/
├─ index.html               # 디자인 체크리스트
├─ brief-helper.html        # 기획안 헬퍼
├─ guide.html                # 브랜드 가이드
├─ media-guide.html          # 매체 가이드
├─ reference-board.html      # 이미지 레퍼런스
├─ color-guide.html           # 컬러 가이드
├─ history.html               # 히스토리
├─ roadmap.html               # 업데이트 예정
├─ admin.html                # 가입 승인 관리 (ADMIN_PASSWORD로 보호, GNB에 노출 안 됨)
├─ middleware.js             # 사이트 전체 접근 게이트 (로그인/가입/관리자 승인 로직 포함)
├─ api/
│  ├─ analyze.js                       # 배너 분석 (체크리스트 + 비교 + 매체가이드 + 기획부합도 + OCR)
│  ├─ analyzeBrief.js                  # 기획안 헬퍼 분석
│  ├─ advertisers.js                   # 광고주(브랜드) 목록 조회/추가/삭제
│  ├─ brandGuides.js                   # 브랜드 가이드 조회
│  ├─ brandGuideChecklistOptions.js    # 브랜드 가이드 체크리스트 항목 정의 조회
│  ├─ saveBrandGuideState.js           # 브랜드 가이드 저장 (비밀번호 필요)
│  ├─ brandImages.js                   # 브랜드 참고 배너 이미지 조회
│  ├─ mediaGuides.js / mediaGuideDetails.js  # 매체 가이드 조회
│  ├─ referenceCategories.js           # 이미지 레퍼런스 카테고리 + 히스토리 조회/삭제
│  ├─ referenceImages.js               # 이미지 레퍼런스 이미지 조회
│  ├─ generateExampleBanner.js         # 기획안 헬퍼의 예시 배너 생성 (gpt-image-2)
│  └─ _*.js                            # 라우팅되지 않는 헬퍼 모듈 (프롬프트, 저장소, 검증 로직, OpenAI/OCR 호출 등)
├─ scripts/                  # 이미지 대량 업로드 등 Claude가 사용하는 유지보수 스크립트
├─ package.json
└─ README.md
```
