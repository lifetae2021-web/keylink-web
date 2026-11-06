import crypto from 'crypto';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// 키링 월드 배경음악 — plazaBgm/{id} { title, url, path, theme('all'|테마 id), enabled, order, size, createdAt }
// 파일은 Firebase Storage plaza_bgm/ 에 서버가 직접 올린다(다운로드 토큰 URL로 재생 → 저장소 규칙 변경 불필요).
// 웹은 지금 테마에 맞고 켜진(enabled) 곡을 order 순서대로 돌려 튼다(1곡이면 그 곡만 반복).
export const BGM_MAX_BYTES = 4 * 1024 * 1024;   // Vercel 요청 크기 한도(4.5MB) 안쪽
export const BGM_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'keylink-web-2caf2.appspot.com';
const bucket = () => adminStorage.bucket(BUCKET);

export type BgmTrack = { id: string; title: string; url: string; theme: string; enabled: boolean; order: number; size: number; createdAt: number | null };

export async function listBgm(): Promise<BgmTrack[]> {
  const snap = await adminDb.collection('plazaBgm').get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, title: String(x.title || '배경음악'), url: String(x.url || ''), theme: String(x.theme || 'all'), enabled: !!x.enabled,
      order: Number(x.order ?? 0), size: Number(x.size || 0), createdAt: x.createdAt?.toMillis?.() ?? null };
  }).sort((a, b) => a.order - b.order || (a.createdAt || 0) - (b.createdAt || 0));
}

export async function addBgm(buf: Buffer, contentType: string, title: string, theme: string, enabled = true) {
  const ext = contentType.includes('wav') ? 'wav' : contentType.includes('ogg') ? 'ogg' : contentType.includes('mp4') || contentType.includes('m4a') || contentType.includes('aac') ? 'm4a' : 'mp3';
  const path = `plaza_bgm/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const token = crypto.randomUUID();
  await bucket().file(path).save(buf, { contentType, resumable: false, metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  const all = await listBgm();
  const ref = await adminDb.collection('plazaBgm').add({ title: title.slice(0, 40) || '배경음악', url, path, theme, enabled, order: (all.at(-1)?.order ?? 0) + 1, size: buf.length, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function removeBgm(id: string) {
  const ref = adminDb.collection('plazaBgm').doc(id);
  const path = (await ref.get()).get('path');
  if (path) await bucket().file(String(path)).delete().catch(() => {});
  await ref.delete();
}
