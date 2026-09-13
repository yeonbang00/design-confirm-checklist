/* 시안 6종에 '무슨 컷을 찍을지'를 정한다.
 *
 * 처음에는 방식이 둘뿐이었다 — 원본 그대로 2장, 배경만 바꾼 것 4장. 사진이
 * 한 장뿐인 페이지에서는 여섯 장이 전부 같은 사진이 됐다.
 * 다음에는 컷 종류 여섯 개를 코드에 박았다. 그러면 화장품에도 티셔츠에도
 * 같은 여섯 장면이 간다. 상품마다 어울리는 장면은 전혀 다르다.
 *
 * 그래서 지금은 장면을 코드가 갖고 있지 않는다. 사진을 본 서버가 이 상품으로
 * 찍을 만한 컷 후보 10여 개를 만들어 주고(`/api/productPhotos`), 여기서는
 * 그중 몇 개를 골라 여섯 자리에 앉힌다. 다시 만들 때마다 다른 조합이 나온다.
 *
 * 코드가 지키는 것은 '구조'뿐이다.
 *   - 대표컷 한 장은 생성하지 않고 그대로 쓴다
 *   - 상세컷이 있으면 그것도 그대로 쓴다
 *   - 스타일링 세트는 상품 종류별로 고정한다 (색상별로 돌리면 한 시리즈가 된다)
 *   - 나머지 자리는 후보에서 무작위로 뽑는다
 *
 * 프롬프트를 장면부터 쓰는 이유는 `api/bannerImage.js`에 적어 뒀다.
 */

import { pickAngles, angleContext } from './studio-angles.mjs';

export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* 스타일링 세트만 코드가 갖고 있다.
   이 컷의 값은 '세트가 고정'이라는 데 있다 — 같은 상품의 색상별로 돌리면
   SSF 배너처럼 한 시리즈로 묶인다. 매번 새로 지어내면 그 성질이 사라진다. */
/* 걸쳐 놓으면 형태를 못 읽는다.
   처음엔 "의자 등받이와 좌석에 걸쳐라"라고 썼다가 재킷이 구겨져 널브러진
   컷이 나왔다. 블루종인지 코트인지 알 수 없으면 배너 소재가 아니다.
   레퍼런스(SSF·메종키츠네)를 보면 옷을 의자 좌석에 정면으로 펼쳐 놓는다.
   넥라인, 여밈, 소매, 밑단이 전부 읽힌다. 그래서 지시를 '놓아라'가 아니라
   '형태가 읽히게 펼쳐라'로 바꾼다. */
const SET_READ =
  'The product must be arranged so its full shape reads at a glance: facing the camera '
  + 'squarely, laid out symmetrically and smoothly, with no part folded away or hidden. '
  + 'For clothing, lay the garment flat and open with the neckline, closure and hem all '
  + 'visible and the sleeves arranged deliberately along the sides. Do not crumple, bunch '
  + 'or throw it. A viewer must be able to tell exactly what kind of item it is.';
const SET_BASE = 'Soft daylight from the left with a gentle contact shadow. '
  + 'Camera at the height of the prop, straight on, against a seamless warm-neutral backdrop. '
  + 'No person in the frame. '
  /* 3cm짜리 크림 병이 식탁 의자 위에 덩그러니 놓인 컷이 나왔다. 소품이 상품보다
     열 배 크면 상품이 부스러기로 보인다. 소품은 상품 크기에 맞춰야 한다. */
  + 'THE PROP MUST BE IN SCALE WITH THE PRODUCT: fill most of the frame with the product '
  + 'itself, and choose a prop no more than about twice the size of the product. A small jar '
  + 'or tube never sits on a full-size chair or table seen whole; move the camera in until '
  + 'the product dominates. ' + SET_READ;
export const SETS = {
  'fashion-top': 'a single wooden chair with a woven rattan back on a smooth pale floor; the garment is laid flat and open across the seat, front facing the camera, sleeves arranged down the sides and one cuff falling over the front edge. ' + SET_BASE,
  'fashion-outer': 'a single wooden chair with a woven rattan back on a smooth pale floor; the outerwear is laid open across the seat, front facing the camera so the collar, zip or buttons and the hem all read, sleeves arranged down the sides. ' + SET_BASE,
  'fashion-bottom': 'a low pale wooden bench; the garment is laid out flat along the bench, front facing the camera, waistband and full leg line visible. ' + SET_BASE,
  shoes: 'a low pale stone plinth with a second, smaller step beside it; the pair stands on the plinth, one shoe in full side profile and the other turned three-quarters so both the silhouette and the front read. ' + SET_BASE,
  bag: 'a low pale wooden stool; the bag stands upright and square to the camera so its full outline, handle and closure read, with the strap laid out beside it. ' + SET_BASE,
  accessory: 'a small pale stone tray on a linen cloth; the item lies open at the centre, seen from directly above so its whole shape reads. ' + SET_BASE,
  beauty: 'a pale stone shelf with a single dried stem lying beside it; the item stands upright and square to the camera, label facing forward, full bottle outline visible. ' + SET_BASE,
  food: 'a pale wooden serving board on a linen cloth; the food is arranged as it would be served, seen at a high three-quarter angle so both the portion and the surface read. ' + SET_BASE,
  kitchen: 'a pale stone counter with a folded linen cloth beside it; the item stands on the counter in three-quarter view so its full profile and handle read. ' + SET_BASE,
  home: 'a low pale wooden side table beside a plain upholstered chair; the item sits square on the table with its whole outline clear of the background. ' + SET_BASE,
  electronics: 'a low pale plinth on a smooth concrete floor; the item stands on the plinth at a three-quarter angle, front face and side both visible. ' + SET_BASE,
  kids: 'a small pale wooden child-size chair; the item is laid flat and open across the seat, front facing the camera. ' + SET_BASE,
  sports: 'a low pale wooden bench with a rolled towel at one end; the item is laid out along the bench, front facing the camera. ' + SET_BASE,
  pet: 'a low pale wooden platform with a folded blanket beside it; the item sits square on the platform, full outline visible. ' + SET_BASE,
  /* 기본값이 의자였다. 의자는 옷에만 맞는 소품인데 분류가 실패하면 전부 의자로
     갔다. 어떤 상품에도 어색하지 않은 낮은 단으로 바꾼다. */
  other: 'a low pale stone plinth just wide enough for the product, on a smooth floor; the product stands square on the plinth, or is laid flat and open across it if it is soft. ' + SET_BASE,
};

