// Site-wide access gate — every page AND every /api/* call requires a
// shared team password before anything is served. This exists so that
// once a paid model (e.g. OpenAI) is wired in, a leaked/shared URL can't
// let a stranger rack up API costs; the existing per-endpoint Origin
// check only stops other websites' scripts, not a person calling the
// API directly, so this is the layer that actually closes that gap.
//
// One password entry gets you a signed cookie (HttpOnly, 30 days) that
// covers page navigation and the fetch() calls the pages make — no
// second prompt anywhere else.
//
// SITE_ACCESS_PASSWORD is set directly in the Vercel dashboard, same as
// every other secret in this project — never typed or seen here.

import { next } from '@vercel/edge';

const COOKIE_NAME = 'dh_auth';
const LOGIN_PATH = '/_gate/login';

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

function loginPageHtml(nextPath, showError) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>디자인 히어로 | 접근 확인</title>
<style>
  body{margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:oklch(97.5% 0.006 85); font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;}
  .box{background:#fff; border:1px solid oklch(89% 0.015 265); border-radius:20px; padding:40px 36px; width:320px; box-shadow:0 12px 30px oklch(20% 0.02 265 / 0.08); box-sizing:border-box;}
  h1{font-size:18px; margin:0 0 8px; color:oklch(22% 0.02 265);}
  p{font-size:13px; color:oklch(48% 0.02 265); margin:0 0 20px;}
  input{width:100%; padding:12px 14px; border:1px solid oklch(84% 0.015 265); border-radius:10px; font-size:14px; box-sizing:border-box; margin-bottom:12px; font-family:inherit;}
  button{width:100%; padding:12px; border:none; border-radius:10px; background:oklch(35% 0.08 260); color:#fff; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;}
  .err{color:oklch(55% 0.18 25); font-size:12.5px; margin:-4px 0 12px;}
</style>
</head>
<body>
  <div class="box">
    <h1>디자인 히어로</h1>
    <p>팀 공유 비밀번호를 입력해주세요.</p>
    <form method="POST" action="${LOGIN_PATH}">
      <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
      <input type="password" name="password" placeholder="비밀번호" autofocus>
      ${showError ? '<div class="err">비밀번호가 올바르지 않습니다.</div>' : ''}
      <button type="submit">입장</button>
    </form>
  </div>
</body>
</html>`;
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

export default async function middleware(request) {
  const url = new URL(request.url);
  const expected = process.env.SITE_ACCESS_PASSWORD;

  // Not configured yet — fail open (current, already-existing behavior)
  // rather than lock everyone out over a missing/misspelled env var.
  if (!expected) return next();

  if (url.pathname === LOGIN_PATH && request.method === 'POST') {
    const form = await request.formData();
    const password = String(form.get('password') || '');
    const nextPath = safeNextPath(String(form.get('next') || '/'));

    if (password === expected) {
      const token = await sha256Hex(expected + ':dh-gate');
      const res = new Response(null, { status: 302, headers: { Location: nextPath } });
      res.headers.append(
        'Set-Cookie',
        `${COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
      );
      return res;
    }
    return new Response(loginPageHtml(nextPath, true), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const cookies = parseCookies(request.headers.get('cookie'));
  const expectedToken = await sha256Hex(expected + ':dh-gate');
  if (cookies[COOKIE_NAME] === expectedToken) return next();

  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return new Response(loginPageHtml(url.pathname + url.search, false), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  return new Response(JSON.stringify({ error: '접근 권한이 없습니다.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}
