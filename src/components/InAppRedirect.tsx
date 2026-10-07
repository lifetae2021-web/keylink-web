'use client';

import { useEffect } from 'react';
import { detectInAppBrowser, openInExternalBrowser } from '@/lib/inAppBrowser';

// 카카오톡 인앱 브라우저로 접속하면 외부 브라우저(Safari/Chrome)로 자동 전환 (세션당 1회 시도)
export default function InAppRedirect() {
  useEffect(() => {
    const info = detectInAppBrowser();
    if (info?.kind !== 'kakaotalk') return;
    try {
      if (sessionStorage.getItem('kl_inapp_redirected')) return;
      sessionStorage.setItem('kl_inapp_redirected', '1');
    } catch {}
    openInExternalBrowser(info);
  }, []);
  return null;
}
