import { dbRange, LEVEL, MIX_INPUT_LEVEL, seconds } from "../units.js";
import { bool, choice, num, range, steps } from "./params.js";
import type { ModuleDef, ParamDef } from "./types.js";

/** Priority 1 … 8 is stored as raw 2 … 9 (Drag Net shows raw − 1). */
const PRIORITY = Object.fromEntries(range(1, 8).map((p) => [p + 1, String(p)]));
/** Gate depth: raw 0 = Off, else dB = raw − 96 (−95 … 0 dB). */
const GATE_DEPTH_DB = [-Infinity, ...range(-95, 0)];

/**
 * Auto Mixer / Ducker with `inputs` × `outputs`. Indexes (simulator, 4 × 4):
 * 2 … outputs + 1 slider view flags (not exposed); crosspoints output-major
 * from outputs + 2 (level, assign); per input 7 slots: detect threshold,
 * hold-off, priority, duck depth, ramp-back, detect mode, one unnamed; per
 * output level and mute; view flags; NOM mode; gate depth per input.
 *
 * Detect mode (forced on / last on in the help) shows "Forced" for every raw
 * 0 … 63, so its coding is unknown and it is not exposed. Ranges from the
 * help; hold-off and ramp-back are seconds = raw with no known limit
 * (sampled 0 … 63); the crosspoint level range is guessed from the matrix.
 */
export function autoMixer(
  inputs: number,
  outputs: number,
  blockType: number,
): ModuleDef {
  const crosspointsAt = outputs + 2;
  const inputsAt = crosspointsAt + 2 * inputs * outputs;
  const outputsAt = inputsAt + 7 * inputs;
  const flagsAt = outputsAt + 2 * outputs;
  const crosspoints = range(1, outputs).flatMap((o) =>
    range(1, inputs).flatMap((i) => {
      const at = crosspointsAt + 2 * (inputs * (o - 1) + (i - 1));
      return [
        num(
          at,
          `out${o}In${i}Level`,
          `Out ${o} ← In ${i} level`,
          MIX_INPUT_LEVEL,
        ),
        bool(at + 1, `out${o}In${i}Assign`, `Out ${o} ← In ${i} assigned`),
      ];
    }),
  );
  const input = (k: number): ParamDef[] => {
    const at = inputsAt + 7 * (k - 1);
    return [
      num(
        at,
        `input${k}Threshold`,
        `Input ${k} detect threshold`,
        dbRange(-70, -12, "dBFS"),
      ),
      num(at + 1, `input${k}HoldOff`, `Input ${k} hold-off`, seconds(0, 63)),
      choice(at + 2, `input${k}Priority`, `Input ${k} priority`, PRIORITY),
      num(
        at + 3,
        `input${k}DuckDepth`,
        `Input ${k} duck depth`,
        dbRange(-80, 0),
      ),
      num(at + 4, `input${k}RampBack`, `Input ${k} ramp-back`, seconds(0, 63)),
      steps(
        flagsAt + 3 + (k - 1),
        `input${k}GateDepth`,
        `Input ${k} gate depth`,
        "dB",
        GATE_DEPTH_DB,
      ),
    ];
  };
  const output = (k: number): ParamDef[] => {
    const at = outputsAt + 2 * (k - 1);
    return [
      num(at, `output${k}Level`, `Output ${k} level`, LEVEL),
      bool(at + 1, `output${k}Mute`, `Output ${k} mute`),
    ];
  };
  return {
    blockType,
    name: `Auto Mixer / Ducker ${inputs} × ${outputs}`,
    role: "mixer",
    evidence: "simulator",
    params: [
      ...crosspoints,
      ...range(1, inputs).flatMap(input),
      ...range(1, outputs).flatMap(output),
      bool(flagsAt + 2, "nomMode", "NOM mode"),
    ],
    compact: ["output1Level"],
    // Not measured.
    dspPercent: 6,
  };
}

/** The only size with a known block type (Drag Net palette default). */
export const autoMixer4x4 = autoMixer(4, 4, 0x0b0c);