/* 서버가 컷 후보를 못 준 경우에만 쓰는 예비 목록. 상품을 모르는 채로 쓰는
   문장이라 어느 상품에나 어색하지 않을 만큼만 두루뭉술하다. */
export const FALLBACK_CUTS = [
  { name: '무지 스튜디오', person: 'none', scene: 'a seamless pale grey studio backdrop with a smooth concrete floor. The product stands alone, lit by one key light from the left and a soft fill from the front, with a clean contact shadow underneath. Camera at product height, three-quarter view. No person in the frame.', mount: 'studio', angle: 'front', distance: 'medium', light: 'studio-key', background: 'seamless', composition: 'centered', palette: 'warm-neutral', motion: 'static', person: 'none', pose: '' },
  { name: '질감 클로즈업', person: 'none', scene: 'a close, tightly framed studio shot that fills the frame with the surface of the product — its material, its seams and its finish. Soft directional light rakes across the surface. No person in the frame.', mount: 'fabric', angle: 'close-front', distance: 'extreme-close', light: 'rim', background: 'dark', composition: 'centered', palette: 'monochrome', motion: 'static', person: 'none', pose: '' },
  { name: '창가 정물', person: 'none', scene: 'a pale wooden surface beside a window with a sheer curtain; the product sits on the surface with soft leaf shadows falling across it, and the rest of the frame stays empty. No person in the frame.', mount: 'table', angle: 'high-45', distance: 'wide', light: 'window', background: 'blurred-scene', composition: 'space-right', palette: 'warm-neutral', motion: 'static', person: 'none', pose: '' },
  { name: '플랫레이', person: 'none', scene: 'an overhead flat-lay on a pale linen cloth; the product is laid out neatly at the centre with generous empty cloth around it. Soft even daylight from above, camera looking straight down. No person in the frame.', mount: 'fabric', angle: 'top-down', distance: 'wide', light: 'soft', background: 'textured', composition: 'symmetric', palette: 'pastel', motion: 'static', person: 'none', pose: '' },
  { name: '낮은 단', person: 'none', scene: 'a low pale stone plinth on a smooth concrete floor in a wide empty room; the product stands on the plinth with a long soft shadow beside it, and the rest of the frame stays bare. No person in the frame.', mount: 'plinth', angle: 'worms-eye', distance: 'medium', light: 'hard', background: 'solid', composition: 'space-left', palette: 'high-contrast', motion: 'static', person: 'none', pose: '' },
  { name: '넓은 실내', person: 'keep', scene: 'a wide, calm interior with plenty of empty space — a pale wall, a bare floor and one piece of simple furniture. The subject sits well off to one side and the camera is far back, so most of the picture is quiet. Soft even daylight.', mount: 'location', angle: 'eye-level', distance: 'very-wide', light: 'window', background: 'sharp-scene', composition: 'thirds', palette: 'cool-neutral', motion: 'static', person: 'keep', pose: 'seated' },
  { name: '거리 오후', person: 'keep', scene: 'a sunlit city street with low buildings and street trees in late afternoon light. The subject is re-staged completely — a different posture and a different camera distance from the reference.', mount: 'location', angle: 'three-quarter', distance: 'wide', light: 'golden', background: 'blurred-scene', composition: 'space-left', palette: 'earth', motion: 'wind', person: 'keep', pose: 'walking' },
  { name: '공원 산책', person: 'keep', scene: 'a quiet park path with grass and out-of-focus trees under soft overcast light. The subject walks through the frame, re-staged with a new posture and a longer camera distance.', mount: 'location', angle: 'side', distance: 'wide', light: 'dappled', background: 'sharp-scene', composition: 'diagonal', palette: 'earth', motion: 'hand-motion', person: 'keep', pose: 'walking' },
  { name: '자연광 실내', person: 'keep', scene: 'a bright apartment interior with a large window, a sheer curtain and a pale wooden floor. The subject is re-staged near the window with a relaxed posture and generous empty space beside them.', mount: 'location', angle: 'eye-level', distance: 'medium', light: 'window', background: 'blurred-scene', composition: 'space-right', palette: 'warm-neutral', motion: 'static', person: 'keep', pose: 'leaning' },
];

