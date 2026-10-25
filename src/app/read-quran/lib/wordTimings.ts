/**
 * Word-level recitation timings from Quran.com (QDC audio API): one audio file per surah plus,
 * for every ayah, its start/end and each word's start/end in milliseconds. Used to highlight
 * the word being recited.
 */

const QDC = 'https://api.qurancdn.com/api/qdc/audio/reciters';

/** Reader's reciter id → QDC reciter with word timings. Reciters missing here have none. */
const TIMED_RECITERS: Record<number, number> = {
  7: 7, // Mishari al-Afasy
  2: 3, // Abdul Rahman Al-Sudais
  1: 2, // Abdul Basit (murattal)
  6: 6, // Mahmoud Khalil Al-Husary
  4: 4, // Abu Bakr al-Shatri
};

export const hasWordTimings = (reciterId: number) => reciterId in TIMED_RECITERS;

/** [word position (1-based), start ms, end ms] */
type Segment = [number, number, number];

export interface VerseTiming {
  from: number;
  to: number;
  words: Segment[];
}

export interface ChapterTimings {
  audioUrl: string;
  /** keyed by verse number */
  verses: Map<number, VerseTiming>;
  order: number[];
}

const cache = new Map<string, Promise<ChapterTimings | null>>();

export function loadChapterTimings(reciterId: number, chapter: number): Promise<ChapterTimings | null> {
  const qdc = TIMED_RECITERS[reciterId];
  if (!qdc) return Promise.resolve(null);
  const key = `${qdc}:${chapter}`;
  if (!cache.has(key)) {
    const p = fetch(`${QDC}/${qdc}/audio_files?chapter=${chapter}&segments=true`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(json => {
        const file = json?.audio_files?.[0];
        if (!file?.audio_url || !Array.isArray(file.verse_timings)) return null;
        const verses = new Map<number, VerseTiming>();
        for (const v of file.verse_timings) {
          const n = Number(String(v.verse_key).split(':')[1]);
          // the feed has a few malformed entries such as [1]; keep only complete [pos, start, end]
          const words = (v.segments || [])
            .filter((s: unknown[]) => Array.isArray(s) && s.length === 3 && s.every(x => typeof x === 'number'))
            .sort((a: Segment, b: Segment) => a[1] - b[1]) as Segment[];
          verses.set(n, { from: v.timestamp_from, to: v.timestamp_to, words });
        }
        return { audioUrl: file.audio_url as string, verses, order: [...verses.keys()].sort((a, b) => a - b) };
      })
      .catch(() => {
        cache.delete(key); // let a later attempt retry
        return null;
      });
    cache.set(key, p);
  }
  return cache.get(key)!;
}

/**
 * Which ayah and word are being recited at `ms`. Between two words (a breath) the last word
 * that started stays lit, so the highlight doesn't flicker off and on.
 */
export function locate(t: ChapterTimings, ms: number): { verse: number; word: number | null } | null {
  let verse: number | null = null;
  for (const n of t.order) {
    const v = t.verses.get(n)!;
    if (ms >= v.from && ms < v.to) { verse = n; break; }
  }
  if (verse === null) return null;
  let word: number | null = null;
  for (const [pos, start] of t.verses.get(verse)!.words) {
    if (start <= ms) word = pos;
    else break;
  }
  return { verse, word };
}
