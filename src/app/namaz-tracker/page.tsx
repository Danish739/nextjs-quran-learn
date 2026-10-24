import type { Metadata } from 'next';
import { Amiri, Manrope } from 'next/font/google';
import NamazTracker from '@/components/NamazTracker';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--nt-font' });
const amiri = Amiri({ subsets: ['arabic'], weight: ['400', '700'], variable: '--nt-font-ar' });

export const metadata: Metadata = {
  title: 'Namaz Tracker',
  description: 'Track your five daily prayers, view your month, and keep count of qaza.',
};

export default function NamazTrackerPage() {
  return (
    <div className={`${manrope.variable} ${amiri.variable}`}>
      <NamazTracker />
    </div>
  );
}
