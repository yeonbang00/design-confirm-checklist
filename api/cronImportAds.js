// GET /api/cronImportAds — Vercel Cron이 매일 자동으로 호출하는 엔드포인트.
// META_AD_BRANDS 목록을 돌면서 메타 광고 라이브러리에서 각 브랜드의 집행 중인
// 광고를 검색해 "가져오기 대기 큐"에 (브랜드명 + 스냅샷 링크)만 쌓는다.
//
// 이미지 자체는 서버가 받아오지 않는다 — 스냅샷 페이지(ad_snapshot_url)가
// 자바스크립트로만 그려지는 SPA라서 서버의 plain fetch로는 이미지 주소를
// 전혀 뽑을 수 없다는 게 실제 데이터로 확인됐다(og:image·img 태그 자체가
// 원본 HTML에 없음). 그래서 사람이 링크를 열어 직접 이미지를 저장한 뒤
// reference-board.html의 업로드 기능(AI 자동분류 포함)으로 등록하는 방식으로
// 바꿨다 — 대신 "브랜드별로 뭐가 새로 떴는지 찾는" 수고만 자동화한다.
//
// 인증: Vercel Cron은 브라우저가 아니라 Vercel 인프라가 직접 호출하므로
// rejectIfNotSameOrigin(Origin 헤더 기반)을 못 쓴다 — 대신 Vercel이 cron
// 요청에 자동으로 실어 보내는 Authorization: Bearer $CRON_SECRET 헤더를
// 검증한다. 이 라우트는 middleware.js의 사이트 전체 로그인 게이트에서도
// 별도로 예외 처리돼 있다(Vercel Cron은 로그인 세션이 없어 게이트를 통과할
// 수 없기 때문).
//
// 메타 토큰: System User(비영구) 토큰은 Ad Library API(ads_archive)에
// "Application does not have permission for this action"(code 10,
// subcode 2332002) 에러를 내는 것으로 확인됐다 — 이 API는 개인 신원 인증을
// 마친 User Access Token으로만 접근 가능하고, System User 토큰은 별도의
// 정식 비즈니스 인증(사업자 서류 제출)까지 필요한 것으로 보인다. 그래서
// META_AD_LIBRARY_TOKEN에는 개인 User Access Token(장기 토큰, 최대 60일)을
// 넣어야 하고, 만료되면 Graph API Explorer에서 재발급해 갱신해야 한다.

import { META_AD_BRANDS } from './_metaAdBrands.js';
import { searchAdsForBrand } from './_metaAdLibrary.js';
import { getSeenAdIds, addPendingItems, clearStaleQueueItems, clearQueueItemsByBrand } from './_importQueueStore.js';

const MAX_NEW_PER_RUN = 300; // 대기 큐가 무한정 커지지 않게 하는 안전장치
const BRAND_BATCH_SIZE = 10; // 브랜드가 많아(100개+) 순차 처리하면 느려서 동시 처리

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // 일회성 정리 도구 — media_type/page_name 필터를 추가하기 전에 쌓인 옛
  // 대기 항목(pageName 없음)을 한꺼번에 지운다. middleware.js가 이 경로만
  // 로그인 게이트에서 예외 처리해뒀기 때문에, 같은 CRON_SECRET을 재사용해서
  // 여기 얹었다(별도 라우트를 새로 뚫으면 middleware.js 예외 처리를 또
  // 추가해야 해서).
  if (req.method === 'POST' && req.body && req.body.action === 'clearStale') {
    const result = await clearStaleQueueItems();
    res.status(200).json({ ok: true, ...result });
    return;
  }
  if (req.method === 'POST' && req.body && req.body.action === 'clearByBrand' && Array.isArray(req.body.brands)) {
    const result = await clearQueueItemsByBrand(req.body.brands);
    res.status(200).json({ ok: true, ...result });
    return;
  }

  const metaToken = process.env.META_AD_LIBRARY_TOKEN;
  if (!metaToken) {
    res.status(500).json({ error: '서버에 META_AD_LIBRARY_TOKEN 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const seenAdIds = await getSeenAdIds();
  const newItems = [];
  const brandLog = [];

  for (let i = 0; i < META_AD_BRANDS.length; i += BRAND_BATCH_SIZE) {
    if (newItems.length >= MAX_NEW_PER_RUN) break;

    const batch = META_AD_BRANDS.slice(i, i + BRAND_BATCH_SIZE);
    const results = await Promise.all(batch.map((brandName) => searchAdsForBrand(metaToken, brandName)));

    batch.forEach((brandName, idx) => {
      const ads = results[idx];
      let addedForBrand = 0;
      for (const ad of ads) {
        if (!ad.id || seenAdIds.has(ad.id) || !ad.ad_snapshot_url) continue;
        newItems.push({
          adId: ad.id,
          entry: {
            id: ad.id,
            brandName,
            pageName: ad.page_name || null,
            snapshotUrl: ad.ad_snapshot_url,
            adDeliveryStartTime: ad.ad_delivery_start_time || null,
            fetchedAt: new Date().toISOString(),
          },
        });
        addedForBrand++;
      }
      brandLog.push({
        brand: brandName,
        found: Array.isArray(ads) ? ads.length : 0,
        added: addedForBrand,
        ...(ads && ads.error ? { error: ads.error } : {}),
      });
    });
  }

  if (newItems.length) {
    await addPendingItems(newItems, []);
  }

  res.status(200).json({ ok: true, added: newItems.length, brands: brandLog });
}
