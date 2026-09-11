// GET  /api/referenceAxes           저장된 축 태그 전부
// POST /api/referenceAxes { items } 축 태그를 매니페스트에 합침
//
// 태깅 자체는 analyzeReferenceImage.js가 한다. 여기는 저장만 맡는다.
// 나눠 둔 이유는 쓰기 충돌 때문이다. 태깅은 동시에 여러 건을 돌려도 되지만
// 매니페스트는 읽고 고쳐 쓰는 구조라 동시에 쓰면 서로 덮어쓴다.
// 러너가 태깅은 병렬로, 저장은 직렬로 부른다.

import { rejectIfNotSameOrigin } from './_originCheck.js';
import { getReferenceAxes, mergeReferenceAxes, removeReferenceAxes, AXES_SCHEMA } from './_referenceAxesStore.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const items = await getReferenceAxes();
    res.status(200).json({ schema: AXES_SCHEMA, count: Object.keys(items).length, items });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  /* 러너가 '지금까지 태깅한 전부'를 매번 통째로 보낸다. 델타만 보내면
     방금 쓴 매니페스트가 반영되기 전에 다음 요청이 읽어 그 사이 것이
     사라진다(952장 중 425장만 남은 적이 있다). 그래서 한도를 넉넉히 둔다.
     여기서 자르면 잘린 만큼이 조용히 사라진다. */
  /* 목록에서 빠진 소재 중 되살릴 가치가 없는 것(검색에 섞여 든 남의 광고)은
     축 태그만 남아 영원히 '미아'로 잡힌다. 그것을 지우는 길. */
  if (Array.isArray(req.body?.remove)) {
    try {
      const out = await removeReferenceAxes(req.body.remove.slice(0, 500));
      res.status(200).json(out);
    } catch (err) {
      res.status(502).json({ error: err?.message || '축 태그를 지우지 못했습니다.' });
    }
    return;
  }

  const entries = Array.isArray(req.body?.items) ? req.body.items.slice(0, 2000) : [];
  if (!entries.length) {
    res.status(400).json({ error: '저장할 항목이 없습니다.' });
    return;
  }
  try {
    const out = await mergeReferenceAxes(entries);
    res.status(200).json(out);
  } catch (err) {
    res.status(502).json({ error: err?.message || '축 태그를 저장하지 못했습니다.' });
  }
}
