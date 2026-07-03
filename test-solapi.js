const crypto = require('crypto');
function getHeaders() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', '12345678901234567890123456789012'); // 32 chars
  const signature = hmac.update(date + salt).digest('hex');
  return {
    'Authorization': `HMAC-SHA256 apiKey=1234567890123456, date=${date}, salt=${salt}, signature=${signature}`,
    'Content-Type': 'application/json'
  };
}
const body = JSON.stringify({
  message: {
    to: '01012345678',
    from: '01012345678',
    text: 'test'
  },
  scheduledDate: "bad format"
});
fetch('https://api.solapi.com/messages/v4/send', {
  method: 'POST',
  headers: getHeaders(),
  body
}).then(res => res.json()).then(console.log).catch(console.error);
