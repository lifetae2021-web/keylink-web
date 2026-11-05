import type { Metadata } from 'next';
import PolicyPage from '@/components/PolicyPage';

export const metadata: Metadata = { title: '이용약관 | 키링크' };

export default function TermsPage() {
  return <PolicyPage policy="terms" />;
}
