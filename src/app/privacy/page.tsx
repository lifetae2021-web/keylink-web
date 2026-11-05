import type { Metadata } from 'next';
import PolicyPage from '@/components/PolicyPage';

export const metadata: Metadata = { title: '개인정보처리방침 | 키링크' };

export default function PrivacyPage() {
  return <PolicyPage policy="privacy" />;
}
