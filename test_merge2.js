const admin = require('firebase-admin');
const fs = require('fs');

const envConfig = fs.readFileSync('.env.local', 'utf8').split('\n');
envConfig.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1];
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value;
  }
});

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function test() {
  const listUsersResult = await admin.auth().listUsers(1000);
  listUsersResult.users.forEach(user => {
    if (user.displayName && user.displayName.includes('수민')) {
      console.log(`Kakao Auth: ${user.uid}, displayName: ${user.displayName}, created: ${user.metadata.creationTime}`);
    }
  });
}
test().catch(console.error);
