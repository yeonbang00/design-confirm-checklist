// Browser counterpart: assets/reference-axes.mjs. Keep the vocabulary in sync.
//
// 이 저장소의 api/*는 서버리스 함수라 브라우저가 직접 가져다 쓸 수 없다.
// _studioData.js ↔ studio-data.mjs 와 같은 이유로 사본을 둔다.
// 값이 어긋나면 브라우저 쪽에서 라벨이 비어 보이므로 눈에 띈다.
//
// 축을 더하거나 값을 바꾸면 **두 파일을 같이 고쳐야 한다.**

export const AXES = {
  appeal: {
    ko: '소구', weight: 3,
    values: {
      discount: '할인·프로모션', newin: '신상·출시', material: '소재·품질',
      feature: '기능·성능', ease: '사용 편의', popular: '후기·인기',
      brand: '브랜드 가치', event: '이벤트·증정', price: '가격·구성',
      worry: '고민·불안 해결',
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
    ko: '거리', weight: 1, score: false,
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
