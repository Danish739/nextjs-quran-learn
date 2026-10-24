'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import './Navbar.css';

/* ─── Nav data ─────────────────────────────────────────────── */
interface NavItem { href: string; label: string; icon: string; desc: string }
interface NavSection { label: string; icon: string; items: NavItem[]; feature: { title: string; text: string; href: string; cta: string } }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Quran',
    icon: 'auto_stories',
    items: [
      { href: '/read-quran/1', label: 'Read Quran', icon: 'menu_book', desc: 'All 114 Surahs with translation' },
      { href: '/quran-pages', label: 'Mushaf', icon: 'auto_stories', desc: 'Page by page, 604 pages' },
      { href: '/read-quran/1?mode=word-by-word', label: 'Word by Word', icon: 'translate', desc: 'Every word explained' },
      { href: '/tafseer', label: 'Tafseer', icon: 'lightbulb', desc: 'Classical commentary' },
    ],
    feature: { title: 'Start with Al-Fatihah', text: 'The Opening — 7 ayahs that begin every prayer.', href: '/read-quran/1', cta: 'Read now' },
  },
  {
    label: 'Learn',
    icon: 'school',
    items: [
      { href: '/learn-quran', label: 'Learn Quran', icon: 'school', desc: 'Structured lessons from Alif' },
      { href: '/memorize-quran', label: 'Hifz Program', icon: 'psychology', desc: 'Smart spaced repetition' },
      { href: '/tajweed', label: 'Tajweed', icon: 'record_voice_over', desc: 'Rules of recitation' },
    ],
    feature: { title: 'New to Arabic?', text: 'Begin with the letters and build up to fluent recitation.', href: '/learn-quran', cta: 'Begin lessons' },
  },
  {
    label: 'Listen',
    icon: 'headphones',
    items: [
      { href: '/quran-player', label: 'Quran Player', icon: 'play_circle', desc: 'Renowned reciters' },
      { href: '/audio-quran', label: 'Audio Quran', icon: 'headphones', desc: 'Stream full recitations' },
      { href: '/radio', label: 'Quran Radio', icon: 'radio', desc: 'Live channels 24/7' },
    ],
    feature: { title: 'Live right now', text: 'Tune in to continuous Quran recitation from around the world.', href: '/radio', cta: 'Open radio' },
  },
  {
    label: 'Daily',
    icon: 'wb_sunny',
    items: [
      { href: '/dua', label: 'Duas', icon: 'volunteer_activism', desc: 'Supplications for every moment' },
      { href: '/hadees', label: 'Hadith', icon: 'history_edu', desc: "The Prophet's ﷺ sayings" },
    ],
    feature: { title: 'Morning & evening', text: 'Short duas to begin and end your day with remembrance.', href: '/dua', cta: 'View duas' },
  },
];

const ALL_ITEMS: (NavItem & { section: string })[] = [
  { href: '/', label: 'Home', icon: 'home', desc: 'Back to the start', section: 'General' },
  ...NAV_SECTIONS.flatMap(s => s.items.map(i => ({ ...i, section: s.label }))),
  { href: '/login', label: 'Sign in', icon: 'login', desc: 'Sync your progress', section: 'Account' },
];

const baseHref = (href: string) => href.split('?')[0];

function isActive(pathname: string, href: string) {
  const h = baseHref(href);
  if (h === '/') return pathname === '/';
  // '/read-quran/1' should match any '/read-quran/...'
  const root = '/' + h.split('/')[1];
  return pathname === h || pathname.startsWith(root + '/') || pathname === root;
}

