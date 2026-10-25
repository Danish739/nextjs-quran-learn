'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import '@/app/uthmani/styles/uthmani.css';
import '../styles/mushaf-pager.css';

const API = 'https://api.quran.com/api/v4';

/** Pause / stop marks that take the wider word gap. */
const STOP_CHARS = new Set(['ۖ', 'ۗ', 'ۘ', 'ۙ', 'ۚ', 'ۛ', 'ۜ', 'ۢ', 'ؕ', '۪', '۫', 'ؗ', 'ۥ']);

/** Pages and lines Quran.com center-aligns in the Madani mushaf. */
const CENTER_PAGES = new Set([1, 2]);
const CENTER_LINES: Record<number, number[]> = {
  255: [2], 528: [9], 534: [6], 545: [6], 586: [1], 593: [2], 594: [5],
  600: [10], 602: [5, 15], 603: [10, 15], 604: [4, 9, 14, 15],
};
const isCenterLine = (page: number, line: number) => CENTER_PAGES.has(page) || (CENTER_LINES[page] || []).includes(line);

interface PageWord {
  key: string;
  glyph: string;
  stop: boolean;
  /** the ayah-number marker, not a recited word */
  end: boolean;
  position: number;
  verseNumber: number;
  line: number;
}

interface PageData {
  page: number;
  lines: { line: number; words: PageWord[] }[];
  startsSurah: boolean;
}

// ── Caches shared across renders / surahs ──
const pageCache = new Map<string, Promise<PageData>>();
const fontCache = new Map<number, Promise<void>>();

function loadFont(page: number): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  let p = fontCache.get(page);
  if (!p) {
    const family = `p${page}-v2`;
    const url = `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${page}.woff2`;
    if (!document.getElementById(`qcf-${family}`)) {
      const style = document.createElement('style');
      style.id = `qcf-${family}`;
      style.textContent = `@font-face{font-family:'${family}';src:url('${url}') format('woff2');font-display:block;}`;
      document.head.appendChild(style);
    }
    const face = new FontFace(family, `url('${url}')`);
    p = face.load().then(f => { document.fonts.add(f); }).catch(() => undefined);
    fontCache.set(page, p);
  }
  return p;
}

function loadPage(surah: number, page: number): Promise<PageData> {
  const cacheKey = `${surah}:${page}`;
  let p = pageCache.get(cacheKey);
  if (!p) {
    const url =
      `${API}/verses/by_page/${page}?words=true&fields=text_uthmani,code_v2` +
      `&word_fields=code_v2,text_uthmani,char_type_name,line_number,page_number&per_page=50`;
    p = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Could not load this page');
        return r.json();
      })
      .then(data => {
        const lines = new Map<number, PageWord[]>();
        let startsSurah = false;
        for (const v of data.verses || []) {
          if (!String(v.verse_key).startsWith(`${surah}:`)) continue;
          if (v.verse_number === 1) startsSurah = true;
          for (const w of v.words || []) {
            if (!w.text_uthmani && !w.code_v2) continue;
            const line = w.line_number || 1;
            if (!lines.has(line)) lines.set(line, []);
            lines.get(line)!.push({
              key: `${v.verse_key}:${w.position}`,
              glyph: w.code_v2 || w.text_uthmani,
              stop: Array.from(String(w.text_uthmani || '')).some(ch => STOP_CHARS.has(ch)),
              end: w.char_type_name === 'end',
              position: w.position,
              verseNumber: v.verse_number,
              line,
            });
          }
        }
        return {
          page,
          startsSurah,
          lines: Array.from(lines.entries()).sort((a, b) => a[0] - b[0]).map(([line, words]) => ({ line, words })),
        };
      });
    p.catch(() => pageCache.delete(cacheKey));
    pageCache.set(cacheKey, p);
  }
  return p;
}

