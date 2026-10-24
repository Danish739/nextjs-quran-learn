'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import './SurahExplorer.css';

export interface PageChapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  /** [first page, last page] in the Madani Mushaf */
  pages: number[];
}

interface PageInfo {
  n: number;
  /** surahs on this page, in order */
  surahs: PageChapter[];
  /** a surah begins on this page */
  starts: boolean;
}

const POPULAR_PAGES = [1, 2, 293, 440, 562, 582];
const FIRST = 12;
const STEP = 48;

/** Browse the 604 Mushaf pages with the same cards, search and layout as "Explore Surahs". */
export default function PageExplorer({ chapters, loading }: { chapters: PageChapter[]; loading: boolean }) {
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<'All' | 'Starts'>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [limit, setLimit] = useState(FIRST);

  const pages = useMemo<PageInfo[]>(() => {
    return Array.from({ length: 604 }, (_, i) => {
      const n = i + 1;
      const surahs = chapters.filter(c => c.pages?.[0] <= n && n <= c.pages?.[1]);
      return { n, surahs, starts: surahs.some(c => c.pages[0] === n) };
    });
  }, [chapters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter(p => {
      const matchQ = !q || String(p.n) === q || p.surahs.some(s => s.name_simple.toLowerCase().includes(q) || s.name_arabic.includes(query.trim()));
      return matchQ && (only === 'All' || p.starts);
    });
  }, [pages, query, only]);

  const searching = query.trim() !== '' || only !== 'All';
  const shown = searching ? filtered.slice(0, Math.max(limit, 96)) : filtered.slice(0, limit);
  const more = filtered.length - shown.length;

  const primary = (p: PageInfo) => p.surahs.find(s => s.pages[0] === p.n) ?? p.surahs[0];

  return (
    <section className="sx" aria-labelledby="px-title">
      <div className="sx-head">
        <div>
          <p className="sx-kicker font-arabic">صفحات المصحف</p>
          <h2 id="px-title">Explore Pages</h2>
          <p className="sx-count">{filtered.length} of 604 pages</p>
        </div>

        <div className="sx-tools">
          <label className="sx-search">
            <span className="material-symbols-outlined">search</span>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setLimit(FIRST); }}
              placeholder="Page number or surah"
              aria-label="Search pages"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search">
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </label>

          <div className="sx-seg" role="tablist" aria-label="Pages">
            {([['All', 'All pages'], ['Starts', 'Surah starts']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={only === id} className={only === id ? 'on' : ''} onClick={() => { setOnly(id); setLimit(FIRST); }}>
                {label}
              </button>
            ))}
          </div>

          <div className="sx-seg sx-seg-icons" role="tablist" aria-label="Layout">
            {(['grid', 'list'] as const).map(m => (
              <button key={m} role="tab" aria-selected={view === m} aria-label={`${m} view`} className={view === m ? 'on' : ''} onClick={() => setView(m)}>
                <span className="material-symbols-outlined">{m === 'grid' ? 'grid_view' : 'view_agenda'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Popular */}
      <div className="sx-popular">
        <span className="sx-popular-label">
          <span className="material-symbols-outlined">trending_up</span>
          Popular
        </span>
        {POPULAR_PAGES.map(n => {
          const s = chapters.find(c => c.pages?.[0] === n) ?? chapters.find(c => c.pages?.[0] <= n && n <= c.pages?.[1]);
          return (
            <Link key={n} href={`/page/${n}`} className="sx-chip">
              <span className="font-arabic">{s?.name_arabic}</span>
              p. {n}
            </Link>
          );
        })}
      </div>

      {loading ? (
        <div className="sx-grid" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="sx-card" style={{ minHeight: 120, opacity: 0.5 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="sx-empty">
          <span className="material-symbols-outlined">search_off</span>
          <p>No page matches “{query}”.</p>
          <button onClick={() => { setQuery(''); setOnly('All'); }}>Clear filters</button>
        </div>
      ) : (
        <div className={view === 'grid' ? 'sx-grid' : 'sx-list'}>
          {shown.map((p, i) => {
            const lead = primary(p);
            return (
              <Link key={p.n} href={`/page/${p.n}`} className="sx-card" style={{ animationDelay: `${Math.min(i % FIRST, 11) * 30}ms` }}>
                <span className="sx-num" aria-hidden="true">{p.n}</span>

                <span className="sx-main">
                  <b>Page {p.n}</b>
                  <small>{p.surahs.map(s => s.name_simple).join(' · ') || 'Mushaf page'}</small>
                </span>

                <span className="sx-ar font-arabic" lang="ar">{lead?.name_arabic}</span>

                <span className="sx-meta">
                  {p.starts ? (
                    <span className="sx-type mk">
                      <span className="material-symbols-outlined">flag</span>
                      Surah starts
                    </span>
                  ) : (
                    <span className="sx-type md">
                      <span className="material-symbols-outlined">more_horiz</span>
                      Continues
                    </span>
                  )}
                  <span>{p.n} of 604</span>
                  <span className="sx-go">
                    Read
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && more > 0 && (
        <div className="sx-more">
          <button onClick={() => setLimit(l => l + STEP)}>
            Show {Math.min(STEP, more)} more
            <span className="material-symbols-outlined">expand_more</span>
          </button>
        </div>
      )}
    </section>
  );
}
