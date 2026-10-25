/** Display formatting for parameter values. Uses the true minus sign (−). */

const MINUS = '−';

function signed(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return (value > 0 ? '+' : MINUS) + text;
}

export function formatDb(db: number, digits = 1): string {
  if (db === -Infinity) return `${MINUS}∞ dB`;
  return `${signed(db, digits)} dB`;
}

export function formatHz(hz: number): string {
  if (hz >= 10_000) return `${(hz / 1000).toFixed(1)} kHz`;
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

export function formatMs(ms: number): string {
  return `${ms.toFixed(ms < 10 ? 2 : 1)} ms`;
}

/**
 * Parses what a sound engineer types into a value box: "-6", "−6 dB",
 * "1.2k", "1k2", "250 Hz". Returns null if it is not a number.
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(MINUS, '-').replace(',', '.').toLowerCase();
  const m = /^([+-]?\d*\.?\d+)\s*(k(\d*))?\s*(db|hz|ms|%)?$/.exec(t);
  if (!m?.[1]) return null;
  const base = Number(m[1]);
  if (m[2] === undefined) return base;
  // "1k2" means 1.2k
  const tail = m[3] ? Number(`0.${m[3]}`) : 0;
  return (base + Math.sign(base || 1) * tail) * 1000;
}
