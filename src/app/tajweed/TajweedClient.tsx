'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { surahList } from '@/app/audio-quran/surahList';

const QURAN_API = 'https://api.quran.com/api/v4';
const AUDIO_BASE = 'https://verses.quran.com/Alafasy/mp3';

interface Rule {
  id: string;
  group: 'noon' | 'meem' | 'madd' | 'other';
  cls: string;
  name: string;
  arabic: string;
  color: string;
  summary: string;
  how: string;
  letters?: string;
  verse: string;
}

const RULES: Rule[] = [
  {
    id: 'ikhafa',
    group: 'noon',
    cls: 'ikhafa',
    name: 'Ikhfaa',
    arabic: 'إخفاء',
    color: '#d500b7',
    summary: 'Hiding the noon sound',
    how: 'Noon sakinah or tanween is half-hidden with a nasal ghunnah (about 2 counts) when followed by one of 15 letters. The tongue does not touch the roof of the mouth.',
    letters: 'ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك',
    verse: '105:4',
  },
  {
    id: 'iqlab',
    group: 'noon',
    cls: 'iqlab',
    name: 'Iqlaab',
    arabic: 'إقلاب',
    color: '#26bffd',
    summary: 'Converting noon to meem',
    how: 'Before the letter baa, noon sakinah or tanween turns into a hidden meem with ghunnah. Close the lips lightly, without pressing them.',
    letters: 'ب',
    verse: '104:4',
  },
  {
    id: 'idgham_ghunnah',
    group: 'noon',
    cls: 'idgham_ghunnah',
    name: 'Idghaam with Ghunnah',
    arabic: 'إدغام بغنة',
    color: '#169200',
    summary: 'Merging with nasal sound',
    how: 'Noon sakinah or tanween merges into the next letter and carries a ghunnah. This only happens across two words.',
    letters: 'ي ن م و',
    verse: '111:1',
  },
  {
    id: 'idgham_wo_ghunnah',
    group: 'noon',
    cls: 'idgham_wo_ghunnah',
    name: 'Idghaam without Ghunnah',
    arabic: 'إدغام بلا غنة',
    color: '#4aa86a',
    summary: 'Merging with no nasal sound',
    how: 'Noon sakinah or tanween merges completely into laam or raa, with no ghunnah.',
    letters: 'ل ر',
    verse: '104:1',
  },
  {
    id: 'ghunnah',
    group: 'meem',
    cls: 'ghunnah',
    name: 'Ghunnah',
    arabic: 'غنة',
    color: '#0f8a5f',
    summary: 'The nasal sound',
    how: 'A nasal sound held for about 2 counts on a noon or meem with shaddah. It comes from the nasal passage (khayshoom).',
    verse: '114:1',
  },
  {
    id: 'ikhafa_shafawi',
    group: 'meem',
    cls: 'ikhafa_shafawi',
    name: 'Ikhfaa Shafawi',
    arabic: 'إخفاء شفوي',
    color: '#c026d3',
    summary: 'Hiding the meem',
    how: 'Meem sakinah followed by baa is hidden at the lips with ghunnah, and the lips only touch lightly.',
    letters: 'ب',
    verse: '100:11',
  },
  {
    id: 'idgham_shafawi',
    group: 'meem',
    cls: 'idgham_shafawi',
    name: 'Idghaam Shafawi',
    arabic: 'إدغام شفوي',
    color: '#58b800',
    summary: 'Merging two meems',
    how: 'Meem sakinah followed by another meem merges into a single meem shaddah with ghunnah.',
    letters: 'م',
    verse: '4:1',
  },
  {
    id: 'madda_normal',
    group: 'madd',
    cls: 'madda_normal',
    name: 'Madd Tabee’ee',
    arabic: 'مد طبيعي',
    color: '#537fff',
    summary: 'Natural prolongation: 2 counts',
    how: 'The base madd. A long alif, waw or yaa is held for exactly 2 counts when no hamzah or sukoon follows.',
    verse: '1:1',
  },
  {
    id: 'madda_permissible',
    group: 'madd',
    cls: 'madda_permissible',
    name: 'Madd Jaa’iz',
    arabic: 'مد جائز',
    color: '#4050ff',
    summary: 'Permissible: 2, 4 or 6 counts',
    how: 'Applies at a stop on a madd letter or when a hamzah follows in the next word. The reciter chooses the length.',
    verse: '1:5',
  },
  {
    id: 'madda_necessary',
    group: 'madd',
    cls: 'madda_necessary',
    name: 'Madd Laazim',
    arabic: 'مد لازم',
    color: '#000ebc',
    summary: 'Necessary: always 6 counts',
    how: 'A madd letter followed by a permanent sukoon or shaddah in the same word. It is always held for 6 counts.',
    verse: '1:7',
  },
  {
    id: 'madda_obligatory',
    group: 'madd',
    cls: 'madda_obligatory',
    name: 'Madd Waajib',
    arabic: 'مد واجب',
    color: '#2144c1',
    summary: 'Obligatory: 4 to 5 counts',
    how: 'A madd letter followed by a hamzah in the same word. It is held for 4 or 5 counts.',
    verse: '110:1',
  },
  {
    id: 'qalaqah',
    group: 'other',
    cls: 'qalaqah',
    name: 'Qalqalah',
    arabic: 'قلقلة',
    color: '#dd0008',
    summary: 'The echoing bounce',
    how: 'A light echo on a silent letter from the five qalqalah letters. It is strongest when you stop on the letter.',
    letters: 'ق ط ب ج د',
    verse: '112:1',
  },
  {
    id: 'laam_shamsiyah',
    group: 'other',
    cls: 'laam_shamsiyah',
    name: 'Laam Shamsiyyah',
    arabic: 'لام شمسية',
    color: '#8a94a3',
    summary: 'The silent “al”',
    how: 'The laam of “al-” is not pronounced before the 14 sun letters. The next letter takes a shaddah instead.',
    letters: 'ت ث د ذ ر ز س ش ص ض ط ظ ل ن',
    verse: '114:1',
  },
  {
    id: 'ham_wasl',
    group: 'other',
    cls: 'ham_wasl',
    name: 'Hamzat al-Wasl',
    arabic: 'همزة الوصل',
    color: '#9aa3b2',
    summary: 'The connecting hamzah',
    how: 'The hamzah is pronounced only when you start a word with it. When you read through from a previous word, it is silent.',
    verse: '112:1',
  },
];

