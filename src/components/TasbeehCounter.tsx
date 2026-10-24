'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import './TasbeehCounter.css';

interface Dhikr {
  label: string;
  ar: string;
  meaning: string;
  target: number;
  color: string;
}

const DHIKR: Dhikr[] = [
  { label: 'SubhanAllah', ar: 'سُبْحَانَ ٱللَّٰهِ', meaning: 'Glory be to Allah', target: 33, color: '#10b981' },
  { label: 'Alhamdulillah', ar: 'ٱلْحَمْدُ لِلَّٰهِ', meaning: 'All praise is due to Allah', target: 33, color: '#f59e0b' },
  { label: 'Allahu Akbar', ar: 'ٱللَّٰهُ أَكْبَرُ', meaning: 'Allah is the Greatest', target: 34, color: '#a78bfa' },
  { label: 'Astaghfirullah', ar: 'أَسْتَغْفِرُ ٱللَّٰهَ', meaning: 'I seek forgiveness from Allah', target: 100, color: '#38bdf8' },
  { label: 'La ilaha illallah', ar: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', meaning: 'There is no god but Allah', target: 100, color: '#f472b6' },
];

/** The first three form the after-Salah sequence (33 · 33 · 34) */
const SALAH_SEQ = 3;
const MAX_BEADS = 50;
const STORE_KEY = 'tasbeehStats';

interface Stats {
  total: number;
  rounds: number;
  todayDate: string;
  today: number;
}

const todayStr = () => new Date().toDateString();

function loadStats(): Stats {
  const blank: Stats = { total: 0, rounds: 0, todayDate: todayStr(), today: 0 };
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!s) {
      // carry over the old single counter
      const legacy = parseInt(localStorage.getItem('tasbeehTotal') || '0', 10) || 0;
      return { ...blank, total: legacy, rounds: Math.floor(legacy / 33) };
    }
    return s.todayDate === todayStr() ? s : { ...s, todayDate: todayStr(), today: 0 };
  } catch {
    return blank;
  }
}

// ── Tiny WebAudio sounds (no files needed) ──
let audioCtx: AudioContext | null = null;
function tone(freq: number, dur: number, vol = 0.08, delay = 0) {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch { /* audio unavailable */ }
}

interface Ripple { id: number; x: number; y: number }

