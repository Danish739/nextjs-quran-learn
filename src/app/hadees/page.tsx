'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HadeesOfTheDay from '@/components/HadeesOfTheDay';
import { MushafLoader } from '@/app/read-quran/components/MushafPager';
import './hadees.css';

/* ─── Types ─────────────────────────────────────────────────── */
interface Hadith {
  number: string;
  english: string;
  arabic: string;
  grade: string;
  chapter: string;
}

interface Collection {
  id: string;
  name: string;
  ar: string;
  compiler: string;
  died: string;
  blurb: string;
  hue: string;
}

interface SavedHadith {
  key: string;
  collection: string;
  number: string;
  english: string;
  arabic: string;
  chapter: string;
  at: number;
}

/* ─── Constants ──────────────────────────────────────────────── */
const COLLECTIONS: Collection[] = [
  { id: 'bukhari', name: 'Sahih al-Bukhari', ar: 'صحيح البخاري', compiler: 'Imam al-Bukhari', died: 'd. 256 AH', blurb: 'Regarded as the most authentic collection after the Quran.', hue: '#13705a' },
  { id: 'muslim', name: 'Sahih Muslim', ar: 'صحيح مسلم', compiler: 'Imam Muslim', died: 'd. 261 AH', blurb: 'The second of the two Sahih collections, known for its careful ordering.', hue: '#1e6091' },
  { id: 'abudawud', name: 'Sunan Abu Dawud', ar: 'سنن أبي داود', compiler: 'Imam Abu Dawud', died: 'd. 275 AH', blurb: 'Focused on the hadith that underpin rulings of fiqh.', hue: '#8a5a1f' },
  { id: 'tirmidhi', name: "Jami' at-Tirmidhi", ar: 'جامع الترمذي', compiler: 'Imam at-Tirmidhi', died: 'd. 279 AH', blurb: 'Notes the grading of hadith and the views of the scholars.', hue: '#6b3d8a' },
  { id: 'nasai', name: "Sunan an-Nasa'i", ar: 'سنن النسائي', compiler: "Imam an-Nasa'i", died: 'd. 303 AH', blurb: 'Known for its strict criteria among the Sunan works.', hue: '#9a3b3b' },
  { id: 'ibnmajah', name: 'Sunan Ibn Majah', ar: 'سنن ابن ماجه', compiler: 'Imam Ibn Majah', died: 'd. 273 AH', blurb: 'Completes the six major collections (al-Kutub al-Sittah).', hue: '#2f6f6a' },
];

const LIMIT = 20;
const SAVED_KEY = 'hadees-saved';
const ARABIC_FONT = "'UthmanicHafsText', serif";

type View = { kind: 'home' } | { kind: 'collection'; id: string } | { kind: 'saved' } | { kind: 'search'; q: string };

interface SearchHit extends Hadith { collection: string }

/** Paginator with ellipses */
function pageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (page >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', page - 1, page, page + 1, '…', total];
}

/** Wraps search matches in <mark> */
function highlight(text: string, q: string) {
  if (!q.trim()) return text;
  const esc = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.split(new RegExp(`(${esc})`, 'gi')).map((part, i) =>
    part.toLowerCase() === q.trim().toLowerCase() ? <mark key={i}>{part}</mark> : part
  );
}

