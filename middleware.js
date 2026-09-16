// Site-wide access gate — every page AND every /api/* call requires an
// individually-approved account before anything is served. Replaces the
// old single shared-password gate: now each person signs up with their
// own email/password, an admin approves the request from /admin.html,
// and only then can that account log in.
//
// Signup, login and admin decisions use virtual /_gate/* paths in
// Node.js Routing Middleware. PBKDF2 stays on Web Crypto to preserve
// existing password hashes while the private Blob SDK uses Node.js.
//
// Account records use a dedicated private Blob store. Configure
// AUTH_BLOB_READ_WRITE_TOKEN and a random 32-byte hex AUTH_SESSION_SECRET
// in the deployment secret store. Public media storage is unchanged.

import { next } from '@vercel/edge';
import {getUsers,saveUsers} from './api/_privateUsers.js';
import {sessionToken,verifySession,draftToken,verifyDraftToken,checkSessionConfig,SESSION_TTL} from './api/_authSession.js';

const COOKIE_NAME = 'adcheck_session_v2';
const LOGIN_PATH = '/_gate/login';
const SIGNUP_PATH = '/_gate/signup';
const ADMIN_PENDING_PATH = '/_gate/admin/pending';
const ADMIN_DECIDE_PATH = '/_gate/admin/decide';
const ADMIN_PAGE_PATH = '/admin.html';
const GRAB_SCRIPT_PATH = '/assets/adcheck-grab.js';
// 광고 라이브러리에서 부르는 북마클릿. 북마크바에 올린 스크립트라
// 로그인 쿠키 없이 불러와진다. 상품 북마클릿과 같은 이유이고,
// 두 파일 모두 비밀을 담지 않는다.
const ADS_SCRIPT_PATH = '/assets/adcheck-ads.js';
// 아직 팀에 열지 않은 페이지. 로그인한 사람이어도 관리자 비밀번호를 한 번 더
// 받아야 열린다. 화면에서 링크만 감추는 것은 막는 게 아니다. 주소를 치면 열리고
// HTML만 봐도 어디 있는지 드러난다. 그래서 서버에서 막는다.
const DRAFT_PATHS = new Set([
  '/device-preview.html', '/device-preview',
  '/banner-studio.html', '/banner-studio',
]);
// 이미 열어 둔 스튜디오에서도 관리자 확인 없이 생성을 계속할 수 없게 한다.
const DRAFT_APIS = new Set([
  '/api/productScrape', '/api/productPhotos', '/api/imageText',
  '/api/bannerCopy', '/api/bannerImage',
]);
function draftPath(pathname) {
  try { return decodeURIComponent(pathname).replace(/\/+$/, '') || '/'; }
  catch { return pathname; }
}
function isDraftApi(pathname) {
  return DRAFT_APIS.has(draftPath(pathname).replace(/\.js$/, ''));
}
function isDraftPath(pathname) {
  return DRAFT_PATHS.has(draftPath(pathname)) || isDraftApi(pathname);
}
function draftDeniedResponse(pathname, nextPath) {
  if (isDraftApi(pathname)) {
    return jsonResponse({ error: '업데이트중인 기능입니다. 배너 생성 페이지에서 관리자 비밀번호를 입력해주세요.', code: 'DRAFT_ACCESS_REQUIRED' }, 403);
  }
  return htmlResponse(draftHtml({ nextPath }), 401);
}
const DRAFT_COOKIE = 'adcheck_draft_v2';
const DRAFT_UNLOCK_PATH = '/_gate/draft';
const PBKDF2_ITERATIONS = 210000;

