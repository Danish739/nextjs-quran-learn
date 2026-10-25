'use client';
import { useEffect, useRef, useState } from 'react';
import './HadithImageDialog.css';

// ── 1080 × 1350 share graphic ──
const W = 1080;
const H = 1350;
const PAD = 120;
const FONT = 'Figtree, Arial, sans-serif';
const MAX_SIZE = 88;
const MIN_SIZE = 24;
/** vertical room for the quote between the "HADITH" label and the source lines */
const QUOTE_ROOM = 780;

const THEMES = {
  black: { label: 'Black', bg: '#0b0b0b', text: '#ffffff', muted: 'rgba(255,255,255,0.6)', accent: '#7dd3b0' },
  white: { label: 'White', bg: '#ffffff', text: '#111827', muted: '#6b7280', accent: '#0f5c4a' },
  green: { label: 'Green', bg: '#0f5c4a', text: '#ffffff', muted: 'rgba(255,255,255,0.72)', accent: '#f2d48e' },
} as const;
type ThemeKey = keyof typeof THEMES;

export interface HadithImage {
  text: string;
  narrator?: string;
  /** e.g. "Sahih al-Bukhari 6114" */
  reference: string;
}

const TEXT_W = W - PAD * 2;
type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** Big text is set tighter (leading and tracking); small text lighter and looser so long narrations stay readable */
function setType(ctx: Ctx, size: number) {
  const weight = size >= 40 ? 600 : 500;
  const leading = size >= 64 ? 1.2 : size >= 44 ? 1.28 : 1.42;
  const tracking = size >= 64 ? -1.5 : size >= 44 ? -0.5 : 0;
  ctx.font = `${weight} ${size}px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
  return { lh: Math.round(size * leading) };
}

/** Straight quotes and apostrophes → typographic ones */
export function smartQuotes(s: string) {
  return s
    .replace(/(^|[\s([{—–-])"/g, '$1“').replace(/"/g, '”')
    .replace(/(^|[\s([{—–-])'/g, '$1‘').replace(/'/g, '’');
}

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
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

/**
 * Wraps without a stranded last line: narrows the measure (keeping the same number of lines)
 * until the last line is at least ~half as long as the longest, so the rag looks even.
 */
function wrapEven(ctx: Ctx, text: string): string[] {
  const base = wrap(ctx, text, TEXT_W);
  if (base.length < 2) return base;
  const width = (l: string) => ctx.measureText(l).width;
  for (let w = TEXT_W; w >= TEXT_W * 0.72; w -= TEXT_W * 0.02) {
    const lines = wrap(ctx, text, w);
    if (lines.length !== base.length) break;
    if (width(lines[lines.length - 1]) >= 0.5 * Math.max(...lines.map(width))) return lines;
  }
  return base;
}

/** Biggest size whose wrapped text fits; very long narrations are cut to an excerpt at the minimum size */
function fitQuote(ctx: Ctx, text: string) {
  // the whole narration sits in “…”, so quotes inside it step down to ‘…’
  const quoted = `“${smartQuotes(text.trim().replace(/"/g, "'"))}”`;
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 2) {
    const { lh } = setType(ctx, size);
    const lines = wrapEven(ctx, quoted);
    if ((lines.length - 1) * lh + size > QUOTE_ROOM) continue;
    // long (small) text reads better justified on the full measure; big type justified opens
    // wide gaps, so larger quotes stay ragged-left with an even rag
    const justify = size <= 32;
    return { size, lh, lines: justify ? wrap(ctx, quoted, TEXT_W) : lines, excerpt: false, justify };
  }
  const size = MIN_SIZE;
  const { lh } = setType(ctx, size);
  const max = Math.floor((QUOTE_ROOM - size) / lh) + 1;
  const lines = wrap(ctx, quoted, TEXT_W).slice(0, max);
  lines[max - 1] = `${lines[max - 1].replace(/[\s,.;:”’]+$/, '')}…”`;
  return { size, lh, lines, excerpt: true, justify: true };
}

/**
 * Draws one line stretched to `width` by widening the word gaps. Only a degenerate line
 * (one or two words, or gaps over 4× a space) is left ragged, so a block never breaks mid-way.
 */
function fillJustified(ctx: Ctx, line: string, x: number, y: number, width: number) {
  const words = line.split(' ');
  const space = ctx.measureText(' ').width;
  const wordsW = words.reduce((a, w) => a + ctx.measureText(w).width, 0);
  const gap = words.length > 1 ? (width - wordsW) / (words.length - 1) : 0;
  if (words.length < 3 || gap > space * 4 || gap < 0) {
    ctx.fillText(line, x, y);
    return;
  }
  let cx = x;
  for (const w of words) {
    ctx.fillText(w, cx, y);
    cx += ctx.measureText(w).width + gap;
  }
}

function drawGraphic(canvas: HTMLCanvasElement, h: HadithImage, themeKey: ThemeKey) {
  const ctx: Ctx | null = canvas.getContext('2d');
  if (!ctx) return;
  const t = THEMES[themeKey];
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  // everything left-aligned on the PAD margin
  const x = PAD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const plain = (font: string) => {
    ctx.font = font;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };

  ctx.fillStyle = t.accent;
  plain(`700 30px ${FONT}`);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillText('HADITH', x, PAD + 40);

  const { size, lh, lines, excerpt, justify } = fitQuote(ctx, h.text);
  const reference = excerpt ? `${h.reference} (excerpt)` : h.reference;
  const ascent = ctx.measureText('Hd').actualBoundingBoxAscent || size * 0.72;

  // quote · 56 · rule · 56 · [narrator 32 · 18] · reference 28 as one block between label and footer,
  // sitting a little above true centre (optical centre)
  const sourceH = (h.narrator ? 32 + 18 : 0) + 28;
  const block = ascent + (lines.length - 1) * lh + 56 + 4 + 56 + sourceH;
  const top = PAD + 90;
  const bottom = H - PAD - 70;
  let y = top + Math.max((bottom - top - block) * 0.42, 0) + ascent; // first baseline

  // hang the opening quote in the margin so every line starts on the same edge
  const hang = ctx.measureText('“').width;
  ctx.fillStyle = t.text;
  lines.forEach((l, i) => {
    const left = i === 0 && l.startsWith('“') ? x - hang : x;
    // justified lines run to the right margin; the last line stays ragged, as in print
    if (justify && i < lines.length - 1) fillJustified(ctx, l, left, y + i * lh, x + TEXT_W - left);
    else ctx.fillText(l, left, y + i * lh);
  });
  y += (lines.length - 1) * lh + 56;

  ctx.fillStyle = t.accent;
  ctx.fillRect(x, y, 80, 4);
  y += 4 + 56;

  if (h.narrator) {
    y += 32;
    ctx.fillStyle = t.text;
    plain(`600 32px ${FONT}`);
    ctx.fillText(smartQuotes(h.narrator), x, y);
    y += 18;
  }
  y += 28;
  ctx.fillStyle = t.muted;
  plain(`400 28px ${FONT}`);
  ctx.fillText(reference, x, y);

  ctx.fillStyle = t.muted;
  plain(`600 30px ${FONT}`);
  ctx.fillText('Learnquran.app', x, H - PAD + 20);
}

export default function HadithImageDialog({ hadith, onClose }: { hadith: HadithImage | null; onClose: () => void }) {
  const [theme, setTheme] = useState<ThemeKey>('green');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // redraw when opened, when the hadith changes or a style is picked (after the font loads)
  useEffect(() => {
    if (!hadith) return;
    let cancelled = false;
    (async () => {
      try { await document.fonts.load(`600 60px ${FONT}`); } catch { /* fall back to Arial */ }
      if (!cancelled && canvasRef.current) drawGraphic(canvasRef.current, hadith, theme);
    })();
    return () => { cancelled = true; };
  }, [hadith, theme]);

  useEffect(() => {
    if (!hadith) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [hadith, onClose]);

  if (!hadith) return null;

  const fileName = `hadith-${hadith.reference.split(' · ')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${theme}.png`;
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
          await navigator.share({ files: [file], text: `${hadith.reference}\nLearnquran.app` });
          return;
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return;
        }
      }
    }
    download(); // desktop browsers without file sharing
  };

  return (
    <div className="hid-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hid-box" role="dialog" aria-modal="true" aria-labelledby="hid-title">
        <div className="hid-head">
          <h3 id="hid-title">Hadith image</h3>
          <button type="button" className="hid-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <canvas ref={canvasRef} className="hid-canvas" width={W} height={H} aria-label={`Preview: ${hadith.text}`} />

        <div className="hid-styles" role="group" aria-label="Style">
          {(Object.keys(THEMES) as ThemeKey[]).map(k => (
            <button key={k} type="button" aria-pressed={theme === k} className={theme === k ? 'is-on' : ''} onClick={() => setTheme(k)}>
              <i style={{ background: THEMES[k].bg }} aria-hidden="true" />
              {THEMES[k].label}
            </button>
          ))}
        </div>

        <div className="hid-actions">
          <button type="button" className="hid-primary" onClick={share}>
            <span className="material-symbols-outlined">ios_share</span>
            Share
          </button>
          <button type="button" className="hid-secondary" onClick={download}>
            <span className="material-symbols-outlined">download</span>
            Download
          </button>
        </div>
        <p className="hid-size">1080 × 1350 px · PNG</p>
      </div>
    </div>
  );
}
