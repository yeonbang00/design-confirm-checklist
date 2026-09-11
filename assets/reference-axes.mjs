/* 레퍼런스 배너를 설명하는 축.
 *
 * 지금까지 레퍼런스 한 장이 가진 것은 브랜드·업종·유형 셋뿐이었다.
 * 그걸로 "비슷한 것"을 찾으면 화장품 혜택형 한 장에 109장이 걸린다.
 * 실측 — 업종x유형 조합 117개, 같은 태그를 공유하는 이웃 중앙값 16장,
 * 978장 중 194장은 이웃이 여섯도 안 된다. 양쪽으로 다 실패한다.
 *
 * 축은 새로 지어내지 않았다. 컷 후보를 받을 때 쓰는 축(api/productPhotos.js)과
 * 조판을 묶을 때 쓰는 시각 장치(studio-auto-plan.mjs DEVICE)를 그대로 가져오고,
 * 레퍼런스에만 필요한 것(소구·목표·덩어리·숫자)을 더했다.
 *
 * 여기가 단일 출처다. 서버 프롬프트도 화면 필터도 유사도 계산도 이 파일을 읽는다.
 */

export const AXES = {
  appeal: {
    ko: '소구', weight: 3,
    values: {
      discount: '할인·프로모션', newin: '신상·출시', material: '소재·품질',
      feature: '기능·성능', ease: '사용 편의', popular: '후기·인기',
      brand: '브랜드 가치', event: '이벤트·증정', price: '가격·구성',
    },
  },
  goal: {
    ko: '목표', weight: 1,
    values: {
      sale: '제품 판매', awareness: '브랜드 인지', install: '앱 설치',
      signup: '가입·상담', visit: '매장 방문',
    },
  },
  device: {
    ko: '시각 장치', weight: 4,
    values: {
      figure: '숫자 하이라이트', split: '좌우 면분할', overlay: '사진 위 글자',
      card: '카드·띠', type: '타이포 지배', grid: '격자 나열', hero: '인물 전면',
    },
  },
  person: {
    ko: '인물', weight: 2,
    values: {
      none: '없음', hands: '손·신체 일부', one: '모델 1인',
      many: '여러 명', character: '캐릭터·3D',
    },
  },
  distance: {
    ko: '거리', weight: 1,
    values: {
      macro: '표면 매크로', close: '부분 확대', product: '제품 전체',
      around: '주변까지', wide: '넓은 공간',
    },
  },
  background: {
    ko: '배경', weight: 1,
    values: {
      solid: '단색', gradient: '그라데이션', block: '색면 분할',
      studio: '스튜디오', texture: '질감 면', place: '실제 공간',
      illust: '합성·일러스트',
    },
  },
  palette: {
    ko: '색조', weight: 1,
    values: {
      'warm-neutral': '웜뉴트럴', 'cool-neutral': '쿨뉴트럴', mono: '모노크롬',
      contrast: '고대비', pastel: '파스텔', saturated: '채도 높음',
      earth: '어스톤', metallic: '메탈릭',
    },
  },
  chunks: {
    ko: '카피 덩어리', weight: 2,
    values: { '1': '1개', '2': '2개', '3': '3개', '4': '4개 이상' },
  },
  figure: {
    ko: '숫자 크기', weight: 2,
    values: {
      none: '없음', body: '본문 크기', headline: '헤드라인 크기', huge: '초대형',
    },
  },
};

export const AXIS_KEYS = Object.keys(AXES);
export const TOTAL_WEIGHT = AXIS_KEYS.reduce((s, k) => s + AXES[k].weight, 0);

/* 값이 목록에 있는 것만 남긴다. 모델이 새 값을 지어내면 필터도 유사도도 깨진다. */
export function cleanAxes(raw) {
  const out = {};
  for (const key of AXIS_KEYS) {
    const v = raw && raw[key];
    if (typeof v === 'string' && Object.hasOwn(AXES[key].values, v)) out[key] = v;
    else if (typeof v === 'number' && Object.hasOwn(AXES[key].values, String(v))) out[key] = String(v);
  }
  return out;
}

/* 겹친 축에 가중치를 매겨 점수를 낸다. 같은 장치와 같은 소구가 겹치는 것이
   같은 색조가 겹치는 것보다 훨씬 비슷하다는 뜻이므로 가중치를 나눠 뒀다.
   양쪽이 모두 가진 축만 분모에 넣는다. 태그가 덜 붙은 옛 소재가
   그 이유만으로 안 비슷해 보이면 안 된다. */
export function similarity(a, b) {
  let hit = 0, total = 0, shared = [];
  for (const key of AXIS_KEYS) {
    if (!a?.[key] || !b?.[key]) continue;
    total += AXES[key].weight;
    if (a[key] === b[key]) { hit += AXES[key].weight; shared.push(key); }
  }
  return { score: total ? hit / total : 0, shared, compared: total };
}

/* 왜 비슷한지 한 줄로. Fliption은 "제품·구성·소구가 비슷합니다"라고만 쓴다.
   축으로 재면 무엇이 같은지 그대로 보여줄 수 있다. */
export function whySimilar(shared) {
  return shared.map(k => AXES[k].ko).join(' · ');
}

export function rankSimilar(target, pool, limit = 6) {
  return pool
    .filter(x => x !== target)
    .map(x => ({ item: x, ...similarity(target.axes, x.axes) }))
    .filter(x => x.compared >= 4 && x.score > 0)
    .sort((p, q) => q.score - p.score)
    .slice(0, limit);
}
