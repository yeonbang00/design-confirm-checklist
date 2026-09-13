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

/* 가중치를 다시 잡았다(2026-09-12).
 *
 * 이 화면은 디자이너가 본다. 무엇을 파는 광고인지보다 구도·모양·색감이
 * 먼저다. 그런데 표본 120장의 상위 6이웃 720쌍을 세어 보니 정반대였다.
 *
 *   소구 80.6% 일치   ← 내용인데 제일 잘 맞고
 *   주조색 56.9%      ← 색은 절반만 맞고
 *   색조 55.4%
 *   배경 44.4%        ← 제일 안 맞는다
 *
 * 반쯤은 색이 다른데 "비슷하다"고 말하고 있었다. 눈으로 보면 안 닮은
 * 것이 걸리는 이유가 이거다.
 *
 * 그래서 색과 배경을 올리고 소구를 내렸다. 같은 표본으로 다시 재면
 *
 *   주조색 56.9% → 81.7%   색조 55.4% → 76.4%   배경 44.4% → 71.5%
 *   시각 장치 92.5% → 84.0%  (여전히 가장 높다)
 *   소구 80.6% → 43.3%
 *
 * 색을 더 세게 준 안(주조색 7)도 재 봤는데 주조색이 90%까지 오르는 대신
 * 시각 장치가 77.9%로 내려갔다. 구도를 잃으면서 색만 맞추는 것은 손해라
 * 중간을 골랐다.
 */
