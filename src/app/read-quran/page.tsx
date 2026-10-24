'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getChapters, Chapter } from './lib/api';
import { getLastRead, getProgressPercentage, getProgress, LastReadPosition } from './lib/progress';
import SurahExplorer, { SurahInfo } from '@/components/SurahExplorer';
import './styles/library.css';

const MODES = [
  { icon: 'translate', title: 'Translation', text: 'Arabic with English meaning', href: '/read-quran/1' },
  { icon: 'text_fields', title: 'Word by Word', text: 'Understand every word', href: '/read-quran/1?mode=word-by-word' },
  { icon: 'auto_stories', title: 'Mushaf', text: 'Page by page, 604 pages', href: '/quran-pages' },
  { icon: 'headphones', title: 'Listen', text: 'Recitation with audio', href: '/quran-player' },
];

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

type Tab = 'surah' | 'page';

export default function ReadQuranPage() {
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [lastRead, setLastRead] = useState<LastReadPosition | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalRead, setTotalRead] = useState(0);
  const [tab, setTab] = useState<Tab>('surah');
  const [pageNo, setPageNo] = useState('');

  useEffect(() => {
    setLastRead(getLastRead());
    setProgress(getProgressPercentage());
    setTotalRead(getProgress().totalRead);
    getChapters()
      .then(setChapters)
      .catch(err => {
        console.error(err);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const surahs: SurahInfo[] = chapters.map(c => ({
    num: c.id,
    ar: c.name_arabic,
    name: c.name_simple,
    meaning: c.translated_name.name,
    v: c.verses_count,
    t: c.revelation_place === 'makkah' ? 'Meccan' : 'Medinan',
  }));

  const lastChapter = lastRead ? chapters.find(c => c.id === lastRead.surahId) : undefined;
  const pageValid = Number(pageNo) >= 1 && Number(pageNo) <= 604;

  return (
    <div className="lib">
      {/* ── Hero ── */}
      <header className="lib-hero">
        <div className="lib-hero-copy">
          <p className="lib-kicker">
            <span className="font-arabic">القرآن الكريم</span>
            <span className="lib-kicker-sep" />
            The Noble Quran
          </p>
          <h1>Read, reflect, and return — <em>every day.</em></h1>
          <p className="lib-sub">
            114 Surahs in clear Uthmani script with translation, word-by-word meaning and recitation.
          </p>
        </div>

        {/* Continue / start card */}
        <Link
          href={lastRead ? `/read-quran/${lastRead.surahId}#verse-${lastRead.verseNumber}` : '/read-quran/1'}
          className="lib-continue"
        >
          <div className="lib-continue-top">
            <span className="lib-continue-label">
              <span className="lib-dot" />
              {lastRead ? 'Continue reading' : 'Begin your journey'}
            </span>
            <svg className="lib-ring" viewBox="0 0 72 72" aria-label={`${progress.toFixed(1)}% of the Quran read`}>
              <circle cx="36" cy="36" r={RING_R} className="lib-ring-track" />
              <circle
                cx="36" cy="36" r={RING_R}
                className="lib-ring-fill"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - Math.min(progress, 100) / 100)}
                transform="rotate(-90 36 36)"
              />
              <text x="36" y="40" textAnchor="middle">{Math.round(progress)}%</text>
            </svg>
          </div>
          <div className="lib-continue-surah">
            <div>
              <b>{lastRead ? lastRead.surahName : 'Al-Fatihah'}</b>
              <small>{lastRead ? `Ayah ${lastRead.verseNumber}` : 'The Opening · 7 ayahs'}</small>
            </div>
            <span className="font-arabic">{lastChapter?.name_arabic ?? 'الفاتحة'}</span>
          </div>
          <div className="lib-continue-foot">
            <span>{totalRead.toLocaleString()} of 6,236 ayahs read</span>
            <span className="lib-continue-cta">
              {lastRead ? 'Resume' : 'Start'}
              <span className="material-symbols-outlined">arrow_forward</span>
            </span>
          </div>
        </Link>
      </header>

      {/* ── Reading modes ── */}
      <nav className="lib-modes" aria-label="Reading modes">
        {MODES.map(m => (
          <Link key={m.title} href={m.href} className="lib-mode">
            <span className="lib-mode-icon material-symbols-outlined">{m.icon}</span>
            <span>
              <b>{m.title}</b>
              <small>{m.text}</small>
            </span>
          </Link>
        ))}
      </nav>

      {/* ── Browse tabs ── */}
      <div className="lib-tabs" role="tablist" aria-label="Browse the Quran">
        {([
          ['surah', 'Surah', 'menu_book'],
          ['page', 'Page', 'description'],
        ] as const).map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span className="material-symbols-outlined">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {tab === 'surah' && (
        loading ? (
          <div className="lib-skel-grid" aria-busy="true">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="lib-skel" style={{ animationDelay: `${i * 60}ms` }} />)}
          </div>
        ) : failed ? (
          <div className="lib-error">
            <span className="material-symbols-outlined">cloud_off</span>
            <p>Couldn&apos;t load the Surah list. Check your connection and try again.</p>
            <button onClick={() => location.reload()}>Retry</button>
          </div>
        ) : (
          <SurahExplorer surahs={surahs} recentNums={lastRead ? [lastRead.surahId] : []} />
        )
      )}

      {tab === 'page' && (
        <section className="lib-page" aria-label="Go to page">
          <div className="lib-page-card">
            <span className="lib-page-icon material-symbols-outlined">auto_stories</span>
            <h2>Open the Mushaf at any page</h2>
            <p>The Madani Mushaf has 604 pages. Enter a page number to jump straight there.</p>
            <form
              className="lib-page-form"
              onSubmit={e => {
                e.preventDefault();
                if (pageValid) router.push(`/page/${Number(pageNo)}`);
              }}
            >
              <input
                type="number"
                min={1}
                max={604}
                inputMode="numeric"
                placeholder="1 – 604"
                value={pageNo}
                onChange={e => setPageNo(e.target.value)}
                aria-label="Page number"
              />
              <button type="submit" disabled={!pageValid}>
                Open page
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </form>
            <div className="lib-page-quick">
              {[1, 2, 50, 106, 293, 582, 604].map(p => (
                <Link key={p} href={`/page/${p}`}>p. {p}</Link>
              ))}
            </div>
            <Link href="/quran-pages" className="lib-page-link">
              Or browse the full Mushaf reader
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
