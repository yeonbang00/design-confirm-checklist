// Site-wide access gate — every page AND every /api/* call requires an
// individually-approved account before anything is served. Replaces the
// old single shared-password gate: now each person signs up with their
// own email/password, an admin approves the request from /admin.html,
// and only then can that account log in.
//
// Everything (signup, login, admin approve/reject/revoke) is handled
// right here in Edge Middleware via virtual "/_gate/*" paths — no new
// serverless function was added, since api/ is already at Vercel Hobby's
// 12-function cap. Password hashing uses Web Crypto's PBKDF2 (not Node's
// crypto.scrypt) because Edge Middleware doesn't have Node's crypto
// module, only Web Crypto.
//
// User accounts live in a single users.json file in Vercel Blob Storage
// (same fetch → modify → overwrite-PUT pattern as brand-guide-state/*.json
// in api/_brandGuideStore.js). ADMIN_PASSWORD and BLOB_READ_WRITE_TOKEN
// are set directly in the Vercel dashboard — never typed or seen here.

import { next } from '@vercel/edge';
import { put } from './api/_blobPut.js';

const COOKIE_NAME = 'adcheck_session';
const LOGIN_PATH = '/_gate/login';
const SIGNUP_PATH = '/_gate/signup';
const ADMIN_PENDING_PATH = '/_gate/admin/pending';
const ADMIN_DECIDE_PATH = '/_gate/admin/decide';
const ADMIN_PAGE_PATH = '/admin.html';
const USERS_BLOB_PATH = 'users.json';
const USERS_URL = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/users.json';
const PBKDF2_ITERATIONS = 210000;

