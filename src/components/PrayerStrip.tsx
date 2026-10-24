'use client';
import './PrayerStrip.css';

interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface Props {
  times: PrayerTimes | null;
  next: { name: string; time: string; remaining: string } | null;
  hijri: { day: string; month: { en: string }; year: string } | null;
  location: string;
  loading: boolean;
  /** true when times come from the device's GPS, false for IP / default location */
  precise: boolean;
  locating: boolean;
  error: string;
  onDetect: () => void;
}

const ORDER: { key: keyof PrayerTimes; icon: string; ar: string }[] = [
  { key: 'Fajr', icon: 'routine', ar: 'الفجر' },
  { key: 'Sunrise', icon: 'wb_twilight', ar: 'الشروق' },
  { key: 'Dhuhr', icon: 'wb_sunny', ar: 'الظهر' },
  { key: 'Asr', icon: 'partly_cloudy_day', ar: 'العصر' },
  { key: 'Maghrib', icon: 'water_lux', ar: 'المغرب' },
  { key: 'Isha', icon: 'dark_mode', ar: 'العشاء' },
];

/** "15:21" or "15:21 (PKT)" → minutes since midnight */
function toMins(t: string) {
  const [h, m] = t.split(' ')[0].split(':').map(Number);
  return h * 60 + m;
}

/** "15:21" → "3:21 PM" */
function to12h(t: string) {
  const [h, m] = t.split(' ')[0].split(':').map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function PrayerStrip({ times, next, hijri, location, loading, precise, locating, error, onDetect }: Props) {
  if (loading) {
    return (
      <div className="ps" aria-busy="true">
        <div className="ps-card">
          <div className="ps-skel ps-skel-hero" />
          <div className="ps-skel-row">
            {ORDER.map(p => <div key={p.key} className="ps-skel ps-skel-node" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!times) return null;

  // Re-rendered every second by the parent's countdown tick
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const mins = ORDER.map(p => toMins(times[p.key]));

  // Timeline spans Fajr → Isha; position the "now" marker along it
  const start = mins[0];
  const end = mins[mins.length - 1];
  const nowPct = Math.min(Math.max((nowM - start) / (end - start), 0), 1) * 100;

  // Progress between the previous prayer and the next one (wrapping past midnight)
  const prayerMins = ORDER.filter(p => p.key !== 'Sunrise').map(p => toMins(times[p.key]));
  const nextM = next ? toMins(next.time) : prayerMins[0];
  const prevCandidates = prayerMins.filter(m => m <= nowM);
  const prevM = prevCandidates.length ? prevCandidates[prevCandidates.length - 1] : prayerMins[prayerMins.length - 1] - 1440;
  const nextAdj = nextM <= nowM ? nextM + 1440 : nextM;
  const gapPct = Math.min(Math.max((nowM - prevM) / (nextAdj - prevM), 0), 1) * 100;

  const nextMeta = ORDER.find(p => p.key === next?.name);

  return (
    <div className="ps" role="region" aria-label="Prayer times">
      <div className="ps-card">
        {/* ── Next prayer ── */}
        <div className="ps-next">
          <span className="ps-next-label">
            <span className="ps-pulse" aria-hidden="true" />
            Next prayer
          </span>
          <div className="ps-next-name">
            <b>{next?.name ?? '—'}</b>
            {nextMeta && <span className="font-arabic" lang="ar">{nextMeta.ar}</span>}
          </div>
          <p className="ps-countdown" aria-live="off">
            {next ? <>in <span className="ps-tabular">{next.remaining}</span></> : 'Calculating…'}
          </p>
          <div className="ps-gap" aria-hidden="true">
            <span style={{ width: `${gapPct}%` }} />
          </div>
          <p className="ps-next-at">
            at <b>{next ? to12h(next.time) : '--'}</b>
          </p>
        </div>

        {/* ── Day timeline ── */}
        <div className="ps-day">
          <div className="ps-meta">
            {hijri && (
              <span>
                <span className="material-symbols-outlined">calendar_month</span>
                {hijri.day} {hijri.month.en} {hijri.year} AH
              </span>
            )}
            <span title={precise ? 'Using your device location' : 'Approximate location'}>
              <span className="material-symbols-outlined">{precise ? 'my_location' : 'location_on'}</span>
              {location}
            </span>
            {!precise && (
              <button className="ps-detect" onClick={onDetect} disabled={locating}>
                <span className={`material-symbols-outlined${locating ? ' ps-spin' : ''}`}>
                  {locating ? 'progress_activity' : 'near_me'}
                </span>
                {locating ? 'Detecting…' : 'Use my location'}
              </button>
            )}
          </div>

          <ol className="ps-line">
            <span className="ps-track" aria-hidden="true">
              <span className="ps-track-fill" style={{ width: `${nowPct}%` }} />
              {nowPct > 0 && nowPct < 100 && <span className="ps-now" style={{ left: `${nowPct}%` }} />}
            </span>

            {ORDER.map((p, i) => {
              const passed = mins[i] <= nowM;
              const isNext = next?.name === p.key;
              return (
                <li key={p.key} className={`ps-node${passed ? ' passed' : ''}${isNext ? ' next' : ''}${p.key === 'Sunrise' ? ' minor' : ''}`}>
                  <span className="ps-dot">
                    <span className="material-symbols-outlined">{passed && !isNext ? 'check' : p.icon}</span>
                  </span>
                  <b>{p.key}</b>
                  <span className="ps-time">{to12h(times[p.key])}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {error && <p className="ps-error">{error}</p>}
    </div>
  );
}
