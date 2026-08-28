// GET/POST /api/instagramWebhook — 인스타그램 DM으로 공유받은 게시물·광고를
// 자동으로 대기 큐에 쌓는 웹훅 엔드포인트.
//
// 흐름: 사용자가 인스타그램에서 "공유하기"로 AdCheck 전용 계정에 DM을 보내면
// → 메타가 이 엔드포인트로 웹훅을 쏨 → 첨부파일의 실제 미디어 URL을 받아서
// (자바스크립트 렌더링 필요 없음 — DM 첨부파일은 바로 fetch 가능한 진짜
// 이미지 주소로 옴, 단 7일 뒤 만료되니 받는 즉시 다운로드해야 함) → AI로
// 업종·브랜드명 추측 → Blob에 저장 → 대기 큐(_instagramImportStore.js)에 등록.
//
// 인증:
// - GET: 메타의 웹훅 등록 검증 핸드셰이크. hub.verify_token이 우리가 설정한
//   INSTAGRAM_WEBHOOK_VERIFY_TOKEN과 일치하면 hub.challenge를 그대로 돌려준다.
// - POST: 메타가 요청 본문에 X-Hub-Signature-256 헤더(앱 시크릿으로 만든
//   HMAC)를 실어 보내므로, INSTAGRAM_APP_SECRET으로 서명을 검증해서 진짜
//   메타에서 온 요청인지 확인한다(둘 다 이 앱을 만들 때 발급받은 값).
// - 이 라우트는 middleware.js의 사이트 전체 로그인 게이트에서 예외 처리돼
//   있다(메타 웹훅은 로그인 세션이 없어 게이트를 통과할 수 없기 때문 — cron과
//   같은 이유).

import crypto from 'crypto';
import { addPendingItem } from './_instagramImportStore.js';
import { put } from './_blobPut.js';
import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';
import { callOpenAI } from './_openaiClient.js';

function verifySignature(req, rawBody) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) return false;
  const signature = req.headers['x-hub-signature-256'] || '';
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function buildPrompt() {
  const catList = Object.entries(REFERENCE_CATEGORIES).map(([id, c]) => `${id}(${c.name})`).join(', ');
  return `다음은 인스타그램에서 공유된 광고/게시물 이미지입니다. 아래 항목을 채워서 응답하세요.

- brandName: 이미지 속 로고나 텍스트를 보고 브랜드명을 추측해 적으세요. 전혀 알아볼 수 없으면 빈 문자열로 두세요.
- category: 이 이미지에 가장 가까운 업종 카테고리 하나를 아래 목록에서 정확히 그 영문 id 그대로 고르세요 (목록에 없는 값은 절대 쓰지 마세요): ${catList}
- note: 이 배너의 핵심 오퍼·비주얼을 15단어 이내 한국어 한 줄로 요약하세요. 브랜드명은 다시 쓰지 마세요.

반드시 아래 JSON 스키마로만 응답하세요:
{"brandName":"...","category":"...","note":"..."}`;
}

async function classifyImage(apiKey, base64, mediaType) {
  try {
    const parsed = await callOpenAI({
      apiKey,
      promptText: buildPrompt(),
      images: [{ base64, mediaType }],
      maxOutputTokens: 500,
      reasoningEffort: 'low',
    });
    const category = Object.prototype.hasOwnProperty.call(REFERENCE_CATEGORIES, parsed.category) ? parsed.category : null;
    const brandName = typeof parsed.brandName === 'string' ? parsed.brandName.trim() : '';
    const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';
    return { category, brandName, note };
  } catch (e) {
    return { category: null, brandName: '', note: '' };
  }
}

function guessMimeType(url) {
  if (/\.png(\?|$)/i.test(url)) return 'image/png';
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp';
  if (/\.mp4(\?|$)/i.test(url)) return 'video/mp4';
  return 'image/jpeg';
}

