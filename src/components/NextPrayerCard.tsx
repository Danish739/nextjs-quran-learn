'use client';
import { useEffect, useState } from 'react';
import {
  PRAYER_AR, REMINDERS_EVENT, dayKey, enableReminders, getCachedLocation, getPrayerDays, getReminderSettings,
  locateByGps, locateByIp, notifySupport, saveReminderSettings, showNotification, to12h, upcomingPrayers,
  type NotifySupport, type PrayerDay, type PrayerLocation, type ReminderSettings,
} from '@/lib/prayerTimes';
import './NextPrayerCard.css';

const LEADS = [
  { value: 0, label: 'At prayer time' },
  { value: 5, label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
];

const leadText = (lead: number) => (lead ? `${lead} minutes before` : 'at the start of');

/** Reminder on/off state, kept in sync across every component that uses it */
export function useReminders() {
  const [settings, setSettings] = useState<ReminderSettings>({ enabled: false, lead: 10 });
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [support, setSupport] = useState<NotifySupport>('ok');

  useEffect(() => {
    const sync = () => {
      setSettings(getReminderSettings());
      setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    };
    setSupport(notifySupport());
    sync();
    window.addEventListener(REMINDERS_EVENT, sync);
    return () => window.removeEventListener(REMINDERS_EVENT, sync);
  }, []);

  const turnOn = async () => {
    if (support !== 'ok') return;
    const p = await enableReminders();
    setPermission(p);
    if (p === 'granted') {
      const { lead } = getReminderSettings();
      await showNotification('Prayer reminders are on', `You’ll be reminded ${leadText(lead)} each prayer while Learn Quran is open.`, 'namaz-welcome');
    }
  };
  const turnOff = () => saveReminderSettings({ ...getReminderSettings(), enabled: false });
  const setLead = (lead: number) => saveReminderSettings({ ...getReminderSettings(), lead });

  return { settings, permission, support, on: settings.enabled && permission === 'granted', turnOn, turnOff, setLead };
}

const Bell = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export default function NextPrayerCard({ id }: { id?: string }) {
  const [loc, setLoc] = useState<PrayerLocation | null>(null);
  const [days, setDays] = useState<PrayerDay[] | null>(null);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const r = useReminders();

  const load = async (l: PrayerLocation) => {
    setLoc(l);
    try {
      setDays(await getPrayerDays(l));
      setError('');
    } catch {
      setError('Could not load prayer times. Check your connection and try again.');
    }
  };

  useEffect(() => {
    (async () => load(getCachedLocation() ?? await locateByIp()))();
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // after midnight, today's entry is gone; fetch the new pair of days
  const today = dayKey(now);
  useEffect(() => {
    if (loc && days && !days.some(d => d.date === today)) load(loc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const useGps = async () => {
    setLocating(true);
    try { await load(await locateByGps()); } catch (e) { setError((e as Error).message); }
    setLocating(false);
  };

  const next = days ? upcomingPrayers(days, now)[0] : undefined;
  let countdown = '';
  if (next) {
    const s = Math.max(0, Math.floor((+next.at - +now) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    countdown = h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
  }

  const hint =
    r.support === 'ios-install' ? 'On iPhone, tap Share → Add to Home Screen, then open Learn Quran from there to get reminders.'
    : r.support === 'unsupported' || r.permission === 'unsupported' ? 'This browser can’t show notifications.'
    : r.permission === 'denied' ? 'Notifications are blocked. Allow them from the lock icon in the address bar, then try again.'
    : r.on ? 'Reminders arrive while Learn Quran is open in a tab, even in the background.'
    : '';

  return (
    <section id={id} className="np" aria-label="Next prayer">
      <div className="np-main">
        <span className="np-label"><i className="np-pulse" aria-hidden="true" />Next prayer</span>
        {next ? (
          <>
            <div className="np-name">
              <b>{next.name}</b>
              <span lang="ar" dir="rtl">{PRAYER_AR[next.name]}</span>
            </div>
            <p className="np-when">
              at <b>{to12h(next.at)}</b> · in <b className="np-tab" aria-live="off">{countdown}</b>
            </p>
          </>
        ) : (
          <div className="np-skel" aria-busy="true" />
        )}
        <p className="np-loc">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          <span>{loc ? loc.name : 'Finding your location…'}</span>
          {loc && loc.source !== 'gps' && (
            <button type="button" className="np-link" onClick={useGps} disabled={locating}>
              {locating ? 'Detecting…' : 'Use my location'}
            </button>
          )}
        </p>
      </div>

      <div className="np-remind">
        {r.on ? (
          <div className="np-on-row">
            <span className="np-on"><Bell />Reminders on</span>
            <select aria-label="When to remind me" value={r.settings.lead} onChange={e => r.setLead(Number(e.target.value))}>
              {LEADS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <button type="button" className="np-off" onClick={r.turnOff}>Turn off</button>
          </div>
        ) : (
          <button type="button" className="np-bell" onClick={r.turnOn} disabled={r.support !== 'ok' || r.permission === 'unsupported'}>
            <Bell />Remind me for next namaz
          </button>
        )}
        {hint && <p className="np-hint">{hint}</p>}
      </div>

      {error && <p className="np-error">{error}</p>}
    </section>
  );
}
