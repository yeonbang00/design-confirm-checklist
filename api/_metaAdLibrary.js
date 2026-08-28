// 메타 광고 라이브러리(Ad Library) API로 브랜드별 집행 중인 광고를 검색하고,
// 각 광고의 스냅샷 페이지에서 "이미지 광고인지"를 판별해 실제 이미지 URL을
// 뽑아낸다. 영상 광고는 건너뛴다(AdCheck 이미지 레퍼런스는 정적 배너만 다룸).
//
// 판별 방법: 스냅샷 렌더 페이지(ads/archive/render_ad)의 og:type 메타 태그와
// <video> 태그 유무를 확인한다. og 태그는 링크 미리보기(카카오톡/슬랙 공유 등)를
// 위해 서버가 항상 렌더링해두는 부분이라, 페이지의 나머지가 JS로 그려지는
// SPA라도 이 부분만은 plain fetch로도 안정적으로 읽힐 가능성이 높다 —
// 다만 실제 운영 데이터로 검증 전이라 확실하지 않으니, 이 판별이 계속
// 틀리면(예: 이미지인데 항상 스킵됨) 이 파일의 정규식부터 의심할 것.
//
// 실패는 전부 조용히 넘어간다(fail-soft) — 브랜드 하나, 광고 하나가 실패해도
// 크론 전체가 멈추면 안 되기 때문.

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
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (e) {
    return [];
  }
}

// 반환: { imageUrl } (이미지 광고) | null (영상 광고이거나 판별 실패)
export async function extractImageFromSnapshot(snapshotUrl) {
  try {
    const resp = await fetch(snapshotUrl);
    if (!resp.ok) return null;
    const html = await resp.text();

    // 영상 광고 신호 — 이 중 하나라도 있으면 영상으로 간주하고 건너뛴다.
    if (/<video[\s>]/i.test(html)) return null;
    const ogTypeMatch = html.match(/property="og:type"\s+content="([^"]+)"/i);
    if (ogTypeMatch && /video/i.test(ogTypeMatch[1])) return null;

    // 이미지 URL 후보 — og:image가 가장 신뢰도 높은 신호(항상 서버 렌더링됨).
    const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i);
    if (ogImageMatch) return { imageUrl: ogImageMatch[1].replace(/&amp;/g, '&') };

    const imgMatch = html.match(/<img[^>]+src="([^"]*(?:scontent|fbcdn)[^"]*)"/i);
    if (imgMatch) return { imageUrl: imgMatch[1].replace(/&amp;/g, '&') };

    return null;
  } catch (e) {
    return null;
  }
}
