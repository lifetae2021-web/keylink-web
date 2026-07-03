import { adminDb } from '@/lib/firebaseAdmin';

/**
 * 특정 사용자가 특정 기수에 참여(선발 또는 확정)하려 할 때,
 * 해당 기수에 이미 확정(confirmed)된 반대 성별 참가자 중 과거에 만났던 이력이 있는지 체크합니다.
 */
export async function checkOverlap(userId: string, sessionId: string, gender: string): Promise<string | null> {
  try {
    // 1. 대상 유저의 과거 확정 기수들 조회
    const targetAppsSnap = await adminDb.collection('applications')
      .where('userId', '==', userId)
      .where('status', '==', 'confirmed')
      .get();
    
    const targetPastSessions = targetAppsSnap.docs
      .map(d => d.data())
      .filter(data => data.sessionId !== sessionId)
      .map(data => data.sessionId);
    
    if (targetPastSessions.length === 0) return null;

    // 2. 현재 기수의 반대 성별 확정(confirmed) 참가자들 조회
    const oppositeGender = gender === 'male' ? 'female' : 'male';
    const currentOppositesSnap = await adminDb.collection('applications')
      .where('sessionId', '==', sessionId)
      .where('gender', '==', oppositeGender)
      .where('status', '==', 'confirmed')
      .get();
    
    const currentOpposites: any[] = currentOppositesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((app: any) => {
        const isDummy = app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || app.isDummy === true;
        return !isDummy && app.isDarkTemplar !== true;
      });

    if (currentOpposites.length === 0) return null;

    // 3. 반대 성별 참가자들의 과거 확정 기수들과 비교
    for (const opp of currentOpposites) {
      const oppAppsSnap = await adminDb.collection('applications')
        .where('userId', '==', opp.userId)
        .where('status', '==', 'confirmed')
        .get();
      
      const oppPastSessions = oppAppsSnap.docs
        .map(d => d.data())
        .filter(data => data.sessionId !== sessionId)
        .map(data => data.sessionId);
      
      const common = targetPastSessions.filter(sid => oppPastSessions.includes(sid));
      if (common.length > 0) {
        // 첫 번째 겹치는 기수 이름 조회
        const sDoc = await adminDb.collection('sessions').doc(common[0]).get();
        let sessionName = '알 수 없는 기수';
        if (sDoc.exists) {
          const data = sDoc.data()!;
          const regionName = data.region === 'busan' ? '부산' : '창원';
          const episode = data.episodeNumber ? `${data.episodeNumber}기` : '';
          sessionName = `${regionName} ${episode}`;
        }
        const oppositeGenderKo = oppositeGender === 'male' ? '남성' : '여성';
        const oppName = opp.name || '참가자';
        const oppSlot = opp.slotNumber ? `${opp.slotNumber}호` : '?호';
        return `이 회원은 이번 기수의 [${oppositeGenderKo} ${oppSlot} ${oppName}]님과 이미 '${sessionName}'에서 만난 적이 있습니다.`;
      }
    }
    return null;
  } catch (error) {
    console.error('checkOverlap helper error:', error);
    return null;
  }
}
