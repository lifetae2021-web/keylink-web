import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { MatchPair, Vote, VoteChoice } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * [Admin] Weighted Matching Algorithm API
 * v5.6.0 - Server-side execution for security and high satisfaction matching
 */

const WEIGHTS = {
  1: 10, // 1st choice
  2: 5,  // 2nd choice
  3: 2   // 3rd choice
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
    // We only match 'confirmed' status users (those who paid and are coming)
    const [appsSnap, votesSnap] = await Promise.all([
      adminDb.collection('applications')
        .where('sessionId', '==', sessionId)
        .where('status', '==', 'confirmed')
        .get(),
      adminDb.collection('votes')
        .where('sessionId', '==', sessionId)
        .get()
    ]);

    const participants = appsSnap.docs.map(doc => ({ id: doc.data().userId, gender: doc.data().gender }));
    const votes = votesSnap.docs.map(doc => doc.data() as Vote);

    if (participants.length === 0 || votes.length === 0) {
      return NextResponse.json({ error: 'No data to match' }, { status: 400 });
    }

    // 3. Build Weight Map (UserId -> TargetId -> Weight)
    const weightMap: Record<string, Record<string, number>> = {};
    const voteCountMap: Record<string, number> = {};

    votes.forEach(v => {
      weightMap[v.userId] = {};
      v.choices.forEach((c: VoteChoice) => {
        weightMap[v.userId][c.targetUserId] = WEIGHTS[c.priority as keyof typeof WEIGHTS] || 0;
        voteCountMap[c.targetUserId] = (voteCountMap[c.targetUserId] || 0) + 1;
      });
    });

    // 4. Calculate Scores for every possible M-F pair
    // Pair score = Weight(A->B) + Weight(B->A)
    const maleUids = participants.filter(p => p.gender === 'male').map(p => p.id);
    const femaleUids = participants.filter(p => p.gender === 'female').map(p => p.id);

    type ScoringPair = { m: string; f: string; score: number };
    const candidates: ScoringPair[] = [];

    maleUids.forEach(m => {
      femaleUids.forEach(f => {
        const scoreM = weightMap[m]?.[f] || 0;
        const scoreF = weightMap[f]?.[m] || 0;
        
        // Only consider matches where there is at least one-way choice (optional, but optimizes)
        if (scoreM > 0 || scoreF > 0) {
          candidates.push({ m, f, score: scoreM + scoreF });
        }
      });
    });

    // Sort by descending score (stable sorting to maintain priority)
    candidates.sort((a, b) => b.score - a.score);

    // 5. Greedy Selection
    const matchedUids = new Set<string>();
    const matchedPairs: MatchPair[] = [];

    candidates.forEach(cand => {
      if (!matchedUids.has(cand.m) && !matchedUids.has(cand.f)) {
        // Double check for mutual block if needed (e.g. avoidAcquaintance logic could go here)
        matchedPairs.push({ userAId: cand.m, userBId: cand.f });
        matchedUids.add(cand.m);
        matchedUids.add(cand.f);
      }
    });

    const unmatchedUserIds = participants
      .map(p => p.id)
      .filter(uid => !matchedUids.has(uid));

    // 6. Persistence to Firestore (MatchingResults)
    const batch = adminDb.batch();
    
    // Clear old results for this session if any (Optional but safer)
    // Actually, we'll just overwrite
    
    // Matched
    matchedPairs.forEach(pair => {
      const idA = `${sessionId}_${pair.userAId}`;
      const idB = `${sessionId}_${pair.userBId}`;
      
      batch.set(adminDb.collection('matchingResults').doc(idA), {
        sessionId,
        userId: pair.userAId,
        matched: true,
        partnerId: pair.userBId,
        receivedVotes: voteCountMap[pair.userAId] || 0,
        status: 'pending',
        approvedAt: null,
        updatedAt: Timestamp.now()
      });
      
      batch.set(adminDb.collection('matchingResults').doc(idB), {
        sessionId,
        userId: pair.userBId,
        matched: true,
        partnerId: pair.userAId,
        receivedVotes: voteCountMap[pair.userBId] || 0,
        status: 'pending',
        approvedAt: null,
        updatedAt: Timestamp.now()
      });
    });

    // Unmatched
    unmatchedUserIds.forEach(uid => {
      const id = `${sessionId}_${uid}`;
      batch.set(adminDb.collection('matchingResults').doc(id), {
        sessionId,
        userId: uid,
        matched: false,
        partnerId: null,
        receivedVotes: voteCountMap[uid] || 0,
        status: 'pending',
        approvedAt: null,
        updatedAt: Timestamp.now()
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      stats: {
        totalParticipants: participants.length,
        matchedCount: matchedPairs.length * 2,
        coupleCount: matchedPairs.length,
        unmatchedCount: unmatchedUserIds.length
      },
      result: {
        matchedPairs,
        unmatchedUserIds,
        voteCountMap,
      }
    });

  } catch (error: any) {
    console.error('Matching Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
