'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './QuickAccessGrid.css';

interface Tile {
  key: string;
  label: string;
  sub: string;
  ar: string;
  icon: string;
  href?: string;
  action?: 'navigate';
  from: string;
  to: string;
  badge?: string;
  /** full-width featured tile with language chips */
  wide?: boolean;
  chips?: string[];
  /** per-tile icon animation */
  anim: 'flip' | 'spin' | 'pulse' | 'wave' | 'swap' | 'float' | 'tilt' | 'raise';
}

const TILES: Tile[] = [
  { key: 'read', label: 'Read Quran', sub: '114 Surahs', ar: 'اقرأ', icon: 'menu_book', href: '/read-quran/1', from: '#10b981', to: '#047857', anim: 'flip' },
  { key: 'mushaf', label: 'Mushaf', sub: '604 Pages', ar: 'مصحف', icon: 'auto_stories', href: '/quran-pages', from: '#f59e0b', to: '#b45309', anim: 'tilt' },
  { key: 'nav', label: 'Navigate', sub: 'Surah · Page', ar: 'تصفح', icon: 'explore', action: 'navigate', from: '#38bdf8', to: '#0369a1', anim: 'spin' },
  { key: 'hifz', label: 'Memorize', sub: 'Hifz Program', ar: 'حفظ', icon: 'psychology', href: '/memorize-quran', from: '#c084fc', to: '#7e22ce', anim: 'pulse' },
  { key: 'radio', label: 'Quran Radio', sub: '24/7 Recitation', ar: 'إذاعة', icon: 'radio', href: '/radio', from: '#f87171', to: '#b91c1c', badge: 'LIVE', anim: 'wave' },
  { key: 'wbw', label: 'Word by Word', sub: 'Arabic Learning', ar: 'كلمة', icon: 'translate', href: '/read-quran/1?mode=word-by-word', from: '#22d3ee', to: '#0e7490', anim: 'swap' },
  { key: 'tafseer', label: 'Tafseer', sub: 'Ayah Explanations', ar: 'تفسير', icon: 'local_library', href: '/tafseer', from: '#a78bfa', to: '#5b21b6', anim: 'float' },
  { key: 'dua', label: 'Duas', sub: 'Daily Supplications', ar: 'دعاء', icon: 'volunteer_activism', href: '/dua', from: '#f472b6', to: '#be185d', anim: 'raise' },
  { key: 'tra', label: 'Translation Audio', sub: 'Hear the Quran ayah by ayah in your language', ar: 'ترجمة', icon: 'record_voice_over', href: '/translation-audio', from: '#2dd4bf', to: '#0f766e', anim: 'pulse', wide: true, chips: ['English', 'اردو', 'فارسی', 'Azərbaycanca', 'Bosanski'] },
];

/** Tracks the cursor for the 3D tilt + spotlight, without re-rendering React */
function onMove(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty('--mx', `${x * 100}%`);
  el.style.setProperty('--my', `${y * 100}%`);
  el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`);
  el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
}

function onLeave(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.setProperty('--ry', '0deg');
  el.style.setProperty('--rx', '0deg');
}

function TileInner({ t }: { t: Tile }) {
  return (
    <>
      <span className="qg-spot" aria-hidden="true" />
      <span className="qg-shine" aria-hidden="true" />
      <span className="qg-ar font-arabic" aria-hidden="true">{t.ar}</span>

      <div className="qg-top">
        <span className={`qg-icon qg-anim-${t.anim}`}>
          <span className="material-symbols-outlined">{t.icon}</span>
          {t.anim === 'wave' && (
            <span className="qg-eq" aria-hidden="true"><i /><i /><i /></span>
          )}
        </span>
        {t.badge ? (
          <span className="qg-badge"><span className="qg-live" />{t.badge}</span>
        ) : (
          <span className="qg-arrow material-symbols-outlined" aria-hidden="true">arrow_outward</span>
        )}
      </div>

      <div className="qg-text">
        <b>{t.label}</b>
        <span>{t.sub}</span>
      </div>
      {t.chips && (
        <div className="qg-chips" aria-hidden="true">
          {t.chips.map(c => <i key={c} className={/[؀-ۿ]/.test(c) ? 'font-arabic' : undefined}>{c}</i>)}
        </div>
      )}
    </>
  );
}

export default function QuickAccessGrid({ onNavigate }: { onNavigate: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

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
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={`qg${inView ? ' qg-in' : ''}`} aria-labelledby="qg-title">
      <div className="qg-header">
        <div>
          <p className="qg-kicker font-arabic">وصول سريع</p>
          <h2 id="qg-title">Quick Access</h2>
        </div>
        <p className="qg-hint">Jump straight into any part of your Quran journey</p>
      </div>

      <div className="qg-grid">
        {TILES.map((t, i) => {
          const style = {
            ['--from' as string]: t.from,
            ['--to' as string]: t.to,
            ['--i' as string]: i,
          };
          const common = {
            className: `qg-tile qg-${t.key}${t.wide ? ' qg-wide' : ''}`,
            style,
            onPointerMove: onMove,
            onPointerLeave: onLeave,
          };
          return t.action === 'navigate' ? (
            <button key={t.key} type="button" {...common} onClick={onNavigate} aria-label={`${t.label} — ${t.sub}`}>
              <TileInner t={t} />
            </button>
          ) : (
            <Link key={t.key} href={t.href!} {...common} aria-label={`${t.label} — ${t.sub}`}>
              <TileInner t={t} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
