// 인스타/페이스북/네이버 등 인앱 브라우저 감지 (카카오 로그인이 앱 전환 중 끊기는 문제 대응)
const IN_APP_PATTERN = /Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|DaumApps|Line\/|Snapchat|TikTok|musical_ly/i;

export function detectInAppBrowser(): { isAndroid: boolean } | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  return IN_APP_PATTERN.test(ua) ? { isAndroid: /Android/i.test(ua) } : null;
}
