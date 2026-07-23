import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local manually
config({ path: resolve(process.cwd(), '.env.local') });

import { adminDb } from '../src/lib/firebaseAdmin';

async function fixPrices() {
  try {
    const sessionRef = adminDb.doc('sessions/6COS9J7XNcARDn2Z0TJq');
    await sessionRef.update({ malePrice: 49000 });
    console.log('✅ Session 133 malePrice updated to 49000');

    const appsSnap = await adminDb.collection('applications')
      .where('name', '==', '김태욱')
      .where('sessionId', '==', '6COS9J7XNcARDn2Z0TJq')
      .get();
      
    if (appsSnap.empty) {
      console.log('❌ No applications found for 김태욱 in Session 133');
    } else {
      for (const d of appsSnap.docs) {
        await d.ref.update({ price: 49000 });
        console.log(`✅ Application ${d.id} (김태욱) price updated to 49000`);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPrices();
