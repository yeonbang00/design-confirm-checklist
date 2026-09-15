// One brief drives both copy and complete-image composition.
export function artDirect(plans,product){
 const fashion=/fashion/.test(product.category||'');
 const directions=[
 ['editorial','Ivory editorial. A generous bold modern Korean sans-serif (Gothic) headline in a shallow top strip, dominant photograph filling the remaining canvas, small verified information along bottom. No pills or filled CTA buttons.','짧은 브랜드 광고 제목. 패션이면 계절·스타일을 자연스럽게 말한다. 상품명을 제목에 반복하지 않는다.'],
 ['collection','Pale sky blue and navy editorial collage. One dominant image in a large arch and one smaller secondary image, asymmetrical generous margins. Korean serif title, understated bottom information rule. No equal tile grid.','컬러나 착장 선택의 즐거움을 짧게 표현한다. 설명문이나 사진 해설을 쓰지 않는다.'],
 ['quiet','Warm architectural sunlight, product or model large. Large restrained medium-weight Korean sans-serif (Gothic) title in the natural empty space. One small bottom information line. No badges, pills or button bars.','오늘의 컬러처럼 실제 색상이나 일상 스타일에 연결하는 짧은 제목. 보이는 장면을 장황하게 묘사하지 않는다.'],
 ['graphic','Deep cobalt campaign poster, ivory and white. Bold Korean sans-serif headline. Make the verified quantity a giant sculptural numeral, using an abstract material inspired by the product; this is a graphic symbol, not a real product detail. Keep the actual product visible beneath it and the verified price prominent. Never invent quantity or discount.','확인된 구성 수량과 가격을 중심으로 한 짧고 힘있는 광고 제목. 수치는 토큰으로만 사용한다.'],
 ['catalogue','Crisp contemporary catalogue. Cobalt title block at upper left, warm white elsewhere. Large clean product presentation, bold Korean sans-serif headline and restrained aligned price. No generic pills.','상품의 선택 이유를 짧고 직접적으로 표현한다. 형용사를 이어 붙이지 않는다.'],
 ['portrait','Refined minimal campaign. Product or model occupies left two thirds, a calm ivory right third integrates elegant large Korean serif title, a fine rule and the verified price. Do not shrink the photograph to a thumbnail.','색상이나 상품을 고르는 순간을 짧게 표현한다. 한두 줄의 광고 제목으로 끝낸다.']
 ];
 return plans.map((p,i)=>{const [id,design,brief]=directions[i%directions.length];return {...p,completeBanner:true,artDirection:design,designId:id,copyBrief:p.copyBrief+' '+brief+' 메인 2줄 이내, 총 18자 안팎. 상단 라벨은 비운다. '+(fashion?'패션 잡지 광고 어조.':''),emphasis:i===3?'offer':p.emphasis};});
}
