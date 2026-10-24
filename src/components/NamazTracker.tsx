'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextPrayerCard, { useReminders } from './NextPrayerCard';
import NamazInsights from './NamazInsights';
import {
  PRAYERS, WD, WD_LONG, fromKey, onDay, prayed, toKey,
  type Code, type DayLog, type Log, type PrayerKey,
} from '@/lib/namaz';
import './NamazTracker.css';

const STORAGE_KEY = 'namaz-tracker-v2';
const LEGACY_KEY = 'namaz-tracker-v1';
const LEGACY: Record<string, Code> = { done: 'O', missed: 'M', qaza: 'Q' };

const LABEL: Record<Code | 'none', string> = {
  J: 'In jamaat', O: 'On time', L: 'Late', Q: 'Qaza done', M: 'Missed', none: 'Not marked',
};
const OPTIONS: { code: Code; label: string }[] = [
  { code: 'J', label: 'Jamaat' },
  { code: 'O', label: 'On time' },
  { code: 'L', label: 'Late' },
  { code: 'M', label: 'Missed' },
];
const LEGEND: { code: Code | 'none'; label: string }[] = [
  { code: 'J', label: 'In jamaat' },
  { code: 'O', label: 'On time' },
  { code: 'L', label: 'Late' },
  { code: 'Q', label: 'Qaza done' },
  { code: 'M', label: 'Missed' },
  { code: 'none', label: 'Not marked' },
];
const longDate = (d: Date) => `${WD_LONG[d.getDay()]}, ${d.getDate()} ${d.toLocaleDateString('en', { month: 'long' })}`;

