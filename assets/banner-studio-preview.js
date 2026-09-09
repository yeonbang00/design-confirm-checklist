// AdCheck studio preview. UI examples only; no AI or scraping requests.
'use strict';
const PHOTOS=[{url:'https://img.shinsegaetvshopping.com/goods/881/1002447881_l_20260813102447.png',label:'검은 티셔츠 원본',kind:'original'},{url:'https://img.shinsegaetvshopping.com/goods/881/1002447881_al_20260807085819.png',label:'크림 티셔츠 원본',kind:'original'},{url:'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/banner-concepts/1788843374409-6f2rvd-m89ukGBhLNgrA5O1tjI0scNDsxCUF5.png',label:'스튜디오 · 기존 AI 생성 예시',kind:'ai'},{url:'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/banner-concepts/1788843364424-3zex66-8wSBUGcHPC43DwFyASBN3bf5L8yXFU.png',label:'서가 · 기존 AI 생성 예시',kind:'ai'},{url:'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/banner-concepts/1788843367181-2q77j5-Jpi2FHPBGJdNX88rv7366GIvnbgI0V.png',label:'청록 조명 · 기존 AI 생성 예시',kind:'ai'}];
const SOURCE='https://www.shinsegaetvshopping.com/display/detail/1002447881';
const KEY='adcheck.studio.preview.saved.v1', RECIPE_KEY='adcheck.studio.preview.recipes.v1';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A small curated snapshot from the existing reference board, not live API sync.
const LIBRARY_SAMPLES=[{"brand": "COACH", "note": "NHN ADCOACH코치아울렛 단5일 세일, 가방 2종 노출", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-coach-fashion-coach-nhn-001-thumb-qehN61NNlt24NzwAWzHY0nJ1wz0GcH.jpg", "type": "benefit", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "DAKS", "note": "NHN ADDAKS닥스 슈즈 추석선물, 스니커즈 착용컷 10%+포장", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-daks-fashion-daks-nhn-004-thumb-hu2bvbnLuaxqcUIkUp9mIFhgYBf0rx.jpg", "type": "seasonal", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "DAKS", "note": "NHN ADDAKS닥스 로퍼 가을세일, 4컷 제품 디테일 노출", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-daks-fashion-daks-nhn-003-thumb-CrGhyZPOXSpV9ryUXYYLWNwgkyyX4k.jpg", "type": "product", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "W.CONCEPT", "note": "NHN ADW.CONCEPTW컨셉 더블유위크 럭키쿠폰, 풍선숫자로 90% 강조", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-w-concept-fashion-w-concept-nhn-003-thumb-o7MT8Ng1Aa4X7aTO5DgUXneLpSMWAG.jpg", "type": "numbers", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "W.CONCEPT", "note": "NHN ADW.CONCEPTW컨셉 어텀백 5종 플랫레이, 신규회원20%쿠폰", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-w-concept-fashion-w-concept-nhn-007-thumb-y2uDULgBBDQ3SmfdGMIWSIM3vmgH6k.jpg", "type": "list", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "아뜨랑스", "note": "NHN AD아뜨랑스아뜨랑스 삿포로 스냅 3컷, 여행·감성·데이트룩", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-%E1%84%8B%E1%85%A1%E1%84%84%E1%85%B3%E1%84%85%E1%85%A1%E1%86%BC%E1%84%89%E1%85%B3-fashion-%E1%84%8B%E1%85%A1%E1%84%84%E1%85%B3%E1%84%85%E1%85%A1%E1%86%BC%E1%84%89%E1%85%B3-nhn-004-thumb-C3xTjSv1zYhEXH8tpNx3vAg6wKtlFh.jpg", "type": "usage", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}];
const REF_TYPES={benefit:'혜택직관형',seasonal:'시즌이슈형',product:'제품단독형',numbers:'숫자강조형',list:'리스트형',usage:'사용장면형'};
const REF_GUIDES={benefit:'혜택을 먼저 읽게 하고 적용 조건을 가까이 둡니다.',seasonal:'계절과 착용 상황으로 도입합니다. 기간 한정 행사는 확인된 경우에만 씁니다.',product:'상품 형태와 디테일이 잘 보이도록 카피를 짧게 둡니다.',numbers:'확인된 판매가나 구성 수량을 크게 보여줍니다.',list:'구성과 색상을 나란히 비교합니다. 보유한 사진만 사용합니다.',usage:'어디서 어떻게 입을지 떠올리는 장면과 문구를 사용합니다.'};
let activeReference=null;
function referenceBrief(ref=activeReference){return ref?{...ref,typeLabel:REF_TYPES[ref.type],principle:REF_GUIDES[ref.type],use:'카피 구조·연출 방향 참고. 상품·혜택·로고 복제 금지.'}:null}
function referenceCopy(type){const benefit=$('#benefitCheck').checked;return {
 benefit:benefit?['카드 결제 시\n5% 할인','롯데·NH 카드 조건 · 79,000원','카드 할인 조건 보기']:['리브 티셔츠 4종','판매가 79,000원','4종 구성 보기'],
 seasonal:['가을의 일상에\n리브 한 장','블루핏 리브 티셔츠 4종','가을 티셔츠 보기'],
 product:['블루핏\n리브 티셔츠','4종 구성 · 판매가 79,000원','제품 자세히 보기'],
 numbers:['티셔츠 4종\n79,000원','블루핏 리브 티셔츠','4종 구성 확인하기'],
 list:['블랙부터 크림까지','블루핏 리브 티셔츠 4종','컬러 구성 보기'],
 usage:['출근부터 주말까지','일상에 더하는 블루핏 리브','티셔츠 살펴보기']
 }[type]}
