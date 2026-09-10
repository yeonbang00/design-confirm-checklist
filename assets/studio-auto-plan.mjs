/* 시안 6종의 '무엇을 찍은 컷인가'를 정한다.
 *
 * 예전에는 방식이 두 가지뿐이었다 — 원본 그대로 2장, 배경만 바꾼 것 4장.
 * 상품 사진이 한 장뿐인 페이지에서는 여섯 장이 전부 같은 사진이 됐고,
 * 배경 문구만 바꾼 탓에 결과가 서로 구별되지 않았다.
 *
 * 여기서는 '컷의 종류'를 여섯 가지로 나눈다. 종류마다 필요한 원본이
 * 다르므로(단품컷·모델컷·상세컷) 가진 자료에 맞춰 배정하고, 없으면
 * 대체 순서를 따라 내려간다.
 *
 * 프롬프트를 장면부터 쓰는 이유 — 실측했다. "상품을 유지하라"를 앞에 길게
 * 쓰고 장면을 뒤에 붙이면 gpt-image-2는 원본 장면을 거의 그대로 되돌려준다.
 * 의자에 앉히라고 해도 원본의 거리와 간판이 그대로 남았다. 장면을 먼저
 * 선언하고 "원본의 장소는 아무것도 남기지 마라"를 박은 뒤, 지킬 것을
 * 짧게 뒤에 붙이자 그제야 실내 좌식컷과 무인 스튜디오컷이 나왔다.
 * 그래서 여기서는 scene(무엇을 새로 찍나)과 keep(무엇만 지키나)을 나눠 둔다.
 */

export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 모델·상품을 옮길 장소. 포즈까지 다시 잡으라고 지시하므로 '어디서'만 정한다.
export const PLACES = [
  ['거리 오후', 'a sunlit city street with low buildings and street trees, late afternoon light'],
  ['자연광 실내', 'a bright apartment interior with a large window, sheer curtain and pale wooden floor'],
  ['미니멀 갤러리', 'a minimal concrete gallery space with an arched opening and restrained olive tones'],
  ['저녁 실내', 'a warm evening interior lit indirectly by lamps, rich but natural shadows'],
  ['공원 산책', 'a quiet park path with grass and out-of-focus trees, soft overcast light'],
  ['카페 창가', 'a small cafe by a window, marble table edge and warm morning light'],
];

/* keep 값은 서버가 문장으로 바꾼다. 세 가지뿐이다.
   - person : 같은 사람 + 입은 것 전부
   - item   : 사람이 입거나 든 그 물건만 (사람은 뺀다)
   - product: 사람 없는 상품 그대로 */

export const RECIPES = {
  'main-original': {
    label: '메인 원본', ai: false,
    need: ['main', 'model', 'packshot', 'detail'],
    desc: '상품 페이지 대표컷을 그대로 씁니다.',
  },
  'studio-packshot': {
    label: '스튜디오 단품', ai: true,
    need: ['packshot', 'flat', 'main'],
    desc: '제품만 촬영 스튜디오로 옮깁니다. 사람은 넣지 않습니다.',
    keep: 'product', keepPerson: 'item',
    scene:
      'a seamless pale grey studio backdrop with a smooth concrete floor. The product stands '
      + 'alone, lit by one key light from the left and a soft fill from the front, with a clean '
      + 'contact shadow underneath. Camera at product height, three-quarter view. '
      + 'No person in the frame.',
  },
  'styling-set': {
    // 세트를 고정한다. 같은 상품의 색상별로 돌리면 SSF 배너처럼 한 시리즈로 묶인다.
    label: '스타일링 세트', ai: true, fixedSet: true,
    need: ['packshot', 'flat', 'main', 'model'],
    desc: '고정된 의자 세트에 상품만 올립니다. 색상별로 돌리면 한 시리즈가 됩니다.',
    keep: 'product', keepPerson: 'item',
    scene:
      'a single wooden chair with a woven rattan back, standing on a smooth pale floor against '
      + 'a seamless warm-neutral backdrop. The product is draped over the back and seat of the '
      + 'chair — if it is clothing it falls naturally over the chair showing its own drape and '
      + 'thickness; otherwise it rests on the seat. Soft daylight from the left with a gentle '
      + 'contact shadow. Camera at chair height, straight on. No person in the frame.',
  },
  'detail-crop': {
    label: '상세 원본', ai: false,
    need: ['detail', 'model', 'main'],
    desc: '상세 페이지 컷을 그대로 씁니다. 크롭은 디자이너가 정합니다.',
  },
  'detail-restage': {
    label: '넓은 프레임', ai: true,
    need: ['detail', 'model', 'main'],
    desc: '상세 컷을 배너 비율의 넓은 프레임으로 다시 찍습니다.',
    keep: 'product', keepPerson: 'person',
    scene:
      'a wide, calm interior with plenty of empty space — a pale wall, a bare floor and one '
      + 'piece of simple furniture. The subject sits well off to one side of the frame and the '
      + 'camera is far back, so most of the picture is quiet. Soft even daylight.',
  },
  'model-restage': {
    label: '모델 재촬영', ai: true, usesPlace: true,
    need: ['model', 'main', 'detail'],
    desc: '같은 모델·같은 옷으로 포즈와 장소를 바꿉니다.',
    keep: 'product', keepPerson: 'person',
    scene:
      '{PLACE}. The subject is re-staged completely — a different posture from the reference '
      + '(walking, turning, reaching or leaning), a different camera distance, shot the way a '
      + 'fashion photographer would shoot on location.',
  },
};

