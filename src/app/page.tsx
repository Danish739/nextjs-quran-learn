'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { trackSurahVisit, getRecentSurahs } from '@/lib/recentSurahs';
import HeroCarousel from '@/components/HeroCarousel';
import HadeesOfTheDay from '@/components/HadeesOfTheDay';
import LearnSteps from '@/components/LearnSteps';
import TodayPanel from '@/components/TodayPanel';
import QuickAccessGrid from '@/components/QuickAccessGrid';
import TasbeehCounter from '@/components/TasbeehCounter';
import SurahExplorer from '@/components/SurahExplorer';
import PrayerStrip from '@/components/PrayerStrip';

// ── Prayer Times Types ──
interface PrayerTimesData {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}
interface HijriDate {
  day: string;
  month: { en: string; ar: string; number: number };
  year: string;
  weekday: { en: string; ar: string };
  holidays: string[];
}
interface PrayerApiResponse {
  data: {
    timings: PrayerTimesData & { [key: string]: string };
    date: {
      readable: string;
      hijri: HijriDate;
      gregorian: { date: string; day: string; weekday: { en: string }; month: { en: string; number: number }; year: string };
    };
    meta: { timezone: string; latitude: number; longitude: number };
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const PRAYER_NAMES: { key: keyof PrayerTimesData; label: string; icon: string }[] = [
  { key: 'Fajr', label: 'Fajr', icon: 'routine' },
  { key: 'Sunrise', label: 'Sunrise', icon: 'wb_twilight' },
  { key: 'Dhuhr', label: 'Dhuhr', icon: 'wb_sunny' },
  { key: 'Asr', label: 'Asr', icon: 'sunny_snowing' },
  { key: 'Maghrib', label: 'Maghrib', icon: 'wb_twilight' },
  { key: 'Isha', label: 'Isha', icon: 'dark_mode' },
];

const SURAHS = [
  { num: 1, ar: 'الفاتحة', name: 'Al-Fatihah', meaning: 'The Opening', v: 7, t: 'Meccan' },
  { num: 2, ar: 'البقرة', name: 'Al-Baqarah', meaning: 'The Cow', v: 286, t: 'Medinan' },
  { num: 3, ar: 'آل عمران', name: 'Al-Imran', meaning: 'Family of Imran', v: 200, t: 'Medinan' },
  { num: 4, ar: 'النساء', name: 'An-Nisa', meaning: 'The Women', v: 176, t: 'Medinan' },
  { num: 5, ar: 'المائدة', name: "Al-Ma'idah", meaning: 'The Table Spread', v: 120, t: 'Medinan' },
  { num: 6, ar: 'الأنعام', name: "Al-An'am", meaning: 'The Cattle', v: 165, t: 'Meccan' },
  { num: 7, ar: 'الأعراف', name: "Al-A'raf", meaning: 'The Heights', v: 206, t: 'Meccan' },
  { num: 8, ar: 'الأنفال', name: 'Al-Anfal', meaning: 'The Spoils of War', v: 75, t: 'Medinan' },
  { num: 9, ar: 'التوبة', name: 'At-Tawbah', meaning: 'The Repentance', v: 129, t: 'Medinan' },
  { num: 10, ar: 'يونس', name: 'Yunus', meaning: 'Jonah', v: 109, t: 'Meccan' },
  { num: 11, ar: 'هود', name: 'Hud', meaning: 'Hud', v: 123, t: 'Meccan' },
  { num: 12, ar: 'يوسف', name: 'Yusuf', meaning: 'Joseph', v: 111, t: 'Meccan' },
  { num: 13, ar: 'الرعد', name: "Ar-Ra'd", meaning: 'The Thunder', v: 43, t: 'Medinan' },
  { num: 14, ar: 'إبراهيم', name: 'Ibrahim', meaning: 'Abraham', v: 52, t: 'Meccan' },
  { num: 15, ar: 'الحجر', name: 'Al-Hijr', meaning: 'The Rocky Tract', v: 99, t: 'Meccan' },
  { num: 16, ar: 'النحل', name: 'An-Nahl', meaning: 'The Bee', v: 128, t: 'Meccan' },
  { num: 17, ar: 'الإسراء', name: "Al-Isra'", meaning: 'The Night Journey', v: 111, t: 'Meccan' },
  { num: 18, ar: 'الكهف', name: 'Al-Kahf', meaning: 'The Cave', v: 110, t: 'Meccan' },
  { num: 19, ar: 'مريم', name: 'Maryam', meaning: 'Mary', v: 98, t: 'Meccan' },
  { num: 20, ar: 'طه', name: 'Ta-Ha', meaning: 'Ta-Ha', v: 135, t: 'Meccan' },
  { num: 21, ar: 'الأنبياء', name: "Al-Anbiya'", meaning: 'The Prophets', v: 112, t: 'Meccan' },
  { num: 22, ar: 'الحج', name: 'Al-Hajj', meaning: 'The Pilgrimage', v: 78, t: 'Medinan' },
  { num: 23, ar: 'المؤمنون', name: "Al-Mu'minun", meaning: 'The Believers', v: 118, t: 'Meccan' },
  { num: 24, ar: 'النور', name: 'An-Nur', meaning: 'The Light', v: 64, t: 'Medinan' },
  { num: 25, ar: 'الفرقان', name: 'Al-Furqan', meaning: 'The Criterion', v: 77, t: 'Meccan' },
  { num: 26, ar: 'الشعراء', name: "Ash-Shu'ara'", meaning: 'The Poets', v: 227, t: 'Meccan' },
  { num: 27, ar: 'النمل', name: 'An-Naml', meaning: 'The Ant', v: 93, t: 'Meccan' },
  { num: 28, ar: 'القصص', name: 'Al-Qasas', meaning: 'The Stories', v: 88, t: 'Meccan' },
  { num: 29, ar: 'العنكبوت', name: 'Al-Ankabut', meaning: 'The Spider', v: 69, t: 'Meccan' },
  { num: 30, ar: 'الروم', name: 'Ar-Rum', meaning: 'The Romans', v: 60, t: 'Meccan' },
  { num: 31, ar: 'لقمان', name: 'Luqman', meaning: 'Luqman', v: 34, t: 'Meccan' },
  { num: 32, ar: 'السجدة', name: 'As-Sajdah', meaning: 'The Prostration', v: 30, t: 'Meccan' },
  { num: 33, ar: 'الأحزاب', name: 'Al-Ahzab', meaning: 'The Combined Forces', v: 73, t: 'Medinan' },
  { num: 34, ar: 'سبأ', name: 'Saba', meaning: 'Sheba', v: 54, t: 'Meccan' },
  { num: 35, ar: 'فاطر', name: 'Fatir', meaning: 'Originator', v: 45, t: 'Meccan' },
  { num: 36, ar: 'يس', name: 'Ya-Sin', meaning: 'Ya-Sin', v: 83, t: 'Meccan' },
  { num: 37, ar: 'الصافات', name: 'As-Saffat', meaning: 'Those Lined Up', v: 182, t: 'Meccan' },
  { num: 38, ar: 'ص', name: 'Sad', meaning: 'Sad', v: 88, t: 'Meccan' },
  { num: 39, ar: 'الزمر', name: 'Az-Zumar', meaning: 'The Groups', v: 75, t: 'Meccan' },
  { num: 40, ar: 'غافر', name: 'Ghafir', meaning: 'The Forgiver', v: 85, t: 'Meccan' },
  { num: 41, ar: 'فصلت', name: 'Fussilat', meaning: 'Explained in Detail', v: 54, t: 'Meccan' },
  { num: 42, ar: 'الشورى', name: 'Ash-Shuraa', meaning: 'The Consultation', v: 53, t: 'Meccan' },
  { num: 43, ar: 'الزخرف', name: 'Az-Zukhruf', meaning: 'The Gold Adornments', v: 89, t: 'Meccan' },
  { num: 44, ar: 'الدخان', name: 'Ad-Dukhan', meaning: 'The Smoke', v: 59, t: 'Meccan' },
  { num: 45, ar: 'الجاثية', name: 'Al-Jathiyah', meaning: 'The Crouching', v: 37, t: 'Meccan' },
  { num: 46, ar: 'الأحقاف', name: 'Al-Ahqaf', meaning: 'The Wind-Curved Dunes', v: 35, t: 'Meccan' },
  { num: 47, ar: 'محمد', name: 'Muhammad', meaning: 'Muhammad', v: 38, t: 'Medinan' },
  { num: 48, ar: 'الفتح', name: 'Al-Fath', meaning: 'The Victory', v: 29, t: 'Medinan' },
  { num: 49, ar: 'الحجرات', name: 'Al-Hujurat', meaning: 'The Rooms', v: 18, t: 'Medinan' },
  { num: 50, ar: 'ق', name: 'Qaf', meaning: 'Qaf', v: 45, t: 'Meccan' },
  { num: 51, ar: 'الذاريات', name: 'Adh-Dhariyat', meaning: 'The Scattering Winds', v: 60, t: 'Meccan' },
  { num: 52, ar: 'الطور', name: 'At-Tur', meaning: 'The Mount', v: 49, t: 'Meccan' },
  { num: 53, ar: 'النجم', name: 'An-Najm', meaning: 'The Star', v: 62, t: 'Meccan' },
  { num: 54, ar: 'القمر', name: 'Al-Qamar', meaning: 'The Moon', v: 55, t: 'Meccan' },
  { num: 55, ar: 'الرحمن', name: 'Ar-Rahman', meaning: 'The Beneficent', v: 78, t: 'Medinan' },
  { num: 56, ar: 'الواقعة', name: "Al-Waqi'ah", meaning: 'The Inevitable', v: 96, t: 'Meccan' },
  { num: 57, ar: 'الحديد', name: 'Al-Hadid', meaning: 'The Iron', v: 29, t: 'Medinan' },
  { num: 58, ar: 'المجادلة', name: 'Al-Mujadila', meaning: 'The Pleading Woman', v: 22, t: 'Medinan' },
  { num: 59, ar: 'الحشر', name: 'Al-Hashr', meaning: 'The Exile', v: 24, t: 'Medinan' },
  { num: 60, ar: 'الممتحنة', name: 'Al-Mumtahanah', meaning: 'She That Is Examined', v: 13, t: 'Medinan' },
  { num: 61, ar: 'الصف', name: 'As-Saf', meaning: 'The Ranks', v: 14, t: 'Medinan' },
  { num: 62, ar: 'الجمعة', name: "Al-Jumu'ah", meaning: 'The Friday', v: 11, t: 'Medinan' },
  { num: 63, ar: 'المنافقون', name: 'Al-Munafiqun', meaning: 'The Hypocrites', v: 11, t: 'Medinan' },
  { num: 64, ar: 'التغابن', name: 'At-Taghabun', meaning: 'The Mutual Disillusion', v: 18, t: 'Medinan' },
  { num: 65, ar: 'الطلاق', name: 'At-Talaq', meaning: 'The Divorce', v: 12, t: 'Medinan' },
  { num: 66, ar: 'التحريم', name: 'At-Tahrim', meaning: 'The Prohibition', v: 12, t: 'Medinan' },
  { num: 67, ar: 'الملك', name: 'Al-Mulk', meaning: 'The Sovereignty', v: 30, t: 'Meccan' },
  { num: 68, ar: 'القلم', name: 'Al-Qalam', meaning: 'The Pen', v: 52, t: 'Meccan' },
  { num: 69, ar: 'الحاقة', name: 'Al-Haqqah', meaning: 'The Reality', v: 52, t: 'Meccan' },
  { num: 70, ar: 'المعارج', name: "Al-Ma'arij", meaning: 'The Ascending Stairways', v: 44, t: 'Meccan' },
  { num: 71, ar: 'نوح', name: 'Nuh', meaning: 'Noah', v: 28, t: 'Meccan' },
  { num: 72, ar: 'الجن', name: 'Al-Jinn', meaning: 'The Jinn', v: 28, t: 'Meccan' },
  { num: 73, ar: 'المزمل', name: 'Al-Muzzammil', meaning: 'The Enshrouded One', v: 20, t: 'Meccan' },
  { num: 74, ar: 'المدثر', name: 'Al-Muddaththir', meaning: 'The Cloaked One', v: 56, t: 'Meccan' },
  { num: 75, ar: 'القيامة', name: 'Al-Qiyamah', meaning: 'The Resurrection', v: 40, t: 'Meccan' },
  { num: 76, ar: 'الإنسان', name: 'Al-Insan', meaning: 'The Man', v: 31, t: 'Medinan' },
  { num: 77, ar: 'المرسلات', name: 'Al-Mursalat', meaning: 'The Emissaries', v: 50, t: 'Meccan' },
  { num: 78, ar: 'النبأ', name: "An-Naba'", meaning: 'The Tidings', v: 40, t: 'Meccan' },
  { num: 79, ar: 'النازعات', name: "An-Nazi'at", meaning: 'Those Who Drag Forth', v: 46, t: 'Meccan' },
  { num: 80, ar: 'عبس', name: "Abasa", meaning: 'He Frowned', v: 42, t: 'Meccan' },
  { num: 81, ar: 'التكوير', name: 'At-Takwir', meaning: 'The Overthrowing', v: 29, t: 'Meccan' },
  { num: 82, ar: 'الانفطار', name: 'Al-Infitar', meaning: 'The Cleaving', v: 19, t: 'Meccan' },
  { num: 83, ar: 'المطففين', name: 'Al-Mutaffifin', meaning: 'The Defrauding', v: 36, t: 'Meccan' },
  { num: 84, ar: 'الانشقاق', name: 'Al-Inshiqaq', meaning: 'The Sundering', v: 25, t: 'Meccan' },
  { num: 85, ar: 'البروج', name: 'Al-Buruj', meaning: 'The Mansions of Stars', v: 22, t: 'Meccan' },
  { num: 86, ar: 'الطارق', name: 'At-Tariq', meaning: 'The Morning Star', v: 17, t: 'Meccan' },
  { num: 87, ar: 'الأعلى', name: "Al-A'la", meaning: 'The Most High', v: 19, t: 'Meccan' },
  { num: 88, ar: 'الغاشية', name: 'Al-Ghashiyah', meaning: 'The Overwhelming', v: 26, t: 'Meccan' },
  { num: 89, ar: 'الفجر', name: 'Al-Fajr', meaning: 'The Dawn', v: 30, t: 'Meccan' },
  { num: 90, ar: 'البلد', name: 'Al-Balad', meaning: 'The City', v: 20, t: 'Meccan' },
  { num: 91, ar: 'الشمس', name: 'Ash-Shams', meaning: 'The Sun', v: 15, t: 'Meccan' },
  { num: 92, ar: 'الليل', name: 'Al-Layl', meaning: 'The Night', v: 21, t: 'Meccan' },
  { num: 93, ar: 'الضحى', name: 'Ad-Duhaa', meaning: 'The Morning Hours', v: 11, t: 'Meccan' },
  { num: 94, ar: 'الشرح', name: 'Ash-Sharh', meaning: 'The Relief', v: 8, t: 'Meccan' },
  { num: 95, ar: 'التين', name: 'At-Tin', meaning: 'The Fig', v: 8, t: 'Meccan' },
  { num: 96, ar: 'العلق', name: "Al-'Alaq", meaning: 'The Clot', v: 19, t: 'Meccan' },
  { num: 97, ar: 'القدر', name: 'Al-Qadr', meaning: 'The Power', v: 5, t: 'Meccan' },
  { num: 98, ar: 'البينة', name: 'Al-Bayyinah', meaning: 'The Clear Proof', v: 8, t: 'Medinan' },
  { num: 99, ar: 'الزلزلة', name: 'Az-Zalzalah', meaning: 'The Earthquake', v: 8, t: 'Medinan' },
  { num: 100, ar: 'العاديات', name: "Al-'Adiyat", meaning: 'The Courser', v: 11, t: 'Meccan' },
  { num: 101, ar: 'القارعة', name: "Al-Qari'ah", meaning: 'The Calamity', v: 11, t: 'Meccan' },
  { num: 102, ar: 'التكاثر', name: 'At-Takathur', meaning: 'The Rivalry in World', v: 8, t: 'Meccan' },
  { num: 103, ar: 'العصر', name: "Al-'Asr", meaning: 'The Declining Day', v: 3, t: 'Meccan' },
  { num: 104, ar: 'الهمزة', name: 'Al-Humazah', meaning: 'The Traducer', v: 9, t: 'Meccan' },
  { num: 105, ar: 'الفيل', name: 'Al-Fil', meaning: 'The Elephant', v: 5, t: 'Meccan' },
  { num: 106, ar: 'قريش', name: 'Quraysh', meaning: 'Quraysh', v: 4, t: 'Meccan' },
  { num: 107, ar: 'الماعون', name: "Al-Ma'un", meaning: 'The Small Kindnesses', v: 7, t: 'Meccan' },
  { num: 108, ar: 'الكوثر', name: 'Al-Kawthar', meaning: 'The Abundance', v: 3, t: 'Meccan' },
  { num: 109, ar: 'الكافرون', name: 'Al-Kafirun', meaning: 'The Disbelievers', v: 6, t: 'Meccan' },
  { num: 110, ar: 'النصر', name: 'An-Nasr', meaning: 'The Divine Support', v: 3, t: 'Medinan' },
  { num: 111, ar: 'المسد', name: 'Al-Masad', meaning: 'The Palm Fiber', v: 5, t: 'Meccan' },
  { num: 112, ar: 'الإخلاص', name: 'Al-Ikhlas', meaning: 'The Sincerity', v: 4, t: 'Meccan' },
  { num: 113, ar: 'الفلق', name: 'Al-Falaq', meaning: 'The Daybreak', v: 5, t: 'Meccan' },
  { num: 114, ar: 'الناس', name: 'An-Nas', meaning: 'The Mankind', v: 6, t: 'Meccan' },
];

const FEATURED_ACTIONS = [
  { icon: 'auto_stories', label: 'Mushaf Reader', sub: 'Read page by page', href: '/quran-pages' },
  { icon: 'music_note', label: 'Quran Player', sub: 'Listen & recite', href: '/quran-player' },
  { icon: 'volunteer_activism', label: 'Dua', sub: 'Daily supplications', href: '/dua' },
  { icon: 'format_quote', label: 'Hadees', sub: "Prophet's sayings ﷺ", href: '/hadees' },
];

const FEATURES = [
  { icon: 'menu_book', label: 'Read Quran', sub: '114 Surahs', href: '/read-quran/1', color: 'var(--brand-primary)' },
  { icon: 'explore', label: 'Navigate', sub: 'Surah · Page', href: '#navigate', color: '#0ea5e9' },
  { icon: 'ads_click', label: 'Memorize', sub: 'Hifz Program', href: '/memorize-quran', color: '#a855f7' },
  { icon: 'radio', label: 'Quran Radio', sub: '24/7 Recitation', href: '/radio', color: '#ef4444' },
  { icon: 'translate', label: 'Word by Word', sub: 'Arabic Learning', href: '/read-quran/1?mode=word-by-word', color: '#06b6d4' },
  { icon: 'book_2', label: 'Tafseer', sub: 'Verse Explanations', href: '/tafseer', color: '#8b5cf6' },
];

const AYAHS_OF_DAY = [
  { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ', en: '"So remember Me; I will remember you…"', ref: 'Al-Baqarah 2:152', href: '/read-quran/2' },
  { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', en: '"Verily, with hardship comes ease."', ref: 'Ash-Sharh 94:6', href: '/read-quran/94' },
  { ar: 'وَتَوَكَّلْ عَلَى اللَّهِ ۚ وَكَفَىٰ بِاللَّهِ وَكِيلًا', en: '"Trust in Allah — sufficient is Allah as a Trustee."', ref: 'An-Nisa 4:81', href: '/read-quran/4' },
  { ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', en: '"Indeed, Allah is with the patient."', ref: 'Al-Baqarah 2:153', href: '/read-quran/2' },
  { ar: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', en: '"Whoever relies upon Allah — He is sufficient for him."', ref: 'At-Talaq 65:3', href: '/read-quran/65' },
  { ar: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ', en: '"Do not despair of the mercy of Allah."', ref: 'Yusuf 12:87', href: '/read-quran/12' },
  { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً', en: '"Our Lord, give us good in this world and good in the Hereafter."', ref: 'Al-Baqarah 2:201', href: '/read-quran/2' },
];

const STATS = [
  { num: '114', label: 'Surahs', icon: 'menu_book' },
  { num: '6,236', label: 'Ayahs', icon: 'format_quote' },
  { num: '77,797', label: 'Words', icon: 'abc' },
];

// Search / Quick Start / Navigate bar — hidden for now
const SHOW_HEADER = false;

export default function HomePage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState<'All' | 'Meccan' | 'Medinan'>('All');
  const [showAll, setShowAll] = useState(false);
  const [recent, setRecent] = useState<typeof SURAHS>([]);
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const [sessionTime, setSessionTime] = useState(0); // seconds this session
  const [totalTime, setTotalTime] = useState(0);     // cumulative seconds all sessions

  // ── Reading Streak & Progress ──
  const [readingStreak, setReadingStreak] = useState(0);
  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [sursRead, setSursRead] = useState(0);


  // ── Prayer Times State ──
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesData | null>(null);
  const [hijriDate, setHijriDate] = useState<HijriDate | null>(null);
  const [gregorianDate, setGregorianDate] = useState<string>('');
  const [locationName, setLocationName] = useState<string>('Locating...');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; remaining: string } | null>(null);
  const [prayerLoading, setPrayerLoading] = useState(true);

  // ── Prefetch Dua data after 3 s so the /dua page loads instantly ──
  useEffect(() => {
    const t = setTimeout(() => {
      const slugs = ['categories', 'rabbana', 'morning-evening', 'daily', 'salah', 'protection', 'forgiveness', 'family', 'travel', 'health', 'success', 'anxiety', 'ramadan', 'quran'];
      slugs.forEach(s => fetch(`/data/duas/${s}.json`, { priority: 'low' } as RequestInit).catch(() => { }));
    }, 3000);
    return () => clearTimeout(t);
  }, []);


  // ── Prayer Times: calculate next prayer ──
  const calcNextPrayer = useCallback((times: PrayerTimesData, now: Date) => {
    const prayerOrder: (keyof PrayerTimesData)[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (const key of prayerOrder) {
      if (key === 'Sunrise') continue; // skip sunrise for "next prayer" countdown
      const [h, m] = times[key].split(':').map(Number);
      const pMins = h * 60 + m;
      if (pMins > nowMins) {
        const diff = pMins - nowMins;
        const dH = Math.floor(diff / 60);
        const dM = diff % 60;
        const dS = 60 - now.getSeconds();
        return {
          name: key,
          time: times[key],
          remaining: `${dH > 0 ? dH + 'h ' : ''}${String(dM).padStart(2, '0')}m ${String(dS % 60).padStart(2, '0')}s`,
        };
      }
    }
    // After Isha → next is Fajr (tomorrow)
    const [fH, fM] = times.Fajr.split(':').map(Number);
    const fajrTotalMins = fH * 60 + fM + 24 * 60;
    const diff = fajrTotalMins - nowMins;
    const dH = Math.floor(diff / 60);
    const dM = diff % 60;
    const dS = 60 - now.getSeconds();
    return {
      name: 'Fajr',
      time: times.Fajr,
      remaining: `${dH > 0 ? dH + 'h ' : ''}${String(dM).padStart(2, '0')}m ${String(dS % 60).padStart(2, '0')}s`,
    };
  }, []);

  // ── Fetch prayer times ──
  // Shows cached/IP-based times instantly, then upgrades to precise GPS location when allowed.
  const [locating, setLocating] = useState(false);
  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | 'default'>('default');
  const [locationError, setLocationError] = useState('');
  const preciseRef = useRef(false);

  const loadPrayer = useCallback(async (lat: number, lng: number, source: 'gps' | 'ip' | 'default', label?: string) => {
    // A precise fix must never be overwritten by a slower approximate one
    if (source !== 'gps' && preciseRef.current) return;
    if (source === 'gps') preciseRef.current = true;
    try {
      // No `method` → Aladhan picks the calculation method used in that region
      const d = new Date();
      const date = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      const json = await fetchJsonWithTimeout<PrayerApiResponse>(
        `https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lng}`
      );
      if (source !== 'gps' && preciseRef.current) return;
      const t = json.data.timings;
      setPrayerTimes({ Fajr: t.Fajr, Sunrise: t.Sunrise, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha });
      setHijriDate(json.data.date.hijri);
      const g = json.data.date.gregorian;
      setGregorianDate(`${g.day} ${g.month.en} ${g.year}`);
      setLocationSource(source);
      setPrayerLoading(false);

      let name = label ?? '';
      if (!name) {
        try {
          const geoJson = await fetchJsonWithTimeout<{
            address?: {
              city?: string;
              town?: string;
              village?: string;
              county?: string;
              state?: string;
              country?: string;
            };
          }>(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`);
          const city = geoJson.address?.city || geoJson.address?.town || geoJson.address?.village || geoJson.address?.county || geoJson.address?.state || '';
          const country = geoJson.address?.country || '';
          name = city ? `${city}, ${country}` : country || 'Your Location';
        } catch {
          name = 'Your Location';
        }
      }
      setLocationName(name);
      if (source !== 'default') {
        localStorage.setItem('prayerLocation', JSON.stringify({ lat, lng, name, source }));
      }
    } catch {
      setPrayerLoading(false);
      if (!preciseRef.current) setLocationName('Unable to load');
    }
  }, []);

  const detectLocation = useCallback((silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) setLocationError('Location is not supported on this device');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await loadPrayer(pos.coords.latitude, pos.coords.longitude, 'gps');
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (silent) return;
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? 'Location blocked — allow it from the lock icon in the address bar'
            : 'Could not detect location, please try again'
        );
      },
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  }, [loadPrayer]);

  useEffect(() => {
    // 1. Last known location → instant times
    let hasCache = false;
    try {
      const cached = JSON.parse(localStorage.getItem('prayerLocation') || 'null');
      if (cached && typeof cached.lat === 'number') {
        hasCache = true;
        loadPrayer(cached.lat, cached.lng, cached.source === 'gps' ? 'ip' : cached.source, cached.name);
      }
    } catch { /* ignore */ }

    // 2. Approximate location from IP (no permission needed)
    if (!hasCache) {
      fetchJsonWithTimeout<{
        latitude?: string;
        longitude?: string;
        city?: string;
        country?: string;
      }>('https://get.geojs.io/v1/ip/geo.json')
        .then(ip => {
          const lat = parseFloat(ip.latitude);
          const lng = parseFloat(ip.longitude);
          if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('no coords');
          const name = [ip.city, ip.country].filter(Boolean).join(', ') || undefined;
          return loadPrayer(lat, lng, 'ip', name);
        })
        .catch(() => loadPrayer(21.4225, 39.8262, 'default', 'Makkah, Saudi Arabia'));
    }

    // 3. Precise GPS location — silently if already allowed, otherwise the browser asks once
    detectLocation(true);
  }, [loadPrayer, detectLocation]);

  // ── Real-time clock + next prayer update ──
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (prayerTimes) {
        setNextPrayer(calcNextPrayer(prayerTimes, now));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [prayerTimes, calcNextPrayer]);

  // ── Verse Search ──
  const [verseQuery, setVerseQuery] = useState('');
  const [verseResults, setVerseResults] = useState<{ number: number; text: string; surah: { number: number; name: string; englishName: string }; numberInSurah: number }[]>([]);
  const [verseCount, setVerseCount] = useState<number | null>(null);
  const [verseLoading, setVerseLoading] = useState(false);
  const verseSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Navigate Quran panel ──
  const [showNav, setShowNav] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [navTab, setNavTab] = useState<'surah' | 'page'>('surah');
  const [navSearch, setNavSearch] = useState('');
  const navRef = useRef<HTMLDivElement>(null);
  const openNav = () => { setShowNav(true); setNavLoading(true); setTimeout(() => setNavLoading(false), 600); };


  useEffect(() => {
    const loadRecent = () => {
      const saved = getRecentSurahs();
      // Map to local structure if needed, but our RecentSurah interface now matches what the UI expects (mostly)
      // The UI expects properties that might be missing if we only saved num/name/ar/v
      // However, SURAHS constant has the full data.
      setRecent(saved.map(s => {
        const full = SURAHS.find(f => f.num === s.num);
        return full || { ...s, t: 'Meccan' as const }; // Fallback
      }));
    };

    loadRecent();
    window.addEventListener('recentSurahsUpdated', loadRecent);

    // Load cumulative time
    const savedTotal = parseInt(localStorage.getItem('quranTotalTime') || '0', 10);
    setTotalTime(savedTotal);

    // Load reading streak & weekly data
    const savedStreak = parseInt(localStorage.getItem('readingStreak') || '0', 10);
    setReadingStreak(savedStreak);
    const savedWeekly = localStorage.getItem('weeklyReadingData');
    if (savedWeekly) {
      try { setWeeklyData(JSON.parse(savedWeekly)); } catch { /* ignore */ }
    } else {
      // Generate initial demo data based on recent activity
      const demoData = [35, 60, 90, 75, 50, 25, 80];
      setWeeklyData(demoData);
      localStorage.setItem('weeklyReadingData', JSON.stringify(demoData));
    }
    const savedSurs = parseInt(localStorage.getItem('sursRead') || '0', 10);
    const recentList = getRecentSurahs();
    setSursRead(savedSurs || (recentList.length > 0 ? recentList.length : 0));

    // Update streak on visit
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem('lastVisitDate');
    if (lastVisit !== today) {
      localStorage.setItem('lastVisitDate', today);
      const newStreak = savedStreak + 1;
      setReadingStreak(newStreak);
      localStorage.setItem('readingStreak', String(newStreak));
      // Update today's bar in weekly data
      const dayIdx = new Date().getDay();
      const wd = savedWeekly ? JSON.parse(savedWeekly) : [35, 60, 90, 75, 50, 25, 80];
      wd[dayIdx] = Math.min((wd[dayIdx] || 0) + 15, 100);
      setWeeklyData(wd);
      localStorage.setItem('weeklyReadingData', JSON.stringify(wd));
    }

    return () => window.removeEventListener('recentSurahsUpdated', loadRecent);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close nav on Escape
  useEffect(() => {
    if (!showNav) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNav(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showNav]);

  const dropdownResults = query.trim()
    ? SURAHS.filter(s => {
      const q = query.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.ar.includes(q) || s.meaning.toLowerCase().includes(q) || String(s.num) === q;
    }).slice(0, 6)
    : [];

  // Session timer — ticks every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(s => s + 1);
      setTotalTime(t => {
        const next = t + 1;
        localStorage.setItem('quranTotalTime', String(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Debounced verse search
  useEffect(() => {
    if (verseSearchTimer.current) clearTimeout(verseSearchTimer.current);
    if (verseQuery.trim().length < 3) {
      setVerseResults([]);
      setVerseCount(null);
      return;
    }
    verseSearchTimer.current = setTimeout(async () => {
      setVerseLoading(true);
      try {
        const res = await fetch(`/api/quran-search?q=${encodeURIComponent(verseQuery.trim())}`);
        const json = await res.json();
        if (json?.data?.matches) {
          setVerseResults(json.data.matches.slice(0, 30));
          setVerseCount(json.data.count);
        } else {
          setVerseResults([]);
          setVerseCount(0);
        }
      } catch {
        setVerseResults([]);
        setVerseCount(null);
      } finally {
        setVerseLoading(false);
      }
    }, 500);
    return () => { if (verseSearchTimer.current) clearTimeout(verseSearchTimer.current); };
  }, [verseQuery]);

  const fmtTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };


  const trackVisit = (s: typeof SURAHS[0]) => {
    trackSurahVisit({
      num: s.num,
      name: s.name,
      ar: s.ar,
      v: s.v
    });
  };

  const filtered = SURAHS.filter(s => {
    const q = query.toLowerCase();
    const matchQ = s.name.toLowerCase().includes(q) || s.ar.includes(q) || s.meaning.toLowerCase().includes(q) || String(s.num) === q;
    const matchT = typeFilter === 'All' || s.t === typeFilter;
    return matchQ && matchT;
  });
  const displayed = showAll ? filtered : filtered.slice(0, 12);
  const todayAyah = AYAHS_OF_DAY[new Date().getDate() % AYAHS_OF_DAY.length];

  const S = {
    shell: { display: 'flex', flexDirection: 'column' as const, flex: 1, background: dark ? 'var(--bg-base)' : '#ffffff', fontFamily: "'Figtree','Lexend',sans-serif" },
    card: { background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
    text: { color: 'var(--text-primary)' },
    muted: { color: 'var(--text-muted)' },
    tag: (t: string) => ({ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: t === 'Meccan' ? 'var(--brand-primary)' : 'var(--text-muted)' }),
  };

  return (
    <>
      {/* ── NAVIGATE QURAN OVERLAY ── */}
      {showNav && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex' }}>
          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowNav(false)} />
          {/* Panel */}
          <div ref={navRef} style={{
            position: 'relative', zIndex: 1, width: '100%', maxWidth: 420,
            background: 'var(--bg-base)', borderRight: '1px solid var(--border-default)',
            display: 'flex', flexDirection: 'column', animation: 'navSlideIn 0.25s ease',
            boxShadow: '8px 0 40px rgba(0,0,0,0.15)',
          }}>
            {/* Panel Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${'var(--bg-elevated)'}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, ...S.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--brand-primary)' }}>menu_book</span>
                  Navigate Quran
                </h2>
                <button onClick={() => setShowNav(false)} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>
              {/* Tabs */}
              <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 10, padding: 3, gap: 2 }}>
                {(['surah', 'page'] as const).map(tab => (
                  <button key={tab} onClick={() => { setNavTab(tab); setNavSearch(''); }} style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                    background: navTab === tab ? 'var(--brand-primary)' : 'transparent',
                    color: navTab === tab ? 'white' : '#94a3b8',
                  }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
                ))}
              </div>
              {/* Search within panel */}
              {navTab === 'surah' && (
                <div style={{ position: 'relative', marginTop: 12 }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#94a3b8', pointerEvents: 'none' }}>search</span>
                  <input
                    type="text" value={navSearch} onChange={e => setNavSearch(e.target.value)}
                    placeholder="Search Surah…"
                    style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', fontSize: 13, color: 'var(--text-secondary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-rgb),0.3)'}
                    onBlur={e => e.target.style.boxShadow = 'none'}
                    autoFocus
                  />
                </div>
              )}
            </div>
            {/* Panel Body */}
            <div className="hp-scroll" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
              {navLoading ? (
                <div style={{ padding: '8px 0' }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', flexShrink: 0, animation: 'navSkel 1.2s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 12, borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: 8, width: `${55 + (i % 4) * 10}%`, animation: 'navSkel 1.2s ease-in-out infinite', animationDelay: `${i * 0.07 + 0.1}s` }} />
                        <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-elevated)', width: `${35 + (i % 3) * 8}%`, animation: 'navSkel 1.2s ease-in-out infinite', animationDelay: `${i * 0.07 + 0.2}s` }} />
                      </div>
                      <div style={{ width: 32, textAlign: 'right' }}>
                        <div style={{ height: 18, width: 32, borderRadius: 5, background: 'var(--bg-elevated)', marginBottom: 5, animation: 'navSkel 1.2s ease-in-out infinite', animationDelay: `${i * 0.07 + 0.15}s` }} />
                        <div style={{ height: 8, width: 28, borderRadius: 4, background: 'var(--bg-elevated)', marginLeft: 'auto', animation: 'navSkel 1.2s ease-in-out infinite', animationDelay: `${i * 0.07 + 0.25}s` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : navTab === 'surah' ? (() => {
                const q = navSearch.toLowerCase();
                const list = q ? SURAHS.filter(s => s.name.toLowerCase().includes(q) || s.ar.includes(q) || s.meaning.toLowerCase().includes(q) || String(s.num) === q) : SURAHS;
                return list.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', ...S.muted, fontSize: 13 }}>No surahs found</div>
                ) : <>{list.map((s) => (
                  <Link key={s.num} href={`/read-quran/${s.num}?mode=reading`} onClick={() => { trackVisit(s); setShowNav(false); }} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.12s', cursor: 'pointer',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(var(--brand-rgb),0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--brand-primary)', flexShrink: 0 }}>
                        {s.num}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, ...S.text }}>{s.name}</p>
                        <p style={{ margin: 0, fontSize: 11, ...S.muted }}>{s.meaning} · {s.v} verses</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span className="font-arabic" style={{ fontSize: 18, fontWeight: 700, ...S.text, display: 'block' }}>{s.ar}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: s.t === 'Meccan' ? 'var(--brand-primary)' : '#94a3b8' }}>{s.t}</span>
                      </div>
                    </div>
                  </Link>
                ))}</>;
              })() : (
                <div style={{ padding: '16px 16px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 12, ...S.muted }}>Go to a specific page (1–604)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                    {Array.from({ length: 604 }, (_, i) => i + 1).map(p => (
                      <Link key={p} href={`/page/${p}`} onClick={() => setShowNav(false)} style={{ textDecoration: 'none' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '9px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          color: '#64748b', cursor: 'pointer', transition: 'all 0.12s',
                          background: 'var(--bg-surface)',
                          border: `1px solid ${'var(--bg-elevated)'}`,
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-primary)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--brand-primary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'var(--bg-elevated)'; }}
                        >
                          {p}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Panel Footer */}
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${'var(--bg-elevated)'}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, ...S.muted }}>
                {navTab === 'surah' ? '114 Surahs' : '604 Pages'}
              </span>
              <span style={{ fontSize: 11, ...S.muted }}>ESC to close</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        html{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar{display:none}
        body{scrollbar-width:none;-ms-overflow-style:none}body::-webkit-scrollbar{display:none}
        .hp-scroll::-webkit-scrollbar{width:0;display:none}.hp-scroll{scrollbar-width:none;-ms-overflow-style:none}
        .surah-card{transition:transform 0.18s ease,box-shadow 0.18s ease}.surah-card:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(var(--brand-rgb),0.12)}
        .feat-card{transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);}.feat-card:hover{transform:translateY(-5px);box-shadow:0 12px 40px rgba(0,0,0,0.15) !important;}
        .feat-icon-img{transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);}
        .feat-card:hover .feat-icon-img{transform:scale(1.15) rotate(5deg) translateY(-5px);}
        .hp-dot{background-image:radial-gradient(circle at 2px 2px,rgba(var(--brand-rgb),0.06) 1px,transparent 0);background-size:24px 24px}
        .font-arabic{font-family: "UthmanicHafs", serif}
        .filter-btn{padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.15s}
        .tc-btn{cursor:pointer;border:none;outline:none;background:none;-webkit-tap-highlight-color:transparent;transition:transform 0.08s ease;user-select:none}
        .tc-btn:active{transform:scale(0.93)}
        .tc-flash{animation:tc-pop 0.22s ease}
        @keyframes tc-pop{0%{transform:scale(1)}50%{transform:scale(1.13)}100%{transform:scale(1)}}
        @keyframes navSlideIn{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes navSkel{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}

        /* ── Progress Section ── */
        .progress-bar-col{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;justify-content:flex-end;height:100%}
        .progress-bar-fill{width:100%;border-radius:8px 8px 0 0;transition:height 0.6s cubic-bezier(0.4,0,0.2,1);min-height:4px;position:relative}
        .progress-bar-fill:hover{filter:brightness(1.15);transform:scaleX(1.05)}
        .progress-bar-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em}
        .stat-card-hp{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 12px;border-radius:18px;text-align:center;transition:transform 0.18s ease,box-shadow 0.18s ease}
        .stat-card-hp:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.08)}
        .milestone-badge{display:flex;flex-direction:column;align-items:center;padding:20px 12px;border-radius:20px;text-align:center;cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease}
        .milestone-badge:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,0.1)}
        .milestone-icon{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:12px;transition:transform 0.25s ease}
        .milestone-badge:hover .milestone-icon{transform:scale(1.12)}
        .hp-progress-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        @media(min-width:640px){.hp-progress-grid{grid-template-columns:repeat(4,1fr)}}

        /* ── Prayer Times Hero ── */
        .prayer-hero{
          position:relative;overflow:hidden;border-radius:20px;
          margin-bottom:24px;
          padding:28px 24px 20px;
          background:linear-gradient(135deg,#FFF8E7 0%,#FDECC8 40%,#FDE8B8 100%);
          box-shadow:0 4px 24px rgba(var(--brand-rgb),0.12);
        }
        [data-theme='dark'] .prayer-hero{
          background:linear-gradient(135deg,#1a1612 0%,#1f1a12 40%,#241e14 100%);
          box-shadow:0 4px 24px rgba(0,0,0,0.3);
        }
        .prayer-hero-mosque{
          position:absolute;bottom:0;left:0;right:0;height:100px;pointer-events:none;
          opacity:0.12;
        }
        [data-theme='dark'] .prayer-hero-mosque{opacity:0.08}
        .prayer-hero-orb1{
          position:absolute;top:-60px;right:-40px;width:200px;height:200px;
          border-radius:50%;pointer-events:none;
          background:radial-gradient(circle,rgba(var(--brand-rgb),0.15),transparent 70%);
        }
        .prayer-hero-orb2{
          position:absolute;bottom:-40px;left:-30px;width:150px;height:150px;
          border-radius:50%;pointer-events:none;
          background:radial-gradient(circle,rgba(var(--brand-hover-rgb),0.10),transparent 70%);
        }
        .prayer-clock{font-size:clamp(48px,10vw,72px);font-weight:800;line-height:1;letter-spacing:-2px;
          color:var(--brand-primary-active);font-variant-numeric:tabular-nums;
          text-shadow:0 2px 12px rgba(var(--brand-active-rgb),0.12);
        }
        [data-theme='dark'] .prayer-clock{color:var(--brand-primary);text-shadow:0 2px 18px rgba(var(--brand-rgb),0.25)}
        .prayer-clock-colon{
          display:inline-block;animation:colonBlink 1s step-end infinite;
          margin:0 2px;
        }
        @keyframes colonBlink{0%,100%{opacity:1}50%{opacity:0.3}}
        .prayer-next-badge{
          display:inline-flex;align-items:center;gap:6px;
          background:rgba(var(--brand-rgb),0.15);color:var(--brand-primary-active);
          padding:4px 12px;border-radius:20px;
          font-size:12px;font-weight:600;
          border:1px solid rgba(var(--brand-rgb),0.2);
        }
        [data-theme='dark'] .prayer-next-badge{background:rgba(var(--brand-rgb),0.12);color:var(--brand-primary-light);border-color:rgba(var(--brand-rgb),0.18)}
        .prayer-times-row{
          display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:18px;
        }
        .prayer-time-card{
          display:flex;flex-direction:column;align-items:center;gap:4px;
          padding:10px 4px;border-radius:14px;
          background:rgba(255,255,255,0.65);
          border:1px solid rgba(var(--brand-rgb),0.1);
          transition:all 0.18s ease;
        }
        [data-theme='dark'] .prayer-time-card{
          background:rgba(255,255,255,0.04);
          border-color:rgba(var(--brand-rgb),0.08);
        }
        .prayer-time-card.active{
          background:linear-gradient(135deg,var(--brand-primary),var(--brand-primary-hover));
          border-color:var(--brand-primary);
          box-shadow:0 4px 16px rgba(var(--brand-rgb),0.3);
          transform:translateY(-2px);
        }
        .prayer-time-card.active .ptc-icon,
        .prayer-time-card.active .ptc-label,
        .prayer-time-card.active .ptc-time{color:white !important}
        .ptc-icon{font-size:20px;color:var(--brand-primary-hover)}
        [data-theme='dark'] .ptc-icon{color:var(--brand-primary-light)}
        .ptc-label{font-size:10px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.06em}
        [data-theme='dark'] .ptc-label{color:var(--brand-primary-light)}
        .ptc-time{font-size:13px;font-weight:700;color:#78350f;font-variant-numeric:tabular-nums}
        [data-theme='dark'] .ptc-time{color:#fde68a}
        .prayer-meta-row{
          display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;
          margin-top:8px;
        }
        .prayer-meta-item{
          display:flex;align-items:center;gap:4px;
          font-size:11.5px;font-weight:500;color:#92400e;
        }
        [data-theme='dark'] .prayer-meta-item{color:#d4a574}
        .prayer-hijri{
          text-align:center;margin-top:4px;
          font-size:12px;font-weight:600;color:var(--brand-primary-active);
        }
        [data-theme='dark'] .prayer-hijri{color:var(--brand-primary-light)}
        .prayer-skeleton{
          background:linear-gradient(90deg,rgba(var(--brand-rgb),0.08) 25%,rgba(var(--brand-rgb),0.18) 50%,rgba(var(--brand-rgb),0.08) 75%);
          background-size:200% 100%;animation:shimmerPrayer 1.5s ease infinite;border-radius:8px;
        }
        @keyframes shimmerPrayer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media(max-width:500px){
          .prayer-times-row{grid-template-columns:repeat(3,1fr)}
          .prayer-hero{padding:22px 16px 16px}
        }

        /* ── Better Surah Cards ── */
        .surah-card-better {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 16px 20px;
          border-radius: 16px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
          position: relative;
          overflow: hidden;
        }
        .surah-card-better:hover {
          transform: translateY(-3px);
          background: var(--bg-elevated);
          border-color: rgba(var(--brand-rgb), 0.4);
          box-shadow: 0 12px 32px rgba(var(--brand-rgb), 0.1);
        }
        .surah-card-better .num-box {
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .surah-card-better .num-poly {
          position: absolute;
          inset: 0;
          background: rgba(var(--brand-rgb), 0.08);
          border-radius: 12px;
          transform: rotate(45deg);
          transition: all 0.3s ease;
        }
        .surah-card-better:hover .num-poly {
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
          transform: rotate(45deg) scale(1.08);
          box-shadow: 0 4px 12px rgba(var(--brand-rgb),0.3);
        }
        .surah-card-better .num-text {
          position: relative;
          z-index: 1;
          font-weight: 700;
          font-size: 15px;
          color: var(--brand-primary);
          transition: color 0.3s ease;
        }
        .surah-card-better:hover .num-text {
          color: #ffffff;
        }

        /* ── Responsive ── */
        .hp-header-inner{padding:10px 16px !important}
        .hp-content{padding:16px 16px 16px !important}
        .hp-stats{grid-template-columns:repeat(2,1fr) !important}
        .hp-quick{grid-template-columns:1fr !important}
        .hp-features{grid-template-columns:repeat(3,1fr) !important}
        .hp-surah-grid{grid-template-columns:repeat(2,1fr) !important}
        .hp-qs-hide{display:none !important}
        .hp-dark-hide{display:none !important}
        .hp-sr-meta{display:none !important}
        @media(min-width:540px){.hp-sr-meta{display:flex !important}}
        @media(min-width:640px){
          .hp-header-inner{padding:12px 24px !important}
          .hp-content{padding:20px 24px 16px !important}
          .hp-quick{grid-template-columns:repeat(2,1fr) !important}
          .hp-surah-grid{grid-template-columns:repeat(2,1fr) !important}
          .hp-qs-hide{display:flex !important}
          .hp-dark-hide{display:flex !important}
        }
        @media(min-width:860px){
          .hp-header-inner{padding:12px 28px !important}
          .hp-content{padding:24px 28px 16px !important}
          .hp-stats{grid-template-columns:repeat(4,1fr) !important}
          .hp-quick{grid-template-columns:repeat(3,1fr) !important}
          .hp-features{grid-template-columns:repeat(auto-fill,minmax(130px,1fr)) !important}
          .hp-surah-grid{grid-template-columns:repeat(3,1fr) !important}
          .hp-getstarted-inner{grid-template-columns:1fr 1.4fr !important}
          .hp-getstarted-right{border-left:1px solid rgba(var(--brand-rgb),0.12)}
          .hp-hero-grid{grid-template-columns:1fr auto !important}
          .hp-hero-icon-box{display:flex !important}
        }
        .hp-getstarted-inner{grid-template-columns:1fr}
        .hp-getstarted-right{border-top:1px solid rgba(var(--brand-rgb),0.12)}
      `}</style>

      <div style={S.shell}>
        {/* Header — outside scroll container so dropdown isn't clipped */}
        {SHOW_HEADER && <header style={{ position: 'relative', zIndex: 200, background: 'var(--glass-bg-strong)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-strong)', flexShrink: 0 }}>
          <div className="hp-header-inner" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div ref={searchRef} style={{ flex: 1, position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 20, pointerEvents: 'none', zIndex: 1 }}>search</span>
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setShowAll(true); setShowDropdown(true); }}
                onFocus={e => { if (query.trim()) setShowDropdown(true); e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-rgb),0.4)'; }}
                onKeyDown={e => { if (e.key === 'Escape') { setShowDropdown(false); } }}
                placeholder="Search Surah name, number, or meaning…"
                style={{ width: '100%', background: 'var(--bg-surface)', border: 'none', borderRadius: 12, padding: '10px 14px 10px 40px', fontSize: 13.5, color: 'var(--text-secondary)', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', outline: 'none' }}
                onBlur={e => (e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)')}
              />
              {/* Search Dropdown */}
              {showDropdown && dropdownResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  zIndex: 999, overflow: 'hidden',
                }}>
                  {dropdownResults.map((s, i) => (
                    <Link
                      key={s.num}
                      href={`/read-quran/${s.num}`}
                      onClick={() => { trackVisit(s); setShowDropdown(false); setQuery(''); }}
                      style={{ textDecoration: 'none', display: 'block' }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px',
                        borderTop: i > 0 ? `1px solid ${'var(--bg-elevated)'}` : 'none',
                        cursor: 'pointer', transition: 'background 0.12s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(var(--brand-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--brand-primary)', fontSize: 12, flexShrink: 0 }}>
                          {s.num}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{s.meaning} · {s.v} verses</p>
                        </div>
                        <div className="hp-sr-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: s.t === 'Meccan' ? 'var(--brand-primary)' : '#94a3b8' }}>{s.t}</span>
                          <span style={{ fontFamily: "'UthmanicHafs', serif", fontSize: 17, color: 'var(--text-primary)' }}>{s.ar}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {/* Footer hint */}
                  <div style={{ padding: '8px 16px', borderTop: `1px solid ${'var(--bg-elevated)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{SURAHS.filter(s => { const q = query.toLowerCase(); return s.name.toLowerCase().includes(q) || s.ar.includes(q) || s.meaning.toLowerCase().includes(q) || String(s.num) === q; }).length} results · scroll down for all</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>ESC to close</span>
                  </div>
                </div>
              )}
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="hp-dark-hide"
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--bg-elevated)',
                color: dark ? 'var(--brand-primary)' : '#64748b',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.18s, color 0.18s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {dark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <Link href="/read-quran/1" style={{ background: 'var(--brand-primary)', color: 'white', borderRadius: 12, padding: '9px 14px', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(var(--brand-rgb),0.3)', textDecoration: 'none', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_circle</span>
              <span className="hp-qs-hide">Quick Start</span>
            </Link>
            <button
              onClick={() => openNav()}
              style={{
                background: 'var(--bg-elevated)', color: 'var(--brand-primary)',
                borderRadius: 12, padding: '9px 14px', fontWeight: 600, fontSize: 13.5,
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1px solid var(--border-default)',
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.18s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_book</span>
              <span className="hp-qs-hide">Navigate</span>
            </button>
          </div>
        </header>}
        {/* MAIN — scrollable content only */}
        <main className="hp-scroll hp-dot" style={{ background: dark ? 'var(--bg-base)' : '#ffffff' }}>
          {/* ── HERO: greeting + featured slides ── */}
          <HeroCarousel />

          {/* ── PRAYER TIMES STRIP (full width) ── */}
          <PrayerStrip
            times={prayerTimes}
            next={nextPrayer}
            hijri={hijriDate}
            location={locationName}
            loading={prayerLoading}
            precise={locationSource === 'gps'}
            locating={locating}
            error={locationError}
            onDetect={() => detectLocation()}
          />

          <div className="hp-content" style={{ maxWidth: 1100, margin: '0 auto' }}>

            {/* ── HADEES OF THE DAY ── */}
            <HadeesOfTheDay />

            {/* ── 3 STEPS TO LEARN ── */}
            <LearnSteps />



            {/* ── TODAY: continue reading · progress · ayah of the day ── */}
            <TodayPanel
              recent={recent}
              sessionTime={sessionTime}
              totalTime={totalTime}
              streak={readingStreak}
              weekly={weeklyData}
              ayah={todayAyah}
              formatTime={fmtTime}
              onResetTime={() => { setSessionTime(0); setTotalTime(0); localStorage.setItem('quranTotalTime', '0'); }}
            />

            {/* ── QUICK ACCESS ── */}
            <QuickAccessGrid onNavigate={openNav} />

            {/* ── SEARCH QURAN ── */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--brand-primary)' }}>search</span>
                <h2 style={{ margin: 0, fontWeight: 700, fontSize: 19, ...S.text }}>Search Quran</h2>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 13, ...S.muted }}>Search through English translations · type at least 3 characters</p>
              {/* Input */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#94a3b8', pointerEvents: 'none' }}>search</span>
                <input
                  type="text"
                  value={verseQuery}
                  onChange={e => setVerseQuery(e.target.value)}
                  placeholder="e.g. patience, mercy, truth…"
                  style={{
                    width: '100%', padding: '13px 16px 13px 44px', borderRadius: 14,
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    fontSize: 14, color: 'var(--text-secondary)',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'box-shadow 0.15s',
                  }}
                  onFocus={e => (e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-rgb),0.35)')}
                  onBlur={e => (e.target.style.boxShadow = 'none')}
                />
                {verseLoading && (
                  <span className="material-symbols-outlined" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
                )}
              </div>

              {/* Result count */}
              {verseCount !== null && verseQuery.trim().length >= 3 && (
                <p style={{ margin: '0 0 14px', fontSize: 13, ...S.muted }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{verseCount.toLocaleString()}</strong> results for &ldquo;<span style={{ color: 'var(--brand-primary)' }}>{verseQuery}</span>&rdquo;
                </p>
              )}

              {/* Results */}
              {verseResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {verseResults.map(v => {
                    // Highlight the search term in the text
                    const re = new RegExp(`(${verseQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    const parts = v.text.split(re);
                    return (
                      <Link
                        key={`${v.surah.number}:${v.numberInSurah}`}
                        href={`/read-quran/${v.surah.number}`}
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        <div
                          style={{ ...S.card, padding: '18px 20px', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s' }}
                          className="surah-card"
                        >
                          {/* Badges row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                background: 'rgba(var(--brand-rgb),0.15)', color: 'var(--brand-primary)',
                                fontSize: 11.5, fontWeight: 700, borderRadius: 20,
                                padding: '3px 10px', border: '1px solid rgba(var(--brand-rgb),0.2)',
                              }}>{v.surah.englishName}</span>
                              <span style={{ fontSize: 12, ...S.muted }}>Ayah {v.numberInSurah}</span>
                            </div>
                            <span className="font-arabic" dir="rtl" style={{ fontSize: 16, fontWeight: 700, ...S.text, opacity: 0.7 }}>{v.surah.name}</span>
                          </div>
                          {/* Verse text with highlight */}
                          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.85, ...S.text }}>
                            {parts.map((part, i) =>
                              re.test(part)
                                ? <mark key={i} style={{ background: 'rgba(var(--brand-rgb),0.22)', color: 'var(--brand-primary-hover)', borderRadius: 3, padding: '0 2px', fontWeight: 600 }}>{part}</mark>
                                : part
                            )}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                  {verseCount !== null && verseCount > 30 && (
                    <p style={{ textAlign: 'center', fontSize: 12, ...S.muted, marginTop: 4 }}>Showing first 30 of {verseCount.toLocaleString()} results</p>
                  )}
                </div>
              )}

              {verseQuery.trim().length >= 3 && !verseLoading && verseResults.length === 0 && verseCount === 0 && (
                <p style={{ ...S.muted, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No verses found for &ldquo;{verseQuery}&rdquo;</p>
              )}
            </section>

            {/* ── TASBEEH COUNTER ── */}
            <TasbeehCounter />

            {/* ── EXPLORE SURAHS ── */}
            <SurahExplorer surahs={SURAHS} recentNums={recent.map(r => r.num)} />

          </div>
        </main>
      </div>
    </>
  );
}
