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

export async function searchAdsForBrand(token, brandName, limit = 15) {
  const params = new URLSearchParams({
    search_terms: brandName,
    ad_reached_countries: JSON.stringify(['KR']),
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    media_type: 'image',
    fields: 'id,page_name,ad_snapshot_url,ad_delivery_start_time',
    limit: String(limit),
    access_token: token,
  });
  try {
    const resp = await fetch(`${GRAPH_API_BASE}/ads_archive?${params.toString()}`);
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
