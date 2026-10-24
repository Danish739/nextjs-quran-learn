'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './HeroCarousel.css';

interface Slide {
  kicker: string;
  title: [string, string, string]; // before · italic accent · after
  body: string;
  cta: { label: string; href: string };
  meta: string[];
  ar: string;
  caption: string;
  bg: string;
  bgDeep: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    kicker: 'Learn with purpose',
    title: ['Every great journey begins with ', 'Alif', '.'],
    body: 'From your first Arabic letter to confident recitation. Take your next step, at your own pace.',
    cta: { label: 'Start learning', href: '/learn-quran' },
    meta: ['Beginner friendly', 'Learn at your own pace'],
    ar: 'ا',
    caption: 'Alif · The beginning',
    bg: '#2f3f9e',
    bgDeep: '#222e78',
    accent: '#efe6d2',
  },
  {
    kicker: 'Read every day',
    title: ['Read the words that ', 'changed', ' the world.'],
    body: 'All 114 Surahs with clear translation, beautiful Uthmani script and ayah-by-ayah Tafseer.',
    cta: { label: 'Open the Quran', href: '/read-quran/1' },
    meta: ['114 Surahs', 'Translation & Tafseer'],
    ar: 'اقْرَأْ',
    caption: 'Iqra · Read',
    bg: '#0f5c4a',
    bgDeep: '#0a4437',
    accent: '#f0e3c4',
  },
  {
    kicker: 'Listen & repeat',
    title: ['Let the recitation ', 'settle', ' in your heart.'],
    body: 'Follow world-class reciters ayah by ayah, repeat what you hear, and perfect your Tajweed.',
    cta: { label: 'Start listening', href: '/quran-player' },
    meta: ['Renowned reciters', 'Ayah repeat'],
    ar: 'اسْمَعْ',
    caption: 'Isma‘ · Listen',
    bg: '#5b2d4f',
    bgDeep: '#43203a',
    accent: '#f3dfd2',
  },
  {
    kicker: 'Memorize gently',
    title: ['Hold it close, ', 'one ayah', ' at a time.'],
    body: 'A calm Hifz routine with spaced repetition that remembers what you know and what to revise.',
    cta: { label: 'Begin Hifz', href: '/memorize-quran' },
    meta: ['Spaced repetition', 'Daily streaks'],
    ar: 'احْفَظْ',
    caption: 'Ihfaz · Preserve',
    bg: '#2c3e50',
    bgDeep: '#1f2d3a',
    accent: '#e9dfc9',
  },
  {
    kicker: 'Reflect deeply',
    title: ['Pause, reflect, and ', 'understand', '.'],
    body: 'Discover the meaning behind every ayah through trusted classical commentary.',
    cta: { label: 'Explore Tafseer', href: '/tafseer' },
    meta: ['Classical scholars', 'Ayah by ayah'],
    ar: 'تَدَبَّرْ',
    caption: 'Tadabbur · Reflect',
    bg: '#7a4a1e',
    bgDeep: '#5c3715',
    accent: '#f4e6cc',
  },
];

const AUTOPLAY_MS = 7000;

function greeting(h: number) {
  if (h < 5) return 'A quiet night for reflection';
  if (h < 12) return 'A new day, a new opportunity';
  if (h < 17) return 'A blessed afternoon';
  return 'A peaceful evening';
}

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hello, setHello] = useState('A new day, a new opportunity');
  const dragX = useRef<number | null>(null);

  useEffect(() => setHello(greeting(new Date().getHours())), []);

  const go = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Autoplay — restarts on every slide change, stops while hovered/focused
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, next]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  };

  const s = SLIDES[index];

  return (
    <div className="hc-wrap">
      {/* Greeting */}
      <div className="hc-hello">
        <div>
          <p className="hc-kicker-top">
            <span className="material-symbols-outlined">light_mode</span>
            {hello}
          </p>
          <h1 className="hc-h1">Grow closer, one ayah at a time.</h1>
          <p className="hc-sub">A peaceful space to learn, reflect, and connect with the Quran.</p>
        </div>
        <p className="hc-salam font-arabic" lang="ar" dir="rtl">السَّلَامُ عَلَيْكُمْ</p>
      </div>

      {/* Slider */}
      <section
        className="hc"
        aria-roledescription="carousel"
        aria-label="Featured"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onPointerDown={e => { dragX.current = e.clientX; }}
        onPointerUp={e => {
          if (dragX.current === null) return;
          const dx = e.clientX - dragX.current;
          dragX.current = null;
          if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
        }}
        style={{ ['--bg' as string]: s.bg, ['--bg-deep' as string]: s.bgDeep, ['--accent' as string]: s.accent }}
      >
        {/* Concentric rings */}
        <div className="hc-rings" aria-hidden="true">
          <span /><span /><span /><span />
        </div>

        <span className="hc-vertical" aria-hidden="true">The journey within</span>

        <div key={index} className="hc-slide" aria-live="polite">
          <div className="hc-copy">
            <p className="hc-kicker">{s.kicker}</p>
            <h2 className="hc-title">
              {s.title[0]}<em>{s.title[1]}</em>{s.title[2]}
            </h2>
            <p className="hc-body">{s.body}</p>
            <Link href={s.cta.href} className="hc-cta">
              {s.cta.label}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <p className="hc-meta">
              {s.meta.map((m, i) => (
                <span key={m}>{i > 0 && <i aria-hidden="true">·</i>}{m}</span>
              ))}
            </p>
          </div>

          <div className="hc-art" aria-hidden="true">
            <div className="hc-arch">
              <span className="hc-letter font-arabic">{s.ar}</span>
              <span className="hc-caption">{s.caption}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="hc-controls">
          <div className="hc-dots" role="tablist" aria-label="Choose slide">
            {SLIDES.map((sl, i) => (
              <button
                key={sl.kicker}
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}: ${sl.kicker}`}
                className={`hc-dot${i === index ? ' on' : ''}`}
                onClick={() => go(i)}
              >
                {i === index && <span key={`${index}-${paused}`} className={`hc-dot-fill${paused ? ' paused' : ''}`} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
              </button>
            ))}
          </div>
          <div className="hc-arrows">
            <span className="hc-count">{String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span>
            <button className="hc-arrow" onClick={prev} aria-label="Previous slide">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <button className="hc-arrow" onClick={next} aria-label="Next slide">
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