/* ─── Component ─────────────────────────────────────────────── */
export default function Navbar() {
  const [open, setOpen] = useState<string | null>(null);      // desktop dropdown
  const [menuOpen, setMenuOpen] = useState(false);              // mobile drawer
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [isMac, setIsMac] = useState(false);

  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const linksRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const fn = () => setScrolled(window.scrollY > 8);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* close everything on route change */
  useEffect(() => {
    setOpen(null);
    setMenuOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  /* body scroll lock for overlays */
  useEffect(() => {
    document.body.style.overflow = menuOpen || paletteOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, paletteOpen]);

  /* ⌘K / Ctrl+K / "/" opens search, Esc closes overlays */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setOpen(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  /* sliding highlight under the hovered link */
  const movePill = (el: HTMLElement | null) => {
    if (!el || !linksRef.current) return setPill(null);
    const parent = linksRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ left: r.left - parent.left, width: r.width });
  };

  const openSection = (label: string, el: HTMLElement) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(label);
    movePill(el);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(null);
      setPill(null);
    }, 140);
  };

  // Name matches rank above description/section matches
  const q = query.trim().toLowerCase();
  const rank = (i: NavItem & { section: string }) => {
    const label = i.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.includes(q)) return 1;
    if (`${i.desc} ${i.section}`.toLowerCase().includes(q)) return 2;
    return -1;
  };
  const results = q
    ? ALL_ITEMS.map(i => ({ i, r: rank(i) })).filter(x => x.r >= 0).sort((a, b) => a.r - b.r).map(x => x.i)
    : ALL_ITEMS;

  const goTo = useCallback((href: string) => {
    setPaletteOpen(false);
    router.push(href);
  }, [router]);

  const dark = resolvedTheme === 'dark';

  return (
    <>
      <nav className={`nv${scrolled ? ' nv--scrolled' : ''}`} data-global-navbar aria-label="Main">
        <div className="nv__inner">
          {/* Logo */}
          <Link href="/" className="nv__logo" aria-label="Learn Quran home">
            <span className="nv__mark" aria-hidden="true">
              <span className="material-symbols-outlined">menu_book</span>
            </span>
            <span className="nv__brand">
              <b>Learn Quran</b>
              <small>A little every day</small>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="nv__links" ref={linksRef} onMouseLeave={scheduleClose}>
            {pill && <span className="nv__pill" style={{ left: pill.left, width: pill.width }} aria-hidden="true" />}

            <Link
              href="/"
              className={`nv__link${pathname === '/' ? ' is-active' : ''}`}
              onMouseEnter={e => { setOpen(null); movePill(e.currentTarget); }}
            >
              Home
            </Link>

            {NAV_SECTIONS.map(section => {
              const active = section.items.some(i => isActive(pathname, i.href));
              const isOpen = open === section.label;
              return (
                <div key={section.label} className="nv__dd" onMouseEnter={e => openSection(section.label, e.currentTarget.firstElementChild as HTMLElement)}>
                  <button
                    className={`nv__link${active ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onClick={e => (isOpen ? setOpen(null) : openSection(section.label, e.currentTarget))}
                    onFocus={e => openSection(section.label, e.currentTarget)}
                  >
                    {section.label}
                    <span className="material-symbols-outlined nv__caret">expand_more</span>
                  </button>

                  {isOpen && (
                    <div className="nv__menu" role="menu" onMouseEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}>
                      <div className="nv__menu-items">
                        {section.items.map((item, i) => (
                          <Link
                            key={item.href + item.label}
                            href={item.href}
                            role="menuitem"
                            className={`nv__item${isActive(pathname, item.href) ? ' is-active' : ''}`}
                            style={{ animationDelay: `${i * 35}ms` }}
                            onClick={() => setOpen(null)}
                          >
                            <span className="nv__item-icon material-symbols-outlined">{item.icon}</span>
                            <span className="nv__item-text">
                              <b>{item.label}</b>
                              <small>{item.desc}</small>
                            </span>
                          </Link>
                        ))}
                      </div>
                      <Link href={section.feature.href} className="nv__feature" onClick={() => setOpen(null)}>
                        <span className="nv__feature-icon material-symbols-outlined">{section.icon}</span>
                        <b>{section.feature.title}</b>
                        <small>{section.feature.text}</small>
                        <span className="nv__feature-cta">
                          {section.feature.cta}
                          <span className="material-symbols-outlined">arrow_forward</span>
                        </span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="nv__actions">
            <button className="nv__search" onClick={() => setPaletteOpen(true)} aria-label="Search">
              <span className="material-symbols-outlined">search</span>
              <span className="nv__search-text">Search</span>
              <kbd className="nv__kbd">{isMac ? '⌘' : 'Ctrl'} K</kbd>
            </button>

            <button className="nv__icon" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
              <span key={resolvedTheme} className="material-symbols-outlined nv__theme-icon">{dark ? 'light_mode' : 'dark_mode'}</span>
            </button>

            <span className="nv__sep" aria-hidden="true" />

            <Link href="/login" className="nv__signin">Sign in</Link>
            <Link href="/signup" className="nv__cta">
              Get started
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>

            <button className={`nv__icon nv__burger${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(v => !v)} aria-label="Menu" aria-expanded={menuOpen}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer ───────────────────────────────────── */}
      {menuOpen && (
        <div className="nv-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="nv-drawer__backdrop" onClick={() => setMenuOpen(false)} />
          <div className="nv-drawer__panel">
            <div className="nv-drawer__top">
              <Link href="/" className={`nv-drawer__home${pathname === '/' ? ' is-active' : ''}`} onClick={() => setMenuOpen(false)}>
                <span className="material-symbols-outlined">home</span>
                Home
              </Link>
              <button className="nv-drawer__search" onClick={() => { setMenuOpen(false); setPaletteOpen(true); }}>
                <span className="material-symbols-outlined">search</span>
                Search
              </button>
            </div>

            <div className="nv-drawer__body">
              {NAV_SECTIONS.map((section, si) => (
                <div key={section.label} className="nv-drawer__section" style={{ animationDelay: `${si * 50}ms` }}>
                  <p className="nv-drawer__label">
                    <span className="material-symbols-outlined">{section.icon}</span>
                    {section.label}
                  </p>
                  <div className="nv-drawer__grid">
                    {section.items.map(item => (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className={`nv-drawer__item${isActive(pathname, item.href) ? ' is-active' : ''}`}
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <b>{item.label}</b>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="nv-drawer__foot">
              <Link href="/login" className="nv-drawer__ghost" onClick={() => setMenuOpen(false)}>Sign in</Link>
              <Link href="/signup" className="nv-drawer__primary" onClick={() => setMenuOpen(false)}>Get started</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Search palette ──────────────────────────────────── */}
      {paletteOpen && (
        <div className="nv-pal" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={e => { if (e.target === e.currentTarget) setPaletteOpen(false); }}>
          <div className="nv-pal__box">
            <div className="nv-pal__input">
              <span className="material-symbols-outlined">search</span>
              <input
                ref={inputRef}
                value={query}
                placeholder="Where would you like to go?"
                onChange={e => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
                  if (e.key === 'Enter' && results[cursor]) goTo(results[cursor].href);
                }}
                aria-activedescendant={results[cursor] ? `nv-r-${cursor}` : undefined}
              />
              <kbd className="nv__kbd">Esc</kbd>
            </div>
            <ul className="nv-pal__list" role="listbox">
              {results.length === 0 && <li className="nv-pal__empty">No pages match “{query}”</li>}
              {results.map((r, i) => (
                <li key={r.href + r.label} id={`nv-r-${i}`} role="option" aria-selected={i === cursor}>
                  <button
                    className={`nv-pal__row${i === cursor ? ' is-cursor' : ''}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => goTo(r.href)}
                  >
                    <span className="nv-pal__icon material-symbols-outlined">{r.icon}</span>
                    <span className="nv-pal__text">
                      <b>{r.label}</b>
                      <small>{r.desc}</small>
                    </span>
                    <span className="nv-pal__section">{r.section}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="nv-pal__foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>/</kbd> search anywhere</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
