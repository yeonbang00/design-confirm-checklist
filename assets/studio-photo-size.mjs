/* 상품 사진의 가장 큰 판형을 찾는다.
 *
 * 몰이 주는 대표 이미지 주소가 썸네일인 경우가 있다. 신세계TV쇼핑이 그렇다.
 * 실측 — 같은 상품의 파일명 가운데 판형 코드만 다르다.
 *   _s_ 160px   _i_ 275px   _l_ 1254px
 * JSON-LD와 og:image가 주는 것은 `_i_`(275px)다. 이걸 그대로 생성에 넣으면
 * 얼굴이 40px짜리가 되어 사람이 뭉개진다.
 *
 * 주소 규칙을 추측해서 그대로 믿지는 않는다. 후보를 실제로 불러 보고
 * naturalWidth를 재서, 원본보다 큰 것이 있을 때만 바꾼다. 없으면 원본을
 * 그대로 둔다. 픽셀은 읽지 않으므로 CORS와 무관하다.
 */

// 파일명 가운데 한두 글자 판형 코드를 이 값들로 바꿔 본다
const CODES = ['_l_', '_o_', '_b_', '_al_'];
// 파일명 끝에 붙는 크기 꼬리표
const SUFFIX = /(_|-)\d{2,4}x\d{2,4}(?=\.[a-z]+$)/i;

function candidates(url) {
  const out = new Set();
  let bare;
  try { bare = new URL(url); } catch { return []; }
  const path = bare.pathname;
  const file = path.split('/').pop() || '';

  const code = file.match(/_[a-z]{1,2}_/);
  if (code) {
    for (const c of CODES) {
      if (c === code[0]) continue;
      out.add(bare.origin + path.replace(file, file.replace(code[0], c)));
    }
  }
  if (SUFFIX.test(file)) out.add(bare.origin + path.replace(file, file.replace(SUFFIX, '')));
  return [...out];
}

function measure(url) {
  return new Promise(resolve => {
    const img = new Image();
    const done = w => { img.onload = img.onerror = null; resolve(w); };
    img.onload = () => done(img.naturalWidth || 0);
    img.onerror = () => done(0);
    // 응답이 없는 주소에서 멈추지 않게 한다
    setTimeout(() => done(0), 6000);
    img.src = url;
  });
}

/* url 하나에 대해 가장 큰 판형을 돌려준다.
   더 큰 것이 없으면 받은 주소를 그대로 돌려준다. */
export async function biggestVariant(url) {
  const list = candidates(url);
  if (!list.length) return { url, width: 0, changed: false };
  const base = await measure(url);
  const sizes = await Promise.all(list.map(measure));
  let best = url, bestW = base;
  sizes.forEach((w, i) => { if (w > bestW) { bestW = w; best = list[i]; } });
  return { url: best, width: bestW, changed: best !== url };
}

/* 사진 목록 전체를 올린다. 한 장이라도 바뀌면 changed가 참이다. */
export async function upgradePhotos(photos) {
  let changed = 0;
  await Promise.all(photos.map(async p => {
    if (!p || !p.url) return;
    const r = await biggestVariant(p.url);
    if (r.changed) { p.url = r.url; p.width = r.width; changed++; }
    else if (r.width) p.width = r.width;
  }));
  return changed;
}
