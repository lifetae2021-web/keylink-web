// 되돌릴 수 없는 짧은 해시(16자리). uid·기기표식·IP 원문을 저장하지 않고 사람을 구분하는 데 쓴다.
// 회원 uid 해시는 Next 서버(src/lib/plazaKey.ts)와 같은 방식('kl-plaza:' + uid)이어야 한다.
export async function shortHash(prefix, value) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prefix + value));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
