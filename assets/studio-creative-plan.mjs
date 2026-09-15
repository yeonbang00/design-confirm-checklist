/* 실행 가능한 사진 편집·장면 후보만 묶는다. 미구현 그래픽 레시피는 선택하지 않는다. */
export function createCreativePlan(product, random=Math.random) {
  if(!/^(fashion-|beauty$)/.test(product.category||''))return null;
  const photos=product.photos||[];
  const usable=photos.map((p,i)=>({p,i})).filter(({p})=>p.role&&p.role!=='unusable'&&!p.isGift&&(p.sourceRegion||!(p.w&&p.h&&p.h/p.w>1.65))&&['none','hands','body'].includes(p.personKind));
  if(!usable.length)return null;
  const candidates=[];
  const add=(key,family,label,photo,layout,brief,extra={})=>candidates.push({
    key,family,label,photo,layout,copyBrief:brief,method:'original',emphasis:'product',...extra});
  const main=usable.find(x=>x.p.role==='main')||usable[0];
  add('hero','photo','대표 사진 화보',main.i,main.p.plainBg?'framed':'header',
    '이 사진에 보이는 상품을 중심으로 짧은 제목을 쓴다. 소재나 기능을 추측하지 않는다.');
  const detail=usable.find(x=>x.i!==main.i&&(x.p.sourceRegion||x.p.role==='detail'));
  if(detail)add('detail','photo','상세 사진 중심',detail.i,'top-center',
    '선택한 상세 사진에 실제 보이는 색상·형태·착장만 이야기한다. 접사라고 단정하지 않는다.');
  const body=usable.filter(x=>x.p.personKind==='body');
  if(body.length>=2)add('poses','editorial','착장 두 컷 편집',body[0].i,'duo-panel',
    '두 착장 사진을 함께 보여주는 편집 구성. 비교 우열이나 전후 효과를 만들지 않는다.',{photoSet:body.slice(0,2).map(x=>x.i)});
  const colors=[...new Map(usable.filter(x=>x.p.colorway).map(x=>[x.p.colorway,x])).values()];
  if(colors.length>=3)add('colors','collection','컬러 컬렉션',colors[0].i,'trio',
    '표시한 사진들의 색상 차이를 소개한다. 사진 수를 전체 판매 구성 수라고 표현하지 않는다.',{photoSet:colors.slice(0,3).map(x=>x.i)});
  if(Number.isFinite(product.salePrice)&&product.salePrice>0)add('price','type','가격 중심 포스터',main.i,'offer',
    '확인된 PRICE와 QUANTITY 토큰을 중심으로 쓴다. 할인 근거가 없으면 할인·특가·최저가를 쓰지 않는다.',{emphasis:'offer'});
  const cutKeys=new Set();
  for(const cut of product.cuts||[]) {
    if(!cut.scene||!['none','keep','hands'].includes(cut.person))continue;
    // 제형 확대는 생성으로 대체하지 않는다. 확인된 실제 제형 사진을 활용해야 한다.
    if(product.category==='beauty'&&(/macro/i.test(cut.name||'')||cut.distance==='extreme-close'))continue;
    const sources=usable.filter(x=>cut.person==='keep'?x.p.personKind==='body':cut.person==='hands'?['hands','body'].includes(x.p.personKind):true);
    if(!sources.length)continue;
    const source=sources.find(x=>cut.person==='none'&&['packshot','flat'].includes(x.p.role))||sources[0];
    const key=[cut.mount,cut.person,cut.angle,cut.distance].join('/');
    if(cutKeys.has(key))continue;cutKeys.add(key);
    const layout=cut.composition==='space-right'?'corner':cut.composition==='centered'?'top-center':'top-left';
    add('scene/'+key,'scene/'+(cut.mount||'studio'),cut.name||'새 장면',source.i,layout,
      '이 시안의 장면과 선택된 상품 색상을 함께 참고해 카피를 쓴다. 연출 소품을 판매 구성으로 설명하지 않는다.',{
        method:'newscene',scene:cut.scene,emphasis:cut.person==='keep'?'story':'product',
        keep:cut.person==='keep'?'person':cut.person==='hands'?'subject':source.p.hasPerson?'item':'product',
        axes:{...cut},mount:cut.mount,sourceCandidates:sources.map(x=>x.i)});
  }
  // 우선 2개의 원본 활용과 다른 장면을 탐색한다. 후보가 부족하면 실제 사진 구성을 더 사용한다.
  const selected=[],remaining=candidates.map(c=>({...c,tie:random()}));
  const take=predicate=>{
    const ranked=remaining.filter(predicate).sort((a,b)=>{
      const score=c=>(selected.some(x=>x.family===c.family)?0:10)
        +(selected.some(x=>x.photo===c.photo)?0:2)+c.tie;
      return score(b)-score(a);
    });
    if(!ranked.length)return false;
    const pick=ranked[0];
    if(pick.method==='newscene'){
      // 같은 첫 사진으로 모든 장면을 만들지 않는다. 사람 조건은 후보 생성 때 이미 확인했다.
      const rankedSources=pick.sourceCandidates.map(photo=>{
        const src=photos[photo];
        const repeats=selected.filter(x=>x.photo===photo).length;
        const colorRepeats=src.colorway?selected.filter(x=>photos[x.photo]?.colorway===src.colorway).length:0;
        const pack=pick.axes.person==='none'&&['packshot','flat'].includes(src.role)?1:0;
        return {photo,score:pack*3-repeats*2-colorRepeats};
      }).sort((a,b)=>b.score-a.score);
      pick.photo=rankedSources[0].photo;
      const src=photos[pick.photo];
      pick.keep=pick.axes.person==='keep'?'person':pick.axes.person==='hands'?'subject':src.hasPerson?'item':'product';
    }
    selected.push(pick);remaining.splice(remaining.indexOf(pick),1);return true;
  };
  take(c=>c.key==='hero');take(c=>c.method==='original'&&c.key!=='price');
  while(selected.length<6&&take(c=>c.method==='newscene'&&selected.filter(x=>x.family===c.family).length<2)){}
  while(selected.length<6&&take(c=>c.method==='original')){}
  // 충분한 자료가 없는 업종·상품은 기존 기획기가 처리한다. 가짜 레시피로 여섯을 채우지 않는다.
  if(selected.length<6)return null;
  // Generated set must also carry the verified offer; previously price was never selected.
  const offerScene=selected.find(c=>c.method==='newscene'&&c.axes.person==='none')||selected.find(c=>c.method==='newscene');
  if(offerScene&&Number(product.salePrice)>0){offerScene.emphasis='offer';offerScene.copyBrief='PRICE와 QUANTITY를 명확하게 전달한다. 구성 수량과 가격이 주인공인 짧은 카피. 할인율·최저가·마감은 만들지 않는다.';}
  return selected.map((c,id)=>{
    const source=photos[c.photo],made=c.method==='newscene';
    const kind=c.emphasis==='offer'?'numbers':c.emphasis==='story'?'usage':'product';
    return {...c,id,recipe:c.key,plannerVersion:'creative-v1',sceneName:c.label,desc:c.copyBrief,
      photoRole:source.role,photoSet:c.photoSet||null,scene:c.scene||'',keep:c.keep||'product',
      want:made?'scene':source.role==='model'?'model':source.role==='main'?'main':'detail',
      type:kind,angle:{id:kind,ko:c.emphasis==='offer'?'숫자강조형':c.emphasis==='story'?'사용장면형':'제품단독형',how:c.copyBrief,badge:''},
      sourceSummary:{role:source.role,colorway:source.colorway||'',personKind:source.personKind||'unknown',
        colors:(c.photoSet||[c.photo]).map(i=>photos[i].colorway||'').filter(Boolean)},
      imagePrompt:c.layout==='corner'?'Leave a clean wall on the RIGHT for copy. Keep the product on the LEFT.':
        c.layout==='top-center'?'Reserve clear space at TOP CENTER for the headline.':'Reserve clear space at TOP LEFT for the headline.',
      minimalCopy:made,render:'layer',madeByAi:made};
  });
}
