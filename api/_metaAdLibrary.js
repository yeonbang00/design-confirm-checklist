// 메타 광고 라이브러리(Ad Library) API로 브랜드별 집행 중인 광고를 검색한다.
//
// 원래는 스냅샷 페이지(ad_snapshot_url)에서 이미지까지 직접 추출하려 했지만,
// 그 페이지가 완전히 자바스크립트로 그려지는 SPA라서 서버의 plain fetch로는
// 이미지 주소를 전혀 못 읽는다는 게 실측으로 확인됐다(og:image·img 태그가
// 원본 HTML에 없음). 그래서 이미지 추출은 포기하고, 검색 결과(브랜드명 +
// 스냅샷 링크)만 큐에 쌓아 사람이 직접 열어보고 저장하는 방식으로 바꿨다 —
// 자세한 경위는 project_designhero_meta_ad_library_import 메모리 참고.
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
