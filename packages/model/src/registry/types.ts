import type { Linear, Unit } from "../units.js";

/**
 * How a parameter's raw record value maps to what the engineer sees.
 * - `number`: linear conversion (dB, Hz, ms, octaves)
 * - `steps`: raw is an index into a table of values (attack, release, ratio)
 * - `enum`: raw is a code with a name (filter type, input sensitivity)
 * - `bool`: 0 / 1 (mute, invert)
 * - `flags`: named bits of one raw value (Level Mute/Opt)
 */
export type ParamKind =
  | { kind: "number"; conversion: Linear }
  | { kind: "steps"; unit: Unit; steps: readonly number[] }
  | { kind: "enum"; options: Readonly<Record<number, string>> }
  | { kind: "bool" }
  | { kind: "flags"; bits: Readonly<Record<string, number>> };

export type ParamDef = ParamKind & {
  /** Parameter index in the record (`00 <id> <type> <index>`). */
  index: number;
  /** Stable key within the module, e.g. `trim`, `band3Gain`. */
  key: string;
  label: string;
  /** Value size in the record. */
  size: 1 | 2 | 4;
};

/**
 * Where a block sits in a rack: `input`/`output` are the fixed I/O, `mixer`
 * sums several signals (rack source), `crossover` splits into bands (last
 * module of a rack), `generator` is a signal source.
 */
export type ModuleRole =
  | "input"
  | "output"
  | "processing"
  | "mixer"
  | "crossover"
  | "generator";

/**
 * How well a definition is backed: `simulator` = parameter writes captured
 * from Drag Net against the simulator; `sample` = read from Lukas's `.r26`
 * only; `guessed` = by analogy with a related block type.
 */
export type Evidence = "simulator" | "sample" | "guessed";

/**
 * A live level the device reports as a 1-byte block parameter from index
 * 0x8000 (docs/protocol.md "Meters"). Raw is the distance below full scale
 * in dB; for gain reduction it is the reduction in dB.
 */
export interface MeterDef {
  index: number;
  /** Stable key within the module, e.g. `level`, `adc`, `reduction`. */
  key: string;
  label: string;
  /** `dBu` and `dBFS` levels, or `dB` of gain reduction. */
  unit: "dBu" | "dBFS" | "dB";
  /** Level at raw 0 (full scale): +24 dBu analog, 0 dBFS converters. Unused for gain reduction. */
  fullScale: number;
  reduction: boolean;
}

export interface ModuleDef {
  blockType: number;
  name: string;
  role: ModuleRole;
  evidence: Evidence;
  params: readonly ParamDef[];
  /** Keys of the 2–4 parameters shown in the compact module view. */
  compact: readonly string[];
  /** Approximate DSP load on RPM 26z in percent of the whole device (docs/dsp-limits.md). */
  dspPercent: number;
  /** Delay blocks used (max 10 on RPM 26z). */
  delayBlocks?: number;
  /** Crossover band names in output order. */
  bands?: readonly string[];
  /** Live levels the device reports for this block. */
  meters?: readonly MeterDef[];
}
