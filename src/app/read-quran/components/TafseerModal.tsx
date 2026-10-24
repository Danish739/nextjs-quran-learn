'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Copy, Check, RefreshCw, Minus, Plus } from 'lucide-react';
import { getAyahTafsir, type AyahTafsir } from '../lib/api';

interface Verse {
    id: number;
    verse_number: number;
    verse_key: string;
    text_uthmani?: string;
    text_qpc_hafs?: string;
    translations?: { text: string }[];
}

interface Chapter {
    id: number;
    name_arabic: string;
    name_simple: string;
    translated_name?: { name: string };
    verses_count: number;
    revelation_place?: string;
}

interface TafseerModalProps {
    isOpen: boolean;
    onClose: () => void;
    verse: Verse | null;
    chapter: Chapter | null;
    allVerses: Verse[];
    onNavigate: (verseNumber: number) => void;
    surahNumber: number;
    cleanArabicText: (text: string) => string;
    removeBismillah?: (text: string) => string;
}

const SCHOLARS = [
    {
        key: 'ibn-kathir',
        id: 169,
        name: 'Ibn Kathir',
        tag: 'English',
        fullName: 'Tafsir Ibn Kathir (Abridged)',
        desc: 'Hafiz Ibn Kathir (d. 774 AH). Explains the Quran by the Quran, then by hadith and the words of the Companions.',
        rtl: false,
    },
    {
        key: 'ibn-kathir-ar',
        id: 14,
        name: 'ابن كثير',
        tag: 'العربية',
        fullName: 'تفسير ابن كثير',
        desc: 'The original Arabic text of Tafsir Ibn Kathir.',
        rtl: true,
    },
    {
        key: 'maarif',
        id: 168,
        name: "Ma'arif",
        tag: 'English',
        fullName: "Ma'arif al-Qur'an",
        desc: 'Mufti Muhammad Shafi Usmani. Classical scholarship with lessons for modern life.',
        rtl: false,
    },
    {
        key: 'tazkirul',
        id: 817,
        name: 'Tazkirul',
        tag: 'English',
        fullName: 'Tazkirul Quran',
        desc: 'Maulana Wahiduddin Khan. A reflective, contemporary reading of the message.',
        rtl: false,
    },
] as const;

type ScholarKey = (typeof SCHOLARS)[number]['key'];

const SIZE_KEY = 'tafseer-text-size';
const SIZES = [15, 16, 17, 19, 21];
const ARABIC_RE = /[؀-ۿ]/g;

/** Rebuild the API's HTML into a small, safe subset and tag Arabic paragraphs for the Quran font. */
function cleanTafsirHtml(raw: string): string {
    if (!raw || typeof DOMParser === 'undefined') return '';
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const out: string[] = [];

    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? '');
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        if (tag === 'sup' || tag === 'script' || tag === 'style') return '';
        if (tag === 'br') return '<br>';
        const inner = Array.from(el.childNodes).map(inline).join('');
        if (tag === 'strong' || tag === 'b') return `<strong>${inner}</strong>`;
        if (tag === 'em' || tag === 'i') return `<em>${inner}</em>`;
        return inner;
    };
    const isArabic = (text: string) => {
        const letters = text.replace(/[\s\d\p{P}]/gu, '');
        if (!letters) return false;
        return (letters.match(ARABIC_RE)?.length ?? 0) / letters.length > 0.6;
    };

    const block = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') {
            const items = Array.from(el.children).map(li => inline(li).trim()).filter(Boolean);
            if (items.length) out.push(`<${tag} class="tf-list">${items.map(i => `<li>${i}</li>`).join('')}</${tag}>`);
            return;
        }
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
            const t = inline(el).replace(/<[^>]+>/g, '').trim();
            if (t) out.push(`<h3 class="tf-heading">${t}</h3>`);
            return;
        }
        if (tag === 'blockquote') {
            const t = inline(el).trim();
            if (t) out.push(`<blockquote class="tf-quote">${t}</blockquote>`);
            return;
        }
        if (tag === 'p' || tag === 'div') {
            // Nested blocks (div > p) are flattened by recursing
            if (Array.from(el.children).some(c => /^(p|div|ul|ol|h[1-4]|blockquote)$/i.test(c.tagName))) {
                Array.from(el.children).forEach(block);
                return;
            }
            const html = inline(el).trim();
            const text = el.textContent?.trim() ?? '';
            if (!text) return;
            if (isArabic(text)) {
                const quoted = /^[«"“]/.test(text);
                out.push(`<p class="tf-ar${quoted ? ' tf-ar-quote' : ''}" dir="rtl" lang="ar">${html}</p>`);
            } else {
                out.push(`<p class="tf-p">${html}</p>`);
            }
        }
    };

    const children = Array.from(doc.body.children);
    if (children.length === 0) {
        const t = doc.body.textContent?.trim();
        return t ? `<p class="tf-p">${esc(t)}</p>` : '';
    }
    children.forEach(block);
    return out.join('\n');
}

