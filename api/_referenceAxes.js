// Browser counterpart: assets/reference-axes.mjs. Keep the vocabulary in sync.
//
// 이 저장소의 api/*는 서버리스 함수라 브라우저가 직접 가져다 쓸 수 없다.
// _studioData.js ↔ studio-data.mjs 와 같은 이유로 사본을 둔다.
// 값이 어긋나면 브라우저 쪽에서 라벨이 비어 보이므로 눈에 띈다.
//
// 축을 더하거나 값을 바꾸면 **두 파일을 같이 고쳐야 한다.**

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
