'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './QuickAccessWidget.css';

const TILES = [
  { icon: 'menu_book', label: 'Read', href: '/read-quran/1', color: '#10b981' },
  { icon: 'auto_stories', label: 'Mushaf', href: '/quran-pages', color: '#f59e0b' },
  { icon: 'headphones', label: 'Listen', href: '/quran-player', color: '#3b82f6' },
  { icon: 'psychology', label: 'Hifz', href: '/memorize-quran', color: '#a855f7' },
  { icon: 'translate', label: 'Words', href: '/read-quran/1?mode=word-by-word', color: '#06b6d4' },
  { icon: 'lightbulb', label: 'Tafseer', href: '/tafseer', color: '#8b5cf6' },
  { icon: 'school', label: 'Learn', href: '/learn-quran', color: '#0d9488' },
  { icon: 'record_voice_over', label: 'Tajweed', href: '/tajweed', color: '#14b8a6' },
  { icon: 'volunteer_activism', label: 'Duas', href: '/dua', color: '#ec4899' },
  { icon: 'history_edu', label: 'Hadith', href: '/hadees', color: '#eab308' },
  { icon: 'radio', label: 'Radio', href: '/radio', color: '#ef4444' },
  { icon: 'event_available', label: 'Namaz', href: '/namaz-tracker', color: '#10b981' },
  { icon: 'home', label: 'Home', href: '/', color: '#64748b' },
];

/** The floating button belongs to the home page only; everywhere else it would cover content. */
const SHOW_ON = '/';

export default function QuickAccessWidget() {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (pathname !== SHOW_ON) return null;

  return (
    <div ref={rootRef}>
      {open && (
        <div className="qa-panel" role="dialog" aria-label="Quick access">
          <div className="qa-head">
            <span className="material-symbols-outlined">auto_stories</span>
            <div className="qa-head-title">
              Quick access
              <span className="qa-head-sub">Assalamu Alaikum — where to?</span>
            </div>
            <button className="qa-close" onClick={() => setOpen(false)} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="qa-grid">
            {TILES.map((t, i) => {
              const base = t.href.split('?')[0];
              const active = base === '/' ? pathname === '/' : pathname.startsWith('/' + base.split('/')[1]);
              return (
                <Link
                  key={t.label}
                  href={t.href}
                  className={`qa-tile${active ? ' is-active' : ''}`}
                  style={{ ['--tile' as string]: t.color, animationDelay: `${i * 20}ms` }}
                >
                  <span className="qa-icon">
                    <span className="material-symbols-outlined">{t.icon}</span>
                  </span>
                  <span className="qa-label">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <button className="qa-fab" onClick={() => setOpen(o => !o)} aria-label={open ? 'Close quick access' : 'Open quick access'} aria-expanded={open}>
        <span className="material-symbols-outlined">{open ? 'close' : 'apps'}</span>
        {!open && <span className="qa-fab-dot" />}
      </button>
    </div>
  );
}
