import Link from 'next/link';
import './GetStarted.css';

const ROWS = [
  { icon: 'menu_book', title: 'Read the Quran', text: 'All 114 surahs in Arabic with translation, word by word.', href: '/read-quran', hue: '#0f9d76' },
  { icon: 'psychology', title: 'Memorize with Hifz', text: 'Practice ayah by ayah with audio repetition and recall.', href: '/memorize-quran', hue: '#8b5cf6' },
  { icon: 'local_library', title: 'Understand with Tafseer', text: 'Ibn Kathir, Ma’arif and Tazkirul, explained ayah by ayah.', href: '/tafseer', hue: '#f59e0b' },
  { icon: 'record_voice_over', title: 'Listen in your language', text: 'Hear the meaning in English, Urdu, Persian and more.', href: '/translation-audio', hue: '#0ea5e9' },
];

/** Closing call-to-action on the home page: one heading, four ways in. */
export default function GetStarted() {
  return (
    <section className="gs" aria-labelledby="gs-title">
      <div className="gs-left">
        <span className="gs-badge material-symbols-outlined" aria-hidden="true">menu_book</span>
        <h2 id="gs-title">Let&apos;s get <span>to learning</span></h2>
        <p>Explore all the ways Learn Quran can support your spiritual journey, from reading to memorization.</p>
      </div>
      <ul className="gs-list">
        {ROWS.map(r => (
          <li key={r.href}>
            <Link href={r.href} className="gs-row" style={{ ['--hue' as string]: r.hue }}>
              <span className="gs-icon material-symbols-outlined" aria-hidden="true">{r.icon}</span>
              <span className="gs-text">
                <b>{r.title}</b>
                <small>{r.text}</small>
              </span>
              <span className="gs-chev material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
