import { adminAuth, adminDb } from './src/lib/firebaseAdmin';

async function createTestAdmin() {
  const email = 'test-admin@antigravity.ai';
  const password = 'testpassword123!';
  const name = '테스트관리자';

  try {
    // 1. Create Auth User
    let user;
    try {
      user = await adminAuth.getUserByEmail(email);
      console.log('User already exists, updating role...');
    } catch (e) {
      user = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });
      console.log('User created:', user.uid);
    }

    // 2. Set Admin Role in Firestore
    await adminDb.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      name,
      role: 'admin',
      status: 'verified',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    console.log('Successfully set as admin!');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (error) {
    console.error('Error creating test admin:', error);
  }
}

createTestAdmin();
