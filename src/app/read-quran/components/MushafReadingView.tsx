'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Info, Play } from 'lucide-react';
import type { Chapter, VerseWithTranslation, Word } from '../lib/api';
import '../styles/mushaf-reading.css';

type MushafWord = Word & {
  verse_key: string;
  verse_number: number;
  code_v2?: string;
  line_number?: number;
  page_number?: number;
};

type MushafLine = {
  key: string;
  page: number;
  line: number;
  verseKey: string;
  words: MushafWord[];
  uthmani: string;
};

type PageBlock = {
  page: number;
  lines: MushafLine[];
};

const loadedFonts = new Set<string>();

async function loadPageFont(pageNumber: number): Promise<string> {
  const fontName = `p${pageNumber}-v2`;
  if (loadedFonts.has(fontName) || typeof document === 'undefined') {
    return fontName;
  }

  const url = `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`;

  // CSS @font-face (reliable path used by Quran.com)
  const styleId = `qcf-font-${fontName}`;
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @font-face {
        font-family: '${fontName}';
        src: url('${url}') format('woff2');
        font-display: block;
      }
    `;
    document.head.appendChild(style);
  }

  try {
    const face = new FontFace(fontName, `url('${url}')`, { display: 'block' });
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    // CSS @font-face still applies; FontFace API may fail under some CSP/CDN cases
    console.warn(`FontFace load warning for ${fontName}`, err);
  }

  loadedFonts.add(fontName);
  return fontName;
}

function groupLinesByPage(verses: VerseWithTranslation[]): PageBlock[] {
  const lineMap = new Map<string, MushafLine>();

  for (const verse of verses) {
    for (const word of verse.words || []) {
      const page = word.page_number || verse.page_number || 1;
      const line = word.line_number || 1;
      const key = `${page}-${line}`;
      const mushafWord: MushafWord = {
        ...word,
        verse_key: verse.verse_key,
        verse_number: verse.verse_number,
        page_number: page,
        line_number: line,
      };

      const existing = lineMap.get(key);
      if (existing) {
        existing.words.push(mushafWord);
        if (word.text_uthmani) {
          existing.uthmani = `${existing.uthmani} ${word.text_uthmani}`.trim();
        }
      } else {
        lineMap.set(key, {
          key,
          page,
          line,
          verseKey: verse.verse_key,
          words: [mushafWord],
          uthmani: word.text_uthmani || '',
        });
      }
    }
  }

  const lines = Array.from(lineMap.values()).sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.line - b.line;
  });

  const pages: PageBlock[] = [];
  for (const line of lines) {
    const last = pages[pages.length - 1];
    if (last && last.page === line.page) {
      last.lines.push(line);
    } else {
      pages.push({ page: line.page, lines: [line] });
    }
  }
  return pages;
}

interface MushafReadingViewProps {
  chapter: Chapter;
  surahNumber: number;
  verses: VerseWithTranslation[];
  fontSize: number;
  activeVerse?: number | null;
  onPlayVerse?: (verseNumber: number) => void;
  onListenSurah?: () => void;
  listening?: boolean;
}

export default function MushafReadingView({
  chapter,
  surahNumber,
  verses,
  fontSize,
  activeVerse,
  onPlayVerse,
  onListenSurah,
  listening,
}: MushafReadingViewProps) {
  const [fontsReady, setFontsReady] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const pages = useMemo(() => groupLinesByPage(verses), [verses]);
  const pageNumbers = useMemo(() => pages.map((p) => p.page), [pages]);

  const pageKey = pageNumbers.join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFontsReady(false);
      await Promise.all(pageNumbers.map((n) => loadPageFont(n)));
      if (!cancelled) setFontsReady(true);
    }
    if (pageNumbers.length) load();
    else setFontsReady(true);
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  const glyphSize = Math.max(28, Math.min(64, Math.round(fontSize * 1.05)));

  if (!verses.length) {
    return <div className="qc-empty">No verses available.</div>;
  }

  const hasWordLines = pages.some((p) => p.lines.length > 0);

  return (
    <div
      className="qc-page qc-page--center"
      style={
        {
          '--qc-glyph-size': `${glyphSize}px`,
          '--qc-line-width': 'min(100%, 720px)',
        } as CSSProperties
      }
    >
      <header className="qc-header">
        <div className="qc-header-card">
          <div className="qc-title-row">
            <div className="qc-surah-glyph" aria-hidden dir="rtl">
              {chapter.name_arabic}
            </div>
            <div className="qc-title-divider" aria-hidden />
            <div className="qc-title-text">
              <h1 className="qc-transliterated">
                {surahNumber}. Surah {chapter.name_simple}
              </h1>
              <h2 className="qc-translated">{chapter.translated_name.name}</h2>
              <p className="qc-seo-intro">
                Read and listen to Surah {chapter.name_simple} with translation,
                tafsir, audio recitation, word-by-word meaning, and transliteration.
              </p>
            </div>
          </div>

          <div className="qc-top-controls">
            <div className="qc-primary-actions">
              <button
                type="button"
                className={`qc-pill${listening ? ' is-selected' : ''}`}
                onClick={onListenSurah}
                aria-label={`Play Surah ${chapter.name_simple}`}
              >
                <Play size={14} fill="currentColor" />
                Listen
              </button>
              <Link
                href={`/tafseer/${surahNumber}`}
                className="qc-pill"
                aria-label="Surah Info"
              >
                <Info size={14} />
                Info
              </Link>
            </div>
            <div className="qc-secondary-actions">
              <button
                type="button"
                className={`qc-pill${!showTranslation ? ' is-selected' : ''}`}
                onClick={() => setShowTranslation(false)}
              >
                Arabic
              </button>
              <button
                type="button"
                className={`qc-pill${showTranslation ? ' is-selected' : ''}`}
                onClick={() => setShowTranslation(true)}
              >
                Translation
              </button>
            </div>
          </div>
        </div>
      </header>

      {!fontsReady && <div className="qc-loading">Loading mushaf fonts…</div>}

      {fontsReady && hasWordLines ? (
        pages.map((page) => (
          <div key={page.page} id={`page-${page.page}`} className="qc-lines" data-testid="mushaf-lines-container">
            {page.lines.map((line) => {
              const fontFamily = `p${line.page}-v2`;
              return (
                <div
                  key={line.key}
                  id={`Page${line.page}-Line${line.line}`}
                  className="qc-line"
                  data-verse-key={line.verseKey}
                  data-page={line.page}
                  data-chapter-id={surahNumber}
                >
                  <div className="qc-seo-hidden">
                    <div>{line.uthmani}</div>
                  </div>
                  <div className="qc-line-inner">
                    {line.words.map((word) => {
                      const isActive = activeVerse === word.verse_number;
                      const isStart =
                        word.verse_number === 1 && word.position === 1;
                      const glyph = word.code_v2 || word.text_uthmani || '';
                      return (
                        <div
                          key={`${word.verse_key}-${word.position}-${word.id}`}
                          role="button"
                          tabIndex={0}
                          data-word-location={`${word.verse_key}:${word.position}`}
                          className={`qc-word${isActive ? ' is-active' : ''}${isStart ? ' is-starting' : ''}`}
                          id={
                            word.position === 1
                              ? `verse-${word.verse_number}`
                              : undefined
                          }
                          onClick={() => onPlayVerse?.(word.verse_number)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onPlayVerse?.(word.verse_number);
                            }
                          }}
                        >
                          <span
                            className="qc-glyph"
                            translate="no"
                            style={{ fontFamily }}
                            dangerouslySetInnerHTML={{ __html: glyph }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {showTranslation && (
              <div style={{ maxWidth: 720, width: '100%', marginTop: 16, direction: 'ltr', textAlign: 'start' }}>
                {verses
                  .filter((v) => (v.page_number || 1) === page.page)
                  .map((v) => (
                    <p
                      key={v.verse_key}
                      style={{
                        margin: '0 0 12px',
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: '#475569',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    >
                      <strong style={{ color: '#f59e0b' }}>{v.verse_number}. </strong>
                      {v.translations?.[0]?.text || ''}
                    </p>
                  ))}
              </div>
            )}

            <div className="qc-page-footer">
              <Link href={`/page/${page.page}`} className="qc-page-link">
                {page.page}
              </Link>
            </div>
          </div>
        ))
      ) : fontsReady ? (
        <div className="qc-empty">Mushaf line data unavailable for this surah.</div>
      ) : null}

      <div className="qc-nav">
        {surahNumber > 1 ? (
          <Link href={`/read-quran/${surahNumber - 1}?mode=reading`}>
            <ChevronLeft size={18} />
            Previous Surah
          </Link>
        ) : (
          <span />
        )}
        {surahNumber < 114 ? (
          <Link href={`/read-quran/${surahNumber + 1}?mode=reading`} className="primary">
            Next Surah
            <ChevronRight size={18} />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
