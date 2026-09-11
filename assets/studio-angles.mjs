/* 광고 유형(설득 앵글).
 *
 * 열네 가지가 가이드 문서에도 있고 레퍼런스 이미지 분류기에도 있는데,
 * 정작 배너 생성에는 일곱 개만 들어가고 그마저 순서대로 돌려 쓰고 있었다.
 * 카피 생성에 넘기는 지시도 "각 구성마다 다른 설득 관점"이라는 한 줄이라
 * 목록 자체를 준 적이 없다. 그래서 여섯 장이 결국 비슷한 관점으로 모인다.
 *
 * 여기서 열네 가지를 한곳에 두고, 자료가 있는 것만 후보로 올린다.
 * 후기가 없는데 후기형을 만들 수는 없다. 가이드의 '필요한 자료'와 같은 규칙이다.
 */

export const ANGLES = [
  { id: 'product', ko: '제품단독형', badge: '제품',
    how: '상품 자체를 말한다. 형태·소재·마감을 한 가지만 짚는다.',
    fits: ['product'], need: () => true },
  { id: 'usage', ko: '사용장면형', badge: '이렇게',
    how: '언제 어디서 쓰는지를 말한다. 상황이 먼저 오고 상품은 뒤에 온다.',
    fits: ['story'], need: c => c.hasScene },
  { id: 'benefit', ko: '혜택직관형', badge: '혜택',
    how: '할인이나 조건을 먼저 읽히게 한다. 조건은 바로 옆에 붙인다.',
    fits: ['offer'], need: c => c.hasBenefit },
  { id: 'numbers', ko: '숫자강조형', badge: '숫자',
    how: '확인된 숫자 하나를 주인공으로 세운다. 나머지 말은 줄인다.',
    fits: ['offer'], need: c => c.hasPrice || c.hasNumberFact },
  { id: 'comparison', ko: '비교형', badge: '비교',
    how: '두 가지를 나란히 놓아 차이를 말한다. 경쟁 상대를 카피가 정한다.',
    fits: ['product', 'offer'], need: c => c.photoCount > 1 },
  { id: 'list', ko: '리스트형', badge: '포인트',
    how: '구성이나 특징을 짧게 나열한다. 세 개를 넘기지 않는다.',
    fits: ['product'], need: c => c.hasList },
  { id: 'question', ko: '질문형', badge: '질문',
    how: '고객이 속으로 하는 물음으로 시작하고 상품으로 답한다.',
    fits: ['story', 'product'], need: () => true },
  { id: 'testimonial', ko: '후기·인용형', badge: '실사용 후기',
    how: '후기 문장을 그대로 인용한다. 다듬으면 광고문이 되고 그대로 두면 증언이 된다.',
    fits: ['story', 'product'], need: c => c.hasReview },
  { id: 'problem', ko: '문제제기형', badge: '이런 적',
    how: '불편을 먼저 말하고 해결로 잇는다. 의심은 먼저 말한 쪽이 이긴다.',
    fits: ['story'], need: () => true },
  { id: 'beforeafter', ko: '비포애프터형', badge: '전 · 후',
    how: '전과 후를 나란히 말한다. 개선율보다 전후 두 숫자가 오래 남는다.',
    fits: ['offer', 'product'], need: c => c.hasBeforeAfter },
  { id: 'authority', ko: '권위형', badge: '인증',
    how: '시험·인증·순위를 근거로 든다. 근거의 출처를 반드시 함께 적는다.',
    fits: ['product'], need: c => c.hasAuthority },
  { id: 'seasonal', ko: '시즌이슈형', badge: '지금',
    how: '이 계절, 이 시기에 필요한 이유를 말한다. 기간 한정은 확인된 것만.',
    fits: ['story'], need: () => true },
  { id: 'event', ko: '이벤트·응모형', badge: '참여',
    how: '참여를 유도한다. 진행 중인 행사가 확인된 경우에만 쓴다.',
    fits: ['offer'], need: c => c.hasEvent },
  { id: 'character', ko: '캐릭터·일러스트형', badge: '',
    how: '브랜드 캐릭터로 분위기를 만든다.',
    fits: ['story'], need: c => c.hasCharacter },
];

export const angleById = id => ANGLES.find(a => a.id === id) || ANGLES[0];

/* 강조 방향(offer·product·story)에 맞는 앵글을 먼저 고른다. 혜택을 앞세우는
   판에 무드 앵글을 얹으면 조판과 카피가 따로 논다. 맞는 것이 떨어지면
   남은 후보에서, 그것도 떨어지면 처음부터 다시 돌려 쓴다. */
export function pickAngles(emphases, ctx, random = Math.random) {
  const pool = ANGLES.filter(a => a.need(ctx));
  const avail = pool.length ? pool : [ANGLES[0]];
  const used = new Set();
  const shuffled = arr => {
    const x = [...arr];
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };
  return emphases.map(em => {
    const free = avail.filter(a => !used.has(a.id));
    const bank = free.length ? free : (used.clear(), avail);
    const match = shuffled(bank).find(a => a.fits.includes(em));
    const pick = match || shuffled(bank)[0];
    used.add(pick.id);
    return pick;
  });
}

/* 사진과 상품 사실에서 어떤 앵글이 가능한지 읽는다. 없는 자료를 있다고
   하면 후기 없는 후기형이 나온다. 판정 근거는 전부 여기 한곳에 둔다. */
export function angleContext(product, photos = []) {
  const facts = Array.isArray(product.facts) ? product.facts : [];
  const text = facts.map(f => `${f.text || ''} ${f.source || ''}`).join(' ');
  const hasNum = s => /\d/.test(s);
  return {
    hasBenefit: !!(product.benefitConfirmed && product.benefitRate > 0 && product.benefitCondition),
    hasPrice: !!product.salePrice,
    hasNumberFact: facts.some(f => hasNum(f.text || '')),
    photoCount: photos.length,
    hasScene: photos.some(p => p.hasPerson) || photos.length > 1,
    hasList: !!product.quantity || facts.length >= 2,
    hasReview: facts.some(f => f.kind === 'review') || /후기|리뷰|구매평/.test(text),
    hasBeforeAfter: facts.some(f => f.kind === 'beforeafter') || /사용\s*전|전후|before/i.test(text),
    hasAuthority: facts.some(f => f.kind === 'authority')
      || /인증|시험|연구소|수상|1위|No\.?1|특허|임상/i.test(text),
    hasEvent: false,
    hasCharacter: false,
  };
}
