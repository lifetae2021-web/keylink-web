const crypto = require('crypto');

const API_KEY = process.env.SOLAPI_API_KEY;
const API_SECRET = process.env.SOLAPI_API_SECRET;

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

async function test() {
  console.log("Key:", API_KEY ? "EXISTS" : "MISSING");
  console.log("Secret:", API_SECRET ? "EXISTS" : "MISSING");
  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        message: {
          to: '01012345678', // test number
          from: '01091301577',
          text: 'test message'
        }
      })
    });
    const result = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