export default function TasbeehCounter() {
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, rounds: 0, todayDate: '', today: 0 });
  const [salahMode, setSalahMode] = useState(true);
  const [sound, setSound] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [burst, setBurst] = useState(0);
  const [toast, setToast] = useState('');
  const lockRef = useRef(false);
  const rippleId = useRef(0);

  const d = DHIKR[idx];
  const beads = Math.min(d.target, MAX_BEADS);
  const perBead = d.target / beads;
  const filled = Math.floor(count / perBead);
  const pct = count / d.target;

  useEffect(() => {
    setStats(loadStats());
    try {
      setSound(localStorage.getItem('tasbeehSound') === '1');
      setSalahMode(localStorage.getItem('tasbeehSalahMode') !== '0');
    } catch { /* ignore */ }
  }, []);

  const saveStats = (s: Stats) => {
    setStats(s);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      localStorage.setItem('tasbeehTotal', String(s.total));
    } catch { /* ignore */ }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const select = (i: number) => {
    setIdx(i);
    setCount(0);
    lockRef.current = false;
  };

  const tap = useCallback((x?: number, y?: number) => {
    if (lockRef.current) return;
    const next = count + 1;
    setCount(next);

    // ripple from tap point (centre for keyboard)
    const id = ++rippleId.current;
    setRipples(r => [...r, { id, x: x ?? 50, y: y ?? 50 }]);
    setTimeout(() => setRipples(r => r.filter(p => p.id !== id)), 650);

    const base = stats.todayDate === todayStr() ? stats : { ...stats, todayDate: todayStr(), today: 0 };
    const done = next >= d.target;
    saveStats({ ...base, total: base.total + 1, today: base.today + 1, rounds: base.rounds + (done ? 1 : 0) });

    if (sound) tone(done ? 660 : 1200, done ? 0.35 : 0.05, done ? 0.12 : 0.05);
    if (navigator.vibrate) navigator.vibrate(done ? [40, 60, 40] : 12);

    if (done) {
      lockRef.current = true;
      setBurst(b => b + 1);
      if (sound) {
        tone(880, 0.4, 0.1, 0.12);
        tone(1320, 0.5, 0.08, 0.24);
      }
      const advance = salahMode && idx < SALAH_SEQ - 1;
      const finishedSeq = salahMode && idx === SALAH_SEQ - 1;
      showToast(finishedSeq ? 'Tasbeeh complete — MashaAllah! 🤲' : 'MashaAllah! Round complete');
      setTimeout(() => {
        setCount(0);
        if (advance) setIdx(idx + 1);
        else if (finishedSeq) setIdx(0);
        lockRef.current = false;
      }, 1100);
    }
  }, [count, d.target, idx, salahMode, sound, stats]);

  const undo = () => {
    if (count === 0 || lockRef.current) return;
    setCount(c => c - 1);
    saveStats({ ...stats, total: Math.max(stats.total - 1, 0), today: Math.max(stats.today - 1, 0) });
  };

  const resetAll = () => {
    setCount(0);
    saveStats({ total: 0, rounds: 0, todayDate: todayStr(), today: 0 });
  };

  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    if (v) tone(1200, 0.05, 0.05);
    try { localStorage.setItem('tasbeehSound', v ? '1' : '0'); } catch { /* ignore */ }
  };

  const toggleSalah = () => {
    const v = !salahMode;
    setSalahMode(v);
    try { localStorage.setItem('tasbeehSalahMode', v ? '1' : '0'); } catch { /* ignore */ }
    if (v && idx >= SALAH_SEQ) select(0);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    tap(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) tap();
    }
  };

  return (
    <section className="tb" style={{ ['--c' as string]: d.color }} aria-labelledby="tb-title">
      <div className="tb-header">
        <div>
          <p className="tb-kicker font-arabic">تسبيح</p>
          <h2 id="tb-title">Tasbeeh Counter</h2>
        </div>
        <div className="tb-toggles">
          <button className={`tb-toggle${salahMode ? ' on' : ''}`} onClick={toggleSalah} aria-pressed={salahMode}>
            <span className="material-symbols-outlined">mosque</span>
            After Salah
          </button>
          <button className={`tb-toggle tb-toggle-icon${sound ? ' on' : ''}`} onClick={toggleSound} aria-pressed={sound} aria-label="Sound">
            <span className="material-symbols-outlined">{sound ? 'volume_up' : 'volume_off'}</span>
          </button>
        </div>
      </div>

      <div className="tb-card">
        <div className="tb-aura" aria-hidden="true" />

        {/* ── Dhikr picker ── */}
        <div className="tb-chips" role="tablist" aria-label="Choose dhikr">
          {DHIKR.map((x, i) => {
            const inSeq = i < SALAH_SEQ;
            const doneInSeq = salahMode && inSeq && i < idx && idx < SALAH_SEQ;
            return (
              <button
                key={x.label}
                role="tab"
                aria-selected={i === idx}
                className={`tb-chip${i === idx ? ' active' : ''}${doneInSeq ? ' done' : ''}${salahMode && !inSeq ? ' dim' : ''}`}
                style={{ ['--cc' as string]: x.color }}
                onClick={() => select(i)}
              >
                {doneInSeq && <span className="material-symbols-outlined">check</span>}
                {x.label}
                <small>×{x.target}</small>
              </button>
            );
          })}
        </div>

        <div className="tb-body">
          {/* ── Bead ring + tap button ── */}
          <div className="tb-stage">
            <svg className="tb-ring" viewBox="0 0 300 300" aria-hidden="true">
              <circle cx="150" cy="150" r="138" className="tb-orbit" />
              <circle
                cx="150" cy="150" r="118"
                className="tb-progress"
                strokeDasharray={2 * Math.PI * 118}
                strokeDashoffset={2 * Math.PI * 118 * (1 - pct)}
                transform="rotate(-90 150 150)"
              />
              {Array.from({ length: beads }).map((_, i) => {
                const a = (i / beads) * Math.PI * 2 - Math.PI / 2;
                const cx = 150 + Math.cos(a) * 138;
                const cy = 150 + Math.sin(a) * 138;
                const state = i < filled ? 'on' : i === filled ? 'next' : '';
                return <circle key={`${idx}-${i}`} cx={cx} cy={cy} r={beads > 40 ? 4.2 : 6} className={`tb-bead ${state}`} />;
              })}
            </svg>

            <button
              className="tb-tap"
              onPointerDown={onPointerDown}
              onKeyDown={onKeyDown}
              aria-label={`Count ${d.label}. ${count} of ${d.target}`}
            >
              {ripples.map(r => (
                <span key={r.id} className="tb-ripple" style={{ left: `${r.x}%`, top: `${r.y}%` }} />
              ))}
              <span key={count} className="tb-count">{count}</span>
              <span className="tb-of">of {d.target}</span>
              <span className="tb-taphint">
                <span className="material-symbols-outlined">touch_app</span>
                Tap
              </span>
              {count > 0 && <span key={`p${count}`} className="tb-plus">+1</span>}
            </button>

            {/* Completion burst */}
            {burst > 0 && (
              <div key={burst} className="tb-burst" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, i) => (
                  <i key={i} style={{ ['--a' as string]: `${i * 20}deg`, ['--d' as string]: `${90 + (i % 3) * 18}px` }} />
                ))}
              </div>
            )}

            {toast && <div className="tb-toast" role="status">{toast}</div>}
          </div>

          {/* ── Info ── */}
          <div className="tb-info">
            <p key={`ar${idx}`} className="tb-ar font-arabic" dir="rtl" lang="ar">{d.ar}</p>
            <p className="tb-label">{d.label}</p>
            <p className="tb-meaning">“{d.meaning}”</p>

            {salahMode && idx < SALAH_SEQ && (
              <div className="tb-seq" aria-label="After Salah progress">
                {DHIKR.slice(0, SALAH_SEQ).map((x, i) => (
                  <div key={x.label} className={`tb-seq-step${i < idx ? ' done' : i === idx ? ' now' : ''}`} style={{ ['--cc' as string]: x.color }}>
                    <div className="tb-seq-bar">
                      <span style={{ width: `${i < idx ? 100 : i === idx ? pct * 100 : 0}%` }} />
                    </div>
                    <small>{x.target}</small>
                  </div>
                ))}
              </div>
            )}

            <div className="tb-stats">
              <div><b>{stats.today}</b><span>Today</span></div>
              <div><b>{stats.rounds}</b><span>Rounds</span></div>
              <div><b>{stats.total.toLocaleString()}</b><span>Lifetime</span></div>
            </div>

            <div className="tb-actions">
              <button className="tb-btn" onClick={undo} disabled={count === 0}>
                <span className="material-symbols-outlined">undo</span>
                Undo
              </button>
              <button className="tb-btn" onClick={() => setCount(0)} disabled={count === 0}>
                <span className="material-symbols-outlined">replay</span>
                Restart
              </button>
              <button className="tb-btn tb-btn-danger" onClick={resetAll}>
                <span className="material-symbols-outlined">delete_sweep</span>
                Reset all
              </button>
            </div>
            <p className="tb-kbd">Tip: focus the circle and press <kbd>Space</kbd> to count</p>
          </div>
        </div>
      </div>
    </section>
  );
}
