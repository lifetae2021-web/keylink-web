import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * v6.5.3 - Secure Login Helper API
 * Maps 'username' to 'email' using Firebase Admin SDK to bypass client-side Firestore security rules.
 * This prevents the 'permission-denied' error for unauthenticated users.
 */
export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: '아이디를 입력해 주세요.' }, { status: 400 });
    }

    // 1. Query Firestore for the user by username using Admin SDK (bypasses security rules)
    const usersSnapshot = await adminDb.collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 404 });
    }

    const userData = usersSnapshot.docs[0].data();
    
    // 2. Return ONLY the email to the client for the actual authentication
    // No passwords are handled here—Firebase Auth handles the secure part.
    return NextResponse.json({ email: userData.email });

  } catch (error: any) {
    console.error('Login Helper API Error:', error);
    // DEBUG: Send exact error to client to bypass Vercel logs
    return NextResponse.json({ error: `[서버오류 상세] ${error.message}` }, { status: 500 });
  }
}
