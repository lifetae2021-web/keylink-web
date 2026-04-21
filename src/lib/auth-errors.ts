/**
 * Firebase Auth 에러 코드를 사용자 친화적인 한국어 메시지로 변환합니다.
 */
export const getAuthErrorMessage = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':
      return "이미 가입된 이메일이에요! 기존 계정으로 로그인하거나 다른 이메일을 입력해 주세요. 😊";
    
    case 'auth/invalid-email':
      return "이메일 형식이 올바르지 않아요. 다시 한번 확인해 주시겠어요?";
    
    case 'auth/operation-not-allowed':
      return "현재 서비스 설정 변경 중입니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요!";
    
    case 'auth/weak-password':
      return "비밀번호가 너무 쉬워요. 6자리 이상의 안전한 비밀번호를 설정해 주세요.";
    
    case 'auth/network-request-failed':
      return "인터넷 연결이 불안정합니다. 네트워크 상태를 확인해 주세요.";
    
    case 'auth/requires-recent-login':
      return "보안을 위해 다시 로그인 후 시도해 주세요.";

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "이메일 또는 비밀번호가 일치하지 않습니다.";

    default:
      return "알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주시면 감사하겠습니다!";
  }
};
