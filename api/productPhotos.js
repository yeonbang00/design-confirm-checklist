// POST /api/productPhotos
// Body: { urls: string[], referenceUrls?: string[] }
// Returns: { photos:[...], category, usp, toneKo,
//             cuts:[{name, person, mount, angle, crop, light, mood, scene}] }
//
// 시안 6종을 서로 다른 '컷'으로 만들려면, 가진 사진이 각각 무엇인지 알아야
// 한다. 단품컷을 모델 재촬영에 넣으면 없던 사람이 생기고, 모델컷을 스튜디오
// 단품에 넣으면 사람이 지워진다. 둘 다 광고로 못 쓰는 결과다.
//
// 비율이나 파일명으로는 구분이 안 된다(모델컷도 1:1이고 단품컷도 1:1이다).
// 그래서 사진을 실제로 보고 역할을 붙인다. 호출은 상품당 한 번이다.

import { callOpenAI, OPENAI_MODEL } from './_openaiClient.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const MAX_PHOTOS = 6;
const MAX_REFS = 3;
const ROLES = new Set(['main', 'model', 'packshot', 'flat', 'detail', 'unusable']);

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const PROMPT = `당신은 광고 배너 제작자입니다. 상품 페이지에서 모은 사진들을 보고, 각 사진이 배너에서 어떤 소재로 쓸 수 있는지 분류하세요.

역할(role)은 다음 중 하나입니다.
- "model": 사람이 상품을 착용하거나 사용하고 있는 사진
- "packshot": 사람 없이 상품만 단독으로 찍은 사진 (배경이 단색이거나 스튜디오)
- "flat": 상품을 바닥에 펼쳐 위에서 찍은 사진, 또는 여러 구성품을 늘어놓은 사진
- "detail": 상세 페이지에서 잘라온 사진 — 소재 접사, 부분 확대, 또는 세로로 긴 편집 컷
- "unusable": 배너에 못 쓰는 것 — 정보 고시표, 사이즈 표, 글자가 화면을 채운 이미지, 후기 캡처, 로고만 있는 것

추가로 각 사진에 대해:
- hasPerson: 사람이 보이면 true
- personKind: 사람이 어떻게 보이는지
  "none"  사람이 안 보임
  "hands" 손이나 팔만 보임 (제품을 들고 있거나 바르는 컷)
  "body"  얼굴이나 상반신 이상이 보임 (모델 착용컷)
  손만 나오는 컷을 "body"로 적지 마세요. 이 값으로 모델 재촬영을 할지 정합니다.
- colorway: 상품 색을 한국어 한 단어로 (예: "검정", "크림", "핑크"). 모르면 ""
- burnedText: 사진 위에 덧씌워진 글자나 로고가 있으면 그 글자를 그대로, 없으면 ""
- itemCount: 이 사진에 제품이 몇 개 보이는지 숫자. 기획세트 나열컷이면 그 개수.
- isHero: 이 사진이 **제품 하나만** 크게 보여주는 컷이면 true. 여러 개가 나열돼
  있으면 false. 배너에서 주인공으로 쓸 수 있는지를 가른다.
- isGift: 이 사진이 **증정품·사은품**만 찍은 컷이면 true. 본품이면 false.
  상품명에 "증정" "추가" "사은품"이 있거나 본품보다 작게 취급되는 것.
- note: 이 사진을 배너에 쓸 때 주의할 점 한 문장. 없으면 ""

첫 번째 사진이 대표컷입니다. 그 사진이 model이나 packshot에 해당하더라도 role은 "main"으로 하세요.

## 두 번째 일 — 이 상품으로 찍을 만한 컷 후보 12개 쓰기

이 상품으로 배너 시안을 만듭니다. **서로 확실히 다른 촬영 컷 12개**를 제안하세요.
화장품·식품·신발·티셔츠는 어울리는 장면이 전혀 다릅니다. 사진에 보이는 것과
상품 종류에 맞는 장면만 쓰세요.

- category: fashion-top, fashion-outer, fashion-bottom, shoes, bag, accessory, beauty,
  food, kitchen, home, electronics, kids, sports, pet, other 중 하나
- usp: 이 상품을 사게 만드는 이유 한 문장. 사진과 상품명에서 읽히는 것만.
- toneKo: 이 상품에 맞는 톤앤매너 한국어 한 단어 (예: "정갈한", "발랄한", "고급스러운")

cuts는 12개이고, 각 항목은 **축을 나눠서** 적습니다. 문장 하나에 뭉뚱그리지 마세요.

  name   한국어 짧은 이름 (4~8자). 예 "단상 정면컷", "손에 든 컷"

  mount  상품을 무엇 위에 두나 (13)
         studio(무지 배경) plinth(단상) table(테이블) chair(의자) shelf(선반)
         hanger(옷걸이) floor(바닥) held(손·몸에 들림) floating(공중)
         water(물·액체) fabric(천·종이) mirror(거울·유리) location(실제 공간)

  angle  카메라 각도 (12)
         front(정면) three-quarter(45도 사반신) side(측면 90도) back(후면)
         top-down(직부감 90도) high-45(부감 45도) eye-level(눈높이)
         low(로우앵글) worms-eye(극단 로우, 올려다봄) dutch(기울인 앵글)
         over-shoulder(어깨 너머) close-front(정면 초근접)

  distance 카메라 거리 (5)
         extreme-close(표면만, 형태 안 보임) close(부분 확대)
         medium(상품 전체가 꽉 참) wide(주변까지) very-wide(공간 안의 작은 상품)

  light  빛 (10)
         soft(부드러운 확산광) hard(딱딱한 그림자) back(역광) rim(윤곽광)
         window(창가 자연광) studio-key(스튜디오 키라이트) split(반측광)
         golden(황금시간대) neon(색조명) dappled(나뭇잎 그림자)

  background 배경 처리 (9)
         solid(단색) gradient(그라데이션) seamless(무한배경)
         colour-block(색면 분할) textured(질감 있는 면) paper(종이·그리드)
         blurred-scene(흐린 실제 공간) sharp-scene(선명한 실제 공간) dark(어두운 바닥)

  composition 구도 (9)
         centered(정중앙) thirds(삼분할) diagonal(대각선) symmetric(좌우 대칭)
         grid(격자 반복) space-left(왼쪽 여백) space-right(오른쪽 여백)
         stacked(위아래로 쌓임) overlap(겹쳐 놓기)

  palette 색조 (8)
         warm-neutral cool-neutral monochrome high-contrast
         pastel saturated earth metallic

  motion 움직임 (7)
         static(정지) falling(떨어지는 중) splash(튀는 순간) pour(따르는 중)
         float(떠 있음) wind(바람에 날림) hand-motion(손이 움직이는 중)

  person 사람을 어떻게 쓰나 (4)
         none(사람 없음) hands(손만, 얼굴은 프레임 밖)
         partial(신체 일부만, 얼굴 없음) keep(원본의 그 사람을 그대로 유지)

  pose   person이 none이 아닐 때만. (9)
         standing(서 있음) walking(걷는 중) seated(앉음) leaning(기댐)
         reaching(손을 뻗음) turning(돌아봄) crouching(웅크림)
         back(등을 보임) close-portrait(얼굴 클로즈업)

  mood   clean warm premium playful fresh dramatic serene bold nostalgic minimal

  scene  위 축들을 영어 한 문장(40~70단어)으로 푼 것. 장소·소품·빛·카메라만.

12개를 이렇게 섞으세요.
- **mount는 최소 7가지, angle은 최소 7가지, distance는 최소 4가지가 달라야 합니다.**
  같은 값을 세 번 이상 쓰지 마세요.
- background와 composition도 최소 5가지씩 다르게 하세요.
- motion이 static인 것은 절반까지만. 나머지는 무언가 일어나고 있어야 합니다.
- **사진에 personKind가 "body"인 것이 있을 때만** person을 keep으로 쓸 수 있습니다.
  그때는 keep 3개 이상, hands 1개 이상 넣고 keep끼리 pose가 전부 달라야 합니다.
- **손만 나오거나 사람이 아예 없는 상품이면 keep을 하나도 쓰지 마세요.**
  화장품, 식품, 가전처럼 모델 착용컷이 없는 상품에 "모델이 공원을 걷는" 컷을 만들면
  광고에 못 씁니다. 그런 상품은 hands(손이 제품을 들거나 바르는 컷)로 사람을 씁니다.
- 절반 이상은 눈길이 한 번에 가는 연출이어야 합니다. 예쁜 방에 제품을 올려둔
  정물만 열두 개면 무드보드지 배너 소재가 아닙니다.

scene 문장 규칙:
- 상품의 색이나 모양은 쓰지 마세요. 그건 원본 사진에서 가져옵니다.
- 글자, 로고, 간판, 가격표, 브랜드명을 장면에 넣지 마세요.
- 상품의 형태가 읽혀야 합니다. 구기거나 뭉치거나 던져 놓은 연출은 쓰지 마세요.

## 세 번째 일 — 레퍼런스 배너를 보고 조판을 고르기

사진 뒤에 **이 업종에서 실제로 집행된 배너**가 몇 장 따라옵니다. 상품 사진이 아니라
완성된 광고입니다. 어느 것이 상품 사진이고 어느 것이 레퍼런스인지는 아래 목록에 적혀
있습니다.

레퍼런스를 보고 **화면을 어떻게 나눴는지**를 읽으세요. 카피가 어디에 몇 덩어리로
놓였는지, 사진을 몇 조각으로 썼는지, 색면이나 도형을 어떻게 깔았는지, 숫자를 얼마나
키웠는지. 그리고 아래 조판 이름 중 이 상품에 어울릴 것을 **3개** 고르세요.

  header(위 카피·아래 상품) split(좌 카피·우 사진) split-right(좌 사진·우 카피)
  band(하단 정보 띠) top-center(상단 중앙) top-left(상단 좌측) bottom-right(하단 우측)
  boxed(사진 위 흰 카피 카드) strip(위아래 띠·가운데 사진) corner(전면 사진·구석 카피)
  offer(좌 텍스트 스택·우 색면·숫자 하이라이트) numeral(연출컷 위 숫자 하이라이트)
  arch(아치 사진·숫자 강조) badge(전면 사진·우측 정렬 스택·검정 배지)
  type-diagonal(대형 컬러 타이포 대각선) framed(중앙 정렬·헤어라인·아치)
  duo-panel(좌 연출컷+큰 숫자·우 정보판) price(큰 가격·상단 좌측)

- layoutHints: 고른 조판 이름 3개
- refNote: 레퍼런스에서 읽은 이 업종의 구성 특징 한국어 한 문장

레퍼런스가 없으면 layoutHints는 빈 배열, refNote는 빈 문자열로 두세요.
레퍼런스의 문구나 브랜드명은 절대 가져오지 마세요. 구성만 봅니다.

JSON만 출력하세요:
{"photos":[{"index":0,"role":"main","hasPerson":true,"personKind":"body","colorway":"검정","burnedText":"","itemCount":1,"isHero":true,"isGift":false,"note":""}],
 "category":"fashion-top","usp":"...","toneKo":"정갈한",
 "layoutHints":["boxed","offer","badge"],"refNote":"...",
 "cuts":[{"name":"단상 정면컷","mount":"plinth","angle":"front","distance":"medium",
          "light":"studio-key","background":"seamless","composition":"centered",
          "palette":"warm-neutral","motion":"static","person":"none","pose":"",
          "mood":"clean","scene":"..."}]}`;

