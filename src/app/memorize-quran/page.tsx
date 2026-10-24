// Memorize Quran — Hifz Studio
// Home dashboard (progress, reviews, surahs) + a focused session with
// Listen / Recall / Fill-the-blanks practice, repeat playback and spaced repetition.
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { qcfFontFamily, qcfPageFontReady } from '@/app/read-quran/lib/qcf';
import { MushafLoader } from '@/app/read-quran/components/MushafPager';
import {
    HifzStore, HifzVerse, HifzWord, Rating,
    emptyStore, loadStore, saveStore, rate, isMemorized, dueKeys, memorizedCount,
    startedCount, dueLabel, liveStreak, touchStreak, fetchChapterVerses,
} from './lib/hifz';
import './styles/hifz.css';

interface Chapter {
    id: number;
    name: string;
    nameArabic: string;
    nameTranslation: string;
    versesCount: number;
    revelationPlace: string;
}

interface Reciter {
    id: number;
    name: string;
    style: string;
}

type Mode = 'listen' | 'recall' | 'blanks';

const STARTERS = [1, 114, 113, 112, 108, 103, 97, 67];
const RATINGS: { id: Rating; label: string; hint: string }[] = [
    { id: 'again', label: 'Again', hint: 'Forgot it' },
    { id: 'hard', label: 'Hard', hint: 'With effort' },
    { id: 'good', label: 'Good', hint: 'Recalled it' },
    { id: 'easy', label: 'Easy', hint: 'Effortless' },
];

const escapeGlyph = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Deterministic "random" mask so the same words stay hidden for a verse. */
const isMasked = (key: string, pos: number, level: number) => {
    let h = pos * 131;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 10 < level * 3 + 1;
};

