import { FBS_MAX_ATTENUATION, levelRange, PEQ_BANDWIDTH } from "../units.js";
import { bool, choice, num, steps } from "./params.js";
import { filterParams } from "./peq.js";
import type { ModuleDef } from "./types.js";

/** Release rate table (dB/s), raw 0 … 15 (Drag Net's display, simulator). */
const RELEASE_DB_S = [
  0, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 1.5, 2, 3, 5, 10,
];
/** Filter timeout in hours, raw 0 … 15; the table may go further (only 0 … 15 sampled). */
const TIMEOUT_H = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5, 6, 7,
];

/**
 * 15-band feedback suppressor. Indexes from Drag Net's report (simulator,
 * raw 0 … 15 only). The filters (index 31 on, PEQ layout) are written by the
 * device's auto setup; they are exposed so the UI can show them. Target gain
 * (18), gain margin (19) and last changed filter (15) are status values and
 * not exposed. Ranges of max attenuation and threshold are unverified.
 */
export const feedbackSuppressor: ModuleDef = {
  blockType: 0x0a01,
  name: "Feedback Suppressor (15)",
  role: "processing",
  evidence: "simulator",
  params: [
    choice(2, "mode", "Mode", {
      0: "Speech (more sensitive)",
      1: "Music (less sensitive)",
    }),
    bool(3, "dynamicLevel", "Dynamic level"),
    steps(4, "releaseRate", "Release rate", "dB/s", RELEASE_DB_S),
    num(5, "maxAttenuation", "Max attenuation", FBS_MAX_ATTENUATION),
    num(6, "newFilterWidth", "New filter bandwidth", PEQ_BANDWIDTH),
    bool(7, "cycleClear", "Cycle clear"),
    bool(8, "timeoutClear", "Timeout clear"),
    steps(9, "timeout", "Timeout", "h", TIMEOUT_H),
    // Help: built-in limiter −60 … 0 dBFS.
    num(11, "threshold", "Threshold", levelRange(-60, 0, "dBFS")),
    bool(12, "freeze", "Freeze filters"),
    ...Array.from({ length: 15 }, (_, k) => filterParams(k + 1, 29)).flat(),
  ],
  compact: ["mode", "freeze"],
  // Not measured.
  dspPercent: 10,
};
