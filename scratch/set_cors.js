const admin = require('firebase-admin');

// Use the downloaded admin sdk json directly
const serviceAccount = require('/Users/lifetae2021/Downloads/keylink-web-2caf2-firebase-adminsdk-fbsvc-3ff3b9b157.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'keylink-web-2caf2.firebasestorage.app'
});

async function setCors() {
  const bucket = admin.storage().bucket();
  const corsConfiguration = [
    {
      origin: ['*'],
      method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
      responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
      maxAgeSeconds: 3600,
    },
  ];

  try {
    await bucket.setCorsConfiguration(corsConfiguration);
    console.log('Successfully set CORS configuration for bucket: ' + bucket.name);
  } catch (err) {
    console.error('Failed to set CORS:', err);
  }
}

setCors();
