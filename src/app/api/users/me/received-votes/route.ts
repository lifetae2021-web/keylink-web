import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // 관리자 권한으로 투표 데이터 우회 조회
    const votesSnap = await adminDb.collection('votes')
      .where('sessionId', '==', sessionId)
      .get();

    const receivedVotes = votesSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((vote: any) => vote.choices && vote.choices.some((c: any) => c.targetUserId === userId));

    return NextResponse.json({ success: true, receivedVotes });
  } catch (error: any) {
    console.error('Received Votes API Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
