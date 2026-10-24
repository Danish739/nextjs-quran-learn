'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { qcfFontFamily } from '@/app/read-quran/lib/qcf';
import { MushafLoader } from '@/app/read-quran/components/MushafPager';
import { quranGlyphsForDua, verseKeysFromReference, GlyphWord } from './lib/quranGlyphs';
import './duas.css';

/* ─── Types ──────────────────────────────────────────────────── */
interface Category {
  id: string;
  slug: string;
  title: string;
  description?: string;
  totalDuas?: number;
  icon?: string;
  imageIcon?: string;
  color?: string;
}

interface Dua {
  id: string;
  category: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference?: string;
  source?: string;
}

const SOURCES = ['All', 'Quran', 'Hadith'] as const;
type Source = (typeof SOURCES)[number];
type Scope = 'all' | 'favorites' | string; // string = category id

const FAV_KEY = 'dua-favorites';
const PREF_KEY = 'dua-prefs';

const escapeGlyph = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ─── Arabic: Mushaf glyphs for Quranic duas, Uthmani font otherwise ─── */
function DuaArabic({ dua, size }: { dua: Dua; size: number }) {
  const [glyphs, setGlyphs] = useState<GlyphWord[] | null>(null);
  const quranic = dua.source === 'Quran' && verseKeysFromReference(dua.reference).length > 0;

  useEffect(() => {
    if (!quranic) return;
    let alive = true;
    quranGlyphsForDua(dua.arabic, dua.reference).then(g => { if (alive) setGlyphs(g); });
    return () => { alive = false; };
  }, [dua.arabic, dua.reference, quranic]);

  if (glyphs) {
    return (
      <p className="du-ar is-qcf" lang="ar" dir="rtl" style={{ fontSize: size }}>
        {glyphs.map((w, i) => (
          <span key={i}>
            <span
              className={w.end ? 'du-end' : undefined}
              style={{ fontFamily: `${qcfFontFamily(w.page)}, UthmanicHafs, serif` }}
              dangerouslySetInnerHTML={{ __html: escapeGlyph(w.glyph) }}
            />
            {i < glyphs.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    );
  }
  return <p className="du-ar" lang="ar" dir="rtl" style={{ fontSize: size }}>{dua.arabic}</p>;
}

/* ─── Dua card ─── */
function DuaCard({
  dua, cat, index, fav, onFav, showTranslit, showTranslation, arabicSize, compactMeta,
}: {
  dua: Dua;
  cat?: Category;
  index: number;
  fav: boolean;
  onFav: () => void;
  showTranslit: boolean;
  showTranslation: boolean;
  arabicSize: number;
  compactMeta: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(0);
  const keys = verseKeysFromReference(dua.reference);
  const text = `${dua.title}\n\n${dua.arabic}\n\n${dua.transliteration}\n\n${dua.translation}${dua.reference ? `\n\n— ${dua.reference}` : ''}\nlearnquran.app`;

  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const share = () => {
    if (navigator.share) navigator.share({ title: dua.title, text }).catch(() => {});
    else copy();
  };

  return (
    <article id={`dua-${dua.id}`} className="du-card" style={{ ['--c' as string]: cat?.color || 'var(--brand-primary)', animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <header className="du-card-top">
        <span className="du-num">{index + 1}</span>
        <div className="du-card-title">
          <h3>{dua.title}</h3>
          <div className="du-tags">
            {!compactMeta && cat && <span className="du-tag cat">{cat.title}</span>}
            {dua.source && (
              <span className={`du-tag src ${dua.source.toLowerCase()}`}>
                <span className="material-symbols-outlined">{dua.source === 'Quran' ? 'auto_stories' : 'history_edu'}</span>
                {dua.source}
              </span>
            )}
          </div>
        </div>
        <button className={`du-icon fav${fav ? ' on' : ''}`} onClick={onFav} aria-pressed={fav} title={fav ? 'Remove from favourites' : 'Add to favourites'}>
          <span className="material-symbols-outlined">favorite</span>
        </button>
      </header>

      <div className="du-ar-wrap">
        <DuaArabic dua={dua} size={arabicSize} />
      </div>

      {showTranslit && dua.transliteration && <p className="du-translit">{dua.transliteration}</p>}
      {showTranslation && dua.translation && <p className="du-translation">{dua.translation}</p>}

      <footer className="du-card-foot">
        {dua.reference && (
          keys.length ? (
            <Link className="du-ref" href={`/read-quran/${keys[0].split(':')[0]}?mode=translation`} title="Open in the Quran reader">
              <span className="material-symbols-outlined">menu_book</span>
              {dua.reference}
            </Link>
          ) : (
            <span className="du-ref">
              <span className="material-symbols-outlined">history_edu</span>
              {dua.reference}
            </span>
          )
        )}
        <div className="du-actions">
          <button className={`du-count${count ? ' on' : ''}`} onClick={() => setCount(c => c + 1)} onContextMenu={e => { e.preventDefault(); setCount(0); }} title="Tap to count recitations · right-click to reset">
            <span className="material-symbols-outlined">touch_app</span>
            {count ? `×${count}` : 'Count'}
          </button>
          <button className="du-act" onClick={copy}>
            <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="du-act" onClick={share}>
            <span className="material-symbols-outlined">ios_share</span>
            Share
          </button>
        </div>
      </footer>
    </article>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function DuaClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allDuas, setAllDuas] = useState<Dua[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scope, setScope] = useState<Scope | null>(null); // null = landing
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<Source>('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showTranslit, setShowTranslit] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [arabicSize, setArabicSize] = useState(30);
  const chipsRef = useRef<HTMLDivElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  /* Load data once (12 small local JSON files) */
  useEffect(() => {
    fetch('/data/duas/categories.json')
      .then(r => r.json())
      .then(async d => {
        const cats: Category[] = d.categories || [];
        setCategories(cats);
        const lists = await Promise.all(
          cats.map(c => fetch(`/data/duas/${c.slug}.json`).then(r => r.json()).then(x => (x.duas as Dua[]) || []).catch(() => [] as Dua[]))
        );
        setAllDuas(lists.flat());
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    try {
      setFavorites(new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')));
      const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
      if (p) { setShowTranslit(p.translit ?? true); setShowTranslation(p.translation ?? true); setArabicSize(p.size ?? 30); }
    } catch { /* ignore */ }

    // deep links: ?cat=rabbana, ?q=forgive, ?fav=1
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('fav')) setScope('favorites');
    else if (sp.get('cat')) setScope(sp.get('cat'));
    if (sp.get('q')) { setQuery(sp.get('q')!); setScope(s => s ?? 'all'); }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ translit: showTranslit, translation: showTranslation, size: arabicSize })); } catch { /* ignore */ }
  }, [showTranslit, showTranslation, arabicSize]);

  /* URL sync */
  useEffect(() => {
    const url = new URL(window.location.href);
    ['cat', 'q', 'fav'].forEach(k => url.searchParams.delete(k));
    if (scope === 'favorites') url.searchParams.set('fav', '1');
    else if (scope && scope !== 'all') url.searchParams.set('cat', scope);
    if (query.trim()) url.searchParams.set('q', query.trim());
    window.history.replaceState(null, '', url.toString());
  }, [scope, query]);

  /* keep the active category chip in view */
  useEffect(() => {
    chipsRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [scope]);

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      try { localStorage.setItem(FAV_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
      return s;
    });
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    allDuas.forEach(d => m.set(d.category, (m.get(d.category) || 0) + 1));
    return m;
  }, [allDuas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDuas.filter(d => {
      if (scope === 'favorites' && !favorites.has(d.id)) return false;
      if (scope && scope !== 'all' && scope !== 'favorites' && !q && d.category !== scope) return false;
      if (source !== 'All' && d.source !== source) return false;
      if (!q) return true;
      const cat = categories.find(c => c.id === d.category);
      return [d.title, d.transliteration, d.translation, d.reference || '', cat?.title || ''].some(t => t.toLowerCase().includes(q)) || d.arabic.includes(query.trim());
    });
  }, [allDuas, scope, source, query, favorites, categories]);

  /* Dua of the day — rotates daily through the Quranic duas */
  const duaOfDay = useMemo(() => {
    const pool = allDuas.filter(d => d.source === 'Quran');
    if (!pool.length) return null;
    const day = Math.floor(Date.now() / 86_400_000);
    return pool[day % pool.length];
  }, [allDuas]);

  const open = (s: Scope) => {
    setScope(s);
    setTimeout(() => listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const activeCat = scope && scope !== 'all' && scope !== 'favorites' ? categories.find(c => c.id === scope) : undefined;

  if (loading) {
    return <main className="du"><div className="du-wrap"><MushafLoader label="Gathering the duas" /></div></main>;
  }

  if (error) {
    return (
      <main className="du">
        <div className="du-wrap du-empty">
          <span className="material-symbols-outlined">cloud_off</span>
          <h3>Couldn’t load the duas</h3>
          <button className="du-btn primary" onClick={() => location.reload()}>Try again</button>
        </div>
      </main>
    );
  }

  /* ═════════════ LANDING ═════════════ */
  if (scope === null) {
    const odCat = duaOfDay ? categories.find(c => c.id === duaOfDay.category) : undefined;
    return (
      <main className="du">
        <div className="du-wrap">
          <header className="du-hero">
            <div>
              <p className="du-kicker"><span className="font-arabic">الأدعية والأذكار</span><span className="du-kicker-sep" />Duas &amp; Adhkar</p>
              <h1>Call upon Him, <em>He is near.</em></h1>
              <p className="du-sub">{allDuas.length} authentic supplications from the Quran and Sunnah — with the same Mushaf script as the Quran reader, transliteration and meaning.</p>
              <form className="du-hero-search" onSubmit={e => { e.preventDefault(); open('all'); }}>
                <span className="material-symbols-outlined">search</span>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search: forgiveness, travel, anxiety, rain…" aria-label="Search duas" />
                <button type="submit">Search</button>
              </form>
            </div>
            <div className="du-hero-actions">
              <button className="du-quick" onClick={() => open('all')}>
                <span className="material-symbols-outlined">apps</span>
                <span><b>All duas</b><small>{allDuas.length} supplications</small></span>
              </button>
              <button className="du-quick" onClick={() => open('favorites')}>
                <span className="material-symbols-outlined fav">favorite</span>
                <span><b>Favourites</b><small>{favorites.size} saved</small></span>
              </button>
            </div>
          </header>

          {duaOfDay && (
            <section className="du-today" style={{ ['--c' as string]: odCat?.color || 'var(--brand-primary)' }}>
              <div className="du-today-head">
                <span className="du-today-label"><span className="material-symbols-outlined">wb_sunny</span>Dua of the day</span>
                <span className="du-today-title">{duaOfDay.title}</span>
              </div>
              <DuaArabic dua={duaOfDay} size={34} />
              <p className="du-today-tr">“{duaOfDay.translation.replace(/^["“]|["”]$/g, '')}”</p>
              <div className="du-today-foot">
                <span>{duaOfDay.reference}</span>
                <button className="du-btn light" onClick={() => { setScope(duaOfDay.category); setTimeout(() => document.getElementById(`dua-${duaOfDay.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }}>
                  Open in {odCat?.title ?? 'category'}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </section>
          )}

          <section>
            <div className="du-section-head">
              <div>
                <p className="du-kicker-ar font-arabic">أبواب الدعاء</p>
                <h2>Browse by moment</h2>
              </div>
              <span className="du-count-note">{categories.length} categories</span>
            </div>
            <div className="du-cats">
              {categories.map((c, i) => (
                <button key={c.id} className="du-cat" style={{ ['--c' as string]: c.color || 'var(--brand-primary)', animationDelay: `${i * 30}ms` }} onClick={() => open(c.id)}>
                  <span className="du-cat-img">
                    {c.imageIcon
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.imageIcon} alt="" loading="lazy" />
                      : <span className="material-symbols-outlined">{c.icon || 'volunteer_activism'}</span>}
                  </span>
                  <span className="du-cat-text">
                    <b>{c.title}</b>
                    <small>{c.description}</small>
                  </span>
                  <span className="du-cat-count">{counts.get(c.id) ?? c.totalDuas ?? 0}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  /* ═════════════ LIST ═════════════ */
  const heading = query.trim() ? `Results for “${query.trim()}”` : scope === 'favorites' ? 'Your favourites' : activeCat ? activeCat.title : 'All duas';

  return (
    <main className="du">
      <div className="du-bar">
        <div className="du-bar-row">
          <button className="du-icon" onClick={() => { setScope(null); setQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Back to categories">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <label className="du-search">
            <span className="material-symbols-outlined">search</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search all duas…" aria-label="Search duas" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><span className="material-symbols-outlined">close</span></button>}
          </label>
          <div className="du-seg" role="tablist" aria-label="Source">
            {SOURCES.map(s => (
              <button key={s} role="tab" aria-selected={source === s} className={source === s ? 'on' : ''} onClick={() => setSource(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="du-chips" ref={chipsRef} role="tablist" aria-label="Categories">
          <button className={`du-chip${scope === 'all' ? ' on' : ''}`} onClick={() => setScope('all')}>
            <span className="material-symbols-outlined">apps</span>All
          </button>
          <button className={`du-chip${scope === 'favorites' ? ' on' : ''}`} onClick={() => setScope('favorites')}>
            <span className="material-symbols-outlined">favorite</span>Favourites <small>{favorites.size}</small>
          </button>
          {categories.map(c => (
            <button key={c.id} className={`du-chip${scope === c.id ? ' on' : ''}`} style={{ ['--c' as string]: c.color || 'var(--brand-primary)' }} onClick={() => setScope(c.id)}>
              {c.title} <small>{counts.get(c.id) ?? 0}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="du-wrap narrow" ref={listTopRef}>
        <div className="du-list-head">
          <div>
            <h2>{heading}</h2>
            <p>{filtered.length} dua{filtered.length === 1 ? '' : 's'}{activeCat?.description && !query ? ` · ${activeCat.description}` : ''}</p>
          </div>
          <div className="du-display" aria-label="Display options">
            <button className={showTranslit ? 'on' : ''} onClick={() => setShowTranslit(v => !v)} aria-pressed={showTranslit}>Transliteration</button>
            <button className={showTranslation ? 'on' : ''} onClick={() => setShowTranslation(v => !v)} aria-pressed={showTranslation}>Meaning</button>
            <span className="du-size">
              <button onClick={() => setArabicSize(s => Math.max(22, s - 2))} aria-label="Smaller Arabic">A−</button>
              <button onClick={() => setArabicSize(s => Math.min(44, s + 2))} aria-label="Larger Arabic">A+</button>
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="du-empty">
            <span className="material-symbols-outlined">{scope === 'favorites' ? 'favorite' : 'search_off'}</span>
            <h3>{scope === 'favorites' ? 'No favourites yet' : 'No duas found'}</h3>
            <p>{scope === 'favorites' ? 'Tap the heart on any dua to keep it here.' : 'Try another word, or switch the Quran / Hadith filter.'}</p>
            <button className="du-btn primary" onClick={() => { setQuery(''); setSource('All'); setScope('all'); }}>Show all duas</button>
          </div>
        ) : (
          <div className="du-list">
            {filtered.map((d, i) => (
              <DuaCard
                key={d.id}
                dua={d}
                cat={categories.find(c => c.id === d.category)}
                index={i}
                fav={favorites.has(d.id)}
                onFav={() => toggleFav(d.id)}
                showTranslit={showTranslit}
                showTranslation={showTranslation}
                arabicSize={arabicSize}
                compactMeta={!!activeCat && !query}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
