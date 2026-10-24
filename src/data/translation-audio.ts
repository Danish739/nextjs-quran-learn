/**
 * Verse-by-verse translation audio from everyayah.com, shared by the
 * Translation Audio page and the Quran Player library.
 */
export const EVERYAYAH = 'https://everyayah.com/data';
export const ARABIC_FOLDER = 'Alafasy_128kbps';

export interface TranslationLang {
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

export const TRANSLATION_LANGS: TranslationLang[] = [
  { id: 'en', name: 'English', native: 'English', dir: 'ltr', folder: 'English/Sahih_Intnl_Ibrahim_Walk_192kbps', reciter: 'Ibrahim Walk', textId: 20, textBy: 'Saheeh International', sameSource: true },
  { id: 'ur', name: 'Urdu', native: 'اردو', dir: 'rtl', folder: 'translations/urdu_shamshad_ali_khan_46kbps', reciter: 'Shamshad Ali Khan', textId: 234, textBy: 'Fateh Muhammad Jalandhari', sameSource: false },
  { id: 'fa', name: 'Persian', native: 'فارسی', dir: 'rtl', folder: 'translations/Makarem_Kabiri_16Kbps', reciter: 'Kabiri (Makarem)', textId: 29, textBy: 'Hussein Taji Kal Dari', sameSource: false },
  { id: 'az', name: 'Azerbaijani', native: 'Azərbaycanca', dir: 'ltr', folder: 'translations/azerbaijani/balayev', reciter: 'Balayev', textId: 75, textBy: 'Alikhan Musayev', sameSource: false },
  { id: 'bs', name: 'Bosnian', native: 'Bosanski', dir: 'ltr', folder: 'translations/besim_korkut_ajet_po_ajet', reciter: 'Besim Korkut', textId: 126, textBy: 'Besim Korkut', sameSource: true },
];

/** URL of one ayah clip. Pass ARABIC_FOLDER for the Arabic recitation or a language's folder. */
export function ayahClipUrl(folder: string, surah: number, ayah: number): string {
  return `${EVERYAYAH}/${folder}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}
