import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { adminDb } from '../src/lib/firebaseAdmin';

async function checkYooAccounts() {
  try {
    const usersRef = adminDb.collection('users');
    const snap = await usersRef.where('name', '==', '유관우').get();
    
    console.log(`Found ${snap.docs.length} users named 유관우:`);
    snap.docs.forEach(d => {
      const data = d.data();
      console.log(`\nUID: ${d.id}`);
      console.log(`isRegistered: ${data.isRegistered}`);
      console.log(`loginMethod: ${data.loginMethod}`);
      console.log(`phone: ${data.phone}`);
      console.log(`job: ${data.job || data.workplace || 'None'}`);
      console.log(`photos: ${data.photos ? data.photos.length : 0} photos`);
      console.log(`employmentProof: ${data.employmentProof ? 'Yes' : 'No'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkYooAccounts();