const escapeGlyph = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Calm Mushaf-page loader: a page skeleton with lines writing in and a breathing arch emblem. */
export function MushafLoader({ label }: { label: string }) {
  const widths = [62, 94, 88, 97, 90, 95, 84, 98, 91, 87, 96, 89, 93, 86, 70];
  return (
    <div className="mp-loader" role="status" aria-live="polite">
      <div className="mp-loader-page">
        <div className="mp-loader-emblem" aria-hidden="true">
          <svg viewBox="0 0 80 96">
            <path className="mp-arch-outer" d="M8 92 V40 C8 18 40 6 40 6 C40 6 72 18 72 40 V92" />
            <path className="mp-arch-inner" d="M18 92 V44 C18 28 40 18 40 18 C40 18 62 28 62 44 V92" />
            <path className="mp-book" d="M40 70 C32 64 22 64 16 66 V50 C22 48 32 48 40 54 C48 48 58 48 64 50 V66 C58 64 48 64 40 70 Z" />
            <line className="mp-spine" x1="40" y1="54" x2="40" y2="70" />
          </svg>
          <span className="mp-ring" />
        </div>
        <div className="mp-loader-lines" aria-hidden="true">
          {widths.map((w, i) => (
            <span key={i} style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </div>
      <p className="mp-loader-label">
        {label}
        <span className="mp-dots"><i /><i /><i /></span>
      </p>
    </div>
  );
}

interface Props {
  surahNumber: number;
  surahName: string;
  surahArabic: string;
  /** Mushaf page range of this surah, e.g. [2, 49] */
  pages: number[];
  linkQuery?: string;
  /** ayah + word being recited: the ayah is tinted, the word lit */
  reciting?: { verse: number; word: number | null } | null;
  /** Mushaf page of the ayah being recited; the pager turns to it */
  followPage?: number;
  /** tapping a word starts the recitation from its ayah */
  onPlayVerse?: (verse: number) => void;
}

export default function MushafPager({
  surahNumber, surahName, surahArabic, pages, linkQuery = 'mode=reading', reciting = null, followPage, onPlayVerse,
}: Props) {
  const first = pages[0] ?? 1;
  const last = pages[pages.length - 1] ?? first;
  const total = last - first + 1;

  // 0-based page within this surah; starts from ?page= (1-based) so shared links / refresh return here
  const [index, setIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const p = Number(new URLSearchParams(window.location.search).get('page'));
    return p >= 1 && p <= total ? p - 1 : 0;
  });
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragX = useRef<number | null>(null);

  const mushafPage = first + index;

  // Load the current page (data + its font), then quietly prefetch the next one
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setBusy(true);
    const page = first + index;
    loadPage(surahNumber, page)
      .then(async d => {
        await loadFont(page);
        if (cancelled) return;
        setData(d);
        setBusy(false);
        if (page + 1 <= last) loadPage(surahNumber, page + 1).then(() => loadFont(page + 1)).catch(() => undefined);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load this page');
        setBusy(false);
      });

    // keep the page in the URL so refresh / share returns here
    const url = new URL(window.location.href);
    if (index > 0) url.searchParams.set('page', String(index + 1));
    else url.searchParams.delete('page');
    window.history.replaceState(null, '', url.toString());

    // back to the top of the reading area
    rootRef.current?.closest('.rr-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    // keep the active chip in view
    stripRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    return () => { cancelled = true; };
  }, [surahNumber, index, first, last, retry]);

  const go = useCallback((i: number) => setIndex(Math.min(Math.max(i, 0), total - 1)), [total]);

  // turn the page when the recitation moves onto the next one
  useEffect(() => {
    if (followPage && followPage >= first && followPage <= last) setIndex(followPage - first);
  }, [followPage, first, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'PageDown' || e.key === ']') { e.preventDefault(); go(index + 1); }
      if (e.key === 'PageUp' || e.key === '[') { e.preventDefault(); go(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  const showBismillah = data?.startsSurah && surahNumber !== 1 && surahNumber !== 9;
  const shown = data && data.page === mushafPage && !busy;

  return (
    <div ref={rootRef} className="mp">
      {/* ── Page bar ── */}
      {total > 1 && (
        <div className="mp-bar">
          <button className="mp-arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous page">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div ref={stripRef} className="mp-strip" role="tablist" aria-label="Pages">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === index}
                className={i === index ? 'on' : ''}
                onClick={() => go(i)}
                title={`Mushaf page ${first + i}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button className="mp-arrow" onClick={() => go(index + 1)} disabled={index === total - 1} aria-label="Next page">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      <p className="mp-meta">
        Page <b>{index + 1}</b> of {total}
        <span className="mp-meta-sep" />
        Mushaf page {mushafPage}
      </p>

      {/* ── Page ── */}
      <div
        className="mp-stage"
        onPointerDown={e => { dragX.current = e.clientX; }}
        onPointerUp={e => {
          if (dragX.current === null) return;
          const dx = e.clientX - dragX.current;
          dragX.current = null;
          // Mushaf pages turn right-to-left: swipe right → next page
          if (Math.abs(dx) > 60) go(dx > 0 ? index + 1 : index - 1);
        }}
      >
        {error ? (
          <div className="mp-error">
            <span className="material-symbols-outlined">cloud_off</span>
            <p>{error}</p>
            <button onClick={() => setRetry(r => r + 1)}>Try again</button>
          </div>
        ) : !shown ? (
          <MushafLoader label={`Preparing page ${index + 1}`} />
        ) : (
          <div key={mushafPage} className="mp-page uth-page uth-step-4 uth-ar uth-qcf uth-big">
            <div className="uth-reader">
              {data.startsSurah && (
                <div className="mp-surah-head">
                  <span className="mp-surah-head-line" />
                  <div className="mp-surah-head-name">
                    <span className="font-arabic" lang="ar">سُورَةُ {surahArabic}</span>
                    <small>{surahNumber}. {surahName}</small>
                  </div>
                  <span className="mp-surah-head-line" />
                </div>
              )}
              {showBismillah && (
                <div className="mp-bismillah" aria-label="Bismillah">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/bismillah.svg" alt="" />
                </div>
              )}
              <div className="uth-ar-page">
                <div className="uth-ar-lines">
                  {data.lines.map(l => (
                    <div key={l.line} className="uth-ar-line">
                      <div className={`uth-ar-words${isCenterLine(mushafPage, l.line) ? ' is-center' : ' is-spread'}`} lang="ar">
                        {l.words.map(w => {
                          const inAyah = reciting?.verse === w.verseNumber;
                          const lit = inAyah && !w.end && reciting?.word === w.position;
                          return (
                            <span
                              key={w.key}
                              id={w.position === 1 ? `verse-${w.verseNumber}` : undefined}
                              className={`uth-ar-word${w.stop ? ' stop' : ''}${inAyah ? ' is-ayah' : ''}${lit ? ' is-reciting' : ''}${onPlayVerse ? ' is-tappable' : ''}`}
                              style={{ fontFamily: `p${mushafPage}-v2, UthmanicHafs, serif` }}
                              onClick={onPlayVerse ? () => onPlayVerse(w.verseNumber) : undefined}
                              dangerouslySetInnerHTML={{ __html: escapeGlyph(w.glyph) }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="uth-ar-footer">{mushafPage}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <nav className="mp-nav" aria-label="Page navigation">
        {index > 0 ? (
          <button className="mp-nav-btn" onClick={() => go(index - 1)}>
            <span className="material-symbols-outlined">arrow_back</span>
            <span><small>Previous</small><b>Page {index}</b></span>
          </button>
        ) : surahNumber > 1 ? (
          <Link className="mp-nav-btn" href={`/read-quran/${surahNumber - 1}?${linkQuery}`}>
            <span className="material-symbols-outlined">arrow_back</span>
            <span><small>Previous</small><b>Surah {surahNumber - 1}</b></span>
          </Link>
        ) : <span />}

        {index < total - 1 ? (
          <button className="mp-nav-btn next" onClick={() => go(index + 1)}>
            <span><small>Next</small><b>Page {index + 2}</b></span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        ) : surahNumber < 114 ? (
          <Link className="mp-nav-btn next" href={`/read-quran/${surahNumber + 1}?${linkQuery}`}>
            <span><small>Finished · next surah</small><b>Surah {surahNumber + 1}</b></span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        ) : <span />}
      </nav>
      {total > 1 && <p className="mp-hint">Swipe, or press <kbd>[</kbd> <kbd>]</kbd> to turn pages</p>}
    </div>
  );
}
