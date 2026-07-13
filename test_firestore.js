const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Since we don't have the service account easily, we can try to use the emulator if it's running, or we can just read the next.js api!
// Wait, is there a local API endpoint I can hit?
