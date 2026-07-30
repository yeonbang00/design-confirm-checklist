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
  } catch (e) {
    // Not created yet, or Blob unreachable — treat as no users.
  }
  return { users: [] };
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
<style>
  body{margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:oklch(97.5% 0.006 85); font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;}
  .box{background:#fff; border:1px solid oklch(89% 0.015 265); border-radius:20px; padding:36px 32px; width:340px; box-shadow:0 12px 30px oklch(20% 0.02 265 / 0.08); box-sizing:border-box;}
  h1{font-size:18px; margin:0 0 20px; color:oklch(22% 0.02 265);}
  .tabs{display:flex; border:1px solid oklch(84% 0.015 265); border-radius:10px; overflow:hidden; margin-bottom:20px;}
  .tab-btn{flex:1; padding:10px; border:none; background:oklch(97% 0.005 85); color:oklch(45% 0.02 265); font-size:13.5px; font-weight:600; cursor:pointer; font-family:inherit;}
  .tab-btn.active{background:#fff; color:oklch(22% 0.02 265);}
  .panel{display:none;}
  .panel.active{display:block;}
  p.hint{font-size:12.5px; color:oklch(48% 0.02 265); margin:0 0 16px;}
  input{width:100%; padding:12px 14px; border:1px solid oklch(84% 0.015 265); border-radius:10px; font-size:14px; box-sizing:border-box; margin-bottom:10px; font-family:inherit;}
  button[type="submit"]{width:100%; padding:12px; border:none; border-radius:10px; background:oklch(35% 0.08 260); color:#fff; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; margin-top:4px;}
  .err{color:oklch(55% 0.18 25); font-size:12.5px; margin:0 0 12px;}
  .notice{color:oklch(40% 0.1 150); font-size:12.5px; margin:0 0 16px; background:oklch(96% 0.03 150); border-radius:8px; padding:10px 12px;}
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
    if (!user) {
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

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return htmlResponse(gateHtml({ nextPath: pathname + url.search, tab: 'login' }), 401);
  }

  return jsonResponse({ error: '접근 권한이 없습니다.' }, 401);
}
