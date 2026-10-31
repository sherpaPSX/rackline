import { FREQUENCY } from "../units.js";
import { bool, choice, num } from "./params.js";
import type { ModuleDef, ParamDef } from "./types.js";

/**
 * Codes 0, 1, 2, 4, 5, 6, 8 are verified with the simulator. 3, 7 and 9
 * follow the order of Drag Net's filter type list, which matches every
 * verified code. Simple mode always uses LR24.
 */
export const CROSSOVER_FILTER_TYPES = {
  0: "Off",
  1: "LR12",
  2: "LR24",
  3: "BW12",
  4: "BW18",
  5: "BW24",
  6: "Bessel12",
  7: "Bessel18",
  8: "Bessel24",
  9: "1st order",
};

/**
 * One crossover filter: type, frequency, invert at `index`, `index + 1`,
 * `index + 2`. The index before each group is 1 in all samples; its meaning
 * is unknown, so it is not exposed.
 */
function filter(index: number, key: string, label: string): ParamDef[] {
  return [
    choice(index, `${key}Type`, `${label} type`, CROSSOVER_FILTER_TYPES),
    num(index + 1, `${key}Freq`, `${label} frequency`, FREQUENCY, 2),
    bool(index + 2, `${key}Invert`, `${label} invert`),
  ];
}

/**
 * Outputs are ordered high band first: in Lukas's config the 2-way's second
 * output (low-pass at 120 Hz) feeds the sub, the first one is unused.
 */
export const crossover2: ModuleDef = {
  blockType: 0x060f,
  name: "2-way Crossover",
  role: "crossover",
  evidence: "simulator",
  params: [
    ...filter(3, "lowUpper", "Low band upper"),
    ...filter(7, "highLower", "High band lower"),
  ],
  compact: ["lowUpperFreq", "highLowerFreq"],
  dspPercent: 4.8,
  bands: ["High", "Low"],
};

/** Read from Lukas's config only; the invert indexes are guessed by analogy with the 2-way. */
export const crossover3: ModuleDef = {
  blockType: 0x0610,
  name: "3-way Crossover",
  role: "crossover",
  evidence: "sample",
  params: [
    ...filter(3, "lowUpper", "Low band upper"),
    ...filter(7, "midLower", "Mid band lower"),
    ...filter(11, "midUpper", "Mid band upper"),
    ...filter(15, "highLower", "High band lower"),
  ],
  compact: ["lowUpperFreq", "midLowerFreq", "midUpperFreq", "highLowerFreq"],
  dspPercent: 8.3,
  bands: ["High", "Mid", "Low"],
};
