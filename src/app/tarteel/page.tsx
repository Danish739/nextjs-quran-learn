import type { Metadata } from 'next';
import TarteelHome from './TarteelHome';

export const metadata: Metadata = {
  title: 'Tarteel — Memorize Confidently',
  description: 'A homepage inspired by Tarteel: Quran memorization, mistake detection, and goals.',
};

export default function TarteelPage() {
  return <TarteelHome />;
}
