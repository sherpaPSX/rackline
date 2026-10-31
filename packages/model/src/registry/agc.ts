import { AGC_HOLD_S, AGC_RATIO, dbRange, rate } from "../units.js";
import { bool, num, steps } from "./params.js";
import type { ModuleDef } from "./types.js";

/**
 * Automatic gain control (inputs In, S-C). Ranges from the Drag Net help.
 * The help also lists maximum and minimum gain (−36 … +24 dB), which Drag
 * Net's report does not show at any index; not mapped. Gain hold: Drag Net
 * shows "0 s" for raw 0..30 and "Infinite" from 31, so seconds = raw is
 * taken from the help's 0 … 30 s range (guessed).
 */
export const agc: ModuleDef = {
  blockType: 0x0502,
  name: "AGC",
  role: "processing",
  evidence: "simulator",
  params: [
    bool(2, "bypass", "Bypass"),
    num(3, "target", "Target", dbRange(-50, -5, "dBFS")),
    num(4, "threshold", "Threshold (rel. to target)", dbRange(-30, 0)),
    num(5, "ratio", "Ratio", AGC_RATIO),
    num(6, "gainIncrease", "Gain increase", rate(1, 30)),
    num(7, "gainDecrease", "Gain decrease", rate(1, 30)),
    steps(8, "hold", "Gain hold", "s", AGC_HOLD_S),
    num(9, "gainNormalize", "Gain normalize", rate(0, 30)),
  ],
  compact: ["target", "bypass"],
  // Not measured.
  dspPercent: 3,
};
