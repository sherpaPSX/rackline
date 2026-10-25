/**
 * Mappings between a parameter value and a control position (0..1).
 * Every draggable control works in position space, so drag speed, keyboard
 * steps and fine mode feel the same whether the value is linear, logarithmic
 * (frequency) or a fader taper (dB).
 */
export interface ValueScale {
  readonly min: number;
  readonly max: number;
  toPosition(value: number): number;
  fromPosition(position: number): number;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function linearScale(min: number, max: number): ValueScale {
  return {
    min,
    max,
    toPosition: (value) => (clamp(value, min, max) - min) / (max - min),
    fromPosition: (position) => min + clamp(position, 0, 1) * (max - min),
  };
}

/** Logarithmic scale for frequency or Q; `min` must be > 0. */
export function logScale(min: number, max: number): ValueScale {
  const span = Math.log(max / min);
  return {
    min,
    max,
    toPosition: (value) => Math.log(clamp(value, min, max) / min) / span,
    fromPosition: (position) => min * Math.exp(clamp(position, 0, 1) * span),
  };
}

export interface FaderTaper {
  /** Level the lower part runs down to; the very bottom of the travel is −∞. */
  readonly minDb: number;
  readonly maxDb: number;
  /** Position of 0 dB (unity gain). */
  readonly unityPosition: number;
}

export const DEFAULT_FADER_TAPER: FaderTaper = { minDb: -60, maxDb: 6, unityPosition: 0.75 };

/** Position at or below this is shown as −∞ dB (fully closed). */
const CLOSED_POSITION = 0.001;

/**
 * Console-style fader: the upper part (0 dB … max) gets more travel per dB
 * than the lower part (min … 0 dB). Position 0 is −∞ dB.
 */
export function faderScale(taper: FaderTaper = DEFAULT_FADER_TAPER): ValueScale {
  const { minDb, maxDb, unityPosition: u } = taper;
  return {
    min: -Infinity,
    max: maxDb,
    toPosition(db) {
      if (db >= 0) return u + (Math.min(db, maxDb) / maxDb) * (1 - u);
      return Math.max(0, u - (db / minDb) * u);
    },
    fromPosition(position) {
      const t = clamp(position, 0, 1);
      if (t <= CLOSED_POSITION) return -Infinity;
      if (t >= u) return ((t - u) / (1 - u)) * maxDb;
      return ((u - t) / u) * minDb;
    },
  };
}