/* 분류가 없으면(분류 전이거나 실패) 비율로만 짐작한다. 틀려도 대체 순서가
   받아주므로 여섯 종은 항상 채워진다. */
export function guessRole(photo, index) {
  if (photo.role) return photo.role;
  const r = photo.w && photo.h ? photo.h / photo.w : 0;
  if (r >= 1.7) return 'detail';
  if (index === 0) return 'main';
  return 'model';
}

/* 같은 역할의 사진이 여러 장일 때 앞에서부터 집으면 매번 같은 장이 나온다.
   착용컷이 다섯 장 있어도 늘 같은 두 장만 쓰게 된다. 무작위로 고른다. */
function pickPhoto(prefer, photos, used, random = Math.random) {
  const one = list => list[Math.floor(random() * list.length)];
  for (const role of prefer) {
    const free = photos.map((p, i) => (p.role === role && !used.has(i) ? i : -1)).filter(i => i >= 0);
    if (free.length) return one(free);
  }
  for (const role of prefer) {
    const any = photos.map((p, i) => (p.role === role ? i : -1)).filter(i => i >= 0);
    if (any.length) return one(any);
  }
  const free = photos.map((_, i) => (used.has(i) ? -1 : i)).filter(i => i >= 0);
  return free.length ? one(free) : 0;
}

/* 조판을 '무엇을 앞세우나'로 묶는다. 아무 조판이나 아무 컷에 붙이면
   할인율을 앞세울 판에 사진만 크게 나오거나, 연출컷 위에 숫자만 얹힌다.
     offer   숫자·혜택이 주인공 (확인된 가격이 있을 때만)
     product 제품이 주인공, 카피는 비켜선다
     story   말이 주인공, 사진은 배경 */
/* 글자를 어디에 둘 것인가.
     layer  사진만 생성하고 카피는 HTML/CSS로 얹는다. 문구를 화면에서 고칠 수
            있고 숫자는 코드가 채우므로 틀릴 일이 없다.
     baked  카피까지 그림 안에 그린다. CSS로는 못 만드는 표현(스티커 레터링,
            손글씨, 3D 세트 안의 글자)이 열린다. 대신 픽셀에 박히므로 고칠 수
            없고, 숫자가 틀릴 수 있어 생성 뒤에 OCR로 대조한다.
   둘을 섞는다. 여섯 장이 전부 baked면 고칠 수 있는 시안이 하나도 없다. */
/* 외곽선 타이포는 뺐다. 속이 빈 글자는 생성 품질이 눈에 띄게 떨어져
   테두리가 뭉개지고 획이 붙어 버렸다. */
export const TYPE_STYLES = [
  ['각진 대형 고딕', 'a very heavy geometric sans-serif, tightly set, with one word or number in a strong accent colour'],
  ['둥근 스티커', 'chunky rounded lettering shaped like a die-cut sticker, thick white outline and a soft drop shadow, slightly tilted'],
  ['손글씨 마커', 'hand-drawn marker lettering with visible brush edges, slightly irregular, with small doodle strokes beside it'],
  ['편집 명조', 'a refined high-contrast serif set large with generous letter spacing, editorial magazine feel'],
  ['장평 좁은 볼드', 'a condensed bold sans-serif stacked in two tight lines, filling the width edge to edge'],
];

/* 조판 열여덟이라고 했지만 눈에 보이는 장치는 다섯 가지다. offer·numeral·arch는
   전부 같은 숫자 하이라이트 띠고, split·split-right·duo-panel은 전부 면분할이다.
   혜택 강조가 회당 두세 자리니 같은 장치가 세 번씩 나왔다. 여섯 장이 다르게
   보이려면 조판 이름이 아니라 장치가 달라야 한다.

   면분할은 한 번까지만 쓴다. 사진 반 카피 반으로 나눈 판은 한 장 있으면
   충분하고, 두 장만 돼도 여섯 장이 전부 그것처럼 보인다. 나머지는 두 번까지. */
export const DEVICE = {
  highlight: ['offer', 'numeral', 'arch'],          // 숫자 아래 색 띠
  split: ['split', 'split-right', 'duo-panel'],     // 좌우 면분할
  overlay: ['top-center', 'top-left', 'bottom-right', 'corner', 'badge'], // 사진 위 글자
  card: ['boxed', 'strip', 'band', 'header'],       // 카드·띠로 글자를 담음
  type: ['type-diagonal', 'price', 'framed'],       // 타이포가 판을 지배
};
export const deviceOf = layout =>
  Object.keys(DEVICE).find(k => DEVICE[k].includes(layout)) || 'other';
