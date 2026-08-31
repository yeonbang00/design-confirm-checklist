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
//  4) 이미지는 목록용 썸네일(400px)과 조사용 축소본(1600px) 두 장을 남긴다 —
//     판정이 왜 틀렸는지는 소재를 봐야 알 수 있고, 정렬 3px 차이 같은 문제는
//     작은 썸네일로는 확인이 불가능하다. 원본 그대로는 저장하지 않는다.
//     소재는 "누가 올렸나"가 아니라 "무엇을 판정했나"이므로 익명 원칙과
//     충돌하지 않는다.
//
// PATCH /api/analysisLog — 리뷰어가 판정을 직접 고치면 그 사실을 기록에 붙인다.
// 별도 피드백 버튼(👎)을 두는 대신 이미 있는 "판정 변경" 동작을 신호로 쓴다:
// 추가 클릭이 없고, "틀렸다"가 아니라 "반려→통과처럼 어느 방향으로 틀렸다"까지
// 남아서 프롬프트를 고칠 때 훨씬 쓸모가 있다.

import { addAnalysisLog, getAnalysisLog, removeAnalysisLog, addVerdictFlip, summarizeLog } from './_analysisLogStore.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';
import { put } from './_blobPut.js';

const VALID_STATUS = ['pass', 'needsfix', 'reject', 'na'];

// 썸네일 + 1600px 원본급 이미지를 base64로 함께 받으므로 여유를 둔다
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

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
    const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());

    // 이미지 업로드 — 실패해도 로그 자체는 남긴다(이미지 없이).
    // 목록용 썸네일과, 눌러서 확대할 원본급 이미지를 따로 올린다: 정렬 3px 차이
    // 같은 문제는 작은 썸네일로 확인이 안 돼서 조사에 큰 이미지가 필요하다.
    async function upload(base64, name, maxBytes) {
      if (typeof base64 !== 'string' || base64.length < 100) return null;
      try {
        const bytes = Buffer.from(base64, 'base64');
        if (bytes.length > maxBytes) return null;   // 클라이언트가 잘못 보낸 경우 방어
        return await put(`analysis-log/${id}${name}.jpg`, bytes, 'image/jpeg');
      } catch (e) {
        return null;
      }
    }
    const [thumbUrl, fullUrl] = await Promise.all([
      upload(body.thumbBase64, '', 400 * 1024),
      upload(body.fullBase64, '-full', 3 * 1024 * 1024),
    ]);

    try {
      await addAnalysisLog({
        id,
        date,
        verdicts,
        counts,
        thumbUrl,
        fullUrl,
        // 아래는 배너 자체의 속성이라 개인과 무관하고, 고도화에 직접 쓰인다.
        advertiserId: body.advertiserId ? String(body.advertiserId).slice(0, 80) : null,
        mediaGuideIds: Array.isArray(body.mediaGuideIds)
          ? body.mediaGuideIds.slice(0, 10).map((m) => String(m).slice(0, 60))
          : [],
        imageWidth: Number.isFinite(Number(body.imageWidth)) ? Number(body.imageWidth) : null,
        imageHeight: Number.isFinite(Number(body.imageHeight)) ? Number(body.imageHeight) : null,
        hasBrief: !!body.hasBrief,
      });
      // id를 돌려줘야 클라이언트가 이후 판정 수정을 이 기록에 붙일 수 있다
      res.status(200).json({ ok: true, id });
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

  // 리뷰어가 판정을 고치면 그 내역을 해당 기록에 붙인다. 관리자 비밀번호는
  // 요구하지 않는다 — 판정을 고치는 건 모든 팀원이 하는 일이고, 여기서도
  // 누가 고쳤는지는 저장하지 않는다.
  if (req.method === 'PATCH') {
    if (rejectIfNotSameOrigin(req, res)) return;

    const body = req.body || {};
    const logId = body.logId ? String(body.logId) : '';
    const itemId = Number(body.itemId);
    const from = String(body.from || '');
    const to = String(body.to || '');
    if (!logId || !Number.isInteger(itemId) || !VALID_STATUS.includes(to)) {
      res.status(400).json({ error: '요청이 올바르지 않습니다.' });
      return;
    }
    try {
      const ok = await addVerdictFlip(logId, {
        itemId,
        from: VALID_STATUS.includes(from) ? from : null,
        to,
        // AI가 그 항목에 적은 사유 — 사람이 왜 다르게 봤는지 대조하려면 이게 있어야
        // 한다. 통과 항목의 note는 평소 저장하지 않으므로 여기서만 남는다.
        aiNote: body.aiNote ? String(body.aiNote).slice(0, 200) : null,
        // 같은 항목을 여러 번 고치면 마지막 값만 의미가 있으므로 덮어쓴다
        at: new Date().toISOString(),
      });
      res.status(200).json({ ok });
    } catch (e) {
      res.status(500).json({ error: '기록에 실패했습니다.' });
    }
    return;
  }

  // 테스트로 돌린 기록 등을 관리자가 골라 지운다 — 남겨두면 판정 분포가 왜곡된다.
  if (req.method === 'DELETE') {
    if (rejectIfNotSameOrigin(req, res)) return;

    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      res.status(500).json({ error: '서버에 ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다.' });
      return;
    }
    if (req.headers['x-admin-password'] !== expected) {
      res.status(403).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const id = req.body && req.body.id;
    if (!id) {
      res.status(400).json({ error: '삭제할 기록을 지정해주세요.' });
      return;
    }
    try {
      const removed = await removeAnalysisLog(String(id));
      if (!removed) {
        res.status(400).json({ error: '존재하지 않는 기록입니다.' });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: '삭제에 실패했습니다.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
