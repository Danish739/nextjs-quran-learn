export type ScriptStyle = 'uthmani' | 'indopak' | 'tajweed';

export interface MushafAyah {
  number: number;
  key: string;
  uthmani: string;
  indopak: string;
  tajweedHtml: string;
  translation?: string;
  /** Absolute ruku index in the Quran */
  rukuNumber: number;
  juzNumber: number;
  /** Last ayah of this ruku — show IndoPak ع markers */
  isRukuEnd: boolean;
  /** Ruku ordinal within the current juz (number above ع in margin) */
  rukuInJuz: number;
  /** Ayah count in this ruku (number below ع in margin) */
  rukuAyahCount: number;
}

export interface MushafMeta {
  number: number;
  nameArabic: string;
  nameSimple: string;
  nameTranslation: string;
  revelationPlace: string;
  versesCount: number;
}

export interface MushafSurahResponse {
  meta: MushafMeta;
  ayahs: MushafAyah[];
  fonts?: { uthmani: string; indopak: string };
}

export function getAyahText(ayah: MushafAyah, script: ScriptStyle): string {
  if (script === 'indopak') return ayah.indopak;
  if (script === 'tajweed') return ayah.tajweedHtml;
  return ayah.uthmani;
}

export async function fetchMushafSurah(chapterId: number): Promise<MushafSurahResponse> {
  const res = await fetch(`/api/mushaf-reader/${chapterId}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Failed to load surah ${chapterId}`);
  }
  return res.json() as Promise<MushafSurahResponse>;
}
