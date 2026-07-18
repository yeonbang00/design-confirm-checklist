// Minimal server-side Vercel Blob upload helper (same REST contract used by
// scripts/blob_lib.py locally). Vercel auto-provides BLOB_READ_WRITE_TOKEN
// as an environment variable once a Blob store is connected to the project,
// so this works at runtime without any extra config.

const BLOB_API_BASE = 'https://blob.vercel-storage.com';

export async function put(pathname, bytes, mimeType) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('서버에 BLOB_READ_WRITE_TOKEN 환경변수가 설정되어 있지 않습니다.');
  }

  const response = await fetch(`${BLOB_API_BASE}/?pathname=${encodeURIComponent(pathname)}`, {
    method: 'PUT',
    headers: {
      access: 'public',
      authorization: `Bearer ${token}`,
      'x-api-version': '10',
      'x-content-type': mimeType,
      'x-add-random-suffix': '1',
    },
    body: bytes,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Blob 업로드 실패 (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.url;
}