const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhu al-Qadah', 'Dhu al-Hijjah'];
const HIJRI_SHORT = ['Muharram', 'Safar', 'Rabi I', 'Rabi II', 'Jumada I', 'Jumada II', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah'];

let hijriFmt: Intl.DateTimeFormat | null = null;
function hijri(d: Date) {
  try {
    hijriFmt ??= new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const parts = hijriFmt.formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const m = parseInt(get('month'), 10) - 1;
    return { day: get('day'), month: HIJRI_MONTHS[m], short: HIJRI_SHORT[m], year: get('year') };
  } catch {
    return null;
  }
}
function hijriRange(first: Date, last: Date) {
  const a = hijri(first), b = hijri(last);
  if (!a || !b) return '';
  return a.month === b.month ? `${a.month} ${b.year}` : `${a.month} – ${b.month} ${b.year}`;
}

/** Friday's Dhuhr is Jumu'ah */
const prayerName = (p: (typeof PRAYERS)[number], d: Date) =>
  d.getDay() === 5 && p.key === 'dhuhr' ? { label: 'Jumu’ah', ar: 'الجمعة' } : { label: p.label, ar: p.ar };

function loadLog(): Log {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const old = localStorage.getItem(LEGACY_KEY);
  if (!old) return {};
  const out: Log = {};
  for (const [day, entry] of Object.entries(JSON.parse(old) as Record<string, Record<string, string>>)) {
    const d: DayLog = {};
    for (const [p, s] of Object.entries(entry)) if (LEGACY[s]) d[p as PrayerKey] = LEGACY[s];
    if (Object.keys(d).length) out[day] = d;
  }
  return out;
}

/** `empty` keeps the row's height for future days, which show no dots */
function Dots({ day, empty }: { day?: DayLog; empty?: boolean }) {
  return (
    <span className="nt-dots" aria-hidden="true">
      {!empty && PRAYERS.map(p => <i key={p.key} className={`nt-dot c-${day?.[p.key] ?? 'none'}`} />)}
    </span>
  );
}

function PrayerRow({ name, ar, code, onPick, onMakeUp, card }: {
  name: string; ar: string; code?: Code; onPick: (c: Code) => void; onMakeUp?: () => void; card?: boolean;
}) {
  return (
    <div className={card ? `nt-pcard c-${code ?? 'none'}` : 'nt-prow'}>
      <div className="nt-prow-head">
        <span className="nt-pname">
          <b>{name}</b>
          <span lang="ar" dir="rtl">{ar}</span>
        </span>
        <span className={`nt-chip c-${code ?? 'none'}`}>{LABEL[code ?? 'none']}</span>
      </div>
      <div role="group" aria-label={`How did you pray ${name}?`} className="nt-opts">
        {OPTIONS.map(o => {
          const on = code === o.code;
          return (
            <button key={o.code} type="button" aria-pressed={on} className={`nt-opt${on ? ` is-on c-${o.code}` : ''}`} onClick={() => onPick(o.code)}>
              {on && (
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
      {code === 'M' && onMakeUp && (
        <button type="button" className="nt-makeup" onClick={onMakeUp}>Prayed it later? Mark qaza done</button>
      )}
    </div>
  );
}

const InsightsButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="ni-open" onClick={onClick}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></svg>
    Namaz insights
  </button>
);

const Chevron =({ dir }: { dir: 'left' | 'right' }) => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
  </svg>
);

export default function NamazTracker() {
  const [log, setLog] = useState<Log>({});
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const [cursor, setCursor] = useState<Date | null>(null);
  const [selected, setSelected] = useState('');
  /** mobile opens on the calendar; tapping a day opens its check-in */
  const [mobileView, setMobileView] = useState<'today' | 'month'>('month');
  const dateInput = useRef<HTMLInputElement>(null);
  const reminders = useReminders();
  const [insightsOpen, setInsightsOpen] = useState(false);
  const closeInsights = useCallback(() => setInsightsOpen(false), []);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(toKey(now));
    try { setLog(loadLog()); } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [mobileView]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(log)); } catch {}
  }, [log, loaded]);

  const update = (day: string, fn: (d: DayLog) => void) =>
    setLog(prev => {
      const d = { ...prev[day] };
      fn(d);
      const next = { ...prev };
      if (Object.keys(d).length) next[day] = d; else delete next[day];
      return next;
    });

  /** picking the active option again clears it */
  const pick = (day: string, p: PrayerKey, c: Code) =>
    update(day, d => { if (d[p] === c) delete d[p]; else d[p] = c; });
  const makeUp = (day: string, p: PrayerKey) => update(day, d => { d[p] = 'Q'; });
  const markRest = (day: string) => update(day, d => { PRAYERS.forEach(({ key }) => { d[key] ??= 'O'; }); });

  const perfect = (k: string) => PRAYERS.every(({ key }) => onDay(log[k]?.[key]));

  const qazaList = useMemo(() => {
    const out: { day: string; p: PrayerKey }[] = [];
    Object.keys(log).sort().forEach(day =>
      PRAYERS.forEach(({ key }) => { if (log[day][key] === 'M') out.push({ day, p: key }); })
    );
    return out;
  }, [log]);

  const streak = useMemo(() => {
    if (!today) return 0;
    const isPerfect = (k: string) => PRAYERS.every(({ key }) => onDay(log[k]?.[key]));
    const d = new Date(today);
    // today only counts once complete; otherwise start from yesterday
    if (!isPerfect(toKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (isPerfect(toKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }, [log, today]);

  if (!today || !cursor) return <div className="nt" style={{ minHeight: '100vh' }} />;

  const todayKey = toKey(today);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const monthName = cursor.toLocaleDateString('en', { month: 'long' });
  const monthLabel = `${monthName} ${year}`;
  const range = hijriRange(new Date(year, month, 1), new Date(year, month, daysInMonth));
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const shift = (n: number) => setCursor(new Date(year, month + n, 1));
  const goToDate = (k: string) => {
    const d = fromKey(k);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(k);
  };
  const goToday = () => goToDate(todayKey);
  /** the transparent date input sits over the button, so a tap opens the native picker; showPicker covers desktop browsers */
  const openPicker = () => {
    try { dateInput.current?.showPicker(); } catch {}
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    const key = toKey(date);
    const entry = log[key];
    return {
      date, key, entry,
      n: PRAYERS.filter(({ key: p }) => prayed(entry?.[p])).length,
      future: key > todayKey,
    };
  });

  // month stats, from day 1 up to today: every day owes 5 prayers, marked or not
  const elapsed = days.filter(d => !d.future).length;
  const total = elapsed * 5;
  let logged = 0, done = 0, jamaat = 0, madeUp = 0, missed = 0;
  const per = PRAYERS.map(() => ({ on: 0, logged: 0 }));
  days.forEach(({ entry, future }) => {
    if (future || !entry) return;
    PRAYERS.forEach(({ key }, i) => {
      const c = entry[key];
      if (!c) return;
      logged++; per[i].logged++;
      if (prayed(c)) done++;
      if (c === 'J') jamaat++;
      if (c === 'Q') madeUp++;
      if (c === 'M') missed++;
      if (onDay(c)) per[i].on++;
    });
  });
  const unmarked = total - logged;
  const pct = total ? `${Math.round((done / total) * 100)}%` : '–';
  const share = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  const monthSummary = (
    <section className="nt-card nt-month" aria-labelledby="nt-month-title">
      <div className="nt-month-head">
        <h2 id="nt-month-title">{monthName} so far</h2>
        <span>{elapsed} {elapsed === 1 ? 'day' : 'days'} × 5 prayers</span>
      </div>
      <div className="nt-month-bar" aria-hidden="true">
        <i className="c-O" style={{ width: share(done - madeUp) }} />
        <i className="c-Q" style={{ width: share(madeUp) }} />
        <i className="c-M" style={{ width: share(missed) }} />
      </div>
      <dl className="nt-month-grid">
        <div><dt>Total namaz</dt><dd>{total}</dd></div>
        <div><dt>Prayed</dt><dd className="nt-brand">{done}</dd>{madeUp > 0 && <span>incl. {madeUp} qaza</span>}</div>
        <div><dt>Missed</dt><dd className="nt-red">{missed}</dd></div>
        <div><dt>Not marked</dt><dd>{unmarked}</dd></div>
      </dl>
    </section>
  );
  const rates = per.map(x => (x.logged ? x.on / x.logged : 0));
  const weakest = logged ? rates.indexOf(Math.min(...rates)) : -1;
  const tip = weakest >= 0
    ? `${PRAYERS[weakest].label} slips most often this month. A reminder a little before its time could help, and every prayer you do pray counts.`
    : 'Start marking your prayers and you will see how each one is going here.';

  const selDate = fromKey(selected);
  const selLog = log[selected] ?? {};
  const selDone = PRAYERS.filter(({ key }) => prayed(selLog[key])).length;
  const selUnmarked = PRAYERS.filter(({ key }) => !selLog[key]).length;
  const selHijri = hijri(selDate);
  const selHijriText = selHijri ? `${selHijri.day} ${selHijri.month} ${selHijri.year}` : '';
  const summary = `${selDone} of 5 prayed${selUnmarked ? ` · ${selUnmarked} not marked yet` : ''}`;

  const rows = (card?: boolean) =>
    PRAYERS.map(p => {
      const n = prayerName(p, selDate);
      return (
        <PrayerRow
          key={p.key}
          card={card}
          name={n.label}
          ar={n.ar}
          code={selLog[p.key]}
          onPick={c => pick(selected, p.key, c)}
          onMakeUp={card ? undefined : () => makeUp(selected, p.key)}
        />
      );
    });

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6 + i);
    return d;
  });

  const qazaItems = qazaList.slice(0, 20).map(({ day, p }) => (
    <li key={day + p}>
      <span>
        <b>{PRAYERS.find(x => x.key === p)!.label}</b>
        <em>{longDate(fromKey(day))}</em>
      </span>
      <button type="button" onClick={() => makeUp(day, p)}>Mark made up</button>
    </li>
  ));
  const qazaMore = qazaList.length > 20 && <li className="nt-more">+{qazaList.length - 20} more</li>;

  return (
    <main className="nt">
      {/* ---------- desktop / tablet ---------- */}
      <div className="nt-desktop">
        <div className="nt-head">
          <div>
            <h1>Namaz Tracker</h1>
            <p>Mark each of the five daily prayers after you pray. Your log is private and only you can see it.</p>
          </div>
          <button
            type="button"
            className="nt-remind"
            onClick={() => reminders.on
              ? document.getElementById('nt-next')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              : reminders.turnOn()}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5D43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            {reminders.on ? 'Reminders on' : 'Prayer reminders'}
          </button>
        </div>

        <NextPrayerCard id="nt-next" />

        <div className="nt-stats">
          <div><p>Completed this month</p><b className="nt-brand">{pct}</b><span>{done} of {total} prayers since 1 {monthName}</span></div>
          <div><p>Current streak</p><b>{streak} {streak === 1 ? 'day' : 'days'}</b><span>All five prayed, every day</span></div>
          <div><p>Prayed in jamaat</p><b>{jamaat}</b><span>{done ? Math.round((jamaat / done) * 100) : 0}% of completed prayers</span></div>
          <div><p>Qaza to make up</p><b className="nt-red">{qazaList.length}</b><span>Missed prayers not yet made up</span></div>
        </div>

        <div className="nt-layout">
          <section className="nt-card nt-cal-card" aria-labelledby="nt-cal-title">
            <div className="nt-cal-top">
              <div>
                <h2 id="nt-cal-title">{monthLabel}</h2>
                {range && <p>{range}</p>}
              </div>
              <div className="nt-cal-nav">
                <button type="button" className="nt-btn nt-icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Chevron dir="left" /></button>
                <button type="button" className="nt-btn" onClick={goToday}>Today</button>
                <button type="button" className="nt-btn nt-icon-btn" onClick={() => shift(1)} disabled={isCurrentMonth} aria-label="Next month"><Chevron dir="right" /></button>
              </div>
            </div>

            <div className="nt-cal-scroll">
              <div className="nt-cal">
                <div className="nt-cal-row">
                  {WD.map(w => <span key={w} className="nt-wd">{w}</span>)}
                </div>
                <div className="nt-cal-row">
                  {days.map(({ date, key, entry, n, future }, i) => {
                    const h = hijri(date);
                    const tag = date.getDay() === 5 ? 'Jumu’ah' : h?.day === '1' ? h.short : '';
                    const cls = ['nt-day', key === selected && 'is-sel', key === todayKey && 'is-today', future && 'is-future', !future && perfect(key) && 'is-perfect']
                      .filter(Boolean).join(' ');
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cls}
                        style={i === 0 ? { gridColumnStart: firstDow + 1 } : undefined}
                        disabled={future}
                        aria-pressed={key === selected}
                        aria-label={`${WD_LONG[date.getDay()]} ${date.getDate()} ${monthName}${future ? '' : `, ${n} of 5 prayed`}`}
                        onClick={() => setSelected(key)}
                      >
                        <span className="nt-day-top">
                          <span className="nt-num">{date.getDate()}</span>
                          {h && <span className="nt-hday">{h.day}</span>}
                        </span>
                        <span className="nt-tag">{tag}</span>
                        <Dots day={future ? undefined : entry} empty={future} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <ul className="nt-legend" aria-label="Legend">
              {LEGEND.map(l => <li key={l.code}><i className={`nt-dot c-${l.code}`} />{l.label}</li>)}
              <li><i className="nt-perfect-swatch" />All five on the day</li>
            </ul>
          </section>

          <div className="nt-side">
            <section className="nt-card" aria-labelledby="nt-day-title">
              <p className="nt-kicker">{selected === todayKey ? 'Today' : 'Past day'}</p>
              <h2 id="nt-day-title" className="nt-day-title">{longDate(selDate)}</h2>
              {selHijriText && <p className="nt-sub">{selHijriText}</p>}
              <div className="nt-segs" aria-hidden="true">
                {PRAYERS.map(p => <i key={p.key} className={`c-${selLog[p.key] ?? 'none'}`} />)}
              </div>
              <p className="nt-summary">{summary}</p>
              <div className="nt-rows">{rows()}</div>
              {selUnmarked > 0 && (
                <button type="button" className="nt-primary" onClick={() => markRest(selected)}>Mark the rest as prayed on time</button>
              )}
            </section>

            {monthSummary}

            <section className="nt-card nt-insight" aria-labelledby="nt-ins-title">
              <div>
                <h2 id="nt-ins-title">Prayer by prayer</h2>
                <p className="nt-sub">Prayed on its day, {monthName} so far</p>
              </div>
              {PRAYERS.map((p, i) => (
                <div key={p.key} className="nt-bar">
                  <span>{p.label}</span>
                  <span className="nt-track" aria-hidden="true">
                    <i className={i === weakest ? 'is-weak' : ''} style={{ width: `${Math.round(rates[i] * 100)}%` }} />
                  </span>
                  <span className="nt-count">{per[i].on}/{per[i].logged}</span>
                </div>
              ))}
              <p className="nt-tip">{tip}</p>
              <InsightsButton onClick={() => setInsightsOpen(true)} />
            </section>
          </div>
        </div>
      </div>

      {/* ---------- mobile ---------- */}
      <div className="nt-mobile">
        {mobileView === 'today' ? (
          <>
            <header className="nt-m-bar is-month">
              <button type="button" className="nt-m-icon" onClick={() => setMobileView('month')} aria-label="Back to calendar"><Chevron dir="left" /></button>
              <div className="nt-m-bar-title"><h1>Namaz</h1></div>
            </header>

            <div className="nt-m-body">
              <div className="nt-m-date">
                <div>
                  <p className="nt-m-title">{longDate(selDate)}</p>
                  <p className="nt-sub">{selHijriText ? `${selHijriText} · ` : ''}{selDone} of 5 prayed</p>
                </div>
                <p className="nt-pill">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 2-1-2-1-4 0-7z" /></svg>
                  {streak}-day streak
                </p>
              </div>

              <ol className="nt-week" aria-label="This week">
                {week.map(d => {
                  const k = toKey(d);
                  const n = PRAYERS.filter(({ key }) => prayed(log[k]?.[key])).length;
                  return (
                    <li key={k}>
                      <button type="button" className={k === selected ? 'is-sel' : ''} onClick={() => setSelected(k)} aria-label={`${WD[d.getDay()]} ${d.getDate()}, ${n} of 5 prayed`}>
                        <span className="nt-wd">{WD[d.getDay()]}</span>
                        <b>{d.getDate()}</b>
                        <Dots day={log[k]} />
                      </button>
                    </li>
                  );
                })}
              </ol>

              <div className="nt-m-rows">{rows(true)}</div>

              <div className="nt-other-date">
                <span className="nt-other-btn">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M3 9.5h18" /><path d="M8 2.5v4" /><path d="M16 2.5v4" /></svg>
                  Mark for another date
                  <input
                    ref={dateInput}
                    type="date"
                    aria-label="Mark for another date"
                    max={todayKey}
                    value={selected}
                    onClick={openPicker}
                    onChange={e => { if (e.target.value && e.target.value <= todayKey) goToDate(e.target.value); }}
                  />
                </span>
                {selected !== todayKey && (
                  <button type="button" className="nt-back-today" onClick={goToday}>Back to today</button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="nt-m-bar is-month">
              <div className="nt-m-bar-title">
                <h1>{monthLabel}</h1>
                {range && <p>{range}</p>}
              </div>
              <button type="button" className="nt-m-icon" onClick={() => shift(-1)} aria-label="Previous month"><Chevron dir="left" /></button>
              <button type="button" className="nt-m-icon" onClick={() => shift(1)} disabled={isCurrentMonth} aria-label="Next month"><Chevron dir="right" /></button>
            </header>

            <div className="nt-m-body">
              <NextPrayerCard />

              <section className="nt-card nt-ask">
                <h2>How is your namaz going?</h2>
                <p>Tap a day on the calendar to mark its five prayers.</p>
                <button type="button" className="nt-primary" onClick={() => { goToday(); setMobileView('today'); }}>
                  Mark today’s prayers
                </button>
              </section>

              <section className="nt-card nt-m-cal" aria-label="Calendar">
                <div className="nt-m-grid">
                  {WD.map((w, i) => <span key={i} className="nt-wd">{w[0]}</span>)}
                  {days.map(({ date, key, entry, n, future }, i) => (
                    <button
                      key={key}
                      type="button"
                      className={['nt-m-day', key === todayKey && 'is-today', future && 'is-future', !future && perfect(key) && 'is-perfect'].filter(Boolean).join(' ')}
                      style={i === 0 ? { gridColumnStart: firstDow + 1 } : undefined}
                      disabled={future}
                      aria-label={`${WD_LONG[date.getDay()]} ${date.getDate()} ${monthName}${future ? '' : `, ${n} of 5 prayed`}`}
                      onClick={() => { setSelected(key); setMobileView('today'); }}
                    >
                      <b>{date.getDate()}</b>
                      <Dots day={future ? undefined : entry} empty={future} />
                    </button>
                  ))}
                </div>
                <ul className="nt-legend nt-legend-sm" aria-label="Legend">
                  {LEGEND.filter(l => l.code !== 'none').map(l => (
                    <li key={l.code}><i className={`nt-dot c-${l.code}`} />{l.code === 'J' ? 'Jamaat' : l.label}</li>
                  ))}
                </ul>
              </section>

              <div className="nt-m-stats">
                <div><b className="nt-brand">{pct}</b><span>Completed</span></div>
                <div><b>{streak}</b><span>Day streak</span></div>
                <div><b>{jamaat}</b><span>In jamaat</span></div>
              </div>

              {monthSummary}

              <InsightsButton onClick={() => setInsightsOpen(true)} />

              <section className="nt-card nt-qaza" aria-labelledby="nt-mqaza-title">
                <div className="nt-qaza-head">
                  <h2 id="nt-mqaza-title">Qaza to make up</h2>
                  <span>{qazaList.length} pending</span>
                </div>
                {qazaList.length === 0
                  ? <p className="nt-sub">No missed prayers. May Allah accept your salah.</p>
                  : <ul className="nt-qlist">{qazaItems}{qazaMore}</ul>}
              </section>
            </div>
          </>
        )}
      </div>

      <NamazInsights
        log={log}
        today={today}
        open={insightsOpen}
        onClose={closeInsights}
        onMarkToday={() => { goToday(); setMobileView('today'); }}
      />
    </main>
  );
}
