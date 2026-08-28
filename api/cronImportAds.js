// GET /api/cronImportAds — Vercel Cron이 매일 자동으로 호출하는 엔드포인트.
// META_AD_BRANDS 목록을 돌면서 메타 광고 라이브러리에서 각 브랜드의 집행 중인
// 광고를 검색하고, 이미지 광고만 걸러서(영상은 건너뜀) 업종 카테고리·한줄
// 요약을 AI로 붙여 "가져오기 대기 큐"에 쌓는다. 실제 이미지 레퍼런스에는
// 반영되지 않고, reference-board.html에서 사람이 승인해야 반영된다.
//
// 인증: Vercel Cron은 브라우저가 아니라 Vercel 인프라가 직접 호출하므로
// rejectIfNotSameOrigin(Origin 헤더 기반)을 못 쓴다 — 대신 Vercel이 cron
// 요청에 자동으로 실어 보내는 Authorization: Bearer $CRON_SECRET 헤더를
// 검증한다(CRON_SECRET 환경변수를 직접 만들어 등록해둬야 함).
//
// 이미지 처리 관련 제약: 이 프로젝트는 서버에서 이미지 리사이즈를 할 수 없어
// (Node 환경 제약 — canvas 등 이미지 라이브러리 없음), 썸네일/원본을 따로
// 만들지 않고 메타에서 받은 이미지를 그대로 thumbUrl/fullUrl 양쪽에 씀.
//
// 스냅샷 페이지에서 이미지 URL을 뽑는 방식(_metaAdLibrary.js)은 실제 운영
// 데이터로 아직 검증 전이다 — added가 계속 0으로 나오면 그 파일의 정규식부터
// 의심할 것.

import { META_AD_BRANDS } from './_metaAdBrands.js';
import { searchAdsForBrand, extractImageFromSnapshot } from './_metaAdLibrary.js';
import { getSeenAdIds, addPendingItems } from './_importQueueStore.js';
import { put } from './_blobPut.js';
import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';
import { callOpenAI } from './_openaiClient.js';

const MAX_NEW_PER_RUN = 10; // 한 번 실행에 새로 추가할 이미지 수 상한(실행 시간 제한 대비)
const MAX_CHECKED_PER_RUN = 60; // 영상 등으로 건너뛴 것까지 포함한 총 확인 개수 상한

function buildClassifyPrompt(brandName) {
  const catList = Object.entries(REFERENCE_CATEGORIES).map(([id, c]) => `${id}(${c.name})`).join(', ');
  return `다음은 "${brandName}"의 광고 배너 이미지입니다. 아래 두 가지를 채워서 응답하세요.

- category: 이 배너에 가장 가까운 업종 카테고리 하나를 아래 목록에서 정확히 그 영문 id 그대로 고르세요 (목록에 없는 값은 절대 쓰지 마세요): ${catList}
- note: 이 배너의 핵심 오퍼·비주얼을 15단어 이내 한국어 한 줄로 요약하세요. 브랜드명은 이미 따로 기록되니 다시 쓰지 마세요.

반드시 아래 JSON 스키마로만 응답하세요:
{"category":"...","note":"..."}`;
}

async function classifyImage(apiKey, base64, mediaType, brandName) {
  try {
    const parsed = await callOpenAI({
      apiKey,
      promptText: buildClassifyPrompt(brandName),
      images: [{ base64, mediaType }],
      maxOutputTokens: 500,
      reasoningEffort: 'low',
    });
    const category = Object.prototype.hasOwnProperty.call(REFERENCE_CATEGORIES, parsed.category) ? parsed.category : null;
    const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';
    return { category, note };
  } catch (e) {
    return { category: null, note: '' };
  }
}

function guessMimeType(url) {
  if (/\.png(\?|$)/i.test(url)) return 'image/png';
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp';
  return 'image/jpeg';
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const metaToken = process.env.META_AD_LIBRARY_TOKEN;
  if (!metaToken) {
    res.status(500).json({ error: '서버에 META_AD_LIBRARY_TOKEN 환경변수가 설정되어 있지 않습니다.' });
    return;
  }
  const openaiKey = process.env.OPENAI_API_KEY;

  const seenAdIds = await getSeenAdIds();
  const newItems = [];
  const skippedAdIds = [];
  const brandLog = [];
  let checkedCount = 0;

  for (const brandName of META_AD_BRANDS) {
    if (newItems.length >= MAX_NEW_PER_RUN || checkedCount >= MAX_CHECKED_PER_RUN) break;
    const ads = await searchAdsForBrand(metaToken, brandName);
    let addedForBrand = 0;

    for (const ad of ads) {
      if (newItems.length >= MAX_NEW_PER_RUN || checkedCount >= MAX_CHECKED_PER_RUN) break;
      if (!ad.id || seenAdIds.has(ad.id) || !ad.ad_snapshot_url) continue;
      checkedCount++;

      const result = await extractImageFromSnapshot(ad.ad_snapshot_url);
      if (!result) { skippedAdIds.push(ad.id); continue; } // 영상 광고이거나 이미지 판별 실패

      try {
        const imgResp = await fetch(result.imageUrl);
        if (!imgResp.ok) { skippedAdIds.push(ad.id); continue; }
        const bytes = Buffer.from(await imgResp.arrayBuffer());
        const mimeType = imgResp.headers.get('content-type') || guessMimeType(result.imageUrl);
        const base64 = bytes.toString('base64');

        const { category, note } = openaiKey
          ? await classifyImage(openaiKey, base64, mimeType, brandName)
          : { category: null, note: '' };

        const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : (String(Date.now()) + Math.random().toString(16).slice(2));
        const imageUrl = await put(`reference/import-queue/${id}.${ext}`, bytes, mimeType);

        newItems.push({
          adId: ad.id,
          entry: {
            id,
            brandName,
            thumbUrl: imageUrl,
            fullUrl: imageUrl,
            mimeType,
            suggestedCategory: category,
            note,
            fetchedAt: new Date().toISOString(),
          },
        });
        addedForBrand++;
      } catch (e) {
        skippedAdIds.push(ad.id);
      }
    }
    brandLog.push({ brand: brandName, found: ads.length, added: addedForBrand });
  }

  if (newItems.length || skippedAdIds.length) {
    await addPendingItems(newItems, skippedAdIds);
  }

  res.status(200).json({ ok: true, added: newItems.length, skipped: skippedAdIds.length, checked: checkedCount, brands: brandLog });
}
