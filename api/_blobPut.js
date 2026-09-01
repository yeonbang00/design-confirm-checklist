// Minimal server-side Vercel Blob upload helper (same REST contract used by
// scripts/blob_lib.py locally). Vercel auto-provides BLOB_READ_WRITE_TOKEN
// as an environment variable once a Blob store is connected to the project,
// so this works at runtime without any extra config.

const BLOB_API_BASE = 'https://blob.vercel-storage.com';

// options.allowOverwrite: use a fixed pathname that overwrites on every
// call (for state files that need a stable, predictable URL). Otherwise
// Vercel appends a random suffix so repeated uploads never collide (used
// for one-off generated assets).
//
// allowOverwrite를 쓰는 파일은 캐시 수명도 함께 0으로 내린다. Blob 기본값이
// public, max-age=2592000(30일)이라, 덮어써도 CDN이 한 달 내내 예전 내용을
// 돌려준다. 실제로 관리자 화면에서 분석 기록을 지워도 반영이 안 되는 문제로
// 드러났다.
//
// 읽는 쪽에서 URL에 ?ts= 같은 쿼리를 붙여 뚫으려 해봤지만 통하지 않았다 —
// 이 CDN은 캐시 키에서 쿼리스트링을 무시해서, 한 번도 요청한 적 없는 값을
// 붙여도 x-vercel-cache: HIT이 돌아온다. 그래서 쓰는 쪽에서 해결해야 한다.
export async function put(pathname, bytes, mimeType, options = {}) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('서버에 BLOB_READ_WRITE_TOKEN 환경변수가 설정되어 있지 않습니다.');
  }

  const headers = {
    access: 'public',
    authorization: `Bearer ${token}`,
    'x-api-version': '10',
    'x-content-type': mimeType,
  };
  if (options.allowOverwrite) {
    headers['x-allow-overwrite'] = '1';
    // 덮어쓰는 파일 = 계속 바뀌는 상태 파일이므로 CDN에 캐시되면 안 된다
    headers['x-cache-control-max-age'] = '0';
  } else {
    headers['x-add-random-suffix'] = '1';
  }

  const response = await fetch(`${BLOB_API_BASE}/?pathname=${encodeURIComponent(pathname)}`, {
    method: 'PUT',
    headers,
    body: bytes,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Blob 업로드 실패 (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.url;
}
