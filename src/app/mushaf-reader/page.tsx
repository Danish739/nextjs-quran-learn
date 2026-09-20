import type { Metadata } from 'next';
import MushafReader from './components/MushafReader';

export const metadata: Metadata = {
  title: 'Mushaf Reader — Surah Al-Fatihah | Learn Quran',
  description:
    'Read Surah Al-Fatihah in Uthmani, IndoPak, or Tajweed script with adjustable lines and font size.',
};

const FONT_CDN = 'https://verses.quran.foundation/fonts/quran';

export default function MushafReaderPage() {
  return (
    <>
      {/* Preload critical Unicode fonts (Foundation guide best practice) */}
      <link
        rel="preload"
        href={`${FONT_CDN}/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2`}
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href={`${FONT_CDN}/hafs/nastaleeq/indopak/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2`}
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <MushafReader />
    </>
  );
}
