/**
 * Generic digital filter math for drawing EQ and crossover curves on the
 * client. RBJ "Audio EQ Cookbook" biquads plus cascades for higher-order
 * crossover slopes. No device knowledge: the caller maps its own filter
 * types to these shapes.
 */

export type FilterFamily = 'butterworth' | 'linkwitzRiley' | 'bessel';

export type Filter =
  | { kind: 'peak'; freq: number; gainDb: number; q: number }
  | { kind: 'lowShelf' | 'highShelf'; freq: number; gainDb: number; q?: number }
  | { kind: 'lowPass' | 'highPass'; freq: number; family: FilterFamily; order: number };

/** Normalized biquad: y = b0 x + b1 x1 + b2 x2 − a1 y1 − a2 y2. */
interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export const DEFAULT_SAMPLE_RATE = 48_000;

/** Q of a peaking filter from its bandwidth in octaves. */
export function qFromOctaves(octaves: number): number {
  const k = 2 ** octaves;
  return Math.sqrt(k) / (k - 1);
}

function normalize(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Biquad {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function peak(freq: number, gainDb: number, q: number, fs: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w = (2 * Math.PI * freq) / fs;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  return normalize(1 + alpha * A, -2 * c, 1 - alpha * A, 1 + alpha / A, -2 * c, 1 - alpha / A);
}

function shelf(high: boolean, freq: number, gainDb: number, q: number, fs: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w = (2 * Math.PI * freq) / fs;
  const c = Math.cos(w);
  const s2 = 2 * Math.sqrt(A) * (Math.sin(w) / (2 * q));
  const sign = high ? -1 : 1;
  const b0 = A * (A + 1 - sign * (A - 1) * c + s2);
  const b1 = sign * 2 * A * (A - 1 - sign * (A + 1) * c);
  const b2 = A * (A + 1 - sign * (A - 1) * c - s2);
  const a0 = A + 1 + sign * (A - 1) * c + s2;
  const a1 = -sign * 2 * (A - 1 + sign * (A + 1) * c);
  const a2 = A + 1 + sign * (A - 1) * c - s2;
  return normalize(b0, b1, b2, a0, a1, a2);
}

function pass2(high: boolean, freq: number, q: number, fs: number): Biquad {
  const w = (2 * Math.PI * freq) / fs;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const b1 = high ? -(1 + c) : 1 - c;
  const b0 = Math.abs(b1) / 2;
  return normalize(b0, b1, b0, 1 + alpha, -2 * c, 1 - alpha);
}

function pass1(high: boolean, freq: number, fs: number): Biquad {
  const k = Math.tan((Math.PI * freq) / fs);
  const b0 = high ? 1 / (k + 1) : k / (k + 1);
  return { b0, b1: high ? -b0 : b0, b2: 0, a1: (k - 1) / (k + 1), a2: 0 };
}

/** One section of a cascade: Q of a 2nd-order stage, or null for a 1st-order stage. */
interface Stage {
  q: number | null;
  /** Frequency scale factor of this stage (Bessel only). */
  scale: number;
}

function butterworthStages(order: number): Stage[] {
  const stages: Stage[] = [];
  for (let k = 1; k <= Math.floor(order / 2); k++) {
    // Pole pair k sits at this angle from the negative real axis.
    const angle = (Math.PI * (order - 2 * k + 1)) / (2 * order);
    stages.push({ q: 1 / (2 * Math.cos(angle)), scale: 1 });
  }
  if (order % 2 === 1) stages.push({ q: null, scale: 1 });
  return stages;
}

/**
 * Phase-matched Bessel stages (low-pass prototype), from standard filter
 * tables. How a given DSP normalizes its Bessel cutoff varies, so treat the
 * drawn curve as an approximation.
 */
const BESSEL: Record<number, Stage[]> = {
  1: [{ q: null, scale: 1 }],
  2: [{ q: 0.5773, scale: 1.2736 }],
  3: [
    { q: null, scale: 1.327 },
    { q: 0.691, scale: 1.4524 },
  ],
  4: [
    { q: 0.5219, scale: 1.4192 },
    { q: 0.8055, scale: 1.5912 },
  ],
};

function stagesOf(family: FilterFamily, order: number): Stage[] {
  if (family === 'linkwitzRiley') {
    const half = butterworthStages(Math.max(1, Math.round(order / 2)));
    return [...half, ...half];
  }
  if (family === 'bessel') return BESSEL[order] ?? butterworthStages(order);
  return butterworthStages(order);
}

function biquadsOf(f: Filter, fs: number): Biquad[] {
  switch (f.kind) {
    case 'peak':
      return [peak(f.freq, f.gainDb, f.q, fs)];
    case 'lowShelf':
    case 'highShelf':
      return [shelf(f.kind === 'highShelf', f.freq, f.gainDb, f.q ?? Math.SQRT1_2, fs)];
    case 'lowPass':
    case 'highPass': {
      const high = f.kind === 'highPass';
      return stagesOf(f.family, f.order).map(({ q, scale }) => {
        // A high-pass prototype mirrors the low-pass one: divide instead of multiply.
        const freq = high ? f.freq / scale : f.freq * scale;
        return q === null ? pass1(high, freq, fs) : pass2(high, freq, q, fs);
      });
    }
  }
}

function magnitudeSquared({ b0, b1, b2, a1, a2 }: Biquad, w: number): number {
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2;
  const ni = -(b1 * s1 + b2 * s2);
  const dr = 1 + a1 * c1 + a2 * c2;
  const di = -(a1 * s1 + a2 * s2);
  return (nr * nr + ni * ni) / (dr * dr + di * di);
}

/** Combined magnitude in dB of all filters (in series) at each frequency. */
export function responseDb(filters: readonly Filter[], freqs: readonly number[], sampleRate = DEFAULT_SAMPLE_RATE): number[] {
  const sections = filters.flatMap((f) => biquadsOf(f, sampleRate));
  return freqs.map((hz) => {
    const w = (2 * Math.PI * hz) / sampleRate;
    const power = sections.reduce((p, s) => p * magnitudeSquared(s, w), 1);
    return 10 * Math.log10(Math.max(power, 1e-20));
  });
}

/** `count` frequencies spaced evenly on a log axis from `min` to `max`. */
export function logFrequencies(count: number, min = 20, max = 20_000): number[] {
  return Array.from({ length: count }, (_, i) => min * (max / min) ** (i / (count - 1)));
}
