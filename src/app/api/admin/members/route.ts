import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

let membersCache: { data: any[]; ts: number } | null = null;
const MEMBERS_TTL = 30 * 1000; // 30초 캐시

export async function GET(_req: NextRequest) {
  try {
    if (membersCache && Date.now() - membersCache.ts < MEMBERS_TTL) {
      return NextResponse.json({ success: true, users: membersCache.data, cached: true });
    }

    const usersSnapshot = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
    const firestoreUsers = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Firebase Auth 조회는 provider/loginMethod 필드가 둘 다 없는 회원에게만 제한적으로 수행하여 속도 최적화
    const missingUids = firestoreUsers.filter((u: any) => !u.provider && !u.loginMethod && !u.authProvider).map((u: any) => ({ uid: u.id }));
    const providerMap: Record<string, string> = {};

    if (missingUids.length > 0) {
      for (let i = 0; i < missingUids.length; i += 100) {
        const batch = missingUids.slice(i, i + 100);
        try {
          const result = await adminAuth.getUsers(batch);
          result.users.forEach((authUser) => {
            const providerId = authUser.providerData?.[0]?.providerId || 'password';
            providerMap[authUser.uid] = providerId;
          });
        } catch {}
      }
    }

    const users = firestoreUsers.map((u: any) => ({
      ...u,
      // Firestore provider 필드 우선, 없으면 Firebase Auth providerData 사용
      authProvider: u.provider || u.loginMethod || u.authProvider || providerMap[u.id] || null,
    }));

    membersCache = { data: users, ts: Date.now() };

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