function renderLibrary(){
 $('#libraryChoices').innerHTML=LIBRARY_SAMPLES.map((ref,i)=>`<button class="library-choice" data-reference="${i}" aria-pressed="${activeReference?.type===ref.type}"><img src="${ref.thumbUrl}" alt="${esc(ref.brand)} ${REF_TYPES[ref.type]} 참고 광고" loading="lazy"><strong>${REF_TYPES[ref.type]}</strong><span>${esc(ref.brand)}</span></button>`).join('');
 $('#librarySummary').textContent=activeReference?`참고 방향: ${REF_TYPES[activeReference.type]} · ${activeReference.brand}`:'AdCheck 레퍼런스로 방향 잡기 · 선택 사항';
 $('#referencePrinciple').textContent=activeReference?REF_GUIDES[activeReference.type]:'기존 패션 레퍼런스에서 유형별 사례 6개를 가져왔습니다. 전체 목록의 실시간 연결은 다음 단계입니다.';
 $('#clearReference').disabled=!activeReference;
 $$('[data-reference]').forEach(b=>b.onclick=()=>{activeReference=LIBRARY_SAMPLES[Number(b.dataset.reference)];renderLibrary();if(!isPlan())renderDirections();$(`[data-reference="${b.dataset.reference}"]`).focus({preventScroll:true});notify('참고 방향을 선택했습니다. 기존 편집 내용은 유지됩니다.')});
}
function updateReferenceEditor(){const v=variants[selected],ref=v?.reference;$('#editReference').textContent=ref?`참고 유형: ${ref.typeLabel} · ${ref.brand}`:'참고 유형 미적용';$('#applyReference').disabled=!activeReference;$('#applyReference').textContent=activeReference?`${REF_TYPES[activeReference.type]} 카피 예시 적용`:'2단계에서 참고 유형을 선택하세요';$('#reviewPoints').textContent='검토할 항목: 정보 정확성 · 위계 및 구조 · CTA 및 전환'+(v&&PHOTOS[v.photo].kind==='ai'?' · 합성 리얼리티 · 신체 비율 왜곡 · 광원-그림자 방향 일치':'');}
$('#clearReference').onclick=()=>{activeReference=null;renderLibrary();if(!isPlan())renderDirections()};
$('#applyReference').onclick=()=>{if(!activeReference)return;const v=variants[selected];[v.main,v.sub,v.cta]=referenceCopy(activeReference.type);v.reference=referenceBrief();v.copyEdited=false;v.original=false;renderBoard();fillEditor();notify('참고 유형의 예시 문구를 적용했습니다. 상품 사진과 조판은 유지됩니다.')};

