import { INPUT_TRIM } from "../units.js";
import { levelMeter } from "../meters.js";
import { bool, num } from "./params.js";
import type { ModuleDef } from "./types.js";

/** AES3 input; A = left, B = right. */
export const digitalInput: ModuleDef = {
  blockType: 0x0103,
  name: "Digital Input",
  role: "input",
  evidence: "simulator",
  params: [num(2, "trim", "Trim", INPUT_TRIM), bool(3, "mute", "Mute")],
  compact: ["trim", "mute"],
  meters: [levelMeter(0x8000, "input", "AES3 in", "dBFS")],
  dspPercent: 0,
};
