'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trackSurahVisit } from '@/lib/recentSurahs';
import './SurahExplorer.css';

export interface SurahInfo {
  num: number;
  ar: string;
  name: string;
  meaning: string;
  v: number;
  t: string;
}

interface Props {
  surahs: SurahInfo[];
  recentNums: number[];
}

const POPULAR = [
  { num: 36, label: 'Ya-Sin' },
  { num: 18, label: 'Al-Kahf' },
  { num: 67, label: 'Al-Mulk' },
  { num: 55, label: 'Ar-Rahman' },
  { num: 56, label: "Al-Waqi'ah" },
  { num: 112, label: 'Al-Ikhlas' },
];

const PAGE = 12;

/** Rough reading time at ~20 seconds per ayah */
const readMins = (v: number) => Math.max(1, Math.round((v * 20) / 60));

export default function SurahExplorer({ surahs, recentNums }: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'All' | 'Meccan' | 'Medinan'>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return surahs.filter(s => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.meaning.toLowerCase().includes(q) || s.ar.includes(q) || String(s.num) === q;
      return matchQ && (type === 'All' || s.t === type);
    });
  }, [surahs, query, type]);

  const searching = query.trim() !== '' || type !== 'All';
  const shown = showAll || searching ? filtered : filtered.slice(0, PAGE);

  const visit = (s: SurahInfo) => trackSurahVisit({ num: s.num, name: s.name, ar: s.ar, v: s.v });

  return (
    <section className="sx" aria-labelledby="sx-title">
      {/* Header */}
      <div className="sx-head">
        <div>
          <p className="sx-kicker font-arabic">سُوَر القرآن</p>
          <h2 id="sx-title">Explore Surahs</h2>
          <p className="sx-count">{filtered.length} of 114 surahs</p>
        </div>

        <div className="sx-tools">
          <label className="sx-search">
            <span className="material-symbols-outlined">search</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name, meaning or number"
              aria-label="Search surahs"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search">
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </label>

          <div className="sx-seg" role="tablist" aria-label="Revelation">
            {(['All', 'Meccan', 'Medinan'] as const).map(t => (
              <button key={t} role="tab" aria-selected={type === t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>
                {t}
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
        {POPULAR.map(p => {
          const s = surahs.find(x => x.num === p.num);
          return (
            <Link key={p.num} href={`/read-quran/${p.num}`} className="sx-chip" onClick={() => s && visit(s)}>
              <span className="font-arabic">{s?.ar}</span>
              {p.label}
            </Link>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="sx-empty">
          <span className="material-symbols-outlined">search_off</span>
          <p>No surah matches “{query}”.</p>
          <button onClick={() => { setQuery(''); setType('All'); }}>Clear filters</button>
        </div>
      ) : (
        <div className={view === 'grid' ? 'sx-grid' : 'sx-list'}>
          {shown.map((s, i) => {
            const recent = recentNums.includes(s.num);
            return (
              <Link
                key={s.num}
                href={`/read-quran/${s.num}`}
                onClick={() => visit(s)}
                className={`sx-card${recent ? ' is-recent' : ''}`}
                style={{ animationDelay: `${Math.min(i % PAGE, 11) * 30}ms` }}
              >
                <span className="sx-num" aria-hidden="true">{s.num}</span>

                <span className="sx-main">
                  <b>{s.name}</b>
                  <small>{s.meaning}</small>
                </span>

                <span className="sx-ar font-arabic" lang="ar">{s.ar}</span>

                <span className="sx-meta">
                  <span className={`sx-type ${s.t === 'Meccan' ? 'mk' : 'md'}`}>
                    <span className="material-symbols-outlined">{s.t === 'Meccan' ? 'landscape' : 'location_city'}</span>
                    {s.t}
                  </span>
                  <span>{s.v} ayahs</span>
                  <span className="sx-dot">·</span>
                  <span>{readMins(s.v)} min</span>
                  {recent && <span className="sx-recent"><span className="material-symbols-outlined">history</span>Recent</span>}
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

      {/* Show more */}
      {!searching && filtered.length > PAGE && (
        <div className="sx-more">
          <button onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Show fewer' : `Show all ${filtered.length} surahs`}
            <span className={`material-symbols-outlined${showAll ? ' up' : ''}`}>expand_more</span>
          </button>
        </div>
      )}
    </section>
  );
}
