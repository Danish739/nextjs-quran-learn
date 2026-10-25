'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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

// ── Share graphic ──
const W = 1080;
const H = 1350;
const PAD = 120;
const FONT = 'Figtree, Arial, sans-serif';

const THEMES = {
  black: { label: 'Black', bg: '#0b0b0b', text: '#ffffff', muted: 'rgba(255,255,255,0.6)', accent: '#7dd3b0' },
  white: { label: 'White', bg: '#ffffff', text: '#111827', muted: '#6b7280', accent: '#0f5c4a' },
  green: { label: 'Green', bg: '#0f5c4a', text: '#ffffff', muted: 'rgba(255,255,255,0.72)', accent: '#f2d48e' },
} as const;
type ThemeKey = keyof typeof THEMES;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Plain layout: label, quote, short rule, narrator + reference, site name at the bottom */
function drawGraphic(canvas: HTMLCanvasElement, h: Hadees, themeKey: ThemeKey) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const t = THEMES[themeKey];
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = t.accent;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('HADITH', W / 2, PAD + 40);

  // largest quote size that fits the middle of the card
  let size = 68;
  let lines: string[] = [];
  do {
    ctx.font = `600 ${size}px ${FONT}`;
    lines = wrap(ctx, `“${h.en}”`, W - PAD * 2);
    size -= 2;
  } while (lines.length * size * 1.4 > 720 && size > 36);
  size += 2;
  const lh = Math.round(size * 1.4);

  // quote · 56 · rule · 56 · narrator (32) · 18 · reference (28), centred as one block
  const quoteH = (lines.length - 1) * lh + size;
  const block = quoteH + 56 + 4 + 56 + 32 + 18 + 28;
  let y = (H - block) / 2 + size; // first baseline

  ctx.fillStyle = t.text;
  ctx.font = `600 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lh));
  y += (lines.length - 1) * lh + 56;

  ctx.fillStyle = t.accent;
  ctx.fillRect(W / 2 - 40, y, 80, 4);
  y += 4 + 56 + 32;

  ctx.fillStyle = t.text;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(h.narrator, W / 2, y);
  y += 18 + 28;

  ctx.fillStyle = t.muted;
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(h.ref, W / 2, y);

  ctx.fillStyle = t.muted;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText('Learnquran.app', W / 2, H - PAD + 20);
}

export default function HadeesOfTheDay() {
  const [todayIdx, setTodayIdx] = useState(0);
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>('green');
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // redraw whenever the preview opens, the hadith changes or a style is picked (after the font loads)
  useEffect(() => {
    if (!imageOpen) return;
    let cancelled = false;
    (async () => {
      try { await document.fonts.load(`600 60px ${FONT}`); } catch { /* fall back to Arial */ }
      if (!cancelled && canvasRef.current) drawGraphic(canvasRef.current, h, theme);
    })();
    return () => { cancelled = true; };
  }, [imageOpen, h, theme]);

  useEffect(() => {
    if (!imageOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setImageOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [imageOpen]);

  const fileName = `hadith-${h.ref.split(' · ')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${theme}.png`;
  const toBlob = () => new Promise<Blob | null>(res => (canvasRef.current ? canvasRef.current.toBlob(res, 'image/png') : res(null)));

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const blob = await toBlob();
    if (blob && navigator.canShare) {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: `“${h.en}” — ${h.ref}\nLearnquran.app` });
          return;
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return;
        }
      }
    }
    download(); // desktop browsers without file sharing
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

      {imageOpen && (
        <div className="hod-modal" onMouseDown={e => { if (e.target === e.currentTarget) setImageOpen(false); }}>
          <div className="hod-modal-box" role="dialog" aria-modal="true" aria-labelledby="hod-modal-title">
            <div className="hod-modal-head">
              <h3 id="hod-modal-title">Hadith image</h3>
              <button type="button" className="hod-arrow" onClick={() => setImageOpen(false)} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <canvas ref={canvasRef} className="hod-canvas" width={W} height={H} aria-label={`Preview: ${h.en}`} />

            <div className="hod-styles" role="group" aria-label="Style">
              {(Object.keys(THEMES) as ThemeKey[]).map(k => (
                <button key={k} type="button" aria-pressed={theme === k} className={theme === k ? 'is-on' : ''} onClick={() => setTheme(k)}>
                  <i style={{ background: THEMES[k].bg }} aria-hidden="true" />
                  {THEMES[k].label}
                </button>
              ))}
            </div>

            <div className="hod-modal-actions">
              <button type="button" className="hod-primary" onClick={share}>
                <span className="material-symbols-outlined">ios_share</span>
                Share
              </button>
              <button type="button" className="hod-secondary" onClick={download}>
                <span className="material-symbols-outlined">download</span>
                Download
              </button>
            </div>
            <p className="hod-size">1080 × 1350 px · PNG</p>
          </div>
        </div>
      )}
    </section>
  );
}
