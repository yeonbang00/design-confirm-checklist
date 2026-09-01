// 메타 광고 라이브러리(Ad Library) API로 브랜드별 집행 중인 광고를 검색한다.
//
// 원래는 스냅샷 페이지(ad_snapshot_url)에서 이미지까지 직접 추출하려 했지만,
// 그 페이지가 완전히 자바스크립트로 그려지는 SPA라서 서버의 plain fetch로는
// 이미지 주소를 전혀 못 읽는다는 게 실측으로 확인됐다(og:image·img 태그가
// 원본 HTML에 없음). 그래서 이미지 추출은 포기하고, 검색 결과(브랜드명 +
// 스냅샷 링크)만 큐에 쌓아 사람이 직접 열어보고 저장하는 방식으로 바꿨다 —
// 자세한 경위는 project_designhero_meta_ad_library_import 메모리 참고.
//
// media_type=image로 영상 광고는 검색 단계에서 제외한다(실측 확인: 특정
// 브랜드는 활성 광고가 전부 영상이라 media_type=all일 때만 잡히고
// media_type=image에서는 0건으로 정확히 갈림).
//
// search_terms는 정확한 브랜드 필터가 아니라 광고 텍스트 전반에 대한 느슨한
// 텍스트 검색이라, "SSG"처럼 짧고 흔한 검색어는 전혀 무관한 계정(스팸성
// 페이지 등)에도 걸리는 게 실측으로 확인됐다 — 그래서 실제 광고주 계정명
// (page_name)도 같이 받아와서 사람이 링크를 열어보지 않고도 엉뚱한 결과를
// 바로 알아볼 수 있게 한다(자동 필터링은 하지 않음 — 브랜드의 실제 페이지
// 이름이 검색어와 다를 수 있어 자동으로 걸러내면 진짜 결과까지 놓칠 위험).
//
// 실패는 조용히 넘어가되(fail-soft) 원인은 .error에 담아 반환한다 — 브랜드
// 하나가 실패해도 크론 전체가 멈추면 안 되지만, "왜 계속 0개만 나오는지"를
// 나중에 진단할 수 있어야 하기 때문.

const GRAPH_API_BASE = 'https://graph.facebook.com/v26.0';

// pageId가 있으면(META_AD_BRAND_PAGE_IDS에 등록된 브랜드) search_page_ids로
// 검색해서 그 페이지의 광고만 정확히 가져온다 — 텍스트 검색과 달리 무관한
// 계정이 섞일 여지가 원천적으로 없다. pageId가 없으면 기존처럼 느슨한
// 텍스트 검색(search_terms)으로 대체한다.
//
// media_type=image는 search_page_ids와 같이 쓰면 실제로 있는 결과도 0건으로
// 나오는 API 버그성 동작이 실측으로 확인됐다(media_type=all로는 잡히는데
// image로는 항상 0건) — 그래서 pageId로 검색할 때는 media_type 필터를 아예
// 빼고 media_type=all로 받는다. 이 경우 영상 광고가 섞여 들어올 수 있지만,
// 이미 브랜드 자체는 정확하다는 게 보장되니(사칭·무관 계정 문제 없음)
// "가끔 영상이 섞이는" 정도는 사람이 링크 열어보면서 쉽게 거를 수 있는
// 사소한 불편으로 판단했다.
export async function searchAdsForBrand(token, brandName, limit = 15, pageId = null) {
  const params = new URLSearchParams({
    ad_reached_countries: JSON.stringify(['KR']),
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    media_type: pageId ? 'all' : 'image',
    fields: 'id,page_name,ad_snapshot_url,ad_delivery_start_time',
    limit: String(limit),
    access_token: token,
  });
  if (pageId) {
    params.set('search_page_ids', JSON.stringify([pageId]));
  } else {
    params.set('search_terms', brandName);
  }
  try {
    // 광고 라이브러리 API가 가끔 500을 내는 요청은 10~13초씩 걸린 뒤에야
    // 실패로 확정되는 게 실측으로 확인됐다 — 브랜드가 300개+라 이런 느린
    // 실패가 배치마다 하나씩만 섞여도 전체 실행시간(60초 제한)을 넘겨
    // 함수가 통째로 타임아웃돼 버린다. 8초 안에 응답이 없으면 그냥 실패
    // 처리하고 다음 브랜드로 넘어가게 한다.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let resp;
    try {
      resp = await fetch(`${GRAPH_API_BASE}/ads_archive?${params.toString()}`, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      const result = [];
      result.error = `HTTP ${resp.status}: ${errText.slice(0, 300)}`;
      return result;
    }
    const data = await resp.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (e) {
    const result = [];
    result.error = String((e && e.message) || e);
    return result;
  }
}

// 브랜드 하나를 여러 조건으로 동시에 조회해서 어느 조건이 결과를 막는지 가린다.
//
// 광고 라이브러리 웹에서는 광고가 잔뜩 보이는데 API는 357개 브랜드 중 3개만
// 돌려주는 상황을 좁히려고 만들었다. 실패(HTTP 오류)가 아니라 빈 배열이 오는
// 상황이라, 어느 파라미터가 결과를 0으로 만드는지는 조건을 바꿔가며 재보는
// 수밖에 없다. 대기 큐는 건드리지 않고 건수만 센다.
export async function diagnoseBrand(token, brandName, pageId) {
  const variants = [
    { key: 'pageId + ACTIVE',     usePageId: true,  status: 'ACTIVE', media: 'all' },
    { key: 'pageId + 전체기간',    usePageId: true,  status: 'ALL',    media: 'all' },
    { key: '이름검색 + ACTIVE',    usePageId: false, status: 'ACTIVE', media: 'all' },
    { key: '이름검색 + 전체기간',   usePageId: false, status: 'ALL',    media: 'all' },
  ];
  const out = [];
  for (const v of variants) {
    if (v.usePageId && !pageId) { out.push({ ...v, skipped: 'pageId 없음' }); continue; }
    const params = new URLSearchParams({
      ad_type: 'ALL',
      ad_active_status: v.status,
      media_type: v.media,
      fields: 'id,page_id,page_name,ad_snapshot_url',
      limit: '25',
      access_token: token,
    });
    params.set('ad_reached_countries', JSON.stringify(['KR']));   // 이 API의 필수 파라미터라 뺄 수 없다
    if (v.usePageId) params.set('search_page_ids', JSON.stringify([pageId]));
    else params.set('search_terms', brandName);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch(`${GRAPH_API_BASE}/ads_archive?${params.toString()}`, { signal: controller.signal });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        out.push({ key: v.key, error: `HTTP ${resp.status}: ${t.slice(0, 200)}` });
      } else {
        const data = await resp.json();
        const ads = Array.isArray(data.data) ? data.data : [];
        // 이름검색은 엉뚱한 페이지를 물어올 수 있으니 어느 페이지가 잡혔는지도 남긴다
        const pages = [...new Set(ads.map((a) => `${a.page_name || '?'}(${a.page_id || '?'})`))].slice(0, 4);
        out.push({ key: v.key, count: ads.length, pages });
      }
    } catch (e) {
      out.push({ key: v.key, error: String((e && e.message) || e) });
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}
