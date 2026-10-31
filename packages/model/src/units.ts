/**
 * Engineering units and the raw ↔ value conversions of RPM parameters.
 * Every conversion lives here; module definitions only pick one.
 * See docs/protocol.md §4 "Conversions".
 */

export type Unit =
  | "dB"
  | "dBFS"
  | "Hz"
  | "ms"
  | "s"
  | "h"
  | "dB/s"
  | "oct"
  | "ratio";

/** A linear conversion `value = (raw - offset) / divisor`, plus the raw range of the parameter. */
export interface Linear {
  readonly unit: Unit;
  readonly offset: number;
  readonly divisor: number;
  readonly rawMin: number;
  readonly rawMax: number;
}

const linear = (
  unit: Unit,
  offset: number,
  divisor: number,
  rawMin: number,
  rawMax: number,
): Linear => ({
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
export const levelRange = (
  minDb: number,
  maxDb: number,
  unit: Unit = "dB",
): Linear => linear(unit, 192, 2, 192 + 2 * minDb, 192 + 2 * maxDb);

/** Level block, mixer output level, output trim: −30 … +16 dB. */
export const LEVEL = levelRange(-30, 16);
/** Mixer input level: −30 … 0 dB. */
export const MIX_INPUT_LEVEL = levelRange(-30, 0);
/** Matrix mixer input level: −60 … 0 dB. */
export const MATRIX_INPUT_LEVEL = levelRange(-60, 0);
/** Signal generator level: −40 … 0 dB. */
export const GENERATOR_LEVEL = levelRange(-40, 0);
/** Limiter threshold: −40 … 0 dBFS. */
export const LIMITER_THRESHOLD = levelRange(-40, 0, "dBFS");
/**
 * Analog/digital input trim: dB = raw − 96. The RPM 26z data sheet gives
 * +16 to −20 dB in 1 dB steps (raw 76..112); Drag Net shows raw 0 as −100 dB.
 */
export const INPUT_TRIM = linear("dB", 96, 1, 76, 112);
/** Analog input user-defined line gain: ±15 dB (data sheet). */
export const USER_GAIN = levelRange(-15, 15);
/**
 * Values in 1 dB steps: dB = raw − 96 (Drag Net shows raw 0 as −100). Used by
 * thresholds, knee, AGC target and noise compensator gains.
 */
export const dbRange = (
  minDb: number,
  maxDb: number,
  unit: Unit = "dB",
): Linear => linear(unit, 96, 1, 96 + minDb, 96 + maxDb);

/**
 * Compressor threshold: dBFS = raw − 96 in 1 dB steps (Drag Net's own display
 * for raw 0..127, simulator), −40 … 0 dBFS (Drag Net help). The help's
 * "½ dB steps" does not match what Drag Net shows.
 */
export const COMPRESSOR_THRESHOLD = dbRange(-40, 0, "dBFS");
/** PEQ gain: dB = (raw − 120) / 4, −15 … +12 dB in ¼ dB steps (Drag Net help). */
export const PEQ_GAIN = linear("dB", 120, 4, 60, 168);
/**
 * PEQ bandwidth: octaves = 0.025 · (raw + 1) for raw 0 … 80 (0.025 … 2.025
 * oct; Drag Net's display, simulator). Drag Net shows 2.025 for every raw
 * above 80, yet Lukas's file holds raw up to 223, so what the DSP does above
 * 80 is unknown (needs hardware). The raw range stays 0 … 255 so those values
 * survive a read-modify-write. The help's "0.015 … 4 octaves" does not match.
 */
export const PEQ_BANDWIDTH = linear("oct", -1, 40, 0, 255);
/** Feedback suppressor max attenuation: dB = (raw − 120) / 4 like PEQ gain; −30 … 0 dB is a guess. */
export const FBS_MAX_ATTENUATION = linear("dB", 120, 4, 0, 120);
/** Graphic EQ band, input and output gain: dB = (raw − 120) / 4, ±12 dB in ¼ dB steps. */
export const GEQ_GAIN = linear("dB", 120, 4, 72, 168);
/** A rate in dB per second, raw = dB/s (AGC, side-chain compressor attack and release). */
export const rate = (min: number, max: number): Linear =>
  linear("dB/s", 0, 1, min, max);
/** A time in whole seconds, raw = s (noise compensator). */
export const seconds = (min: number, max: number): Linear =>
  linear("s", 0, 1, min, max);
/** AGC ratio: x:1 = raw / 10. */
export const AGC_RATIO = linear("ratio", 0, 10, 10, 255);
/** Frequency of PEQ, crossover and generator: raw = Hz, 20 … 20 000 Hz (Horn EQ filters: 2 … 5 kHz). */
export const FREQUENCY = linear("Hz", 0, 1, 20, 20000);
/** Delay: raw = samples at 48 kHz, max 1365 ms. */
export const DELAY = linear("ms", 0, 48, 0, 65520);

export function fromRaw(conversion: Linear, raw: number): number {
  return (raw - conversion.offset) / conversion.divisor;
}

/** Nearest raw value for `value`, clamped to the parameter's raw range. */
export function toRaw(conversion: Linear, value: number): number {
  const raw = Math.round(value * conversion.divisor + conversion.offset);
  return Math.min(conversion.rawMax, Math.max(conversion.rawMin, raw));
}

/** Attack times in ms for raw 0..15 (compressor, limiter). */
export const ATTACK_MS = [
  0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 50, 75, 100,
] as const;
/** Release times in ms for raw 0..14 (compressor, limiter). */
export const RELEASE_MS = [
  1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2000, 3000, 4000, 5000,
] as const;
/** Compressor ratios (x:1) for raw 0..28; the last one is ∞. */
export const RATIO = [
  1.0,
  1.1,
  1.2,
  1.3,
  1.4,
  1.5,
  1.6,
  1.7,
  1.8,
  1.9,
  2,
  2.2,
  2.4,
  2.6,
  2.8,
  3,
  3.25,
  3.5,
  3.75,
  4,
  4.5,
  5,
  6,
  8,
  10,
  12,
  15,
  20,
  Infinity,
] as const;

/** Side-chain compressor ratios (x:1) for raw 0..127: 1.0 … 10.0 in 0.1 steps, then 11 … 47. */
export const SC_RATIO = [
  ...Array.from({ length: 91 }, (_, i) => (10 + i) / 10),
  ...Array.from({ length: 37 }, (_, i) => 11 + i),
] as const;
/** Ambient noise compensator gain ratios (x:1) for raw 0..14. */
export const ANC_RATIO = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 2.5, 3, 4,
] as const;
/** AGC gain hold for raw 0..31 in seconds; raw 31 = infinite (hold until reset). */
export const AGC_HOLD_S = [
  ...Array.from({ length: 31 }, (_, i) => i),
  Infinity,
] as const;

/**
 * Graphic EQ low/mid/high tone level for raw 0..63 in dB, as Drag Net shows
 * it: −60 … −10 dB in 3.125 dB steps, −10 … 0 dB in 0.625 dB steps, then
 * 0 … +6 dB in 31 steps. For low and high, raw 0 is Off (−∞).
 */
export const geqToneLevel = (withOff: boolean): readonly number[] => [
  withOff ? -Infinity : -60,
  ...Array.from({ length: 15 }, (_, i) => -60 + 3.125 * (i + 1)),
  ...Array.from({ length: 16 }, (_, i) => -10 + 0.625 * i),
  ...Array.from({ length: 32 }, (_, i) => (6 * i) / 31),
];
/** Graphic EQ low cut for raw 0..63: 15 · 2^(4·raw/63) Hz, 15 … 240 Hz (Drag Net shows it rounded to 0.5 Hz). */
export const GEQ_LOW_CUT_HZ = Array.from(
  { length: 64 },
  (_, i) => 15 * 2 ** ((4 * i) / 63),
);