export const AXES = {
  appeal: {
    ko: '소구', weight: 1,
    values: {
      discount: '할인·프로모션', newin: '신상·출시', material: '소재·품질',
      feature: '기능·성능', ease: '사용 편의', popular: '후기·인기',
      brand: '브랜드 가치', event: '이벤트·증정', price: '가격·구성',
      worry: '고민·불안 해결', guide: '정보·가이드',
    },
  },
  device: {
    ko: '시각 장치', weight: 5,
    values: {
      figure: '숫자 하이라이트', split: '좌우 면분할', overlay: '사진 위 글자',
      card: '카드·띠', type: '타이포 지배', grid: '격자 나열', hero: '인물 전면',
    },
  },
  person: {
    ko: '인물', weight: 3,
    values: {
      none: '없음', hands: '손·신체 일부', one: '모델 1인',
      many: '여러 명', character: '캐릭터·3D',
    },
  },
  distance: {
    ko: '거리', weight: 3,
    values: {
      macro: '표면 매크로', close: '부분 확대', product: '제품 전체',
      around: '주변까지', wide: '넓은 공간',
    },
  },
  background: {
    ko: '배경', weight: 4,
    values: {
      solid: '단색', gradient: '그라데이션', block: '색면 분할',
      studio: '스튜디오', texture: '질감 면', place: '실제 공간',
      illust: '합성·일러스트',
    },
  },
  palette: {
    ko: '색조', weight: 4,
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
    ko: '주조색', weight: 7,
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
    ko: '제품 노출', weight: 4,
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
  /* 여기까지가 "무엇이 담겼나"다. 아래 둘은 "어디에 놓였나"다.
     쓰다 보니 색은 잘 잡는데 디자인이 닮은 느낌이 안 난다는 말이 나왔다.
     실제로 열두 축을 놓고 보면 무엇이 있는지만 묻고 어디에 있는지는
     아무도 묻지 않는다. 시각 장치가 그나마 가깝지만 "숫자 하이라이트"는
     숫자가 크다는 뜻이지 그 숫자가 왼쪽 아래인지 가운데인지는 말이 없다.
     그래서 글자와 그림이 화면을 어떻게 나눠 쓰는지를 따로 묻는다. */
  layout: {
    ko: '배치', weight: 6,
    values: {
      top: '위 글자 · 아래 그림', bottom: '위 그림 · 아래 글자',
      left: '왼쪽 글자 · 오른쪽 그림', right: '왼쪽 그림 · 오른쪽 글자',
      corner: '한쪽 모서리에만 글자', over: '그림 위에 글자를 얹음',
      stack: '가운데로 모아 쌓음', grid: '여러 칸으로 나눔',
    },
  },
  space: {
    ko: '여백', weight: 2,
    values: { tight: '꽉 참', balanced: '보통', airy: '여백 많음' },
  },
  /* 글자의 성격. 빠진 것 중 가장 컸다. 명조로 짠 화보 배너와 굵은 고딕으로
     짠 할인 배너는 배치가 같아도 전혀 달라 보인다. */
  letter: {
    ko: '타이포', weight: 4,
    values: {
      'gothic-bold': '굵은 고딕', 'gothic': '보통 고딕', serif: '명조',
      hand: '손글씨·필기', condensed: '장평 좁은', latin: '영문 위주',
    },
  },
  /* 그림 자체가 무엇인가. 배경 축은 뒤가 무엇인지만 말한다.
     3D로 만든 낙하산 광고와 실사 촬영 광고는 배경이 같아도 다른 물건이다. */
  render: {
    ko: '그림 종류', weight: 4,
    values: { photo: '실사 사진', illust: '일러스트', cg: '3D·CG', composite: '합성' },
  },
  /* 아래 셋은 컷 후보 어휘(api/productPhotos.js)와 같은 값을 쓴다. 같은 말을
     쓰면 레퍼런스에서 읽은 값이 그대로 생성 지시가 된다. 김치를 그릇에
     담으라는 지시가 mount에서 나온다. */
  mount: {
    ko: '놓인 자리', weight: 2,
    values: {
      none: '없음', table: '테이블', plinth: '단상', shelf: '선반', held: '손에 들림',
      water: '물·액체', hanger: '옷걸이', floor: '바닥', location: '실제 공간',
    },
  },
  angle: {
    ko: '카메라 각도', weight: 1,
    values: { front: '정면', 'three-quarter': '45도', side: '측면', 'top-down': '부감', low: '로우앵글' },
  },
  light: {
    ko: '빛', weight: 1,
    values: {
      soft: '부드러운', hard: '딱딱한 그림자', back: '역광', window: '창가',
      golden: '황금시간', studio: '스튜디오', neon: '색조명',
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

/* 같은 브랜드를 통째로 빼고 있었다. 그 전제가 틀렸다.
   템플릿은 브랜드가 만든다. SSF SHOP이 상품마다 같은 틀을 쓰니 같은 틀의
   예시가 SSF SHOP에 몰려 있는 것이 당연하다. 템플릿을 찾겠다면서 브랜드를
   빼면 정답을 먼저 버린다.
   실측 — SSF SHOP 블랙야크 배너로 찾을 때 같은 틀인 빈폴키즈가 2위(0.54)인데
   같은 브랜드라 화면에는 한 장도 안 나왔다. 마리끌레르도 같은 틀 두 장이
   같은 이유로 빠졌다.
   그렇다고 다 열면 여섯 칸이 한 브랜드로 찬다. 두 장까지만 넣는다.
   가장 닮은 두 장으로 틀을 확인하고, 나머지 넷은 다른 브랜드가 그 틀을
   어떻게 풀었는지 보여준다. */
const SAME_BRAND_MAX = 2;
const sameBrand = (a, b) => {
  // 한글 완성형과 자모 분리형은 눈에 같고 문자열로 다르다. 맞춰 놓고 비교한다.
  const norm = v => String(v || '').normalize('NFC').trim().toLowerCase();
  const x = norm(a?.brandName), y = norm(b?.brandName);
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
/* 축이 열여덟이 되면서 점수 분포가 내려갔다. 축이 많아질수록 어긋날 자리도
   많아진다. 표본 150장으로 다시 재니 여섯째 이웃의 중앙값 0.55, 최저 0.46이다.
   문턱별로 여섯 칸을 채우는 소재를 세어 다시 잡는다.
     0.40  150/150
     0.45  150/150
     0.50  130/150
     0.55   79/150
   0.45로 내린다. 전원이 여섯 칸을 채우면서 중앙값보다 한참 아래라
   "비슷하다"는 말이 헐거워지지 않는다. */
export const SIMILAR_MIN = 0.45;

export function rankSimilar(target, pool, limit = 6, min = SIMILAR_MIN) {
  const stats = valueStats(pool);
  /* 같은 소재를 두 번 받아 오면 객체가 달라 자기 자신이 자기 비슷한 배너에 뜬다.
     화면은 업종별로 한 번, 전체로 한 번 받으므로 실제로 일어난다. */
  const self = target?.thumbUrl || '';
  const ranked = pool
    .filter(x => x !== target && !(self && x?.thumbUrl === self))
    .map(x => ({ item: x, ...similarity(target.axes, x.axes, stats) }))
    .filter(x => x.compared >= 4 && x.score >= min)
    .sort((p, q) => q.score - p.score);
  // 같은 브랜드는 점수 순으로 두 장까지만 통과시킨다.
  const out = [];
  let same = 0;
  for (const row of ranked) {
    if (out.length >= limit) break;
    if (sameBrand(row.item, target)) {
      if (same >= SAME_BRAND_MAX) continue;
      same += 1;
    }
    out.push(row);
  }
  return out;
}
