'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import './HadeesOfTheDay.css';

interface Hadees {
  ar: string;
  en: string;
  source: string;
  narrator: string;
  topic: string;
  reflect: string;
}

const HADEES: Hadees[] = [
  {
    ar: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    en: 'Actions are but by intentions, and every person shall have only that which he intended.',
    source: 'Sahih al-Bukhari & Muslim',
    narrator: 'Umar ibn al-Khattab (RA)',
    topic: 'Intention',
    reflect: 'Before you begin today, pause for a moment and renew your intention.',
  },
  {
    ar: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    en: 'None of you truly believes until he loves for his brother what he loves for himself.',
    source: 'Sahih al-Bukhari & Muslim',
    narrator: 'Anas ibn Malik (RA)',
    topic: 'Brotherhood',
    reflect: 'Think of one person you can wish good for today — then quietly act on it.',
  },
  {
    ar: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    en: 'The best of you are those who learn the Quran and teach it.',
    source: 'Sahih al-Bukhari',
    narrator: 'Uthman ibn Affan (RA)',
    topic: 'The Quran',
    reflect: 'Learn one ayah today, and share its meaning with someone you love.',
  },
  {
    ar: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    en: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.',
    source: 'Sahih al-Bukhari & Muslim',
    narrator: 'Abu Hurairah (RA)',
    topic: 'Speech',
    reflect: 'Before you speak today, ask yourself: is it good? If not, let silence be enough.',
  },
  {
    ar: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ',
    en: 'The strong person is not the one who overcomes people by his strength, but the one who controls himself while in anger.',
    source: 'Sahih al-Bukhari & Muslim',
    narrator: 'Abu Hurairah (RA)',
    topic: 'Self-control',
    reflect: 'When frustration rises today, pause, breathe, and choose calm.',
  },
  {
    ar: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
    en: 'Your smiling in the face of your brother is charity.',
    source: 'Jami at-Tirmidhi (Hasan)',
    narrator: 'Abu Dharr (RA)',
    topic: 'Kindness',
    reflect: 'Offer a sincere smile to three people today — each one is a charity.',
  },
  {
    ar: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    en: 'The most beloved of deeds to Allah are those done most consistently, even if they are small.',
    source: 'Sahih al-Bukhari & Muslim',
    narrator: 'Aisha (RA)',
    topic: 'Consistency',
    reflect: 'Pick one small good deed you can keep doing every single day.',
  },
  {
    ar: 'يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا',
    en: 'Make things easy and do not make them difficult; give glad tidings and do not drive people away.',
    source: 'Sahih al-Bukhari & Muslim',
    narrator: 'Anas ibn Malik (RA)',
    topic: 'Ease',
    reflect: 'Look for one way to make something easier for someone today.',
  },
];

const SAVED_KEY = 'savedHadees';

// ── Share graphic (emerald + cream) ──
const W = 1080;
const H = 1350;

/** Wraps text into lines that fit maxWidth using the ctx's current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Pointed mosque-arch outline */
function arch(ctx: CanvasRenderingContext2D, cx: number, bottom: number, halfW: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(cx - halfW, bottom);
  ctx.lineTo(cx - halfW, bottom - h * 0.55);
  ctx.bezierCurveTo(cx - halfW, bottom - h * 0.85, cx - halfW * 0.3, bottom - h * 0.95, cx, bottom - h);
  ctx.bezierCurveTo(cx + halfW * 0.3, bottom - h * 0.95, cx + halfW, bottom - h * 0.85, cx + halfW, bottom - h * 0.55);
  ctx.lineTo(cx + halfW, bottom);
}

