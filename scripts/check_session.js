const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    let value = rest.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key.trim()] = value;
  }
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('users')
    .where('role', 'in', ['admin', 'super_admin'])
    .get();
  console.log(`Found ${snapshot.size} admins.`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Name: ${data.name} | Role: ${data.role} | Email: ${data.email}`);
  });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