/* 장치가 달라도 눈에는 같은 모양인 짝이 있다. framed와 arch가 그렇다.
   둘 다 사진 윗변을 반원으로 깎는데 장치는 type과 highlight로 갈려 있어서
   장치 제한에 같이 걸리지 않는다. 실측 — 600회를 돌리니 68% 회차에 아치가
   한 장 이상, 16%는 두 장 들어갔다. 조판이 고정된 것처럼 보이는 이유다.
   장치와 별개로 실루엣이 같은 것끼리 한 번까지만 쓴다. */
/* 사진을 화면 가득 까는 조판과 제 배경을 갖는 조판. 열아홉 조판의 이미지가
   틀을 얼마나 덮는지 재서 갈랐다.
     꽉 참   top-center·top-left·bottom-right·boxed·corner·badge (97% 이상)
     배경 남음 나머지 열셋 (27~76%)
   대표컷이 배경 없는 누끼면 꽉 채우는 조판을 쓸 수 없다. 흰 바탕만 커지고
   제품은 그대로라 배너가 안 된다. 음식 차린 컷이나 모델 야외컷은 반대로
   꽉 채워야 산다. 사진 종류를 보고 조판을 고른다. */
export const FULLBLEED = ['top-center', 'top-left', 'bottom-right', 'boxed', 'corner', 'badge'];

/* 사진을 세 장 쓰는 조판. 패션 레퍼런스 327장 중 10%가 격자였다(다른 업종은
   1%). 열 배 차이라 패션과 쇼핑에서만 연다. 사진이 세 장 없으면 못 만든다.
   칸끼리 비슷하면 판을 나눈 뜻이 없어서 각도나 거리가 다른 것끼리 고른다. */
export const MULTI = ['trio', 'mosaic', 'hero-stack'];
const MULTI_CATEGORIES = new Set(['fashion-top', 'fashion-outer', 'fashion-bottom',
  'shoes', 'bag', 'accessory', 'kids', 'sports', 'other', 'pet']);

export const SILHOUETTE = { arch: ['framed', 'arch'] };
const silhouetteOf = layout =>
  Object.keys(SILHOUETTE).find(k => SILHOUETTE[k].includes(layout)) || null;

export const DEVICE_LIMIT = { split: 1 };
const limitOf = dev => DEVICE_LIMIT[dev] || 2;

/* ---- 업종별 구성 규칙 ----
   여섯 자리를 무엇으로 채울지는 업종마다 다르다. 패션은 모델이 입은 모습이
   핵심이고, 화장품은 제품 자체와 질감이 핵심이다. 같은 배분을 쓰면 화장품
   배너에 모델이 공원을 걷는 컷이 들어간다.

   자리마다 무엇을 쓸지 적는다.
     cutout  단순 배경 누끼컷 (원본 누끼가 뜨면 그것, 아니면 무지 배경 생성)
     detail  상세 페이지 이미지 그대로
     main    대표컷 그대로
     model   착용컷 그대로
     mockup  생성: 단상·테이블·선반 위 정물
     macro   생성: 표면이 꽉 찬 질감 클로즈업
     scene   생성: 실제 공간에 놓인 연출컷
     editorial 생성: 모델 화보컷

   원본이 없으면 아래 FALLBACK 순서로 내려간다. 억지로 자리를 비우지 않는다. */
export const MIX = {
  'fashion-top':    ['main', 'model', 'model', 'cutout', 'editorial', 'scene'],
  'fashion-outer':  ['main', 'model', 'model', 'cutout', 'editorial', 'scene'],
  'fashion-bottom': ['main', 'model', 'model', 'cutout', 'editorial', 'macro'],
  shoes:            ['cutout', 'detail', 'detail', 'mockup', 'model', 'macro'],
  bag:              ['cutout', 'detail', 'detail', 'mockup', 'model', 'macro'],
  accessory:        ['cutout', 'detail', 'detail', 'mockup', 'macro', 'scene'],
  beauty:           ['cutout', 'detail', 'detail', 'mockup', 'macro', 'scene'],
  food:             ['main', 'detail', 'detail', 'mockup', 'macro', 'scene'],
  kitchen:          ['cutout', 'detail', 'detail', 'mockup', 'scene', 'macro'],
  home:             ['cutout', 'detail', 'mockup', 'scene', 'scene', 'macro'],
  electronics:      ['cutout', 'detail', 'detail', 'mockup', 'macro', 'scene'],
  kids:             ['main', 'model', 'detail', 'cutout', 'scene', 'mockup'],
  sports:           ['main', 'model', 'detail', 'cutout', 'editorial', 'macro'],
  pet:              ['main', 'detail', 'detail', 'mockup', 'scene', 'macro'],
  other:            ['main', 'detail', 'cutout', 'mockup', 'scene', 'macro'],
};

// 자리를 못 채울 때 내려가는 순서. 원본이 없으면 생성으로, 생성도 안 되면 다른 생성으로.
const FALLBACK = {
  main: ['main', 'model', 'detail', 'cutout'],
  model: ['model', 'main', 'editorial', 'detail'],
  detail: ['detail', 'model', 'main', 'macro'],
  cutout: ['cutout', 'mockup', 'main'],
  mockup: ['mockup', 'cutout', 'scene'],
  macro: ['macro', 'mockup', 'detail'],
  scene: ['scene', 'mockup', 'editorial'],
  editorial: ['editorial', 'scene', 'model'],
};

