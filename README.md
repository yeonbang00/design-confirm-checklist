# AI 디자인 컨펌 체크리스트 (Gemini 연동 웹앱)

시안 이미지를 올리면 Gemini API가 11개 항목 + AI 아티팩트 부록을 자동으로 판정해주는 웹앱입니다.
팀원 누구나 배포된 URL에 접속해서 자기 이미지를 넣고 바로 검토받을 수 있습니다.

## 왜 이렇게 구성했나요

이미지 분석용 API 키는 절대 브라우저(프론트엔드)에 있으면 안 됩니다. 그래서 이 프로젝트는
`index.html`(프론트엔드)이 우리 서버의 `/api/analyze`만 호출하고, 그 서버 함수(`api/analyze.js`)
안에서만 Gemini API를 진짜 키로 호출하는 구조입니다. 키는 배포 플랫폼의 "환경변수"에만
저장되고, 코드나 브라우저 어디에도 노출되지 않습니다.

```
브라우저 ──POST 이미지──▶ /api/analyze (우리 서버) ──API 키로 호출──▶ Gemini API
```

## 1. Gemini API 키 발급

1. https://aistudio.google.com/apikey 접속 후 구글 계정으로 로그인
2. "Create API key" 클릭 → 키 복사
3. 무료 티어가 있지만(하루 요청 수 제한), 트래픽이 늘면 결제 계정을 연결해야 계속 쓸 수 있어요.
   콘솔에서 사용량과 비용을 주기적으로 확인하세요.

## 2. 로컬에서 테스트 (선택)

```bash
npm install -g vercel
cd design-confirm-checklist
cp .env.example .env     # 그 다음 .env에 실제 키 값 입력
vercel dev
```

브라우저에서 `http://localhost:3000` 접속해 업로드 → 분석 시작이 잘 되는지 확인하세요.

## 3. Vercel로 배포 (가장 쉬운 방법)

**방법 A — 웹 대시보드**
1. https://vercel.com 가입 (GitHub 계정으로 가능)
2. 이 폴더를 GitHub 저장소로 올리기
3. Vercel 대시보드 → "Add New Project" → 방금 만든 저장소 선택
4. "Environment Variables"에 `GEMINI_API_KEY` = 발급받은 키 값 추가
5. Deploy 클릭 → 몇 분 뒤 `https://프로젝트명.vercel.app` 같은 URL 생성됨

**방법 B — CLI**
```bash
cd design-confirm-checklist
vercel
# 프롬프트를 따라 진행한 뒤
vercel env add GEMINI_API_KEY
# 값 입력(Production/Preview/Development 모두 체크 권장)
vercel --prod
```

배포가 끝나면 나온 URL을 팀원들에게 공유하면 됩니다. 별도 로그인 없이 누구나 접속해서 씁니다.

## 4. 다른 호스팅을 쓰고 싶다면

- **Netlify Functions**: `api/analyze.js`를 `netlify/functions/analyze.js`로 옮기고 핸들러 시그니처만 살짝 바꾸면 거의 그대로 동작합니다.
- **Cloudflare Workers / Pages Functions**: `req.body` 파싱 방식이 달라 약간의 코드 수정이 필요합니다.
- **자체 서버(Node/Express)**: `api/analyze.js`의 핸들러 로직을 Express 라우트 하나로 옮기면 됩니다.

어떤 걸 쓰시든 원칙은 같습니다 — **API 키는 서버 환경변수에만, 프론트엔드는 자기 서버만 호출.**

## 비용 / 사용량 참고

- 이미지 한 장 분석 = Gemini API 호출 1회. 프론트엔드에서 업로드 전 이미지를 자동으로
  1280px, JPEG 품질 82%로 축소해서 보내므로 비용과 속도 모두 절약됩니다.
- 사용량이 많아질 것 같으면 Google AI Studio 콘솔에서 예산 알림을 설정해두는 걸 권장합니다.

## 문제 해결

- **"서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다"** → 배포 플랫폼 환경변수 설정을 확인하고, 재배포하세요 (환경변수는 재배포해야 반영되는 경우가 많습니다).
- **분석이 계속 실패함** → 화면에 뜨는 에러 문구를 그대로 확인하세요. Gemini API 자체 오류 메시지가 그대로 노출되도록 만들어져 있어서, 원인(권한/쿼터/이미지 형식 등)을 바로 알 수 있습니다.
- **응답이 비어있음(안전 필터 등)** → 이미지에 따라 Gemini의 안전 필터에 걸릴 수 있습니다. 다른 이미지로 테스트해보세요.

## 파일 구조

```
design-confirm-checklist/
├─ index.html          # 프론트엔드 (체크리스트 UI + 업로드)
├─ api/
│  └─ analyze.js        # 서버 함수 (Gemini API 호출, 키 보관)
├─ package.json
├─ .env.example
└─ README.md
```
