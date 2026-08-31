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

import { META_AD_BRANDS, META_AD_BRAND_PAGE_IDS } from './_metaAdBrands.js';
import { searchAdsForBrand } from './_metaAdLibrary.js';
import { getSeenAdIds, addPendingItems, clearStaleQueueItems, clearQueueItemsByBrand, getBrandCursor, saveBrandCursor, saveLastRun } from './_importQueueStore.js';

const MAX_NEW_PER_RUN = 300; // 대기 큐가 무한정 커지지 않게 하는 안전장치
const BRAND_BATCH_SIZE = 10; // 브랜드가 많아(100개+) 순차 처리하면 느려서 동시 처리
const TIME_BUDGET_MS = 260000; // maxDuration(300초)보다 여유를 둬서, 시간 안에 못 끝내면
                                // Vercel이 강제로 죽이기(504) 전에 우리가 먼저 깔끔하게 멈춘다

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
  const brandLog = [];
  let totalAdded = 0;
  const startTime = Date.now();

  // 브랜드가 300개+인데 광고 라이브러리 API가 느리거나 타임아웃되는 경우가
  // 많아서, 한 번의 실행으로 전체를 다 돌지 못하는 게 실측으로 확인됐다.
  // 매번 0번부터 시작하면 뒤쪽 브랜드는 영영 처리되지 못하므로, 지난 실행이
  // 멈춘 지점(커서)부터 이어서 처리하고 목록 끝에 닿으면 앞으로 순환한다.
  const N = META_AD_BRANDS.length;
  const cursor = await getBrandCursor();
  const order = Array.from({ length: N }, (_, k) => (cursor + k) % N);
  let processed = 0;
  let hitTimeBudget = false;

  for (let i = 0; i < order.length; i += BRAND_BATCH_SIZE) {
    if (totalAdded >= MAX_NEW_PER_RUN) break;
    if (Date.now() - startTime > TIME_BUDGET_MS) { hitTimeBudget = true; break; }

    const batchIdx = order.slice(i, i + BRAND_BATCH_SIZE);
    const batch = batchIdx.map((idx) => META_AD_BRANDS[idx]);
    const results = await Promise.all(batch.map((brandName) => searchAdsForBrand(metaToken, brandName, 15, META_AD_BRAND_PAGE_IDS[brandName] || null)));

    const batchItems = [];
    batch.forEach((brandName, idx) => {
      const ads = results[idx];
      let addedForBrand = 0;
      for (const ad of ads) {
        if (!ad.id || seenAdIds.has(ad.id) || !ad.ad_snapshot_url) continue;
        batchItems.push({
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
        seenAdIds.add(ad.id); // 같은 실행 안에서 다른 브랜드 검색이 같은 광고를 또 잡아도 중복 저장 안 되게
        addedForBrand++;
      }
      brandLog.push({
        brand: brandName,
        found: Array.isArray(ads) ? ads.length : 0,
        added: addedForBrand,
        ...(ads && ads.error ? { error: ads.error } : {}),
      });
    });

    // 배치가 끝날 때마다 바로 저장한다 — 브랜드 목록이 늘어나면서 전체 루프를
    // 다 돌기 전에 함수 실행시간 제한(maxDuration)에 걸려 죽는 일이 실측으로
    // 확인됐는데, 예전엔 맨 마지막에 딱 한 번만 저장했어서 타임아웃 나면 그때까지
    // 처리한 배치분까지 전부 날아갔다. 배치 단위로 저장하면 중간에 죽어도
    // 그 앞 배치들은 큐에 남는다.
    if (batchItems.length) {
      await addPendingItems(batchItems, []);
      totalAdded += batchItems.length;
    }
    processed += batch.length;
  }

  const nextCursor = (cursor + processed) % N;
  await saveBrandCursor(nextCursor);

  // 이번 실행이 어떻게 끝났는지 남긴다 — 관리자 페이지에서 "수집이 조용히
  // 멈춰 있는 상태"를 알아채기 위한 것. 특히 토큰 만료는 에러 화면이 어디에도
  // 안 떠서, 이 기록이 없으면 며칠씩 모르고 지나간다.
  const failed = brandLog.filter((b) => b.error);
  // 브랜드 대부분이 같은 이유로 실패하면 개별 브랜드 문제가 아니라 토큰·권한
  // 문제일 가능성이 높다(실제로 ads_read 권한 누락 때 전 브랜드가 400이었다).
  const looksLikeAuth = processed > 0 && failed.length >= processed * 0.8;
  try {
    await saveLastRun({
      at: new Date().toISOString(),
      ok: !looksLikeAuth,
      added: totalAdded,
      processed,
      total: N,
      failedCount: failed.length,
      hitTimeBudget,
      // 원인 파악용으로 실패 사유 하나만 샘플로 남긴다(전부 남기면 너무 길어짐)
      sampleError: failed.length ? String(failed[0].error).slice(0, 200) : null,
    });
  } catch (e) {
    // 상태 기록 실패가 수집 결과 반환을 막을 이유는 없다
  }

  res.status(200).json({ ok: true, added: totalAdded, processed, total: N, hitTimeBudget, nextCursor, brands: brandLog });
}
