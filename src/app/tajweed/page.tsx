import React from 'react';
import { Metadata } from 'next';
import Navbar from '../../components/Navbar/Navbar';
import TajweedClient from './TajweedClient';
import './Tajweed.css';

// SEO Metadata
export const metadata: Metadata = {
  title: 'Learn Tajweed (Quranic Recitation) — QuranLearn AI',
  description: 'Learn tajweed with color-coded Quran text, live recitation audio and an interactive guide to every rule: ikhfaa, iqlaab, idghaam, ghunnah, qalqalah and madd.',
  keywords: 'tajweed, quranic recitation, learn tajweed, tajweed rules, quran pronunciation, tajweed colors, ikhfa, idgham, qalqalah, madd',
  openGraph: {
    title: 'Learn Tajweed (Quranic Recitation) — QuranLearn AI',
    description: 'Interactive, color-coded tajweed rules with live Quran text and audio',
    type: 'website',
  },
};

export default function Page() {
  return (
    <>
      <Navbar />
      <TajweedClient />
    </>
  );
}
