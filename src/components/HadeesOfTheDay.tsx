'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import HadithImageDialog from './HadithImageDialog';
import './HadeesOfTheDay.css';

interface Hadees {
  en: string;
  narrator: string;
  /** collection and hadith number (sunnah.com numbering) */
  ref: string;
}

/** Authentic (sahih) narrations only, each with its exact reference */
const HADEES: Hadees[] = [
  {
    en: 'Actions are judged by intentions, and every person will have only what they intended.',
    narrator: 'Umar ibn al-Khattab (RA)',
    ref: 'Sahih al-Bukhari 1 · Sahih Muslim 1907',
  },
  {
    en: 'None of you truly believes until he loves for his brother what he loves for himself.',
    narrator: 'Anas ibn Malik (RA)',
    ref: 'Sahih al-Bukhari 13 · Sahih Muslim 45',
  },
  {
    en: 'The best of you are those who learn the Quran and teach it.',
    narrator: 'Uthman ibn Affan (RA)',
    ref: 'Sahih al-Bukhari 5027',
  },
  {
    en: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.',
    narrator: 'Abu Hurairah (RA)',
    ref: 'Sahih al-Bukhari 6018 · Sahih Muslim 47',
  },
  {
    en: 'The strong person is not the one who overcomes others by strength, but the one who controls himself when angry.',
    narrator: 'Abu Hurairah (RA)',
    ref: 'Sahih al-Bukhari 6114 · Sahih Muslim 2609',
  },
  {
    en: 'Every act of goodness is charity.',
    narrator: 'Jabir ibn Abdullah (RA)',
    ref: 'Sahih al-Bukhari 6021',
  },
  {
    en: 'The most beloved deeds to Allah are those done regularly, even if they are small.',
    narrator: 'Aisha (RA)',
    ref: 'Sahih al-Bukhari 6464 · Sahih Muslim 783',
  },
  {
    en: 'Make things easy and do not make them difficult; give glad tidings and do not drive people away.',
    narrator: 'Anas ibn Malik (RA)',
    ref: 'Sahih al-Bukhari 69 · Sahih Muslim 1734',
  },
  {
    en: 'A Muslim is the one from whose tongue and hand other Muslims are safe.',
    narrator: 'Abdullah ibn Amr (RA)',
    ref: 'Sahih al-Bukhari 10 · Sahih Muslim 40',
  },
  {
    en: 'Whoever does not show mercy will not be shown mercy.',
    narrator: 'Abu Hurairah (RA)',
    ref: 'Sahih al-Bukhari 5997 · Sahih Muslim 2318',
  },
  {
    en: 'Allah does not look at your appearance or your wealth, but He looks at your hearts and your deeds.',
    narrator: 'Abu Hurairah (RA)',
    ref: 'Sahih Muslim 2564',
  },
  {
    en: 'The religion is sincerity.',
    narrator: 'Tamim ad-Dari (RA)',
    ref: 'Sahih Muslim 55',
  },
  {
    en: 'Purity is half of faith.',
    narrator: 'Abu Malik al-Ash‘ari (RA)',
    ref: 'Sahih Muslim 223',
  },
  {
    en: 'The best among you are those with the best character.',
    narrator: 'Abdullah ibn Amr (RA)',
    ref: 'Sahih al-Bukhari 3559 · Sahih Muslim 2321',
  },
  {
    en: 'Do not think little of any good deed, even meeting your brother with a cheerful face.',
    narrator: 'Abu Dharr (RA)',
    ref: 'Sahih Muslim 2626',
  },
];

export default function HadeesOfTheDay() {
  const [todayIdx, setTodayIdx] = useState(0);
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const closeImage = useCallback(() => setImageOpen(false), []);

  // Pick by date on the client to avoid a server/client mismatch around midnight
  useEffect(() => {
    const d = new Date();
    const dayNum = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    const t = dayNum % HADEES.length;
    setTodayIdx(t);
    setIdx(t);
  }, []);

  const h = HADEES[idx];
  const go = (step: 1 | -1) => setIdx(i => (i + step + HADEES.length) % HADEES.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`“${h.en}”\n— ${h.narrator}, ${h.ref}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <section className="hod" aria-labelledby="hod-title">
      <div className="hod-head">
        <h2 id="hod-title">Hadith of the Day</h2>
        <div className="hod-nav">
          {idx !== todayIdx && (
            <button type="button" className="hod-today" onClick={() => setIdx(todayIdx)}>Today</button>
          )}
          <button type="button" className="hod-arrow" onClick={() => go(-1)} aria-label="Previous hadith">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button type="button" className="hod-arrow" onClick={() => go(1)} aria-label="Next hadith">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <figure className="hod-card">
        <blockquote className="hod-en">“{h.en}”</blockquote>
        <figcaption className="hod-src">
          <span>Narrated by {h.narrator}</span>
          <cite>{h.ref}</cite>
        </figcaption>

        <div className="hod-actions">
          <button type="button" className="hod-text-btn" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="hod-text-btn" onClick={() => setImageOpen(true)}>Create image</button>
          <Link href="/hadees" className="hod-text-btn">More hadith</Link>
        </div>
      </figure>

      <HadithImageDialog
        hadith={imageOpen ? { text: h.en, narrator: h.narrator, reference: h.ref } : null}
        onClose={closeImage}
      />
    </section>
  );
}
