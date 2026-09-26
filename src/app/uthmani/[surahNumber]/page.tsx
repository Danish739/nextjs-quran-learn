import type { Metadata } from 'next';
import UthmaniReader from '../components/UthmaniReader';

export const metadata: Metadata = {
  title: 'Uthmanic Hafs | Learn Quran',
  description: 'Verse-by-verse Uthmanic Hafs reading, matching the Quran.com text layout.',
};

export default async function UthmaniPage({
  params,
  searchParams,
}: {
  params: Promise<{ surahNumber: string }>;
  searchParams: Promise<{ startingVerse?: string; readingMode?: string }>;
}) {
  const { surahNumber } = await params;
  const { startingVerse, readingMode } = await searchParams;
  const id = Number(surahNumber);
  const start = startingVerse ? Number(startingVerse) : null;

  if (!Number.isInteger(id) || id < 1 || id > 114) {
    return (
      <main style={{ padding: 40, fontFamily: 'Figtree, sans-serif' }}>
        Surah must be a number from 1 to 114.
      </main>
    );
  }

  return (
    <UthmaniReader
      surahNumber={id}
      startingVerse={start != null && Number.isFinite(start) ? start : null}
      readingMode={readingMode === 'translation' ? 'translation' : 'arabic'}
    />
  );
}
