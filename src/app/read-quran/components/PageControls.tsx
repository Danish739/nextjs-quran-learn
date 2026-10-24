'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import '../styles/mushaf-pager.css';

/** Reads the 1-based `?page=` (page within the surah) as a 0-based index. */
export function readPageParam(total: number): number {
  if (typeof window === 'undefined') return 0;
  const p = Number(new URLSearchParams(window.location.search).get('page'));
  return p >= 1 && p <= total ? p - 1 : 0;
}

/** Keeps `?page=` in the URL so refresh / sharing / switching modes return to the same page. */
export function writePageParam(index: number) {
  const url = new URL(window.location.href);
  if (index > 0) url.searchParams.set('page', String(index + 1));
  else url.searchParams.delete('page');
  window.history.replaceState(null, '', url.toString());
}

interface BarProps {
  index: number;
  total: number;
  firstPage: number;
  onGo: (i: number) => void;
}

/** Sticky strip of page numbers with prev/next arrows, plus the "Page x of y" line. */
export function PageBar({ index, total, firstPage, onGo }: BarProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stripRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  return (
    <>
      {total > 1 && (
        <div className="mp-bar">
          <button className="mp-arrow" onClick={() => onGo(index - 1)} disabled={index === 0} aria-label="Previous page">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div ref={stripRef} className="mp-strip" role="tablist" aria-label="Pages">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === index}
                className={i === index ? 'on' : ''}
                onClick={() => onGo(i)}
                title={`Mushaf page ${firstPage + i}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button className="mp-arrow" onClick={() => onGo(index + 1)} disabled={index === total - 1} aria-label="Next page">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}
      <p className="mp-meta">
        Page <b>{index + 1}</b> of {total}
        <span className="mp-meta-sep" />
        Mushaf page {firstPage + index}
      </p>
    </>
  );
}

interface NavProps extends BarProps {
  surahNumber: number;
  linkQuery: string;
}

/** Previous / next page buttons; at the ends they lead to the neighbouring surah. */
export function PageNav({ index, total, onGo, surahNumber, linkQuery }: NavProps) {
  return (
    <>
      <nav className="mp-nav" aria-label="Page navigation">
        {index > 0 ? (
          <button className="mp-nav-btn" onClick={() => onGo(index - 1)}>
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
          <button className="mp-nav-btn next" onClick={() => onGo(index + 1)}>
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
      {total > 1 && <p className="mp-hint">Press <kbd>[</kbd> <kbd>]</kbd> to turn pages</p>}
    </>
  );
}