function plainText(html: string): string {
    if (typeof DOMParser === 'undefined') return '';
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim();
}

export default function TafseerModal({
    isOpen,
    onClose,
    verse,
    chapter,
    allVerses,
    onNavigate,
    cleanArabicText,
    removeBismillah,
}: TafseerModalProps) {
    const [scholarKey, setScholarKey] = useState<ScholarKey>('ibn-kathir');
    const [data, setData] = useState<AyahTafsir | null | undefined>(undefined); // undefined = loading
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [sizeIdx, setSizeIdx] = useState(1);
    const [showVerse, setShowVerse] = useState(true);
    const [copied, setCopied] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);

    const scholar = SCHOLARS.find(s => s.key === scholarKey)!;
    const verseKey = verse?.verse_key ?? null;

    useEffect(() => {
        try {
            const v = Number(localStorage.getItem(SIZE_KEY));
            if (v >= 0 && v < SIZES.length && localStorage.getItem(SIZE_KEY) !== null) setSizeIdx(v);
        } catch { /* ignore */ }
        // On phones, start with the ayah collapsed so the commentary is on screen straight away
        if (window.innerWidth < 900) setShowVerse(false);
    }, []);
    const changeSize = (d: number) => {
        setSizeIdx(i => {
            const n = Math.min(SIZES.length - 1, Math.max(0, i + d));
            try { localStorage.setItem(SIZE_KEY, String(n)); } catch { /* ignore */ }
            return n;
        });
    };

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const currentIndex = verse ? allVerses.findIndex(v => v.verse_number === verse.verse_number) : -1;
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < allVerses.length - 1;
    const goPrev = useCallback(() => { if (hasPrev) onNavigate(allVerses[currentIndex - 1].verse_number); }, [hasPrev, onNavigate, allVerses, currentIndex]);
    const goNext = useCallback(() => { if (hasNext) onNavigate(allVerses[currentIndex + 1].verse_number); }, [hasNext, onNavigate, allVerses, currentIndex]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, goPrev, goNext]);

    // Load the commentary for the current ayah + scholar, then warm the next ayah
    useEffect(() => {
        if (!isOpen || !verseKey) return;
        let live = true;
        setData(undefined);
        setError(false);
        getAyahTafsir(scholar.id, verseKey)
            .then(r => {
                if (!live) return;
                setData(r);
                if (hasNext) getAyahTafsir(scholar.id, allVerses[currentIndex + 1].verse_key).catch(() => { });
            })
            .catch(() => live && setError(true));
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, verseKey, scholar.id, attempt]);

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
    }, [verseKey, scholarKey]);

    const html = useMemo(() => (data ? cleanTafsirHtml(data.html) : ''), [data]);

    if (!verse || !chapter) return null;

    const arabic = cleanArabicText(
        verse.verse_number === 1 && removeBismillah
            ? removeBismillah(verse.text_uthmani ?? '')
            : (verse.text_uthmani ?? '')
    );
    const translation = verse.translations?.[0]?.text?.replace(/<[^>]+>/g, '') ?? '';

    const group = data?.verseKeys ?? [];
    const spansMany = group.length > 1;
    const groupLabel = spansMany ? `${group[0]} – ${group[group.length - 1]}` : null;
    const words = html ? plainText(html).split(/\s+/).filter(Boolean).length : 0;
    const minutes = Math.max(1, Math.round(words / 200));

    const copy = () => {
        const text = `${chapter.name_simple} ${verse.verse_key}\n\n${plainText(html)}\n\n— ${scholar.fullName}`;
        navigator.clipboard.writeText(text).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <>
            <div className={`tf-backdrop${isOpen ? ' open' : ''}`} onClick={onClose} aria-hidden="true" />
            <aside
                className={`tf-sheet${isOpen ? ' open' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={`Tafseer for ayah ${verse.verse_key}`}
            >
                <span className="tf-grabber" aria-hidden="true" />

                <header className="tf-head">
                    <div className="tf-head-title">
                        <strong>{chapter.name_simple}</strong>
                        <span>Ayah {verse.verse_number} of {chapter.verses_count}</span>
                    </div>
                    <div className="tf-head-actions">
                        <button className="tf-icon" onClick={goPrev} disabled={!hasPrev} aria-label="Previous ayah"><ChevronLeft size={18} /></button>
                        <span className="tf-key">{verse.verse_key}</span>
                        <button className="tf-icon" onClick={goNext} disabled={!hasNext} aria-label="Next ayah"><ChevronRight size={18} /></button>
                        <button className="tf-icon tf-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
                    </div>
                </header>

                <div className="tf-tabs" role="tablist" aria-label="Choose commentary">
                    {SCHOLARS.map(s => (
                        <button
                            key={s.key}
                            role="tab"
                            aria-selected={s.key === scholarKey}
                            className={`tf-tab${s.key === scholarKey ? ' on' : ''}`}
                            onClick={() => setScholarKey(s.key)}
                        >
                            <span className="tf-tab-name" dir={s.rtl ? 'rtl' : undefined}>{s.name}</span>
                            <small>{s.tag}</small>
                        </button>
                    ))}
                </div>

                <div className="tf-body" ref={bodyRef}>
                    <section className={`tf-verse${showVerse ? '' : ' collapsed'}`}>
                        <button className="tf-verse-toggle" onClick={() => setShowVerse(v => !v)} aria-expanded={showVerse}>
                            <span>The ayah</span>
                            <ChevronRight size={14} className="tf-chev" />
                        </button>
                        {showVerse && (
                            <>
                                <p className="tf-verse-ar font-arabic" dir="rtl" lang="ar">{arabic}</p>
                                {translation && <p className="tf-verse-tr">{translation}</p>}
                            </>
                        )}
                    </section>

                    <section className="tf-meta">
                        <div className="tf-meta-info">
                            <h2>{scholar.fullName}</h2>
                            <p>{scholar.desc}</p>
                            {groupLabel && <span className="tf-chip" title="This commentary explains these ayahs together">Covers ayahs {groupLabel}</span>}
                        </div>
                        <div className="tf-tools">
                            <div className="tf-size" role="group" aria-label="Text size">
                                <button onClick={() => changeSize(-1)} disabled={sizeIdx === 0} aria-label="Smaller text"><Minus size={14} /></button>
                                <span aria-hidden="true">Aa</span>
                                <button onClick={() => changeSize(1)} disabled={sizeIdx === SIZES.length - 1} aria-label="Larger text"><Plus size={14} /></button>
                            </div>
                            <button className="tf-copy" onClick={copy} disabled={!html}>
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </section>

                    <section className="tf-content" style={{ ['--tf-size' as string]: `${SIZES[sizeIdx]}px` }}>
                        {!error && data === undefined && (
                            <div className="tf-skel" aria-label="Loading commentary">
                                {[100, 92, 96, 70, 88, 100, 64].map((w, i) => <i key={i} style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />)}
                            </div>
                        )}

                        {error && (
                            <div className="tf-state">
                                <p><strong>Couldn’t load this commentary.</strong></p>
                                <p>Check your connection and try again.</p>
                                <button className="tf-retry" onClick={() => setAttempt(a => a + 1)}><RefreshCw size={14} /> Retry</button>
                            </div>
                        )}

                        {!error && data === null && (
                            <div className="tf-state">
                                <p><strong>No commentary for this ayah in {scholar.fullName}.</strong></p>
                                <p>Try another commentary above.</p>
                                {SCHOLARS.filter(s => s.key !== scholarKey).slice(0, 2).map(s => (
                                    <button key={s.key} className="tf-retry" onClick={() => setScholarKey(s.key)}>Open {s.fullName}</button>
                                ))}
                            </div>
                        )}

                        {!error && html && (
                            <>
                                {words > 0 && <p className="tf-read">{minutes} min read</p>}
                                <article
                                    className={`tf-prose${scholar.rtl ? ' rtl' : ''}`}
                                    dir={scholar.rtl ? 'rtl' : undefined}
                                    dangerouslySetInnerHTML={{ __html: html }}
                                />
                            </>
                        )}
                    </section>
                </div>

                <footer className="tf-foot">
                    <button onClick={goPrev} disabled={!hasPrev}><ChevronLeft size={16} /> Previous ayah</button>
                    <button onClick={goNext} disabled={!hasNext}>Next ayah <ChevronRight size={16} /></button>
                </footer>
            </aside>
        </>
    );
}