const GROUPS: { id: Rule['group'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All rules' },
  { id: 'noon', label: 'Noon & Tanween' },
  { id: 'meem', label: 'Meem & Ghunnah' },
  { id: 'madd', label: 'Madd' },
  { id: 'other', label: 'Other' },
];

const MAKHARIJ = [
  { area: 'Al-Jawf', en: 'Empty space of mouth & throat', letters: 'ا و ي', hue: '#7c6cf0' },
  { area: 'Al-Halq', en: 'The throat', letters: 'ء ه ع ح غ خ', hue: '#e0573f' },
  { area: 'Al-Lisaan', en: 'The tongue', letters: 'ق ك ج ش ي ض ل ن ر ط د ت ص ز س ظ ذ ث', hue: '#2f8fe0' },
  { area: 'Ash-Shafataan', en: 'The lips', letters: 'ف و ب م', hue: '#1fa970' },
  { area: 'Al-Khayshoom', en: 'The nasal passage', letters: 'غنة', hue: '#d19a1a' },
];

const LEVELS = [
  { n: 1, title: 'Foundation', text: 'Letters, harakaat and basic sounds.', items: ['Arabic alphabet', 'Short vowels', 'Joining letters into words'] },
  { n: 2, title: 'Articulation', text: 'Where each letter comes from.', items: ['Makharij al-huruf', 'Sifaat (qualities)', 'Noon & tanween rules'] },
  { n: 3, title: 'Flow', text: 'Lengthening and connecting.', items: ['All types of madd', 'Meem sakinah', 'Waqf & ibtidaa'] },
  { n: 4, title: 'Mastery', text: 'Refine and recite beautifully.', items: ['Advanced madd', 'Letter-specific rules', 'Melody & qiraat intro'] },
];

/**
 * Quran.com returns only <tajweed> and <span class=end>; drop anything else before rendering.
 * It also spells the small alif of words like السماوات with U+0672 (alef with wavy hamza), which the
 * Uthmani Hafs font draws as a dotted circle with a dot. Read Quran uses the standard dagger alif
 * U+0670 for the same sound, so use that here too.
 */
function sanitize(html: string): string {
  return html.replace(/<(?!\/?(tajweed|span)\b)[^>]*>/gi, '').replace(/ٲ/g, 'ٰ');
}

const cache = new Map<string, string>();

async function loadVerse(key: string): Promise<string> {
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`${QURAN_API}/quran/verses/uthmani_tajweed?verse_key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error('Could not load ayah');
  const json = (await res.json()) as { verses?: { text_uthmani_tajweed: string }[] };
  const html = json.verses?.[0]?.text_uthmani_tajweed;
  if (!html) throw new Error('Ayah not found');
  const clean = sanitize(html);
  cache.set(key, clean);
  return clean;
}

function audioUrl(key: string): string {
  const [s, a] = key.split(':');
  return `${AUDIO_BASE}/${s.padStart(3, '0')}${a.padStart(3, '0')}.mp3`;
}

function useVerse(key: string) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setHtml(null);
    setError(false);
    loadVerse(key)
      .then((h) => live && setHtml(h))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [key, attempt]);

  return { html, error, retry: () => setAttempt((n) => n + 1) };
}

function useAudio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => ref.current?.pause(), []);

  const toggle = useCallback((key: string) => {
    if (!ref.current) ref.current = new Audio();
    const a = ref.current;
    if (playing === key) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = audioUrl(key);
    a.onended = () => setPlaying(null);
    a.onerror = () => setPlaying(null);
    a.play().then(() => setPlaying(key)).catch(() => setPlaying(null));
  }, [playing]);

  const stop = useCallback(() => {
    ref.current?.pause();
    setPlaying(null);
  }, []);

  return { playing, toggle, stop };
}

function Verse({ html, error, retry, focus }: { html: string | null; error: boolean; retry: () => void; focus?: string }) {
  if (error) {
    return (
      <div className="tj-verse-state">
        Couldn’t load the verse.{' '}
        <button type="button" onClick={retry}>Retry</button>
      </div>
    );
  }
  if (!html) return <div className="tj-verse-skeleton" aria-label="Loading ayah" />;
  return (
    <div
      className={`tj-verse${focus ? ' has-focus' : ''}`}
      data-focus={focus}
      dir="rtl"
      lang="ar"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PlayButton({ verseKey, audio }: { verseKey: string; audio: ReturnType<typeof useAudio> }) {
  const on = audio.playing === verseKey;
  return (
    <button type="button" className={`tj-play${on ? ' on' : ''}`} onClick={() => audio.toggle(verseKey)} aria-label={on ? 'Pause recitation' : 'Play recitation'}>
      {on ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 8 5.5Z" /></svg>
      )}
      <span>{on ? 'Pause' : 'Listen'}</span>
    </button>
  );
}

function HeroVerse() {
  const { html, error, retry } = useVerse('1:5');
  return (
    <div className="tj-hero-card">
      <div className="tj-hero-card-label">Live from the Quran · Al-Fātiḥah 1:5</div>
      <Verse html={html} error={error} retry={retry} />
      <div className="tj-hero-card-legend">
        <span><i style={{ background: '#4050ff' }} /> Madd</span>
        <span><i style={{ background: '#169200' }} /> Ghunnah</span>
        <span><i style={{ background: '#dd0008' }} /> Qalqalah</span>
        <span><i style={{ background: '#d500b7' }} /> Ikhfaa</span>
      </div>
    </div>
  );
}

function RuleExplorer() {
  const [group, setGroup] = useState<Rule['group'] | 'all'>('all');
  const [activeId, setActiveId] = useState(RULES[0].id);
  const audio = useAudio();

  const visible = group === 'all' ? RULES : RULES.filter((r) => r.group === group);
  const active = RULES.find((r) => r.id === activeId) ?? RULES[0];
  const { html, error, retry } = useVerse(active.verse);

  const pickGroup = (g: Rule['group'] | 'all') => {
    setGroup(g);
    const first = (g === 'all' ? RULES : RULES.filter((r) => r.group === g))[0];
    if (first && !(g === 'all' ? RULES : RULES.filter((r) => r.group === g)).some((r) => r.id === activeId)) {
      setActiveId(first.id);
    }
  };

  return (
    <div className="tj-explorer">
      <div className="tj-tabs" role="tablist" aria-label="Rule categories">
        {GROUPS.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={`tj-tab${group === g.id ? ' active' : ''}`} onClick={() => pickGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="tj-explorer-body">
        <ul className="tj-rule-list">
          {visible.map((r) => (
            <li key={r.id}>
              <button type="button" className={`tj-rule-item${r.id === active.id ? ' active' : ''}`} style={{ '--c': r.color } as React.CSSProperties} onClick={() => setActiveId(r.id)}>
                <span className="tj-swatch" />
                <span className="tj-rule-names">
                  <strong>{r.name}</strong>
                  <small>{r.summary}</small>
                </span>
                <span className="tj-rule-ar" lang="ar">{r.arabic}</span>
              </button>
            </li>
          ))}
        </ul>

        <article className="tj-detail" style={{ '--c': active.color } as React.CSSProperties}>
          <header>
            <span className="tj-detail-ar" lang="ar">{active.arabic}</span>
            <h3>{active.name}</h3>
            <p className="tj-detail-sum">{active.summary}</p>
          </header>
          <p className="tj-detail-how">{active.how}</p>
          {active.letters && (
            <div className="tj-letters">
              <span>Letters</span>
              <b lang="ar" dir="rtl">{active.letters}</b>
            </div>
          )}
          <div className="tj-example">
            <div className="tj-example-top">
              <span>Example · Surah {active.verse.replace(':', ', Ayah ')}</span>
              <PlayButton verseKey={active.verse} audio={audio} />
            </div>
            <Verse html={html} error={error} retry={retry} focus={active.cls} />
            <p className="tj-example-hint">Letters in <b style={{ color: active.color }}>this color</b> follow the rule. Other rules are dimmed.</p>
          </div>
        </article>
      </div>
    </div>
  );
}

function TryAnyAyah() {
  // opens on Ayat al-Kursi
  const [surah, setSurah] = useState(2);
  const [ayah, setAyah] = useState(255);
  const audio = useAudio();
  const key = `${surah}:${ayah}`;
  const { html, error, retry } = useVerse(key);
  const meta = surahList[surah - 1];
  const count = meta.ayahs ?? 1;

  // moving to another ayah stops the recitation of the previous one
  const stopAudio = audio.stop;
  useEffect(() => stopAudio(), [key, stopAudio]);

  const pickSurah = (n: number) => {
    setSurah(n);
    setAyah(1);
  };

  /** step through the Quran ayah by ayah, rolling over into the neighbouring surah */
  const step = (d: 1 | -1) => {
    if (d === 1) {
      if (ayah < count) setAyah(ayah + 1);
      else if (surah < 114) pickSurah(surah + 1);
    } else if (ayah > 1) {
      setAyah(ayah - 1);
    } else if (surah > 1) {
      setSurah(surah - 1);
      setAyah(surahList[surah - 2].ayahs ?? 1);
    }
  };

  return (
    <div className="tj-try">
      <div className="tj-pick">
        <label className="tj-pick-field tj-pick-surah">
          <span>Surah</span>
          <select value={surah} onChange={(e) => pickSurah(+e.target.value)}>
            {surahList.map((s) => (
              <option key={s.number} value={s.number}>{s.number}. {s.name} · {s.englishNameTranslation}</option>
            ))}
          </select>
        </label>
        <label className="tj-pick-field tj-pick-ayah">
          <span>Ayah</span>
          <select value={ayah} onChange={(e) => setAyah(+e.target.value)}>
            {Array.from({ length: count }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="tj-try-out">
        <div className="tj-example-top">
          <div className="tj-ayah-nav">
            <button type="button" onClick={() => step(-1)} disabled={surah === 1 && ayah === 1} aria-label="Previous ayah">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span>Ayah {ayah} <small>of {count}</small></span>
            <button type="button" onClick={() => step(1)} disabled={surah === 114 && ayah === count} aria-label="Next ayah">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          <PlayButton verseKey={key} audio={audio} />
        </div>
        <Verse html={html} error={error} retry={retry} />
      </div>
      <div className="tj-key">
        {RULES.filter((r) => r.group !== 'other' || r.id === 'qalaqah').map((r) => (
          <span key={r.id}><i style={{ background: r.color }} />{r.name}</span>
        ))}
      </div>
    </div>
  );
}

export default function TajweedClient() {
  return (
    <main className="tj-page">
      <section className="tj-hero">
        <div className="tj-hero-glow" aria-hidden="true" />
        <div className="tj-wrap tj-hero-grid">
          <div className="tj-hero-text">
            <span className="tj-eyebrow"><span lang="ar" className="font-arabic">علم التجويد</span> · The science of recitation</span>
            <h1>See tajweed. <em>Hear it.</em> Learn it.</h1>
            <p>Every rule is color-coded on the real text of the Quran with a live recitation, so you can learn by looking and listening.</p>
            <div className="tj-cta">
              <a href="#rules" className="tj-btn tj-btn-gold">Explore the rules</a>
              <Link href="/read-quran/1" className="tj-btn tj-btn-ghost">Read with tajweed colors</Link>
            </div>
            <ul className="tj-stats">
              <li><b>14</b><span>colored rules</span></li>
              <li><b>114</b><span>surahs to try</span></li>
              <li><b>Live</b><span>text &amp; audio</span></li>
            </ul>
          </div>
          <HeroVerse />
        </div>
      </section>

      <section className="tj-section tj-intro">
        <div className="tj-wrap tj-intro-grid">
          <div>
            <span className="tj-kicker">What is tajweed?</span>
            <h2>Giving every letter its right</h2>
          </div>
          <div className="tj-intro-copy">
            <p>
              <span lang="ar" className="tj-ar-inline">التجويد</span> comes from the root <span lang="ar" className="font-arabic">ج-و-د</span>, “to make better”. It is the set of rules for pronouncing every letter from its proper point, with its proper qualities.
            </p>
            <p>It preserves the recitation as it was taught to the Prophet ﷺ, and it protects the meaning of the words.</p>
            <ul className="tj-pillars">
              <li><b>Makharij</b><span>where letters come from</span></li>
              <li><b>Sifaat</b><span>how letters sound</span></li>
              <li><b>Ahkaam</b><span>rules in context</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section id="rules" className="tj-section tj-rules">
        <div className="tj-wrap">
          <div className="tj-head">
            <span className="tj-kicker">Interactive</span>
            <h2>The color-coded rules</h2>
            <p>Pick a rule to see an example from the Quran with the rule highlighted, then press Listen.</p>
          </div>
          <RuleExplorer />
        </div>
      </section>

      <section className="tj-section tj-try-sec">
        <div className="tj-wrap">
          <div className="tj-head">
            <span className="tj-kicker">Try it</span>
            <h2>Any ayah, in tajweed colors</h2>
            <p>Choose a surah and ayah to see its rules colored and hear Mishary Alafasy recite it.</p>
          </div>
          <TryAnyAyah />
        </div>
      </section>

      <section className="tj-section tj-makharij">
        <div className="tj-wrap">
          <div className="tj-head">
            <span className="tj-kicker">Makharij</span>
            <h2>Five regions of articulation</h2>
            <p>The 17 points of articulation group into five areas.</p>
          </div>
          <div className="tj-mk-grid">
            {MAKHARIJ.map((m) => (
              <div key={m.area} className="tj-mk-card" style={{ '--c': m.hue } as React.CSSProperties}>
                <div className="tj-mk-letters" lang="ar" dir="rtl">{m.letters}</div>
                <h3>{m.area}</h3>
                <p>{m.en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tj-section tj-path">
        <div className="tj-wrap">
          <div className="tj-head">
            <span className="tj-kicker">Learning path</span>
            <h2>From first letters to fluent recitation</h2>
          </div>
          <ol className="tj-steps">
            {LEVELS.map((l) => (
              <li key={l.n} className="tj-step">
                <span className="tj-step-n">{l.n}</span>
                <h3>{l.title}</h3>
                <p>{l.text}</p>
                <ul>
                  {l.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </li>
            ))}
          </ol>
          <div className="tj-final">
            <h3>Ready to recite with confidence?</h3>
            <p>Open any surah in the reader and switch to the Tajweed script.</p>
            <Link href="/read-quran/1" className="tj-btn tj-btn-gold">Start reading</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