function drawGraphic(canvas: HTMLCanvasElement, h: Hadees) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const CREAM = '#f4ead2';
  const GOLD = '#d9b56b';

  // Emerald background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#13705a');
  bg.addColorStop(1, '#0a4a3b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, W * 0.75);
  glow.addColorStop(0, 'rgba(255,255,255,0.10)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Nested arches
  ctx.lineWidth = 2;
  [[420, 1000], [360, 900], [300, 800]].forEach(([hw, ah], i) => {
    ctx.strokeStyle = `rgba(244,234,210,${0.08 - i * 0.02})`;
    arch(ctx, W / 2, H - 70, hw, ah);
    ctx.stroke();
  });

  // Frame
  ctx.strokeStyle = 'rgba(217,181,107,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = 'rgba(217,181,107,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(66, 66, W - 132, H - 132);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Header
  ctx.fillStyle = GOLD;
  ctx.font = '600 26px Figtree, Arial, sans-serif';
  ctx.fillText(`HADITH OF THE DAY  ·  ${h.topic.toUpperCase()}`, W / 2, 190);

  // Arabic
  ctx.direction = 'rtl';
  let arSize = 66;
  let arLines: string[] = [];
  do {
    ctx.font = `${arSize}px UthmanicHafs, serif`;
    arLines = wrap(ctx, h.ar, W - 260);
    arSize -= 4;
  } while (arLines.length > 4 && arSize > 36);
  arSize += 4;
  const arLH = arSize * 1.75;

  // English
  ctx.direction = 'ltr';
  ctx.font = 'italic 400 40px Lora, Georgia, serif';
  const enLines = wrap(ctx, `“${h.en}”`, W - 260);
  const enLH = 60;

  const total = arLines.length * arLH + 80 + enLines.length * enLH;
  let y = 250 + (H - 250 - 330 - total) / 2 + arLH * 0.7;

  ctx.direction = 'rtl';
  ctx.font = `${arSize}px UthmanicHafs, serif`;
  ctx.fillStyle = CREAM;
  for (const l of arLines) {
    ctx.fillText(l, W / 2, y);
    y += arLH;
  }

  // Divider with a small diamond
  y += 6;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, y);
  ctx.lineTo(W / 2 - 18, y);
  ctx.moveTo(W / 2 + 18, y);
  ctx.lineTo(W / 2 + 120, y);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(W / 2, y - 8);
  ctx.lineTo(W / 2 + 8, y);
  ctx.lineTo(W / 2, y + 8);
  ctx.lineTo(W / 2 - 8, y);
  ctx.closePath();
  ctx.fill();
  y += 74;

  ctx.direction = 'ltr';
  ctx.font = 'italic 400 40px Lora, Georgia, serif';
  ctx.fillStyle = '#ffffff';
  for (const l of enLines) {
    ctx.fillText(l, W / 2, y);
    y += enLH;
  }

  // Source
  ctx.fillStyle = GOLD;
  ctx.font = '600 30px Figtree, Arial, sans-serif';
  ctx.fillText(h.narrator, W / 2, H - 250);
  ctx.fillStyle = 'rgba(244,234,210,0.75)';
  ctx.font = '400 26px Figtree, Arial, sans-serif';
  ctx.fillText(h.source, W / 2, H - 205);

  // Footer
  ctx.fillStyle = 'rgba(244,234,210,0.6)';
  ctx.font = '600 24px Figtree, Arial, sans-serif';
  ctx.fillText('learnquran.app', W / 2, H - 118);
}

/** Gold corner flourish (rotated per corner via CSS) */
function Corner({ pos }: { pos: string }) {
  return (
    <svg className={`hod-corner hod-corner-${pos}`} viewBox="0 0 60 60" aria-hidden="true">
      <path d="M4 56 L4 18 Q4 4 18 4 L56 4" />
      <path d="M12 56 L12 24 Q12 12 24 12 L56 12" opacity="0.5" />
      <path d="M20 20 q8 -2 10 6 q2 8 -6 10" opacity="0.8" />
      <circle cx="4" cy="56" r="2.5" />
      <circle cx="56" cy="4" r="2.5" />
    </svg>
  );
}

export default function HadeesOfTheDay() {
  const [todayIdx, setTodayIdx] = useState(0);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [saved, setSaved] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragX = useRef<number | null>(null);

  // Pick by date on the client to avoid a server/client mismatch around midnight
  useEffect(() => {
    const d = new Date();
    const dayNum = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    const t = dayNum % HADEES.length;
    setTodayIdx(t);
    setIdx(t);
    try {
      setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'));
    } catch { /* ignore */ }
  }, []);

  const h = HADEES[idx];
  const isToday = idx === todayIdx;
  const isSaved = saved.includes(idx);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const go = (step: 1 | -1) => {
    setDir(step);
    setIdx(i => (i + step + HADEES.length) % HADEES.length);
  };

  const toggleSave = () => {
    const next = isSaved ? saved.filter(i => i !== idx) : [...saved, idx];
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    flash(isSaved ? 'Removed from saved' : 'Saved to your collection');
  };

  const shareText = `${h.ar}\n\n“${h.en}”\n— ${h.narrator}, ${h.source}\n\nlearnquran.app`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      flash('Copied to clipboard');
    } catch {
      flash('Copy not available');
    }
  };

  // Render the graphic whenever the modal opens (after fonts are ready)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          document.fonts.load('66px UthmanicHafs'),
          document.fonts.load('italic 40px Lora'),
          document.fonts.load('600 26px Figtree'),
        ]);
      } catch { /* draw with fallback fonts */ }
      if (!cancelled && canvasRef.current) drawGraphic(canvasRef.current, h);
    })();
    return () => { cancelled = true; };
  }, [open, h]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toBlob = (): Promise<Blob | null> =>
    new Promise(res => (canvasRef.current ? canvasRef.current.toBlob(res, 'image/png') : res(null)));

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hadith-${h.topic.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Image saved');
  };

  const share = useCallback(async () => {
    const blob = await toBlob();
    if (blob && navigator.canShare) {
      const file = new File([blob], 'hadith-of-the-day.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: `${h.en}\n— ${h.source}` });
          return;
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return;
        }
      }
    }
    // Desktop fallback: save the picture
    download();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);

  return (
    <section className="hod" aria-labelledby="hod-title">
      <div className="hod-head">
        <div>
          <p className="hod-kicker font-arabic">حديث اليوم</p>
          <h2 id="hod-title">Hadith of the Day</h2>
        </div>
        <div className="hod-nav">
          {!isToday && (
            <button className="hod-today" onClick={() => { setDir(idx > todayIdx ? -1 : 1); setIdx(todayIdx); }}>
              <span className="material-symbols-outlined">today</span>
              Today
            </button>
          )}
          <button className="hod-arrow" onClick={() => go(-1)} aria-label="Previous hadees">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="hod-pos">{idx + 1} / {HADEES.length}</span>
          <button className="hod-arrow" onClick={() => go(1)} aria-label="Next hadees">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div
        className="hod-card"
        onPointerDown={e => { dragX.current = e.clientX; }}
        onPointerUp={e => {
          if (dragX.current === null) return;
          const dx = e.clientX - dragX.current;
          dragX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />

        <div key={idx} className={`hod-content ${dir === 1 ? 'from-right' : 'from-left'}`}>
          <div className="hod-tags">
            <span className="hod-topic">{h.topic}</span>
            {isToday && <span className="hod-badge">Today</span>}
          </div>

          <p className="hod-ar font-arabic" lang="ar" dir="rtl">{h.ar}</p>

          <div className="hod-divider" aria-hidden="true"><span /></div>

          <p className="hod-en">“{h.en}”</p>

          <p className="hod-src">
            <b>{h.narrator}</b>
            <span>{h.source}</span>
          </p>

          <div className="hod-reflect">
            <span className="material-symbols-outlined">emoji_objects</span>
            <div>
              <b>Today&apos;s reflection</b>
              <p>{h.reflect}</p>
            </div>
          </div>
        </div>

        <div className="hod-actions">
          <button className={`hod-icon-btn${isSaved ? ' on' : ''}`} onClick={toggleSave} aria-pressed={isSaved} aria-label={isSaved ? 'Remove from saved' : 'Save hadees'}>
            <span className="material-symbols-outlined">{isSaved ? 'favorite' : 'favorite_border'}</span>
          </button>
          <button className="hod-icon-btn" onClick={copy} aria-label="Copy hadees">
            <span className="material-symbols-outlined">content_copy</span>
          </button>
          <Link href="/hadees" className="hod-link">
            Browse collection
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
          <button className="hod-share" onClick={() => setOpen(true)}>
            <span className="material-symbols-outlined">ios_share</span>
            Share
          </button>
        </div>

        {toast && <div className="hod-toast" role="status">{toast}</div>}
      </div>

      {open && (
        <div className="hod-modal" role="dialog" aria-modal="true" aria-label="Share hadees" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="hod-modal-box">
            <button className="hod-modal-close" onClick={() => setOpen(false)} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
            <canvas ref={canvasRef} className="hod-canvas" />
            <div className="hod-modal-actions">
              <button className="hod-share" onClick={share}>
                <span className="material-symbols-outlined">ios_share</span>
                Share image
              </button>
              <button className="hod-ghost" onClick={download}>
                <span className="material-symbols-outlined">download</span>
                Download
              </button>
              <button className="hod-ghost" onClick={copy}>
                <span className="material-symbols-outlined">content_copy</span>
                Copy text
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
