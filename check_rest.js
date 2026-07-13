const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, orderBy, limit, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "keylink-web-2caf2",
  // Since we only need firestore and read is public, we don't strictly need apiKey for basic REST/GRPC reads if rules are open,
  // but it's better to provide it if possible. However, the client SDK might complain without an apiKey.
  // We can just use the REST API via fetch.
};

async function checkApps() {
  const url = 'https://firestore.googleapis.com/v1/projects/keylink-web-2caf2/databases/(default)/documents/applications';
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data).substring(0, 500));
  } catch (e) {
    console.error(e);
  }
}

checkApps();
