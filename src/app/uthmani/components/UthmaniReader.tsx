'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import '../styles/uthmani.css';

const API = 'https://api.quran.com/api/v4';

/** Pause / stop marks that take the wider word gap. */
const STOP_CHARS = new Set([
  '\u06D6',
  '\u06D7',
  '\u06D8',
  '\u06D9',
  '\u06DA',
  '\u06DB',
  '\u06DC',
  '\u06E2',
  '\u0615',
  '\u06EA',
  '\u06EB',
  '\u0617',
  '\u06E5',
]);

interface Word {
  position: number;
  char_type_name?: string;
  text_uthmani?: string;
  code_v2?: string;
  line_number?: number;
  page_number?: number;
}

interface DisplayWord {
  text: string;
  glyph: string;
  stop: boolean;
  position: number;
  verseNumber: number;
  verseKey: string;
  line: number;
  page: number;
  end: boolean;
}

interface Verse {
  id: number;
  verse_key: string;
  verse_number: number;
  page_number: number;
  text_uthmani: string;
  translation: string;
  words: DisplayWord[];
}

interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  bismillah_pre: boolean;
  verses_count: number;
  translated_name: { name: string };
}

const loadedPageFonts = new Set<string>();

async function loadPageFont(pageNumber: number) {
  const fontName = `p${pageNumber}-v2`;
  if (loadedPageFonts.has(fontName) || typeof document === 'undefined') return;
  const url = `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`;
  if (!document.getElementById(`qcf-${fontName}`)) {
    const style = document.createElement('style');
    style.id = `qcf-${fontName}`;
    style.textContent = `@font-face{font-family:'${fontName}';src:url('${url}') format('woff2');font-display:block;}`;
    document.head.appendChild(style);
  }
  try {
    const face = new FontFace(fontName, `url('${url}')`);
    await face.load();
    document.fonts.add(face);
  } catch {
    /* CSS @font-face still applies */
  }
  loadedPageFonts.add(fontName);
}

