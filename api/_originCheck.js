// Blocks requests that didn't come from a browser tab actually loading this
// site — i.e. someone hitting the API URL directly (curl, a script, a leaked
// link opened by an automated tool). Compares the Origin/Referer header's
// host against the request's own Host header, so it self-adapts if the
// site's domain ever changes (no domain hardcoded here).
//
// This is NOT per-user authentication — anyone who opens the actual site in
// a real browser still passes, since their browser sends a matching Origin.
// It only stops non-browser/cross-site traffic (accidental scraping, a
// leaked API URL being hit directly, etc).
export function isSameOrigin(req) {
  const host = req.headers.host;
  if (!host) return false;

  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch (e) {
      return false;
    }
  }

  const referer = req.headers.referer;
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch (e) {
      return false;
    }
  }

  return false;
}

export function rejectIfNotSameOrigin(req, res) {
  if (isSameOrigin(req)) return false;
  res.status(403).json({ error: '허용되지 않은 요청입니다. 사이트를 통해 다시 시도해주세요.' });
  return true;
}
