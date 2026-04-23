import crypto from 'crypto';

/**
 * CoolSMS v4 API Utility
 * v7.6.0
 */

interface SendSMSParams {
  to: string;
  text: string;
}

const API_KEY = process.env.COOLSMS_API_KEY;
const API_SECRET = process.env.COOLSMS_API_SECRET;
const SENDER_NUMBER = process.env.COOLSMS_SENDER_NUMBER;

/**
 * CoolSMS HMAC Signature 생성
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
 * 단일 문자 발송
 */
export async function sendSMS({ to, text }: SendSMSParams) {
  // 번호 형식 정리 (하이픈 제거)
  const cleanTo = to.replace(/[^0-9]/g, '');

  if (!API_KEY || !API_SECRET || !SENDER_NUMBER) {
    console.warn('SMS 발송 실패: API 설정이 누락되었습니다. (Mock 모드 작동)');
    console.log(`[Mock SMS] TO: ${cleanTo}, TEXT: ${text}`);
    return { success: true, mock: true };
  }

  try {
    const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
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
      throw new Error(result.errorMessage || 'SMS 발송 중 오류가 발생했습니다.');
    }

    return { success: true, ...result };
  } catch (error) {
    console.error('CoolSMS Send Error:', error);
    throw error;
  }
}
