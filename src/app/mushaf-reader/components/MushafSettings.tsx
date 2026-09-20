'use client';

import type { ScriptStyle } from '../lib/api';

const SCRIPTS: { id: ScriptStyle; label: string }[] = [
  { id: 'uthmani', label: 'Uthmani' },
  { id: 'indopak', label: 'IndoPak' },
  { id: 'tajweed', label: 'Tajweed' },
];

export const LINE_OPTIONS = [13, 15, 16] as const;
export const FONT_SIZE_MIN = 1;
export const FONT_SIZE_MAX = 7;

interface MushafSettingsProps {
  script: ScriptStyle;
  linesPerPage: number;
  fontSize: number;
  onScriptChange: (script: ScriptStyle) => void;
  onLinesChange: (lines: number) => void;
  onFontSizeChange: (size: number) => void;
}

export default function MushafSettings({
  script,
  linesPerPage,
  fontSize,
  onScriptChange,
  onLinesChange,
  onFontSizeChange,
}: MushafSettingsProps) {
  return (
    <div className="mr-settings" role="group" aria-label="Reading settings">
      <div className="mr-script-toggle" role="group" aria-label="Script style">
        {SCRIPTS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="mr-script-btn"
            aria-pressed={script === id}
            onClick={() => onScriptChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mr-row">
        <span className="mr-row-label">Lines</span>
        <div className="mr-select-wrap">
          <select
            className="mr-select"
            value={linesPerPage}
            aria-label="Lines per page"
            onChange={(e) => onLinesChange(Number(e.target.value))}
          >
            {LINE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} Lines
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mr-row">
        <span className="mr-row-label">Font size</span>
        <div className="mr-stepper" role="group" aria-label="Font size">
          <button
            type="button"
            className="mr-stepper-btn"
            aria-label="Decrease font size"
            disabled={fontSize <= FONT_SIZE_MIN}
            onClick={() => onFontSizeChange(fontSize - 1)}
          >
            −
          </button>
          <span className="mr-stepper-value" aria-live="polite">
            {fontSize}
          </span>
          <button
            type="button"
            className="mr-stepper-btn"
            aria-label="Increase font size"
            disabled={fontSize >= FONT_SIZE_MAX}
            onClick={() => onFontSizeChange(fontSize + 1)}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
