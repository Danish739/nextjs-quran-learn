'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './LearnSteps.css';

/* ── Animated illustrations (original inline SVGs) ──
   All motion lives in LearnSteps.css and only runs once the section is in view (.ls-in). */

function ReadArt() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <defs>
        <radialGradient id="ls-r-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#ffe8a8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffe8a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-r-page" x1="0" x2="1">
          <stop offset="0%" stopColor="#fff9ea" />
          <stop offset="100%" stopColor="#f3e6c4" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="92" r="78" className="ls-art-bg" />

      {/* Light rays behind the book */}
      <g className="ls-r-rays">
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x="98" y="6" width="4" height="40" rx="2" fill="#f5c55a" opacity="0.35" transform={`rotate(${i * 30} 100 86)`} />
        ))}
      </g>
      <circle cx="100" cy="86" r="62" fill="url(#ls-r-glow)" className="ls-r-halo" />

      {/* Rehal (book stand) */}
      <path d="M50 156 L100 116 L150 156" stroke="#8b5a2b" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M58 156 L142 156" stroke="#6d4520" strokeWidth="6" strokeLinecap="round" />

      {/* Book — gently floats */}
      <g className="ls-r-book">
        <path d="M100 60 C82 50 58 50 40 56 L40 124 C58 118 82 118 100 128 Z" fill="url(#ls-r-page)" stroke="#0f766e" strokeWidth="3" />
        <path d="M100 60 C118 50 142 50 160 56 L160 124 C142 118 118 118 100 128 Z" fill="url(#ls-r-page)" stroke="#0f766e" strokeWidth="3" />

        {/* Text lines write themselves in */}
        {[70, 82, 94, 106].map((y, i) => (
          <g key={y}>
            <path d={`M90 ${y} Q70 ${y - 3} 50 ${y}`} className="ls-r-line" style={{ animationDelay: `${0.3 + i * 0.35}s` }} />
            <path d={`M150 ${y} Q130 ${y - 3} 110 ${y}`} className="ls-r-line" style={{ animationDelay: `${0.45 + i * 0.35}s` }} />
          </g>
        ))}

        {/* Turning page (folds over the spine) */}
        <path d="M100 60 C118 50 142 50 160 56 L160 124 C142 118 118 118 100 128 Z" fill="#fffdf6" stroke="#0f766e" strokeWidth="2" className="ls-r-flip" />
        <path d="M100 60 L100 128" stroke="#0f766e" strokeWidth="3" />
      </g>

      {/* Magnifier glides across the lines */}
      <g className="ls-r-mag">
        <circle cx="150" cy="62" r="18" fill="rgba(255,255,255,0.55)" stroke="#e7a83d" strokeWidth="5" />
        <path d="M163 75 L178 90" stroke="#e7a83d" strokeWidth="7" strokeLinecap="round" />
        <path d="M141 56 Q148 50 156 54" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>

      {/* Twinkling sparkles */}
      {[
        [34, 40, 1],
        [168, 30, 0.7],
        [24, 110, 0.6],
        [176, 128, 0.8],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path
            d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z"
            fill="#e7c27d"
            className="ls-twinkle"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
        </g>
      ))}
    </svg>
  );
}

