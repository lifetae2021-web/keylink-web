// 인스타/카카오톡/페이스북 인앱 브라우저 감지 및 외부 브라우저 열기
// (카카오 로그인이 앱 전환 중 끊기는 문제 대응). 오탐을 피하려고 확실한 식별자만 사용한다.
export type InAppInfo = { kind: 'kakaotalk' | 'instagram' | 'facebook'; isAndroid: boolean };

export function detectInAppBrowser(): InAppInfo | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  if (/KAKAOTALK/i.test(ua)) return { kind: 'kakaotalk', isAndroid };
  if (/Instagram/i.test(ua)) return { kind: 'instagram', isAndroid };
  if (/FBAN|FBAV/i.test(ua)) return { kind: 'facebook', isAndroid };
  return null;
}

// 앱 안에서 외부 브라우저를 코드로 열 수 있는 환경인지 (카카오톡 전체, 안드로이드)
export function canAutoOpenExternal(info: InAppInfo): boolean {
  return info.kind === 'kakaotalk' || info.isAndroid;
}

export function openInExternalBrowser(info: InAppInfo): void {
  const url = window.location.href;
  if (info.kind === 'kakaotalk') {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return;
  }
  if (info.isAndroid) {
    const scheme = url.startsWith('https') ? 'https' : 'http';
    window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=${scheme};package=com.android.chrome;end`;
  }
}