const SLOT_KO = {
  main: ['메인 원본', '상품 페이지 대표컷을 그대로 씁니다.'],
  model: ['착용 원본', '상세 페이지 착용컷을 그대로 씁니다.'],
  detail: ['상세 원본', '상세 페이지 컷을 그대로 씁니다. 크롭은 디자이너가 정합니다.'],
  cutout: ['누끼 단품', '배경을 지운 제품컷입니다. 무엇을 파는지가 바로 읽힙니다.'],
  mockup: ['목업 정물', '단상·테이블 위에 제품만 올린 촬영컷입니다.'],
  macro: ['질감 매크로', '표면이 화면을 채우는 클로즈업입니다.'],
  scene: ['연출컷', '제품이 실제로 놓일 공간에서 찍습니다.'],
  editorial: ['화보컷', '모델이 나오는 화보 형식입니다.'],
};

// 생성 자리는 컷 후보 중 축이 맞는 것을 고른다. 축을 정해 놓고 안 쓰고 있었다.
const WANT_AXES = {
  mockup: c => ['plinth', 'table', 'shelf', 'studio', 'floor'].includes(c.mount) && c.person === 'none',
  macro: c => c.distance === 'extreme-close' || c.distance === 'close',
  scene: c => c.mount === 'location' && c.person !== 'keep',
  editorial: c => c.person === 'keep',
  cutout: c => c.mount === 'studio' && c.person === 'none',
};

export const EMPHASIS = {
  offer: ['offer', 'numeral', 'arch', 'type-diagonal', 'duo-panel', 'price'],
  product: ['boxed', 'corner', 'badge', 'framed', 'strip', 'split-right'],
  story: ['header', 'split', 'top-left', 'top-center', 'band', 'bottom-right'],
};

