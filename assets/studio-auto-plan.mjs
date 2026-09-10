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

export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* 스타일링 세트만 코드가 갖고 있다.
   이 컷의 값은 '세트가 고정'이라는 데 있다 — 같은 상품의 색상별로 돌리면
   SSF 배너처럼 한 시리즈로 묶인다. 매번 새로 지어내면 그 성질이 사라진다. */
const SET_BASE = 'Soft daylight from the left with a gentle contact shadow. '
  + 'Camera at the height of the prop, straight on, against a seamless warm-neutral backdrop. '
  + 'No person in the frame.';
export const SETS = {
  'fashion-top': 'a single wooden chair with a woven rattan back on a smooth pale floor; the garment is draped over its back and seat, falling naturally so its drape and thickness show. ' + SET_BASE,
  'fashion-outer': 'a single wooden chair with a woven rattan back on a smooth pale floor; the outerwear hangs over its back with one sleeve falling forward, showing its weight and length. ' + SET_BASE,
  'fashion-bottom': 'a low pale wooden bench; the garment is folded once and laid across it with the hem falling over the edge. ' + SET_BASE,
  shoes: 'a low pale stone plinth with a second, smaller step beside it; the pair stands on the plinth at a slight angle to each other. ' + SET_BASE,
  bag: 'a low pale wooden stool; the bag sits upright on it with its strap falling over the edge. ' + SET_BASE,
  accessory: 'a small pale stone tray on a linen cloth; the item rests at its centre. ' + SET_BASE,
  beauty: 'a pale stone shelf with a single dried stem lying beside it; the item stands upright on the shelf. ' + SET_BASE,
  food: 'a pale wooden serving board on a linen cloth; the food is arranged on the board as it would be served. ' + SET_BASE,
  kitchen: 'a pale stone counter with a folded linen cloth beside it; the item stands on the counter. ' + SET_BASE,
  home: 'a low pale wooden side table beside a plain upholstered chair; the item sits on the table. ' + SET_BASE,
  electronics: 'a low pale plinth on a smooth concrete floor; the item stands on the plinth at a three-quarter angle. ' + SET_BASE,
  kids: 'a small pale wooden child-size chair; the item is draped over its back or set on its seat. ' + SET_BASE,
  sports: 'a low pale wooden bench with a rolled towel at one end; the item rests on the bench. ' + SET_BASE,
  pet: 'a low pale wooden platform with a folded blanket beside it; the item sits on the platform. ' + SET_BASE,
  other: 'a single wooden chair with a woven rattan back on a smooth pale floor; the product rests on its seat, or is draped over its back if it is soft. ' + SET_BASE,
};

/* 서버가 컷 후보를 못 준 경우에만 쓰는 예비 목록. 상품을 모르는 채로 쓰는
   문장이라 어느 상품에나 어색하지 않을 만큼만 두루뭉술하다. */
