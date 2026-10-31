import { ANC_RATIO, dbRange, seconds } from "../units.js";
import { bool, choice, num, steps } from "./params.js";
import type { ModuleDef } from "./types.js";

/**
 * Ambient noise compensator (inputs Program, Ambient sense mic): program
 * level follows the room noise. Indexes 8, 10 and 14..24 do not appear in
 * Drag Net's report (meters or internal state). Ranges are not in the help;
 * the gains and threshold keep the full span Drag Net shows.
 */
export const ambientNoiseCompensator: ModuleDef = {
  blockType: 0x0503,
  name: "Ambient Noise Compensator",
  role: "processing",
  evidence: "simulator",
  params: [
    num(2, "minGain", "Minimum gain", dbRange(-95, 31)),
    num(3, "maxGain", "Maximum gain", dbRange(-95, 31)),
    num(4, "gainIncreaseTime", "Gain increase time", seconds(0, 255)),
    num(5, "gainDecreaseTime", "Gain decrease time", seconds(0, 255)),
    num(6, "threshold", "Threshold (rms)", dbRange(-95, 31, "dBFS")),
    steps(7, "ratio", "Gain ratio", "ratio", ANC_RATIO),
    num(9, "acousticCoupling", "Acoustic coupling", dbRange(-96, 31)),
    choice(11, "mode", "Mode", { 0: "Paging", 1: "Continuous program" }),
    bool(12, "bypass", "Bypass"),
    bool(13, "programMute", "Program mute"),
    bool(25, "freeze", "Freeze gain"),
  ],
  compact: ["minGain", "maxGain", "bypass"],
  // Not measured.
  dspPercent: 4,
};