function escapeGlyph(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hasStop(text: string): boolean {
  return Array.from(text).some((ch) => STOP_CHARS.has(ch));
}

function wordsFromVerse(verse: {
  verse_key?: string;
  verse_number?: number;
  page_number?: number;
  text_uthmani?: string;
  words?: Word[];
}): DisplayWord[] {
  const pageFallback = verse.page_number || 1;
  const fromWords = (verse.words || [])
    .filter((w) => w.text_uthmani)
    .map((w) => ({
      text: w.text_uthmani as string,
      glyph: w.code_v2 || (w.text_uthmani as string),
      stop: hasStop(w.text_uthmani as string),
      position: w.position,
      verseNumber: verse.verse_number || 1,
      verseKey: verse.verse_key || '',
      line: w.line_number || 1,
      page: w.page_number || pageFallback,
      end: w.char_type_name === 'end',
    }));
  if (fromWords.length) return fromWords;
  return (verse.text_uthmani || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((text, i) => ({
      text,
      glyph: text,
      stop: hasStop(text),
      position: i + 1,
      verseNumber: verse.verse_number || 1,
      verseKey: verse.verse_key || '',
      line: 1,
      page: pageFallback,
      end: false,
    }));
}

/** Pages and lines Quran.com center-aligns in the Madani mushaf. */
const CENTER_PAGES = new Set([1, 2]);
const CENTER_LINES: Record<number, number[]> = {
  255: [2],
  528: [9],
  534: [6],
  545: [6],
  586: [1],
  593: [2],
  594: [5],
  600: [10],
  602: [5, 15],
  603: [10, 15],
  604: [4, 9, 14, 15],
};

function isCenterLine(page: number, line: number): boolean {
  return CENTER_PAGES.has(page) || (CENTER_LINES[page] || []).includes(line);
}

async function fetchChapter(id: number): Promise<Chapter> {
  const res = await fetch(`${API}/chapters/${id}?language=en`);
  if (!res.ok) throw new Error('Failed to load surah');
  const data = await res.json();
  return data.chapter;
}

async function fetchVerses(id: number): Promise<Verse[]> {
  const collected: Verse[] = [];
  let page = 1;
  let next: number | null = 1;

  while (next) {
    const url =
      `${API}/verses/by_chapter/${id}?language=en&words=true&translations=131` +
      `&fields=text_uthmani,code_v2&word_fields=code_v2,text_uthmani,char_type_name,line_number,page_number` +
      `&translation_fields=text&per_page=50&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load verses');
    const data = await res.json();
    for (const verse of data.verses || []) {
      collected.push({
        id: verse.id,
        verse_key: verse.verse_key,
        verse_number: verse.verse_number,
        page_number: verse.page_number || verse.words?.[0]?.page_number || 1,
        text_uthmani: verse.text_uthmani || '',
        translation: verse.translations?.[0]?.text || '',
        words: wordsFromVerse(verse),
      });
    }
    next = data.pagination?.next_page ?? null;
    page = next || page + 1;
  }

  return collected;
}

interface UthmaniReaderProps {
  surahNumber: number;
  startingVerse?: number | null;
  readingMode?: 'arabic' | 'translation';
  /** Surah links, e.g. `/read-quran`. Defaults to `/uthmani`. */
  linkBase?: string;
  /** Query string without `?`, used on surah links. */
  linkQuery?: string;
}

export default function UthmaniReader({
  surahNumber,
  startingVerse = null,
  readingMode = 'arabic',
  linkBase = '/uthmani',
  linkQuery,
}: UthmaniReaderProps) {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [step, setStep] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchChapter(surahNumber), fetchVerses(surahNumber)])
      .then(([ch, vs]) => {
        if (cancelled) return;
        setChapter(ch);
        setVerses(vs);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [surahNumber]);

  const pageNumbers = Array.from(new Set(verses.flatMap((v) => v.words.map((w) => w.page)))).sort((a, b) => a - b);
  const pageKey = pageNumbers.join(',');

  useEffect(() => {
    if (readingMode !== 'arabic' || !pageNumbers.length) {
      setFontsReady(readingMode !== 'arabic');
      return;
    }
    let cancelled = false;
    setFontsReady(false);
    Promise.all(pageNumbers.map((n) => loadPageFont(n))).finally(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [readingMode, pageKey]);

  useEffect(() => {
    if (loading || !fontsReady || readingMode !== 'arabic' || !startingVerse) return;
    const el = document.getElementById(`verse-${startingVerse}`);
    el?.scrollIntoView({ block: 'center' });
  }, [loading, fontsReady, readingMode, startingVerse, surahNumber]);

  const showBismillah = Boolean(chapter?.bismillah_pre) && surahNumber !== 1 && surahNumber !== 9;
  const query = new URLSearchParams();
  if (!linkQuery && readingMode === 'arabic') query.set('readingMode', 'arabic');
  if (!linkQuery && startingVerse) query.set('startingVerse', String(startingVerse));
  const queryString = linkQuery ? `?${linkQuery}` : query.toString() ? `?${query.toString()}` : '';
  const arabic = readingMode === 'arabic';

  const pages = arabic
    ? verses.reduce<{ page: number; lines: { key: string; page: number; line: number; words: DisplayWord[] }[] }[]>(
        (acc, verse) => {
          for (const word of verse.words) {
            let pageBlock = acc[acc.length - 1];
            if (!pageBlock || pageBlock.page !== word.page) {
              pageBlock = { page: word.page, lines: [] };
              acc.push(pageBlock);
            }
            const lineKey = `${word.page}-${word.line}`;
            let line = pageBlock.lines[pageBlock.lines.length - 1];
            if (!line || line.key !== lineKey) {
              line = { key: lineKey, page: word.page, line: word.line, words: [] };
              pageBlock.lines.push(line);
            }
            line.words.push(word);
          }
          return acc;
        },
        []
      )
    : [];

  return (
    <div className={`uth-page uth-step-${step}${arabic ? ' uth-ar uth-qcf' : ''}${step > 3 ? ' uth-big' : ''}`}>
      <main className="uth-reader">
        {!arabic && (
        <div className="uth-top">
          <h1 className="uth-title">
            {chapter ? `${chapter.id}. Surah ${chapter.name_simple}` : 'Uthmanic Hafs'}
            {chapter && <span> · {chapter.translated_name.name}</span>}
          </h1>
          <div className="uth-steps">
            <span>Size {step}</span>
            <button type="button" disabled={step <= 1} onClick={() => setStep((n) => n - 1)} aria-label="Smaller">
              −
            </button>
            <button type="button" disabled={step >= 10} onClick={() => setStep((n) => n + 1)} aria-label="Larger">
              +
            </button>
          </div>
        </div>
        )}

        {showBismillah && !arabic && (
          <div className="uth-bismillah" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bismillah.svg" alt="" />
          </div>
        )}

        {loading && <p className="uth-status">Loading…</p>}
        {!loading && arabic && !fontsReady && <p className="uth-status">Loading…</p>}
        {error && <p className="uth-status">{error}</p>}

        {!loading && !error && fontsReady && arabic &&
          pages.map((page) => (
            <div key={page.page} id={`page-${page.page}`} className="uth-ar-page">
              <div className="uth-ar-lines">
                {page.lines.map((line) => (
                  <div key={line.key} className="uth-ar-line">
                    <div
                      className={`uth-ar-words${isCenterLine(line.page, line.line) ? ' is-center' : ' is-spread'}`}
                      lang="ar"
                    >
                      {line.words.map((word) => {
                        const isStarting = startingVerse != null && word.verseNumber === startingVerse;
                        return (
                          <span
                            key={`${word.verseKey}-${word.position}`}
                            id={word.position === 1 ? `verse-${word.verseNumber}` : undefined}
                            className={`uth-ar-word${isStarting ? ' is-starting' : ''}${word.stop ? ' stop' : ''}`}
                            style={{ fontFamily: `p${word.page}-v2, UthmanicHafs, serif` }}
                            dangerouslySetInnerHTML={{ __html: escapeGlyph(word.glyph) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="uth-ar-footer">{page.page}</p>
            </div>
          ))}

        {!loading &&
          !error &&
          !arabic &&
          verses.map((verse) => {
            const isStarting = startingVerse != null && verse.verse_number === startingVerse;
            return (
              <article
                key={verse.verse_key}
                id={`verse-${verse.verse_number}`}
                className={`uth-verse${isStarting ? ' is-starting' : ''}`}
              >
                <div className="uth-verse-toolbar">
                  <span>{verse.verse_key}</span>
                </div>
                <div className="uth-arabic-block">
                  <p className="uthmaniVerse" lang="ar">
                    {verse.words
                      .filter((word) => !word.end)
                      .map((word, i) => (
                        <span key={`${verse.verse_key}-${i}`} className={word.stop ? 'stop' : undefined}>
                          {word.text}
                        </span>
                      ))}
                  </p>
                </div>
                <p className="uth-translation">{verse.translation}</p>
              </article>
            );
          })}

        <div className="uth-nav">
          {surahNumber > 1 ? (
            <Link href={`${linkBase}/${surahNumber - 1}${queryString}`}>Previous surah</Link>
          ) : (
            <span />
          )}
          {surahNumber < 114 ? (
            <Link href={`${linkBase}/${surahNumber + 1}${queryString}`}>Next surah</Link>
          ) : (
            <span />
          )}
        </div>
      </main>
    </div>
  );
}