export const FALLBACK_CUTS = [
  { name: '무지 스튜디오', person: 'none', scene: 'a seamless pale grey studio backdrop with a smooth concrete floor. The product stands alone, lit by one key light from the left and a soft fill from the front, with a clean contact shadow underneath. Camera at product height, three-quarter view. No person in the frame.' },
  { name: '질감 클로즈업', person: 'none', scene: 'a close, tightly framed studio shot that fills the frame with the surface of the product — its material, its seams and its finish. Soft directional light rakes across the surface. No person in the frame.' },
  { name: '창가 정물', person: 'none', scene: 'a pale wooden surface beside a window with a sheer curtain; the product sits on the surface with soft leaf shadows falling across it, and the rest of the frame stays empty. No person in the frame.' },
  { name: '플랫레이', person: 'none', scene: 'an overhead flat-lay on a pale linen cloth; the product is laid out neatly at the centre with generous empty cloth around it. Soft even daylight from above, camera looking straight down. No person in the frame.' },
  { name: '낮은 단', person: 'none', scene: 'a low pale stone plinth on a smooth concrete floor in a wide empty room; the product stands on the plinth with a long soft shadow beside it, and the rest of the frame stays bare. No person in the frame.' },
  { name: '넓은 실내', person: 'keep', scene: 'a wide, calm interior with plenty of empty space — a pale wall, a bare floor and one piece of simple furniture. The subject sits well off to one side and the camera is far back, so most of the picture is quiet. Soft even daylight.' },
  { name: '거리 오후', person: 'keep', scene: 'a sunlit city street with low buildings and street trees in late afternoon light. The subject is re-staged completely — a different posture and a different camera distance from the reference.' },
  { name: '공원 산책', person: 'keep', scene: 'a quiet park path with grass and out-of-focus trees under soft overcast light. The subject walks through the frame, re-staged with a new posture and a longer camera distance.' },
  { name: '자연광 실내', person: 'keep', scene: 'a bright apartment interior with a large window, a sheer curtain and a pale wooden floor. The subject is re-staged near the window with a relaxed posture and generous empty space beside them.' },
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

function pickPhoto(prefer, photos, used) {
  for (const role of prefer) {
    const i = photos.findIndex((p, idx) => p.role === role && !used.has(idx));
    if (i >= 0) return i;
  }
  for (const role of prefer) {
    const i = photos.findIndex(p => p.role === role);
    if (i >= 0) return i;
  }
  const free = photos.findIndex((_, idx) => !used.has(idx));
  return free >= 0 ? free : 0;
}

export function createPlan(product, random = Math.random) {
  const hasBenefit = product.benefitConfirmed && product.benefitRate > 0 && product.benefitCondition;
  const types = shuffle(['product', 'usage', 'list', 'question', 'comparison',
    ...(hasBenefit ? ['benefit', 'numbers'] : product.salePrice ? ['numbers'] : [])], random);
  /* 위치만 다른 조판(위/아래/좌/우)과 구성 자체가 다른 조판(카드·띠·초대형 숫자·구석)을
     섞는다. 위치만 여섯 개면 같은 배너를 여섯 번 본 느낌이 된다. */
  const layouts = shuffle(['header', 'split', 'split-right', 'band', 'top-center', 'top-left',
    'bottom-right', 'boxed', 'strip', 'corner',
    ...(product.salePrice || hasBenefit ? ['offer', 'numeral'] : [])], random).slice(0, 6);

  const photos = (product.photos.length ? product.photos : [{}])
    .map((p, i) => ({ ...p, role: guessRole(p, i) }));
  const anyPerson = photos.some(p => p.hasPerson);
  // 분류에 실패하면 hasPerson 자체가 없다. 그것을 '사람 없음'으로 읽으면
  // 사람이 나오는 후보가 전부 빠져 여섯 자리를 못 채운다. 모를 때는 남긴다.
  const personKnown = photos.some(p => 'hasPerson' in p);
  const allowKeep = anyPerson || !personKnown;
  const hasDetail = photos.some(p => p.role === 'detail');

  // 사람이 없는 상품에 '그 사람을 그대로 두고'를 시키면 없던 사람이 생긴다.
  const pool = shuffle(
    (product.cuts?.length ? product.cuts : FALLBACK_CUTS)
      .filter(c => allowKeep || c.person !== 'keep'),
    random);

  const used = new Set();
  const slots = [];

  // 1. 대표컷은 생성하지 않고 그대로 쓴다
  slots.push({ kind: 'plain', label: '메인 원본', desc: '상품 페이지 대표컷을 그대로 씁니다.', prefer: ['main'] });
  // 2. 상세컷이 있으면 그것도 그대로 쓴다. 없으면 그 자리도 생성 컷으로 채운다.
  if (hasDetail) {
    slots.push({ kind: 'plain', label: '상세 원본', desc: '상세 페이지 컷을 그대로 씁니다. 크롭은 디자이너가 정합니다.', prefer: ['detail'] });
  }
  // 3. 스타일링 세트는 상품 종류별로 고정한다
  slots.push({
    kind: 'set', label: '스타일링 세트',
    desc: '상품 종류에 맞는 고정 세트입니다. 색상별로 돌리면 한 시리즈가 됩니다.',
    scene: SETS[product.category] || SETS.other, person: 'none',
    prefer: ['packshot', 'flat', 'main', 'model'],
  });
  // 4. 나머지는 후보에서 뽑는다. 후보가 모자라면 예비 목록으로 채운다 —
  //    같은 후보를 두 번 넣으면 카드 두 장이 똑같아진다.
  const taken = new Set(pool.map(c => c.name));
  const topUp = FALLBACK_CUTS.filter(c => !taken.has(c.name) && (allowKeep || c.person !== 'keep'));
  const queue = [...pool, ...shuffle(topUp, random)];
  const last = FALLBACK_CUTS.filter(c => !taken.has(c.name));
  for (const cut of [...queue, ...last]) {
    if (slots.length >= 6) break;
    if (slots.some(x => x.label === cut.name)) continue;
    slots.push({
      kind: pool.includes(cut) ? 'made' : 'spare',
      label: cut.name,
      desc: pool.includes(cut) ? '이 상품에 맞춰 만든 장면입니다.' : '기본 장면입니다.',
      scene: cut.scene, person: cut.person,
      prefer: cut.person === 'keep' ? ['model', 'main'] : ['packshot', 'flat', 'main', 'model'],
    });
  }

  return shuffle(slots, random).map((slot, i) => {
    const photo = pickPhoto(slot.prefer, photos, used);
    used.add(photo);
    const src = photos[photo] || {};
    const known = 'hasPerson' in src;
    const person = !!src.hasPerson;
    return {
      id: i,
      recipe: slot.kind === 'set' ? 'styling-set' : slot.kind === 'plain' ? 'plain' : slot.kind,
      // 예전 코드가 method로 갈래를 나눈다. 값을 유지해 호출부를 안 깨뜨린다.
      method: slot.kind === 'plain' ? 'original' : 'newscene',
      label: slot.label,
      desc: slot.desc,
      layout: layouts[i],
      type: types[i % types.length],
      photo,
      photoRole: src.role,
      // 장면이 '사람 없음'을 못 박은 컷은 사람 여부를 몰라도 물건만 꺼내면 된다.
      // 사람이 나와도 되는 컷만, 모를 때 어느 쪽으로도 안 기우는 값으로 미룬다.
      keep: slot.kind === 'plain' ? 'product'
        : slot.person === 'none' ? (known && !person ? 'product' : 'item')
        : person ? 'person' : known ? 'product' : 'subject',
      sceneName: slot.label,
      scene: slot.scene || '',
      madeByAi: slot.kind === 'made',
    };
  });
}
