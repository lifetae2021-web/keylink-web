// Firebase 로그인 토큰(ID 토큰) 검증 — 클라이언트가 "나는 uid ○○야"라고 주장하는 걸 믿지 않고,
// 구글이 서명한 토큰을 구글 공개키로 직접 확인해 진짜 uid를 얻는다.
// 확인 항목: RS256 서명, aud = 프로젝트 ID, iss = securetoken 발급자, 만료(exp)·발급(iat)·로그인(auth_time) 시각, sub(uid)
const PROJECT_ID = 'keylink-web-2caf2';
const ISSUER = 'https://securetoken.google.com/' + PROJECT_ID;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwksCache = { keys: null, until: 0 };

async function getKey(kid) {
  const now = Date.now();
  if (!jwksCache.keys || now > jwksCache.until) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error('jwks_fetch_failed');
    const maxAge = +((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
    jwksCache = { keys: (await res.json()).keys || [], until: now + maxAge * 1000 };
  }
  const jwk = jwksCache.keys.find((k) => k.kid === kid);
  if (!jwk) return null;
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

function b64urlToBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

// 성공하면 uid(문자열), 실패하면 null
export async function verifyFirebaseIdToken(token) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = b64urlJson(parts[0]);
    const payload = b64urlJson(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== PROJECT_ID || payload.iss !== ISSUER) return null;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
    if (!(payload.exp > nowSec) || !(payload.iat <= nowSec + 60) || !(payload.auth_time <= nowSec + 60)) return null;
    const key = await getKey(header.kid);
    if (!key) return null;
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    return ok ? payload.sub : null;
  } catch (e) {
    return null;
  }
}