const MODES={
 original:{name:'원본 + 템플릿',summary:'상품 사진은 그대로, 카피와 조판을 바꿉니다.',image:PHOTOS[0].url,caption:'블루핏 상품 원본'},
 scene:{name:'고정 장면에 상품 배치',summary:'배경·의자를 유지하고 상품을 바꿉니다.',image:'assets/studio-references/chair.webp',caption:'SSF SHOP 참고 사례'},
 outfit:{name:'모델 착장 교체',summary:'모델·포즈를 유지하고 지정한 옷을 바꿉니다.',image:PHOTOS[0].url,caption:'블루핏 모델 원본 · 교체 전 예시'},
 newscene:{name:'새로운 장면',summary:'같은 상품으로 새로운 배경과 분위기를 찾습니다.',image:PHOTOS[3].url,caption:'이전에 생성한 블루핏 AI 예시'}
};
const LAYOUTS={header:'헤더 + 상품',offer:'큰 가격·혜택',split:'좌측 카피·우측 사진','split-right':'좌측 사진·우측 카피',duo:'사진 2장 비교',band:'하단 정보 띠',price:'큰 가격 · 상단 좌측','top-center':'상단 중앙','top-left':'상단 좌측','bottom-right':'하단 우측'};
let step=0,selected=0,photo=0,mode='original',variants=[],choice=new Set([0,1,2,3,4,5]);
let saved=[],recipes=[],previousWorkspace=null,copyRound=0,timer,modeDrafts={};
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('#toast').hidden=true,4000)}
function readStore(key,valid){try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter(valid).slice(0,50):[]}catch{notify('저장 데이터를 읽지 못했습니다. 파일로 보관한 작업 정보를 확인해주세요.');return []}}
function writeStore(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true}catch{notify('브라우저 저장에 실패했습니다. 전달 파일로 보관해주세요.');return false}}
function validSaved(x){return x&&typeof x.id==='string'&&typeof x.productName==='string'&&typeof x.benefit==='string'&&Number.isFinite(Date.parse(x.savedAt))&&x.variant&&PHOTOS[x.variant.photo]&&LAYOUTS[x.variant.layout]&&['title','main','sub','cta'].every(k=>typeof x.variant[k]==='string')}
function validRecipe(x){return x&&typeof x.id==='string'&&['scene','outfit'].includes(x.mode)&&typeof x.name==='string'&&Number.isFinite(Date.parse(x.savedAt))&&Number.isInteger(x.productPhoto)&&x.productPhoto>=0&&x.productPhoto<2&&typeof x.notes==='string'&&['상품 영역','가디건만','안쪽 티셔츠만','상의 전체'].includes(x.range)}
saved=readStore(KEY,validSaved);recipes=readStore(RECIPE_KEY,validRecipe);
const planState={scene:{name:'창가 의자 · 상품 교체',range:'상품 영역',productPhoto:0,notes:'의자와 창가의 빛을 유지하고 상품이 닿는 부분의 그림자를 자연스럽게 연결해주세요.'},outfit:{name:'동일 모델 · 착장 교체',range:'상의 전체',productPhoto:0,notes:'얼굴·손·하의·포즈를 유지하고 지정한 상의만 교체해주세요.'}};
const isPlan=()=>mode==='scene'||mode==='outfit';
function defaults(){
 const benefit=$('#benefitCheck').checked, ai=mode==='newscene';
 const rows=[
 {title:'헤더 + 상품',main:'매일 입는\n블루핏 리브',sub:'티셔츠 4종 · 79,000원',cta:'4종 구성 보기',layout:'header',photo:photo},
 {title:benefit?'큰 할인율':'큰 판매가',main:benefit?'카드 결제 시':'리브 티셔츠 4종',sub:benefit?'롯데·NH 카드 조건\n판매가 79,000원':'블루핏 · 4종 구성',cta:benefit?'카드 할인 조건 보기':'구성 자세히 보기',offer:benefit?'5%':'79,000원',layout:'offer',photo:1-photo},
 {title:'좌우 분할',main:'일상에 더하는\n리브 한 장',sub:'블루핏 리브 티셔츠 4종',cta:'상품 자세히 보기',layout:'split-right',photo:photo},
 {title:ai?'상단 카피':'컬러 비교',main:ai?'오늘의 리브':'블랙부터 크림까지',sub:'블루핏 리브 티셔츠 4종',cta:'컬렉션 보기',layout:ai?'top-left':'duo',photo:0},
 {title:'하단 정보 띠',main:'블루핏 리브',sub:'티셔츠 4종 · 79,000원',cta:'4종 구성 보기',layout:'band',photo:1},
 {title:'화보 + 카피',main:ai?'빛이 머무는\n저녁의 리브':'오늘의 빛,\n오늘의 리브',sub:'BLUEFIT',cta:'티셔츠 살펴보기',layout:'bottom-right',photo:photo}
 ];
 return rows.map((v,i)=>({...v,...(activeReference?{main:referenceCopy(activeReference.type)[0],sub:referenceCopy(activeReference.type)[1],cta:referenceCopy(activeReference.type)[2],reference:referenceBrief()}:{}),photo:ai?[2,3,4,2,3,4][i]:v.photo,id:i,mode,showCta:i!==5,lockImage:true,lockLayout:false,original:false}));
}
function renderPhotos(){
 $('#heroPhoto').src=PHOTOS[photo].url;$('#heroPhoto').alt=PHOTOS[photo].label;
 $('#photoChoices').innerHTML=PHOTOS.slice(0,2).map((p,i)=>`<button class="thumb" data-photo="${i}" aria-label="${p.label}" aria-pressed="${photo===i}"><img src="${p.url}" alt="${p.label}"></button>`).join('');
 $$('[data-photo]').forEach(b=>b.onclick=()=>{photo=Number(b.dataset.photo);renderPhotos()});
}
function renderModes(){
 $('#productionModes').innerHTML=Object.entries(MODES).map(([key,m])=>`<button class="production-mode" data-mode="${key}" aria-pressed="${mode===key}"><div class="mode-image"><img src="${m.image}" alt="${m.caption}" loading="lazy"><span>${m.caption}</span></div><div class="mode-copy"><span class="mode-status">${mode===key?'선택됨':'선택'}</span><h3>${m.name}</h3><p>${m.summary}</p></div></button>`).join('');
 $$('[data-mode]').forEach(b=>b.onclick=()=>{if(mode===b.dataset.mode)return;modeDrafts[mode]={variants,choice:new Set(choice),selected};mode=b.dataset.mode;const cache=modeDrafts[mode];variants=cache?.variants||[];choice=cache?new Set(cache.choice):new Set([0,1,2,3,4,5]);selected=cache?.selected||0;renderDirections();$(`[data-mode="${mode}"]`).focus({preventScroll:true})});
}
function directionVariants(){if(variants.length===1&&typeof variants[0].id==='string')return variants;const prior=new Map(variants.map(v=>[v.id,v]));return defaults().map(v=>prior.get(v.id)||v)}
function renderDirections(){
 renderModes();$('#templateChoices').hidden=isPlan();$('#productionSetup').hidden=!isPlan();
 if(isPlan()){renderSetup()}else{
  $('#templateNote').textContent=mode==='original'?'상품 원본을 사용하는 6가지 조판입니다. 필요한 구성만 선택하세요.':'기존 AI 이미지 3장을 6가지 조판으로 비교합니다. 새 이미지 생성은 연결 전입니다.';
  $('#directions').innerHTML=directionVariants().map(v=>`<button class="direction" data-plan="${v.id}" aria-pressed="${choice.has(v.id)}">${art(v)}<div class="direction-copy"><span class="direction-state">${choice.has(v.id)?'선택됨':'선택'}</span><h3>${v.title}</h3><small>${mode==='original'?'상품 원본 유지':'기존 AI 생성 예시'}</small></div></button>`).join('');
  $$('[data-plan]').forEach(b=>b.onclick=()=>{const id=directionVariants().find(v=>String(v.id)===b.dataset.plan).id;choice.has(id)?choice.delete(id):choice.add(id);renderDirections();$(`[data-plan="${id}"]`).focus({preventScroll:true})});
 }updateStepNav();
}
function renderSetup(){
 const p=planState[mode],outfit=mode==='outfit';
 $('#referenceImage').src=MODES[mode].image;$('#referenceImage').alt=MODES[mode].caption;
 $('#referenceCaption').textContent=outfit?'블루핏 모델 원본 · 교체 전 예시입니다. 실제 사용할 모델과 교체 의류 자료를 준비해주세요.':'SSF SHOP 의자 연출 참고 · 상품이 없는 자체 배경으로 교체해야 합니다.';
 $('#recipeName').value=p.name;$('#recipeNotes').value=p.notes;
 $('#replaceRange').innerHTML=(outfit?['가디건만','안쪽 티셔츠만','상의 전체']:['상품 영역']).map(x=>`<option>${x}</option>`).join('');$('#replaceRange').value=p.range;
 $('#planProductPhoto').value=String(p.productPhoto);$('#planProductImage').src=PHOTOS[p.productPhoto].url;
 $('#keepElements').textContent=outfit?'고정: 모델의 얼굴·포즈·손·하의·배경':'고정: 의자·창문·식물·카메라 구도·빛 방향';
 $('#adjustElements').textContent=outfit?'조정: 지정한 의류·주름·몸에 맞는 착용 형태':'조정: 상품·접촉 그림자·의자에 걸친 형태';
 $('#sourceRequirements').textContent=outfit?'현재 블루핏 자료는 착용 사진입니다. 교체 의류의 고해상도 단품·정면·디테일 자료가 추가로 필요합니다.':'현재 참고 사진에는 다른 상품이 있습니다. 빈 장면과 교체 상품의 고해상도 단품 자료가 필요합니다.';
}
[['recipeName','name'],['recipeNotes','notes']].forEach(([id,key])=>$('#'+id).oninput=()=>{planState[mode][key]=$('#'+id).value;updateStepNav()});
$('#replaceRange').onchange=()=>planState[mode].range=$('#replaceRange').value;
$('#planProductPhoto').onchange=()=>{planState[mode].productPhoto=Number($('#planProductPhoto').value);$('#planProductImage').src=PHOTOS[planState[mode].productPhoto].url};
function validProduct(){const valid=$('#productName').value.trim()&&$('#factCheck').checked;$('#productError').hidden=!!valid;$('#productError').textContent=valid?'':'상품 정보를 확인하고 체크해주세요.';return !!valid}
function go(n){
 n=Math.max(0,Math.min(3,n));if(n>0&&n<3&&!validProduct())n=0;
 if(n===2&&!isPlan()&&!variants.length){variants=defaults().filter(v=>choice.has(v.id));if(!variants.length){n=1;notify('템플릿을 하나 이상 선택해주세요.')}}
 if(n===2&&isPlan()&&!planState[mode].name.trim()){n=1;notify('연출 설정 이름을 입력해주세요.')}
 step=n;['productStep','directionStep','boardStep','savedStep'].forEach((id,i)=>$('#'+id).hidden=i!==n);
 $$('[data-step]').forEach((b,i)=>{if(i===n)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
 if(n===1)renderDirections();
 if(n===2){$('#boardWorkspace').hidden=isPlan();$('#recipeReview').hidden=!isPlan();renderProductStrip();if(isPlan())renderRecipeReview();else{selected=Math.max(0,Math.min(selected,variants.length-1));renderBoard();fillEditor()}}
 if(n===3)renderSaved();updateStepNav();window.scrollTo({top:0,behavior:'instant'});
}
function openSelectedBoard(){if(!isPlan()){if(!choice.size)return;variants=directionVariants().filter(v=>choice.has(v.id));selected=0}go(2)}
function updateStepNav(){const names=['상품 확인','제작 방식',isPlan()?'연출 검토':'시안 비교·수정','저장·전달'];$('#stepPosition').textContent=`${step+1} / 4 · ${names[step]}`+(step===1&&!isPlan()?` · ${choice.size}개 선택`:'');$('#stepPrev').disabled=step===0;$('#stepNext').disabled=step===3||(step===1&&(isPlan()?!planState[mode].name.trim():!choice.size));$('#stepNext').textContent=step===1&&isPlan()?'연출 검토 ▶':'다음 ▶';$('#stepPrev').setAttribute('aria-label',step>0?`이전: ${names[step-1]}`:'이전 단계 없음');$('#stepNext').setAttribute('aria-label',step<3?`다음: ${names[step+1]}`:'마지막 단계');$('#stepThreeText').textContent=names[2]}
function art(v){return `<div class="art ${esc(v.layout)}${v.original?' original':''}"><img src="${PHOTOS[v.photo].url}" alt="${esc(PHOTOS[v.photo].label)}" loading="lazy">${v.layout==='duo'?`<img class="second-photo" src="${PHOTOS[v.photo===1?0:1].url}" alt="${esc(PHOTOS[v.photo===1?0:1].label)}" loading="lazy">`:''}<span class="brand">BLUEFIT</span><div class="copy"><span class="headline">${esc(v.main)}</span><span class="subline">${esc(v.sub)}</span>${v.layout==='offer'&&v.offer?`<strong class="offer-value">${esc(v.offer)}</strong>`:''}${v.showCta?`<span class="cta">${esc(v.cta)}</span>`:''}</div></div>`}
function renderProductStrip(){$('#stripPhoto').src=PHOTOS[isPlan()?planState[mode].productPhoto:photo].url;$('#stripName').textContent=$('#productName').value;$('#stripFacts').textContent='79,000원 · 4종 구성'+($('#benefitCheck').checked?' · 특정 카드 5% 조건 확인':' · 할인 혜택 미사용')}
function renderBoard(){
 $('#board').innerHTML=variants.map((v,i)=>`<article class="card"><button class="card-select" data-card="${i}" aria-label="${esc(v.title)} 시안 편집" aria-pressed="${selected===i}">${art(v)}</button><div class="card-meta"><div><strong>${esc(v.title)}</strong><small>${PHOTOS[v.photo].kind==='ai'?'기존 AI 생성 예시 · 상품 확인 필요':'상품 원본 활용'}</small></div><span class="badge">${selected===i?'수정 중':'시안 '+(i+1)}</span></div></article>`).join('');
 $$('[data-card]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.card);renderBoard();fillEditor();if(innerWidth<781){$('#editTitle').focus({preventScroll:true});$('.editor').scrollIntoView({behavior:'instant',block:'start'})}else $(`[data-card="${selected}"]`).focus({preventScroll:true})});
}
function copyFits(i){const card=$(`[data-card="${i}"]`);if(!card)return true;const a=card.querySelector('.art').getBoundingClientRect(),copy=card.querySelector('.copy'),r=copy.getBoundingClientRect();if(!r.width&&!r.height)return true;return r.left>=a.left-1&&r.right<=a.right+1&&r.top>=a.top-1&&r.bottom<=a.bottom+1&&copy.scrollWidth<=copy.clientWidth+1&&copy.scrollHeight<=copy.clientHeight+1}
function updateFit(){$('#fitWarning').hidden=copyFits(selected)}
function fillEditor(){const v=variants[selected];if(!v)return;$('#editIndex').textContent=`${selected+1} / ${variants.length} 시안`;$('#editTitle').textContent=v.title;$('#imageOrigin').textContent=PHOTOS[v.photo].label;$('#mainCopy').value=v.main;$('#subCopy').value=v.sub;$('#ctaCopy').value=v.cta;$('#showCta').checked=v.showCta;$('#originalView').checked=v.original;$('#layout').value=v.layout;$('#lockImage').checked=v.lockImage;$('#lockLayout').checked=v.lockLayout;$('#layout').disabled=v.lockLayout;$('#varyScene').disabled=v.lockImage&&v.lockLayout;$('#offerInfo').hidden=v.layout!=='offer'||!v.offer;$('#offerInfo').textContent=v.offer?`확인한 숫자: ${v.offer} · 상품 확인 단계의 조건을 사용합니다.`:'';updateFit();updateReferenceEditor()}
[['mainCopy','main'],['subCopy','sub'],['ctaCopy','cta']].forEach(([id,key])=>$('#'+id).oninput=()=>{if(variants[selected]){variants[selected][key]=$('#'+id).value;variants[selected].copyEdited=true;renderBoard();updateFit()}});
[['showCta','showCta'],['originalView','original'],['lockImage','lockImage'],['lockLayout','lockLayout']].forEach(([id,key])=>$('#'+id).onchange=()=>{if(variants[selected]){variants[selected][key]=$('#'+id).checked;renderBoard();fillEditor()}});
$('#layout').innerHTML=Object.entries(LAYOUTS).map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
$('#layout').onchange=()=>{const v=variants[selected];v.layout=$('#layout').value;if(v.layout==='offer'&&!v.offer)v.offer=$('#benefitCheck').checked?'5%':'79,000원';renderBoard();fillEditor()};
$('#varyCopy').onclick=()=>{const v=variants[selected];copyRound++;const options=[['리브 티셔츠\n4종을 한 번에','블루핏 · 판매가 79,000원','4종 구성 보기'],['매일 만나는\n블루핏 리브','티셔츠 4종 · 79,000원','상품 자세히 보기']];[v.main,v.sub,v.cta]=options[copyRound%2];v.reference=null;v.copyEdited=true;v.original=false;renderBoard();fillEditor();notify('선택한 시안의 카피만 변경했습니다.')};
$('#varyScene').onclick=()=>{const v=variants[selected],pool=(v.mode||mode)==='original'?[0,1]:[2,3,4];if(!v.lockImage)v.photo=pool[(pool.indexOf(v.photo)+1)%pool.length];if(!v.lockLayout){const list=['header','offer','split','split-right','band','bottom-right'];v.layout=list[(list.indexOf(v.layout)+1)%list.length];if(v.layout==='offer'&&!v.offer)v.offer=$('#benefitCheck').checked?'5%':'79,000원'}v.original=false;renderBoard();fillEditor();notify('고정한 요소를 유지하고 기존 예시만 변경했습니다. 실제 생성은 없습니다.')};
function snapshot(){return {variants,selected,photo,choice:new Set(choice),mode,activeReference,planState:JSON.parse(JSON.stringify(planState)),productName:$('#productName').value,benefit:$('#benefitCheck').checked}}
function preserveWorkspace(){if(!previousWorkspace&&(variants.length||isPlan()))previousWorkspace=snapshot();$('#restoreWorkspace').hidden=!previousWorkspace}
$('#restoreWorkspace').onclick=()=>{if(!previousWorkspace)return;({variants,selected,photo,choice,mode}=previousWorkspace);$('#productName').value=previousWorkspace.productName;$('#benefitCheck').checked=previousWorkspace.benefit;activeReference=previousWorkspace.activeReference;Object.assign(planState,previousWorkspace.planState);renderLibrary();previousWorkspace=null;$('#restoreWorkspace').hidden=true;go(2);notify('이전 작업을 복원했습니다.')};
$('#saveVariant').onclick=()=>{const v=variants[selected];if(!v)return;if(v.original){notify('원본 보기를 끄고 카피를 확인한 뒤 저장해주세요.');return}if(!copyFits(selected)){updateFit();$('#mainCopy').focus();notify('카피가 시안 영역을 벗어나 저장하지 않았습니다.');return}if(saved.length>=50){notify('시안은 최대 50개까지 저장할 수 있습니다.');return}const entry={id:crypto.randomUUID(),savedAt:new Date().toISOString(),productName:$('#productName').value,price:79000,quantity:4,sourceUrl:SOURCE,benefit:$('#benefitCheck').checked?'특정 롯데·NH 카드 5% 할인 조건 재확인 필요':'혜택 미사용',variant:{...v,original:false}};const next=[entry,...saved];if(!writeStore(KEY,next))return;saved=next;renderSaved();notify('이 브라우저에 시안을 저장했습니다.')};
function recipeData(){return {...planState[mode],name:planState[mode].name.trim(),mode,productName:$('#productName').value,sourceUrl:SOURCE,creativeReference:referenceBrief(),referenceUrl:MODES[mode].image,referenceOnly:true,generationStatus:'not-generated',kept:mode==='outfit'?['얼굴','포즈','손','하의','배경']:['의자','창문','식물','카메라 구도','빛 방향'],requirements:mode==='outfit'?['사용할 모델 원본','교체 의류의 고해상도 단품·디테일 자료']:['상품이 없는 자체 배경','교체 상품의 고해상도 단품 자료']}}
function renderRecipeReview(){const r=recipeData();$('#recipeReview').innerHTML=`<div class="review-title"><div><h2>생성 전, 바꿀 것과 지킬 것을 확인합니다.</h2><p class="description">${esc(MODES[mode].name)} · ${esc(r.name)}</p></div><span class="preview-tag">연출 설정 · 합성 결과 없음</span></div><div class="recipe-review-grid"><figure><img src="${MODES[mode].image}" alt="${esc(MODES[mode].caption)}"><figcaption>${esc(MODES[mode].caption)}<br>우리 상품의 생성 결과가 아닙니다.</figcaption></figure><figure><img src="${PHOTOS[r.productPhoto].url}" alt="사용할 블루핏 상품 자료"><figcaption>사용할 상품 자료 · ${esc(PHOTOS[r.productPhoto].label)}<br>교체 상품의 단품·디테일 자료 추가 필요</figcaption></figure><div class="recipe-summary"><h3>${esc(r.name)}</h3><dl><dt>유지할 요소</dt><dd>${r.kept.join(' · ')}</dd><dt>교체할 영역</dt><dd>${esc(r.range)}</dd><dt>카피·컨셉 참고</dt><dd>${r.creativeReference?esc(r.creativeReference.typeLabel+' · '+r.creativeReference.principle):'선택하지 않음'}</dd><dt>연출 지시</dt><dd>${esc(r.notes||'추가 지시 없음')}</dd><dt>실제 생성 전에 필요한 자료</dt><dd>${r.requirements.map(esc).join('<br>')}</dd></dl><p class="hint">원본과 결과를 나란히 확인하는 단계는 실제 합성을 연결할 때 추가합니다.</p><button class="btn primary" id="saveRecipe">이 연출 설정 저장</button></div></div>`;$('#saveRecipe').onclick=()=>{if(recipes.length>=50){notify('연출 설정은 최대 50개까지 저장할 수 있습니다.');return}const entry={...recipeData(),id:crypto.randomUUID(),savedAt:new Date().toISOString()};const next=[entry,...recipes];if(!writeStore(RECIPE_KEY,next))return;recipes=next;renderSaved();notify('연출 설정을 저장했습니다. 이미지 생성은 실행하지 않았습니다.')};}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function packageEntry(s){return {...s,image:{...PHOTOS[s.variant.photo]},images:s.variant.layout==='duo'?[PHOTOS[s.variant.photo],PHOTOS[s.variant.photo===1?0:1]]:[PHOTOS[s.variant.photo]],previewOnly:true,note:'최종 조판은 디자이너 진행. 혜택과 상품 일치 확인 필요.'}}
function packageRecipe(s){return {...s,productImage:PHOTOS[s.productPhoto],referenceImage:{url:MODES[s.mode].image,usage:MODES[s.mode].caption+'. 실제 사용할 배경/모델 원본으로 교체 필요.'},previewOnly:true}}
function renderSaved(){
 $('#savedCount').textContent=saved.length+recipes.length;$('#emptySaved').hidden=!!(saved.length+recipes.length);$('#exportAll').disabled=!(saved.length+recipes.length);$('#variantSavedTitle').hidden=!saved.length;$('#recipeSavedTitle').hidden=!recipes.length;
 $('#savedGrid').innerHTML=saved.map(s=>`<article class="saved-entry">${art(s.variant)}<h3 style="margin-top:12px">${esc(s.variant.title)}</h3><p class="hint">${esc(s.productName)} · ${new Date(s.savedAt).toLocaleDateString('ko-KR')}</p><div class="row"><button class="btn" data-load="${esc(s.id)}">다시 편집</button><button class="btn" data-export="${esc(s.id)}">전달 파일</button><button class="btn quiet" data-remove="${esc(s.id)}">삭제</button></div></article>`).join('');
 $('#recipeSavedGrid').innerHTML=recipes.map(r=>`<article class="recipe-saved"><img src="${MODES[r.mode].image}" alt="${esc(MODES[r.mode].caption)}"><div><span class="preview-tag">설정만 저장 · 합성 결과 없음</span><h3>${esc(r.name)}</h3><p class="hint">${MODES[r.mode].name} · ${esc(r.range)}<br>${esc(PHOTOS[r.productPhoto].label)}</p><div class="row"><button class="btn" data-reuse="${esc(r.id)}">설정 다시 사용</button><button class="btn" data-recipe-export="${esc(r.id)}">지시서 내려받기</button><button class="btn quiet" data-recipe-remove="${esc(r.id)}">삭제</button></div></div></article>`).join('');
 $$('[data-load]').forEach(b=>b.onclick=()=>{const s=saved.find(x=>x.id===b.dataset.load);preserveWorkspace();$('#productName').value=s.productName;$('#factCheck').checked=true;$('#benefitCheck').checked=s.benefit!=='혜택 미사용';activeReference=LIBRARY_SAMPLES.find(x=>x.type===s.variant.reference?.type)||null;renderLibrary();mode=s.variant.mode==='newscene'?'newscene':'original';variants=[{...s.variant,id:'saved-'+s.id+'-'+Date.now()}];choice=new Set([variants[0].id]);selected=0;go(2);notify('저장한 시안을 복사해 편집합니다. 저장본은 유지됩니다.')});
 $$('[data-export]').forEach(b=>b.onclick=()=>download(packageEntry(saved.find(x=>x.id===b.dataset.export)),'AdCheck-시안전달.json'));
 $$('[data-remove]').forEach(b=>b.onclick=()=>{const next=saved.filter(x=>x.id!==b.dataset.remove);if(writeStore(KEY,next)){saved=next;renderSaved();notify('저장함에서 삭제했습니다.')}});
 $$('[data-reuse]').forEach(b=>b.onclick=()=>{const r=recipes.find(x=>x.id===b.dataset.reuse);preserveWorkspace();modeDrafts[mode]={variants,choice:new Set(choice),selected};mode=r.mode;activeReference=LIBRARY_SAMPLES.find(x=>x.type===r.creativeReference?.type)||null;renderLibrary();planState[mode]={name:r.name,range:r.range,productPhoto:r.productPhoto,notes:r.notes};$('#factCheck').checked=true;go(1);notify('연출 설정을 불러왔습니다. 상품 자료와 교체 영역을 확인해주세요.')});
 $$('[data-recipe-export]').forEach(b=>b.onclick=()=>download(packageRecipe(recipes.find(x=>x.id===b.dataset.recipeExport)),'AdCheck-연출지시서.json'));
 $$('[data-recipe-remove]').forEach(b=>b.onclick=()=>{const next=recipes.filter(x=>x.id!==b.dataset.recipeRemove);if(writeStore(RECIPE_KEY,next)){recipes=next;renderSaved();notify('연출 설정을 삭제했습니다.')}});
}
$('#exportAll').onclick=()=>download({version:2,previewOnly:true,items:saved.map(packageEntry),recipes:recipes.map(packageRecipe)},'AdCheck-스튜디오-작업정보.json');
$('#openSaved').onclick=()=>go(3);$('#stepPrev').onclick=()=>go(step-1);$('#stepNext').onclick=()=>step===1?openSelectedBoard():step<3&&go(step+1);
$$('[data-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.step)));$$('[data-go]').forEach(b=>b.onclick=()=>go(Number(b.dataset.go)));
$('#benefitCheck').onchange=()=>{
 const benefit=$('#benefitCheck').checked;
 const update=list=>list.forEach(v=>{
  if(v.offer)v.offer=benefit?'5%':'79,000원';
  if(v.copyEdited)return;
  if(v.reference?.type==='benefit'){[v.main,v.sub,v.cta]=referenceCopy('benefit');return}
  if(v.id===1&&!v.reference){v.main=benefit?'카드 결제 시':'리브 티셔츠 4종';v.sub=benefit?'롯데·NH 카드 조건\n판매가 79,000원':'블루핏 · 4종 구성';v.cta=benefit?'카드 할인 조건 보기':'구성 자세히 보기';v.title=benefit?'큰 할인율':'큰 판매가'}
 });update(variants);Object.values(modeDrafts).forEach(x=>update(x.variants))
};
renderPhotos();renderSaved();renderLibrary();updateStepNav();
