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
  /** ratings given while the ayah wasn't due: extra practice that doesn't move the schedule */
  extra?: number;
}

export interface HifzSettings {
  /** soft daily goal of brand-new ayahs; 0 turns it off */
  newPerDay: number;
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
  settings?: HifzSettings;
  /** how many new ayahs were started today */
  newToday?: { day: string; count: number };
}

const KEY = 'hifz-v1';
const DAY = 86_400_000;
/** An ayah counts as memorized once its review interval reaches this many days */
export const MEMORIZED_DAYS = 3;
/** Longest gap between reviews. Hifz should be revisited at least twice a year. */
export const MAX_INTERVAL = 180;
export const DEFAULT_SETTINGS: HifzSettings = { newPerDay: 20 };

const today = () => new Date().toDateString();

export function emptyStore(): HifzStore {
  return { cards: {}, streak: { day: '', count: 0 }, seconds: 0, settings: { ...DEFAULT_SETTINGS } };
}

/** Cleans up data saved by older versions: caps runaway intervals and fixes broken numbers. */
function repair(s: HifzStore): { store: HifzStore; changed: boolean } {
  const now = Date.now();
  let changed = false;
  const cards: Record<string, Card> = {};
  for (const [k, c] of Object.entries(s.cards ?? {})) {
    const ok = c && Number.isFinite(c.interval) && Number.isFinite(c.due);
    if (!ok) { changed = true; continue; }
    let { interval, due } = c;
    if (interval > MAX_INTERVAL) {
      interval = MAX_INTERVAL;
      due = Math.min(due, now + MAX_INTERVAL * DAY);
      changed = true;
    }
    if (due > now + MAX_INTERVAL * DAY) { due = now + MAX_INTERVAL * DAY; changed = true; }
    cards[k] = interval === c.interval && due === c.due ? c : { ...c, interval, due };
  }
  return { store: { ...s, cards }, changed };
}

export function loadStore(): HifzStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return emptyStore();
    const merged: HifzStore = { ...emptyStore(), ...raw, settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) } };
    const { store, changed } = repair(merged);
    if (changed) saveStore(store);
    return store;
  } catch {
    return emptyStore();
  }
}

/** Asks the browser not to evict saved progress when storage runs low (matters on phones). */
export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* ignore */ }
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

/** Days until the next review for a given rating (0 = again, comes back in minutes). */
export function nextInterval(prevInterval: number, r: Rating): number {
  const i = prevInterval;
  let interval: number;
  switch (r) {
    case 'again': interval = 0; break;
    case 'hard': interval = Math.max(1, Math.round(i * 1.2)); break;
    case 'good': interval = i < 1 ? 1 : Math.round(i * 2.5); break;
    case 'easy': interval = i < 1 ? 4 : Math.round(i * 3.5); break;
  }
  return Math.min(MAX_INTERVAL, interval);
}

export const isDue = (c?: Card) => !c || c.due <= Date.now();

/** "<10m", "1d", "3w", "2mo": what a button will schedule. */
export function intervalLabel(days: number): string {
  if (days <= 0) return '<10m';
  if (days === 1) return '1d';
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

/** What a rating button will do right now, for its label. */
export function previewRating(c: Card | undefined, r: Rating): { label: string; practice: boolean } {
  if (c && !isDue(c) && r !== 'again') return { label: 'Practice', practice: true };
  return { label: intervalLabel(nextInterval(c?.interval ?? 0, r)), practice: false };
}

export interface RateOutcome {
  store: HifzStore;
  kind: 'scheduled' | 'lapse' | 'practice';
  interval: number;
}

/**
 * Applies a rating.
 * - An ayah that isn't due yet only counts as extra practice (so repeated taps can't inflate the schedule),
 *   except "Again": forgetting is always real information.
 * - Intervals are capped at MAX_INTERVAL.
 */
export function rateWithOutcome(s: HifzStore, verseKey: string, r: Rating): RateOutcome {
  const now = Date.now();
  const prev = s.cards[verseKey];

  if (prev && !isDue(prev) && r !== 'again') {
    const card: Card = { ...prev, last: now, extra: (prev.extra ?? 0) + 1 };
    return { store: touchStreak({ ...s, cards: { ...s.cards, [verseKey]: card } }), kind: 'practice', interval: prev.interval };
  }

  const interval = nextInterval(prev?.interval ?? 0, r);
  const card: Card = {
    interval,
    // "again" comes back in 10 minutes
    due: interval === 0 ? now + 10 * 60_000 : now + interval * DAY,
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (r === 'again' ? 1 : 0),
    last: now,
    extra: prev?.extra,
  };
  let next: HifzStore = { ...s, cards: { ...s.cards, [verseKey]: card } };
  if (!prev) {
    const t = today();
    const count = (s.newToday?.day === t ? s.newToday.count : 0) + 1;
    next = { ...next, newToday: { day: t, count } };
  }
  return { store: touchStreak(next), kind: r === 'again' ? 'lapse' : 'scheduled', interval };
}

/** Applies a rating and returns the updated store. */
export function rate(s: HifzStore, verseKey: string, r: Rating): HifzStore {
  return rateWithOutcome(s, verseKey, r).store;
}

/** Forgets an ayah's schedule so it can be learned from scratch. */
export function resetCard(s: HifzStore, verseKey: string): HifzStore {
  if (!s.cards[verseKey]) return s;
  const cards = { ...s.cards };
  delete cards[verseKey];
  return { ...s, cards };
}

export function newTodayCount(s: HifzStore): number {
  return s.newToday?.day === today() ? s.newToday.count : 0;
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