export const config = {
  runtime: 'nodejs', // Private Blob SDK uses Node.js dependencies.
  matcher: '/(.*)',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeNextPath(raw) {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') && !/[\\\x00-\x20\x7f]/.test(raw)) return raw;
  return '/';
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

function findUserByEmail(data, email) {
  const normalized = String(email || '').trim().toLowerCase();
  return data.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

function findUserById(data, id) {
  return data.users.find((u) => u.id === id) || null;
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

async function draftAllowed(cookies) {
  return verifyDraftToken(cookies[DRAFT_COOKIE]);
}

function draftHtml({ nextPath, error }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AdCheck | 업데이트중</title>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
<style>
  :root{--bg:#0B0C0E;--surface:#14171C;--surface-2:#0F1216;--line:rgba(255,255,255,.11);
    --ink:#EDEEF0;--ink-3:#7E838C;--ink-4:#6B707A;--accent:#CCFF00;--accent-ink:#0B0C0E;--reject:#C2687A;}
  *{box-sizing:border-box;}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);
    color:var(--ink);font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;-webkit-font-smoothing:antialiased;}
  .box{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:36px 32px;width:340px;
    box-shadow:0 24px 60px -20px rgba(0,0,0,.7);}
  h1{font-size:19px;font-weight:700;margin:0 0 8px;letter-spacing:-.02em;}
  p.hint{font-size:12.5px;color:var(--ink-3);margin:0 0 18px;line-height:1.7;}
  input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px;
    margin-bottom:10px;font-family:inherit;background:var(--surface-2);color:var(--ink);}
  input::placeholder{color:var(--ink-4);}
  input:focus{outline:2px solid var(--accent);outline-offset:1px;}
  button{width:100%;padding:12px;border:none;border-radius:10px;background:var(--accent);color:var(--accent-ink);
    font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:4px;}
  button:hover{opacity:.9;}
  .err{color:var(--reject);font-size:12.5px;margin:0 0 12px;line-height:1.6;}
  a.back{display:block;margin-top:16px;font-size:12.5px;color:var(--ink-4);text-decoration:none;text-align:center;}
  a.back:hover{color:var(--ink);}
</style>
</head>
<body>
  <div class="box">
    <h1>업데이트중</h1>
    <p class="hint">아직 팀에 열지 않은 페이지입니다.<br>관리자 비밀번호를 입력하면 볼 수 있습니다.</p>
    <form method="POST" action="${DRAFT_UNLOCK_PATH}">
      <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
      <input type="password" name="password" placeholder="관리자 비밀번호" autocomplete="current-password" autofocus>
      ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
      <button type="submit">열기</button>
    </form>
    <a class="back" href="/">돌아가기</a>
  </div>
</body>
</html>`;
}

function htmlResponse(html, status) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Temporary full-site closure requested for the service-home rebuild.
// Reopen by setting this flag to false and deploying; credentials are unchanged.
const SITE_MAINTENANCE = true;
function siteMaintenanceResponse(request) {
  const headers = {'Cache-Control':'no-store','Retry-After':'3600','X-Robots-Tag':'noindex'};
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/api/') || pathname.startsWith('/_gate/')) {
    headers['Content-Type']='application/json; charset=utf-8';
    return new Response(JSON.stringify({error:'서비스 개편 작업 중입니다. 작업이 끝나면 다시 안내드리겠습니다.',code:'SITE_MAINTENANCE'}),{status:503,headers});
  }
  headers['Content-Type']='text/html; charset=utf-8';
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AdCheck · 서비스 점검</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#0b0c0e;color:#f4f5f6;font-family:system-ui,sans-serif;padding:32px}main{max-width:620px}small{color:#c3ff4d;font-weight:700;letter-spacing:.12em}h1{font-size:clamp(30px,5vw,48px);line-height:1.3;letter-spacing:-.04em;margin:24px 0}p{font-size:17px;line-height:1.8;color:#aeb2ba}footer{margin-top:48px;color:#777f88;font-size:13px}</style><main><small>ADCHECK · MAINTENANCE</small><h1>더 나은 작업 공간을<br>준비하고 있습니다.</h1><p>서비스 개편 작업으로 이용을 잠시 중단했습니다.<br>작업이 끝나면 다시 안내드리겠습니다.</p><footer>NHN AD 디자인팀</footer></main></html>`,{status:503,headers});
}

async function handleRequest(request) {
  if (SITE_MAINTENANCE) return siteMaintenanceResponse(request);
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Admin approval page bypasses the login gate entirely (protected by its
  // own ADMIN_PASSWORD instead) — this has to work even before any account
  // exists yet, so the first admin can approve their own signup.
  if (pathname === ADMIN_PAGE_PATH) return next();

  // 상품 담기 북마클릿은 쇼핑몰 페이지에서 이 스크립트를 불러다 실행한다.
  // 로그인 세션이 없는 상태로 오므로 이 파일만 열어둔다. 비밀값이 없고
  // 하는 일은 사용자가 보고 있는 페이지의 공개 정보를 읽는 것뿐이다.
  // (열어두지 않으면 북마클릿을 고칠 때마다 팀원 전원이 다시 설치해야 한다)
  if (pathname === GRAB_SCRIPT_PATH || pathname === ADS_SCRIPT_PATH) return next();

  if (process.env.AUTH_MAINTENANCE === '1') throw Error('AUTH_MAINTENANCE');
  checkSessionConfig();
  if (method === 'POST' && pathname.startsWith('/_gate/') && request.headers.get('origin') !== url.origin) return jsonResponse({error:'요청 출처를 확인할 수 없습니다.'},403);

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

    user.sessionVersion=randomHex(16); // invalidate sessions even after later re-approval
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

  if (pathname === DRAFT_UNLOCK_PATH && method === 'POST') {
    const form = await request.formData();
    const password = String(form.get('password') || '');
    const nextPath = safeNextPath(String(form.get('next') || '/'));
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return htmlResponse(draftHtml({ nextPath, error: '서버에 ADMIN_PASSWORD가 설정되어 있지 않습니다.' }), 500);
    }
    if (password !== adminPassword) {
      return htmlResponse(draftHtml({ nextPath, error: '관리자 비밀번호가 올바르지 않습니다.' }), 401);
    }
    const res = new Response(null, { status: 302, headers: { Location: nextPath } });
    res.headers.append(
      'Set-Cookie',
      `${DRAFT_COOKIE}=${await draftToken()}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax`
    );
    return res;
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
    } else if (user.status !== 'approved') {
      loginError = '접근 권한이 없습니다.';
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
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax`
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
  if (user) {
    if (isDraftPath(pathname) && !(await draftAllowed(cookies))) {
      return draftDeniedResponse(pathname, pathname + url.search);
    }
    return next();
  }

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return htmlResponse(gateHtml({ nextPath: pathname + url.search, tab: 'login' }), 401);
  }

  return jsonResponse({ error: '접근 권한이 없습니다.' }, 401);
}

// A storage/configuration outage denies access. Never guess that a cookie is valid.
export default async function middleware(request) {
  try {
    const response=await handleRequest(request);
    response.headers.set('Cache-Control','no-store');
    return response;
  } catch {
    return new Response('로그인 서비스를 점검 중입니다. 잠시 후 다시 시도해주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'60'}});
  }
}
