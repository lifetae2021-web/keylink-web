const crypto = require('crypto');
function getHeaders() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', 'dummy');
  const signature = hmac.update(date + salt).digest('hex');
  return {
    'Authorization': `HMAC-SHA256 apiKey=dummy, date=${date}, salt=${salt}, signature=${signature}`,
    'Content-Type': 'application/json'
  };
}
console.log(JSON.stringify({ scheduledDate: new Date().toISOString() }));
