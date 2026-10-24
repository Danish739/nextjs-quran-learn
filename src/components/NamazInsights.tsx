'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PRAYERS, WD, WD_LONG, fromKey, prayed, toKey, type Log } from '@/lib/namaz';
import { useReminders } from './NextPrayerCard';
import './NamazInsights.css';

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

interface Analysis {
  keys: string[];
  due: number;
  prayed: number;
  missed: number;
  late: number;
  jamaat: number;
  logged: number;
  fullDays: number;
  bestRun: number;
  rate: number | null;
  /** per prayer, in PRAYERS order. `missed` counts every prayer recorded as missed, even if made up later */
  per: { prayed: number; missed: number; late: number; logged: number }[];
  weekday: { due: number; prayed: number }[];
  daily: { key: string; prayed: number }[];
}

const shiftDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const shortDate = (k: string) => fromKey(k).toLocaleDateString('en', { day: 'numeric', month: 'short' });

/** Days before the user's first entry aren't counted, so a new user isn't shown months of "unmarked" */
function analyse(log: Log, end: Date, days: number, firstKey: string | null): Analysis {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = toKey(shiftDays(end, -i));
    if (firstKey && k >= firstKey) keys.push(k);
  }
  const per = PRAYERS.map(() => ({ prayed: 0, missed: 0, late: 0, logged: 0 }));
  const weekday = WD.map(() => ({ due: 0, prayed: 0 }));
  let jamaat = 0, fullDays = 0, bestRun = 0, run = 0;

  const daily = keys.map(k => {
    let n = 0;
    PRAYERS.forEach(({ key }, i) => {
      const c = log[k]?.[key];
      if (!c) return;
      per[i].logged++;
      if (prayed(c)) { per[i].prayed++; n++; }
      if (c === 'M' || c === 'Q') per[i].missed++;
      if (c === 'L') per[i].late++;
      if (c === 'J') jamaat++;
    });
    const w = weekday[fromKey(k).getDay()];
    w.due += 5; w.prayed += n;
    if (n === 5) { fullDays++; run++; bestRun = Math.max(bestRun, run); } else run = 0;
    return { key: k, prayed: n };
  });

  const sum = (f: (p: (typeof per)[number]) => number) => per.reduce((a, p) => a + f(p), 0);
  const due = keys.length * 5;
  const prayedTotal = sum(p => p.prayed);
  return {
    keys, due, per, weekday, daily, jamaat, fullDays, bestRun,
    prayed: prayedTotal,
    missed: sum(p => p.missed),
    late: sum(p => p.late),
    logged: sum(p => p.logged),
    rate: due ? prayedTotal / due : null,
  };
}

function Delta({ now, before, unit = '', betterWhen = 'up', points = false }: {
  now: number; before: number; unit?: string; betterWhen?: 'up' | 'down'; points?: boolean;
}) {
  const diff = points ? Math.round((now - before) * 100) : now - before;
  if (diff === 0) return <span className="ni-delta">No change</span>;
  const good = betterWhen === 'up' ? diff > 0 : diff < 0;
  return (
    <span className={`ni-delta ${good ? 'is-good' : 'is-bad'}`}>
      <span aria-hidden="true">{diff > 0 ? '▲' : '▼'}</span> {Math.abs(diff)}{points ? (Math.abs(diff) === 1 ? ' pt' : ' pts') : unit}{' '}
      {points ? (diff > 0 ? 'higher' : 'lower') : (diff > 0 ? 'more' : 'fewer')}
    </span>
  );
}

