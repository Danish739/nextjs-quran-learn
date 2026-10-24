'use client';

import { useState, useEffect, useRef, useCallback, use, memo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    getChapter,
    getAllVerses,
    getVersesWithWords,
    Chapter,
    VerseWithTranslation,
    POPULAR_RECITERS,
    TRANSLATIONS
} from '../lib/api';
import { saveLastRead, markVerseRead } from '../lib/progress';
import { parseTranslationWithFootnotes } from '../lib/translationUtils';
import { trackSurahVisit } from '@/lib/recentSurahs';
import { loadQcfFontsForPages, qcfFontFamily } from '../lib/qcf';
import TafseerModal from '../components/TafseerModal';
import MushafPager, { MushafLoader } from '../components/MushafPager';
import { PageBar, PageNav, readPageParam, writePageParam } from '../components/PageControls';
import { usePageVerses } from '../lib/usePageVerses';
import '../styles/reader.css';
import '../styles/tafseer-modal.css';
import '../styles/reading-room.css';

// Normalize Arabic Uthmani text for display.
const normalizeArabicText = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/[\n\r\t]+/g, ' ')
        .replace(/\u06E1/g, '\u0652')
        .replace(/[\uFBB2-\uFBC2]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const cleanArabicText = (text: string): string => {
    return normalizeArabicText(text)
        .replace(/\s{2,}/g, ' ')
        .trim();
};



// Ultra-strict: check if text has at least one visible/meaningful character



const removeBismillah = (text: string): string => {
    if (!text) return '';
    const isStrippable = (code: number) =>
        (code >= 0x0610 && code <= 0x061A) ||
        (code >= 0x064B && code <= 0x065F) ||
        code === 0x0670 ||
        (code >= 0x06D6 && code <= 0x06ED) ||
        code === 0x0640 ||
        (code >= 0x06EE && code <= 0x06EF) ||
        (code >= 0xFBB2 && code <= 0xFBC2);
    const strip = (s: string) => Array.from(s).filter(c => !isStrippable(c.charCodeAt(0))).join('');
    const stripped = strip(text);
    const bismillahPattern = /^بسم\s+[اٱ]?لله\s+[اٱ]?لرحمن\s+[اٱ]?لرحيم\s*/u;
    const match = stripped.match(bismillahPattern);
    if (match) {
        const matchedLen = match[0].length;
        let count = 0;
        let cutIndex = 0;
        for (let i = 0; i < text.length; i++) {
            if (!isStrippable(text.charCodeAt(i))) count++;
            if (count >= matchedLen) { cutIndex = i + 1; break; }
        }
        return text.slice(cutIndex).trim();
    }
    return text;
};


const toArabicNumeral = (num: number): string => {
    // Arabic-Indic digits used in Quran verse markers
    const d = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(c => d[parseInt(c)]).join('');
};

// Check if a verse is Bismillah (should not be numbered)
const isBismillahVerse = (verseNumber: number, verseText: string): boolean => {
    if (verseNumber === 0) return true; // Explicitly marked as Bismillah
    // Also check for Bismillah text pattern (as safeguard)
    const normalizedText = normalizeArabicText(verseText).toLowerCase();
    return /^بسم\s*الله\s*الرحمن\s*الرحيم\s*$/.test(normalizedText);
};

const AyahEnding = memo(({ number, size = 28 }: { number: number; size?: number }) => {
    const circleSize = Math.max(30, Math.round(size * 1.1));
    const numSize = Math.max(12, Math.round(size * 0.45));
    return (
        <svg className="rr-ayah-mark" width={circleSize} height={circleSize} viewBox="0 0 36 36" aria-label={`Ayah ${number}`}>
            <circle className="ring" cx="18" cy="18" r="16.5" />
            <circle className="inner" cx="18" cy="18" r="13" />
            <text x="18" y="18" textAnchor="middle" dy="0.36em" fontSize={numSize} fontFamily="'Noto Sans Arabic', 'UthmanicHafs', serif" style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>
                {toArabicNumeral(number)}
            </text>
        </svg>
    );
});
AyahEnding.displayName = 'AyahEnding';



const escapeGlyph = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Renders an ayah with the QCF v2 page fonts, including the Mushaf's own ayah-number glyph. */
const QcfAyah = memo(({ words }: { words: any[] }) => (
    <>
        {words.map((w, i) => (
            <span key={w.id ?? i}>
                <span
                    className={`rr-qcf-word${w.char_type_name === 'end' ? ' is-end' : ''}`}
                    style={{ fontFamily: `${qcfFontFamily(w.page_number)}, UthmanicHafs, serif` }}
                    dangerouslySetInnerHTML={{ __html: escapeGlyph(w.code_v2) }}
                />
                {i < words.length - 1 ? ' ' : ''}
            </span>
        ))}
    </>
));
QcfAyah.displayName = 'QcfAyah';

interface SurahPageProps {
    params: Promise<{ surahNumber: string }>;
}

type ReadingMode = 'translation' | 'reading' | 'word-by-word';

const ALL_SURAHS = [
    { number: 1, name: 'Al-Fatiha', translation: 'The Opening', arabic: 'الفاتحة' },
    { number: 2, name: 'Al-Baqarah', translation: 'The Cow', arabic: 'البقرة' },
    { number: 3, name: 'Al \u2018Imran', translation: 'Family of Imran', arabic: 'آل عمران' },
    { number: 4, name: 'An-Nisa', translation: 'The Women', arabic: 'النساء' },
    { number: 5, name: 'Al-Ma\u2019idah', translation: 'The Table Spread', arabic: 'المائدة' },
    { number: 6, name: 'Al-An\u2018am', translation: 'The Cattle', arabic: 'الأنعام' },
    { number: 7, name: 'Al-A\u2018raf', translation: 'The Heights', arabic: 'الأعراف' },
    { number: 8, name: 'Al-Anfal', translation: 'The Spoils of War', arabic: 'الأنفال' },
    { number: 9, name: 'At-Tawbah', translation: 'The Repentance', arabic: 'التوبة' },
    { number: 10, name: 'Yunus', translation: 'Jonah', arabic: 'يونس' },
    { number: 11, name: 'Hud', translation: 'Hud', arabic: 'هود' },
    { number: 12, name: 'Yusuf', translation: 'Joseph', arabic: 'يوسف' },
    { number: 13, name: 'Ar-Ra\u2018d', translation: 'The Thunder', arabic: 'الرعد' },
    { number: 14, name: 'Ibrahim', translation: 'Abraham', arabic: 'إبراهيم' },
    { number: 15, name: 'Al-Hijr', translation: 'The Rocky Tract', arabic: 'الحجر' },
    { number: 16, name: 'An-Nahl', translation: 'The Bee', arabic: 'النحل' },
    { number: 17, name: 'Al-Isra', translation: 'The Night Journey', arabic: 'الإسراء' },
    { number: 18, name: 'Al-Kahf', translation: 'The Cave', arabic: 'الكهف' },
    { number: 19, name: 'Maryam', translation: 'Mary', arabic: 'مريم' },
    { number: 20, name: 'Ta-Ha', translation: 'Ta-Ha', arabic: 'طه' },
    { number: 21, name: 'Al-Anbya', translation: 'The Prophets', arabic: 'الأنبياء' },
    { number: 22, name: 'Al-Hajj', translation: 'The Pilgrimage', arabic: 'الحج' },
    { number: 23, name: 'Al-Mu\u2019minun', translation: 'The Believers', arabic: 'المؤمنون' },
    { number: 24, name: 'An-Nur', translation: 'The Light', arabic: 'النور' },
    { number: 25, name: 'Al-Furqan', translation: 'The Criterion', arabic: 'الفرقان' },
    { number: 26, name: 'Ash-Shu\u2018ara', translation: 'The Poets', arabic: 'الشعراء' },
    { number: 27, name: 'An-Naml', translation: 'The Ant', arabic: 'النمل' },
    { number: 28, name: 'Al-Qasas', translation: 'The Stories', arabic: 'القصص' },
    { number: 29, name: 'Al-\u2018Ankabut', translation: 'The Spider', arabic: 'العنكبوت' },
    { number: 30, name: 'Ar-Rum', translation: 'The Romans', arabic: 'الروم' },
    { number: 31, name: 'Luqman', translation: 'Luqman', arabic: 'لقمان' },
    { number: 32, name: 'As-Sajdah', translation: 'The Prostration', arabic: 'السجدة' },
    { number: 33, name: 'Al-Ahzab', translation: 'The Combined Forces', arabic: 'الأحزاب' },
    { number: 34, name: 'Saba', translation: 'Sheba', arabic: 'سبأ' },
    { number: 35, name: 'Fatir', translation: 'Originator', arabic: 'فاطر' },
    { number: 36, name: 'Ya-Sin', translation: 'Ya Sin', arabic: 'يس' },
    { number: 37, name: 'As-Saffat', translation: 'Those Ranged in Ranks', arabic: 'الصافات' },
    { number: 38, name: 'Sad', translation: 'The Letter Sad', arabic: 'ص' },
    { number: 39, name: 'Az-Zumar', translation: 'The Groups', arabic: 'الزمر' },
    { number: 40, name: 'Ghafir', translation: 'The Forgiver', arabic: 'غافر' },
    { number: 41, name: 'Fussilat', translation: 'Explained in Detail', arabic: 'فصلت' },
    { number: 42, name: 'Ash-Shuraa', translation: 'The Consultation', arabic: 'الشورى' },
    { number: 43, name: 'Az-Zukhruf', translation: 'The Gold Adornments', arabic: 'الزخرف' },
    { number: 44, name: 'Ad-Dukhan', translation: 'The Smoke', arabic: 'الدخان' },
    { number: 45, name: 'Al-Jathiyah', translation: 'The Kneeling', arabic: 'الجاثية' },
    { number: 46, name: 'Al-Ahqaf', translation: 'The Wind-Curved Sandhills', arabic: 'الأحقاف' },
    { number: 47, name: 'Muhammad', translation: 'Muhammad', arabic: 'محمد' },
    { number: 48, name: 'Al-Fath', translation: 'The Victory', arabic: 'الفتح' },
    { number: 49, name: 'Al-Hujurat', translation: 'The Rooms', arabic: 'الحجرات' },
    { number: 50, name: 'Qaf', translation: 'The Letter Qaf', arabic: 'ق' },
    { number: 51, name: 'Adh-Dhariyat', translation: 'The Winnowing Winds', arabic: 'الذاريات' },
    { number: 52, name: 'At-Tur', translation: 'The Mount', arabic: 'الطور' },
    { number: 53, name: 'An-Najm', translation: 'The Star', arabic: 'النجم' },
    { number: 54, name: 'Al-Qamar', translation: 'The Moon', arabic: 'القمر' },
    { number: 55, name: 'Ar-Rahman', translation: 'The Beneficent', arabic: 'الرحمن' },
    { number: 56, name: 'Al-Waqi\u2018ah', translation: 'The Inevitable', arabic: 'الواقعة' },
    { number: 57, name: 'Al-Hadid', translation: 'The Iron', arabic: 'الحديد' },
    { number: 58, name: 'Al-Mujadila', translation: 'The Pleading Woman', arabic: 'المجادلة' },
    { number: 59, name: 'Al-Hashr', translation: 'The Exile', arabic: 'الحشر' },
    { number: 60, name: 'Al-Mumtahanah', translation: 'She That is to be Examined', arabic: 'الممتحنة' },
    { number: 61, name: 'As-Saf', translation: 'The Ranks', arabic: 'الصف' },
    { number: 62, name: 'Al-Jumu\u2018ah', translation: 'The Congregation', arabic: 'الجمعة' },
    { number: 63, name: 'Al-Munafiqun', translation: 'The Hypocrites', arabic: 'المنافقون' },
    { number: 64, name: 'At-Taghabun', translation: 'The Mutual Disillusion', arabic: 'التغابن' },
    { number: 65, name: 'At-Talaq', translation: 'The Divorce', arabic: 'الطلاق' },
    { number: 66, name: 'At-Tahrim', translation: 'The Prohibition', arabic: 'التحريم' },
    { number: 67, name: 'Al-Mulk', translation: 'The Sovereignty', arabic: 'الملك' },
    { number: 68, name: 'Al-Qalam', translation: 'The Pen', arabic: 'القلم' },
    { number: 69, name: 'Al-Haqqah', translation: 'The Reality', arabic: 'الحاقة' },
    { number: 70, name: 'Al-Ma\u2018arij', translation: 'The Ascending Stairways', arabic: 'المعارج' },
    { number: 71, name: 'Nuh', translation: 'Noah', arabic: 'نوح' },
    { number: 72, name: 'Al-Jinn', translation: 'The Jinn', arabic: 'الجن' },
    { number: 73, name: 'Al-Muzzammil', translation: 'The Enshrouded One', arabic: 'المزمل' },
    { number: 74, name: 'Al-Muddaththir', translation: 'The Cloaked One', arabic: 'المدثر' },
    { number: 75, name: 'Al-Qiyamah', translation: 'The Resurrection', arabic: 'القيامة' },
    { number: 76, name: 'Al-Insan', translation: 'The Human', arabic: 'الإنسان' },
    { number: 77, name: 'Al-Mursalat', translation: 'The Emissaries', arabic: 'المرسلات' },
    { number: 78, name: 'An-Naba', translation: 'The Tidings', arabic: 'النبأ' },
    { number: 79, name: 'An-Nazi\u2018at', translation: 'Those Who Drag Forth', arabic: 'النازعات' },
    { number: 80, name: '\u2018Abasa', translation: 'He Frowned', arabic: 'عبس' },
    { number: 81, name: 'At-Takwir', translation: 'The Overthrowing', arabic: 'التكوير' },
    { number: 82, name: 'Al-Infitar', translation: 'The Cleaving', arabic: 'الانفطار' },
    { number: 83, name: 'Al-Mutaffifin', translation: 'The Defrauding', arabic: 'المطففين' },
    { number: 84, name: 'Al-Inshiqaq', translation: 'The Sundering', arabic: 'الانشقاق' },
    { number: 85, name: 'Al-Buruj', translation: 'The Mansions of the Stars', arabic: 'البروج' },
    { number: 86, name: 'At-Tariq', translation: 'The Morning Star', arabic: 'الطارق' },
    { number: 87, name: 'Al-A\u2018la', translation: 'The Most High', arabic: 'الأعلى' },
    { number: 88, name: 'Al-Ghashiyah', translation: 'The Overwhelming', arabic: 'الغاشية' },
    { number: 89, name: 'Al-Fajr', translation: 'The Dawn', arabic: 'الفجر' },
    { number: 90, name: 'Al-Balad', translation: 'The City', arabic: 'البلد' },
    { number: 91, name: 'Ash-Shams', translation: 'The Sun', arabic: 'الشمس' },
    { number: 92, name: 'Al-Layl', translation: 'The Night', arabic: 'الليل' },
    { number: 93, name: 'Ad-Duhaa', translation: 'The Morning Hours', arabic: 'الضحى' },
    { number: 94, name: 'Ash-Sharh', translation: 'The Relief', arabic: 'الشرح' },
    { number: 95, name: 'At-Tin', translation: 'The Fig', arabic: 'التين' },
    { number: 96, name: 'Al-\u2018Alaq', translation: 'The Clot', arabic: 'العلق' },
    { number: 97, name: 'Al-Qadr', translation: 'The Power', arabic: 'القدر' },
    { number: 98, name: 'Al-Bayyinah', translation: 'The Clear Proof', arabic: 'البينة' },
    { number: 99, name: 'Az-Zalzalah', translation: 'The Earthquake', arabic: 'الزلزلة' },
    { number: 100, name: 'Al-\u2018Adiyat', translation: 'The Chargers', arabic: 'العاديات' },
    { number: 101, name: 'Al-Qari\u2018ah', translation: 'The Calamity', arabic: 'القارعة' },
    { number: 102, name: 'At-Takathur', translation: 'The Rivalry in World Increase', arabic: 'التكاثر' },
    { number: 103, name: 'Al-\u2018Asr', translation: 'The Declining Day', arabic: 'العصر' },
    { number: 104, name: 'Al-Humazah', translation: 'The Traducer', arabic: 'الهمزة' },
    { number: 105, name: 'Al-Fil', translation: 'The Elephant', arabic: 'الفيل' },
    { number: 106, name: 'Quraysh', translation: 'Quraysh', arabic: 'قريش' },
    { number: 107, name: 'Al-Ma\u2018un', translation: 'The Small Kindnesses', arabic: 'الماعون' },
    { number: 108, name: 'Al-Kawthar', translation: 'The Abundance', arabic: 'الكوثر' },
    { number: 109, name: 'Al-Kafirun', translation: 'The Disbelievers', arabic: 'الكافرون' },
    { number: 110, name: 'An-Nasr', translation: 'The Divine Support', arabic: 'النصر' },
    { number: 111, name: 'Al-Masad', translation: 'The Palm Fiber', arabic: 'المسد' },
    { number: 112, name: 'Al-Ikhlas', translation: 'The Sincerity', arabic: 'الإخلاص' },
    { number: 113, name: 'Al-Falaq', translation: 'The Daybreak', arabic: 'الفلق' },
    { number: 114, name: 'An-Nas', translation: 'The Mankind', arabic: 'الناس' },
];

export default function SurahReadingPage({ params }: SurahPageProps) {
    const { surahNumber: surahNumberStr } = use(params);
    const surahNumber = parseInt(surahNumberStr);
    const searchParams = useSearchParams();
    const initialMode = searchParams?.get('mode') ?? 'reading';

    const [chapter, setChapter] = useState<Chapter | null>(null);
    const [verses, setVerses] = useState<VerseWithTranslation[]>([]);
    const [versesWithWords, setVersesWithWords] = useState<VerseWithTranslation[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setWordDataLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [readingMode, setReadingMode] = useState<ReadingMode>(
        (initialMode === 'reading' || initialMode === 'word-by-word')
            ? initialMode as ReadingMode
            : 'translation'
    );
    const [selectedTranslation, setSelectedTranslation] = useState('en.sahih');
    const [selectedReciter, setSelectedReciter] = useState(7);
    const [fontSize, setFontSize] = useState(32);
    const [showSettings, setShowSettings] = useState(false);
    const [showTranslation, setShowTranslation] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentVerse, setCurrentVerse] = useState<number | null>(null);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const audioCurrentTimeLabel = `${Math.floor(audioCurrentTime / 60)}:${String(Math.floor(audioCurrentTime % 60)).padStart(2, '0')}`;
    const audioDurationLabel = `${Math.floor(audioDuration / 60)}:${String(Math.floor(audioDuration % 60)).padStart(2, '0')}`;
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playbackIdRef = useRef(0);
    const isMountedRef = useRef(true);

    const [, setShowVerseNav] = useState(false);
    const [showSurahPicker, setShowSurahPicker] = useState(false);
    const [showVersePicker, setShowVersePicker] = useState(false);
    const [bookmarks, setBookmarks] = useState<string[]>([]);
    
    // Tafseer modal state (replaces inline expand panels)
    const [tafseerModalVerse, setTafseerModalVerse] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

    const verseToPageIndexRef = useRef<Map<number, number>>(new Map());

    // ── Word Detail Modal state ──
    interface SelectedWordInfo {
        text_uthmani: string;
        text_qpc_hafs?: string;
        translation: string;
        transliteration: string;
        location: string; // e.g. "1:2:1"
        audio_url?: string | null;
        char_type_name?: string;
        position: number;
        verseKey: string;
        code_v2?: string;
        page_number?: number;
        /** every word of the ayah, used to show the word in context */
        verseWords: any[];
    }
    const [selectedWord, setSelectedWord] = useState<SelectedWordInfo | null>(null);
    const wordAudioRef = useRef<HTMLAudioElement | null>(null);
    const [wordAudioPlaying, setWordAudioPlaying] = useState(false);

    const playWordAudio = useCallback((audioUrl?: string | null) => {
        if (!audioUrl) return;
        if (wordAudioRef.current) {
            wordAudioRef.current.pause();
            wordAudioRef.current = null;
        }
        const fullUrl = audioUrl.startsWith('http') ? audioUrl : `https://audio.qurancdn.com/${audioUrl}`;
        const audio = new Audio(fullUrl);
        wordAudioRef.current = audio;
        setWordAudioPlaying(true);
        audio.play().catch(() => setWordAudioPlaying(false));
        audio.onended = () => setWordAudioPlaying(false);
        audio.onerror = () => setWordAudioPlaying(false);
    }, []);

    const openWordDetail = useCallback((word: any, verseKey: string, verseWords: any[] = []) => {
        setSelectedWord({
            text_uthmani: word.text_uthmani,
            text_qpc_hafs: (word as any).text_qpc_hafs,
            translation: word.translation?.text || '',
            transliteration: word.transliteration?.text || '',
            location: word.location || `${verseKey}:${word.position}`,
            audio_url: word.audio_url,
            char_type_name: word.char_type_name,
            position: word.position,
            verseKey,
            code_v2: word.code_v2,
            page_number: word.page_number,
            verseWords,
        });
    }, []);

    // ESC to close word detail modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedWord) {
                    setSelectedWord(null);
                    if (wordAudioRef.current) {
                        wordAudioRef.current.pause();
                        wordAudioRef.current = null;
                        setWordAudioPlaying(false);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedWord]);

    // Mushaf page pagination for reading mode
    const [, setMushafPageIndex] = useState(0);

    // Reading-room UI state
    const [surahQuery, setSurahQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const progressRef = useRef<HTMLSpanElement | null>(null);

    // Page-by-page ayahs for Translation / Word by Word (same ?page= as Reading mode)
    const [pageIdx, setPageIdx] = useState(0);
    const [pageRetry, setPageRetry] = useState(0);
    const pendingVerseRef = useRef<number | null>(null);
    const firstPage = chapter?.pages?.[0] ?? 1;
    const lastPage = chapter?.pages?.[chapter.pages.length - 1] ?? firstPage;
    const totalPages = lastPage - firstPage + 1;
    const pagedMode = readingMode !== 'reading';
    const translationResourceId = TRANSLATIONS.find(t => t.id === selectedTranslation)?.resourceId ?? '20';
    const { verses: pageVerses, loading: pageLoading, error: pageError } = usePageVerses(
        surahNumber,
        chapter && pagedMode ? firstPage + pageIdx : null,
        lastPage,
        translationResourceId,
        pageRetry
    );

    // Unified Data Loader - Fetches everything needed in one go and pre-calculates contexts
    useEffect(() => {
        let isCancelled = false;
        async function loadAllData() {
            if (surahNumber < 1 || surahNumber > 114) { 
                setError('Invalid surah number'); 
                setLoading(false); 
                return; 
            }

            try {
                setLoading(true);
                setWordDataLoading(true);
                
                // 1. Load Chapter Info
                const chapterData = await getChapter(surahNumber);
                if (isCancelled) return;
                setChapter(chapterData);
                setMushafPageIndex(0);
                setLoading(false);

                // 2. Load Verses (with or without words depending on requirements)
                // We always try to get words if we are in reading/wbw modes as it's more complete
                const needsWords = readingMode === 'reading' || readingMode === 'word-by-word';
                const resourceId = TRANSLATIONS.find(t => t.id === selectedTranslation)?.resourceId ?? '20';

                // Fetch data
                const versesData = needsWords 
                    ? await getVersesWithWords(surahNumber, resourceId)
                    : (await getAllVerses(surahNumber, resourceId));
                
                if (isCancelled) return;

                // 3. Pre-calculate Verse Contexts for instant word-detail loading
                // We attach 'verseContext' to each verse so we don't join strings on every click
                const processedVerses = versesData.map(v => {
                    const context = v.words 
                        ? v.words.filter((w: any) => w.char_type_name !== 'end').map((w: any) => cleanArabicText(w.text_uthmani)).join(' ')
                        : '';
                    return { ...v, verseContext: context };
                });

                setVerses(processedVerses);
                if (needsWords) setVersesWithWords(processedVerses);
                
                // Special check: if we were in translation mode but now need words (and didn't fetch them),
                // we'll handle that in the dependency trigger below or just fetch them anyway.
                // For simplicity and to satisfy "pre-load completely", let's always fetch words in background if they're missing.
                if (!needsWords) {
                    getVersesWithWords(surahNumber, resourceId).then(wordData => {
                        if (!isCancelled) {
                            const processed = wordData.map(v => ({
                                ...v,
                                verseContext: v.words?.filter((w: any) => w.char_type_name !== 'end').map((w: any) => cleanArabicText(w.text_uthmani)).join(' ') || ''
                            }));
                            setVersesWithWords(processed);
                        }
                    }).catch(() => {});
                }

            } catch (err) {
                if (!isCancelled) setError('Failed to load Surah data');
                console.error(err);
            } finally {
                if (!isMountedRef.current) return;
                setLoading(false);
                setWordDataLoading(false);
            }
        }

        loadAllData();
        return () => { isCancelled = true; };
    }, [surahNumber, selectedTranslation, readingMode]);

    // Register QCF page fonts for every page this surah spans
    useEffect(() => {
        const pages = new Set<number>();
        versesWithWords.forEach(v => v.words?.forEach((w: any) => w.page_number && pages.add(w.page_number)));
        loadQcfFontsForPages(pages);
    }, [versesWithWords]);

    // The reader is a full-screen layer: lock the page behind it so only one scrollbar exists
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add('rr-lock');
        return () => root.classList.remove('rr-lock');
    }, []);

    // Pick up ?page= when the surah loads or when switching into a paged mode
    useEffect(() => {
        if (chapter && pagedMode) setPageIdx(readPageParam(totalPages));
    }, [chapter, pagedMode, totalPages]);

    const goPage = useCallback((i: number) => {
        setPageIdx(Math.min(Math.max(i, 0), Math.max(totalPages - 1, 0)));
    }, [totalPages]);

    // Persist the page and return to the top (unless we're heading for a specific ayah)
    useEffect(() => {
        if (!chapter || !pagedMode) return;
        writePageParam(pageIdx);
        if (pendingVerseRef.current == null) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [pageIdx, chapter, pagedMode]);

    // Once the page has rendered, finish any pending jump to an ayah
    useEffect(() => {
        if (pageLoading || pendingVerseRef.current == null) return;
        const v = pendingVerseRef.current;
        pendingVerseRef.current = null;
        setTimeout(() => document.getElementById(`verse-${v}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }, [pageLoading, pageVerses]);

    // [ and ] turn pages in Translation / Word by Word
    useEffect(() => {
        if (!pagedMode) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
            if (e.key === ']' || e.key === 'PageDown') { e.preventDefault(); goPage(pageIdx + 1); }
            if (e.key === '[' || e.key === 'PageUp') { e.preventDefault(); goPage(pageIdx - 1); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pagedMode, pageIdx, goPage]);

    // Track recently visited surah
    useEffect(() => {
        if (!chapter) return;
        const meta = ALL_SURAHS.find(s => s.number === surahNumber);
        trackSurahVisit({
            num: surahNumber,
            name: chapter.name_simple,
            ar: meta?.arabic ?? '',
            v: chapter.verses_count,
        });
    }, [chapter, surahNumber]);

    // Load bookmarks
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('quran-bookmarks');
            if (saved) setBookmarks(JSON.parse(saved));
        }
    }, []);

    // Cleanup
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (currentVerse && isPlaying && autoScroll) {
            const el = document.getElementById(`verse-${currentVerse}`);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
            const page = verses.find(v => v.verse_number === currentVerse)?.page_number;
            if (pagedMode && page && chapter) {
                pendingVerseRef.current = currentVerse;
                setPageIdx(page - (chapter.pages?.[0] ?? 1));
            }
        }
    }, [currentVerse, isPlaying, autoScroll, verses, pagedMode, chapter]);

    // Save progress
    useEffect(() => {
        if (chapter && currentVerse) {
            saveLastRead(surahNumber, chapter.name_simple, currentVerse);
            markVerseRead(`${surahNumber}:${currentVerse}`);
        }
    }, [currentVerse, chapter, surahNumber]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.code) {
                case 'Space': e.preventDefault(); if (isPlaying) stopAudio(); else if (audioEnabled) playVerse(currentVerse || 1, true); break;
                case 'ArrowRight': if (audioEnabled && currentVerse && currentVerse < verses.length) playVerse(currentVerse + 1); break;
                case 'ArrowLeft': if (audioEnabled && currentVerse && currentVerse > 1) playVerse(currentVerse - 1); break;
                case 'Escape': stopAudio(); setShowSettings(false); setShowVerseNav(false); setShowVersePicker(false); setShowSurahPicker(false); break;
                case 'KeyS': if (e.metaKey || e.ctrlKey) { e.preventDefault(); setShowSettings(true); } break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, currentVerse, verses.length]);

    const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2500);
    };

    // Open tafseer modal for a specific verse
    const openTafseer = useCallback((verseNumber: number) => {
        setTafseerModalVerse(verseNumber);
    }, []);

    const closeTafseer = useCallback(() => {
        setTafseerModalVerse(null);
    }, []);

    const toggleBookmark = useCallback((verseKey: string) => {
        const isBookmarked = bookmarks.includes(verseKey);
        const newBookmarks = isBookmarked ? bookmarks.filter(b => b !== verseKey) : [...bookmarks, verseKey];
        setBookmarks(newBookmarks);
        localStorage.setItem('quran-bookmarks', JSON.stringify(newBookmarks));
        showToast(isBookmarked ? 'Bookmark removed' : 'Verse bookmarked!');
    }, [bookmarks]);

    const copyVerse = useCallback((verse: VerseWithTranslation) => {
        const arabicText = verse.text_uthmani;
        const text = `${arabicText}\n\n${verse.translations?.[0]?.text || ''}\n\n— Quran ${verse.verse_key}`;
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!');
    }, []);

    const shareVerse = useCallback(async (verse: VerseWithTranslation) => {
        const arabicText = verse.text_uthmani;
        const text = `${arabicText}\n\n${verse.translations?.[0]?.text || ''}\n\n— Quran ${verse.verse_key}`;
        const url = `${window.location.origin}/read-quran/${surahNumber}#verse-${verse.verse_number}`;
        if (navigator.share) {
            try { await navigator.share({ title: `Quran ${verse.verse_key}`, text, url }); } catch { }
        } else {
            navigator.clipboard.writeText(text + '\n\n' + url);
            showToast('Link copied!', 'warning');
        }
    }, [surahNumber]);

    const playVerse = useCallback((verseNumber: number, forcePlay = false) => {
        if (!audioEnabled && !forcePlay) return;
        const myPlaybackId = ++playbackIdRef.current;
        if (!isMountedRef.current) return;
        const verse = verses.find(v => v.verse_number === verseNumber);
        if (!verse) return;
        const reciter = POPULAR_RECITERS.find(r => r.id === selectedReciter);
        const folder = reciter?.folder || 'Alafasy_128kbps';
        const surahPadded = surahNumber.toString().padStart(3, '0');
        const versePadded = verseNumber.toString().padStart(3, '0');
        const audioUrl = `https://everyayah.com/data/${folder}/${surahPadded}${versePadded}.mp3`;
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        // Reset progress display for new verse
        setAudioProgress(0);
        setAudioCurrentTime(0);
        setAudioDuration(0);
        audio.onplay = () => { if (isMountedRef.current && myPlaybackId === playbackIdRef.current) { setIsPlaying(true); setCurrentVerse(verseNumber); } };
        audio.onloadedmetadata = () => { if (isMountedRef.current && myPlaybackId === playbackIdRef.current) setAudioDuration(audio.duration || 0); };
        audio.ontimeupdate = () => {
            if (isMountedRef.current && myPlaybackId === playbackIdRef.current && audio.duration) {
                setAudioCurrentTime(audio.currentTime);
                setAudioProgress((audio.currentTime / audio.duration) * 100);
            }
        };
        audio.onended = () => {
            if (!isMountedRef.current || myPlaybackId !== playbackIdRef.current) return;
            if (verseNumber < verses.length) playVerse(verseNumber + 1);
            else { setIsPlaying(false); setCurrentVerse(null); }
        };
        audio.onerror = () => { if (isMountedRef.current && myPlaybackId === playbackIdRef.current) { setIsPlaying(false); showToast('Audio failed to load', 'warning'); } };
        audio.play().catch(() => showToast('Could not play audio', 'warning'));
    }, [surahNumber, verses, selectedReciter, audioEnabled]);

    const stopAudio = useCallback(() => {
        playbackIdRef.current++;
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        setIsPlaying(false);
        setCurrentVerse(null);
    }, []);


    const jumpToVerse = useCallback((verseNumber: number) => {
        setShowVerseNav(false);
        if (readingMode !== 'reading' && chapter) {
            const page = verses.find(v => v.verse_number === verseNumber)?.page_number;
            const target = page ? page - (chapter.pages?.[0] ?? 1) : null;
            if (target != null && target !== pageIdx) {
                pendingVerseRef.current = verseNumber;
                setPageIdx(target);
                return;
            }
        }
        // In reading mode, switch to the page containing this verse first
        const legacyPageIdx = verseToPageIndexRef.current.get(verseNumber);
        if (legacyPageIdx !== undefined) {
            setMushafPageIndex(legacyPageIdx);
            // Scroll after page renders
            setTimeout(() => {
                const el = document.getElementById(`verse-${verseNumber}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
        } else {
            const el = document.getElementById(`verse-${verseNumber}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [readingMode, chapter, verses, pageIdx]);

    // Loading state
    if (loading) {
        return (
            <div className="rr">
                <div className="rr-scroll" style={{ paddingTop: 40 }}>
                    <MushafLoader label="Opening the Surah" />
                </div>
            </div>
        );
    }

    if (error || !chapter) {
        return (
            <div className="rr">
                <div className="rr-state">
                    <span className="material-symbols-outlined" style={{ fontSize: 40 }}>menu_book</span>
                    <p>{error || 'Surah not found'}</p>
                    <Link href="/read-quran">← Back to the library</Link>
                </div>
            </div>
        );
    }


    const reciterName = POPULAR_RECITERS.find(r => r.id === selectedReciter)?.name ?? 'Reciter';
    const showBismillah = chapter.bismillah_pre && surahNumber !== 1 && surahNumber !== 9;
    const pagesLabel = firstPage ? (firstPage === lastPage ? `Page ${firstPage}` : `Pages ${firstPage}–${lastPage}`) : null;
    const sq = surahQuery.trim().toLowerCase();
    const surahResults = sq
        ? ALL_SURAHS.filter(s => s.name.toLowerCase().includes(sq) || s.translation.toLowerCase().includes(sq) || s.arabic.includes(surahQuery.trim()) || String(s.number) === sq)
        : ALL_SURAHS;
    const modes: { id: ReadingMode; label: string; icon: string }[] = [
        { id: 'reading', label: 'Reading', icon: 'auto_stories' },
        { id: 'translation', label: 'Translation', icon: 'translate' },
        { id: 'word-by-word', label: 'Word by Word', icon: 'text_fields' },
    ];
    const verseArabic = (verse: VerseWithTranslation) =>
        cleanArabicText(verse.verse_number === 1 && chapter.bismillah_pre ? removeBismillah(verse.text_uthmani) : verse.text_uthmani);
    const closeWordDetail = () => {
        setSelectedWord(null);
        if (wordAudioRef.current) { wordAudioRef.current.pause(); wordAudioRef.current = null; setWordAudioPlaying(false); }
    };
    const startListening = () => {
        setAudioEnabled(true);
        playVerse(currentVerse || 1, true);
    };

    const hero = (
        <section className="rr-hero">
            <div style={{ position: 'relative', zIndex: 1 }}>
                <p className="rr-hero-kicker">Surah {surahNumber} of 114</p>
                <h1>{chapter.name_simple}</h1>
                <p className="rr-hero-meaning">“{chapter.translated_name.name}”</p>
                <div className="rr-hero-chips">
                    <span>
                        <span className="material-symbols-outlined">{chapter.revelation_place === 'makkah' ? 'landscape' : 'location_city'}</span>
                        {chapter.revelation_place === 'makkah' ? 'Makkah' : 'Madinah'}
                    </span>
                    <span>
                        <span className="material-symbols-outlined">format_list_numbered</span>
                        {chapter.verses_count} ayahs
                    </span>
                    <span>
                        <span className="material-symbols-outlined">history</span>
                        Revealed #{chapter.revelation_order}
                    </span>
                    {pagesLabel && (
                        <span>
                            <span className="material-symbols-outlined">description</span>
                            {pagesLabel}
                        </span>
                    )}
                </div>
            </div>
            <div className="rr-hero-right">
                <span className="rr-hero-ar font-arabic" lang="ar">{chapter.name_arabic}</span>
                <button className="rr-hero-play" onClick={startListening}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                    Listen
                </button>
            </div>
        </section>
    );

    const bismillah = showBismillah && (
        <div className="rr-bismillah">
            {/* Same Mushaf calligraphy as Reading mode */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bismillah.svg" alt="بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" />
            <span className="rr-rule" aria-hidden="true" />
        </div>
    );

    const pageHasOpening = pageVerses.some(v => v.verse_number === 1);
    const pageBar = <PageBar index={pageIdx} total={totalPages} firstPage={firstPage} onGo={goPage} />;
    const pageNav = <PageNav index={pageIdx} total={totalPages} firstPage={firstPage} onGo={goPage} surahNumber={surahNumber} linkQuery={`mode=${readingMode}`} />;
    const pageState = pageError ? (
        <div className="mp-error">
            <span className="material-symbols-outlined">cloud_off</span>
            <p>{pageError}</p>
            <button onClick={() => setPageRetry(r => r + 1)}>Try again</button>
        </div>
    ) : pageLoading ? (
        <MushafLoader label={`Preparing page ${pageIdx + 1}`} />
    ) : null;

    return (
        <>
            <div className="rr">
                {/* ── Top bar ── */}
                <header className="rr-bar">
                    <div className="rr-bar-left">
                        <Link href="/read-quran" className="rr-icon-btn" aria-label="Back to the library" title="Library">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </Link>
                        <button
                            className="rr-surah-btn"
                            onClick={() => { setShowSurahPicker(v => !v); setShowVersePicker(false); setSurahQuery(''); }}
                            aria-haspopup="dialog"
                            aria-expanded={showSurahPicker}
                        >
                            <span className="rr-surah-num">{surahNumber}</span>
                            <span className="rr-surah-btn-text">
                                <b>{chapter.name_simple}</b>
                                <small>{chapter.translated_name.name} · {chapter.verses_count} ayahs</small>
                            </span>
                            <span className="material-symbols-outlined" style={{ color: 'var(--rr-muted)' }}>expand_more</span>
                        </button>
                    </div>

                    <div className="rr-bar-center">
                        <div className="rr-modes" role="tablist" aria-label="Reading mode">
                            {modes.map(m => (
                                <button key={m.id} role="tab" aria-selected={readingMode === m.id} className={readingMode === m.id ? 'on' : ''} onClick={() => setReadingMode(m.id)}>
                                    <span className="material-symbols-outlined">{m.icon}</span>
                                    <span className="rr-mode-label">{m.label}</span>
                                    {m.id === 'word-by-word' && <span className="rr-mode-short">Words</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rr-bar-right">
                        {readingMode !== 'reading' && (
                            <button
                                className={`rr-icon-btn${showVersePicker ? ' on' : ''}`}
                                onClick={() => { setShowVersePicker(v => !v); setShowSurahPicker(false); }}
                                title="Go to ayah"
                            >
                                <span className="material-symbols-outlined">format_list_numbered</span>
                                <span className="rr-btn-label">Ayah</span>
                            </button>
                        )}
                        <button
                            className={`rr-icon-btn${audioEnabled ? ' on' : ''}`}
                            onClick={() => { if (audioEnabled) { stopAudio(); setAudioEnabled(false); } else setAudioEnabled(true); }}
                            title={audioEnabled ? 'Close player' : 'Listen'}
                        >
                            <span className="material-symbols-outlined">headphones</span>
                            <span className="rr-btn-label">Listen</span>
                        </button>
                        <button className="rr-icon-btn" onClick={() => setShowSettings(true)} title="Reading settings (Ctrl+S)">
                            <span className="material-symbols-outlined">tune</span>
                        </button>
                    </div>

                    <span ref={progressRef} className="rr-progress" style={{ width: '0%' }} aria-hidden="true" />
                </header>

                {/* ── Reading area ── */}
                <div
                    ref={scrollRef}
                    className="rr-scroll"
                    onScroll={e => {
                        const el = e.currentTarget;
                        const max = el.scrollHeight - el.clientHeight;
                        if (progressRef.current) progressRef.current.style.width = `${max > 0 ? (el.scrollTop / max) * 100 : 0}%`;
                    }}
                >
                    {readingMode === 'reading' ? (
                        <div className="rr-column wide">
                            <MushafPager
                                surahNumber={surahNumber}
                                surahName={chapter.name_simple}
                                surahArabic={chapter.name_arabic}
                                pages={chapter.pages}
                            />
                        </div>
                    ) : readingMode === 'word-by-word' ? (
                        <div className="rr-column">
                            {pageIdx === 0 && hero}
                            {pageBar}
                            {!pageState && pageHasOpening && bismillah}
                            {pageState ?? pageVerses.filter(v => !isBismillahVerse(v.verse_number, v.text_uthmani)).map(verse => (
                                <article key={verse.id} id={`verse-${verse.verse_number}`} className={`rr-verse${currentVerse === verse.verse_number ? ' is-playing' : ''}`}>
                                    <div className="rr-verse-top">
                                        <span className="rr-vnum">{verse.verse_number}</span>
                                        <div className="rr-actions">
                                            <button className="rr-act rr-act-play" onClick={() => { setAudioEnabled(true); playVerse(verse.verse_number, true); }} title="Play ayah">
                                                <span className="material-symbols-outlined">play_arrow</span>
                                                <span className="rr-act-label">Play</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="rr-wbw-words">
                                        {verse.words && verse.words.length > 0 ? (
                                            verse.words.filter((w: any) => w.char_type_name !== 'end').map((word: any, idx: number) => {
                                                const location = word.location || `${verse.verse_key}:${word.position}`;
                                                return (
                                                    <button
                                                        key={word.id || idx}
                                                        className={`rr-word${selectedWord?.location === location ? ' on' : ''}`}
                                                        onClick={() => openWordDetail(word, verse.verse_key, verse.words || [])}
                                                    >
                                                        {word.code_v2 ? (
                                                            <span
                                                                className="rr-word-ar is-qcf"
                                                                style={{ fontFamily: `${qcfFontFamily(word.page_number)}, UthmanicHafs, serif` }}
                                                                dangerouslySetInnerHTML={{ __html: escapeGlyph(word.code_v2) }}
                                                            />
                                                        ) : (
                                                            <span className="rr-word-ar">{cleanArabicText(word.text_uthmani)}</span>
                                                        )}
                                                        {word.translation?.text && <span className="rr-word-en">{word.translation.text}</span>}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <p className="rr-arabic font-arabic" style={{ fontSize }}>{verseArabic(verse)}</p>
                                        )}
                                    </div>
                                    {showTranslation && (
                                        <p className="rr-translation">{parseTranslationWithFootnotes(verse.translations?.[0]?.text || '')}</p>
                                    )}
                                </article>
                            ))}
                            {pageNav}
                        </div>
                    ) : (
                        <div className="rr-column">
                            {pageIdx === 0 && hero}
                            {pageBar}
                            {!pageState && pageHasOpening && bismillah}
                            {pageState ?? pageVerses.filter(v => !isBismillahVerse(v.verse_number, v.text_uthmani)).map(verse => {
                                const saved = bookmarks.includes(verse.verse_key);
                                const glyphWords = verse.words?.filter((w: any) => w.code_v2) ?? [];
                                const playing = currentVerse === verse.verse_number;
                                return (
                                    <article key={verse.id} id={`verse-${verse.verse_number}`} className={`rr-verse${playing ? ' is-playing' : ''}`}>
                                        <div className="rr-verse-top">
                                            <span className="rr-vnum" title={verse.verse_key}>{verse.verse_number}</span>
                                            <div className="rr-actions">
                                                <button className="rr-act" onClick={() => openTafseer(verse.verse_number)} title="Tafseer">
                                                    <span className="material-symbols-outlined">menu_book</span>
                                                    <span className="rr-act-label">Tafseer</span>
                                                </button>
                                                <button className={`rr-act${saved ? ' on' : ''}`} onClick={() => toggleBookmark(verse.verse_key)} title={saved ? 'Remove bookmark' : 'Bookmark'}>
                                                    <span className="material-symbols-outlined">bookmark</span>
                                                </button>
                                                <button className="rr-act" onClick={() => copyVerse(verse)} title="Copy">
                                                    <span className="material-symbols-outlined">content_copy</span>
                                                </button>
                                                <button className="rr-act" onClick={() => shareVerse(verse)} title="Share">
                                                    <span className="material-symbols-outlined">ios_share</span>
                                                </button>
                                                <button
                                                    className="rr-act rr-act-play"
                                                    onClick={() => { if (playing && isPlaying) stopAudio(); else { setAudioEnabled(true); playVerse(verse.verse_number, true); } }}
                                                    title={playing && isPlaying ? 'Stop' : 'Play ayah'}
                                                >
                                                    <span className="material-symbols-outlined">{playing && isPlaying ? 'stop' : 'play_arrow'}</span>
                                                    <span className="rr-act-label">{playing && isPlaying ? 'Stop' : 'Play'}</span>
                                                </button>
                                            </div>
                                        </div>
                                        <p className={`rr-arabic${glyphWords.length ? ' is-qcf' : ' font-arabic'}`} lang="ar" style={{ fontSize }} onClick={() => { setAudioEnabled(true); playVerse(verse.verse_number, true); }}>
                                            {glyphWords.length ? (
                                                <QcfAyah words={glyphWords} />
                                            ) : (
                                                <>
                                                    {verseArabic(verse)}{' '}
                                                    <AyahEnding number={verse.verse_number} size={Math.round(fontSize * 0.9)} />
                                                </>
                                            )}
                                        </p>
                                        {showTranslation && (
                                            <p className="rr-translation">{parseTranslationWithFootnotes(verse.translations?.[0]?.text || 'Translation not available')}</p>
                                        )}
                                    </article>
                                );
                            })}
                            {pageNav}
                        </div>
                    )}
                </div>

                {/* ── Floating player ── */}
                {audioEnabled && (
                    <div className="rr-player" role="region" aria-label="Audio player">
                        <span className="rr-player-art" aria-hidden="true">{chapter.name_arabic}</span>
                        <div className="rr-player-info">
                            <b>{chapter.name_simple}{currentVerse ? ` · Ayah ${currentVerse}` : ''}</b>
                            <small>{reciterName}</small>
                            <div className="rr-player-bar">
                                <span>{audioCurrentTimeLabel}</span>
                                <div className="rr-player-track"><span style={{ width: `${audioProgress}%` }} /></div>
                                <span>{audioDurationLabel}</span>
                            </div>
                        </div>
                        <div className="rr-player-ctrls">
                            <button className="rr-pbtn" onClick={() => currentVerse && playVerse(currentVerse - 1, true)} disabled={!currentVerse || currentVerse <= 1} aria-label="Previous ayah">
                                <span className="material-symbols-outlined">skip_previous</span>
                            </button>
                            <button className="rr-pbtn main" onClick={() => { if (isPlaying) stopAudio(); else playVerse(currentVerse || 1, true); }} aria-label={isPlaying ? 'Stop' : 'Play'}>
                                <span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span>
                            </button>
                            <button className="rr-pbtn" onClick={() => playVerse((currentVerse || 0) + 1, true)} disabled={!!currentVerse && currentVerse >= verses.length} aria-label="Next ayah">
                                <span className="material-symbols-outlined">skip_next</span>
                            </button>
                            <button className="rr-pbtn" onClick={() => { stopAudio(); setAudioEnabled(false); }} aria-label="Close player">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Surah picker ── */}
            {showSurahPicker && (
                <>
                    <div className="rr-overlay" onClick={() => setShowSurahPicker(false)} />
                    <div className="rr-pop rr-pop-surah" role="dialog" aria-label="Choose a surah">
                        <div className="rr-pop-head">
                            <span><b>Choose a Surah</b><small>114 total</small></span>
                            <button className="rr-icon-btn" onClick={() => setShowSurahPicker(false)} aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <label className="rr-pop-search">
                            <span className="material-symbols-outlined" style={{ color: 'var(--rr-muted)' }}>search</span>
                            <input autoFocus value={surahQuery} onChange={e => setSurahQuery(e.target.value)} placeholder="Name, meaning or number" aria-label="Search surahs" />
                        </label>
                        <div className="rr-pop-list">
                            {surahResults.map(s => (
                                <Link
                                    key={s.number}
                                    href={`/read-quran/${s.number}?mode=${readingMode}`}
                                    onClick={() => setShowSurahPicker(false)}
                                    className={`rr-pop-row${s.number === surahNumber ? ' on' : ''}`}
                                >
                                    <span className="rr-surah-num">{s.number}</span>
                                    <span className="rr-pop-row-text"><b>{s.name}</b><small>{s.translation}</small></span>
                                    <span className="font-arabic" lang="ar">{s.arabic}</span>
                                </Link>
                            ))}
                            {surahResults.length === 0 && <p style={{ padding: 20, textAlign: 'center', color: 'var(--rr-muted)' }}>No surah matches “{surahQuery}”.</p>}
                        </div>
                    </div>
                </>
            )}

            {/* ── Ayah picker ── */}
            {showVersePicker && (
                <>
                    <div className="rr-overlay" onClick={() => setShowVersePicker(false)} />
                    <div className="rr-pop rr-pop-verse" role="dialog" aria-label="Go to ayah">
                        <div className="rr-pop-head">
                            <span><b>Go to Ayah</b><small>{chapter.verses_count} ayahs</small></span>
                            <button className="rr-icon-btn" onClick={() => setShowVersePicker(false)} aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="rr-verse-grid">
                            {Array.from({ length: chapter.verses_count }, (_, i) => i + 1).map(n => {
                                const key = `${surahNumber}:${n}`;
                                return (
                                    <button
                                        key={n}
                                        className={`${n === currentVerse ? 'on' : ''}${bookmarks.includes(key) ? ' saved' : ''}`}
                                        onClick={() => { setShowVersePicker(false); jumpToVerse(n); }}
                                        title={bookmarks.includes(key) ? 'Bookmarked' : undefined}
                                    >
                                        {n}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* ── Settings drawer ── */}
            {showSettings && (
                <>
                    <div className="rr-overlay" onClick={() => setShowSettings(false)} />
                    <aside className="rr-drawer" role="dialog" aria-label="Reading settings">
                        <div className="rr-drawer-head">
                            <h2>Reading settings</h2>
                            <button className="rr-icon-btn" onClick={() => setShowSettings(false)} aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="rr-drawer-body">
                            <div className="rr-field">
                                <span className="rr-field-label">Arabic text size</span>
                                <div className="rr-size">
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--rr-muted)' }}>text_decrease</span>
                                    <input type="range" min="24" max="52" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} aria-label="Arabic font size" />
                                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--rr-muted)' }}>text_increase</span>
                                    <span className="rr-size-val">{fontSize}px</span>
                                </div>
                                <p className="rr-size-preview font-arabic" style={{ fontSize }} lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
                            </div>
                            <div className="rr-field">
                                <label htmlFor="rr-translation">Translation</label>
                                <select id="rr-translation" className="rr-select" value={selectedTranslation} onChange={e => setSelectedTranslation(e.target.value)}>
                                    {TRANSLATIONS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                                </select>
                            </div>
                            <div className="rr-field">
                                <label htmlFor="rr-reciter">Reciter</label>
                                <select id="rr-reciter" className="rr-select" value={selectedReciter} onChange={e => setSelectedReciter(parseInt(e.target.value))}>
                                    {POPULAR_RECITERS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="rr-field">
                                <span className="rr-field-label">Display</span>
                                <div className="rr-toggle" role="switch" aria-checked={showTranslation} tabIndex={0} onClick={() => setShowTranslation(v => !v)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTranslation(v => !v); } }}>
                                    <span><b>Show translation</b><small>Meaning below each ayah</small></span>
                                    <span className={`rr-switch${showTranslation ? ' on' : ''}`} />
                                </div>
                                <div className="rr-toggle" role="switch" aria-checked={autoScroll} tabIndex={0} onClick={() => setAutoScroll(v => !v)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAutoScroll(v => !v); } }}>
                                    <span><b>Follow along</b><small>Scroll to the ayah being recited</small></span>
                                    <span className={`rr-switch${autoScroll ? ' on' : ''}`} />
                                </div>
                            </div>
                            <div className="rr-field">
                                <span className="rr-field-label">Keyboard shortcuts</span>
                                <div className="rr-keys">
                                    <kbd>Space</kbd><span>Play / pause</span>
                                    <kbd>←</kbd><span>Previous ayah</span>
                                    <kbd>→</kbd><span>Next ayah</span>
                                    <kbd>Esc</kbd><span>Stop / close</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </>
            )}

            {/* Toast */}
            {toast && <div className={`reader-toast ${toast.type}`}>{toast.message}</div>}

            {/* ── Word detail ── */}
            {selectedWord && (() => {
                const w = selectedWord;
                const glyphFont = (page?: number) => `${qcfFontFamily(page ?? 1)}, UthmanicHafs, serif`;
                const contextWords = w.verseWords.filter((x: any) => x.code_v2);
                const shareText = `${w.text_uthmani} — ${w.translation}${w.transliteration ? ` (${w.transliteration})` : ''} · Quran ${w.verseKey}`;
                return (
                    <>
                        <div className="rr-overlay" onClick={closeWordDetail} />
                        <div className="rr-word-sheet" role="dialog" aria-modal="true" aria-label="Word details">
                            <header className="rr-ws-head">
                                <span className="rr-ws-ref">
                                    <span className="material-symbols-outlined">menu_book</span>
                                    Ayah {w.verseKey} · word {w.position}
                                </span>
                                <button className="rr-icon-btn" onClick={closeWordDetail} aria-label="Close">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </header>

                            <div className="rr-ws-body">
                                <div className="rr-ws-word">
                                    {w.code_v2 ? (
                                        <span className="rr-ws-glyph" lang="ar" style={{ fontFamily: glyphFont(w.page_number) }} dangerouslySetInnerHTML={{ __html: escapeGlyph(w.code_v2) }} />
                                    ) : (
                                        <span className="rr-ws-glyph font-arabic" lang="ar">{cleanArabicText(w.text_uthmani)}</span>
                                    )}
                                    <b className="rr-ws-meaning">{w.translation || '—'}</b>
                                    {w.transliteration && <span className="rr-ws-translit">{w.transliteration}</span>}
                                </div>

                                {contextWords.length > 0 && (
                                    <div className="rr-ws-context">
                                        <span className="rr-ws-label">In this ayah</span>
                                        <p dir="rtl" lang="ar">
                                            {contextWords.map((x: any, i: number) => (
                                                <span key={x.id ?? i}>
                                                    <span
                                                        className={`rr-ws-cword${x.position === w.position && x.char_type_name !== 'end' ? ' on' : ''}${x.char_type_name === 'end' ? ' is-end' : ''}`}
                                                        style={{ fontFamily: glyphFont(x.page_number) }}
                                                        dangerouslySetInnerHTML={{ __html: escapeGlyph(x.code_v2) }}
                                                    />
                                                    {i < contextWords.length - 1 ? ' ' : ''}
                                                </span>
                                            ))}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="rr-ws-actions">
                                {w.audio_url && (
                                    <button className={`rr-ws-btn primary${wordAudioPlaying ? ' playing' : ''}`} onClick={() => playWordAudio(w.audio_url)}>
                                        <span className="material-symbols-outlined">{wordAudioPlaying ? 'graphic_eq' : 'play_arrow'}</span>
                                        {wordAudioPlaying ? 'Playing' : 'Listen'}
                                    </button>
                                )}
                                <button className="rr-ws-btn" onClick={() => {
                                    if (navigator.share) navigator.share({ text: shareText }).catch(() => {});
                                    else { navigator.clipboard.writeText(shareText); showToast('Word copied!'); }
                                }}>
                                    <span className="material-symbols-outlined">ios_share</span>
                                    Share
                                </button>
                                <button className="rr-ws-btn" onClick={() => { navigator.clipboard.writeText(shareText); showToast('Copied!'); }}>
                                    <span className="material-symbols-outlined">content_copy</span>
                                    Copy
                                </button>
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* Tafseer drawer */}
            <TafseerModal
                isOpen={tafseerModalVerse !== null}
                onClose={closeTafseer}
                verse={verses.find(v => v.verse_number === tafseerModalVerse) ?? null}
                chapter={chapter}
                allVerses={verses}
                onNavigate={(verseNumber) => setTafseerModalVerse(verseNumber)}
                surahNumber={surahNumber}
                cleanArabicText={cleanArabicText}
                removeBismillah={removeBismillah}
            />
        </>
    );
}