function ListenArt() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <defs>
        <linearGradient id="ls-l-band" x1="0" x2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="ls-l-cup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="92" r="78" className="ls-art-bg" />

      {/* Expanding sound ripples */}
      {[0, 1, 2].map(i => (
        <circle key={i} cx="100" cy="108" r="30" fill="none" stroke="#0ea5e9" strokeWidth="2.5" className="ls-l-ripple" style={{ animationDelay: `${i * 0.8}s` }} />
      ))}

      {/* Spinning disc */}
      <g className="ls-l-disc">
        <circle cx="100" cy="108" r="30" fill="#1f2937" />
        <circle cx="100" cy="108" r="24" fill="none" stroke="#374151" strokeWidth="1.5" />
        <circle cx="100" cy="108" r="18" fill="none" stroke="#374151" strokeWidth="1.5" />
        <path d="M100 78 A30 30 0 0 1 128 98" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
        <circle cx="100" cy="108" r="11" fill="#e7a83d" />
        <circle cx="100" cy="108" r="3" fill="#1f2937" />
      </g>

      {/* Headphones — bob to the beat */}
      <g className="ls-l-phones">
        <path d="M56 106 L56 92 C56 60 77 40 100 40 C123 40 144 60 144 92 L144 106" stroke="url(#ls-l-band)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <rect x="42" y="94" width="26" height="42" rx="11" fill="url(#ls-l-cup)" />
        <rect x="132" y="94" width="26" height="42" rx="11" fill="url(#ls-l-cup)" />
        <rect x="47" y="102" width="6" height="26" rx="3" fill="#5eead4" opacity="0.6" />
        <rect x="147" y="102" width="6" height="26" rx="3" fill="#5eead4" opacity="0.6" />
      </g>

      {/* Equalizer bars */}
      <g transform="translate(70 162)">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <rect key={i} x={i * 9} y="-22" width="6" height="22" rx="3" fill={i % 2 ? '#a855f7' : '#0ea5e9'} className="ls-l-eq" style={{ animationDelay: `${(i * 0.13) % 0.7}s` }} />
        ))}
      </g>

      {/* Rising notes */}
      {[
        [158, '#a855f7', 0],
        [34, '#e7a83d', 1.2],
        [170, '#0ea5e9', 2.1],
      ].map(([x, c, d], i) => (
        <g key={i} className="ls-l-note" style={{ animationDelay: `${d}s` }}>
          <g transform={`translate(${x} 70)`}>
            <path d="M0 0 L0 -16 L11 -19 L11 -3" stroke={c as string} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="-3" cy="1" r="4.5" fill={c as string} />
            <circle cx="8" cy="-2" r="4.5" fill={c as string} />
          </g>
        </g>
      ))}
    </svg>
  );
}

function MemorizeArt() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <defs>
        <linearGradient id="ls-m-ring" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <radialGradient id="ls-m-fire" cx="50%" cy="85%" r="75%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="ls-m-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
        <filter id="ls-m-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.18" />
        </filter>
      </defs>

      <circle cx="100" cy="90" r="80" className="ls-art-bg" />

      {/* Ring: track + animated progress, starting at 12 o'clock */}
      <g transform="rotate(-90 100 66)">
        <circle cx="100" cy="66" r="44" stroke="rgba(148,163,184,0.25)" strokeWidth="9" fill="none" />
        <circle cx="100" cy="66" r="44" stroke="url(#ls-m-ring)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray="276.5" className="ls-m-ring" />
      </g>

      {/* Inner disc + glow */}
      <circle cx="100" cy="66" r="35" fill="#fff" filter="url(#ls-m-shadow)" />
      <circle cx="100" cy="66" r="32" fill="url(#ls-m-glow)" className="ls-m-glow" />

      {/* Flame */}
      <g className="ls-m-flame">
        <path d="M100 42 C113 56 117 66 113 77 C109 87 91 87 87 77 C84 68 91 63 93 55 C97 61 100 61 100 42 Z" fill="url(#ls-m-fire)" />
        <path d="M100 60 C106 68 106 74 103 78 C101 81 99 81 97 78 C95 74 97 69 100 60 Z" fill="#fef9c3" className="ls-m-core" />
      </g>

      {/* Embers rising from the flame */}
      {[0, 1, 2].map(i => (
        <circle key={i} cx={95 + i * 5} cy="46" r="1.6" fill="#fb923c" className="ls-m-ember" style={{ animationDelay: `${i * 0.6}s` }} />
      ))}

      {/* Streak pill */}
      <g filter="url(#ls-m-shadow)">
        <rect x="58" y="103" width="84" height="20" rx="10" fill="#f97316" />
      </g>
      <text x="100" y="116.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff" letterSpacing="0.4">5 DAY STREAK</text>

      {/* Week card */}
      <g filter="url(#ls-m-shadow)">
        <rect x="30" y="130" width="140" height="38" rx="10" fill="#fff" />
      </g>
      {days.map((d, i) => {
        const x = 39 + i * 18.5;
        const done = i < 5;
        return (
          <g key={i}>
            <rect x={x} y="137" width="14" height="14" rx="4" fill="#e2e8f0" />
            {done && (
              <g className="ls-m-tick" style={{ animationDelay: `${0.4 + i * 0.2}s` }}>
                <rect x={x} y="137" width="14" height="14" rx="4" fill="#16a34a" />
                <path d={`M${x + 3.5} ${144} l2.6 2.6 l4.4 -5`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            <text x={x + 7} y="162" textAnchor="middle" fontSize="7" fontWeight="700" fill={done ? '#16a34a' : '#94a3b8'}>{d}</text>
          </g>
        );
      })}

      {/* Medal hanging at top-right */}
      <g className="ls-m-medal">
        <path d="M166 2 L164 22 L172 26 L180 22 L178 2" fill="#0ea5e9" />
        <path d="M172 2 L172 26" stroke="#0284c7" strokeWidth="2" />
        <circle cx="172" cy="34" r="11" fill="#e7c27d" stroke="#b8862f" strokeWidth="2.5" />
        <path d="M172 27.8 l2 4 l4.4 0.6 l-3.2 3 l0.8 4.3 l-4 -2.2 l-4 2.2 l0.8 -4.3 l-3.2 -3 l4.4 -0.6 Z" fill="#fff" />
      </g>

      {/* Sparkles */}
      {[
        [38, 44, 0.9],
        [30, 100, 0.6],
        [168, 92, 0.7],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z" fill="#e7c27d" className="ls-twinkle" style={{ animationDelay: `${i * 0.6}s` }} />
        </g>
      ))}
    </svg>
  );
}