export const config = {
  api: {
    bodyParser: false, // 서명 검증에 원본 바이트가 그대로 필요해서 직접 읽는다
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// 진단용 기록 — 메타가 실제로 웹훅을 호출했는지, 어디서 막혔는지 사람이
// 직접 확인할 방법이 없어서(서버 로그 접근 불가) 최근 호출 20건을 여기에
// 남긴다. 문제 다 해결되면 지워도 되는 임시 코드.
async function logDebug(entry) {
  try {
    const url = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/instagram-webhook-debug.json';
    const resp = await fetch(url, { cache: 'no-store' });
    const data = resp.ok ? await resp.json() : { logs: [] };
    const logs = Array.isArray(data.logs) ? data.logs : [];
    logs.unshift({ at: new Date().toISOString(), ...entry });
    const bytes = Buffer.from(JSON.stringify({ logs: logs.slice(0, 20) }), 'utf-8');
    await put('instagram-webhook-debug.json', bytes, 'application/json', { allowOverwrite: true });
  } catch (e) {
    // 진단 기록 자체가 실패해도 본 로직에 영향 주면 안 됨
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    await logDebug({ method: 'GET', mode, tokenMatch: token === verifyToken, hasVerifyToken: !!verifyToken });
    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
      res.status(200).end(String(challenge));
      return;
    }
    res.status(403).end('Verification failed');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawBody = await readRawBody(req);
  const hasAppSecret = !!process.env.INSTAGRAM_APP_SECRET;
  const sigOk = verifySignature(req, rawBody);
  if (!sigOk) {
    await logDebug({ method: 'POST', stage: 'signature', hasAppSecret, sigOk, rawBodyLength: rawBody.length, rawBodyPreview: rawBody.toString('utf-8').slice(0, 500) });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf-8'));
  } catch (e) {
    await logDebug({ method: 'POST', stage: 'parse', error: String(e), rawBodyPreview: rawBody.toString('utf-8').slice(0, 500) });
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  // 먼저 200을 돌려주는 게 메타 웹훅 관례지만(재전송 방지), 이 프로젝트
  // 규모(개인/소규모 팀 사용, 트래픽 적음)에서는 처리 후 응답해도 실질적
  // 문제가 없어 단순하게 처리 후 응답한다 — fail-soft로 개별 항목 실패는
  // 조용히 넘어간다.
  const openaiKey = process.env.OPENAI_API_KEY;
  const added = [];
  const attachmentLog = [];
  const skipReasons = [];

  try {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const event of messaging) {
        const attachments = (event.message && Array.isArray(event.message.attachments))
          ? event.message.attachments
          : [];
        for (const att of attachments) {
          const mediaUrl = att && att.payload && att.payload.url;
          attachmentLog.push({ type: att && att.type, hasUrl: !!mediaUrl });
          if (!mediaUrl) { skipReasons.push('no-url'); continue; }
          if (att.type === 'video') { skipReasons.push('video-type'); continue; } // 정적 배너만 다룸 — 영상은 건너뜀

          try {
            const imgResp = await fetch(mediaUrl);
            if (!imgResp.ok) { skipReasons.push('fetch-failed:' + imgResp.status); continue; }
            const bytes = Buffer.from(await imgResp.arrayBuffer());
            const mimeType = imgResp.headers.get('content-type') || guessMimeType(mediaUrl);
            const base64 = bytes.toString('base64');

            const { category, brandName, note } = openaiKey
              ? await classifyImage(openaiKey, base64, mimeType)
              : { category: null, brandName: '', note: '' };

            const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
            const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : (String(Date.now()) + Math.random().toString(16).slice(2));
            const imageUrl = await put(`reference/instagram-import/${id}.${ext}`, bytes, mimeType);

            const entryObj = {
              id,
              brandName,
              suggestedCategory: category,
              note,
              mimeType,
              thumbUrl: imageUrl,
              fullUrl: imageUrl,
              fetchedAt: new Date().toISOString(),
            };
            await addPendingItem(entryObj);
            added.push(id);
          } catch (e) {
            skipReasons.push('process-error:' + String(e && e.message || e));
          }
        }
      }
    }
  } catch (e) {
    skipReasons.push('top-level-error:' + String(e && e.message || e));
  }

  await logDebug({
    method: 'POST', stage: 'processed', sigOk, hasAppSecret,
    entryCount: Array.isArray(body.entry) ? body.entry.length : 0,
    attachmentLog, skipReasons, added: added.length,
    bodyPreview: JSON.stringify(body).slice(0, 800),
  });

  res.status(200).json({ ok: true, added: added.length });
}
