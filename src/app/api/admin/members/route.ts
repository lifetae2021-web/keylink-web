import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const usersSnapshot = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
    const firestoreUsers = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Firebase Auth에서 providerData 조회 (100명씩 배치)
    const uids = firestoreUsers.map((u) => ({ uid: u.id }));
    const providerMap: Record<string, string> = {};

    for (let i = 0; i < uids.length; i += 100) {
      const batch = uids.slice(i, i + 100);
      try {
        const result = await adminAuth.getUsers(batch);
        result.users.forEach((authUser) => {
          const providerId = authUser.providerData?.[0]?.providerId || 'password';
          providerMap[authUser.uid] = providerId;
        });
      } catch {}
    }

    const users = firestoreUsers.map((u: any) => ({
      ...u,
      // Firestore provider 필드 우선, 없으면 Firebase Auth providerData 사용
      authProvider: u.provider || providerMap[u.id] || null,
    }));

    return NextResponse.json({ success: true, users });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, role } = await req.json();

    if (!userId || !role) {
      return NextResponse.json({ success: false, error: 'Missing requirements' }, { status: 400 });
    }

    await adminDb.collection('users').doc(userId).update({
      role,
      updatedAt: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
