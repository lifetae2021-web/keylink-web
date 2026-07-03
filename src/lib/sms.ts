import crypto from 'crypto';

/**
 * Solapi v4 API Utility
 * v8.1.7 (Integrated SMS Support)
 */

interface SendSMSParams {
  to: string;
  text: string;
  scheduledDate?: string;
}

// Solapi용 환경변수로 명칭 변경
const API_KEY = process.env.SOLAPI_API_KEY;
const API_SECRET = process.env.SOLAPI_API_SECRET;
// v9.1.3: 발신번호를 010-9130-1577로 완전히 고정하여 배포 환경변수 누락/지연 방지
const SENDER_NUMBER = '01091301577';

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
export async function sendSMS({ to, text, scheduledDate }: SendSMSParams) {
  // 번호 형식 정리 (하이픈 제거)
  const cleanTo = to.replace(/[^0-9]/g, '');

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.warn(`SMS 발송 차단(로컬 환경): Mock 모드 작동 중`);
    console.log(`[Mock SMS] TO: ${cleanTo}, TEXT: ${text}${scheduledDate ? `, SCHEDULED: ${scheduledDate}` : ''}`);
    return { success: true, mock: true };
  }

  if (!API_KEY || !API_SECRET || !SENDER_NUMBER) {
    const missing = [];
    if (!API_KEY) missing.push('SOLAPI_API_KEY');
    if (!API_SECRET) missing.push('SOLAPI_API_SECRET');
    if (!SENDER_NUMBER) missing.push('SOLAPI_SENDER_NUMBER');
    throw new Error(`Solapi API 설정이 누락되었습니다 (${missing.join(', ')}).`);
  }

  try {
    const endpoint = scheduledDate ? 'https://api.solapi.com/messages/v4/send-many' : 'https://api.solapi.com/messages/v4/send';
    const payload = scheduledDate
      ? {
          messages: [{ to: cleanTo, from: SENDER_NUMBER, text: text }],
          scheduledDate
        }
      : {
          message: { to: cleanTo, from: SENDER_NUMBER, text: text }
        };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
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

/**
 * Solapi 잔액 조회
 */
export async function getSolapiBalance() {
  if (!API_KEY || !API_SECRET) {
    throw new Error('Solapi API 설정이 누락되었습니다.');
  }

  try {
    const response = await fetch('https://api.solapi.com/cash/v1/balance', {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store'
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.errorMessage || 'Solapi 잔액 조회 중 오류가 발생했습니다.');
    }

    // 솔라피 API는 부가세(10%) 제외 금액 반환 → 솔라피 사이트 표시값과 일치시키려면 ×10/9 필요
    console.log('[Solapi Balance Raw]', JSON.stringify(result));
    const balanceWithVat = Math.round((result.balance ?? 0) * (10 / 9) * 100) / 100;
    const pointWithVat = Math.round((result.point ?? 0) * (10 / 9) * 100) / 100;
    return { success: true, balance: balanceWithVat, point: pointWithVat, _raw: result };
  } catch (error) {
    console.error('Solapi Balance Error:', error);
    throw error;
  }
}
