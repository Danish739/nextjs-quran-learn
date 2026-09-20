import { NextResponse } from 'next/server';

/**
 * Mushaf reader — data from Quran.com Content API (same source as
 * https://quran.com/al-fatihah?startingVerse=2)
 *
 * Primary:
 *   GET /verses/by_chapter/{id}?words=true&fields=text_uthmani,text_indopak,text_qpc_hafs,...
 * Tajweed colors:
 *   GET /quran/verses/uthmani_tajweed?chapter_number={id}
 */
const QURAN_API = 'https://api.quran.com/api/v4';

export const dynamic = 'force-dynamic';

interface ChapterPayload {
  id: number;
  name_arabic: string;
  name_simple: string;
  revelation_place: string;
  verses_count: number;
  translated_name?: { name: string };
}

interface WordPayload {
  char_type_name?: string;
  text_uthmani?: string;
  text_indopak?: string;
  text_qpc_hafs?: string;
}

interface VersePayload {
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  text_indopak?: string;
  text_qpc_hafs?: string;
  ruku_number?: number;
  juz_number?: number;
  words?: WordPayload[];
  translations?: { text: string }[];
}

interface VerseTajweed {
  verse_key: string;
  text_uthmani_tajweed: string;
}

/**
 * GET /api/mushaf-reader/1
 * Proxies Quran.com API for Surah Al-Fatihah.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ chapter: string }> }
) {
  const { chapter: chapterParam } = await context.params;
  const chapterId = Number(chapterParam);

  if (!Number.isInteger(chapterId) || chapterId !== 1) {
    return NextResponse.json(
      { error: 'Only Surah Al-Fatihah (chapter 1) is available in this reader for now.' },
      { status: 400 }
    );
  }

  try {
    const versesUrl =
      `${QURAN_API}/verses/by_chapter/${chapterId}` +
      `?language=en&words=true&translations=131` +
      `&fields=text_uthmani,text_indopak,text_qpc_hafs,ruku_number,juz_number` +
      `&word_fields=text_uthmani,text_indopak,text_qpc_hafs,char_type_name` +
      `&per_page=50`;

    const [chapterRes, versesRes, tajweedRes] = await Promise.all([
      fetch(`${QURAN_API}/chapters/${chapterId}?language=en`, {
        next: { revalidate: 86400 },
      }),
      fetch(versesUrl, { next: { revalidate: 86400 } }),
      fetch(`${QURAN_API}/quran/verses/uthmani_tajweed?chapter_number=${chapterId}`, {
        next: { revalidate: 86400 },
      }),
    ]);

    if (!chapterRes.ok || !versesRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Quran data from api.quran.com.' },
        { status: 502 }
      );
    }

    const chapterJson = (await chapterRes.json()) as { chapter: ChapterPayload };
    const versesJson = (await versesRes.json()) as { verses: VersePayload[] };

    const tajweedByKey = new Map<string, string>();
    if (tajweedRes.ok) {
      const tajweedJson = (await tajweedRes.json()) as { verses: VerseTajweed[] };
      for (const v of tajweedJson.verses) {
        tajweedByKey.set(v.verse_key, v.text_uthmani_tajweed);
      }
    }

    const chapter = chapterJson.chapter;
    const rawVerses = versesJson.verses;

    const rukuCounts = new Map<number, number>();
    const juzRukuOrder: number[] = [];
    for (const v of rawVerses) {
      const ruku = v.ruku_number ?? 1;
      rukuCounts.set(ruku, (rukuCounts.get(ruku) ?? 0) + 1);
      if (!juzRukuOrder.includes(ruku)) juzRukuOrder.push(ruku);
    }

    const ayahs = rawVerses.map((v, index) => {
      const ruku = v.ruku_number ?? 1;
      const nextRuku = rawVerses[index + 1]?.ruku_number;
      const isRukuEnd = nextRuku === undefined || nextRuku !== ruku;
      const rukuInJuz = juzRukuOrder.indexOf(ruku) + 1;

      // Prefer word-level join (same as quran.com rendering), fall back to verse fields
      const uthmaniRaw =
        joinWords(v.words, 'qpc') ||
        v.text_qpc_hafs ||
        joinWords(v.words, 'uthmani') ||
        v.text_uthmani;

      const indopakRaw =
        joinWords(v.words, 'indopak') || v.text_indopak || v.text_uthmani;

      return {
        number: v.verse_number,
        key: v.verse_key,
        uthmani: cleanQuranText(uthmaniRaw),
        indopak: cleanIndopakText(indopakRaw),
        tajweedHtml: stripEndMarker(
          tajweedByKey.get(v.verse_key) || v.text_uthmani
        ),
        translation: v.translations?.[0]?.text ?? '',
        rukuNumber: ruku,
        juzNumber: v.juz_number ?? 1,
        isRukuEnd,
        rukuInJuz,
        rukuAyahCount: rukuCounts.get(ruku) ?? 1,
      };
    });

    return NextResponse.json({
      meta: {
        number: chapter.id,
        nameArabic: chapter.name_arabic,
        nameSimple: chapter.name_simple,
        nameTranslation: chapter.translated_name?.name ?? chapter.name_simple,
        revelationPlace: chapter.revelation_place,
        versesCount: chapter.verses_count,
      },
      source: {
        api: 'https://api.quran.com/api/v4',
        verses: versesUrl,
        page: `https://quran.com/al-fatihah?startingVerse=1`,
      },
      fonts: {
        uthmani:
          'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2',
        indopak:
          'https://verses.quran.foundation/fonts/quran/hafs/nastaleeq/indopak/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2',
      },
      ayahs,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unexpected error while loading mushaf data.' },
      { status: 500 }
    );
  }
}

/** Join word glyphs; skip verse-end markers (we render our own number). */
function joinWords(
  words: WordPayload[] | undefined,
  field: 'uthmani' | 'indopak' | 'qpc'
): string {
  if (!words?.length) return '';
  return words
    .filter((w) => w.char_type_name !== 'end')
    .map((w) => {
      if (field === 'qpc') return w.text_qpc_hafs || w.text_uthmani || '';
      if (field === 'indopak') return w.text_indopak || w.text_uthmani || '';
      return w.text_uthmani || '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

function stripEndMarker(html: string): string {
  return html.replace(/\s*<span class=["']?end["']?>.*?<\/span>\s*$/i, '').trim();
}

function cleanIndopakText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\uE022/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\u06E1/g, '\u0652')
    .replace(/\uE021\u06D9/g, '\uE021')
    .replace(/\u06D9\uE021/g, '\uE021')
    .replace(/\s*\uE021\s*/g, ' \uE021 ')
    .replace(/[\u0610-\u061A\u06D6-\u06ED]+\s*$/g, '')
    .replace(/[\uFBB2-\uFBC2]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanQuranText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s*[\u06DD۞۝]?[\s\uFD3E\uFD3F]*[٠-٩0-9]*\s*$/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
