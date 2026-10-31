import type { MeterDef } from "./registry/types.js";

/** Analog full scale of the RPM 26z (docs/protocol.md "Meters"). */
const ANALOG_FULL_SCALE_DBU = 24;

export const levelMeter = (
  index: number,
  key: string,
  label: string,
  unit: "dBu" | "dBFS",
): MeterDef => ({
  index,
  key,
  label,
  unit,
  fullScale: unit === "dBu" ? ANALOG_FULL_SCALE_DBU : 0,
  reduction: false,
});

export const reductionMeter = (index: number): MeterDef => ({
  index,
  key: "reduction",
  label: "Gain reduction",
  unit: "dB",
  fullScale: 0,
  reduction: true,
});

/** Meter records are 1 byte. */
export const METER_SIZE = 1;

/**
 * Raw meter value → level in the meter's unit: full scale minus raw for a
 * level, raw itself for gain reduction. 1 dB per step (unverified on hardware).
 */
export function decodeMeter(meter: MeterDef, raw: number): number {
  return meter.reduction ? raw : meter.fullScale - raw;
}
