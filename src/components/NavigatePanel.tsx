'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import './NavigatePanel.css';

export interface NavSurah {
  num: number;
  ar: string;
  name: string;
  meaning: string;
  v: number;
  t: string;
}

type Tab = 'surah' | 'page';
type Filter = 'All' | 'Meccan' | 'Medinan';

/** Madani Mushaf pages where a few well-known surahs begin */
const PAGE_SHORTCUTS = [
  { label: 'Al-Fatihah', page: 1 },
  { label: 'Al-Kahf', page: 293 },
  { label: 'Ya-Sin', page: 440 },
  { label: 'Ar-Rahman', page: 531 },
  { label: 'Al-Mulk', page: 562 },
  { label: 'Juz Amma', page: 582 },
];

/** Slide-in "Navigate Quran" panel: jump to any surah or Mushaf page. */
export default function NavigatePanel({
  surahs,
  onClose,
  onVisit,
}: {
  surahs: NavSurah[];
  onClose: () => void;
  onVisit: (s: NavSurah) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('surah');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [pageInput, setPageInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [tab, query, filter]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return surahs.filter(s => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.meaning.toLowerCase().includes(q) || s.ar.includes(query.trim()) || String(s.num) === q;
      return matchQ && (filter === 'All' || s.t === filter);
    });
  }, [surahs, query, filter]);

  const pageNo = Number(pageInput);
  const pageValid = Number.isInteger(pageNo) && pageNo >= 1 && pageNo <= 604;

  const goPage = (n: number) => {
    onClose();
    router.push(`/page/${n}`);
  };

  return (
    <div className="nvp" role="dialog" aria-modal="true" aria-label="Navigate Quran">
      <div className="nvp-backdrop" onClick={onClose} />
      <aside className="nvp-panel">
        <header className="nvp-head">
          <div className="nvp-title">
            <span className="nvp-kicker font-arabic" lang="ar">تصفّح</span>
            <h2>Navigate Quran</h2>
          </div>
          <button className="nvp-close" onClick={onClose} aria-label="Close"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="nvp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'surah'} className={tab === 'surah' ? 'on' : ''} onClick={() => setTab('surah')}>
            <span className="material-symbols-outlined">menu_book</span>Surah <small>114</small>
          </button>
          <button role="tab" aria-selected={tab === 'page'} className={tab === 'page' ? 'on' : ''} onClick={() => setTab('page')}>
            <span className="material-symbols-outlined">auto_stories</span>Page <small>604</small>
          </button>
        </div>

        {tab === 'surah' ? (
          <>
            <div className="nvp-tools">
              <label className="nvp-search">
                <span className="material-symbols-outlined">search</span>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, meaning or number" aria-label="Search surahs" autoFocus />
                {query && <button onClick={() => setQuery('')} aria-label="Clear search"><span className="material-symbols-outlined">close</span></button>}
              </label>
              <div className="nvp-chips" role="tablist" aria-label="Filter by place of revelation">
                {(['All', 'Meccan', 'Medinan'] as const).map(f => (
                  <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
            </div>

            <div className="nvp-list" ref={listRef}>
              {list.length === 0 ? (
                <div className="nvp-empty">
                  <span className="material-symbols-outlined">search_off</span>
                  <p>No surahs found</p>
                </div>
              ) : list.map(s => (
                <Link key={s.num} href={`/read-quran/${s.num}?mode=reading`} className="nvp-row" onClick={() => { onVisit(s); onClose(); }}>
                  <span className="nvp-num"><b>{s.num}</b></span>
                  <span className="nvp-info">
                    <span className="nvp-name">{s.name}</span>
                    <span className="nvp-meta">
                      <span className={`nvp-type ${s.t === 'Meccan' ? 'meccan' : 'medinan'}`}>{s.t}</span>
                      {s.meaning} · {s.v} ayahs
                    </span>
                  </span>
                  <span className="nvp-ar font-arabic" lang="ar" dir="rtl">{s.ar}</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="nvp-list nvp-pages" ref={listRef}>
            <form className="nvp-goto" onSubmit={e => { e.preventDefault(); if (pageValid) goPage(pageNo); }}>
              <label htmlFor="nvp-page">Go to page</label>
              <div>
                <input id="nvp-page" type="number" inputMode="numeric" min={1} max={604} value={pageInput} onChange={e => setPageInput(e.target.value)} placeholder="1 – 604" aria-invalid={!!pageInput && !pageValid} />
                <button type="submit" disabled={!pageValid}>Go</button>
              </div>
            </form>

            <p className="nvp-label">Quick jumps</p>
            <div className="nvp-shortcuts">
              {PAGE_SHORTCUTS.map(s => (
                <Link key={s.page} href={`/page/${s.page}`} onClick={onClose}>{s.label}<small>p. {s.page}</small></Link>
              ))}
            </div>

            <p className="nvp-label">All pages</p>
            <div className="nvp-grid">
              {Array.from({ length: 604 }, (_, i) => i + 1).map(n => (
                <Link key={n} href={`/page/${n}`} onClick={onClose}>{n}</Link>
              ))}
            </div>
          </div>
        )}

        <footer className="nvp-foot">
          <span>{tab === 'surah' ? `${list.length} of ${surahs.length} surahs` : '604 pages · Madani Mushaf'}</span>
          <span>Esc to close</span>
        </footer>
      </aside>
    </div>
  );
}