export function createPlan(product, random = Math.random) {
  const hasBenefit = product.benefitConfirmed && product.benefitRate > 0 && product.benefitCondition;
  const photos = (product.photos.length ? product.photos : [{}])
    .map((p, i) => ({ ...p, role: guessRole(p, i) }));
  /* 여섯 장의 강조 방향을 먼저 정한다. 퍼포먼스 배너는 할인율을 앞세우는 판과
     제품을 크게 보여주는 판이 섞여야 한다. 가격이 확인되지 않았으면 숫자를
     앞세울 수 없으므로 offer는 후보에서 빠진다. */
  const canOffer = !!(product.salePrice || hasBenefit);
  /* 배합 자체도 매번 다르게 뽑는다. 늘 같은 비율이면 판의 성격이 늘 같다.
     혜택을 세 장 밀어붙인 회차와 제품을 네 장 보여주는 회차는 다른 결과다. */
  const MIXES = [
    ['offer', 'offer', 'offer', 'product', 'product', 'story'],   // 혜택 중심
    ['offer', 'offer', 'product', 'product', 'product', 'story'], // 균형
    ['offer', 'product', 'product', 'product', 'product', 'story'], // 제품 중심
    ['offer', 'product', 'product', 'story', 'story', 'story'],   // 무드 중심
  ];
  const mix = MIXES[Math.floor(random() * MIXES.length)] || MIXES[1];
  /* 여섯 장 중 둘은 카피까지 그림에 그린다. 어느 자리가 될지는 매번 다르다.
     그대로 못 고치는 대신 CSS로는 안 되는 표현이 나온다. */
  const bakedAt = new Set(shuffle([0, 1, 2, 3, 4, 5], random).slice(0, 2));
  const typeOrder = shuffle(TYPE_STYLES, random);
  // 확인된 가격이 없으면 숫자를 앞세울 수 없다. 그 자리는 제품으로 돌린다.
  const emphasisPlan = shuffle(mix.map(e => (e === 'offer' && !canOffer ? 'product' : e)), random);

  // 조판은 강조 방향 안에서 고르고, 여섯 장이 같은 조판을 두 번 쓰지 않게 한다.
  const usedLayout = new Set();
  const usedSilhouette = new Set();
  const deviceCount = {};
  /* 레퍼런스 배너를 본 분류가 이 업종에 어울리는 조판을 골라 준다. 같은 강조
     묶음 안에 그 조판이 있으면 먼저 쓴다. 내가 짐작한 값보다 실제로 집행된
     배너에서 읽은 값이 낫다. 없으면 원래대로 무작위로 뽑는다. */
  const hints = Array.isArray(product.layoutHints) ? product.layoutHints : [];
  /* 자리마다 어떤 사진이 들어갈지는 아래에서 정해지는데 조판은 그 전에
     정해진다. 대표컷이 누끼일 때 꽉 채우는 조판이 걸리면 손쓸 방법이 없다.
     대표컷 한 장만 미리 보고, 누끼면 꽉 채우는 조판을 후보에서 뺀다. */
  const ALL_LAYOUTS = Object.values(EMPHASIS).flat();
  /* 조판을 자리가 정해진 뒤에 고른다. 예전에는 여기서 index 순서대로 뽑고
     자리는 아래에서 따로 섞었다. 그래서 애써 만든 생성 장면이 사진을 반으로
     자르는 판에 들어가곤 했다. 실측 — 생성컷이 꽉 채우는 조판을 받는 비율이
     36%였다. 열 장 중 여섯 장이 판에 끼워졌다는 뜻이다. */
  function chooseLayout(em, only) {
    const pool = only && only.length ? only : ALL_LAYOUTS;
    const inGroup = EMPHASIS[em].filter(l => pool.includes(l));
    const free = l => !usedLayout.has(l) && (l !== 'duo-panel' || photos.length > 1)
      && !(silhouetteOf(l) && usedSilhouette.has(silhouetteOf(l)));
    const fresh = l => (deviceCount[deviceOf(l)] || 0) < limitOf(deviceOf(l));
    /* 강조 묶음을 먼저 쓰되, 후보가 좁혀진 자리에서는 묶음만 고집하면 남은
       두셋이 독점한다. 실측 — 누끼 대표컷에서 묶음만 쓰니 strip 85%,
       framed 77%가 됐다. 좁혀진 자리는 후보 전체에서 고른다. */
    const narrowed = pool.length < ALL_LAYOUTS.length;
    const hinted = shuffle(hints.filter(l => pool.includes(l)), random);
    const body = narrowed
      ? shuffle(pool.slice(), random)
      : [...shuffle(inGroup, random), ...shuffle(pool.filter(l => !inGroup.includes(l)), random)];
    const ranked = [...hinted, ...body].filter(free);
    const pick = ranked.find(fresh) || ranked[0]
      || shuffle(ALL_LAYOUTS.slice(), random).find(l => !usedLayout.has(l)) || 'header';
    usedLayout.add(pick);
    if (silhouetteOf(pick)) usedSilhouette.add(silhouetteOf(pick));
    deviceCount[deviceOf(pick)] = (deviceCount[deviceOf(pick)] || 0) + 1;
    return pick;
  }

  /* '사람이 있다'와 '모델이 있다'는 다르다. 화장품 상세페이지의 손 컷을
     사람으로 읽었더니 모델이 공원을 걷는 컷이 나왔다. 전신·얼굴이 나오는
     사진이 있을 때만 모델 재촬영을 연다. */
  const anyPerson = photos.some(p => p.personKind === 'body' || (p.hasPerson && !p.personKind));
  const anyHands = photos.some(p => p.personKind === 'hands' || p.personKind === 'body' || p.hasPerson);
  // 분류에 실패하면 값 자체가 없다. 그것을 '사람 없음'으로 읽으면 사람이
  // 나오는 후보가 전부 빠져 여섯 자리를 못 채운다. 모를 때는 남긴다.
  const personKnown = photos.some(p => 'hasPerson' in p);
  const allowKeep = anyPerson || !personKnown;

  // 사람이 없는 상품에 '그 사람을 그대로 두고'를 시키면 없던 사람이 생긴다.
  const pool = shuffle(
    (product.cuts?.length ? product.cuts : FALLBACK_CUTS)
      .filter(c => allowKeep || c.person !== 'keep'),
    random);

  const slots = [];

  /* ---- 여섯 자리를 업종 규칙대로 채운다 ----
     예전에는 원본 몇 장 + 스타일링 세트 + 나머지 생성이라는 즉흥 배분이었다.
     그래서 화장품에도 패션에도 같은 여섯 장이 나왔다. 업종별 표(MIX)가
     자리마다 무엇을 쓸지 정하고, 없으면 FALLBACK을 따라 내려간다. */
  const byRole = r => photos.map((p, i) => (p.role === r ? i : -1)).filter(i => i >= 0);
  // 착용 원본으로 쓸 수 있는 것은 모델이 나온 사진이다. 손 컷은 상세컷에 가깝다.
  const bank = {
    main: byRole('main'),
    model: byRole('model').filter(i => photos[i].personKind !== 'hands'),
    detail: [...byRole('detail'), ...byRole('model').filter(i => photos[i].personKind === 'hands')],
    cutout: photos.map((p, i) => (p.cutUrl ? i : -1)).filter(i => i >= 0),
    pack: [...byRole('packshot'), ...byRole('flat')],
  };
  // 누끼가 안 떴으면 단품컷이 그 자리를 대신한다. 배경이 단순한 컷이라 가깝다.
  if (!bank.cutout.length) bank.cutout = bank.pack.slice();

  const usedPhoto = new Set();
  const takePhoto = list => {
    const free = list.filter(i => !usedPhoto.has(i));
    if (!free.length) return -1;
    const i = free[Math.floor(random() * free.length)];
    usedPhoto.add(i);
    return i;
  };

  const usedCut = new Set();
  const takeCut = want => {
    const test = WANT_AXES[want];
    const free = pool.filter(c => !usedCut.has(c.name) && (!test || test(c)));
    if (!free.length) return null;
    const c = free[Math.floor(random() * free.length)];
    usedCut.add(c.name);
    return c;
  };

  const plainSlot = (want, i) => {
    const src = want === 'cutout' ? bank.cutout : bank[want];
    const photo = src ? takePhoto(src) : -1;
    if (photo < 0) return null;
    const [label, desc] = SLOT_KO[want];
    return { kind: 'plain', want, label: i ? `${label} ${i + 1}` : label, desc, photo };
  };

  const genSlot = want => {
    const cut = takeCut(want);
    const [label, desc] = SLOT_KO[want];
    if (!cut) {
      // 후보가 없으면 상품 종류별 고정 세트로 채운다. 빈자리를 두지 않는다.
      if (want !== 'mockup' && want !== 'cutout') return null;
      return {
        kind: 'set', want, label: '스타일링 세트',
        desc: '상품 종류에 맞는 고정 세트입니다. 색상별로 돌리면 한 시리즈가 됩니다.',
        scene: SETS[product.category] || SETS.other, person: 'none',
        prefer: ['packshot', 'flat', 'main', 'model'],
      };
    }
    return {
      kind: 'made', want, label: cut.name || label, desc,
      scene: cut.scene, person: cut.person,
      axes: {
        person: cut.person, mount: cut.mount, angle: cut.angle, distance: cut.distance,
        light: cut.light, background: cut.background, composition: cut.composition,
        palette: cut.palette, motion: cut.motion, pose: cut.pose, mood: cut.mood,
      },
      prefer: cut.person === 'keep' ? ['model', 'main'] : ['packshot', 'flat', 'main', 'model'],
    };
  };

  const IS_PLAIN = new Set(['main', 'model', 'detail', 'cutout']);
  const wants = MIX[product.category] || MIX.other;
  const seen = {};
  for (const want of wants) {
    let made = null;
    for (const step of (FALLBACK[want] || [want])) {
      // 누끼는 원본 누끼가 있으면 그것, 없으면 생성으로 내려간다
      made = IS_PLAIN.has(step) ? plainSlot(step, seen[step] || 0) : genSlot(step);
      if (made) { seen[step] = (seen[step] || 0) + 1; break; }
    }
    if (made) slots.push(made);
  }
  // 전부 실패한 자리는 예비 컷으로 메운다. 여섯 장은 어떤 경우에도 채운다.
  for (const cut of shuffle(FALLBACK_CUTS.filter(c => allowKeep || c.person !== 'keep'), random)) {
    if (slots.length >= 6) break;
    if (slots.some(x => x.label === cut.name)) continue;
    slots.push({
      kind: 'spare', want: 'scene', label: cut.name, desc: '기본 장면입니다.',
      scene: cut.scene, person: cut.person,
      axes: { person: cut.person, mount: cut.mount, angle: cut.angle, distance: cut.distance,
        light: cut.light, background: cut.background, composition: cut.composition,
        palette: cut.palette, motion: cut.motion, pose: cut.pose, mood: cut.mood },
      prefer: cut.person === 'keep' ? ['model', 'main'] : ['packshot', 'flat', 'main', 'model'],
    });
  }
  while (slots.length > 6) slots.pop();

  /* 생성컷을 둘에서 셋 사이로 맞춘다. 업종 표와 대체 순서를 따라가다 보면
     사진이 적은 상품에서 넷까지 올라간다(실측 — 사진 석 장짜리로 재니 뷰티·
     가전·패션이 4.0장). 넷이면 기다리는 시간과 비용이 그만큼 늘고 원본으로
     보여줄 수 있는 것까지 그림으로 대체한다. */
  const isMade = x => x.kind !== 'plain';
  const madeCount = () => slots.filter(isMade).length;
  while (madeCount() > 3) {
    const i = slots.findIndex(isMade);
    const back = ['detail', 'main', 'model', 'cutout']
      .map(w => plainSlot(w, seen[w] || 0)).find(Boolean);
    if (!back) break;
    seen[back.want] = (seen[back.want] || 0) + 1;
    slots[i] = back;
  }
  while (madeCount() < 2) {
    const add = ['mockup', 'scene', 'macro', 'editorial'].map(w => genSlot(w)).find(Boolean);
    if (!add) break;
    const i = slots.findIndex(x => !isMade(x));
    if (i < 0) break;
    slots[i] = add;
  }

  /* 설득 앵글을 자리마다 붙인다. 강조 방향과 맞는 것을 먼저 쓰고, 자료가
     없는 유형은 후보에 올리지 않는다. 후기가 없는데 후기형을 만들 수 없다. */
  const angles = pickAngles(emphasisPlan, angleContext(product, photos), random);

  /* 생성 자리는 카피 세 줄만 얹는다. 다만 그중 한 장은 카피까지 그림에 그린다.
     CSS로는 못 만드는 표현(스티커 레터링, 손글씨, 세트 안의 글자)이 거기서만
     나온다. 그 한 장은 글자가 픽셀에 박히므로 세 줄 규칙에서 뺀다.
     어느 자리가 될지는 매번 다르되 한 장을 넘지 않는다. */
  const ordered = shuffle(slots, random);
  const madeIdx = ordered.map((x, i) => (x.kind !== 'plain' ? i : -1)).filter(i => i >= 0);
  const bakedIdx = madeIdx.find(i => bakedAt.has(i));

  /* 사진 세 장을 쓰는 자리를 한 장까지 연다. 원본을 그대로 쓰는 자리 중에서
     고른다. 생성 자리는 화면을 꽉 채우기로 이미 정해져 있다. */
  const usable = photos.map((p, i) => (p.role !== 'unusable' ? i : -1)).filter(i => i >= 0);
  const canMulti = MULTI_CATEGORIES.has(product.category) && usable.length >= 3;
  const multiIdx = canMulti
    ? ordered.findIndex((x, i) => x.kind === 'plain' && i !== bakedIdx)
    : -1;
  const multiLayout = multiIdx >= 0 ? shuffle(MULTI.slice(), random)[0] : '';
  /* 세 칸에 비슷한 컷만 넣으면 판을 나눈 뜻이 없다. 각도와 거리가 다른
     것끼리 고르고, 그래도 모자라면 남은 것으로 채운다. */
  const multiSet = (() => {
    if (multiIdx < 0) return null;
    const key = i => (photos[i].shotAngle || '') + '/' + (photos[i].shotDistance || '');
    const out = [];
    const seenKey = new Set();
    for (const i of shuffle(usable.slice(), random)) {
      if (seenKey.has(key(i))) continue;
      seenKey.add(key(i)); out.push(i);
      if (out.length >= 3) break;
    }
    for (const i of usable) { if (out.length >= 3) break; if (!out.includes(i)) out.push(i); }
    return out.length >= 3 ? out.slice(0, 3) : null;
  })();
  return ordered.map((slot, i) => {
    /* 그대로 쓰는 자리는 위에서 이미 사진을 골라 뒀다. 여기서 다시 고르면
       같은 사진이 두 자리에 들어간다. 정해진 것이 있으면 그대로 쓴다. */
    const photo = Number.isInteger(slot.photo) && slot.photo >= 0
      ? slot.photo : pickPhoto(slot.prefer, photos, usedPhoto, random);
    usedPhoto.add(photo);
    const src = photos[photo] || {};
    const known = 'hasPerson' in src;
    const person = !!src.hasPerson;
    /* 생성 장면은 화면을 가득 채우고 카피는 세 줄만 얹는다. 애써 만든 장면을
       반으로 잘라 판에 끼우면 만든 값이 없다. 누끼 자리는 반대로 제 배경을
       갖는 판이어야 한다. 나머지는 강조 묶음이 정하던 대로. */
    const made = slot.kind !== 'plain';
    /* 대표컷이 누끼여도 생성 장면은 제 배경을 갖고 나온다. 누끼를 못 까는
       것과 생성컷을 못 까는 것은 다른 문제다. 자리가 쓰는 사진으로 판단한다. */
    const plainShot = !made
      && (slot.want === 'cutout' || !!(photos[photo] && photos[photo].plainBg));
    const layout = (i === multiIdx && multiSet) ? multiLayout
      : made ? chooseLayout(emphasisPlan[i], FULLBLEED)
      : plainShot ? chooseLayout(emphasisPlan[i], ALL_LAYOUTS.filter(l => !FULLBLEED.includes(l)))
      : chooseLayout(emphasisPlan[i]);
    return {
      id: i,
      recipe: slot.kind === 'set' ? 'styling-set' : slot.kind === 'plain' ? 'plain' : slot.kind,
      // 예전 코드가 method로 갈래를 나눈다. 값을 유지해 호출부를 안 깨뜨린다.
      method: slot.kind === 'plain' ? 'original' : 'newscene',
      label: slot.label,
      desc: slot.desc,
      layout: layout,
      type: angles[i].id,
      angle: { id: angles[i].id, ko: angles[i].ko, how: angles[i].how, badge: angles[i].badge },
      photo,
      photoSet: i === multiIdx && multiSet ? multiSet : null,
      photoRole: src.role,
      // 장면이 '사람 없음'을 못 박은 컷은 사람 여부를 몰라도 물건만 꺼내면 된다.
      // 사람이 나와도 되는 컷만, 모를 때 어느 쪽으로도 안 기우는 값으로 미룬다.
      keep: slot.kind === 'plain' ? 'product'
        : slot.person === 'none' ? (known && !person ? 'product' : 'item')
        : person ? 'person' : known ? 'product' : 'subject',
      sceneName: slot.label,
      // 이 자리가 업종 규칙의 어떤 칸인지. 카드에 적고 검증에도 쓴다.
      want: slot.want || '',
      scene: slot.scene || '',
      emphasis: emphasisPlan[i],
      axes: slot.axes || null,
      // 그대로 쓰는 컷은 생성 자체를 안 하므로 baked가 될 수 없다
      /* 카피 세 줄만 그리는 자리. 눈썹·강조 숫자·각주를 안 붙인다. */
      /* 생성 자리는 카피 세 줄만 얹는다. 다만 한 장은 카피까지 그림에 그린다.
         CSS로는 못 만드는 표현(스티커 레터링, 손글씨, 세트 안의 글자)이
         거기서만 나온다. 그 한 장은 글자가 픽셀에 박히므로 세 줄 규칙에서 뺀다. */
      minimalCopy: made && i !== bakedIdx,
      // 세 줄만 그리는 자리는 그림에 글자를 박지 않는다. 고칠 수 있어야 한다.
      render: i === bakedIdx ? 'baked' : 'layer',
      typeStyle: typeOrder[i % typeOrder.length],
      madeByAi: slot.kind === 'made',
    };
  });
}