export default function NamazInsights({ log, today, open, onClose, onMarkToday }: {
  log: Log; today: Date; open: boolean; onClose: () => void; onMarkToday: () => void;
}) {
  const [period, setPeriod] = useState<Period>(30);
  const [hover, setHover] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reminders = useReminders();

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const firstKey = useMemo(() => Object.keys(log).filter(k => Object.keys(log[k]).length).sort()[0] ?? null, [log]);
  const cur = useMemo(() => analyse(log, today, period, firstKey), [log, today, period, firstKey]);
  const prev = useMemo(() => analyse(log, shiftDays(today, -period), period, firstKey), [log, today, period, firstKey]);
  const owed = useMemo(() => Object.values(log).reduce((a, d) => a + Object.values(d).filter(c => c === 'M').length, 0), [log]);

  if (!open) return null;

  const hasData = cur.logged > 0;
  const canCompare = prev.keys.length >= 3 && prev.logged > 0;

  // most missed: highest count, ties broken by the larger share of that prayer's logged entries
  const ranked = PRAYERS.map((p, i) => ({ ...p, ...cur.per[i], share: cur.per[i].logged ? cur.per[i].missed / cur.per[i].logged : 0 }))
    .sort((a, b) => b.missed - a.missed || b.share - a.share);
  const worst = ranked[0].missed > 0 ? ranked[0] : null;
  const maxShare = Math.max(...ranked.map(r => r.share), 0.0001);

  const lateProne = PRAYERS.map((p, i) => ({ ...p, late: cur.per[i].late, logged: cur.per[i].logged }))
    .filter(p => p.logged >= 3 && p.late / p.logged >= 0.2)
    .sort((a, b) => b.late / b.logged - a.late / a.logged)[0];

  const days = cur.weekday.map((w, i) => ({ i, rate: w.due >= 10 ? w.prayed / w.due : null })).filter(w => w.rate !== null) as { i: number; rate: number }[];
  const weakDay = days.length >= 3 ? days.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;
  const strongDay = days.length >= 3 ? days.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
  const dayGap = weakDay && strongDay ? strongDay.rate - weakDay.rate : 0;
  const unmarkedShare = cur.due ? (cur.due - cur.logged) / cur.due : 0;
  const rateDiff = canCompare && cur.rate !== null && prev.rate !== null ? cur.rate - prev.rate : 0;

  // trend bars: daily for 7 / 30 days, weekly for 90
  const bars = period === 90
    ? Array.from({ length: Math.ceil(cur.daily.length / 7) }, (_, w) => {
        const chunk = cur.daily.slice(w * 7, w * 7 + 7);
        const got = chunk.reduce((a, d) => a + d.prayed, 0);
        return { label: `Week of ${shortDate(chunk[0].key)}`, short: shortDate(chunk[0].key), value: got / (chunk.length * 5), text: `${got} of ${chunk.length * 5} prayed` };
      })
    : cur.daily.map(d => ({
        label: `${WD[fromKey(d.key).getDay()]} ${shortDate(d.key)}`,
        short: period === 7 ? WD[fromKey(d.key).getDay()] : String(fromKey(d.key).getDate()),
        value: d.prayed / 5,
        text: `${d.prayed} of 5 prayed`,
      }));
  const labelEvery = bars.length > 14 ? Math.ceil(bars.length / 8) : 1;

  const patterns: string[] = [];
  if (weakDay && strongDay && dayGap >= 0.1) {
    patterns.push(`${WD_LONG[strongDay.i]}s are your strongest day (${pct(strongDay.rate)} prayed) and ${WD_LONG[weakDay.i]}s the lightest (${pct(weakDay.rate)}).`);
  }
  if (lateProne) patterns.push(`${lateProne.label} is prayed late ${lateProne.late} of ${lateProne.logged} times it was logged.`);
  if (cur.bestRun >= 2) patterns.push(`Your longest run of complete days in this period was ${cur.bestRun} days.`);
  if (cur.fullDays) patterns.push(`All five prayers were prayed on ${cur.fullDays} of ${cur.keys.length} days.`);
  if (unmarkedShare >= 0.15) patterns.push(`${pct(unmarkedShare)} of prayers in this period haven’t been marked yet, so these numbers may be incomplete.`);

  type Tip = { tone: 'good' | 'tip'; text: string; action?: { label: string; run: () => void } };
  const tips: Tip[] = [];
  if (worst) {
    tips.push({
      tone: 'tip',
      text: `${worst.label} is the prayer you miss most (${worst.missed} of ${worst.logged} logged). A reminder a little before ${worst.label} and preparing for it early can make it easier.`,
      action: reminders.on && reminders.settings.lead >= 15
        ? undefined
        : { label: 'Remind me 15 min before each prayer', run: async () => { reminders.setLead(15); if (!reminders.on) await reminders.turnOn(); } },
    });
  }
  if (lateProne && lateProne.key !== worst?.key) {
    tips.push({ tone: 'tip', text: `${lateProne.label} often slips late. Praying it soon after the adhan, before starting something new, helps keep it on time.` });
  }
  if (weakDay && dayGap >= 0.15) {
    tips.push({ tone: 'tip', text: `${WD_LONG[weakDay.i]}s are harder for you. Plan that day’s prayer times the night before, especially when your routine changes.` });
  }
  if (canCompare && rateDiff >= 0.05) {
    tips.push({ tone: 'good', text: `Your consistency rose from ${pct(prev.rate!)} to ${pct(cur.rate!)} compared with the previous ${period} days. MashaAllah, keep going.` });
  } else if (canCompare && rateDiff <= -0.05) {
    tips.push({ tone: 'tip', text: `Consistency dipped from ${pct(prev.rate!)} to ${pct(cur.rate!)} compared with the previous ${period} days. Be gentle with yourself and simply focus on the next prayer.` });
  }
  if (unmarkedShare >= 0.25) {
    tips.push({ tone: 'tip', text: 'Marking each prayer right after you pray keeps these insights accurate.', action: { label: 'Mark today’s prayers', run: () => { onClose(); onMarkToday(); } } });
  }
  if (owed > 0) {
    tips.push({ tone: 'tip', text: `You have ${owed} qaza ${owed === 1 ? 'prayer' : 'prayers'} to make up. Praying one extra with each day’s prayers clears them steadily.` });
  }
  if (!tips.length) {
    tips.push({ tone: 'good', text: 'No missed prayers in this period. MashaAllah! May Allah keep you steadfast.' });
  }

  const hovered = hover !== null ? bars[hover] : null;

  return (
    <div className="ni-overlay" onClick={onClose}>
      <div className="ni" role="dialog" aria-modal="true" aria-labelledby="ni-title" onClick={e => e.stopPropagation()}>
        <header className="ni-head">
          <div>
            <h2 id="ni-title">Namaz insights</h2>
            <p>
              {hasData
                ? `${shortDate(cur.keys[0])} – ${shortDate(cur.keys[cur.keys.length - 1])} · ${cur.keys.length} tracked ${cur.keys.length === 1 ? 'day' : 'days'}`
                : 'Your patterns, from what you’ve recorded'}
            </p>
          </div>
          <button ref={closeRef} type="button" className="ni-close" onClick={onClose} aria-label="Close insights">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className="ni-periods" role="group" aria-label="Period">
          {PERIODS.map(p => (
            <button key={p} type="button" aria-pressed={period === p} className={period === p ? 'is-on' : ''} onClick={() => { setPeriod(p); setHover(null); }}>
              {p} days
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="ni-empty">
            <p>No prayers recorded in the last {period} days yet. Start marking your prayers and your insights will appear here.</p>
            <button type="button" className="ni-action" onClick={() => { onClose(); onMarkToday(); }}>Mark today’s prayers</button>
          </div>
        ) : (
          <div className="ni-body">
            {/* summary */}
            <div className="ni-tiles">
              <div>
                <span>Consistency</span>
                <b className="ni-brand">{cur.rate !== null ? pct(cur.rate) : '–'}</b>
                <em>{cur.prayed} of {cur.due} prayed</em>
                {canCompare && <Delta now={cur.rate!} before={prev.rate!} points />}
              </div>
              <div>
                <span>Missed</span>
                <b className="ni-red">{cur.missed}</b>
                <em>{cur.logged ? pct(cur.missed / cur.logged) : '0%'} of recorded</em>
                {canCompare && <Delta now={cur.missed} before={prev.missed} betterWhen="down" />}
              </div>
              <div>
                <span>In jamaat</span>
                <b>{cur.jamaat}</b>
                <em>{cur.prayed ? pct(cur.jamaat / cur.prayed) : '0%'} of prayed</em>
                {canCompare && <Delta now={cur.jamaat} before={prev.jamaat} />}
              </div>
              <div>
                <span>Complete days</span>
                <b>{cur.fullDays}</b>
                <em>of {cur.keys.length} days</em>
                {canCompare && <Delta now={cur.fullDays} before={prev.fullDays} unit={cur.fullDays - prev.fullDays === 1 || cur.fullDays - prev.fullDays === -1 ? ' day' : ' days'} />}
              </div>
            </div>
            <p className="ni-note">
              {canCompare ? `Arrows compare with the previous ${period} days.` : `Track a few more days to compare with the previous ${period} days.`}
            </p>

            {/* most missed */}
            <section className={`ni-card ni-worst${worst ? '' : ' is-clear'}`}>
              <span className="ni-kicker">Most missed prayer</span>
              {worst ? (
                <>
                  <div className="ni-worst-name"><b>{worst.label}</b><span lang="ar" dir="rtl">{worst.ar}</span></div>
                  <p>Missed {worst.missed} {worst.missed === 1 ? 'time' : 'times'} · {pct(worst.share)} of the {worst.label} prayers you logged</p>
                </>
              ) : (
                <p className="ni-clear">None — no prayers recorded as missed in this period.</p>
              )}
            </section>

            {/* missed by prayer */}
            <section className="ni-card">
              <h3>Missed by prayer</h3>
              <p className="ni-sub">Share of each prayer’s recorded entries marked missed (including ones made up later)</p>
              <table className="ni-table">
                <thead><tr><th scope="col">Prayer</th><th scope="col"><span className="ni-sr">Share</span></th><th scope="col">Missed</th><th scope="col">%</th></tr></thead>
                <tbody>
                  {PRAYERS.map((p, i) => {
                    const r = cur.per[i];
                    const share = r.logged ? r.missed / r.logged : 0;
                    return (
                      <tr key={p.key} className={worst?.key === p.key ? 'is-worst' : ''}>
                        <th scope="row">{p.label}</th>
                        <td className="ni-bar-cell" aria-hidden="true">
                          <span className="ni-bar"><i style={{ width: `${(share / maxShare) * 100}%` }} /></span>
                        </td>
                        <td>{r.missed}<span className="ni-of"> / {r.logged}</span></td>
                        <td>{r.logged ? pct(share) : '–'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* trend */}
            <section className="ni-card">
              <div className="ni-chart-head">
                <div>
                  <h3>Consistency over time</h3>
                  <p className="ni-sub">{period === 90 ? 'Share of prayers prayed each week' : 'Prayers prayed each day'}</p>
                </div>
                <p className="ni-readout" aria-live="polite">
                  {hovered ? <><b>{hovered.label}</b> · {hovered.text}</> : <>&nbsp;</>}
                </p>
              </div>
              <div className="ni-chart" onMouseLeave={() => setHover(null)}>
                <div className="ni-grid" aria-hidden="true"><span>100%</span><span>50%</span><span>0</span></div>
                <div className="ni-bars">
                  {bars.map((b, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`ni-col${hover === i ? ' is-hover' : ''}`}
                      aria-label={`${b.label}: ${b.text}`}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                    >
                      <span className="ni-col-track"><i style={{ height: `${Math.max(b.value * 100, b.value ? 4 : 0)}%` }} /></span>
                      <span className="ni-col-label">{i % labelEvery === 0 ? b.short : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* patterns */}
            {patterns.length > 0 && (
              <section className="ni-card">
                <h3>Patterns</h3>
                <ul className="ni-list">{patterns.map(t => <li key={t}>{t}</li>)}</ul>
              </section>
            )}

            {/* suggestions */}
            <section className="ni-card">
              <h3>Suggestions for you</h3>
              <ul className="ni-tips">
                {tips.map(t => (
                  <li key={t.text} className={`is-${t.tone}`}>
                    <span className="ni-tip-icon" aria-hidden="true">{t.tone === 'good' ? '✓' : '✦'}</span>
                    <div>
                      <p>{t.text}</p>
                      {t.action && <button type="button" className="ni-action" onClick={t.action.run}>{t.action.label}</button>}
                    </div>
                  </li>
                ))}
              </ul>
              {reminders.on && <p className="ni-note">Reminders are on, {reminders.settings.lead ? `${reminders.settings.lead} min before` : 'at'} each prayer.</p>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
