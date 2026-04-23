import crypto from 'crypto';

/**
 * Solapi v4 API Utility
 * v8.1.3 (Integrated SMS Support)
 */

interface SendSMSParams {
  to: string;
  text: string;
}

// Solapi용 환경변수로 명칭 변경
const API_KEY = process.env.SOLAPI_API_KEY;
const API_SECRET = process.env.SOLAPI_API_SECRET;
const SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER;

/**
 * Solapi HMAC Signature 생성 (Nurigo v4 규격)
 */
function getHeaders() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', API_SECRET || '');
  const signature = hmac.update(date + salt).digest('hex');

  return {
    'Authorization': `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
    'Content-Type': 'application/json'
  };
}

/**
 * 단일 문자/알림톡 발송
 */
export async function sendSMS({ to, text }: SendSMSParams) {
  // 번호 형식 정리 (하이픈 제거)
  const cleanTo = to.replace(/[^0-9]/g, '');

  if (!API_KEY || !API_SECRET || !SENDER_NUMBER) {
    console.warn('SMS 발송 실패: Solapi API 설정이 누락되었습니다. (Mock 모드 작동)');
    console.log(`[Mock SMS] TO: ${cleanTo}, TEXT: ${text}`);
    return { success: true, mock: true };
  }

  try {
    // 엔드포인트를 api.solapi.com으로 변경
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        message: {
          to: cleanTo,
          from: SENDER_NUMBER,
          text: text
        }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.errorMessage || 'Solapi 발송 중 오류가 발생했습니다.');
    }

    return { success: true, ...result };
  } catch (error) {
    console.error('Solapi Send Error:', error);
    throw error;
  }
}
