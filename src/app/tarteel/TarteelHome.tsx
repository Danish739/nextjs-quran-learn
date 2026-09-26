'use client';

import { useState } from 'react';
import Link from 'next/link';
import './tarteel.css';

const FEATURES = [
  {
    title: 'Memorization Mistake Detection',
    body: 'Our flagship feature: Tarteel’s AI will detect missed, incorrect and skipped words in your recitation AND alert you in real time!',
  },
  {
    title: 'Memorization Planning',
    body: 'Tailor your memorization journey to your learning style and preferences using Tarteel’s intuitive planning tools.',
  },
  {
    title: 'Goals',
    body: 'Set goals for yourself and track your progress as you memorize the Quran.',
  },
];

const PODCASTS = [
  ['01.10.2025', 'The REAL Reason You Struggle With The Quran | Qari Yahya Ali'],
  ['21.09.2025', 'I Wanted to Quit the Quran… Then Allah Showed Me This'],
  ['25.07.2025', 'Quran Revision Burnout? Try This 20-Minute Plan!'],
  ['27.04.2025', 'How to Practically Do Tadabbur of The Quran'],
];

const POSTS = [
  ['18.02.2026', 'Wahy: A Ramadan Series By Tarteel'],
  ['18.02.2026', 'Recite a Quran, Give a Quran Ramadan 1447'],
  ['07.01.2026', 'From Page to Screen: Rethinking Quran Rendering'],
  ['26.12.2025', 'How To Become a Hafiz'],
];

const FAQS = [
  ['What is Tarteel AI?', 'Tarteel is a Quran memorization app that listens to your recitation and helps you review with AI.'],
  ['How does Tarteel AI work?', 'You recite, and the app follows along, marking missed, incorrect, or skipped words as you go.'],
  ['Is Tarteel AI free?', 'The core recitation experience is free. Premium adds planning, goals, and extra memorization tools.'],
  ['What is Tarteel Premium?', 'Premium is the paid plan for a fuller memorization experience: plans, goals, and mistake detection.'],
  ['How can I subscribe to Tarteel Premium?', 'Start from the Get Started button and choose a plan on the pricing page.'],
  ['What’s Tarteel Alim?', 'Alim is a deeper study track for people who want more than daily revision.'],
  ['What’s the Tarteel Family Plan?', 'One subscription that covers multiple family members on their own devices.'],
];

export default function TarteelHome() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="tarteel-home">
      <div className="t-nav-wrap">
        <nav className="t-nav">
          <Link href="/tarteel" className="t-brand">
            <span className="t-mark" />
            TARTEEL
          </Link>
          <div className="t-links">
            <span><Link href="/tarteel#pricing">Pricing</Link></span>
            <span><Link href="/tarteel">Gift Cards</Link></span>
            <span><Link href="/tarteel#faq">Scholarship</Link></span>
            <span><Link href="/tarteel#blog">Blog</Link></span>
            <Link href="/login" className="t-login">Log in</Link>
            <Link href="/read-quran/1" className="t-download">Download</Link>
          </div>
        </nav>
      </div>

      <header className="t-hero">
        <div className="t-phone" aria-hidden>
          <p>Chapter An-Naba</p>
          <p>And made your sleep for rest, and made the night as a cover, and made the day for livelihood.</p>
        </div>
        <div className="t-hero-copy">
          <h1>Memorize<br />Confidently</h1>
          <Link href="/read-quran/1" className="t-hero-btn">Download Tarteel →</Link>
        </div>
      </header>

      <div className="t-more-link">
        <Link href="#features">Memorize more with Tarteel →</Link>
      </div>

      <section className="t-features" id="features">
        <div className="t-feature-grid">
          <div className="t-intro">
            <h2>Memorize more</h2>
            <p>Make your memorization a Premium experience.</p>
            <Link href="/memorize-quran" className="t-cta">GET STARTED</Link>
          </div>
          {FEATURES.map((item) => (
            <article key={item.title} className="t-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div className="t-shot" />
            </article>
          ))}
        </div>
      </section>

      <section className="t-premium" id="pricing">
        <div>
          <h2>
            What’s the <strong>big</strong> deal with Tarteel <strong>Premium</strong> anyway?
          </h2>
          <div style={{ fontSize: 42, marginBottom: 16 }}>🤔</div>
          <div className="t-stars">★★★★★ <span>100,000+ 5 Star Reviews</span></div>
        </div>
        <div className="t-collage" role="img" aria-label="Community collage" />
      </section>

      <section>
        <div className="t-row-head">
          <h2>re:Verses podcast</h2>
          <a href="#podcast">View All</a>
        </div>
        <div className="t-scroller" id="podcast">
          {PODCASTS.map(([date, title]) => (
            <article key={title} className="t-post">
              <time>{date}</time>
              <h3>{title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="blog">
        <div className="t-row-head">
          <h2>Tarteel Blog</h2>
          <a href="#blog">View All</a>
        </div>
        <div className="t-scroller">
          {POSTS.map(([date, title]) => (
            <article key={title} className="t-post">
              <time>{date}</time>
              <h3>{title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="t-faq" id="faq">
        <h2>Frequently Asked 💬 Questions</h2>
        {FAQS.map(([q, a], i) => (
          <div key={q}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)}>{q}</button>
            {open === i && <p>{a}</p>}
          </div>
        ))}
      </section>

      <footer className="t-footer">
        <div className="t-footer-grid">
          <div>
            <h4>PRODUCT</h4>
            <Link href="/tarteel#pricing">Pricing</Link>
            <Link href="/tarteel">Gift Cards</Link>
            <Link href="/tarteel">Family Plan</Link>
          </div>
          <div>
            <h4>COMPANY</h4>
            <Link href="/tarteel#blog">Blog</Link>
            <Link href="/tarteel">Careers</Link>
            <Link href="/tarteel#faq">Scholarship</Link>
          </div>
          <div>
            <h4>SUPPORT</h4>
            <Link href="/tarteel">Support Center</Link>
            <Link href="/tarteel">Feature Requests</Link>
          </div>
          <div>
            <h4>COMMUNITY</h4>
            <Link href="/tarteel#podcast">re:Verses Podcast</Link>
            <Link href="/community">Hifz Network</Link>
            <Link href="/read-quran">Ramadan</Link>
          </div>
        </div>
        <div className="t-copy">
          <span>© Copyright 2025 Tarteel, Inc. All rights reserved.</span>
          <span>Privacy Policy · Terms of Service</span>
        </div>
      </footer>
    </div>
  );
}
