import { db } from '@/lib/firebase';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  orderBy, query, serverTimestamp, Timestamp, getDoc, setDoc,
} from 'firebase/firestore';

export interface NoticeItem {
  id: string;
  title: string;
  content: string;
  isImportant: boolean;
  date: string;
  createdAt?: Timestamp;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  order: number;
}

// ── 공지사항 ──
export async function getNotices(): Promise<NoticeItem[]> {
  const snap = await getDocs(query(collection(db, 'cms_notices'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NoticeItem));
}

export async function addNotice(data: Omit<NoticeItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'cms_notices'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateNotice(id: string, data: Partial<Omit<NoticeItem, 'id'>>) {
  await updateDoc(doc(db, 'cms_notices', id), data);
}

export async function deleteNotice(id: string) {
  await deleteDoc(doc(db, 'cms_notices', id));
}

// ── FAQ ──
export async function getFaqs(): Promise<FaqItem[]> {
  const snap = await getDocs(query(collection(db, 'cms_faqs'), orderBy('order', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FaqItem));
}

export async function addFaq(data: Omit<FaqItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'cms_faqs'), data);
  return ref.id;
}

export async function updateFaq(id: string, data: Partial<Omit<FaqItem, 'id'>>) {
  await updateDoc(doc(db, 'cms_faqs', id), data);
}

export async function deleteFaq(id: string) {
  await deleteDoc(doc(db, 'cms_faqs', id));
}

// ── 단일 문서 콘텐츠 (이용규정, 이용약관, 개인정보처리방침) ──
export type ContentKey = 'rules' | 'terms' | 'privacy';

export async function getContent(key: ContentKey): Promise<string> {
  const snap = await getDoc(doc(db, 'cms_content', key));
  return snap.exists() ? (snap.data().body as string) : '';
}

export async function saveContent(key: ContentKey, body: string) {
  await setDoc(doc(db, 'cms_content', key), { body, updatedAt: serverTimestamp() }, { merge: true });
}

// ── 후기 ──
export interface ReviewItem {
  id: string;
  couple: string;
  text: string;
  episode: string;
  region: string;
  order: number;
}

export async function getReviews(): Promise<ReviewItem[]> {
  const snap = await getDocs(query(collection(db, 'cms_reviews'), orderBy('order', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ReviewItem));
}

export async function addReview(data: Omit<ReviewItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'cms_reviews'), data);
  return ref.id;
}

export async function updateReview(id: string, data: Partial<Omit<ReviewItem, 'id'>>) {
  await updateDoc(doc(db, 'cms_reviews', id), data);
}

export async function deleteReview(id: string) {
  await deleteDoc(doc(db, 'cms_reviews', id));
}
