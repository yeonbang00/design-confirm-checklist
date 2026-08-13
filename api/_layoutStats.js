// Fetches pre-computed layout/text-position statistics for one 이미지
// 레퍼런스 카테고리, built by scripts/build_layout_stats.py — a local batch
// job (see that script for why this isn't a live Vercel function: it OCRs
// ~290 images, which is too slow/costly to redo per request and would risk
// the platform's execution time limit). Stats files live at public Vercel
// Blob URLs and are only refreshed by re-running that script.
//
// Fails soft: if a category's stats file doesn't exist yet (script hasn't
// been (re)run since that category was added/grown), returns null and
// callers just skip showing this data — never blocks brief analysis.

const LAYOUT_STATS_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/layout-stats';
// 이 미만 표본이면 카테고리 통계가 몇 장 안 되는 우연으로 흔들릴 수 있어
// "참고용으로도 약함"이라는 표시를 붙인다 (숨기지는 않음 — 적은 표본이라도
// 방향성 참고는 될 수 있으니, 신뢰도만 낮춰서 보여준다).
const MIN_RELIABLE_SAMPLES = 10;

export async function getLayoutStats(categoryId) {
  if (!categoryId) return null;
  try {
    const response = await fetch(`${LAYOUT_STATS_BASE}/${categoryId}.json`);
    if (!response.ok) return null;
    const stats = await response.json();
    if (!stats || !stats.sampleCount) return null;
    stats.reliable = stats.sampleCount >= MIN_RELIABLE_SAMPLES;
    return stats;
  } catch (e) {
    return null;
  }
}
