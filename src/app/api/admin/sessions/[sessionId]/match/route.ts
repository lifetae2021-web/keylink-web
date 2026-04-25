import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { MatchPair, Vote, VoteChoice } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * [Admin] Weighted Matching Algorithm API
 * v5.6.0 - Server-side execution for security and high satisfaction matching
 */

const WEIGHTS = {
  1: 10, // Equal weight
  2: 10,
  3: 10
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    // 1. Authorization check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check for admin role in Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // 2. Fetch all participants and votes
    const [appsSnap, votesSnap] = await Promise.all([
      adminDb.collection('applications')
        .where('sessionId', '==', sessionId)
        .where('status', '==', 'confirmed')
        .get(),
      adminDb.collection('votes')
        .where('sessionId', '==', sessionId)
        .get()
    ]);

    const participants: { id: string; gender: string }[] = appsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: doc.data().userId, gender: doc.data().gender }));
    const votes: Vote[] = votesSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as Vote);

    if (participants.length === 0 || votes.length === 0) {
      return NextResponse.json({ error: 'No data to match' }, { status: 400 });
    }

    // 3. Build Weight Map
    const weightMap: Record<string, Record<string, number>> = {};
    const voteCountMap: Record<string, number> = {};

    votes.forEach((v: Vote) => {
      weightMap[v.userId] = {};
      v.choices.forEach((c: any) => {
        const p = c.priority || c.rank;
        weightMap[v.userId][c.targetUserId] = WEIGHTS[p as keyof typeof WEIGHTS] || 0;
        voteCountMap[c.targetUserId] = (voteCountMap[c.targetUserId] || 0) + 1;
      });
    });

    // 4. Mutual Selection Matching (Double Opt-in)
    const maleUids = participants.filter((p: { id: string; gender: string }) => p.gender === 'male').map((p: { id: string; gender: string }) => p.id);
    const femaleUids = participants.filter((p: { id: string; gender: string }) => p.gender === 'female').map((p: { id: string; gender: string }) => p.id);

    const matchedPairs: MatchPair[] = [];
    const userPartners: Record<string, string[]> = {};

    // Initialize partner arrays
    participants.forEach(p => { userPartners[p.id] = []; });

    maleUids.forEach((m: string) => {
      femaleUids.forEach((f: string) => {
        const scoreM = weightMap[m]?.[f] || 0;
        const scoreF = weightMap[f]?.[m] || 0;
        
        // ONLY match if BOTH picked each other
        if (scoreM > 0 && scoreF > 0) {
          matchedPairs.push({ userAId: m, userBId: f });
          userPartners[m].push(f);
          userPartners[f].push(m);
        }
      });
    });

    // 5. Delete votes from non-confirmed participants
    const confirmedUserIds = new Set(participants.map(p => p.id));
    const orphanVoteDocs = votesSnap.docs.filter(d => {
      const userId = d.data().userId as string;
      return userId && !userId.startsWith('system_') && !confirmedUserIds.has(userId);
    });
    if (orphanVoteDocs.length > 0) {
      const deleteBatch = adminDb.batch();
      orphanVoteDocs.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
    }

    // 6. Delete stale matchingResults from previous runs
    const oldResultsSnap = await adminDb.collection('matchingResults')
      .where('sessionId', '==', sessionId)
      .get();
    if (!oldResultsSnap.empty) {
      const cleanBatch = adminDb.batch();
      oldResultsSnap.docs.forEach(d => cleanBatch.delete(d.ref));
      await cleanBatch.commit();
    }

    // 7. Save summary document for admin drawer (single source of truth)
    const unmatchedUserIds = participants.filter(p => userPartners[p.id].length === 0).map(p => p.id);
    await adminDb.collection('matchingSummaries').doc(sessionId).set({
      sessionId,
      matchedPairs,
      unmatchedUserIds,
      voteCountMap,
      status: 'pending',
      approvedAt: null,
      calculatedAt: Timestamp.now(),
    });

    // 8. Delete stale per-participant matchingResults (legacy)
    const oldPerParticipantSnap = await adminDb.collection('matchingResults')
      .where('sessionId', '==', sessionId)
      .get();
    if (!oldPerParticipantSnap.empty) {
      const cleanBatch = adminDb.batch();
      oldPerParticipantSnap.docs.forEach(d => cleanBatch.delete(d.ref));
      await cleanBatch.commit();
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalParticipants: participants.length,
        matchedCount: participants.filter(p => userPartners[p.id].length > 0).length,
        coupleCount: matchedPairs.length,
        unmatchedCount: participants.filter(p => userPartners[p.id].length === 0).length
      },
      result: {
        matchedPairs,
        unmatchedUserIds: participants.filter(p => userPartners[p.id].length === 0).map(p => p.id),
        voteCountMap,
      }
    });

  } catch (error: any) {
    console.error('Matching Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