// 계획이 아는 조판 이름만 받는다. 모델이 새 이름을 지어내면 못 쓴다.
const LAYOUT_NAMES = new Set(['header', 'split', 'split-right', 'band', 'top-center', 'top-left',
  'bottom-right', 'boxed', 'strip', 'corner', 'offer', 'numeral', 'arch', 'badge',
  'type-diagonal', 'framed', 'duo-panel', 'price']);

const AX = {
  mount: ['studio', 'plinth', 'table', 'chair', 'shelf', 'hanger', 'floor', 'held',
    'floating', 'water', 'fabric', 'mirror', 'location'],
  angle: ['front', 'three-quarter', 'side', 'back', 'top-down', 'high-45', 'eye-level',
    'low', 'worms-eye', 'dutch', 'over-shoulder', 'close-front'],
  distance: ['extreme-close', 'close', 'medium', 'wide', 'very-wide'],
  light: ['soft', 'hard', 'back', 'rim', 'window', 'studio-key', 'split', 'golden', 'neon', 'dappled'],
  background: ['solid', 'gradient', 'seamless', 'colour-block', 'textured', 'paper',
    'blurred-scene', 'sharp-scene', 'dark'],
  composition: ['centered', 'thirds', 'diagonal', 'symmetric', 'grid', 'space-left',
    'space-right', 'stacked', 'overlap'],
  palette: ['warm-neutral', 'cool-neutral', 'monochrome', 'high-contrast', 'pastel',
    'saturated', 'earth', 'metallic'],
  motion: ['static', 'falling', 'splash', 'pour', 'float', 'wind', 'hand-motion'],
  person: ['none', 'hands', 'partial', 'keep'],
  pose: ['', 'standing', 'walking', 'seated', 'leaning', 'reaching', 'turning',
    'crouching', 'back', 'close-portrait'],
  mood: ['clean', 'warm', 'premium', 'playful', 'fresh', 'dramatic', 'serene', 'bold',
    'nostalgic', 'minimal'],
};

