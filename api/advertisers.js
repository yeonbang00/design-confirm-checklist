// GET /api/advertisers
// Returns the list of advertisers that have reference banners registered,
// for the frontend's advertiser-selector dropdown. Never returns the image
// data itself (keeps the response small and fast).
//
// POST /api/advertisers
// Body: { name: string, editPassword: string }
// Adds a new brand live from guide.html's "+ 브랜드 추가" UI (see
// api/_brandListStore.js). Reuses the same shared edit password as guide
// editing — there's no per-user login on this site, so this is the one
// check standing between "anyone with the link" and adding brands.
//
// DELETE /api/advertisers
// Body: { id: string, editPassword: string }
// Removes a brand. Brands added live (isCustom: true) are removed outright.
// Curated brands defined in _referenceBanners.js (e.g. 유플러스) can't be
// removed from git at runtime, so deleting one instead hides it — it (and
// its reference images) stay intact, just filtered out of every list (see
// _brandListStore.js's hideCuratedBrand()).
//
// Both write methods piggyback on this existing route (instead of new
// endpoint files) to stay under Vercel Hobby's serverless function limit.

import { getAllAdvertisers } from './_referenceBanners.js';
import { addDynamicBrand, removeDynamicBrand, hideCuratedBrand } from './_brandListStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const advertisersMap = await getAllAdvertisers();
    const advertisers = Object.entries(advertisersMap).map(([id, a]) => ({
      id,
      name: a.name,
      note: a.note || '',
      imageCount: (a.images || []).length,
      isCustom: !!a.isCustom,
    }));
    res.status(200).json({ advertisers });
    return;
  }

  if (req.method === 'POST') {
    if (rejectIfNotSameOrigin(req, res)) return;

    const expectedPassword = process.env.BRAND_GUIDE_EDIT_PASSWORD;
    if (!expectedPassword) {
      res.status(500).json({ error: '서버에 BRAND_GUIDE_EDIT_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
      return;
    }

    const { name, editPassword } = req.body || {};
    if (editPassword !== expectedPassword) {
      res.status(403).json({ error: '편집 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const trimmed = (name || '').trim();
    if (!trimmed) {
      res.status(400).json({ error: '브랜드 이름을 입력해주세요.' });
      return;
    }

    try {
      const advertisersMap = await getAllAdvertisers();
      const duplicate = Object.values(advertisersMap).some((a) => a.name === trimmed);
      if (duplicate) {
        res.status(400).json({ error: '이미 등록된 브랜드 이름입니다.' });
        return;
      }
      const brand = await addDynamicBrand(trimmed);
      res.status(200).json({ ok: true, brand });
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    if (rejectIfNotSameOrigin(req, res)) return;

    // 브랜드 삭제는 팀 공용 편집 비밀번호(BRAND_GUIDE_EDIT_PASSWORD)가 아니라
    // 관리자 전용 비밀번호로 막는다 — 추가는 팀원 누구나 해도 되지만, 삭제는
    // 기존 체크리스트·피드백이 함께 사라지는 되돌리기 어려운 작업이라서.
    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword) {
      res.status(500).json({ error: '서버에 ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
      return;
    }

    const { id, editPassword } = req.body || {};
    if (editPassword !== expectedPassword) {
      res.status(403).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: '삭제할 브랜드를 지정해주세요.' });
      return;
    }

    try {
      const advertisersMap = await getAllAdvertisers();
      const target = advertisersMap[id];
      if (!target) {
        res.status(400).json({ error: '존재하지 않는 브랜드입니다.' });
        return;
      }
      if (target.isCustom) {
        await removeDynamicBrand(id);
      } else {
        await hideCuratedBrand(id);
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : '알 수 없는 서버 오류' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