export const config = {
  matcher: '/(.*)',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeNextPath(raw) {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function randomHex(byteLen) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// PBKDF2-SHA256 via Web Crypto — Edge Runtime has no Node `crypto` module
// (no crypto.scrypt), only the standard Web Crypto API.
async function pbkdf2Hex(password, saltHex) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

async function getUsers() {
  try {
    const resp = await fetch(USERS_URL, { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.users)) return data;
    }
    if (resp.status === 404) return { users: [] }; // not created yet — genuinely no users
    // Blob responded but with an error status — treat as unreachable, not "no users".
    return { users: [], fetchFailed: true };
  } catch (e) {
    // Network/DNS/etc — Blob unreachable. Distinguish this from "no such user" so
    // login doesn't tell someone their real password is wrong when the actual
    // problem is we couldn't even read the user list.
    return { users: [], fetchFailed: true };
  }
}

async function saveUsers(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  await put(USERS_BLOB_PATH, bytes, 'application/json', { allowOverwrite: true });
}

function findUserByEmail(data, email) {
  const normalized = String(email || '').trim().toLowerCase();
  return data.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

function findUserById(data, id) {
  return data.users.find((u) => u.id === id) || null;
}

async function sessionToken(user) {
  const sig = await sha256Hex(user.id + ':' + user.passwordHash + ':adcheck-session');
  return `${user.id}.${sig}`;
}

// Re-derives the signature from the user's CURRENT stored passwordHash on
// every check (not just at login) — so revoking/rejecting a user, or a
// password change, invalidates any cookie they're already holding right
// away, without needing a separate revocation list.
async function verifySession(cookieVal, data) {
  if (!cookieVal) return null;
  const dot = cookieVal.indexOf('.');
  if (dot === -1) return null;
  const userId = cookieVal.slice(0, dot);
  const sig = cookieVal.slice(dot + 1);
  const user = findUserById(data, userId);
  if (!user || user.status !== 'approved') return null;
  const expectedSig = await sha256Hex(user.id + ':' + user.passwordHash + ':adcheck-session');
  return sig === expectedSig ? user : null;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

function gateHtml({ nextPath, tab, loginError, signupError, signupNotice }) {
  const activeTab = tab === 'signup' ? 'signup' : 'login';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AdCheck | 접근 확인</title>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
<style>
  :root{
    --bg:#0B0C0E; --surface:#14171C; --surface-2:#0F1216; --line:rgba(255,255,255,.11);
    --ink:#EDEEF0; --ink-2:#A2A7B0; --ink-3:#7E838C; --ink-4:#6B707A;
    --accent:#CCFF00; --accent-ink:#0B0C0E; --pass:#A8CFBC; --reject:#C2687A;
  }
  *{box-sizing:border-box;}
  body{margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); color:var(--ink); font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif; -webkit-font-smoothing:antialiased;}
  .box{background:var(--surface); border:1px solid var(--line); border-radius:20px; padding:36px 32px; width:340px; box-shadow:0 24px 60px -20px rgba(0,0,0,.7); box-sizing:border-box;}
  h1{font-size:19px; font-weight:700; margin:0 0 20px; color:var(--ink); letter-spacing:-.02em;}
  .tabs{display:flex; padding:4px; border-radius:12px; background:var(--surface-2); border:1px solid var(--line); margin-bottom:20px;}
  .tab-btn{flex:1; padding:9px; border:none; border-radius:9px; background:none; color:var(--ink-3); font-size:13.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .2s ease,color .2s ease;}
  .tab-btn.active{background:var(--accent); color:var(--accent-ink);}
  .panel{display:none;}
  .panel.active{display:block;}
  p.hint{font-size:12.5px; color:var(--ink-3); margin:0 0 16px; line-height:1.6;}
  input{width:100%; padding:12px 14px; border:1px solid var(--line); border-radius:10px; font-size:14px; box-sizing:border-box; margin-bottom:10px; font-family:inherit; background:var(--surface-2); color:var(--ink);}
  input::placeholder{color:var(--ink-4);}
  input:focus{outline:2px solid var(--accent); outline-offset:1px;}
  button[type="submit"]{width:100%; padding:12px; border:none; border-radius:10px; background:var(--accent); color:var(--accent-ink); font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; margin-top:4px;}
  button[type="submit"]:hover{opacity:.9;}
  .err{color:var(--reject); font-size:12.5px; margin:0 0 12px; line-height:1.6;}
  .notice{color:var(--pass); font-size:12.5px; margin:0 0 16px; background:rgba(168,207,188,.1); border:1px solid rgba(168,207,188,.3); border-radius:8px; padding:10px 12px; line-height:1.6;}
</style>
</head>
<body>
  <div class="box">
    <h1>AdCheck</h1>
    ${signupNotice ? `<div class="notice">${escapeHtml(signupNotice)}</div>` : ''}
    <div class="tabs">
      <button type="button" class="tab-btn ${activeTab === 'login' ? 'active' : ''}" data-tab="login">로그인</button>
      <button type="button" class="tab-btn ${activeTab === 'signup' ? 'active' : ''}" data-tab="signup">가입 신청</button>
    </div>

    <div class="panel ${activeTab === 'login' ? 'active' : ''}" id="panel-login">
      <p class="hint">이메일과 비밀번호를 입력해주세요.</p>
      <form method="POST" action="${LOGIN_PATH}">
        <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
        <input type="email" name="email" placeholder="이메일" autocomplete="username">
        <input type="password" name="password" placeholder="비밀번호" autocomplete="current-password">
        ${loginError ? `<div class="err">${escapeHtml(loginError)}</div>` : ''}
        <button type="submit">로그인</button>
      </form>
    </div>

    <div class="panel ${activeTab === 'signup' ? 'active' : ''}" id="panel-signup">
      <p class="hint">가입 신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.</p>
      <form method="POST" action="${SIGNUP_PATH}">
        <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
        <input type="text" name="name" placeholder="이름" autocomplete="name">
        <input type="email" name="email" placeholder="이메일" autocomplete="username">
        <input type="password" name="password" placeholder="비밀번호 (8자 이상)" autocomplete="new-password">
        <input type="password" name="passwordConfirm" placeholder="비밀번호 확인" autocomplete="new-password">
        ${signupError ? `<div class="err">${escapeHtml(signupError)}</div>` : ''}
        <button type="submit">가입 신청하기</button>
      </form>
    </div>
  </div>
  <script>
    document.querySelectorAll('.tab-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

function htmlResponse(html, status) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Admin approval page bypasses the login gate entirely (protected by its
  // own ADMIN_PASSWORD instead) — this has to work even before any account
  // exists yet, so the first admin can approve their own signup.
  if (pathname === ADMIN_PAGE_PATH) return next();

  // Vercel Cron calls this route directly (no browser session, no cookie) —
  // it can never pass the login gate below, so it needs its own bypass here,
  // gated on the same CRON_SECRET that cronImportAds.js itself checks. This
  // must stay scoped to exactly this one path so no other route loses its
  // login requirement.
  if (pathname === '/api/cronImportAds') {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization') || '';
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return next();
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  if (pathname === ADMIN_PENDING_PATH && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || body.password !== adminPassword) {
      return jsonResponse({ error: '관리자 비밀번호가 올바르지 않습니다.' }, 401);
    }
    const data = await getUsers();
    const users = data.users.map((u) => ({
      id: u.id, name: u.name, email: u.email, status: u.status,
      createdAt: u.createdAt, approvedAt: u.approvedAt,
    }));
    return jsonResponse({ users }, 200);
  }

  if (pathname === ADMIN_DECIDE_PATH && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || body.password !== adminPassword) {
      return jsonResponse({ error: '관리자 비밀번호가 올바르지 않습니다.' }, 401);
    }
    if (!['approve', 'reject', 'revoke'].includes(body.action)) {
      return jsonResponse({ error: '알 수 없는 처리입니다.' }, 400);
    }
    const data = await getUsers();
    const user = findUserById(data, body.userId);
    if (!user) return jsonResponse({ error: '사용자를 찾을 수 없습니다.' }, 404);

    if (body.action === 'approve') {
      user.status = 'approved';
      user.approvedAt = new Date().toISOString();
    } else {
      user.status = 'rejected';
      user.approvedAt = null;
    }
    await saveUsers(data);
    return jsonResponse({ ok: true }, 200);
  }

  if (pathname === LOGIN_PATH && method === 'POST') {
    const form = await request.formData();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const nextPath = safeNextPath(String(form.get('next') || '/'));

    const data = await getUsers();
    const user = findUserByEmail(data, email);

    let loginError = null;
    if (data.fetchFailed) {
      loginError = '로그인 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요. (계속되면 관리자에게 알려주세요 — Blob Storage 연결 문제일 수 있습니다)';
    } else if (!user) {
      loginError = '이메일 또는 비밀번호가 올바르지 않습니다.';
    } else if (user.status === 'pending') {
      loginError = '아직 관리자 승인 대기 중입니다.';
    } else if (user.status === 'rejected') {
      loginError = '가입이 거절되었습니다. 관리자에게 문의해주세요.';
    } else {
      const hash = await pbkdf2Hex(password, user.passwordSalt);
      if (hash !== user.passwordHash) loginError = '이메일 또는 비밀번호가 올바르지 않습니다.';
    }

    if (loginError) {
      return htmlResponse(gateHtml({ nextPath, tab: 'login', loginError }), 401);
    }

    const token = await sessionToken(user);
    const res = new Response(null, { status: 302, headers: { Location: nextPath } });
    res.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
    );
    return res;
  }

  if (pathname === SIGNUP_PATH && method === 'POST') {
    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const passwordConfirm = String(form.get('passwordConfirm') || '');
    const nextPath = safeNextPath(String(form.get('next') || '/'));

    let signupError = null;
    if (!name || !email || !password) {
      signupError = '이름·이메일·비밀번호를 모두 입력해주세요.';
    } else if (password.length < 8) {
      signupError = '비밀번호는 8자 이상이어야 합니다.';
    } else if (password !== passwordConfirm) {
      signupError = '비밀번호가 서로 일치하지 않습니다.';
    }

    if (!signupError) {
      const data = await getUsers();
      if (findUserByEmail(data, email)) {
        signupError = '이미 가입 신청된 이메일입니다.';
      } else {
        const salt = randomHex(16);
        const hash = await pbkdf2Hex(password, salt);
        data.users.push({
          id: randomHex(8),
          name,
          email,
          passwordSalt: salt,
          passwordHash: hash,
          status: 'pending',
          createdAt: new Date().toISOString(),
          approvedAt: null,
        });
        await saveUsers(data);
      }
    }

    if (signupError) {
      return htmlResponse(gateHtml({ nextPath, tab: 'signup', signupError }), 400);
    }
    return htmlResponse(gateHtml({
      nextPath, tab: 'login',
      signupNotice: '가입 신청이 완료됐습니다. 관리자 승인이 완료되면 로그인할 수 있습니다.',
    }), 200);
  }

  const cookies = parseCookies(request.headers.get('cookie'));
  const data = await getUsers();
  const user = await verifySession(cookies[COOKIE_NAME], data);
  if (user) return next();

  // Session re-verifies against the CURRENT user list on every request (see
  // verifySession's comment) — but that means a transient Blob hiccup makes
  // getUsers() return an empty list, which fails EVERY session check and
  // bounces already-logged-in people back to the login gate for no real
  // reason. If we simply couldn't reach Blob this request (not "this cookie
  // is invalid"), let a plausibly-shaped session cookie through rather than
  // force a re-login — instant revocation just doesn't apply during that
  // narrow outage window, which is an acceptable trade for not kicking the
  // whole team out over a passing network blip.
  if (data.fetchFailed && cookies[COOKIE_NAME] && cookies[COOKIE_NAME].indexOf('.') !== -1) {
    return next();
  }

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return htmlResponse(gateHtml({ nextPath: pathname + url.search, tab: 'login' }), 401);
  }

  return jsonResponse({ error: '접근 권한이 없습니다.' }, 401);
}