const STEPS = [
  {
    title: 'Choose a Surah',
    Art: ReadArt,
    body: (
      <>
        Browse all <Link href="/read-quran/1">114 Surahs</Link> with translation, open the{' '}
        <Link href="/quran-pages">Mushaf page by page</Link>, or learn every Arabic word with{' '}
        <Link href="/read-quran/1?mode=word-by-word">Word by Word</Link>.
      </>
    ),
    cta: { label: 'Start reading', href: '/read-quran/1' },
  },
  {
    title: 'Listen & Understand',
    Art: ListenArt,
    body: (
      <>
        Follow along with <Link href="/quran-player">world-class reciters</Link>, perfect your
        pronunciation with <Link href="/tajweed">Tajweed</Link>, and read the meaning in{' '}
        <Link href="/tafseer">Tafseer</Link>.
      </>
    ),
    cta: { label: 'Listen now', href: '/quran-player' },
  },
  {
    title: 'Memorize & Track',
    Art: MemorizeArt,
    body: (
      <>
        Build a daily habit with the <Link href="/memorize-quran">Hifz program</Link>. Spaced
        repetition helps you remember, and your streak keeps you going — no extra apps needed.
      </>
    ),
    cta: { label: 'Begin Hifz', href: '/memorize-quran' },
  },
];

export default function LearnSteps() {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  // Start the animations the first time the section scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={`ls${inView ? ' ls-in' : ''}`} aria-labelledby="ls-title">
      <p className="ls-kicker">ابدأ رحلتك</p>
      <h2 id="ls-title" className="ls-title">3 steps to learn Quran online</h2>
      <p className="ls-sub">Everything you need in one place — free, in your browser, at your own pace.</p>

      <ol className="ls-grid">
        {STEPS.map(({ title, Art, body, cta }, i) => (
          <li key={title} className="ls-step" style={{ ['--i' as string]: i }}>
            <span className="ls-num">{i + 1}</span>
            <h3>{title}</h3>
            <div className="ls-art"><Art /></div>
            <p>{body}</p>
            <Link href={cta.href} className="ls-cta">
              {cta.label}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
