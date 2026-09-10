import {createPlan} from './studio-auto-plan.mjs';
import {scrubLogo} from './studio-logo-scrub.mjs';
import {upgradePhotos} from './studio-photo-size.mjs';
import {checkBakedText} from './studio-text-check.mjs';
import {cutout,scrimFor} from './studio-pixels.mjs';
import {normalizeProduct,safeUrl,factSlots} from './studio-data.mjs';
// Product originals + editable designer drafts. Image synthesis is not connected.
'use strict';
const PHOTOS=[{url:'https://img.shinsegaetvshopping.com/goods/881/1002447881_l_20260813102447.png',label:'검은 티셔츠 원본',kind:'original'},{url:'https://img.shinsegaetvshopping.com/goods/881/1002447881_al_20260807085819.png',label:'크림 티셔츠 원본',kind:'original'},{url:'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/banner-concepts/1788843374409-6f2rvd-m89ukGBhLNgrA5O1tjI0scNDsxCUF5.png',label:'스튜디오 · 기존 AI 생성 예시',kind:'ai'},{url:'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/banner-concepts/1788843364424-3zex66-8wSBUGcHPC43DwFyASBN3bf5L8yXFU.png',label:'서가 · 기존 AI 생성 예시',kind:'ai'},{url:'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/banner-concepts/1788843367181-2q77j5-Jpi2FHPBGJdNX88rv7366GIvnbgI0V.png',label:'청록 조명 · 기존 AI 생성 예시',kind:'ai'}];
let SOURCE='https://www.shinsegaetvshopping.com/display/detail/1002447881';
let product={...normalizeProduct({productName:'블루핏 리브 티셔츠 4종',brand:'BLUEFIT',salePrice:79000,quantity:4},SOURCE),photos:PHOTOS.slice(0,2),benefitRate:5,benefitCondition:'롯데·NH 카드 결제 시'};
const SAMPLE_PHOTOS=PHOTOS.map(p=>({...p}));
const KEY='adcheck.studio.preview.saved.v1', RECIPE_KEY='adcheck.studio.preview.recipes.v1';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A small curated snapshot from the existing reference board, not live API sync.
let LIBRARY_SAMPLES=[{"brand": "COACH", "note": "NHN ADCOACH코치아울렛 단5일 세일, 가방 2종 노출", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-coach-fashion-coach-nhn-001-thumb-qehN61NNlt24NzwAWzHY0nJ1wz0GcH.jpg", "type": "benefit", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "DAKS", "note": "NHN ADDAKS닥스 슈즈 추석선물, 스니커즈 착용컷 10%+포장", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-daks-fashion-daks-nhn-004-thumb-hu2bvbnLuaxqcUIkUp9mIFhgYBf0rx.jpg", "type": "seasonal", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "DAKS", "note": "NHN ADDAKS닥스 로퍼 가을세일, 4컷 제품 디테일 노출", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-daks-fashion-daks-nhn-003-thumb-CrGhyZPOXSpV9ryUXYYLWNwgkyyX4k.jpg", "type": "product", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "W.CONCEPT", "note": "NHN ADW.CONCEPTW컨셉 더블유위크 럭키쿠폰, 풍선숫자로 90% 강조", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-w-concept-fashion-w-concept-nhn-003-thumb-o7MT8Ng1Aa4X7aTO5DgUXneLpSMWAG.jpg", "type": "numbers", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "W.CONCEPT", "note": "NHN ADW.CONCEPTW컨셉 어텀백 5종 플랫레이, 신규회원20%쿠폰", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-w-concept-fashion-w-concept-nhn-007-thumb-y2uDULgBBDQ3SmfdGMIWSIM3vmgH6k.jpg", "type": "list", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}, {"brand": "아뜨랑스", "note": "NHN AD아뜨랑스아뜨랑스 삿포로 스냅 3컷, 여행·감성·데이트룩", "thumbUrl": "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/reference/fashion/nhnad-%E1%84%8B%E1%85%A1%E1%84%84%E1%85%B3%E1%84%85%E1%85%A1%E1%86%BC%E1%84%89%E1%85%B3-fashion-%E1%84%8B%E1%85%A1%E1%84%84%E1%85%B3%E1%84%85%E1%85%A1%E1%86%BC%E1%84%89%E1%85%B3-nhn-004-thumb-C3xTjSv1zYhEXH8tpNx3vAg6wKtlFh.jpg", "type": "usage", "category": "fashion", "source": "AdCheck 이미지 레퍼런스 · 2026-09-09 확인"}];
const REF_TYPES={problem:'문제제기형',beforeafter:'비포애프터형',comparison:'비교형',testimonial:'후기·인용형',authority:'권위형',question:'질문형',character:'캐릭터·일러스트형',event:'이벤트·응모형',benefit:'혜택직관형',seasonal:'시즌이슈형',product:'제품단독형',numbers:'숫자강조형',list:'리스트형',usage:'사용장면형'};
const REF_GUIDES={benefit:'혜택을 먼저 읽게 하고 적용 조건을 가까이 둡니다.',seasonal:'계절과 착용 상황으로 도입합니다. 기간 한정 행사는 확인된 경우에만 씁니다.',product:'상품 형태와 디테일이 잘 보이도록 카피를 짧게 둡니다.',numbers:'확인된 판매가나 구성 수량을 크게 보여줍니다.',list:'구성과 색상을 나란히 비교합니다. 보유한 사진만 사용합니다.',usage:'어디서 어떻게 입을지 떠올리는 장면과 문구를 사용합니다.'};
let activeReference=null;
function referenceBrief(ref=activeReference){return ref?{...ref,typeLabel:REF_TYPES[ref.type],principle:(REF_GUIDES[ref.type]||'표현 방식과 카피 구조 참고'),use:'카피 구조·연출 방향 참고. 상품·혜택·로고 복제 금지.'}:null}
function referenceCopy(){const slots=factSlots(product);return [product.productName,slots.BENEFIT?product.benefitCondition:[slots.QUANTITY,slots.PRICE].filter(Boolean).join(' · ')||product.brand,'상품 자세히 보기']}
function renderLibrary(){
 $('#libraryChoices').innerHTML=LIBRARY_SAMPLES.map((ref,i)=>`<button class="library-choice" data-reference="${i}" aria-pressed="${activeReference?.thumbUrl===ref.thumbUrl}"><img src="${esc(ref.thumbUrl)}" alt="${esc(ref.brand)} ${REF_TYPES[ref.type]} 참고 광고" loading="lazy"><strong>${REF_TYPES[ref.type]}</strong><span>${esc(ref.brand)}</span></button>`).join('');
 $('#librarySummary').textContent=activeReference?`참고 방향: ${REF_TYPES[activeReference.type]} · ${activeReference.brand}`:'AdCheck 레퍼런스로 방향 잡기 · 선택 사항';
 $('#referencePrinciple').textContent=activeReference?(REF_GUIDES[activeReference.type]||'표현 방식과 카피 구조를 참고합니다.'):'참고 사례를 고르면 AI 카피에 분류와 설명을 전달합니다.';
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
const LAYOUTS={header:'헤더 + 상품',offer:'큰 가격·혜택',split:'좌측 카피·우측 사진','split-right':'좌측 사진·우측 카피',duo:'사진 2장 비교',band:'하단 정보 띠',price:'큰 가격 · 상단 좌측','top-center':'상단 중앙','top-left':'상단 좌측','bottom-right':'하단 우측',boxed:'사진 위 카피 카드',strip:'상하 띠 · 가운데 사진',numeral:'초대형 숫자',corner:'전면 사진 · 구석 카피',arch:'아치 사진 · 숫자 강조',badge:'전면 사진 · 우측 배지','type-diagonal':'대형 타이포 대각선',framed:'중앙 정렬 · 아치 프레임','duo-panel':'좌 연출컷 · 우 정보판'};
let step=0,selected=0,photo=0,mode='original',variants=[],choice=new Set([0,1,2,3,4,5]);
let saved=[],recipes=[],previousWorkspace=null,copyRound=0,timer,modeDrafts={};
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('#toast').hidden=true,4000)}
function readStore(key,valid){try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter(valid).slice(0,50):[]}catch{notify('저장 데이터를 읽지 못했습니다. 파일로 보관한 작업 정보를 확인해주세요.');return []}}
function writeStore(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true}catch{notify('브라우저 저장에 실패했습니다. 전달 파일로 보관해주세요.');return false}}
function validSaved(x){return x&&typeof x.id==='string'&&typeof x.productName==='string'&&typeof x.benefit==='string'&&Number.isFinite(Date.parse(x.savedAt))&&x.variant&&(x.variant.photos||PHOTOS)[x.variant.photo]&&LAYOUTS[x.variant.layout]&&['title','main','sub','cta'].every(k=>typeof x.variant[k]==='string')}
function validRecipe(x){return x&&typeof x.id==='string'&&['scene','outfit'].includes(x.mode)&&typeof x.name==='string'&&Number.isFinite(Date.parse(x.savedAt))&&Number.isInteger(x.productPhoto)&&x.productPhoto>=0&&x.productPhoto<(x.product?.photos?.length||2)&&typeof x.notes==='string'&&['상품 영역','가디건만','안쪽 티셔츠만','상의 전체'].includes(x.range)}
saved=readStore(KEY,validSaved);recipes=readStore(RECIPE_KEY,validRecipe);
const planState={scene:{name:'창가 의자 · 상품 교체',range:'상품 영역',productPhoto:0,notes:'의자와 창가의 빛을 유지하고 상품이 닿는 부분의 그림자를 자연스럽게 연결해주세요.'},outfit:{name:'동일 모델 · 착장 교체',range:'상의 전체',productPhoto:0,notes:'얼굴·손·하의·포즈를 유지하고 지정한 상의만 교체해주세요.'}};
const isPlan=()=>mode==='scene'||mode==='outfit';
function defaults(){
 const slots=factSlots(product), ai=mode==='newscene',photos=ai?SAMPLE_PHOTOS.slice(2):product.photos;
 return ['header','offer','split-right',photos.length>1?'duo':'split','band','bottom-right'].map((layout,i)=>({id:i,title:LAYOUTS[layout],main:product.productName,sub:slots.BENEFIT?product.benefitCondition:[slots.QUANTITY,slots.PRICE].filter(Boolean).join(' · ')||product.brand,cta:slots.BENEFIT?'혜택 조건 보기':'상품 자세히 보기',offer:slots.BENEFIT||slots.PRICE||'',layout,photo:ai?product.photos.length+i%3:(photo+i)%photos.length,brand:product.brand,benefitCondition:slots.BENEFIT?product.benefitCondition:'',mode,showCta:i!==5,lockImage:true,lockLayout:false,original:false}));
}
function renderPhotos(){
 $('#heroPhoto').src=PHOTOS[photo].url;$('#heroPhoto').alt=PHOTOS[photo].label;
 $('#photoChoices').innerHTML=product.photos.map((p,i)=>`<button class="thumb" data-photo="${i}" aria-label="${esc(p.label)}" aria-pressed="${photo===i}"><img src="${esc(p.url)}" alt="${esc(p.label)}"></button>`).join('');
 $$('[data-photo]').forEach(b=>b.onclick=()=>{photo=Number(b.dataset.photo);renderPhotos()});
}
function renderModes(){
 $('#productionModes').innerHTML=Object.entries(MODES).map(([key,m])=>`<button class="production-mode" data-mode="${key}" aria-pressed="${mode===key}"><div class="mode-image"><img src="${m.image}" alt="${m.caption}" loading="lazy"><span>${m.caption}</span></div><div class="mode-copy"><span class="mode-status">${mode===key?'선택됨':'선택'}</span><h3>${m.name}</h3><p>${m.summary}</p></div></button>`).join('');
 $$('[data-mode]').forEach(b=>b.onclick=()=>{if(mode===b.dataset.mode)return;modeDrafts[mode]={variants,choice:new Set(choice),selected};mode=b.dataset.mode;revision++;const cache=modeDrafts[mode];variants=cache?.variants||[];choice=cache?new Set(cache.choice):new Set([0,1,2,3,4,5]);selected=cache?.selected||0;renderDirections();$(`[data-mode="${mode}"]`).focus({preventScroll:true})});
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
 $('#planProductPhoto').innerHTML=product.photos.map((x,i)=>`<option value="${i}">${esc(x.label)}</option>`).join('');
 $('#referenceImage').src=MODES[mode].image;$('#referenceImage').alt=MODES[mode].caption;
 $('#referenceCaption').textContent=outfit?'블루핏 모델 원본 · 교체 전 예시입니다. 실제 사용할 모델과 교체 의류 자료를 준비해주세요.':'SSF SHOP 의자 연출 참고 · 상품이 없는 자체 배경으로 교체해야 합니다.';
 $('#recipeName').value=p.name;$('#recipeNotes').value=p.notes;
 $('#replaceRange').innerHTML=(outfit?['가디건만','안쪽 티셔츠만','상의 전체']:['상품 영역']).map(x=>`<option>${x}</option>`).join('');$('#replaceRange').value=p.range;
 $('#planProductPhoto').value=String(p.productPhoto);$('#planProductImage').src=PHOTOS[p.productPhoto].url;
 $('#keepElements').textContent=outfit?'고정: 모델의 얼굴·포즈·손·하의·배경':'고정: 의자·창문·식물·카메라 구도·빛 방향';
 $('#adjustElements').textContent=outfit?'조정: 지정한 의류·주름·몸에 맞는 착용 형태':'조정: 상품·접촉 그림자·의자에 걸친 형태';
 $('#sourceRequirements').textContent=outfit?'선택한 자료가 착용 사진인 경우, 교체 의류의 고해상도 단품·정면·디테일 자료가 추가로 필요합니다.':'현재 참고 사진에는 다른 상품이 있습니다. 빈 장면과 교체 상품의 고해상도 단품 자료가 필요합니다.';
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
/* 표시에 쓸 주소. 누끼 > 로고 지운 판 > 원본 순으로 고른다.
   누끼는 제품만 살아 있는 판이라 색면 조판에서 확 달라진다. */
const srcOf=p=>(p&&(p.cleanUrl||p.url))||'';
const artSrc=(p,layout)=>(p&&p.cutUrl&&['offer','type-diagonal','arch','framed','numeral'].includes(layout))?p.cutUrl:srcOf(p);
function art(v){const photos=v.photos||PHOTOS,p=photos[v.photo]||photos[0],pool=(v.mode||'original')==='original'?photos.filter(x=>x.kind==='original'):photos,second=pool[(pool.findIndex(x=>x.url===p.url)+1)%pool.length]||p;const cut=p&&p.cutUrl&&['offer','type-diagonal','arch','framed','numeral'].includes(v.layout);
 return `<div class="art ${esc(v.layout)}${v.original?' original':''}${v.baked?' baked':''}${cut?' has-cut':''}"><img src="${esc(artSrc(p,v.layout))}" alt="${esc(p.label)}" loading="lazy">${['duo','duo-panel'].includes(v.layout)?`<img class="second-photo" src="${esc(srcOf(second))}" alt="${esc(second.label)}" loading="lazy">`:''}<span class="brand">${esc(v.brand??'BLUEFIT')}</span><div class="copy"><span class="headline">${esc(v.main)}</span><span class="subline">${esc(v.sub)}</span>${['offer','numeral','arch','badge','type-diagonal','framed','duo-panel'].includes(v.layout)&&v.offer?`<strong class="offer-value">${esc(v.offer)}</strong>`:''}${v.showCta?`<span class="cta">${esc(v.cta)}</span>`:''}${v.benefitCondition?`<span class="benefit-condition">${esc(v.benefitCondition)}</span>`:''}</div></div>`}
function renderProductStrip(){$('#stripPhoto').src=PHOTOS[isPlan()?planState[mode].productPhoto:photo].url;$('#stripName').textContent=product.productName;$('#stripFacts').textContent=Object.values(factSlots(product)).join(' · ')}
function renderBoard(){
 $('#board').innerHTML=variants.map((v,i)=>`<article class="card"><button class="card-select" data-card="${i}" aria-label="${esc(v.title)} 시안 편집" aria-pressed="${selected===i}">${art(v)}</button><div class="card-meta"><div><strong>${esc(v.title)}</strong><small>${PHOTOS[v.photo].kind==='ai'?'기존 AI 생성 예시 · 상품 확인 필요':'상품 원본 활용'}</small></div><span class="badge">${selected===i?'수정 중':'시안 '+(i+1)}</span></div><button class="btn card-dl" data-dlimg="${i}">이미지 내려받기</button></article>`).join('');
 $$('[data-dlimg]').forEach(b=>b.onclick=e=>{e.stopPropagation();downloadImage(Number(b.dataset.dlimg))});
 $$('[data-card]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.card);renderBoard();fillEditor();if(innerWidth<781){$('#editTitle').focus({preventScroll:true});$('.editor').scrollIntoView({behavior:'instant',block:'start'})}else $(`[data-card="${selected}"]`).focus({preventScroll:true})});
}
function copyFits(i){const card=$(`[data-card="${i}"]`);if(!card)return true;const a=card.querySelector('.art').getBoundingClientRect(),copy=card.querySelector('.copy'),r=copy.getBoundingClientRect();if(!r.width&&!r.height)return true;return r.left>=a.left-1&&r.right<=a.right+1&&r.top>=a.top-1&&r.bottom<=a.bottom+1&&copy.scrollWidth<=copy.clientWidth+1&&copy.scrollHeight<=copy.clientHeight+1}
function updateFit(){$('#fitWarning').hidden=copyFits(selected)}
$('#layout').innerHTML=Object.entries(LAYOUTS).map(([k,label])=>`<option value="${k}">${label}</option>`).join('');
function fillEditor(){const v=variants[selected];if(!v)return;$('#conceptInfo').textContent=v.concept?'컨셉: '+v.concept:'기본 조판 · AI 카피 생성 전';$('#editIndex').textContent=`${selected+1} / ${variants.length} 시안`;$('#editTitle').textContent=v.title;$('#imageOrigin').textContent=PHOTOS[v.photo].label;$('#mainCopy').value=v.main;$('#subCopy').value=v.sub;$('#ctaCopy').value=v.cta;$('#showCta').checked=v.showCta;$('#originalView').checked=v.original;$('#layout').value=v.layout;$('#lockImage').checked=v.lockImage;$('#lockLayout').checked=v.lockLayout;$('#layout').disabled=v.lockLayout;$('#varyScene').disabled=v.lockImage&&v.lockLayout;$('#offerInfo').hidden=v.layout!=='offer'||!v.offer;$('#offerInfo').textContent=v.offer?`확인한 숫자: ${v.offer} · 상품 확인 단계의 조건을 사용합니다.`:'';updateFit();updateReferenceEditor()}
[['mainCopy','main'],['subCopy','sub'],['ctaCopy','cta']].forEach(([id,key])=>$('#'+id).oninput=()=>{if(variants[selected]){variants[selected][key]=$('#'+id).value;variants[selected].copyEdited=true;revision++;renderBoard();updateFit()}});
[['showCta','showCta'],['originalView','original'],['lockImage','lockImage'],['lockLayout','lockLayout']].forEach(([id,key])=>$('#'+id).onchange=()=>{if(variants[selected]){variants[selected][key]=$('#'+id).checked;renderBoard();fillEditor()}});
$('#layout').innerHTML=Object.entries(LAYOUTS).map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
$('#layout').onchange=()=>{const v=variants[selected];v.layout=$('#layout').value;if(v.layout==='offer'&&!v.offer)v.offer=factSlots(product).BENEFIT||factSlots(product).PRICE||'';renderBoard();fillEditor()};
$('#varyCopy').onclick=()=>generateCopies(true);
$('#varyScene').onclick=()=>{const v=variants[selected];v.photos=undefined;const pool=(v.mode||mode)==='original'?product.photos.map((_,i)=>i):PHOTOS.map((p,i)=>p.kind==='ai'?i:-1).filter(i=>i>=0);if(!v.lockImage)v.photo=pool[(pool.indexOf(v.photo)+1)%pool.length];if(!v.lockLayout){const list=['header','offer','split','split-right','band','bottom-right'];v.layout=list[(list.indexOf(v.layout)+1)%list.length];if(v.layout==='offer'&&!v.offer)v.offer=factSlots(product).BENEFIT||factSlots(product).PRICE||''}v.original=false;renderBoard();fillEditor();notify('고정한 요소를 유지하고 사진·조판을 변경했습니다.')};
function snapshot(){return {variants,selected,photo,choice:new Set(choice),mode,activeReference,planState:JSON.parse(JSON.stringify(planState)),product:structuredClone(product),productName:$('#productName').value,benefit:$('#benefitCheck').checked}}
function preserveWorkspace(){if(!previousWorkspace&&(variants.length||isPlan()))previousWorkspace=snapshot();$('#restoreWorkspace').hidden=!previousWorkspace}
$('#restoreWorkspace').onclick=()=>{if(!previousWorkspace)return;setProduct(previousWorkspace.product);({variants,selected,photo,choice,mode}=previousWorkspace);$('#productName').value=previousWorkspace.productName;$('#benefitCheck').checked=previousWorkspace.benefit;$('#factCheck').checked=true;activeReference=previousWorkspace.activeReference;Object.assign(planState,previousWorkspace.planState);renderLibrary();previousWorkspace=null;$('#restoreWorkspace').hidden=true;go(2);notify('이전 작업을 복원했습니다.')};
$('#saveVariant').onclick=()=>{const v=variants[selected];if(!v)return;if(v.original){notify('원본 보기를 끄고 카피를 확인한 뒤 저장해주세요.');return}if(!copyFits(selected)){updateFit();$('#mainCopy').focus();notify('카피가 시안 영역을 벗어나 저장하지 않았습니다.');return}if(saved.length>=50){notify('시안은 최대 50개까지 저장할 수 있습니다.');return}const entry={id:crypto.randomUUID(),savedAt:new Date().toISOString(),productName:$('#productName').value,price:product.salePrice,quantity:product.quantity,sourceUrl:SOURCE,product:structuredClone(product),benefit:factSlots(product).BENEFIT?factSlots(product).BENEFIT+' · '+product.benefitCondition:'혜택 미사용',variant:{...v,photos:structuredClone(PHOTOS),brand:product.brand,original:false}};const next=[entry,...saved];if(!writeStore(KEY,next))return;saved=next;renderSaved();notify('이 브라우저에 시안을 저장했습니다.')};
function recipeData(){return {...planState[mode],product:structuredClone(product),name:planState[mode].name.trim(),mode,productName:$('#productName').value,sourceUrl:SOURCE,creativeReference:referenceBrief(),referenceUrl:MODES[mode].image,referenceOnly:true,generationStatus:'not-generated',kept:mode==='outfit'?['얼굴','포즈','손','하의','배경']:['의자','창문','식물','카메라 구도','빛 방향'],requirements:mode==='outfit'?['사용할 모델 원본','교체 의류의 고해상도 단품·디테일 자료']:['상품이 없는 자체 배경','교체 상품의 고해상도 단품 자료']}}
function renderRecipeReview(){const r=recipeData();$('#recipeReview').innerHTML=`<div class="review-title"><div><h2>생성 전, 바꿀 것과 지킬 것을 확인합니다.</h2><p class="description">${esc(MODES[mode].name)} · ${esc(r.name)}</p></div><span class="preview-tag">연출 설정 · 합성 결과 없음</span></div><div class="recipe-review-grid"><figure><img src="${MODES[mode].image}" alt="${esc(MODES[mode].caption)}"><figcaption>${esc(MODES[mode].caption)}<br>우리 상품의 생성 결과가 아닙니다.</figcaption></figure><figure><img src="${PHOTOS[r.productPhoto].url}" alt="사용할 상품 자료"><figcaption>사용할 상품 자료 · ${esc((r.product?.photos||SAMPLE_PHOTOS)[r.productPhoto].label)}<br>교체 상품의 단품·디테일 자료 추가 필요</figcaption></figure><div class="recipe-summary"><h3>${esc(r.name)}</h3><dl><dt>유지할 요소</dt><dd>${r.kept.join(' · ')}</dd><dt>교체할 영역</dt><dd>${esc(r.range)}</dd><dt>카피·컨셉 참고</dt><dd>${r.creativeReference?esc(r.creativeReference.typeLabel+' · '+r.creativeReference.principle):'선택하지 않음'}</dd><dt>연출 지시</dt><dd>${esc(r.notes||'추가 지시 없음')}</dd><dt>실제 생성 전에 필요한 자료</dt><dd>${r.requirements.map(esc).join('<br>')}</dd></dl><p class="hint">원본과 결과를 나란히 확인하는 단계는 실제 합성을 연결할 때 추가합니다.</p><button class="btn primary" id="saveRecipe">이 연출 설정 저장</button></div></div>`;$('#saveRecipe').onclick=()=>{if(recipes.length>=50){notify('연출 설정은 최대 50개까지 저장할 수 있습니다.');return}const entry={...recipeData(),id:crypto.randomUUID(),savedAt:new Date().toISOString()};const next=[entry,...recipes];if(!writeStore(RECIPE_KEY,next))return;recipes=next;renderSaved();notify('연출 설정을 저장했습니다. 이미지 생성은 실행하지 않았습니다.')};}
/* 이미지 내려받기.
   a[download]는 다른 도메인 파일에는 무시돼서 새 탭으로 열리기만 한다.
   AI 생성물은 Vercel Blob, 원본은 쇼핑몰 CDN이라 둘 다 다른 도메인이다.
   그래서 바이트를 받아 blob으로 저장한다. CORS가 막힌 몰(홈플러스·더현대)은
   그것마저 안 되므로 새 탭으로 열어 직접 저장하시게 안내한다. */
function imageFileName(v,i){
  const base=(product.productName||'banner').replace(/[^\w가-힣]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
  const photo=PHOTOS[v.photo]||{};
  const tag=photo.kind==='ai'?'AI':(photo.cleanUrl?'원본-로고제거':'원본');
  const scene=(photo.label||'').split('·')[0].trim().replace(/\s+/g,'') || ('시안'+(i+1));
  const ext=photo.cleanUrl?'png':(String(photo.url||'').split('?')[0].match(/\.(png|jpe?g|webp)$/i)||[,'png'])[1];
  return `${base}_${i+1}_${tag}_${scene}.${ext}`;
}
async function downloadImage(i){
  const v=variants[i]; if(!v) return;
  const url=srcOf(PHOTOS[v.photo]);
  if(!url){ notify('이 시안에는 아직 이미지가 없습니다.'); return; }
  // 로고를 지운 판은 data: URL이라 그냥 저장하면 된다
  if(url.startsWith('data:')){
    const a=document.createElement('a'); a.href=url; a.download=imageFileName(v,i);
    document.body.appendChild(a); a.click(); a.remove(); return;
  }
  try{
    const r=await fetch(url,{mode:'cors'});
    if(!r.ok) throw Error('status '+r.status);
    const blob=await r.blob(), obj=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=obj; a.download=imageFileName(v,i);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(obj),4000);
  }catch(e){
    window.open(url,'_blank','noopener');
    notify('이 쇼핑몰 이미지는 바로 저장이 안 됩니다. 새 탭에서 우클릭 → 이미지 저장으로 받아주세요.');
  }
}
async function downloadAllImages(){
  const ready=variants.map((v,i)=>srcOf(PHOTOS[v.photo])?i:-1).filter(i=>i>=0);
  if(!ready.length){ notify('내려받을 이미지가 없습니다.'); return; }
  for(const i of ready){ await downloadImage(i); await new Promise(r=>setTimeout(r,400)); }
  notify(`이미지 ${ready.length}장을 내려받았습니다. 조판은 포토샵에서 하시면 됩니다.`);
}

function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function packageEntry(s){const photos=s.variant.photos||SAMPLE_PHOTOS;return {...s,image:{...photos[s.variant.photo]},images:s.variant.layout==='duo'?[photos[s.variant.photo],photos.filter(x=>x.kind==='original')[(photos.filter(x=>x.kind==='original').findIndex(x=>x.url===photos[s.variant.photo].url)+1)%photos.filter(x=>x.kind==='original').length]||photos[s.variant.photo]]:[photos[s.variant.photo]],previewOnly:false,note:'최종 조판은 디자이너 진행. 혜택과 상품 일치 확인 필요.'}}
function packageRecipe(s){return {...s,productImage:(s.product?.photos||SAMPLE_PHOTOS)[s.productPhoto],referenceImage:{url:s.referenceUrl||(s.mode==='outfit'?(s.product?.photos||SAMPLE_PHOTOS)[0].url:MODES.scene.image),usage:MODES[s.mode].caption+'. 실제 사용할 배경/모델 원본으로 교체 필요.'},previewOnly:true}}
function renderSaved(){
 $('#savedCount').textContent=saved.length+recipes.length;$('#emptySaved').hidden=!!(saved.length+recipes.length);$('#exportAll').disabled=!(saved.length+recipes.length);$('#variantSavedTitle').hidden=!saved.length;$('#recipeSavedTitle').hidden=!recipes.length;
 $('#savedGrid').innerHTML=saved.map(s=>`<article class="saved-entry">${art(s.variant)}<h3 style="margin-top:12px">${esc(s.variant.title)}</h3><p class="hint">${esc(s.productName)} · ${new Date(s.savedAt).toLocaleDateString('ko-KR')}</p><div class="row"><button class="btn" data-load="${esc(s.id)}">다시 편집</button><button class="btn" data-export="${esc(s.id)}">전달 파일</button><button class="btn quiet" data-remove="${esc(s.id)}">삭제</button></div></article>`).join('');
 $('#recipeSavedGrid').innerHTML=recipes.map(r=>`<article class="recipe-saved"><img src="${esc(r.referenceUrl||(r.mode==='outfit'?(r.product?.photos||SAMPLE_PHOTOS)[0].url:MODES.scene.image))}" alt="${esc(MODES[r.mode].caption)}"><div><span class="preview-tag">설정만 저장 · 합성 결과 없음</span><h3>${esc(r.name)}</h3><p class="hint">${MODES[r.mode].name} · ${esc(r.range)}<br>${esc((r.product?.photos||SAMPLE_PHOTOS)[r.productPhoto].label)}</p><div class="row"><button class="btn" data-reuse="${esc(r.id)}">설정 다시 사용</button><button class="btn" data-recipe-export="${esc(r.id)}">지시서 내려받기</button><button class="btn quiet" data-recipe-remove="${esc(r.id)}">삭제</button></div></div></article>`).join('');
 $$('[data-load]').forEach(b=>b.onclick=()=>{const s=saved.find(x=>x.id===b.dataset.load);preserveWorkspace();if(s.product)setProduct(s.product);else setProduct({...normalizeProduct({productName:s.productName,brand:'BLUEFIT',salePrice:79000,quantity:4},s.sourceUrl),photos:SAMPLE_PHOTOS.slice(0,2)});$('#productName').value=s.productName;$('#factCheck').checked=true;$('#benefitCheck').checked=!!product.benefitConfirmed;activeReference=LIBRARY_SAMPLES.find(x=>x.type===s.variant.reference?.type)||null;renderLibrary();mode=s.variant.mode==='newscene'?'newscene':'original';variants=[{...s.variant,photos:structuredClone(s.variant.photos||PHOTOS),id:'saved-'+s.id+'-'+Date.now()}];choice=new Set([variants[0].id]);selected=0;go(2);notify('저장한 시안을 복사해 편집합니다. 저장본은 유지됩니다.')});
 $$('[data-export]').forEach(b=>b.onclick=()=>download(packageEntry(saved.find(x=>x.id===b.dataset.export)),'AdCheck-시안전달.json'));
 $$('[data-remove]').forEach(b=>b.onclick=()=>{const next=saved.filter(x=>x.id!==b.dataset.remove);if(writeStore(KEY,next)){saved=next;renderSaved();notify('저장함에서 삭제했습니다.')}});
 $$('[data-reuse]').forEach(b=>b.onclick=()=>{const r=recipes.find(x=>x.id===b.dataset.reuse);preserveWorkspace();if(r.product)setProduct(r.product);modeDrafts[mode]={variants,choice:new Set(choice),selected};mode=r.mode;activeReference=LIBRARY_SAMPLES.find(x=>x.type===r.creativeReference?.type)||null;renderLibrary();planState[mode]={name:r.name,range:r.range,productPhoto:r.productPhoto,notes:r.notes};$('#factCheck').checked=true;go(1);notify('연출 설정을 불러왔습니다. 상품 자료와 교체 영역을 확인해주세요.')});
 $$('[data-recipe-export]').forEach(b=>b.onclick=()=>download(packageRecipe(recipes.find(x=>x.id===b.dataset.recipeExport)),'AdCheck-연출지시서.json'));
 $$('[data-recipe-remove]').forEach(b=>b.onclick=()=>{const next=recipes.filter(x=>x.id!==b.dataset.recipeRemove);if(writeStore(RECIPE_KEY,next)){recipes=next;renderSaved();notify('연출 설정을 삭제했습니다.')}});
}
$('#dlAllImages') && ($('#dlAllImages').onclick=()=>downloadAllImages());
$('#exportAll').onclick=()=>download({version:3,previewOnly:false,items:saved.map(packageEntry),recipes:recipes.map(packageRecipe)},'AdCheck-스튜디오-작업정보.json');
$('#openSaved').onclick=()=>go(3);$('#stepPrev').onclick=()=>go(step-1);$('#stepNext').onclick=()=>step===1?openSelectedBoard():step<3&&go(step+1);
$$('[data-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.step)));$$('[data-go]').forEach(b=>b.onclick=()=>go(Number(b.dataset.go)));

let importedItems=[], importedSource='', revision=0, copyBusy=false, referenceRequest=0, importRequest=0;
function setProduct(next){
 product=structuredClone(next);SOURCE=product.sourceUrl||'';
 PHOTOS.splice(0,PHOTOS.length,...product.photos);
 if(SOURCE.includes('/1002447881'))PHOTOS.push(...SAMPLE_PHOTOS.slice(2));
 photo=0;variants=[];choice=new Set([0,1,2,3,4,5]);selected=0;modeDrafts={};mode='original';revision++;
 for(const m of ['scene','outfit'])planState[m].productPhoto=0;
 MODES.original.image=product.photos[0]?.url||'';MODES.original.caption='선택한 상품 원본';MODES.outfit.image=MODES.original.image;MODES.outfit.caption='선택한 모델·상품 원본';
 $('#productName').value=product.productName;$('#productBrand').value=product.brand;$('#productPrice').value=product.salePrice||'';$('#productQuantity').value=product.quantity||'';$('#productDescription').value=product.description||'';$('#productUrl').value=SOURCE;
 $('#productImages').value=product.photos.map(p=>p.url).join('\n');$('#benefitRate').value=product.benefitRate||'';$('#benefitKind').value=product.benefitKind||'정률';$('#benefitCondition').value=product.benefitCondition||'';$('#benefitCheck').checked=!!product.benefitConfirmed;$('#factCheck').checked=false;renderPhotos();
}
function syncFacts(){
 const old=JSON.stringify(product);
 product.productName=$('#productName').value.trim();product.brand=$('#productBrand').value.trim();product.salePrice=Number($('#productPrice').value)||null;product.quantity=Number($('#productQuantity').value)||null;product.description=$('#productDescription').value.trim();product.benefitRate=Number($('#benefitRate').value)||null;product.benefitKind=$('#benefitKind').value;product.benefitCondition=$('#benefitCondition').value.trim();product.benefitConfirmed=$('#benefitCheck').checked;
 if(JSON.stringify(product)!==old){revision++;variants=[];modeDrafts={};choice=new Set([0,1,2,3,4,5]);$('#factCheck').checked=false;notify('상품 정보를 수정했습니다. 저장하지 않은 시안은 새 정보로 다시 구성합니다.');}
}
for(const id of ['productName','productBrand','productPrice','productQuantity','productDescription','benefitRate','benefitKind','benefitCondition','benefitCheck'])$('#'+id).addEventListener('change',syncFacts);
validProduct=function(){syncFacts();let error='';if(!product.productName)error='상품명을 입력해주세요.';else if(!product.photos.length)error='상품 사진을 한 장 이상 등록해주세요.';else if(product.salePrice!==null&&(!Number.isInteger(product.salePrice)||product.salePrice<1))error='판매가를 양의 정수로 입력해주세요.';else if(product.quantity!==null&&(!Number.isInteger(product.quantity)||product.quantity<1))error='구성 수량을 양의 정수로 입력해주세요.';else if(product.benefitConfirmed&&!factSlots(product).BENEFIT)error='1~100% 할인율과 적용 조건을 함께 입력해주세요.';else if(!$('#factCheck').checked)error='상품명·판매가·구성을 확인하고 체크해주세요.';$('#productError').textContent=error;$('#productError').hidden=!error;return !error};
async function getJSON(url,options={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),240000);
 try{const response=await fetch(url,{...options,signal:controller.signal});let data;try{data=await response.json()}catch{throw Error('응답을 읽지 못했습니다. 로그인 상태와 서버 연결을 확인해주세요. 로컬 화면에서는 API가 실행되지 않습니다.')}
 if(!response.ok){const e=Error(data.error||'요청을 처리하지 못했습니다. 다시 시도해주세요.');e.blocked=data.blocked;throw e}return data;
 }catch(e){if(e.name==='AbortError')throw Error('응답 시간이 길어졌습니다. 잠시 후 다시 시도해주세요.');throw e}finally{clearTimeout(timeout)}
}
function acceptImport(data){
 if(!data||!Array.isArray(data.items)||!data.items.length)throw Error('상품 정보가 없습니다. 다른 상품 링크나 직접 입력을 사용해주세요.');
 importedSource=safeUrl(data.sourceUrl);importedItems=data.items.slice(0,40).map(x=>normalizeProduct(x,importedSource)).filter(x=>x.productName&&x.photos.length);
 if(!importedItems.length)throw Error('상품명과 사진을 가져오지 못했습니다. 직접 입력하거나 상품 담기를 다시 실행해주세요.');
 $('#importChoice').innerHTML=importedItems.map((p,i)=>`<option value="${i}">${esc(p.productName)}</option>`).join('');$('#importChoiceField').hidden=importedItems.length<2;setProduct(importedItems[0]);$('#importStatus').textContent=`${importedItems.length}개 상품을 가져왔습니다. 가격·구성·사진을 확인해주세요. 할인 조건은 직접 확인 후 입력하세요.`;
}
$('#importChoice').onchange=()=>setProduct(importedItems[Number($('#importChoice').value)]);
$('#importUrl').onclick=async()=>{const url=safeUrl($('#productUrl').value);if(!url){$('#importStatus').textContent='올바른 http 또는 https 상품 링크를 입력해주세요.';return}const request=++importRequest,startedRevision=revision;$('#importUrl').disabled=true;$('#importStatus').textContent='상품 정보를 가져오는 중…';try{const data=await getJSON('/api/productScrape?url='+encodeURIComponent(url));if(request!==importRequest||startedRevision!==revision){$('#importStatus').textContent='가져오는 동안 상품이 변경되어 이전 응답을 적용하지 않았습니다.';return}acceptImport(data)}catch(e){$('#importStatus').textContent=e.message+' 북마클릿 또는 직접 입력으로 계속할 수 있습니다.';$('#grabHelp').open=true}finally{$('#importUrl').disabled=false}};
$('#importGrab').onclick=()=>{try{const raw=$('#grabData').value;if(raw.length>2000000)throw Error('상품 정보가 너무 큽니다. 상품 상세 페이지에서 다시 담아주세요.');const data=JSON.parse(raw);if(data._adcheck!=='product')throw Error('AdCheck 상품 담기에서 복사한 정보가 아닙니다.');acceptImport(data)}catch(e){$('#importStatus').textContent=e instanceof SyntaxError?'붙여넣은 JSON을 읽지 못했습니다. 복사한 내용을 빠짐없이 붙여넣어주세요.':e.message}};
$('#applyImages').onclick=()=>{const lines=$('#productImages').value.split('\n').map(s=>s.trim()).filter(Boolean);if(!lines.length||lines.length>12||lines.some(s=>!safeUrl(s))){notify('올바른 사진 주소를 1~12개 입력해주세요.');return}syncFacts();setProduct({...product,photos:[...new Set(lines.map(safeUrl))].map((url,i)=>({url,label:'상품 원본 '+(i+1),kind:'original'}))});notify('상품 사진을 적용했습니다. 상품 정보를 확인해주세요.')};
const grabSource=new URL('assets/adcheck-grab.js',location.href).href;
$('#grabLink').href='javascript:'+encodeURIComponent(`(function(){var s=document.createElement('script');s.src=${JSON.stringify(grabSource)}+'?v='+Date.now();s.onerror=function(){alert('상품 담기를 불러오지 못했습니다. AdCheck 로그인 상태를 확인해주세요.')};document.body.appendChild(s)})()`);
$('#grabLink').onclick=e=>{e.preventDefault();notify('이 버튼을 북마크 바에 끌어다 놓고 상품 페이지에서 실행해주세요.')};

const originalRenderModes=renderModes;
renderModes=function(){originalRenderModes();const b=$('[data-mode="newscene"]');if(!SOURCE.includes('/1002447881')){b.disabled=true;b.querySelector('.mode-status').textContent='준비 중';b.querySelector('.mode-copy p').textContent='현재 상품의 장면 생성은 아직 연결 전입니다.'}};
const originalRenderLibrary=renderLibrary;
renderLibrary=function(){originalRenderLibrary();const type=$('#referenceType').value;$$('[data-reference]').forEach(b=>{b.hidden=!!type&&LIBRARY_SAMPLES[Number(b.dataset.reference)].type!==type});};
$('#referenceType').innerHTML='<option value="">전체 유형</option>'+Object.entries(REF_TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
$('#referenceType').onchange=renderLibrary;
async function loadReferences(){
 const id=++referenceRequest,category=$('#referenceCategory').value;$('#referenceStatus').textContent='레퍼런스 목록을 가져오는 중…';$('#reloadReferences').disabled=true;
 try{const data=await getJSON('/api/referenceImages?category='+encodeURIComponent(category));if(id!==referenceRequest)return;
 LIBRARY_SAMPLES=(data.items||[]).filter(x=>safeUrl(x.thumbUrl)).map(x=>({...x,brand:x.brandName||x.brand||'레퍼런스',category,type:x.type||'product',source:'AdCheck 이미지 레퍼런스'}));
 $('#referenceStatus').textContent=LIBRARY_SAMPLES.length?`${LIBRARY_SAMPLES.length}개 사례 · 업종과 유형으로 선택하세요.`:'등록된 사례가 없습니다. 참고 없이 카피를 만들 수도 있습니다.';renderLibrary();
 }catch(e){if(id!==referenceRequest)return;LIBRARY_SAMPLES=[];renderLibrary();$('#referenceStatus').textContent=e.message+' 목록 불러오기로 다시 시도하세요.'}finally{if(id===referenceRequest)$('#reloadReferences').disabled=false}
}
$('#reloadReferences').onclick=loadReferences;$('#referenceCategory').onchange=loadReferences;
$('.reference-library').addEventListener('toggle',async()=>{if(!$('.reference-library').open||$('.reference-library').dataset.loaded)return;$('.reference-library').dataset.loaded='true';try{const data=await getJSON('/api/referenceCategories');if(Array.isArray(data.categories)){$('#referenceCategory').innerHTML=data.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');if(data.categories.some(c=>c.id==='fashion'))$('#referenceCategory').value='fashion'}}catch{}loadReferences()});
async function generateCopies(single=false){
 if(copyBusy||!validProduct())return;
 const current=single?[variants[selected]]:directionVariants().filter(v=>choice.has(v.id));if(!current.length){notify('템플릿을 하나 이상 선택해주세요.');return}
 const token=revision,requestedMode=mode,ref=referenceBrief();copyBusy=true;
 for(const id of ['generateCopies','varyCopy','applyReference'])$('#'+id).disabled=true;
 $('#copyStatus').textContent='AI가 카피와 컨셉을 제안하는 중…';notify('선택한 구성의 카피를 제안합니다.');
 try{const data=await getJSON('/api/bannerCopy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'studio',product,reference:ref,layouts:current.map(v=>v.layout)})});
 if(token!==revision||requestedMode!==mode){notify('상품 또는 제작 방식이 변경되어 이전 요청의 카피를 적용하지 않았습니다.');return}
 if(!Array.isArray(data.copies)||data.copies.length!==current.length)throw Error('카피 개수가 맞지 않아 적용하지 않았습니다. 다시 시도해주세요.');
 const latest=single?variants:directionVariants();const changed=current.map((v,i)=>({...latest.find(x=>x.id===v.id),...data.copies[i],reference:ref,copyEdited:false,copyModel:data.model,original:false}));
 const map=new Map(changed.map(v=>[v.id,v]));variants=(single?variants:directionVariants()).map(v=>map.get(v.id)||v);
 $('#copyStatus').textContent=`${changed.length}개 카피·컨셉을 적용했습니다. 상품 사실과 문구를 검토해주세요.`;
 if(step===1)renderDirections();if(step===2){renderBoard();fillEditor()}notify('AI 카피를 적용했습니다. 사진·조판은 유지됩니다.');
 }catch(e){$('#copyStatus').textContent=e.message;notify(e.message)}finally{copyBusy=false;$('#generateCopies').disabled=false;$('#varyCopy').disabled=false;$('#applyReference').disabled=!activeReference}
}
$('#generateCopies').onclick=()=>generateCopies(false);$('#applyReference').onclick=()=>generateCopies(true);
const oldRefEditor=updateReferenceEditor;
updateReferenceEditor=function(){oldRefEditor();$('#applyReference').textContent=activeReference?'선택 레퍼런스로 AI 카피 제안':'2단계에서 참고 사례를 선택하세요';$('#applyReference').disabled=copyBusy||!activeReference};
// Legacy saved drafts retain their original example images even after a product switch.
for(const entry of saved)if(!entry.variant.photos)entry.variant.photos=structuredClone(SAMPLE_PHOTOS);
setProduct(product);renderSaved();renderLibrary();updateStepNav();

// Automatic entry flow. The existing editor and saved drafts are reused after results.
let autoBusy=false, autoRun=0, autoPlan=[], failedImages=new Set(), autoCopyFailed=false, photoNotice='';
const autoMessage=text=>{$('#autoStatus').textContent=text};
const originalBoard=renderBoard;
renderBoard=function(){originalBoard();$$('[data-card]').forEach(button=>{const v=variants[Number(button.dataset.card)];if(!v)return;const card=button.closest('.card');const small=card.querySelector('.card-meta small');if(v.autoStatus){small.textContent=v.autoStatus;card.classList.toggle('image-pending',v.autoStatus==='이미지 생성 중');card.classList.toggle('baked-warn',!!(v.textClaims&&v.textClaims.length));}if(v.imageFailed){const retry=document.createElement('button');retry.className='btn';retry.textContent='이 이미지 다시 생성';retry.onclick=()=>retryImage(v.id);card.append(retry)}})};
function enterResults(){step=2;$('#productStep').hidden=true;$('#directionStep').hidden=true;$('#boardStep').hidden=false;$('#savedStep').hidden=true;$('#boardWorkspace').hidden=false;$('#recipeReview').hidden=true;renderProductStrip();renderBoard();fillEditor();$('#quickResults').hidden=false;$('#autoRetryCopy').hidden=!autoCopyFailed}
function setBusy(b){autoBusy=b;$('#quickGenerate').disabled=b;// 버튼이 둘 다 '시안 6종 생성'이라, 진행 중 표시도 둘 다 해야 어느 쪽을 눌렀든 보인다.
 for(const id of ['#quickGenerate','#quickGrabGenerate'])$(id).textContent=b?'시안 만드는 중…':'시안 6종 생성';
 $('#quickInput').disabled=b;$('#quickGrab').disabled=b;$('#quickGrabGenerate').disabled=b;if($('#dlAllImages'))$('#dlAllImages').disabled=b;$('#saveVariant').disabled=b;$('#varyCopy').disabled=b;$('#varyScene').disabled=b;$('#autoRetryCopy').disabled=b;$('#quickEditProduct').disabled=b;$('#openSaved').disabled=b;$('#quickResults').setAttribute('aria-busy',String(b));}
function looksLikeProduct(data){return data&&data._adcheck==='product'&&Array.isArray(data.items)&&data.items.length}
const shuffleRefs=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
async function autoReferences(p){
 const name=p.productName;const category=/티셔츠|의류|가디건|니트|팬츠|스커트|블루핏|셔츠|코트|신발|패션/.test(name)?'fashion':null;
 if(!category)return [];
 try{const data=await getJSON('/api/referenceImages?category='+category);return (data.items||[]).filter(x=>safeUrl(x.thumbUrl)).map(x=>({...x,brand:x.brandName||x.brand||'레퍼런스',category,source:'AdCheck 이미지 레퍼런스'}))}catch{return []}
}
async function autoCopies(run){
 const refs=await autoReferences(product);if(run!==autoRun)return;
 const references=autoPlan.map(p=>{const candidates=refs.filter(r=>r.type===p.type);const ref=candidates[Math.floor(Math.random()*candidates.length)];return ref?{...ref,typeLabel:REF_TYPES[p.type],principle:REF_GUIDES[p.type]||'표현 방식과 카피 구조를 참고합니다.'}:{type:p.type,typeLabel:REF_TYPES[p.type],principle:REF_GUIDES[p.type]||'상품 사실 안에서 표현합니다.'}});
 const data=await getJSON('/api/bannerCopy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'studio',autoPlan:true,product,layouts:autoPlan.map(p=>p.layout),references,plans:autoPlan})});
 if(run!==autoRun)return;
 if(!Array.isArray(data.copies)||data.copies.length!==6)throw Error('카피가 6개 돌아오지 않았습니다. 카피만 다시 시도해주세요.');
 variants.forEach((v,i)=>Object.assign(v,data.copies[i],{reference:references[i],copyModel:data.model,copyEdited:false}));autoCopyFailed=false;renderBoard();fillEditor();
}
/* 시안 6종을 서로 다른 컷으로 만들려면 가진 사진이 각각 무엇인지 알아야 한다.
   비율만으로는 모델컷과 단품컷이 구분되지 않아서, 사진을 실제로 보고 역할을
   붙인다. 실패해도 진행한다 — createPlan이 비율로 짐작해 여섯 종을 채운다. */
async function classifyPhotos(run){
 if(!product.photos.length)return;
 // 몰이 준 대표 이미지가 썸네일인 경우가 있다. 신세계는 275px짜리를 준다.
 // 생성에 넣기 전에 가장 큰 판형으로 올린다.
 const bigger=await upgradePhotos(product.photos);
 if(run!==autoRun)return;
 if(bigger){PHOTOS.splice(0,PHOTOS.length,...product.photos);renderPhotos?.()}
 const sizeNote=bigger?`사진 ${bigger}장을 원본 크기로 교체`:'';
 const urls=product.photos.slice(0,6).map(p=>p.url);
 /* 우리 이미지 레퍼런스에 이 업종 배너가 쌓여 있다. 지금까지는 캡션만 카피
    생성에 쓰고 이미지는 아무 데도 안 넣었다. 실제로 어떻게 구성했는지는
    그림을 봐야 알 수 있다. 몇 장 함께 보내 조판을 고르게 한다. */
 const refs=await autoReferences(product);
 if(run!==autoRun)return;
 const referenceUrls=shuffleRefs(refs).slice(0,3).map(r=>safeUrl(r.fullUrl||r.thumbUrl)).filter(Boolean);
 try{
  const data=await getJSON('/api/productPhotos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls,referenceUrls})});
  if(run!==autoRun)return;
  // 장면도 함께 받는다. 상품마다 달라야 하는 부분이라 코드에 박아 둘 수 없다.
  product.category=data.category||'other';product.cuts=Array.isArray(data.cuts)?data.cuts:[];
  // 사진에서 읽은 USP와 톤을 카피 생성으로 넘긴다. 상품명만 보고 쓰면
  // 어느 상품에나 맞는 말이 나온다.
  product.usp=data.usp||'';product.tone=data.toneKo||'';
  product.layoutHints=Array.isArray(data.layoutHints)?data.layoutHints:[];product.refNote=data.refNote||'';
  const byUrl=new Map((data.photos||[]).map(x=>[x.url,x]));
  product.photos.forEach((p,i)=>{const x=byUrl.get(p.url);if(!x)return;
   p.role=x.role;p.hasPerson=x.hasPerson;p.colorway=x.colorway;p.burnedText=x.burnedText;p.note=x.note;
   p.label=(x.colorway?x.colorway+' ':'')+({main:'대표컷',model:'모델컷',packshot:'단품컷',flat:'펼침컷',detail:'상세컷',unusable:'배너 부적합'}[x.role]||'상품 원본 '+(i+1));});
  // 배너에 못 쓰는 것(정보 고시표·사이즈표)은 뺀다. 다 빼면 원래대로 둔다.
  const usable=product.photos.filter(p=>p.role!=='unusable');
  const dropped=product.photos.length-usable.length;
  // PHOTOS는 setProduct에서 product.photos를 그대로 복사해 둔 목록이고,
  // 카드는 PHOTOS의 번호로 사진을 찾는다. 여기서 한쪽만 줄이면 번호가
  // 어긋나 엉뚱한 사진이 뜬다. 두 목록을 함께 맞춘다.
  if(usable.length&&dropped)product.photos=usable;
  PHOTOS.splice(0,PHOTOS.length,...product.photos);
  if(SOURCE.includes('/1002447881'))PHOTOS.push(...SAMPLE_PHOTOS.slice(2));
  photoNotice=(sizeNote?sizeNote+' · ':'')+`사진 ${product.photos.length}장 분류 완료`+(dropped?` (제외: 배너 부적합 ${dropped}장)`:'')
   +(product.cuts.length?` · 이 상품에 맞는 컷 후보 ${product.cuts.length}개 중 무작위로 뽑습니다`:' · 컷 후보는 기본값을 씁니다')
   +(referenceUrls.length?` · 레퍼런스 배너 ${referenceUrls.length}장 참고`:'')
   /* 사진이 적으면 여섯 장 중 원본이 한두 장뿐이고 나머지는 전부 생성이 된다.
      링크만 넣으면 상세 페이지 이미지는 서버가 못 본다. 스크롤해야 뜨기 때문이다.
      북마클릿은 사용자 브라우저에서 읽으므로 상세컷까지 가져온다. 그 차이를 알린다. */
   +(product.photos.length<=2?' · 상세 페이지 컷을 못 가져왔습니다. 북마클릿으로 담으면 원본을 더 씁니다':'')
   +(product.refNote?` (${product.refNote})`:'');
 }catch(e){photoNotice=(sizeNote?sizeNote+' · ':'')+'사진 분류를 건너뛰었습니다. 비율로 나눕니다.';}
 await scrubLogos(run);
 const cutNote=await cutoutPhotos(run);
 if(cutNote)photoNotice+=' · '+cutNote;
}

/* 상품 사진에 브랜드가 덧씌운 로고가 있으면 지운다. 그대로 두면 우리 배너에
   남의 워드마크가 박히고, AI에 넣어도 그 로고가 결과물까지 따라온다.
   분류가 글자를 본 사진만 검사한다 — 없는 사진까지 OCR을 돌릴 이유가 없다. */
async function scrubLogos(run){
 const targets=product.photos.filter(p=>p.burnedText&&!p.cleanUrl).slice(0,4);
 if(!targets.length)return;
 let done=0;
 for(const p of targets){
  if(run!==autoRun)return;
  try{const out=await scrubLogo(p.url,getJSON);
   if(out){p.cleanUrl=out.dataUrl;p.cleanBase64=out.base64;p.cleanType=out.mediaType;p.removedText=out.removed;done++}
  }catch(e){/* 못 지우면 원본을 그대로 쓴다 */}
 }
 if(done)photoNotice+=` · 사진 ${done}장에서 로고를 지웠습니다`;
}
/* 어떤 축으로 뽑혔는지 카드에 적는다. 화면에 안 보이면 없는 것과 같다. */
const AXIS_KO={
 emphasis:{offer:'혜택 강조',product:'제품 강조',story:'무드 강조'},
 mount:{studio:'무지 배경',plinth:'단상',table:'테이블',chair:'의자',shelf:'선반',hanger:'옷걸이',floor:'바닥',held:'손에 듦',floating:'공중',water:'물',fabric:'천',mirror:'거울',location:'실제 공간'},
 angle:{front:'정면','three-quarter':'사반신',side:'측면',back:'후면','top-down':'직부감','high-45':'부감 45도','eye-level':'눈높이',low:'로우앵글','worms-eye':'극단 로우',dutch:'기울임','over-shoulder':'어깨 너머','close-front':'정면 초근접'},
 distance:{'extreme-close':'표면 매크로',close:'부분 확대',medium:'상품 전체',wide:'주변까지','very-wide':'넓은 공간'},
 light:{soft:'확산광',hard:'딱딱한 그림자',back:'역광',rim:'윤곽광',window:'창가',['studio-key']:'키라이트',split:'반측광',golden:'황금시간',neon:'색조명',dappled:'나뭇잎 그림자'},
 motion:{static:'',falling:'낙하',splash:'튀김',pour:'따름',float:'부양',wind:'바람','hand-motion':'손 움직임'},
 person:{none:'',hands:'손만',partial:'신체 일부',keep:'모델 유지'},
 pose:{standing:'서 있음',walking:'걷기',seated:'앉음',leaning:'기댐',reaching:'손 뻗기',turning:'돌아봄',crouching:'웅크림',back:'등',['close-portrait']:'얼굴 클로즈업'},
};
function axisLabel(p){
 const a=p.axes||{};
 return [AXIS_KO.emphasis[p.emphasis],AXIS_KO.mount[a.mount],AXIS_KO.angle[a.angle],
  AXIS_KO.distance[a.distance],AXIS_KO.light[a.light],AXIS_KO.motion[a.motion],
  AXIS_KO.person[a.person],AXIS_KO.pose[a.pose]].filter(Boolean).join(' · ');
}

/* 누끼. 단색 배경 단품컷에서만 된다. 되는지 먼저 재고, 안 되면 손대지 않는다.
   억지로 지운 누끼는 원본보다 나쁘다. */
async function cutoutPhotos(run){
 const targets=product.photos.filter(p=>['packshot','flat','main'].includes(p.role)&&!p.cutUrl).slice(0,3);
 if(!targets.length)return '';
 let done=0,why='';
 for(const p of targets){
  if(run!==autoRun)return '';
  try{const r=await cutout(p.url,getJSON);
   if(r.ok){p.cutUrl=r.dataUrl;p.cutRatio=r.ratio;done++}else why=r.reason;
  }catch(e){why=e.message}
 }
 return done?`누끼 ${done}장`:(why?`누끼 실패(${why})`:'');
}

/* 딤 세기. 조판마다 고정값을 쓰면 밝은 스튜디오컷에는 진하고 어두운 야외컷에는
   모자란다. 카피가 실제로 놓인 자리의 밝기를 재서 정한다. */
async function tuneScrim(i){
 const v=variants[i];if(!v||v.baked)return;
 const url=srcOf(PHOTOS[v.photo]);if(!url||url.startsWith('data:'))return;
 const card=$(`[data-card="${i}"]`);if(!card)return;
 const art=card.querySelector('.art'),copy=art&&art.querySelector('.copy');
 if(!art||!copy)return;
 const a=art.getBoundingClientRect(),r=copy.getBoundingClientRect();
 if(!a.width||!r.width)return;
 const box={x:(r.left-a.left)/a.width,y:(r.top-a.top)/a.height,w:r.width/a.width,h:r.height/a.height};
 const s=await scrimFor(url,box,getJSON);
 if(!s)return;
 art.style.setProperty('--scrim',String(s.alpha));
 /* 밝은 사진에 옅은 딤 + 검은 글씨는 사진만 바래고 글자는 안 또렷해진다.
    밝기가 절반을 넘으면 어두운 딤 + 흰 글씨로 뒤집는다. 뒤집을 수 있는 조판만. */
 if(['top-center','top-left','corner'].includes(v.layout))art.classList.toggle('inverted',s.luminance>0.5);
}

async function generateImage(plan,run){
 const variant=variants.find(v=>v.id===plan.id);if(!variant)return;
 variant.autoStatus='이미지 생성 중';variant.imageFailed=false;renderBoard();
 const src=product.photos[plan.photo]||{};
 const baked=plan.render==='baked';
 try{
 // 1단계: 장면을 만든다. 이 호출에는 글자 지시를 넣지 않는다.
 const shot=await getJSON('/api/bannerImage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(src.cleanBase64?{base64:src.cleanBase64,mediaType:src.cleanType}:{imageUrl:src.url}),scene:plan.scene,keep:plan.keep,productName:product.productName,imagePrompt:`Do not introduce other products. Reserve empty space for ${plan.layout==='bottom-right'||plan.layout==='band'?'lower':'upper'} text.`,size:'1024x1024'})});
 if(run!==autoRun)return;if(!safeUrl(shot.imageUrl))throw Error('생성된 이미지 주소를 받지 못했습니다.');
 let finalUrl=shot.imageUrl;

 // 2단계: 카피까지 그리는 컷만, 방금 만든 그림에 글자를 얹는다.
 // 장면과 글자를 한 번에 시키면 글자가 통째로 빠진다(두 번 시험해 두 번 다).
 if(baked){
  variant.autoStatus='카피를 그리는 중';renderBoard();
  const withText=await getJSON('/api/bannerImage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageUrl:finalUrl,size:'1024x1024',text:{headline:variant.main,subline:variant.sub,offer:variant.offer,brand:product.brand,cta:variant.showCta?variant.cta:'',style:plan.typeStyle?.[1]||''}})});
  if(run!==autoRun)return;
  if(safeUrl(withText.imageUrl))finalUrl=withText.imageUrl;
 }

 const index=PHOTOS.push({url:finalUrl,label:plan.sceneName+' · AI 생성',kind:'ai',recipe:plan.recipe})-1;
 variant.photo=index;variant.photos=undefined;variant.baked=baked;variant.imageFailed=false;failedImages.delete(plan.id);
 variant.autoStatus=(variant.axes?variant.axes+' · ':'')+(baked?'카피까지 생성 · 숫자 확인 중':'AI 생성 · 상품 일치 확인 필요');
 renderBoard();

 if(baked){
  // 그림에 박힌 금액·퍼센트를 다시 읽어 확인된 값과 맞춰 본다
  const slots=factSlots(product);
  const check=await checkBakedText(finalUrl,[slots.PRICE,slots.BENEFIT,slots.QUANTITY].filter(Boolean),getJSON);
  if(run!==autoRun)return;
  variant.textClaims=check?check.claims:null;
  variant.autoStatus=(variant.axes?variant.axes+' · ':'')+(
   !check?'카피까지 생성 · 숫자 확인 못 함':
   check.claims.length?'확인되지 않은 숫자: '+check.claims.join(', ')+' · 쓰기 전에 확인하세요':
   '카피까지 생성 · 숫자 대조 통과');
 }
 }catch(e){if(run!==autoRun)return;variant.autoStatus='이미지 생성 실패 · 원본을 임시로 표시합니다';variant.imageFailed=true;variant.imageError=e.message;failedImages.add(plan.id)}
 renderBoard();fillEditor();tuneScrim(variants.indexOf(variant));
}
async function retryImage(id){if(autoBusy)return;const p=autoPlan.find(p=>p.id===id);if(!p)return;setBusy(true);try{await generateImage(p,autoRun)}finally{setBusy(false);finishMessage()}}
function finishMessage(){autoMessage((photoNotice?photoNotice+' · ':'')+(autoCopyFailed?'카피 생성에 실패해 카피까지 그리는 시안은 만들지 못했습니다. 카피만 다시 시도할 수 있습니다.':failedImages.size?`6종 중 이미지 ${failedImages.size}개가 실패했습니다. 해당 카드에서 다시 생성할 수 있습니다.`:'시안 6종이 완성됐습니다. 마음에 드는 시안을 선택해 수정·저장하세요.'));$('#autoRetryCopy').hidden=!autoCopyFailed}
async function startAutomatic(raw,fromGrab=false,useCurrent=false){
 if(autoBusy)return;if(!useCurrent&&!raw.trim()){autoMessage('상품 링크를 넣어주세요.');$('#quickInput').focus();return}
 const run=++autoRun;setBusy(true);autoMessage('상품 정보를 분석하는 중…');
 try{
  if(!useCurrent){let data;if(fromGrab){if(raw.length>2000000)throw Error('상품 정보가 너무 큽니다. 상세 페이지에서 다시 담아주세요.');try{data=JSON.parse(raw)}catch{throw Error('복사한 상품 정보를 빠짐없이 붙여넣어주세요.')}if(!looksLikeProduct(data))throw Error('AdCheck 상품 담기로 복사한 정보가 아닙니다.');}
  else{const url=safeUrl(raw);if(!url)throw Error('올바른 상품 링크를 넣어주세요.');data=await getJSON('/api/productScrape?url='+encodeURIComponent(url));}
  acceptImport(data);$('#quickProductCount').textContent=importedItems.length>1?`${importedItems.length}개 중 첫 상품으로 생성합니다. 결과의 상품 정보에서 바꿀 수 있습니다.`:'';
  }
  syncFacts();if(!product.productName||!product.photos.length)throw Error('상품명과 사진이 필요합니다. 상품 정보를 직접 입력해주세요.');
  $('#factCheck').checked=true;mode='original';
  autoMessage('상품 사진을 살펴보는 중…');photoNotice='';await classifyPhotos(run);if(run!==autoRun)return;
  autoPlan=createPlan(product);failedImages.clear();autoCopyFailed=false;
  const slots=factSlots(product);
  variants=autoPlan.map(p=>({id:p.id,title:p.label+' · '+LAYOUTS[p.layout],recipe:p.recipe,layout:p.layout,photo:p.photo,brand:product.brand,mode:'original',main:product.productName,sub:[slots.QUANTITY,slots.PRICE].filter(Boolean).join(' · '),cta:slots.BENEFIT?'혜택 조건 보기':'상품 자세히 보기',offer:slots.BENEFIT||slots.PRICE||'',benefitCondition:slots.BENEFIT?product.benefitCondition:'',showCta:true,lockImage:true,lockLayout:false,original:false,autoStatus:p.method==='original'?p.desc:'이미지 생성 중',axes:axisLabel(p)}));
  selected=0;choice=new Set(variants.map(v=>v.id));enterResults();$('#quickProduct').textContent=product.productName;autoMessage('카피와 이미지를 만들고 있습니다. 완성되는 순서대로 표시합니다.');
  const copyTask=autoCopies(run).catch(e=>{autoCopyFailed=true;$('#autoCopyError').textContent=e.message});
  // 사진만 만드는 컷은 바로 시작한다. 카피까지 그리는 컷은 문구가 나와야
  // 그릴 수 있으므로 카피를 기다린다. 둘을 한 줄에 세우면 전부 늦어진다.
  const layerQueue=autoPlan.filter(p=>p.method==='newscene'&&p.render!=='baked');
  const bakedQueue=autoPlan.filter(p=>p.method==='newscene'&&p.render==='baked');
  const drain=q=>Array.from({length:2},async()=>{while(q.length){await generateImage(q.shift(),run)}});
  await Promise.all([
   ...drain(layerQueue),
   copyTask.then(()=>autoCopyFailed?null:Promise.all(drain(bakedQueue))),
  ]);
  renderBoard();fillEditor();finishMessage();
 }catch(e){autoMessage(e.message);if(!useCurrent&&!fromGrab)$('#quickGrab').focus()}finally{setBusy(false)}
}
$('#quickGenerate').onclick=()=>startAutomatic($('#quickInput').value);
$('#quickInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();startAutomatic($('#quickInput').value)}};
$('#quickGrabGenerate').onclick=()=>startAutomatic($('#quickGrab').value,true);
$('#quickGrab').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();startAutomatic($('#quickGrab').value,true)}};
$('#autoRetryCopy').onclick=async()=>{if(autoBusy)return;setBusy(true);autoMessage('카피만 다시 만드는 중…');try{await autoCopies(autoRun)}catch(e){autoCopyFailed=true;$('#autoCopyError').textContent=e.message}finally{setBusy(false);finishMessage()}};
$('#quickEditProduct').onclick=()=>{if(autoBusy)return;$('#productStep').hidden=!$('#productStep').hidden;$('#productStep').scrollIntoView({behavior:'smooth',block:'start'})};
$('#quickApplyProduct').onclick=()=>startAutomatic('',false,true);
/* 붙여넣은 것을 지우려면 전체 선택 후 삭제밖에 없었다. 값이 있을 때만 X를 띄운다. */
$$('.quick-clear').forEach(btn=>{
 const input=$('#'+btn.dataset.clear);if(!input)return;
 const sync=()=>{btn.hidden=!input.value};
 input.addEventListener('input',sync);sync();
 btn.onclick=()=>{input.value='';sync();input.focus()};
});
$('#quickBookmarklet').href=$('#grabLink').href;$('#quickBookmarklet').onclick=e=>{e.preventDefault();notify('북마크 바에 끌어다 놓고 상품 페이지에서 실행해주세요.')};
// Enter the existing save/edit views without exposing the former setup steps.
const legacyGo=go;
go=function(n){if(autoBusy)return;if(n===1){$('#productStep').hidden=false;return}legacyGo(n);if(n===2){$('#directionStep').hidden=true;$('#productStep').hidden=true;}if(n===3){$('#quickResults').hidden=false}};
$('#quickBack') && ($('#quickBack').onclick=()=>{if(variants.length)enterResults();else{$('#savedStep').hidden=true;$('#quickResults').hidden=true}});
const legacyFill=fillEditor;fillEditor=function(){legacyFill();$('#saveVariant').disabled=autoBusy||!!variants[selected]?.imageFailed;$('#varyCopy').disabled=autoBusy;$('#varyScene').disabled=autoBusy;$('#applyReference').disabled=autoBusy||!activeReference};
$('#productStep').hidden=true;$('#directionStep').hidden=true;$('#boardStep').hidden=true;$('#savedStep').hidden=true;
