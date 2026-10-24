'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { surahList } from '../audio-quran/surahList';
import { loadQcfFontsForPages, qcfFontFamily } from '../read-quran/lib/qcf';

const EVERYAYAH = 'https://everyayah.com/data';
const QURAN_API = 'https://api.quran.com/api/v4';
const ARABIC_FOLDER = 'Alafasy_128kbps';

interface Lang {
  id: string;
  name: string;
  native: string;
  dir: 'ltr' | 'rtl';
  /** everyayah.com sub-folder holding the verse-by-verse translation audio */
  folder: string;
  reciter: string;
  /** api.quran.com translation id used for the on-screen text */
  textId: number;
  textBy: string;
  /** true when the on-screen translator is the same person as the audio */
  sameSource: boolean;
}

const LANGS: Lang[] = [
  { id: 'en', name: 'English', native: 'English', dir: 'ltr', folder: 'English/Sahih_Intnl_Ibrahim_Walk_192kbps', reciter: 'Ibrahim Walk', textId: 20, textBy: 'Saheeh International', sameSource: true },
  { id: 'ur', name: 'Urdu', native: 'اردو', dir: 'rtl', folder: 'translations/urdu_shamshad_ali_khan_46kbps', reciter: 'Shamshad Ali Khan', textId: 234, textBy: 'Fateh Muhammad Jalandhari', sameSource: false },
  { id: 'fa', name: 'Persian', native: 'فارسی', dir: 'rtl', folder: 'translations/Makarem_Kabiri_16Kbps', reciter: 'Kabiri (Makarem)', textId: 29, textBy: 'Hussein Taji Kal Dari', sameSource: false },
  { id: 'az', name: 'Azerbaijani', native: 'Azərbaycanca', dir: 'ltr', folder: 'translations/azerbaijani/balayev', reciter: 'Balayev', textId: 75, textBy: 'Alikhan Musayev', sameSource: false },
  { id: 'bs', name: 'Bosnian', native: 'Bosanski', dir: 'ltr', folder: 'translations/besim_korkut_ajet_po_ajet', reciter: 'Besim Korkut', textId: 126, textBy: 'Besim Korkut', sameSource: true },
];

type Mode = 'translation' | 'both';
const SPEEDS = [0.75, 1, 1.25, 1.5];
const PREF_KEY = 'translation-audio-prefs';

interface GlyphWord {
  id?: number;
  code_v2: string;
  page_number?: number;
  char_type_name?: string;
}

interface Ayah {
  n: number;
  ar: string;
  /** Mushaf glyph words, the same data and page fonts Read Quran renders with */
  words: GlyphWord[];
  tr: string;
}

const escapeGlyph = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pad = (n: number, w = 3) => String(n).padStart(w, '0');
const fileName = (s: number, a: number) => `${pad(s)}${pad(a)}.mp3`;
const stripTags = (t: string) => t.replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/<[^>]+>/g, '').trim();

async function loadAyahs(surah: number, textId: number): Promise<Ayah[]> {
  const [ar, tr] = await Promise.all([
    fetch(`${QURAN_API}/verses/by_chapter/${surah}?words=true&mushaf=1&fields=text_uthmani&word_fields=code_v2,page_number,char_type_name&per_page=300`).then(r => r.json()),
    fetch(`${QURAN_API}/quran/translations/${textId}?chapter_number=${surah}`).then(r => r.json()),
  ]);
  const verses = ar.verses as { text_uthmani: string; words?: GlyphWord[] }[];
  const trs = tr.translations as { text: string }[];
  const rows = verses.map((v, i) => ({
    n: i + 1,
    ar: v.text_uthmani,
    words: (v.words ?? []).filter(w => w.code_v2),
    tr: stripTags(trs[i]?.text ?? ''),
  }));
  loadQcfFontsForPages(rows.flatMap(r => r.words.map(w => w.page_number ?? 1)));
  return rows;
}

