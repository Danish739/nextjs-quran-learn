// Draws Quranic duas with the same Mushaf (QCF v2) glyph fonts as /read-quran.
// A dua is often only part of an ayah, so we locate the dua's words inside the
// referenced ayah(s) and return just those glyphs.

import { qcfPageFontReady } from '@/app/read-quran/lib/qcf';

export interface GlyphWord {
  glyph: string;
  page: number;
  end: boolean;
}

const API = 'https://api.quran.com/api/v4';
const verseCache = new Map<string, Promise<{ text: string; glyph: string; page: number; end: boolean }[]>>();
const duaCache = new Map<string, Promise<GlyphWord[] | null>>();

/** "Surah Al-Baqarah 2:201" or "Surah Al-Falaq 113:1-3" → ["2:201"] / ["113:1","113:2","113:3"] */
export function verseKeysFromReference(ref?: string): string[] {
  const m = ref?.match(/(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/);
  if (!m) return [];
  const s = Number(m[1]);
  const a = Number(m[2]);
  const b = m[3] ? Number(m[3]) : a;
  if (s < 1 || s > 114 || b < a || b - a > 10) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => `${s}:${a + i}`);
}

/** Loose Arabic form for comparing different orthographies (Uthmani vs simple). */
function norm(w: string): string {
  return w
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '') // harakat, Quranic marks, tatweel
    .replace(/[ٱأإآا]/g, '') // alef forms vary a lot between scripts — drop them
    .replace(/[ءؤئ]/g, '')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^ء-ي]/g, '');
}

function similar(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  // Levenshtein ratio
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

function fetchVerse(key: string) {
  let p = verseCache.get(key);
  if (!p) {
    p = fetch(`${API}/verses/by_key/${key}?words=true&word_fields=text_uthmani,code_v2,page_number,char_type_name`)
      .then(r => {
        if (!r.ok) throw new Error('verse');
        return r.json();
      })
      .then(d =>
        (d.verse?.words || []).map((w: any) => ({
          text: w.text_uthmani || '',
          glyph: w.code_v2 || '',
          page: w.page_number || d.verse.page_number || 1,
          end: w.char_type_name === 'end',
        }))
      );
    p.catch(() => verseCache.delete(key));
    verseCache.set(key, p);
  }
  return p;
}

/**
 * Returns the Mushaf glyphs for a Quranic dua, or null when the text can't be
 * matched confidently (the caller then falls back to the Uthmani font).
 */
export function quranGlyphsForDua(arabic: string, reference?: string): Promise<GlyphWord[] | null> {
  const keys = verseKeysFromReference(reference);
  if (!keys.length || typeof window === 'undefined') return Promise.resolve(null);
  const cacheKey = `${reference}|${arabic}`;
  let p = duaCache.get(cacheKey);
  if (!p) {
    p = Promise.all(keys.map(fetchVerse))
      .then(async verses => {
        const words = verses.flat();
        const body = words.filter(w => !w.end);
        const target = arabic.split(/\s+/).map(norm).filter(Boolean);
        if (!target.length || !body.length) return null;

        // best contiguous window (allowing a couple of words of length difference)
        let best = { score: 0, start: 0, len: 0 };
        for (let len = Math.max(1, target.length - 2); len <= target.length + 2; len++) {
          for (let start = 0; start + len <= body.length; start++) {
            let total = 0;
            const n = Math.max(len, target.length);
            for (let i = 0; i < Math.min(len, target.length); i++) total += similar(norm(body[start + i].text), target[i]);
            const score = total / n;
            if (score > best.score) best = { score, start, len };
          }
        }
        if (best.score < 0.62) return null;

        // map the matched body words back to the full list so ayah-end markers inside the range are kept
        const startWord = body[best.start];
        const endWord = body[best.start + best.len - 1];
        const from = words.indexOf(startWord);
        let to = words.indexOf(endWord);
        if (words[to + 1]?.end) to += 1; // include the closing ayah marker
        const slice = words.slice(from, to + 1).map(w => ({ glyph: w.glyph, page: w.page, end: w.end }));
        if (slice.some(w => !w.glyph)) return null;

        await Promise.all([...new Set(slice.map(w => w.page))].map(qcfPageFontReady));
        return slice;
      })
      .catch(() => null);
    duaCache.set(cacheKey, p);
  }
  return p;
}
