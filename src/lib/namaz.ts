/** Prayer log model shared by the Namaz Tracker and its insights panel */

export const PRAYERS = [
  { key: 'fajr', label: 'Fajr', ar: 'الفجر' },
  { key: 'dhuhr', label: 'Dhuhr', ar: 'الظهر' },
  { key: 'asr', label: 'Asr', ar: 'العصر' },
  { key: 'maghrib', label: 'Maghrib', ar: 'المغرب' },
  { key: 'isha', label: 'Isha', ar: 'العشاء' },
] as const;

export type PrayerKey = (typeof PRAYERS)[number]['key'];
/** J = in jamaat · O = on time · L = late · Q = missed, made up later · M = missed, qaza owed */
export type Code = 'J' | 'O' | 'L' | 'Q' | 'M';
export type DayLog = Partial<Record<PrayerKey, Code>>;
export type Log = Record<string, DayLog>;

export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const pad = (n: number) => String(n).padStart(2, '0');
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => new Date(k + 'T00:00:00');
export const onDay = (c?: Code) => c === 'J' || c === 'O' || c === 'L';
export const prayed = (c?: Code) => !!c && c !== 'M';