const fmtMinutes = (secs: number) => {
    const m = Math.round(secs / 60);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** One ayah drawn word-by-word in the Mushaf (QCF) font; hidden words are blurred or shown as blanks. */
function AyahText({
    words, hidden, onReveal, style,
}: {
    words: HifzWord[];
    hidden: (w: HifzWord) => boolean;
    onReveal: (w: HifzWord) => void;
    style: 'blur' | 'blank';
}) {
    return (
        <p className="hz-ayah" lang="ar" dir="rtl">
            {words.map((w, i) => {
                const hide = !w.end && hidden(w);
                const font = { fontFamily: `${qcfFontFamily(w.page)}, UthmanicHafs, serif` };
                return (
                    <span key={w.id ?? i}>
                        {hide ? (
                            <button
                                className={`hz-word is-hidden ${style}`}
                                onClick={() => onReveal(w)}
                                title="Tap to reveal"
                                aria-label="Hidden word — tap to reveal"
                            >
                                <span style={font} dangerouslySetInnerHTML={{ __html: escapeGlyph(w.glyph || w.text) }} />
                            </button>
                        ) : (
                            <span
                                className={`hz-word${w.end ? ' is-end' : ''}`}
                                style={w.glyph ? font : undefined}
                                dangerouslySetInnerHTML={{ __html: escapeGlyph(w.glyph || w.text) }}
                            />
                        )}
                        {i < words.length - 1 ? ' ' : ''}
                    </span>
                );
            })}
        </p>
    );
}

export default function MemorizeQuranPage() {
    // ── Data ──
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [reciters, setReciters] = useState<Reciter[]>([]);
    const [loading, setLoading] = useState(true);
    const [store, setStore] = useState<HifzStore>(emptyStore);

    // ── Home ──
    const [view, setView] = useState<'home' | 'session'>('home');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'All' | 'Meccan' | 'Medinan' | 'Started'>('All');

    // ── Session ──
    const [chapterId, setChapterId] = useState(1);
    const [fromVerse, setFromVerse] = useState(1);
    const [toVerse, setToVerse] = useState(7);
    const [allVerses, setAllVerses] = useState<HifzVerse[]>([]);
    const [versesLoading, setVersesLoading] = useState(false);
    const [versesError, setVersesError] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>('listen');
    const [blankLevel, setBlankLevel] = useState<1 | 2>(1);
    const [revealed, setRevealed] = useState<Record<string, Set<number>>>({});
    const [peeks, setPeeks] = useState(0);
    const [showTranslation, setShowTranslation] = useState(true);
    const [planOpen, setPlanOpen] = useState(true);
    const [focus, setFocus] = useState(false);
    const [complete, setComplete] = useState<{ ayahs: number; repeats: number } | null>(null);
    const [toast, setToast] = useState('');

    // ── Playback ──
    const [selectedReciter, setSelectedReciter] = useState(7);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [repeatCount, setRepeatCount] = useState(3);
    const [currentRepeat, setCurrentRepeat] = useState(0);
    const [pauseBetween, setPauseBetween] = useState(2);
    const [playbackRate, setPlaybackRate] = useState(1);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isPlayingRef = useRef(false);
    const loopRef = useRef(loopEnabled);
    const repeatRef = useRef(repeatCount);
    const pauseRef = useRef(pauseBetween);
    const rateRef = useRef(playbackRate);
    const versesRef = useRef<HifzVerse[]>([]);
    useEffect(() => { loopRef.current = loopEnabled; }, [loopEnabled]);
    useEffect(() => { repeatRef.current = repeatCount; }, [repeatCount]);
    useEffect(() => { pauseRef.current = pauseBetween; }, [pauseBetween]);
    useEffect(() => { rateRef.current = playbackRate; if (audioRef.current) audioRef.current.playbackRate = playbackRate; }, [playbackRate]);

    const chapter = chapters.find(c => c.id === chapterId);
    const verses = useMemo(
        () => allVerses.filter(v => v.number >= fromVerse && v.number <= toVerse),
        [allVerses, fromVerse, toVerse]
    );
    useEffect(() => { versesRef.current = verses; }, [verses]);

    const updateStore = useCallback((fn: (s: HifzStore) => HifzStore) => {
        setStore(prev => {
            const next = fn(prev);
            saveStore(next);
            return next;
        });
    }, []);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2200);
    };

    // Initial data
    useEffect(() => {
        setStore(loadStore());
        Promise.all([
            fetch('/api/memorize-quran?action=chapters').then(r => r.json()),
            fetch('/api/memorize-quran?action=reciters').then(r => r.json()),
        ])
            .then(([c, r]) => {
                setChapters(c.chapters || []);
                setReciters(r.reciters || []);
            })
            .catch(err => console.error('Error fetching initial data:', err))
            .finally(() => setLoading(false));
        return () => stopPlayback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load the chapter's ayahs (+ Mushaf fonts) when a session opens
    useEffect(() => {
        if (view !== 'session') return;
        let cancelled = false;
        setVersesLoading(true);
        setVersesError(null);
        fetchChapterVerses(chapterId)
            .then(async vs => {
                const pages = new Set(vs.filter(v => v.number >= fromVerse && v.number <= toVerse).map(v => v.page));
                await Promise.all([...pages].map(p => qcfPageFontReady(p)));
                if (cancelled) return;
                setAllVerses(vs);
                setVersesLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setVersesError(err instanceof Error ? err.message : 'Could not load ayahs');
                setVersesLoading(false);
            });
        return () => { cancelled = true; };
    }, [view, chapterId, fromVerse, toVerse]);

    // Remember the session so "Continue" can resume it
    useEffect(() => {
        if (view !== 'session' || !chapter) return;
        updateStore(s => ({ ...s, last: { chapter: chapter.id, name: chapter.name, from: fromVerse, to: toVerse, at: Date.now() } }));
    }, [view, chapter, fromVerse, toVerse, updateStore]);

    // Count practice time while a session is open and the tab is visible
    useEffect(() => {
        if (view !== 'session') return;
        const t = setInterval(() => {
            if (document.visibilityState === 'visible') updateStore(s => ({ ...s, seconds: s.seconds + 15 }));
        }, 15_000);
        return () => clearInterval(t);
    }, [view, updateStore]);

    // ── Playback engine ──
    const playVerseAudio = useCallback((verse: HifzVerse): Promise<void> => {
        return new Promise(async (resolve, reject) => {
            try {
                const res = await fetch(`/api/memorize-quran?action=audio&reciter=${selectedReciter}&verseKey=${verse.key}`);
                const data = await res.json();
                if (!data.audioUrl) { reject(new Error('No audio URL')); return; }
                if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
                const audio = new Audio(data.audioUrl);
                audio.playbackRate = rateRef.current;
                audioRef.current = audio;
                audio.onended = () => resolve();
                audio.onerror = () => reject(new Error('Audio failed'));
                await audio.play();
            } catch (error) {
                reject(error);
            }
        });
    }, [selectedReciter]);

    const playSequence = useCallback(async (startIndex: number) => {
        const list = versesRef.current;
        if (list.length === 0) return;
        let verseIndex = startIndex;
        let repeatNum = 0;
        let played = 0;

        const playNext = async () => {
            if (!isPlayingRef.current) return;
            if (verseIndex >= list.length) {
                if (loopRef.current) {
                    verseIndex = 0;
                    repeatNum = 0;
                } else {
                    isPlayingRef.current = false;
                    setIsPlaying(false);
                    setCurrentIndex(-1);
                    setCurrentRepeat(0);
                    setComplete({ ayahs: list.length - startIndex, repeats: played });
                    updateStore(touchStreak);
                    return;
                }
            }
            setCurrentIndex(verseIndex);
            setCurrentRepeat(repeatNum + 1);
            document.getElementById(`hz-verse-${list[verseIndex].number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            try {
                await playVerseAudio(list[verseIndex]);
                played++;
                if (!isPlayingRef.current) return;
                if (repeatNum < repeatRef.current - 1) {
                    repeatNum++;
                    timeoutRef.current = setTimeout(() => { if (isPlayingRef.current) playNext(); }, 500);
                } else {
                    verseIndex++;
                    repeatNum = 0;
                    timeoutRef.current = setTimeout(() => { if (isPlayingRef.current) playNext(); }, pauseRef.current * 1000);
                }
            } catch (error) {
                console.error('Playback error:', error);
                verseIndex++;
                repeatNum = 0;
                if (isPlayingRef.current) playNext();
            }
        };
        playNext();
    }, [playVerseAudio, updateStore]);

    const haltAudio = () => {
        isPlayingRef.current = false;
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    };

    function stopPlayback() {
        haltAudio();
        setIsPlaying(false);
        setCurrentIndex(-1);
        setCurrentRepeat(0);
    }

    const playFrom = (index: number) => {
        haltAudio();
        setComplete(null);
        setCurrentIndex(index);
        setCurrentRepeat(0);
        setIsPlaying(true);
        setTimeout(() => {
            isPlayingRef.current = true;
            playSequence(index);
        }, 60);
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            haltAudio();
            setIsPlaying(false);
        } else {
            playFrom(currentIndex >= 0 ? currentIndex : 0);
        }
    };

    const step = (delta: number) => {
        const target = Math.min(Math.max((currentIndex >= 0 ? currentIndex : 0) + delta, 0), verses.length - 1);
        if (isPlaying) playFrom(target);
        else {
            setCurrentIndex(target);
            document.getElementById(`hz-verse-${verses[target]?.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // ── Session helpers ──
    const openSession = (id: number, from?: number, to?: number, startMode: Mode = 'listen') => {
        const c = chapters.find(x => x.id === id);
        if (!c) return;
        stopPlayback();
        setChapterId(id);
        setFromVerse(from ?? 1);
        setToVerse(Math.min(to ?? Math.min(7, c.versesCount), c.versesCount));
        setMode(startMode);
        setRevealed({});
        setPeeks(0);
        setComplete(null);
        setPlanOpen(true);
        setView('session');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const backHome = () => {
        stopPlayback();
        setFocus(false);
        setView('home');
    };

    const setRange = (from: number, to: number) => {
        if (!chapter) return;
        const f = Math.min(Math.max(1, from), chapter.versesCount);
        const t = Math.min(Math.max(f, to), chapter.versesCount);
        stopPlayback();
        setFromVerse(f);
        setToVerse(t);
        setRevealed({});
        setComplete(null);
    };

    const switchMode = (m: Mode) => {
        setMode(m);
        setRevealed({});
        setPeeks(0);
    };

    const revealWord = (key: string, pos: number) => {
        setRevealed(prev => {
            const set = new Set(prev[key] || []);
            set.add(pos);
            return { ...prev, [key]: set };
        });
        setPeeks(p => p + 1);
    };

    const revealVerse = (v: HifzVerse) => {
        setRevealed(prev => ({ ...prev, [v.key]: new Set(v.words.map(w => w.position)) }));
    };

    const hintVerse = (v: HifzVerse) => {
        const shown = revealed[v.key] || new Set<number>();
        const next = v.words.find(w => !w.end && !shown.has(w.position));
        if (next) revealWord(v.key, next.position);
    };

    const isHidden = (v: HifzVerse) => (w: HifzWord) => {
        if (mode === 'listen') return false;
        if (revealed[v.key]?.has(w.position)) return false;
        if (mode === 'recall') return true;
        return isMasked(v.key, w.position, blankLevel);
    };

    const rateVerse = (key: string, r: Rating) => {
        updateStore(s => rate(s, key, r));
        if (r === 'again') flash('We’ll bring this ayah back in 10 minutes');
    };

    // Keyboard shortcuts
    useEffect(() => {
        if (view !== 'session') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
            switch (e.code) {
                case 'Space': e.preventDefault(); handlePlayPause(); break;
                case 'ArrowLeft': step(-1); break;
                case 'ArrowRight': step(1); break;
                case 'KeyL': switchMode('listen'); break;
                case 'KeyH': case 'KeyR': switchMode('recall'); break;
                case 'KeyC': case 'KeyB': switchMode('blanks'); break;
                case 'KeyF': setFocus(f => !f); break;
                case 'Escape': setFocus(false); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // ── Derived home data ──
    const due = useMemo(() => dueKeys(store), [store]);
    const totalMemorized = useMemo(() => memorizedCount(store), [store]);
    const streak = liveStreak(store);
    const reviewTarget = useMemo(() => {
        if (!due.length) return null;
        const bySurah = new Map<number, number[]>();
        due.forEach(k => {
            const [s, a] = k.split(':').map(Number);
            bySurah.set(s, [...(bySurah.get(s) || []), a]);
        });
        const [surah, ayahs] = [...bySurah.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        return { surah, from: Math.min(...ayahs), to: Math.max(...ayahs), count: ayahs.length };
    }, [due]);

    const filtered = chapters.filter(c => {
        const q = query.trim().toLowerCase();
        const matchQ = !q || c.name.toLowerCase().includes(q) || c.nameTranslation.toLowerCase().includes(q) || c.nameArabic.includes(query.trim()) || String(c.id) === q;
        const place = (c.revelationPlace ?? '').toLowerCase();
        const matchF =
            filter === 'All' ||
            (filter === 'Meccan' && (place === 'makkah' || place === 'mecca')) ||
            (filter === 'Medinan' && (place === 'madinah' || place === 'medina')) ||
            (filter === 'Started' && startedCount(store, c.id) > 0);
        return matchQ && matchF;
    });

    if (loading) {
        return (
            <main className="hz">
                <div className="hz-wrap"><MushafLoader label="Opening your Hifz studio" /></div>
            </main>
        );
    }

    // ════════════════════════ HOME ════════════════════════
    if (view === 'home') {
        const last = store.last;
        const lastChapter = last ? chapters.find(c => c.id === last.chapter) : undefined;
        return (
            <main className="hz">
                <div className="hz-wrap">
                    <header className="hz-hero">
                        <div>
                            <p className="hz-kicker"><span className="font-arabic">حِفْظُ القُرْآن</span><span className="hz-kicker-sep" />Hifz Studio</p>
                            <h1>Hold the Quran close, <em>one ayah at a time.</em></h1>
                            <p className="hz-sub">Listen on repeat, test yourself, and let spaced repetition tell you exactly what to review each day.</p>
                        </div>
                        <div className="hz-stats">
                            <div className="hz-stat">
                                <span className="material-symbols-outlined">verified</span>
                                <b>{totalMemorized}</b>
                                <small>ayahs memorized</small>
                            </div>
                            <div className="hz-stat fire">
                                <span className="material-symbols-outlined">local_fire_department</span>
                                <b>{streak}</b>
                                <small>day streak</small>
                            </div>
                            <div className={`hz-stat${due.length ? ' due' : ''}`}>
                                <span className="material-symbols-outlined">event_repeat</span>
                                <b>{due.length}</b>
                                <small>due for review</small>
                            </div>
                        </div>
                    </header>

                    <section className="hz-actions">
                        {last && lastChapter ? (
                            <button className="hz-continue" onClick={() => openSession(last.chapter, last.from, last.to)}>
                                <span className="hz-continue-label"><span className="hz-dot" />Continue memorizing</span>
                                <span className="hz-continue-main">
                                    <span>
                                        <b>{lastChapter.name}</b>
                                        <small>Ayah {last.from}–{last.to} · {lastChapter.nameTranslation}</small>
                                    </span>
                                    <span className="font-arabic hz-continue-ar">{lastChapter.nameArabic}</span>
                                </span>
                                <span className="hz-continue-foot">
                                    <span>{memorizedCount(store, lastChapter.id)} of {lastChapter.versesCount} memorized · {fmtMinutes(store.seconds)} practised</span>
                                    <span className="hz-cta">Resume <span className="material-symbols-outlined">arrow_forward</span></span>
                                </span>
                            </button>
                        ) : (
                            <button className="hz-continue" onClick={() => openSession(1, 1, 7)}>
                                <span className="hz-continue-label"><span className="hz-dot" />Start here</span>
                                <span className="hz-continue-main">
                                    <span><b>Al-Fatihah</b><small>The Opening · 7 ayahs you already recite daily</small></span>
                                    <span className="font-arabic hz-continue-ar">الفاتحة</span>
                                </span>
                                <span className="hz-continue-foot">
                                    <span>Listen, repeat, then test yourself</span>
                                    <span className="hz-cta">Begin <span className="material-symbols-outlined">arrow_forward</span></span>
                                </span>
                            </button>
                        )}

                        <div className={`hz-review${reviewTarget ? '' : ' empty'}`}>
                            <span className="hz-review-icon material-symbols-outlined">{reviewTarget ? 'event_repeat' : 'task_alt'}</span>
                            {reviewTarget ? (
                                <>
                                    <b>{due.length} ayah{due.length === 1 ? '' : 's'} to review</b>
                                    <small>Most are in {chapters.find(c => c.id === reviewTarget.surah)?.name ?? `Surah ${reviewTarget.surah}`} · ayah {reviewTarget.from}–{reviewTarget.to}</small>
                                    <button className="hz-btn primary" onClick={() => openSession(reviewTarget.surah, reviewTarget.from, reviewTarget.to, 'recall')}>
                                        <span className="material-symbols-outlined">psychology</span>
                                        Review now
                                    </button>
                                </>
                            ) : (
                                <>
                                    <b>All caught up</b>
                                    <small>Rate ayahs after practising and they’ll appear here when it’s time to review.</small>
                                </>
                            )}
                        </div>

                        <div className="hz-how">
                            <b>How it works</b>
                            <ol>
                                <li><span>1</span>Listen to each ayah on repeat</li>
                                <li><span>2</span>Test yourself with Recall or Fill-the-blanks</li>
                                <li><span>3</span>Rate it — we schedule the next review</li>
                            </ol>
                        </div>
                    </section>

                    <section className="hz-starters">
                        <p className="hz-section-label"><span className="material-symbols-outlined">spa</span>Gentle starts</p>
                        <div className="hz-chips">
                            {STARTERS.map(id => {
                                const c = chapters.find(x => x.id === id);
                                if (!c) return null;
                                return (
                                    <button key={id} className="hz-chip" onClick={() => openSession(id)}>
                                        <span className="font-arabic">{c.nameArabic}</span>
                                        {c.name}
                                        <small>{c.versesCount}</small>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section>
                        <div className="hz-list-head">
                            <div>
                                <p className="hz-kicker-ar font-arabic">اختر سورة</p>
                                <h2>Choose a Surah</h2>
                                <p className="hz-count">{filtered.length} of 114 surahs</p>
                            </div>
                            <div className="hz-tools">
                                <label className="hz-search">
                                    <span className="material-symbols-outlined">search</span>
                                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, meaning or number" aria-label="Search surahs" />
                                </label>
                                <div className="hz-seg" role="tablist" aria-label="Filter">
                                    {(['All', 'Meccan', 'Medinan', 'Started'] as const).map(f => (
                                        <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="hz-grid">
                            {filtered.map((c, i) => {
                                const mem = memorizedCount(store, c.id);
                                const started = startedCount(store, c.id);
                                const pct = Math.round((mem / c.versesCount) * 100);
                                return (
                                    <button key={c.id} className={`hz-card${started ? ' started' : ''}${pct === 100 ? ' done' : ''}`} onClick={() => openSession(c.id)} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                                        <span className="hz-card-num">{c.id}</span>
                                        <span className="hz-card-main">
                                            <b>{c.name}</b>
                                            <small>{c.nameTranslation} · {c.versesCount} ayahs</small>
                                        </span>
                                        <span className="hz-card-ar font-arabic">{c.nameArabic}</span>
                                        <span className="hz-card-progress">
                                            <span className="hz-bar"><span style={{ width: `${pct}%` }} /></span>
                                            <small>{pct === 100 ? 'Memorized ✓' : started ? `${mem}/${c.versesCount} memorized` : 'Not started'}</small>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>
                {toast && <div className="hz-toast" role="status">{toast}</div>}
            </main>
        );
    }

    // ════════════════════════ SESSION ════════════════════════
    if (!chapter) return null;
    const current = currentIndex >= 0 ? verses[currentIndex] : undefined;
    const focusVerse = current ?? verses[0];
    const reciterName = reciters.find(r => r.id === selectedReciter)?.name ?? 'Reciter';
    const rangeMemorized = verses.filter(v => isMemorized(store.cards[v.key])).length;

    return (
        <main className="hz">
            <div className="hz-session">
                {/* ── Session bar ── */}
                <div className="hz-bar-top">
                    <button className="hz-icon" onClick={backHome} aria-label="Back to Hifz home">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="hz-title">
                        <b>{chapter.name} <span className="font-arabic">{chapter.nameArabic}</span></b>
                        <small>Ayah {fromVerse}–{toVerse} · {rangeMemorized}/{verses.length} memorized</small>
                    </div>
                    <div className="hz-modes" role="tablist" aria-label="Practice mode">
                        {([
                            ['listen', 'headphones', 'Listen'],
                            ['recall', 'visibility_off', 'Recall'],
                            ['blanks', 'extension', 'Fill blanks'],
                        ] as const).map(([id, icon, label]) => (
                            <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => switchMode(id)}>
                                <span className="material-symbols-outlined">{icon}</span>
                                <span className="hz-mode-label">{label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="hz-bar-right">
                        <button className="hz-icon" onClick={() => setFocus(true)} title="Focus mode (F)">
                            <span className="material-symbols-outlined">center_focus_strong</span>
                        </button>
                        <button className={`hz-icon${planOpen ? ' on' : ''}`} onClick={() => setPlanOpen(o => !o)} title="Session plan">
                            <span className="material-symbols-outlined">tune</span>
                        </button>
                    </div>
                </div>

                <div className="hz-wrap hz-session-body">
                    {/* ── Session plan ── */}
                    {planOpen && (
                        <section className="hz-plan">
                            <div className="hz-plan-row">
                                <div className="hz-field">
                                    <span className="hz-field-label">Ayahs</span>
                                    <div className="hz-range">
                                        <input type="number" min={1} max={chapter.versesCount} value={fromVerse} onChange={e => setRange(Number(e.target.value), toVerse)} aria-label="From ayah" />
                                        <span>to</span>
                                        <input type="number" min={1} max={chapter.versesCount} value={toVerse} onChange={e => setRange(fromVerse, Number(e.target.value))} aria-label="To ayah" />
                                        <small>of {chapter.versesCount}</small>
                                    </div>
                                    <div className="hz-presets">
                                        <button onClick={() => setRange(1, 5)}>1–5</button>
                                        <button onClick={() => setRange(1, 10)}>1–10</button>
                                        {toVerse < chapter.versesCount && <button onClick={() => setRange(toVerse + 1, toVerse + (toVerse - fromVerse + 1))}>Next {toVerse - fromVerse + 1} →</button>}
                                        <button onClick={() => setRange(1, chapter.versesCount)}>Whole surah</button>
                                    </div>
                                </div>
                                <div className="hz-field">
                                    <label className="hz-field-label" htmlFor="hz-reciter">Reciter</label>
                                    <select id="hz-reciter" className="hz-select" value={selectedReciter} onChange={e => { stopPlayback(); setSelectedReciter(parseInt(e.target.value)); }}>
                                        {reciters.map(r => <option key={r.id} value={r.id}>{r.name} · {r.style}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="hz-plan-row compact">
                                {([
                                    ['Repeat each', `${repeatCount}×`, () => setRepeatCount(Math.max(1, repeatCount - 1)), () => setRepeatCount(Math.min(10, repeatCount + 1))],
                                    ['Speed', `${playbackRate}×`, () => setPlaybackRate(Math.max(0.5, playbackRate - 0.25)), () => setPlaybackRate(Math.min(2, playbackRate + 0.25))],
                                    ['Pause', `${pauseBetween}s`, () => setPauseBetween(Math.max(0, pauseBetween - 1)), () => setPauseBetween(Math.min(10, pauseBetween + 1))],
                                ] as const).map(([label, val, dec, inc]) => (
                                    <div key={label} className="hz-stepper">
                                        <span className="hz-field-label">{label}</span>
                                        <div>
                                            <button onClick={dec} aria-label={`Less ${label}`}>−</button>
                                            <b>{val}</b>
                                            <button onClick={inc} aria-label={`More ${label}`}>+</button>
                                        </div>
                                    </div>
                                ))}
                                <button className={`hz-toggle${loopEnabled ? ' on' : ''}`} onClick={() => setLoopEnabled(l => !l)} aria-pressed={loopEnabled}>
                                    <span className="material-symbols-outlined">repeat</span>
                                    Loop range
                                </button>
                                <button className={`hz-toggle${showTranslation ? ' on' : ''}`} onClick={() => setShowTranslation(t => !t)} aria-pressed={showTranslation}>
                                    <span className="material-symbols-outlined">translate</span>
                                    Translation
                                </button>
                                {mode === 'blanks' && (
                                    <div className="hz-seg small" role="tablist" aria-label="Blank level">
                                        <button className={blankLevel === 1 ? 'on' : ''} onClick={() => { setBlankLevel(1); setRevealed({}); }}>Light</button>
                                        <button className={blankLevel === 2 ? 'on' : ''} onClick={() => { setBlankLevel(2); setRevealed({}); }}>Hard</button>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Mode hint + ayah map ── */}
                    <div className="hz-mode-hint">
                        <span className="material-symbols-outlined">
                            {mode === 'listen' ? 'hearing' : mode === 'recall' ? 'visibility_off' : 'extension'}
                        </span>
                        {mode === 'listen' && 'Listen and follow along. Each ayah repeats before moving on.'}
                        {mode === 'recall' && 'Recite from memory, then tap a word — or Reveal — to check yourself.'}
                        {mode === 'blanks' && 'Fill in the missing words in your head, then tap a blank to check.'}
                        {mode !== 'listen' && <span className="hz-peeks">{peeks} peek{peeks === 1 ? '' : 's'}</span>}
                    </div>

                    {verses.length > 1 && (
                        <div className="hz-map" aria-label="Ayahs in this session">
                            {verses.map((v, i) => {
                                const card = store.cards[v.key];
                                const state = isMemorized(card) ? 'mem' : card ? 'learn' : '';
                                return (
                                    <button
                                        key={v.key}
                                        className={`hz-map-dot ${state}${i === currentIndex ? ' now' : ''}`}
                                        onClick={() => { setCurrentIndex(i); document.getElementById(`hz-verse-${v.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                                        title={`Ayah ${v.number}${state === 'mem' ? ' · memorized' : state === 'learn' ? ' · learning' : ''}`}
                                    >
                                        {v.number}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {complete && (
                        <section className="hz-complete">
                            <span className="material-symbols-outlined">celebration</span>
                            <div>
                                <b>Session complete — MashaAllah!</b>
                                <small>{complete.ayahs} ayah{complete.ayahs === 1 ? '' : 's'} · {complete.repeats} recitations heard. Now test yourself while it’s fresh.</small>
                            </div>
                            <div className="hz-complete-actions">
                                <button className="hz-btn primary" onClick={() => { switchMode('recall'); setComplete(null); }}>
                                    <span className="material-symbols-outlined">psychology</span>Test with Recall
                                </button>
                                {toVerse < chapter.versesCount && (
                                    <button className="hz-btn" onClick={() => setRange(toVerse + 1, toVerse + (toVerse - fromVerse + 1))}>
                                        Next ayahs<span className="material-symbols-outlined">arrow_forward</span>
                                    </button>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Ayahs ── */}
                    {versesError ? (
                        <div className="hz-error">
                            <span className="material-symbols-outlined">cloud_off</span>
                            <p>{versesError}</p>
                            <button className="hz-btn primary" onClick={() => setRange(fromVerse, toVerse)}>Try again</button>
                        </div>
                    ) : versesLoading ? (
                        <MushafLoader label={`Preparing ${chapter.name} ${fromVerse}–${toVerse}`} />
                    ) : (
                        <div className="hz-verses">
                            {verses.map((v, i) => {
                                const card = store.cards[v.key];
                                const playing = i === currentIndex;
                                const allShown = mode === 'listen' || v.words.every(w => w.end || !isHidden(v)(w));
                                return (
                                    <article key={v.key} id={`hz-verse-${v.number}`} className={`hz-verse${playing ? ' is-current' : ''}${playing && isPlaying ? ' is-playing' : ''}`}>
                                        <div className="hz-verse-top">
                                            <span className="hz-vnum">{v.number}</span>
                                            {card && (
                                                <span className={`hz-status ${isMemorized(card) ? 'mem' : 'learn'}`}>
                                                    <span className="material-symbols-outlined">{isMemorized(card) ? 'verified' : 'school'}</span>
                                                    {isMemorized(card) ? 'Memorized' : 'Learning'} · review {dueLabel(card)}
                                                </span>
                                            )}
                                            {playing && isPlaying && (
                                                <span className="hz-repeats" aria-label={`Repeat ${currentRepeat} of ${repeatCount}`}>
                                                    {Array.from({ length: repeatCount }, (_, k) => <i key={k} className={k < currentRepeat ? 'on' : ''} />)}
                                                </span>
                                            )}
                                            <div className="hz-verse-actions">
                                                {mode !== 'listen' && !allShown && (
                                                    <>
                                                        <button className="hz-act" onClick={() => hintVerse(v)} title="Show the next word">
                                                            <span className="material-symbols-outlined">lightbulb</span><span className="hz-act-label">Hint</span>
                                                        </button>
                                                        <button className="hz-act" onClick={() => revealVerse(v)} title="Reveal the whole ayah">
                                                            <span className="material-symbols-outlined">visibility</span><span className="hz-act-label">Reveal</span>
                                                        </button>
                                                    </>
                                                )}
                                                <button className="hz-act play" onClick={() => (playing && isPlaying ? handlePlayPause() : playFrom(i))} title={playing && isPlaying ? 'Pause' : 'Play from here'}>
                                                    <span className="material-symbols-outlined">{playing && isPlaying ? 'pause' : 'play_arrow'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        <AyahText words={v.words} hidden={isHidden(v)} onReveal={w => revealWord(v.key, w.position)} style={mode === 'recall' ? 'blur' : 'blank'} />

                                        {showTranslation && (mode === 'listen' || allShown) && <p className="hz-translation">{v.translation}</p>}

                                        <div className="hz-rate">
                                            <span>How well do you know it?</span>
                                            <div>
                                                {RATINGS.map(r => (
                                                    <button key={r.id} className={`hz-rate-btn ${r.id}`} onClick={() => rateVerse(v.key, r.id)} title={r.hint}>
                                                        {r.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                    <div style={{ height: 120 }} />
                </div>
            </div>

            {/* ── Floating player ── */}
            {verses.length > 0 && !focus && (
                <div className="hz-player" role="region" aria-label="Recitation player">
                    <div className="hz-player-info">
                        <b>{current ? `Ayah ${current.number}` : `Ayah ${fromVerse}–${toVerse}`}<span> · {reciterName}</span></b>
                        <small>
                            {current ? `Repeat ${currentRepeat} of ${repeatCount}` : `${verses.length} ayahs · ${repeatCount}× each`}
                            {loopEnabled && ' · looping'}
                            {playbackRate !== 1 && ` · ${playbackRate}×`}
                        </small>
                        <span className="hz-player-track"><span style={{ width: `${verses.length ? ((Math.max(currentIndex, 0) + (current ? currentRepeat / repeatCount : 0)) / verses.length) * 100 : 0}%` }} /></span>
                    </div>
                    <div className="hz-player-ctrls">
                        <button className="hz-pbtn" onClick={() => step(-1)} disabled={currentIndex <= 0} aria-label="Previous ayah"><span className="material-symbols-outlined">skip_previous</span></button>
                        <button className="hz-pbtn main" onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}><span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span></button>
                        <button className="hz-pbtn" onClick={() => step(1)} disabled={currentIndex >= verses.length - 1} aria-label="Next ayah"><span className="material-symbols-outlined">skip_next</span></button>
                        <button className={`hz-pbtn${loopEnabled ? ' on' : ''}`} onClick={() => setLoopEnabled(l => !l)} aria-label="Loop range" aria-pressed={loopEnabled}><span className="material-symbols-outlined">repeat</span></button>
                    </div>
                </div>
            )}

            {/* ── Focus mode ── */}
            {focus && focusVerse && (
                <div className="hz-focus" role="dialog" aria-modal="true" aria-label="Focus mode">
                    <button className="hz-focus-close" onClick={() => setFocus(false)} aria-label="Close focus mode"><span className="material-symbols-outlined">close</span></button>
                    <p className="hz-focus-meta">{chapter.name} · Ayah {focusVerse.number}</p>
                    <div className="hz-focus-ring">
                        <svg viewBox="0 0 120 120" aria-hidden="true">
                            <circle cx="60" cy="60" r="54" className="track" />
                            <circle cx="60" cy="60" r="54" className="fill" strokeDasharray={339.3} strokeDashoffset={339.3 * (1 - (current ? currentRepeat / repeatCount : 0))} transform="rotate(-90 60 60)" />
                        </svg>
                        <span>{current ? `${currentRepeat}/${repeatCount}` : '—'}</span>
                    </div>
                    <AyahText words={focusVerse.words} hidden={isHidden(focusVerse)} onReveal={w => revealWord(focusVerse.key, w.position)} style={mode === 'recall' ? 'blur' : 'blank'} />
                    {showTranslation && <p className="hz-focus-tr">{focusVerse.translation}</p>}
                    <div className="hz-focus-ctrls">
                        <button className="hz-pbtn" onClick={() => step(-1)} aria-label="Previous ayah"><span className="material-symbols-outlined">skip_previous</span></button>
                        <button className="hz-pbtn main" onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}><span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span></button>
                        <button className="hz-pbtn" onClick={() => step(1)} aria-label="Next ayah"><span className="material-symbols-outlined">skip_next</span></button>
                    </div>
                    <p className="hz-focus-keys"><kbd>Space</kbd> play · <kbd>←</kbd><kbd>→</kbd> ayah · <kbd>Esc</kbd> close</p>
                </div>
            )}

            {toast && <div className="hz-toast" role="status">{toast}</div>}
        </main>
    );
}
