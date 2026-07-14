import ClientPage from './ClientPage';
import { adminDb } from '@/lib/firebaseAdmin';

// SSR caching configuration: 60 seconds (ISR)
export const revalidate = 60;

export default async function ApplyFastPage() {
  let initialSessions: any[] = [];
  try {
    const snap = await adminDb.collection('sessions').where('status', '==', 'open').get();
    const now = new Date().getTime();
    
    initialSessions = snap.docs
      .map(d => {
        const data = d.data();
        let eventDateStr = new Date().toISOString();
        if (data.eventDate) {
          const dateObj = data.eventDate.toDate ? data.eventDate.toDate() : new Date(data.eventDate);
          eventDateStr = dateObj.toISOString();
        }
        return {
          id: d.id,
          title: data.title || '',
          isTest: data.isTest || false,
          eventDateStr,
          location: data.location || '',
          ageRange: data.ageRange || '',
          maxParticipants: data.maxParticipants,
          price: data.price,
          targetMaleAge: data.targetMaleAge || '',
        };
      })
      .filter(s => {
        const isEnded = now >= new Date(s.eventDateStr).getTime() + 24 * 60 * 60 * 1000;
        return !isEnded;
      })
      .sort((a, b) => new Date(a.eventDateStr).getTime() - new Date(b.eventDateStr).getTime());
  } catch (error) {
    console.error('Error fetching initial sessions for SSR:', error);
  }

  return <ClientPage initialSessions={initialSessions} />;
}
