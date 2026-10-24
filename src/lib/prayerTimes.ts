/**
 * Prayer times + next-prayer reminders, shared by the Namaz Tracker card and the
 * site-wide reminder scheduler. Location is cached under the same key the home
 * page's prayer strip uses, so both stay in sync.
 */

export const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = (typeof PRAYER_KEYS)[number];
export type DayTimes = Record<PrayerName, string>; // "HH:MM", 24h
export interface PrayerDay { date: string; times: DayTimes } // date = YYYY-MM-DD
export interface PrayerLocation { lat: number; lng: number; name: string; source: 'gps' | 'ip' | 'default' }
export interface ReminderSettings { enabled: boolean; /** minutes before the prayer */ lead: number }

export const PRAYER_AR: Record<PrayerName, string> = {
  Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء',
};

const LOCATION_KEY = 'prayerLocation';
const TIMES_KEY = 'prayerTimesCache';
const REMINDER_KEY = 'namaz-reminders';
export const REMINDERS_EVENT = 'namaz-reminders-change';
const SW_URL = '/namaz-sw.js';
const SW_SCOPE = '/namaz-tracker';

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(id);
  }
}

function readJson<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null') as T | null; } catch { return null; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ---------- location ----------

export function getCachedLocation(): PrayerLocation | null {
  const loc = readJson<PrayerLocation>(LOCATION_KEY);
  return loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' ? loc : null;
}

/** Approximate location from IP — needs no permission */
export async function locateByIp(): Promise<PrayerLocation> {
  try {
    const ip = await fetchJson<{ latitude?: string; longitude?: string; city?: string; country?: string }>('https://get.geojs.io/v1/ip/geo.json');
    const lat = parseFloat(ip.latitude ?? ''), lng = parseFloat(ip.longitude ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('no coords');
    const loc: PrayerLocation = { lat, lng, name: [ip.city, ip.country].filter(Boolean).join(', ') || 'Your location', source: 'ip' };
    writeJson(LOCATION_KEY, loc);
    return loc;
  } catch {
    return { lat: 21.4225, lng: 39.8262, name: 'Makkah, Saudi Arabia', source: 'default' };
  }
}

/** Precise location from the device — the browser asks the user the first time */
export function locateByGps(): Promise<PrayerLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device'));
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let name = 'Your location';
        try {
          const geo = await fetchJson<{ address?: Record<string, string | undefined> }>(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`
          );
          const a = geo.address ?? {};
          const city = a.city || a.town || a.village || a.county || a.state || '';
          name = city ? `${city}, ${a.country ?? ''}`.replace(/, $/, '') : a.country || name;
        } catch {}
        const loc: PrayerLocation = { lat, lng, name, source: 'gps' };
        writeJson(LOCATION_KEY, loc);
        resolve(loc);
      },
      err => reject(new Error(err.code === err.PERMISSION_DENIED
        ? 'Location is blocked. Allow it from the lock icon in the address bar.'
        : 'Could not detect your location. Please try again.')),
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

// ---------- times ----------

interface TimesCache { lat: number; lng: number; days: PrayerDay[] }
const sameSpot = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lng - b.lng) < 0.01;

/** Today's and tomorrow's times (tomorrow covers the countdown to Fajr after Isha) */
export async function getPrayerDays(loc: PrayerLocation): Promise<PrayerDay[]> {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const wanted = [now, tomorrow];
  const cache = readJson<TimesCache>(TIMES_KEY);
  const known = cache && sameSpot(cache, loc) ? cache.days : [];

  const days = await Promise.all(wanted.map(async d => {
    const key = dayKey(d);
    const hit = known.find(x => x.date === key);
    if (hit) return hit;
    // No `method` → Aladhan picks the calculation method used in that region
    const json = await fetchJson<{ data: { timings: Record<string, string> } }>(
      `https://api.aladhan.com/v1/timings/${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}?latitude=${loc.lat}&longitude=${loc.lng}`
    );
    const times = {} as DayTimes;
    PRAYER_KEYS.forEach(p => { times[p] = json.data.timings[p].split(' ')[0]; }); // drop " (PKT)"
    return { date: key, times };
  }));

  writeJson(TIMES_KEY, { lat: loc.lat, lng: loc.lng, days });
  return days;
}

export function prayerDate(day: PrayerDay, p: PrayerName) {
  const [y, m, d] = day.date.split('-').map(Number);
  const [h, min] = day.times[p].split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function upcomingPrayers(days: PrayerDay[], now = new Date()) {
  return days.flatMap(day => PRAYER_KEYS.map(name => ({ name, at: prayerDate(day, name) })))
    .filter(x => x.at > now)
    .sort((a, b) => +a.at - +b.at);
}

export const to12h = (d: Date) => d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });

// ---------- reminder settings ----------

export function getReminderSettings(): ReminderSettings {
  return { enabled: false, lead: 10, ...readJson<ReminderSettings>(REMINDER_KEY) };
}
export function saveReminderSettings(s: ReminderSettings) {
  writeJson(REMINDER_KEY, s);
  window.dispatchEvent(new Event(REMINDERS_EVENT));
}

// ---------- notifications ----------

export type NotifySupport = 'ok' | 'unsupported' | 'ios-install';

export function notifySupport(): NotifySupport {
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  // iPhone only allows web notifications for sites added to the Home Screen
  if (ios && !standalone) return 'ios-install';
  return 'Notification' in window && 'serviceWorker' in navigator ? 'ok' : 'unsupported';
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SW_SCOPE))
    ?? navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

/** Android Chrome only shows notifications through a service worker */
export async function showNotification(title: string, body: string, tag: string) {
  const options: NotificationOptions = { body, tag, icon: '/logo-v4.png', data: { url: '/namaz-tracker' } };
  try {
    const reg = await registration();
    await reg.showNotification(title, options);
  } catch {
    try { new Notification(title, options); } catch {}
  }
}

/** Ask permission, register the worker and switch reminders on */
export async function enableReminders(lead?: number): Promise<NotificationPermission> {
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return permission;
  await registration();
  const s = getReminderSettings();
  saveReminderSettings({ enabled: true, lead: lead ?? s.lead });
  return permission;
}
