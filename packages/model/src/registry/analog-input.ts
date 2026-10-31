import { INPUT_TRIM, USER_GAIN } from "../units.js";
import { levelMeter } from "../meters.js";
import { bool, choice, num } from "./params.js";
import type { ModuleDef } from "./types.js";

export const analogInput: ModuleDef = {
  blockType: 0x0105,
  name: "Analog Input",
  role: "input",
  evidence: "simulator",
  params: [
    choice(2, "sensitivity", "Sensitivity", {
      0: "Pro (0 dB)",
      1: "Consumer (+12 dB)",
      2: "User",
    }),
    num(3, "userTrim", "User gain", USER_GAIN),
    num(4, "trim", "Trim", INPUT_TRIM),
    bool(5, "mute", "Mute"),
  ],
  compact: ["trim", "mute"],
  // The converter level first: the UI shows the first meter where there is room for one.
  meters: [
    levelMeter(0x8001, "adc", "After A/D", "dBFS"),
    levelMeter(0x8000, "analog", "Analog in", "dBu"),
  ],
  dspPercent: 0,
};
