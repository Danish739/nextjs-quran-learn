import { Metadata } from 'next';
import TranslationAudioClient from './TranslationAudioClient';
import './translation-audio.css';

export const metadata: Metadata = {
  title: 'Quran Translation Audio — Listen in Your Language',
  description: 'Listen to the Quran translated verse by verse in English, Urdu, Persian, Azerbaijani and Bosnian, with the Arabic recitation, on-screen text and playback speed control.',
  keywords: ['quran translation audio', 'quran in english audio', 'quran in urdu audio', 'quran translation recitation'],
  openGraph: {
    title: 'Quran Translation Audio',
    description: 'Hear the meaning of the Quran verse by verse in your language.',
    type: 'website',
  },
};

export default function Page() {
  return <TranslationAudioClient />;
}
