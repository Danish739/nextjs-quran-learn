// Hifz progress: a small spaced-repetition store kept in localStorage.
// Every ayah you rate becomes a "card" with an interval (days) and a due date.

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface Card {
  /** days until the next review */
  interval: number;
  /** epoch ms when the ayah is due again */
  due: number;
  reps: number;
  lapses: number;
  last: number;
}

export interface LastSession {
  chapter: number;
  name: string;
  from: number;
  to: number;
  at: number;
}

export interface HifzStore {
  cards: Record<string, Card>;
  last?: LastSession;
  streak: { day: string; count: number };
  /** total seconds spent in sessions */
  seconds: number;
}

const KEY = 'hifz-v1';
const DAY = 86_400_000;
/** An ayah counts as memorized once its review interval reaches this many days */
export const MEMORIZED_DAYS = 3;

const today = () => new Date().toDateString();

export function emptyStore(): HifzStore {
  return { cards: {}, streak: { day: '', count: 0 }, seconds: 0 };
}

export function loadStore(): HifzStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s ? { ...emptyStore(), ...s } : emptyStore();
  } catch {
    return emptyStore();
  }
}

export function saveStore(s: HifzStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / blocked */
  }
}

/** Counts today as a practice day, continuing or restarting the streak. */
export function touchStreak(s: HifzStore): HifzStore {
  const t = today();
  if (s.streak.day === t) return s;
  const yesterday = new Date(Date.now() - DAY).toDateString();
  const count = s.streak.day === yesterday ? s.streak.count + 1 : 1;
  return { ...s, streak: { day: t, count } };
}

/** Current streak, or 0 if the last practice day was before yesterday. */
export function liveStreak(s: HifzStore): number {
  const yesterday = new Date(Date.now() - DAY).toDateString();
  return s.streak.day === today() || s.streak.day === yesterday ? s.streak.count : 0;
}

/** Applies a rating and returns the updated store. */
export function rate(s: HifzStore, verseKey: string, r: Rating): HifzStore {
  const now = Date.now();
  const prev = s.cards[verseKey];
  const i = prev?.interval ?? 0;
  let interval: number;
  switch (r) {
    case 'again': interval = 0; break;
    case 'hard': interval = Math.max(1, Math.round(i * 1.2)); break;
    case 'good': interval = i < 1 ? 1 : Math.round(i * 2.5); break;
    case 'easy': interval = i < 1 ? 4 : Math.round(i * 3.5); break;
  }
  const card: Card = {
    interval,
    // "again" comes back in 10 minutes
    due: interval === 0 ? now + 10 * 60_000 : now + interval * DAY,
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (r === 'again' ? 1 : 0),
    last: now,
  };
  return touchStreak({ ...s, cards: { ...s.cards, [verseKey]: card } });
}

export const isMemorized = (c?: Card) => !!c && c.interval >= MEMORIZED_DAYS;

export function dueKeys(s: HifzStore): string[] {
  const now = Date.now();
  return Object.entries(s.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k);
}

export function memorizedCount(s: HifzStore, chapter?: number): number {
  return Object.entries(s.cards).filter(
    ([k, c]) => isMemorized(c) && (chapter == null || k.startsWith(`${chapter}:`))
  ).length;
}

export function startedCount(s: HifzStore, chapter: number): number {
  return Object.keys(s.cards).filter(k => k.startsWith(`${chapter}:`)).length;
}

/** "in 10 min", "tomorrow", "in 3 days" */
export function dueLabel(c: Card): string {
  const ms = c.due - Date.now();
  if (ms <= 0) return 'due now';
  if (ms < 3_600_000) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  const days = Math.round(ms / DAY);
  if (days <= 1) return 'tomorrow';
  return `in ${days} days`;
}

// ── Quran data (cached per chapter) ──────────────────────────
const API = 'https://api.quran.com/api/v4';

export interface HifzWord {
  id: number;
  position: number;
  text: string;
  glyph?: string;
  page: number;
  end: boolean;
  meaning: string;
}

export interface HifzVerse {
  key: string;
  number: number;
  page: number;
  text: string;
  translation: string;
  words: HifzWord[];
}

const chapterCache = new Map<number, Promise<HifzVerse[]>>();

export function fetchChapterVerses(chapter: number): Promise<HifzVerse[]> {
  let p = chapterCache.get(chapter);
  if (!p) {
    const url =
      `${API}/verses/by_chapter/${chapter}?language=en&words=true&translations=20` +
      `&fields=text_uthmani&word_fields=text_uthmani,code_v2,page_number,char_type_name,translation` +
      `&translation_fields=text&per_page=300`;
    p = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Could not load ayahs');
        return r.json();
      })
      .then(d =>
        (d.verses || []).map((v: any) => ({
          key: v.verse_key,
          number: v.verse_number,
          page: v.page_number || v.words?.[0]?.page_number || 1,
          text: v.text_uthmani || '',
          translation: (v.translations?.[0]?.text || '').replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, ''),
          words: (v.words || []).map((w: any) => ({
            id: w.id,
            position: w.position,
            text: w.text_uthmani || '',
            glyph: w.code_v2,
            page: w.page_number || v.page_number || 1,
            end: w.char_type_name === 'end',
            meaning: w.translation?.text || '',
          })),
        }))
      );
    p.catch(() => chapterCache.delete(chapter));
    chapterCache.set(chapter, p);
  }
  return p;
}
