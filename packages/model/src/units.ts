/**
 * Engineering units and the raw ↔ value conversions of RPM parameters.
 * Every conversion lives here; module definitions only pick one.
 * See docs/protocol.md §4 "Conversions".
 */

export type Unit = 'dB' | 'dBFS' | 'Hz' | 'ms' | 'oct' | 'ratio';

/** A linear conversion `value = (raw - offset) / divisor`, plus the raw range of the parameter. */
export interface Linear {
  readonly unit: Unit;
  readonly offset: number;
  readonly divisor: number;
  readonly rawMin: number;
  readonly rawMax: number;
}

const linear = (unit: Unit, offset: number, divisor: number, rawMin: number, rawMax: number): Linear => ({
  unit,
  offset,
  divisor,
  rawMin,
  rawMax,
});

/**
 * Levels (mixer, Level block, output trim, input user gain, generator level,
 * limiter threshold): dB = (raw − 192) / 2, raw 0 = −96 dB. Each parameter
 * has its own range from the Drag Net help, in ½ dB steps.
 */
export const levelRange = (minDb: number, maxDb: number, unit: Unit = 'dB'): Linear =>
  linear(unit, 192, 2, 192 + 2 * minDb, 192 + 2 * maxDb);

/** Level block, mixer output level, output trim: −30 … +16 dB. */
export const LEVEL = levelRange(-30, 16);
/** Mixer input level: −30 … 0 dB. */
export const MIX_INPUT_LEVEL = levelRange(-30, 0);
/** Signal generator level: −40 … 0 dB. */
export const GENERATOR_LEVEL = levelRange(-40, 0);
/** Limiter threshold: −40 … 0 dBFS. */
export const LIMITER_THRESHOLD = levelRange(-40, 0, 'dBFS');
/**
 * Analog/digital input trim: dB = raw − 96. The RPM 26z data sheet gives
 * +16 to −20 dB in 1 dB steps (raw 76..112); Drag Net shows raw 0 as −100 dB.
 */
export const INPUT_TRIM = linear('dB', 96, 1, 76, 112);
/** Analog input user-defined line gain: ±15 dB (data sheet). */
export const USER_GAIN = levelRange(-15, 15);
/**
 * Compressor threshold: dBFS = raw − 96, max 32 dBFS (simulator). The Drag
 * Net help says −40 … 0 dBFS in ½ dB steps, which does not fit this
 * conversion; unresolved, so the range stays wide.
 */
export const COMPRESSOR_THRESHOLD = linear('dBFS', 96, 1, 0, 128);
/** PEQ gain: dB = (raw − 120) / 4, −15 … +12 dB in ¼ dB steps (Drag Net help). */
export const PEQ_GAIN = linear('dB', 120, 4, 60, 168);
/**
 * PEQ bandwidth: octaves = 0.025 · (raw + 1) (simulator; raw 12 = the
 * default 0.325 oct). The Drag Net help describes 200 non-linear steps from
 * 0.015 to 4 octaves, which does not fit; unresolved, so the range stays wide.
 */
export const PEQ_BANDWIDTH = linear('oct', -1, 40, 0, 255);
/** Frequency of PEQ, crossover and generator: raw = Hz, 20 … 20 000 Hz (Horn EQ filters: 2 … 5 kHz). */
export const FREQUENCY = linear('Hz', 0, 1, 20, 20000);
/** Delay: raw = samples at 48 kHz, max 1365 ms. */
export const DELAY = linear('ms', 0, 48, 0, 65520);

export function fromRaw(conversion: Linear, raw: number): number {
  return (raw - conversion.offset) / conversion.divisor;
}

/** Nearest raw value for `value`, clamped to the parameter's raw range. */
export function toRaw(conversion: Linear, value: number): number {
  const raw = Math.round(value * conversion.divisor + conversion.offset);
  return Math.min(conversion.rawMax, Math.max(conversion.rawMin, raw));
}

/** Attack times in ms for raw 0..15 (compressor, limiter). */
export const ATTACK_MS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 50, 75, 100] as const;
/** Release times in ms for raw 0..14 (compressor, limiter). */
export const RELEASE_MS = [1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2000, 3000, 4000, 5000] as const;
/** Compressor ratios (x:1) for raw 0..28; the last one is ∞. */
export const RATIO = [
  1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.25, 3.5, 3.75, 4, 4.5, 5, 6, 8, 10, 12,
  15, 20, Infinity,
] as const;
