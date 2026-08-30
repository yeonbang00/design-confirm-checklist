// POST /api/analysisLog  — 분석이 끝날 때 판정 결과를 익명으로 적재
// GET  /api/analysisLog  — 관리자만 조회(X-Admin-Password), 집계까지 함께 반환
//
// 목적은 판정 고도화 하나다. "어떤 항목이 유독 자주 걸리는가"를 실제 분포로
// 보고 프롬프트를 고치기 위한 것이지, 누가 무엇을 올렸는지 보기 위한 게 아니다.
//
// 익명 보장을 위해 지키는 규칙:
//  1) 사용자 식별자(계정·이메일·쿠키·IP)를 저장하지 않는다.
//  2) 클라이언트가 보낸 값을 그대로 저장하지 않고, 아래 화이트리스트 필드만
//     골라 서버에서 다시 조립한다 — 나중에 클라이언트에 필드가 추가돼도
//     실수로 식별 정보가 새어 들어오지 않게 하는 장치다.
//  3) 시각은 날짜까지만 남긴다. 시:분까지 남기면 "몇 시에 올렸는지"로
//     소수 인원 팀에서는 사실상 개인이 특정되기 때문이다.
//  4) 이미지 자체는 저장하지 않는다(용량·저작권·유출 위험).

import { addAnalysisLog, getAnalysisLog, summarizeLog } from './_analysisLogStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

const VALID_STATUS = ['pass', 'needsfix', 'reject', 'na'];

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method === 'POST') {
    if (rejectIfNotSameOrigin(req, res)) return;

    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) {
      res.status(400).json({ error: '판정 결과가 없습니다.' });
      return;
    }

    // 화이트리스트 조립 — 클라이언트가 뭘 더 보내든 여기 없는 필드는 버려진다.
    const counts = { pass: 0, needsfix: 0, reject: 0, na: 0 };
    const verdicts = [];
    rawItems.forEach((it) => {
      const id = Number(it.id);
      const status = String(it.status || '');
      if (!Number.isInteger(id) || !VALID_STATUS.includes(status)) return;
      counts[status]++;
      const entry = { id, status };
      // note는 걸린 항목(검토·반려)만, 그것도 잘라서 — 고도화에 필요한 건
      // "왜 걸렸는지"의 요지이지 전문이 아니고, 전부 담으면 로그가 비대해진다.
      if ((status === 'needsfix' || status === 'reject') && it.note) {
        entry.note = String(it.note).slice(0, 120);
      }
      verdicts.push(entry);
    });

    if (!verdicts.length) {
      res.status(400).json({ error: '유효한 판정이 없습니다.' });
      return;
    }

    const now = new Date();
    // 날짜까지만 (KST 기준) — 위 3)번 규칙
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const date = kst.toISOString().slice(0, 10);

    try {
      await addAnalysisLog({
        id: Math.random().toString(36).slice(2, 14),
        date,
        verdicts,
        counts,
        // 아래는 배너 자체의 속성이라 개인과 무관하고, 고도화에 직접 쓰인다.
        advertiserId: body.advertiserId ? String(body.advertiserId).slice(0, 80) : null,
        mediaGuideIds: Array.isArray(body.mediaGuideIds)
          ? body.mediaGuideIds.slice(0, 10).map((m) => String(m).slice(0, 60))
          : [],
        imageWidth: Number.isFinite(Number(body.imageWidth)) ? Number(body.imageWidth) : null,
        imageHeight: Number.isFinite(Number(body.imageHeight)) ? Number(body.imageHeight) : null,
        hasBrief: !!body.hasBrief,
      });
      res.status(200).json({ ok: true });
    } catch (e) {
      // 로그 적재는 부가 기능이라, 실패해도 사용자 분석 흐름을 막지 않는다.
      res.status(500).json({ error: '로그 저장에 실패했습니다.' });
    }
    return;
  }

  if (req.method === 'GET') {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      res.status(500).json({ error: '서버에 ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
      return;
    }
    if (req.headers['x-admin-password'] !== expected) {
      res.status(403).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
      return;
    }
    const items = await getAnalysisLog();
    const summary = summarizeLog(items);
    // 최근 것이 위로 오게 — 관리자 화면에서 최근 경향부터 본다.
    res.status(200).json({ summary, items: items.slice().reverse().slice(0, 300) });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