export default function TranslationAudioClient() {
  const [langId, setLangId] = useState('en');
  const [surah, setSurah] = useState(1);
  const [mode, setMode] = useState<Mode>('both');
  const [speed, setSpeed] = useState(1);
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [current, setCurrent] = useState(1);
  const [phase, setPhase] = useState<'ar' | 'tr'>('tr');
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [query, setQuery] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rowRefs = useRef<Record<number, HTMLElement | null>>({});
  const lang = LANGS.find(l => l.id === langId)!;
  const meta = surahList[surah - 1];

  // Refs mirror state so audio event handlers never read stale values
  const live = useRef({ lang, surah, mode, speed, count: 0, current, phase });
  live.current = { lang, surah, mode, speed, count: meta?.ayahs ?? 0, current, phase };

  /* ---- restore preferences (URL first, then last session) ---- */
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      const l = q.get('lang') ?? saved.lang;
      const s = Number(q.get('surah') ?? saved.surah);
      if (LANGS.some(x => x.id === l)) setLangId(l);
      if (s >= 1 && s <= 114) setSurah(s);
      if (saved.mode === 'both' || saved.mode === 'translation') setMode(saved.mode);
      if (SPEEDS.includes(saved.speed)) setSpeed(saved.speed);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ lang: langId, surah, mode, speed })); } catch { /* ignore */ }
  }, [langId, surah, mode, speed]);

  /* ---- load text ---- */
  useEffect(() => {
    let alive = true;
    setAyahs(null);
    setError(false);
    loadAyahs(surah, lang.textId).then(a => alive && setAyahs(a)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [surah, lang.textId, attempt]);

  /* ---- audio ---- */
  const srcFor = useCallback((s: number, a: number, ph: 'ar' | 'tr', l: Lang) =>
    `${EVERYAYAH}/${ph === 'ar' ? ARABIC_FOLDER : l.folder}/${fileName(s, a)}`, []);

  const playAt = useCallback((a: number, ph: 'ar' | 'tr') => {
    const { lang: l, surah: s, speed: sp } = live.current;
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.src = srcFor(s, a, ph, l);
    el.playbackRate = sp;
    setCurrent(a);
    setPhase(ph);
    setAudioError(false);
    el.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setAudioError(true); });
  }, [srcFor]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const startVerse = useCallback((a: number) => {
    playAt(a, live.current.mode === 'both' ? 'ar' : 'tr');
  }, [playAt]);

  useEffect(() => {
    const el = (audioRef.current ??= new Audio());
    const onEnded = () => {
      const { mode: m, phase: ph, current: cur, count } = live.current;
      if (m === 'both' && ph === 'ar') return playAt(cur, 'tr');
      if (cur < count) return playAt(cur + 1, m === 'both' ? 'ar' : 'tr');
      setPlaying(false);
    };
    const onError = () => { setPlaying(false); setAudioError(true); };
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.pause();
    };
  }, [playAt]);

  // Changing language, surah or speed while playing restarts cleanly
  useEffect(() => { audioRef.current && (audioRef.current.playbackRate = speed); }, [speed]);
  useEffect(() => {
    stop();
    setCurrent(1);
    setPhase('tr');
    setAudioError(false);
  }, [surah, langId, stop]);

  // Keep the playing ayah in view
  useEffect(() => {
    if (!playing) return;
    rowRefs.current[current]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [current, playing]);

  const toggle = () => {
    if (playing) return stop();
    if (audioRef.current?.src && audioRef.current.currentTime > 0 && !audioRef.current.ended) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setAudioError(true));
    } else {
      startVerse(current);
    }
  };
  const step = (d: number) => {
    const n = Math.min(live.current.count, Math.max(1, current + d));
    startVerse(n);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahList;
    return surahList.filter(s => `${s.number} ${s.englishName} ${s.englishNameTranslation}`.toLowerCase().includes(q));
  }, [query]);

  const progress = meta?.ayahs ? Math.round((current / meta.ayahs) * 100) : 0;

  return (
    <main className="ta">
      <section className="ta-hero">
        <div className="ta-wrap">
          <span className="ta-kicker">ترجمة · Translation audio</span>
          <h1>Hear the Quran in <em>your language</em></h1>
          <p>Ayah-by-ayah translation audio, optionally after each Arabic ayah, with the text on screen so you can follow along.</p>
        </div>
      </section>

      <div className="ta-wrap ta-layout">
        {/* ---- controls ---- */}
        <aside className="ta-side">
          <h2>1 · Language</h2>
          <div className="ta-langs" role="radiogroup" aria-label="Translation language">
            {LANGS.map(l => (
              <button key={l.id} role="radio" aria-checked={l.id === langId} className={`ta-lang${l.id === langId ? ' on' : ''}`} onClick={() => setLangId(l.id)}>
                <strong>{l.name}</strong>
                <span dir={l.dir}>{l.native}</span>
                <small>{l.reciter}</small>
              </button>
            ))}
          </div>

          <h2>2 · Surah</h2>
          <input className="ta-search" placeholder="Search surah…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search surah" />
          <ul className="ta-surahs">
            {filtered.map(s => (
              <li key={s.number}>
                <button className={s.number === surah ? 'on' : ''} onClick={() => setSurah(s.number)}>
                  <b>{s.number}</b>
                  <span>{s.englishName}<small>{s.englishNameTranslation}</small></span>
                  <em>{s.ayahs}</em>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="ta-none">No surah found</li>}
          </ul>
        </aside>

        {/* ---- reader ---- */}
        <section className="ta-main">
          <header className="ta-main-head">
            <div>
              <h2>{meta.number}. {meta.englishName}</h2>
              <p>{meta.englishNameTranslation} · {meta.ayahs} ayahs</p>
            </div>
            <div className="ta-opts">
              <div className="ta-seg" role="group" aria-label="What to play">
                <button className={mode === 'both' ? 'on' : ''} onClick={() => setMode('both')}>Arabic + {lang.name}</button>
                <button className={mode === 'translation' ? 'on' : ''} onClick={() => setMode('translation')}>{lang.name} only</button>
              </div>
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Playback speed">
                {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
              </select>
            </div>
          </header>

          {!lang.sameSource && (
            <p className="ta-note">
              Audio is by {lang.reciter}. The on-screen text is {lang.textBy}, so wording can differ slightly from what you hear.
            </p>
          )}

          {error && (
            <div className="ta-state">
              Couldn’t load the text. <button onClick={() => setAttempt(a => a + 1)}>Retry</button>
            </div>
          )}
          {!error && !ayahs && <div className="ta-skel">{[0, 1, 2, 3].map(i => <i key={i} />)}</div>}

          <ol className="ta-list">
            {ayahs?.map(a => {
              const on = a.n === current;
              return (
                <li key={a.n} ref={el => { rowRefs.current[a.n] = el; }} className={`ta-ayah${on ? ' on' : ''}${on && playing ? ' playing' : ''}`}>
                  <button className="ta-ayah-play" onClick={() => (on && playing ? stop() : startVerse(a.n))} aria-label={on && playing ? `Pause ayah ${a.n}` : `Play ayah ${a.n}`}>
                    <span className="material-symbols-outlined">{on && playing ? 'pause' : 'play_arrow'}</span>
                    <small>{a.n}</small>
                  </button>
                  <div className="ta-ayah-body">
                    <p className={`ta-ar${a.words.length ? ' is-qcf' : ' font-arabic'}${on && playing && phase === 'ar' ? ' hot' : ''}`} dir="rtl" lang="ar">
                      {a.words.length ? a.words.map((w, i) => (
                        <span key={w.id ?? i}>
                          <span
                            className={w.char_type_name === 'end' ? 'ta-qcf-end' : undefined}
                            style={{ fontFamily: `${qcfFontFamily(w.page_number ?? 1)}, UthmanicHafs, serif` }}
                            dangerouslySetInnerHTML={{ __html: escapeGlyph(w.code_v2) }}
                          />
                          {i < a.words.length - 1 ? ' ' : ''}
                        </span>
                      )) : a.ar}
                    </p>
                    <p className={`ta-tr${on && playing && phase === 'tr' ? ' hot' : ''}`} dir={lang.dir} lang={lang.id}>{a.tr}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* ---- player ---- */}
      <div className="ta-player" role="region" aria-label="Player">
        <span className="ta-bar" style={{ width: `${progress}%` }} aria-hidden="true" />
        <div className="ta-player-info">
          <b>{meta.englishName} · {current}/{meta.ayahs}</b>
          <span>
            {audioError ? 'Audio unavailable — try again' : playing ? (phase === 'ar' ? 'Arabic recitation' : `${lang.name} translation`) : `${lang.name} · ${lang.reciter}`}
          </span>
        </div>
        <div className="ta-player-btns">
          <button onClick={() => step(-1)} disabled={current <= 1} aria-label="Previous ayah"><span className="material-symbols-outlined">skip_previous</span></button>
          <button className="main" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><span className="material-symbols-outlined">{playing ? 'pause' : 'play_arrow'}</span></button>
          <button onClick={() => step(1)} disabled={current >= (meta.ayahs ?? 1)} aria-label="Next ayah"><span className="material-symbols-outlined">skip_next</span></button>
        </div>
      </div>
    </main>
  );
}