function cleanCuts(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [], seen = new Set();
  for (const row of raw) {
    const scene = typeof row?.scene === 'string' ? row.scene.trim().replace(/\s+/g, ' ') : '';
    const name = typeof row?.name === 'string' ? row.name.trim().slice(0, 16) : '';
    if (scene.length < 40 || scene.length > 700 || !name) continue;
    if (BANNED.test(scene)) continue;
    // 같은 장면을 이름만 바꿔 두 번 낸 경우를 막는다
    const finger = scene.slice(0, 70).toLowerCase();
    if (seen.has(finger)) continue;
    seen.add(finger);
    const cut = { name, scene };
    // 축은 정해둔 값만 받는다. 모델이 새 단어를 지어내면 계획이 그 값을 못 읽는다.
    for (const [key, list] of Object.entries(AX)) {
      cut[key] = list.includes(row?.[key]) ? row[key] : list[0];
    }
    out.push(cut);
    if (out.length >= 16) break;
  }
  return out;
}

async function fetchImage(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
                  + '(KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
  });
  if (!r.ok) return null;
  const type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\//.test(type)) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  // 8MB 넘는 것은 상세페이지 통짜 이미지다. 분류에 넣으면 요청만 커진다.
  if (!buf.length || buf.length > 8 * 1024 * 1024) return null;
  return { base64: buf.toString('base64'), mediaType: type };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(503).json({ error: 'AI 분류가 설정되지 않았습니다.' }); return; }

  const clean = v => (Array.isArray(v) ? v.filter(u => typeof u === 'string' && /^https?:\/\//.test(u)) : []);
  const urls = clean(req.body?.urls).slice(0, MAX_PHOTOS);
  // 이 업종에서 실제로 집행된 배너. 구성을 읽히려고 함께 보낸다.
  const refs = clean(req.body?.referenceUrls).slice(0, MAX_REFS);
  if (!urls.length) { res.status(400).json({ error: '분류할 사진 주소가 필요합니다.' }); return; }

  try {
    const fetched = await Promise.all(urls.map(u => fetchImage(u).catch(() => null)));
    const images = [], kept = [];
    fetched.forEach((img, i) => { if (img) { images.push(img); kept.push(urls[i]); } });
    if (!images.length) { res.status(502).json({ error: '상품 사진을 받아오지 못했습니다.' }); return; }

    // 레퍼런스는 상품 사진 뒤에 붙인다. 어디부터가 레퍼런스인지 말로 알려준다.
    const refImages = (await Promise.all(refs.map(u => fetchImage(u).catch(() => null)))).filter(Boolean);
    const order = refImages.length
      ? `\n\n[이번에 보내는 이미지 순서] 앞의 ${images.length}장은 상품 사진이고, `
        + `뒤의 ${refImages.length}장은 이 업종에서 실제로 집행된 레퍼런스 배너입니다.`
      : '\n\n[이번에 보내는 이미지 순서] 전부 상품 사진입니다. 레퍼런스 배너는 없습니다.';

    const data = await callOpenAI({
      apiKey, promptText: PROMPT + order, images: [...images, ...refImages],
      maxOutputTokens: 7000, reasoningEffort: 'low',
    });

    const rows = Array.isArray(data?.photos) ? data.photos : [];
    const photos = kept.map((url, i) => {
      const row = rows.find(r => Number(r?.index) === i) || rows[i] || {};
      const role = ROLES.has(row.role) ? row.role : (i === 0 ? 'main' : 'packshot');
      return {
        url,
        role: i === 0 ? 'main' : role,
        hasPerson: !!row.hasPerson,
        /* 기획세트 나열컷을 주인공으로 쓰면 증정품까지 다 같은 크기로 늘어서서
           무엇을 파는지 안 읽힌다. 제품 하나만 크게 나온 컷을 따로 가린다. */
        itemCount: Number.isFinite(Number(row.itemCount)) ? Math.max(1, Math.round(Number(row.itemCount))) : 1,
        isHero: !!row.isHero,
        isGift: !!row.isGift,
        // 손만 나오는 컷을 '사람 있음'으로 읽으면 모델 재촬영이 열린다.
        // 화장품 상세컷의 손 컷 때문에 모델이 공원을 걷는 컷이 나왔다.
        personKind: ['none', 'hands', 'body'].includes(row.personKind) ? row.personKind
          : (row.hasPerson ? 'body' : 'none'),
        colorway: String(row.colorway || '').slice(0, 12),
        burnedText: String(row.burnedText || '').slice(0, 60),
        note: String(row.note || '').slice(0, 120),
      };
    });
    res.status(200).json({
      photos,
      category: CATEGORIES.has(data?.category) ? data.category : 'other',
      cuts: cleanCuts(data?.cuts),
      usp: String(data?.usp || '').slice(0, 160),
      layoutHints: (Array.isArray(data?.layoutHints) ? data.layoutHints : [])
        .filter(l => typeof l === 'string' && LAYOUT_NAMES.has(l)).slice(0, 3),
      refNote: String(data?.refNote || '').slice(0, 120),
      toneKo: String(data?.toneKo || '').slice(0, 16),
      model: OPENAI_MODEL,
    });
  } catch (err) {
    res.status(err.status === 429 ? 429 : (err.status || 500))
      .json({ error: err.message || '상품 사진을 분류하지 못했습니다.' });
  }
}
