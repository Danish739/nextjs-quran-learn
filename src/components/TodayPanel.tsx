'use client';
import { useState } from 'react';
import Link from 'next/link';
import './TodayPanel.css';

interface Surah {
  num: number;
  ar: string;
  name: string;
  meaning?: string;
  v: number;
  t?: string;
}

interface Ayah {
  ar: string;
  en: string;
  ref: string;
  href: string;
}

interface Props {
  recent: Surah[];
  sessionTime: number;
  totalTime: number;
  streak: number;
  weekly: number[];
  ayah: Ayah;
  formatTime: (secs: number) => string;
  onResetTime: () => void;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAILY_GOAL_SECS = 15 * 60;
const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

export default function TodayPanel({ recent, sessionTime, totalTime, streak, weekly, ayah, formatTime, onResetTime }: Props) {
  const [copied, setCopied] = useState(false);
  const last = recent[0];
  const more = recent.slice(1, 4);
  const today = new Date().getDay();
  const max = Math.max(...weekly, 1);
  const goalPct = Math.min(sessionTime / DAILY_GOAL_SECS, 1);
  const goalLeft = Math.max(Math.ceil((DAILY_GOAL_SECS - sessionTime) / 60), 0);

  const copyAyah = async () => {
    try {
      await navigator.clipboard.writeText(`${ayah.ar}\n\n${ayah.en}\n— ${ayah.ref}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <section className="tp" aria-label="Your day">
      {/* ── Continue reading ── */}
      <article className="tp-card tp-continue">
        <div className="tp-glow" aria-hidden="true" />

        <header className="tp-head">
          <span className="tp-label">
            <span className="tp-dot" />
            {last ? 'Continue reading' : 'Start your journey'}
          </span>
          <span className="tp-num-tag">Surah {last?.num ?? 1}</span>
        </header>

        <div className="tp-title-row">
          <div>
            <h3>{last?.name ?? 'Al-Fatihah'}</h3>
            <p>{last?.meaning ?? 'The Opening'}</p>
          </div>
          <span className="tp-ar font-arabic" lang="ar">{last?.ar ?? 'الفاتحة'}</span>
        </div>

        <div className="tp-meta">
          <span><span className="material-symbols-outlined">format_list_numbered</span>{last?.v ?? 7} verses</span>
          <span><span className="material-symbols-outlined">location_on</span>{last?.t ?? 'Meccan'}</span>
          <span><span className="material-symbols-outlined">schedule</span>~{Math.max(1, Math.round((last?.v ?? 7) * 0.3))} min</span>
        </div>

        {!last && (
          <p className="tp-recent-empty">Surahs you open will appear here so you can pick up right where you left off.</p>
        )}

        {more.length > 0 && (
          <div className="tp-recent">
            <span className="tp-recent-label">Recent</span>
            {more.map(s => (
              <Link key={s.num} href={`/read-quran/${s.num}`} className="tp-chip">{s.name}</Link>
            ))}
          </div>
        )}

        <Link href={`/read-quran/${last?.num ?? 1}`} className="tp-btn tp-btn-gold">
          {last ? 'Resume reading' : 'Start reading'}
          <span className="tp-btn-arrow material-symbols-outlined">arrow_forward</span>
        </Link>
      </article>

      {/* ── Progress ── */}
      <article className="tp-card tp-progress">
        <header className="tp-head">
          <span className="tp-label">Today&apos;s goal</span>
          <button className="tp-icon-btn" onClick={onResetTime} title="Reset reading time" aria-label="Reset reading time">
            <span className="material-symbols-outlined">restart_alt</span>
          </button>
        </header>

        <div className="tp-goal">
          <svg className="tp-ring" viewBox="0 0 110 110" aria-hidden="true">
            <defs>
              <linearGradient id="tp-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="var(--brand-primary)" />
              </linearGradient>
            </defs>
            <circle cx="55" cy="55" r={RING_R} className="tp-ring-track" />
            <circle
              cx="55" cy="55" r={RING_R}
              className="tp-ring-fill"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - goalPct)}
              transform="rotate(-90 55 55)"
            />
          </svg>
          <div className="tp-ring-center">
            <b className="tp-tabular">{formatTime(sessionTime)}</b>
            <span>of 15 min</span>
          </div>

          <div className="tp-goal-side">
            <div className="tp-mini">
              <span className="tp-mini-icon tp-mini-fire material-symbols-outlined">local_fire_department</span>
              <div><b>{streak}</b><span>day streak</span></div>
            </div>
            <div className="tp-mini">
              <span className="tp-mini-icon material-symbols-outlined">hourglass_bottom</span>
              <div><b className="tp-tabular">{formatTime(totalTime)}</b><span>all time</span></div>
            </div>
          </div>
        </div>

        <p className="tp-goal-msg">
          {goalPct >= 1 ? 'Goal reached — MashaAllah! 🎉' : `${goalLeft} min to reach today's goal`}
        </p>

        <div className="tp-chart" role="img" aria-label="Reading activity this week">
          {weekly.map((v, i) => (
            <div key={i} className={`tp-bar${i === today ? ' tp-bar-today' : ''}`}>
              <div className="tp-bar-track">
                <div className="tp-bar-fill" style={{ height: `${Math.max((v / max) * 100, 8)}%`, animationDelay: `${i * 0.06}s` }} />
              </div>
              <span>{DAY_LETTERS[i]}</span>
            </div>
          ))}
        </div>
      </article>

      {/* ── Ayah of the day ── */}
      <article className="tp-card tp-ayah">
        {/* Mihrab arch outlines */}
        <svg className="tp-arch" viewBox="0 0 200 260" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
          <path d="M20 260 L20 110 C20 50 100 10 100 10 C100 10 180 50 180 110 L180 260" />
          <path d="M45 260 L45 118 C45 72 100 40 100 40 C100 40 155 72 155 118 L155 260" />
          <path d="M70 260 L70 126 C70 96 100 72 100 72 C100 72 130 96 130 126 L130 260" />
        </svg>
        <span className="tp-quote" aria-hidden="true">&ldquo;</span>

        <header className="tp-head">
          <span className="tp-label">Ayah of the day</span>
          <span className="tp-ref">{ayah.ref}</span>
        </header>

        <p className="tp-ayah-ar font-arabic" dir="rtl" lang="ar">{ayah.ar}</p>
        <p className="tp-ayah-en">{ayah.en}</p>

        <div className="tp-actions">
          <Link href={ayah.href} className="tp-btn tp-btn-white">
            <span className="material-symbols-outlined">menu_book</span>
            Read Surah
          </Link>
          <button className="tp-btn tp-btn-ghost" onClick={copyAyah} aria-label="Copy ayah">
            <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </article>
    </section>
  );
}
