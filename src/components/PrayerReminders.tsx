'use client';
import { useEffect } from 'react';
import {
  REMINDERS_EVENT, getCachedLocation, getPrayerDays, getReminderSettings, locateByIp,
  showNotification, to12h, upcomingPrayers,
} from '@/lib/prayerTimes';

const LAST_KEY = 'namaz-reminder-last';

/**
 * Site-wide scheduler for next-prayer notifications. Renders nothing; while any page of
 * the site is open (even in a background tab) it fires a notification `lead` minutes
 * before each prayer. Browsers give websites no way to schedule one with the site closed.
 */
export default function PrayerReminders() {
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;

    const schedule = async () => {
      window.clearTimeout(timer);
      const settings = getReminderSettings();
      if (!settings.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      try {
        const loc = getCachedLocation() ?? await locateByIp();
        const days = await getPrayerDays(loc);
        if (cancelled) return;

        const now = Date.now();
        const last = localStorage.getItem(LAST_KEY);
        const next = upcomingPrayers(days)
          .map(p => ({ ...p, id: `${p.name}-${+p.at}`, fireAt: +p.at - settings.lead * 60_000 }))
          // allow a minute of timer lag, but never repeat one already shown
          .find(p => p.fireAt > now - 60_000 && p.id !== last);
        if (!next) {
          // past tomorrow's Isha — fetch again in an hour
          timer = window.setTimeout(schedule, 60 * 60_000);
          return;
        }

        timer = window.setTimeout(async () => {
          // several open tabs each run this; only the first one notifies
          const { id } = next;
          if (localStorage.getItem(LAST_KEY) !== id) {
            localStorage.setItem(LAST_KEY, id);
            const mins = Math.round((+next.at - Date.now()) / 60_000);
            await showNotification(
              mins > 0 ? `${next.name} in ${mins} min` : `It’s time for ${next.name}`,
              `${next.name} at ${to12h(next.at)} · ${loc.name}. Tap to mark it in your Namaz Tracker.`,
              `namaz-${id}`
            );
          }
          schedule();
        }, Math.max(next.fireAt - now, 0));
      } catch {
        timer = window.setTimeout(schedule, 10 * 60_000); // offline — try again later
      }
    };

    schedule();
    // timers stall while a phone sleeps, so re-plan whenever the page comes back
    const onVisible = () => { if (document.visibilityState === 'visible') schedule(); };
    window.addEventListener(REMINDERS_EVENT, schedule);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener(REMINDERS_EVENT, schedule);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