/* ─── Hadith card ────────────────────────────────────────────── */
function HadithCard({
  h, col, saved, onSave, query, index, onCopy, onShare, copied,
}: {
  h: Hadith | SavedHadith;
  col: Collection;
  saved: boolean;
  onSave: () => void;
  query: string;
  index: number;
  onCopy: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  const [showArabic, setShowArabic] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const longAr = !!h.arabic && h.arabic.length > 320;
  const longEn = h.english.length > 700;

  return (
    <article className="hd-card" style={{ ['--hue' as string]: col.hue, animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      <header className="hd-card-top">
        <span className="hd-num">#{h.number}</span>
        <span className="hd-col-tag">{col.name}</span>
        {h.chapter && <span className="hd-chapter" title={h.chapter}>{h.chapter}</span>}
        <button className={`hd-icon${saved ? ' on' : ''}`} onClick={onSave} aria-pressed={saved} title={saved ? 'Remove from saved' : 'Save'}>
          <span className="material-symbols-outlined">bookmark</span>
        </button>
      </header>

      {h.arabic && showArabic && (
        <div className={`hd-ar-wrap${longAr && !expanded ? ' clamp' : ''}`}>
          <p className="hd-ar" lang="ar" dir="rtl" style={{ fontFamily: ARABIC_FONT }}>{h.arabic}</p>
        </div>
      )}

      <p className={`hd-en${longEn && !expanded ? ' clamp' : ''}`}>{highlight(h.english, query)}</p>

      <footer className="hd-card-foot">
        <span className="hd-ref">
          <span className="material-symbols-outlined">menu_book</span>
          {col.name} {h.number}
        </span>
        <div className="hd-actions">
          {(longAr || longEn) && (
            <button className="hd-act" onClick={() => setExpanded(e => !e)}>
              <span className="material-symbols-outlined">{expanded ? 'unfold_less' : 'unfold_more'}</span>
              {expanded ? 'Less' : 'Read all'}
            </button>
          )}
          {h.arabic && (
            <button className="hd-act" onClick={() => setShowArabic(s => !s)} title="Show / hide Arabic">
              <span className="material-symbols-outlined">translate</span>
              {showArabic ? 'Hide Arabic' : 'Arabic'}
            </button>
          )}
          <button className="hd-act" onClick={onCopy}>
            <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="hd-act" onClick={onShare}>
            <span className="material-symbols-outlined">ios_share</span>
            Share
          </button>
        </div>
      </footer>
    </article>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function HadeesPage() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [hadiths, setHadiths] = useState<Hadith[]>([]);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [bookId, setBookId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<SavedHadith[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [booksOpen, setBooksOpen] = useState(false);
  const [bookFilter, setBookFilter] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  // cross-collection search
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [only, setOnly] = useState('');
  const topRef = useRef<HTMLDivElement>(null);

  const col = view.kind === 'collection' ? COLLECTIONS.find(c => c.id === view.id)! : null;
  const savedKeys = useMemo(() => new Set(saved.map(s => s.key)), [saved]);

  /* Saved hadith (full copies, so the Saved view works offline) */
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')); } catch { /* ignore */ }
    // restore ?c=&book=&page= deep links
    const p = new URLSearchParams(window.location.search);
    const c = p.get('c');
    if (c === 'saved') setView({ kind: 'saved' });
    else if (c === 'all' && p.get('q')) {
      setView({ kind: 'search', q: p.get('q')! });
      setHomeQuery(p.get('q')!);
      setOnly(p.get('only') || '');
      setPage(Math.max(1, Number(p.get('page')) || 1));
    }
    else if (c && COLLECTIONS.some(x => x.id === c)) {
      setView({ kind: 'collection', id: c });
      setBookId(p.get('book') || '');
      setPage(Math.max(1, Number(p.get('page')) || 1));
      if (p.get('q')) { setSearchInput(p.get('q')!); setSearch(p.get('q')!); }
    }
  }, []);

  const persistSaved = (next: SavedHadith[]) => {
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const toggleSave = (c: Collection, h: Hadith | SavedHadith) => {
    const key = `${c.id}-${h.number}`;
    if (savedKeys.has(key)) persistSaved(saved.filter(s => s.key !== key));
    else persistSaved([{ key, collection: c.id, number: h.number, english: h.english, arabic: h.arabic, chapter: h.chapter, at: Date.now() }, ...saved]);
  };

  /* Keep the URL in sync so links and refresh return to the same place */
  useEffect(() => {
    const url = new URL(window.location.href);
    ['c', 'book', 'page', 'q', 'only'].forEach(k => url.searchParams.delete(k));
    if (view.kind === 'saved') url.searchParams.set('c', 'saved');
    if (view.kind === 'search') {
      url.searchParams.set('c', 'all');
      url.searchParams.set('q', view.q);
      if (only) url.searchParams.set('only', only);
      if (page > 1) url.searchParams.set('page', String(page));
    }
    if (view.kind === 'collection') {
      url.searchParams.set('c', view.id);
      if (bookId) url.searchParams.set('book', bookId);
      if (page > 1) url.searchParams.set('page', String(page));
      if (search) url.searchParams.set('q', search);
    }
    window.history.replaceState(null, '', url.toString());
  }, [view, bookId, page, search, only]);

  /* Debounced search */
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) { setSearch(searchInput); setPage(1); }
    }, 450);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  /* Fetch */
  useEffect(() => {
    if (view.kind !== 'collection') return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ collection: view.id, page: String(page), limit: String(LIMIT) });
    if (search.trim()) params.set('search', search.trim());
    if (bookId) params.set('section', bookId);
    fetch(`/api/hadith?${params}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (!ok || d.error) throw new Error(d.error || 'Failed to load collection');
        setHadiths(d.hadiths ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
        if (d.metadata?.sections) setSections(d.metadata.sections);
      })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load collection'); setHadiths([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [view, page, search, bookId, retry]);

  /* Fetch: search across all six collections */
  useEffect(() => {
    if (view.kind !== 'search') return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ collection: 'all', search: view.q, page: String(page), limit: String(LIMIT) });
    if (only) params.set('only', only);
    fetch(`/api/hadith?${params}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (!ok || d.error) throw new Error(d.error || 'Search failed');
        setHits(d.hadiths ?? []);
        setCounts(d.counts ?? {});
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Search failed'); setHits([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [view, page, only, retry]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const openCollection = (id: string, q = '') => {
    setView({ kind: 'collection', id });
    setSections({});
    setBookId('');
    setPage(1);
    setSearchInput(q);
    setSearch(q);
    setHadiths([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const searchAll = (q: string) => {
    const term = q.trim();
    if (!term) return;
    setView({ kind: 'search', q: term });
    setHomeQuery(term);
    setOnly('');
    setPage(1);
    setHits([]);
    setCounts({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goHome = () => { setView({ kind: 'home' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const changePage = (p: number) => { setPage(p); scrollTop(); };

  const pickBook = (id: string) => {
    setBookId(id);
    setPage(1);
    setSearchInput('');
    setSearch('');
    setBooksOpen(false);
    scrollTop();
  };

  const textOf = (c: Collection, h: Hadith | SavedHadith) =>
    `${h.arabic ? h.arabic + '\n\n' : ''}${h.english}\n\n— ${c.name} ${h.number}\nlearnquran.app`;

  const copy = useCallback((c: Collection, h: Hadith | SavedHadith) => {
    navigator.clipboard.writeText(textOf(c, h)).catch(() => {});
    setCopied(`${c.id}-${h.number}`);
    setTimeout(() => setCopied(null), 1800);
  }, []);

  const share = useCallback((c: Collection, h: Hadith | SavedHadith) => {
    const text = textOf(c, h);
    if (navigator.share) navigator.share({ title: `${c.name} ${h.number}`, text }).catch(() => {});
    else copy(c, h);
  }, [copy]);

  const sectionList = useMemo(
    () => Object.entries(sections).filter(([, n]) => n && (!bookFilter || n.toLowerCase().includes(bookFilter.toLowerCase()))),
    [sections, bookFilter]
  );

  /* ═════════════════ HOME ═════════════════ */
  if (view.kind === 'home') {
    return (
      <main className="hd">
        <div className="hd-wrap">
          <header className="hd-hero">
            <p className="hd-kicker"><span className="font-arabic">الحديث النبوي</span><span className="hd-kicker-sep" />The Sunnah</p>
            <h1>The words of the Prophet <span className="hd-saw">ﷺ</span>, <em>within reach.</em></h1>
            <p className="hd-sub">Read and search the six major collections in Arabic and English, and keep the narrations that move you.</p>
            <form className="hd-hero-search" onSubmit={e => { e.preventDefault(); searchAll(homeQuery); }}>
              <span className="material-symbols-outlined">search</span>
              <input value={homeQuery} onChange={e => setHomeQuery(e.target.value)} placeholder="Search all six collections, e.g. intention, mercy, prayer" aria-label="Search hadith" />
              <button type="submit" disabled={!homeQuery.trim()}>Search all</button>
            </form>
          </header>

          <HadeesOfTheDay />

          <section>
            <div className="hd-section-head">
              <div>
                <p className="hd-kicker-ar font-arabic">الكتب الستة</p>
                <h2>The Six Collections</h2>
              </div>
              <button className="hd-saved-link" onClick={() => setView({ kind: 'saved' })}>
                <span className="material-symbols-outlined">bookmarks</span>
                Saved <b>{saved.length}</b>
              </button>
            </div>
            <div className="hd-grid">
              {COLLECTIONS.map((c, i) => (
                <button key={c.id} className="hd-col" style={{ ['--hue' as string]: c.hue, animationDelay: `${i * 50}ms` }} onClick={() => openCollection(c.id)}>
                  <span className="hd-col-arch" aria-hidden="true">
                    <span className="font-arabic">{c.ar.split(' ').slice(-1)[0]}</span>
                  </span>
                  <span className="hd-col-text">
                    <span className="hd-col-ar font-arabic">{c.ar}</span>
                    <b>{c.name}</b>
                    <small>{c.compiler} · {c.died}</small>
                    <span className="hd-col-blurb">{c.blurb}</span>
                  </span>
                  <span className="hd-col-go material-symbols-outlined">arrow_forward</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  /* ═════════════════ SEARCH (all collections) ═════════════════ */
  if (view.kind === 'search') {
    const sumCounts = Object.values(counts).reduce((a, b) => a + b, 0);
    const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
    const to = Math.min(page * LIMIT, total);
    return (
      <main className="hd">
        <div className="hd-bar">
          <button className="hd-icon" onClick={goHome} aria-label="Back"><span className="material-symbols-outlined">arrow_back</span></button>
          <div className="hd-bar-title"><b>Search all collections</b><small>Bukhari · Muslim · Abu Dawud · Tirmidhi · Nasa’i · Ibn Majah</small></div>
        </div>
        <div className="hd-wrap narrow" ref={topRef}>
          <div className="hd-tools">
            <form className="hd-search" onSubmit={e => { e.preventDefault(); searchAll(homeQuery); }}>
              <span className="material-symbols-outlined">search</span>
              <input value={homeQuery} onChange={e => setHomeQuery(e.target.value)} placeholder="Search all six collections…" aria-label="Search all collections" />
              {homeQuery && <button type="button" onClick={goHome} aria-label="Clear search"><span className="material-symbols-outlined">close</span></button>}
            </form>
          </div>

          <div className="hd-filter-chips" role="tablist" aria-label="Filter by collection">
            <button role="tab" aria-selected={!only} className={!only ? 'on' : ''} onClick={() => { setOnly(''); setPage(1); }}>
              All {sumCounts > 0 && <small>{sumCounts.toLocaleString()}</small>}
            </button>
            {COLLECTIONS.map(c => (
              <button key={c.id} role="tab" aria-selected={only === c.id} className={only === c.id ? 'on' : ''}
                disabled={counts[c.id] === 0} onClick={() => { setOnly(c.id); setPage(1); }}
                style={{ ['--hue' as string]: c.hue }}>
                {c.name.replace(/^(Sahih|Sunan|Jami') ?/, '').replace('al-', '')}
                {counts[c.id] !== undefined && <small>{counts[c.id].toLocaleString()}</small>}
              </button>
            ))}
          </div>

          <div className="hd-status">
            {loading ? 'Searching all collections…' : error ? null
              : <>{total.toLocaleString()} result{total === 1 ? '' : 's'} for “<b>{view.q}</b>”{total > 0 && <> · showing {from}–{to}</>}</>}
          </div>

          {error ? (
            <div className="hd-empty">
              <span className="material-symbols-outlined">cloud_off</span>
              <h3>Search failed</h3>
              <p>{error}</p>
              <button className="hd-btn primary" onClick={() => setRetry(r => r + 1)}>Try again</button>
            </div>
          ) : loading ? (
            <MushafLoader label="Searching the six collections" />
          ) : hits.length === 0 ? (
            <div className="hd-empty">
              <span className="material-symbols-outlined">search_off</span>
              <h3>No hadith found</h3>
              <p>Try a different word or a shorter phrase.</p>
              <button className="hd-btn" onClick={goHome}>Back to collections</button>
            </div>
          ) : (
            <div className="hd-list">
              {hits.map((h, i) => {
                const c = COLLECTIONS.find(x => x.id === h.collection) ?? COLLECTIONS[0];
                const key = `${c.id}-${h.number}`;
                return (
                  <HadithCard key={key} h={h} col={c} saved={savedKeys.has(key)} onSave={() => toggleSave(c, h)} query={view.q} index={i}
                    onCopy={() => copy(c, h)} onShare={() => share(c, h)} copied={copied === key} />
                );
              })}
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <nav className="hd-pager" aria-label="Pages">
              <button onClick={() => changePage(page - 1)} disabled={page === 1} aria-label="Previous page"><span className="material-symbols-outlined">chevron_left</span></button>
              {pageList(page, totalPages).map((p, i) =>
                p === '…' ? <span key={`e${i}`}>…</span> : (
                  <button key={p} className={p === page ? 'on' : ''} onClick={() => changePage(p)}>{p}</button>
                )
              )}
              <button onClick={() => changePage(page + 1)} disabled={page === totalPages} aria-label="Next page"><span className="material-symbols-outlined">chevron_right</span></button>
            </nav>
          )}
        </div>
      </main>
    );
  }

  /* ═════════════════ SAVED ═════════════════ */
  if (view.kind === 'saved') {
    return (
      <main className="hd">
        <div className="hd-bar">
          <button className="hd-icon" onClick={goHome} aria-label="Back"><span className="material-symbols-outlined">arrow_back</span></button>
          <div className="hd-bar-title"><b>Saved hadith</b><small>{saved.length} saved in this browser</small></div>
        </div>
        <div className="hd-wrap narrow">
          {saved.length === 0 ? (
            <div className="hd-empty">
              <span className="material-symbols-outlined">bookmark_add</span>
              <h3>Nothing saved yet</h3>
              <p>Tap the bookmark on any hadith to keep it here.</p>
              <button className="hd-btn primary" onClick={goHome}>Browse collections</button>
            </div>
          ) : (
            <div className="hd-list">
              {saved.map((s, i) => {
                const c = COLLECTIONS.find(x => x.id === s.collection) ?? COLLECTIONS[0];
                return (
                  <HadithCard key={s.key} h={s} col={c} saved onSave={() => toggleSave(c, s)} query="" index={i}
                    onCopy={() => copy(c, s)} onShare={() => share(c, s)} copied={copied === s.key} />
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  }

  /* ═════════════════ COLLECTION ═════════════════ */
  if (!col) return null;
  const bookName = bookId ? sections[bookId] : '';
  const from = (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);

  return (
    <main className="hd" style={{ ['--hue' as string]: col.hue }}>
      <div className="hd-bar">
        <button className="hd-icon" onClick={goHome} aria-label="Back to collections"><span className="material-symbols-outlined">arrow_back</span></button>
        <div className="hd-bar-title">
          <b>{col.name} <span className="font-arabic">{col.ar}</span></b>
          <small>{col.compiler} · {col.died}</small>
        </div>
        <div className="hd-switch" role="tablist" aria-label="Collection">
          {COLLECTIONS.map(c => (
            <button key={c.id} role="tab" aria-selected={c.id === col.id} className={c.id === col.id ? 'on' : ''} onClick={() => openCollection(c.id)} title={c.name}>
              {c.name.replace(/^(Sahih|Sunan|Jami') ?/, '').replace('al-', '')}
            </button>
          ))}
        </div>
        <button className="hd-icon" onClick={() => setView({ kind: 'saved' })} title="Saved hadith">
          <span className="material-symbols-outlined">bookmarks</span>
        </button>
      </div>

      <div className="hd-wrap narrow" ref={topRef}>
        {/* toolbar */}
        <div className="hd-tools">
          <button className={`hd-books-btn${bookId ? ' on' : ''}`} onClick={() => setBooksOpen(true)}>
            <span className="material-symbols-outlined">library_books</span>
            <span className="hd-books-label">{bookId ? <>Book {bookId}: <b>{bookName}</b></> : 'All books'}</span>
            <span className="material-symbols-outlined">expand_more</span>
          </button>
          {bookId && (
            <button className="hd-chip-clear" onClick={() => pickBook('')}>
              <span className="material-symbols-outlined">close</span>Clear
            </button>
          )}
          <label className="hd-search">
            <span className="material-symbols-outlined">search</span>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder={`Search ${col.name}…`} aria-label="Search this collection" />
            {searchInput && <button onClick={() => { setSearchInput(''); setSearch(''); }} aria-label="Clear search"><span className="material-symbols-outlined">close</span></button>}
          </label>
        </div>

        <div className="hd-status">
          {loading ? 'Loading…' : search
            ? <>{total.toLocaleString()} result{total === 1 ? '' : 's'} for “<b>{search}</b>” in {col.name} · <button className="hd-link" onClick={() => searchAll(search)}>search all collections</button></>
            : total > 0 ? <>Showing <b>{from}–{to}</b> of {total.toLocaleString()} hadith</> : null}
        </div>

        {error ? (
          <div className="hd-empty">
            <span className="material-symbols-outlined">cloud_off</span>
            <h3>Couldn’t load this collection</h3>
            <p>{error}</p>
            <button className="hd-btn primary" onClick={() => setRetry(r => r + 1)}>Try again</button>
          </div>
        ) : loading ? (
          <MushafLoader label={bookName ? `Opening ${bookName}` : `Opening ${col.name}`} />
        ) : hadiths.length === 0 ? (
          <div className="hd-empty">
            <span className="material-symbols-outlined">search_off</span>
            <h3>No hadith found</h3>
            <p>Try another word, or search a different collection.</p>
            {search && <button className="hd-btn primary" onClick={() => searchAll(search)}>Search all six collections</button>}
            <button className="hd-btn" onClick={() => { setSearchInput(''); setSearch(''); }}>Clear search</button>
          </div>
        ) : (
          <div className="hd-list">
            {hadiths.map((h, i) => {
              const key = `${col.id}-${h.number}`;
              return (
                <HadithCard key={key} h={h} col={col} saved={savedKeys.has(key)} onSave={() => toggleSave(col, h)} query={search} index={i}
                  onCopy={() => copy(col, h)} onShare={() => share(col, h)} copied={copied === key} />
              );
            })}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <nav className="hd-pager" aria-label="Pages">
            <button onClick={() => changePage(page - 1)} disabled={page === 1} aria-label="Previous page"><span className="material-symbols-outlined">chevron_left</span></button>
            {pageList(page, totalPages).map((p, i) =>
              p === '…' ? <span key={`e${i}`}>…</span> : (
                <button key={p} className={p === page ? 'on' : ''} onClick={() => changePage(p)}>{p}</button>
              )
            )}
            <button onClick={() => changePage(page + 1)} disabled={page === totalPages} aria-label="Next page"><span className="material-symbols-outlined">chevron_right</span></button>
          </nav>
        )}
      </div>

      {/* books drawer */}
      {booksOpen && (
        <>
          <div className="hd-overlay" onClick={() => setBooksOpen(false)} />
          <aside className="hd-drawer" role="dialog" aria-label="Books">
            <div className="hd-drawer-head">
              <div><b>Books</b><small>{Object.keys(sections).length} in {col.name}</small></div>
              <button className="hd-icon" onClick={() => setBooksOpen(false)} aria-label="Close"><span className="material-symbols-outlined">close</span></button>
            </div>
            <label className="hd-search in-drawer">
              <span className="material-symbols-outlined">search</span>
              <input autoFocus value={bookFilter} onChange={e => setBookFilter(e.target.value)} placeholder="Find a book (e.g. Prayer, Fasting)" aria-label="Find a book" />
            </label>
            <div className="hd-drawer-list">
              <button className={`hd-book${!bookId ? ' on' : ''}`} onClick={() => pickBook('')}>
                <span className="hd-book-num"><span className="material-symbols-outlined">apps</span></span>
                <span className="hd-book-name">All books</span>
              </button>
              {sectionList.map(([id, name]) => (
                <button key={id} className={`hd-book${bookId === id ? ' on' : ''}`} onClick={() => pickBook(id)}>
                  <span className="hd-book-num">{id}</span>
                  <span className="hd-book-name">{name}</span>
                </button>
              ))}
              {sectionList.length === 0 && Object.keys(sections).length > 0 && <p className="hd-drawer-empty">No book matches “{bookFilter}”.</p>}
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
