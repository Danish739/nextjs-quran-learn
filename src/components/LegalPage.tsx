import Link from 'next/link';
import type { ReactNode } from 'react';
import './LegalPage.css';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

const WHATSAPP = 'https://wa.me/916204130133?text=Assalamu%20Alaikum!%20I%20have%20a%20question%20about%20Learn%20Quran';

/** Quiet, text-first layout shared by the Privacy Policy and Terms of Use. */
export default function LegalPage({
  title,
  updated,
  intro,
  sections,
  other,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <main className="lg">
      <article className="lg-wrap">
        <header className="lg-head">
          <p className="lg-updated">Last updated {updated}</p>
          <h1>{title}</h1>
          <p className="lg-intro">{intro}</p>
        </header>

        <nav className="lg-toc" aria-label="On this page">
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </a>
          ))}
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="lg-section">
            <h2>
              <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </h2>
            {s.body}
          </section>
        ))}

        <footer className="lg-foot">
          <p>
            Questions? <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>.
          </p>
          <Link href={other.href}>{other.label} →</Link>
        </footer>
      </article>
    </main>
  );
}
