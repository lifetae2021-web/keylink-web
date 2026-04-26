import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ error: 'uid가 필요합니다.' }, { status: 400 });

    // 1. Storage 프로필 이미지 삭제
    try {
      const bucket = adminStorage.bucket();
      const [files] = await bucket.getFiles({ prefix: `profile_images/${uid}/` });
      await Promise.all(files.map(f => f.delete()));
    } catch {
      // 파일 없으면 스킵
    }

    // 2. Firestore applications 삭제
    const appsSnap = await adminDb.collection('applications').where('userId', '==', uid).get();
    if (!appsSnap.empty) {
      const batch = adminDb.batch();
      appsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 3. Firestore users 문서 삭제
    await adminDb.collection('users').doc(uid).delete();

    // 4. Firebase Auth 계정 삭제
    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // Auth 계정 없으면 스킵
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete User]', error.message);
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