// 상세컷이 없는 상품 페이지에서는 '상세 원본'이 대표컷과 같은 사진이 되어
// 카드 두 장이 똑같아진다. 그럴 때 이 컷으로 바꿔 끼운다.
export const SPARE = {
  key: 'outdoor-place',
  label: '다른 장소', ai: true, usesPlace: true,
  need: ['main', 'model', 'packshot'],
  desc: '같은 상품을 다른 장소에서 다시 찍습니다.',
  keep: 'product', keepPerson: 'person',
  scene:
    '{PLACE}. The whole shot is re-staged for that place — new posture, new camera distance, '
    + 'and the daylight of that location.',
};

export const RECIPE_ORDER = [
  'main-original', 'studio-packshot', 'styling-set',
  'detail-crop', 'detail-restage', 'model-restage',
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

function pickFor(need, photos, used) {
  for (const role of need) {
    const i = photos.findIndex((p, idx) => p.role === role && !used.has(idx));
    if (i >= 0) return i;
  }
  for (const role of need) {
    const i = photos.findIndex(p => p.role === role);
    if (i >= 0) return i;
  }
  return 0;
}

export function createPlan(product, random = Math.random) {
  const hasBenefit = product.benefitConfirmed && product.benefitRate > 0 && product.benefitCondition;
  const types = shuffle(['product', 'usage', 'list', 'question', 'comparison',
    ...(hasBenefit ? ['benefit', 'numbers'] : product.salePrice ? ['numbers'] : [])], random);
  const layouts = shuffle(['header', 'split', 'split-right', 'band', 'top-center', 'top-left', 'bottom-right',
    ...(product.salePrice || hasBenefit ? ['offer'] : [])], random).slice(0, 6);

  const photos = (product.photos.length ? product.photos : [{}])
    .map((p, i) => ({ ...p, role: guessRole(p, i) }));
  const places = shuffle(PLACES, random);
  const used = new Set();
  const plainSeen = new Set();   // 그대로 쓰는 컷이 같은 사진을 두 번 집으면 카드가 겹친다
  let placeIndex = 0;

  return RECIPE_ORDER.map((key, i) => {
    let recipe = RECIPES[key], recipeKey = key;
    let photo = pickFor(recipe.need, photos, used);
    if (!recipe.ai) {
      if (plainSeen.has(photo)) { recipe = SPARE; recipeKey = SPARE.key; photo = pickFor(recipe.need, photos, used); }
      else plainSeen.add(photo);
    }
    used.add(photo);

    const src = photos[photo] || {};
    // 분류를 못 했으면 사람이 있는지 모른다. 모를 때 'product'를 쓰면
    // "사람을 넣지 마라"가 되어 모델컷에서 사람이 지워지고, 'person'을 쓰면
    // 단품컷에 없던 사람이 생긴다. 모를 때는 어느 쪽으로도 안 기우는 값을 쓴다.
    const known = 'hasPerson' in src;
    const person = !!src.hasPerson;
    const place = recipe.usesPlace ? places[placeIndex++ % places.length] : null;
    const scene = recipe.scene ? (place ? recipe.scene.replace('{PLACE}', place[1]) : recipe.scene) : '';

    return {
      id: i,
      recipe: recipeKey,
      // 예전 코드가 method로 갈래를 나눈다. 값을 유지해 호출부를 안 깨뜨린다.
      method: recipe.ai ? 'newscene' : 'original',
      label: recipe.label,
      desc: recipe.desc,
      layout: layouts[i],
      type: types[i % types.length],
      photo,
      photoRole: src.role,
      // 사람이 든 사진에 '상품만 지켜라'를 시키면 사람이 반쯤 지워진다.
      // 사진에 사람이 있는지 보고 지킬 것을 바꾼다.
      // 장면이 '사람 없음'을 못 박은 컷(keepPerson === 'item')은 사람 여부를
      // 몰라도 물건만 꺼내면 된다. 사람이 나와도 되는 컷만 subject로 미룬다.
      keep: !recipe.ai ? 'product'
        : recipe.keepPerson === 'item' ? (known && !person ? 'product' : 'item')
        : person ? 'person' : known ? 'product' : 'subject',
      sceneName: place ? recipe.label + ' · ' + place[0] : recipe.label,
      scene,
    };
  });
}
