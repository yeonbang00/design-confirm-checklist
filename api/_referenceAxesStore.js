// 레퍼런스 축 태그 저장소.
//
// 큐레이션된 978장은 _referenceLibrary.js라는 소스 파일에 박혀 있고,
// 서버리스 함수는 자기 소스를 런타임에 고칠 수 없다. 그래서 축 태그만
// Blob에 매니페스트 한 장으로 따로 둔다. reference-uploads.json과 같은 방식이다.
//
// 키는 Blob 파일명 끝의 무작위 접미사다. 전체 URL을 키로 쓰면 매니페스트가
// 400KB를 넘는다. 접미사만 쓰면 절반 이하로 줄고 여전히 고유하다.
//
// 스키마가 바뀌면 v를 올린다. 러너가 v가 다른 항목을 다시 태깅한다.

import { put } from './_blobPut.js';

const BLOB_PUBLIC_BASE = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com';
const AXES_URL = `${BLOB_PUBLIC_BASE}/reference-axes.json`;

export const AXES_SCHEMA = 1;

/* 매니페스트 키. Blob URL 끝의 무작위 접미사를 쓴다.
   .../coach-nhn-001-thumb-qehN61NNlt24NzwAWzHY0nJ1wz0GcH.jpg → qehN61NN... */
export function axesKey(url) {
  const name = String(url || '').split('?')[0].split('/').pop() || '';
  const stem = name.replace(/\.[a-z0-9]+$/i, '');
  const tail = stem.split('-').pop();
  return tail && tail.length >= 8 ? tail : stem.slice(-40);
}

export async function getReferenceAxes() {
  try {
    const resp = await fetch(AXES_URL, { cache: 'no-store' });
    if (!resp.ok) return {};
    const data = await resp.json();
    return data && typeof data.items === 'object' && data.items ? data.items : {};
  } catch (e) {
    return {};
  }
}

/* 여러 건을 한 번에 합친다. 동시에 여러 요청이 읽고 쓰면 서로 덮어쓰므로
   러너는 이 호출을 반드시 하나씩 순서대로 보낸다. 태깅 자체는 동시에 해도
   되지만 저장은 직렬이어야 한다. */
export async function mergeReferenceAxes(entries) {
  const items = await getReferenceAxes();
  let added = 0;
  for (const e of entries) {
    const key = axesKey(e?.url);
    if (!key || !e?.axes || !Object.keys(e.axes).length) continue;
    items[key] = {
      v: AXES_SCHEMA,
      axes: e.axes,
      ...(e.note ? { note: String(e.note).slice(0, 120) } : {}),
      ...(e.type ? { type: String(e.type).slice(0, 20) } : {}),
    };
    added += 1;
  }
  const bytes = Buffer.from(JSON.stringify({ schema: AXES_SCHEMA, items }), 'utf-8');
  await put('reference-axes.json', bytes, 'application/json', { allowOverwrite: true });
  return { added, total: Object.keys(items).length };
}
