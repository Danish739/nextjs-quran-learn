'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchMushafSurah,
  getAyahText,
  type MushafAyah,
  type MushafMeta,
  type ScriptStyle,
} from '../lib/api';
import MushafSettings, {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
} from './MushafSettings';
import '../styles/mushaf-reader.css';

const CHAPTER_ID = 1;

/** Maps stepper level 1–7 → rem (Quran.com-like reading sizes) */
const FONT_SIZE_MAP: Record<number, number> = {
  1: 1.45,
  2: 1.7,
  3: 1.95,
  4: 2.25,
  5: 2.55,
  6: 2.9,
  7: 3.3,
};

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toEastern(n: number): string {
  return String(n)
    .split('')
    .map((d) => EASTERN_DIGITS[Number(d)] ?? d)
    .join('');
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function MushafReader() {
  const [script, setScript] = useState<ScriptStyle>('uthmani');
  const [linesPerPage, setLinesPerPage] = useState(16);
  const [fontSize, setFontSize] = useState(4);
  const [pageIndex, setPageIndex] = useState(0);
  const [activeAyah, setActiveAyah] = useState(1);

  const [meta, setMeta] = useState<MushafMeta | null>(null);
  const [ayahs, setAyahs] = useState<MushafAyah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMushafSurah(CHAPTER_ID);
        if (cancelled) return;
        setMeta(data.meta);
        setAyahs(data.ayahs);
        setPageIndex(0);

        const params =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : null;
        const starting = Number(params?.get('startingVerse') || 1);
        const first = data.ayahs[0]?.number ?? 1;
        const last = data.ayahs[data.ayahs.length - 1]?.number ?? first;
        setActiveAyah(
          Number.isFinite(starting) && starting >= first && starting <= last
            ? starting
            : first
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load Quran data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const pages = useMemo(() => {
    const chunks: MushafAyah[][] = [];
    for (let i = 0; i < ayahs.length; i += linesPerPage) {
      chunks.push(ayahs.slice(i, i + linesPerPage));
    }
    return chunks.length ? chunks : [[]];
  }, [ayahs, linesPerPage]);

  const safePage = Math.min(pageIndex, pages.length - 1);
  const currentAyahs = pages[safePage] ?? [];
  const rem = FONT_SIZE_MAP[fontSize] ?? FONT_SIZE_MAP[4];

  const handleLinesChange = (lines: number) => {
    setLinesPerPage(lines);
    setPageIndex(0);
  };

  const reload = () => {
    setLoading(true);
    setError(null);
    fetchMushafSurah(CHAPTER_ID)
      .then((data) => {
        setMeta(data.meta);
        setAyahs(data.ayahs);
        setPageIndex(0);
        setActiveAyah(data.ayahs[0]?.number ?? 1);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load Quran data')
      )
      .finally(() => setLoading(false));
  };

  return (
    <div className="mr-page">
      <div className="mr-shell">
        <div className="mr-toolbar">
          <div className="mr-toolbar-title">
            <span className="mr-toolbar-ar" dir="rtl">
              {meta?.nameArabic ?? 'الفاتحة'}
            </span>
            <span className="mr-toolbar-en">
              {meta ? `${meta.number}. ${meta.nameSimple}` : '1. Al-Fatihah'}
            </span>
          </div>
          <MushafSettings
            script={script}
            linesPerPage={linesPerPage}
            fontSize={fontSize}
            onScriptChange={setScript}
            onLinesChange={handleLinesChange}
            onFontSizeChange={(size) =>
              setFontSize(clamp(size, FONT_SIZE_MIN, FONT_SIZE_MAX))
            }
          />
        </div>

        {error && (
          <div className="mr-status mr-status-error" role="alert">
            {error}
            <button type="button" className="mr-retry" onClick={reload}>
              Retry
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="mr-status" aria-live="polite">
            Loading Surah Al-Fatihah…
          </div>
        )}

        {!loading && !error && (
          <article
            className={`mr-reading mr-script-${script}`}
            aria-label={`${meta?.nameSimple ?? 'Al-Fatihah'} reading view`}
          >
            <div className="mr-reading-frame">
              <div
                className="mr-ayah-list"
                dir="rtl"
                lang="ar"
                style={{ fontSize: `${rem}rem` }}
              >
                {currentAyahs.map((ayah) => {
                  const text = getAyahText(ayah, script);
                  const isActive = activeAyah === ayah.number;
                  const showRuku = ayah.isRukuEnd;
                  return (
                    <div key={ayah.key} className="mr-ayah-wrap">
                      {/* IndoPak margin: ruku-in-juz / ع / ayahs-in-ruku */}
                      {showRuku && script === 'indopak' && (
                        <aside
                          className="mr-ruku-margin"
                          aria-label={`Ruku ${ayah.rukuInJuz}, ${ayah.rukuAyahCount} ayahs`}
                        >
                          <span className="mr-ruku-num">
                            {toEastern(ayah.rukuInJuz)}
                          </span>
                          <span className="mr-ruku-ayn">ع</span>
                          <span className="mr-ruku-num">
                            {toEastern(ayah.rukuAyahCount)}
                          </span>
                        </aside>
                      )}

                      <button
                        type="button"
                        className={`mr-ayah-row${isActive ? ' is-active' : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                        aria-label={`Ayah ${ayah.number}`}
                        onClick={() => setActiveAyah(ayah.number)}
                      >
                        {script === 'tajweed' ? (
                          <span
                            className="mr-ayah-text"
                            dangerouslySetInnerHTML={{ __html: text }}
                          />
                        ) : (
                          <span className="mr-ayah-text">{text}</span>
                        )}
                        {showRuku && (
                          <span
                            className="mr-ruku-inline"
                            title="End of ruku"
                            aria-label="End of ruku"
                          >
                            ع
                          </span>
                        )}
                        <span className="mr-ayah-end" aria-hidden>
                          {toEastern(ayah.number)}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mr-page-num" aria-label={`Page ${safePage + 1}`}>
              {safePage + 1}
            </div>

            {pages.length > 1 && (
              <div className="mr-pager">
                <button
                  type="button"
                  className="mr-pager-btn"
                  disabled={safePage <= 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="mr-pager-btn"
                  disabled={safePage >= pages.length - 1}
                  onClick={() =>
                    setPageIndex((p) => Math.min(pages.length - 1, p + 1))
                  }
                >
                  Next
                </button>
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
