/**
 * Firebase Auth 에러 코드를 사용자 친화적인 한국어 메시지로 변환합니다.
 * v6.5.0 - Expanded error coverage to reduce "알 수 없는 오류" fallback cases.
 */
export const getAuthErrorMessage = (code: string): string => {
  switch (code) {
    // ── 계정 관련 ──
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '아이디 또는 비밀번호가 일치하지 않습니다.';

    case 'auth/invalid-email':
      return '이메일 주소 형식이 올바르지 않습니다.';

    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다. 다른 이메일이나 소셜 로그인을 이용해 주세요.';

    case 'auth/user-disabled':
      return '이 계정은 비활성화되었습니다. 고객센터로 문의해 주세요.';

    // ── 비밀번호 관련 ──
    case 'auth/weak-password':
      return '비밀번호가 너무 단순합니다. 6자리 이상의 조합을 사용해 주세요.';

    case 'auth/missing-password':
      return '비밀번호를 입력해 주세요.';

    // ── 과도한 요청 ──
    case 'auth/too-many-requests':
      return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';

    // ── 네트워크 / 구성 ──
    case 'auth/network-request-failed':
      return '인터넷 연결이 불안정합니다. 네트워크 상태를 확인해 주세요.';

    case 'auth/operation-not-allowed':
      return '이 로그인 방식이 비활성화되어 있습니다. 관리자에게 문의해 주세요.';

    case 'auth/configuration-not-found':
      return 'Firebase 인증 설정에 문제가 있습니다. 관리자에게 문의해 주세요.';

    // ── 팝업 / 리디렉션 ──
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '로그인 창이 닫혔습니다. 다시 시도해 주세요.';

    case 'auth/popup-blocked':
      return '팝업이 차단되었습니다. 브라우저의 팝업 허용 설정을 확인해 주세요.';

    // ── 세션 / 권한 ──
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인이 필요합니다.';

    case 'auth/unauthorized-domain':
      return '이 도메인에서는 인증이 허용되지 않습니다. 관리자에게 문의해 주세요.';

    case 'auth/internal-error':
      return '인증 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

    default:
      // 코드가 있으면 코드 포함 표시 (개발 디버깅 용이)
      if (code && code !== 'undefined') {
        console.warn('[Auth] Unhandled error code:', code);
        return `로그인 중 오류가 발생했습니다. (${code})`;
      }
      return '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
};
