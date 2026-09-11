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
      worry: '고민·불안 해결', guide: '정보·가이드',
    },
  },
  goal: {
    ko: '목표', weight: 1, score: false,
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
  /* 색조는 '파스텔·고대비' 같은 성질이지 색 자체가 아니다. 실측 40장에서
     상위 쌍이 전부 핑크 계열이었는데 색조 축으로는 파스텔과 채도 높음으로
     갈렸다. 눈에 가장 먼저 들어오는 것을 축에서 빠뜨리고 있었다. */
  hue: {
    ko: '주조색', weight: 2,
    values: {
      neutral: '무채·화이트', black: '블랙', red: '레드', pink: '핑크',
      orange: '오렌지', yellow: '옐로', green: '그린', blue: '블루',
      purple: '퍼플', beige: '베이지·브라운',
    },
  },
  /* 톤앤매너. 색조·주조색이 '무슨 색'이라면 이쪽은 '어떤 느낌'이다.
     컷 후보를 받을 때 쓰는 mood 어휘를 그대로 가져왔다. */
  mood: {
    ko: '무드', weight: 2,
    values: {
      clean: '깔끔한', warm: '따뜻한', premium: '고급스러운', playful: '발랄한',
      fresh: '산뜻한', dramatic: '극적인', serene: '차분한', bold: '강한',
      nostalgic: '복고풍', minimal: '미니멀',
    },
  },
  subject: {
    ko: '제품 노출', weight: 3,
    values: {
      none: '제품 없음', single: '단품 하나', multiple: '여러 개 나열',
      inuse: '착용·사용 중', pack: '박스·구성품',
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

/* 흔한 값이 겹치는 것은 정보가 아니다.
   실측 — 표본 20장에서 '인물 없음' 85%, '목표 제품 판매' 75%, '거리 제품 전체' 70%.
   이 축들이 늘 겹치니 아무 두 장이나 유사도 0.41이 깔렸다. 기본 점수가 깔리면
   비슷한 것과 안 비슷한 것의 간격이 좁아진다.

   그래서 겹친 값이 무리 안에서 얼마나 흔한지를 보고 점수를 깎는다. 85%가 가진
   값이 겹치면 거의 안 쳐 주고, 10%만 가진 값이 겹치면 그대로 쳐 준다.
   무리에서 그때그때 세기 때문에 미리 계산해 둘 것이 없고, 태그가 늘어나면
   저절로 맞춰진다. */
export function valueStats(pool) {
  const n = pool.length || 1;
  const freq = {};
  for (const key of AXIS_KEYS) {
    freq[key] = {};
    for (const it of pool) {
      const v = it?.axes?.[key];
      if (v) freq[key][v] = (freq[key][v] || 0) + 1;
    }
  }
  return { n, freq };
}

/* 흔할수록 0에 가깝고 드물수록 1에 가깝다.
   곡선을 네 가지 재봤다(표본 20장, 쌍 190개). 1-share는 너무 깎아서
   눈으로 닮은 아토팜·BIODERMA가 3위로 밀렸다. sqrt가 중앙값을 0.33에서
   0.21로 낮추면서 닮은 쌍 둘을 1·2위에 남기고, 중앙값과 최대의 간격도
   0.56으로 가장 넓었다. */
function rarity(stats, key, value) {
  if (!stats) return 1;
  const c = stats.freq?.[key]?.[value] || 1;
  return Math.max(0.25, Math.sqrt(1 - c / stats.n));
}

export function similarity(a, b, stats = null) {
  let hit = 0, total = 0;
  const shared = [];
  for (const key of AXIS_KEYS) {
    if (AXES[key].score === false) continue;
    if (!a?.[key] || !b?.[key]) continue;
    const w = AXES[key].weight;
    total += w;
    if (a[key] === b[key]) {
      hit += w * rarity(stats, key, a[key]);
      shared.push(key);
    }
  }
  return { score: total ? hit / total : 0, shared, compared: total };
}

/* 왜 비슷한지 한 줄로. Fliption은 "제품·구성·소구가 비슷합니다"라고만 쓴다.
   축으로 재면 무엇이 같은지 그대로 보여줄 수 있다. */
export function whySimilar(shared) {
  return shared.map(k => AXES[k].ko).join(' · ');
}

/* 같은 브랜드 두 장이 닮은 것은 당연해서 레퍼런스로 쓸모가 없다.
   실측 — 표본 40장에서 1위가 LG유플러스 두 장(0.72)이었다.
   유사 광고가 답해야 하는 질문은 "다른 브랜드는 이 구성을 어떻게 풀었나"다. */
const sameBrand = (a, b) => {
  const x = String(a?.brandName || '').trim().toLowerCase();
  const y = String(b?.brandName || '').trim().toLowerCase();
  return !!x && x === y;
};

/* 이 점수 아래는 "비슷하다"고 말하지 않는다.
   40장 표본으로는 0.30이 한계였는데, 977장을 다 태깅하고 다시 재니 후보가
   늘어 문턱을 올릴 수 있었다. 표본 200장이 977장 전체에서 이웃을 몇 개
   얻는지 센 값이다.
     0.30  여섯 칸 채움 200/200
     0.35  200/200
     0.40  200/200
     0.45  196/200
     0.50  180/200
   0.40으로 올린다. 전원이 여섯 칸을 채우면서 상위 10%에 해당하는 선이라
   "비슷하다"는 말이 그만큼 무거워진다. */
export const SIMILAR_MIN = 0.4;

export function rankSimilar(target, pool, limit = 6, min = SIMILAR_MIN) {
  const stats = valueStats(pool);
  return pool
    .filter(x => x !== target && !sameBrand(x, target))
    .map(x => ({ item: x, ...similarity(target.axes, x.axes, stats) }))
    .filter(x => x.compared >= 4 && x.score >= min)
    .sort((p, q) => q.score - p.score)
    .slice(0, limit);
}
