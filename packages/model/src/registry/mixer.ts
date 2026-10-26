import { LEVEL, MATRIX_INPUT_LEVEL, MIX_INPUT_LEVEL } from '../units.js';
import { bool, choice, level, num, range } from './params.js';
import type { ModuleDef, ParamDef } from './types.js';

/** Mix and Select come in 2 to 10 inputs; the size is fixed at compile time. */
export const MIX_MAX_INPUTS = 10;
/** Mix and Select sizes whose block type and layout were sampled with the simulator. */
export const SAMPLED_SIZES = [2, 3, 10];

/**
 * Mix N × 1: block type 0x0200 + N − 2. Input k uses indexes 2k (level) and
 * 2k + 1 (mute), the output follows at 2N + 2 and 2N + 3. Simulator-verified
 * for N = 2, 3 and 10; the other sizes follow the same pattern.
 */
export function mix(inputs: number): ModuleDef {
  return {
    blockType: 0x0200 + inputs - 2,
    name: `Mix ${inputs} × 1`,
    role: 'mixer',
    evidence: SAMPLED_SIZES.includes(inputs) ? 'simulator' : 'guessed',
    params: [
      ...range(1, inputs).flatMap((k) => [
        num(2 * k, `input${k}Level`, `Input ${k} level`, MIX_INPUT_LEVEL),
        bool(2 * k + 1, `input${k}Mute`, `Input ${k} mute`),
      ]),
      level(2 * inputs + 2, 'outputLevel', 'Output level'),
      bool(2 * inputs + 3, 'outputMute', 'Output mute'),
    ],
    compact: ['input1Level', 'input2Level', 'outputLevel'],
    // Measured for 2 inputs only.
    dspPercent: 0.25 * inputs,
  };
}

/**
 * Select 1 of N: block type 0x0210 + N − 2, one parameter (index 2) holding
 * the selected input − 1. Simulator-verified for N = 2, 3 and 10.
 */
export function select(inputs: number): ModuleDef {
  return {
    blockType: 0x0210 + inputs - 2,
    name: `Select 1 of ${inputs}`,
    role: 'mixer',
    evidence: SAMPLED_SIZES.includes(inputs) ? 'simulator' : 'guessed',
    params: [choice(2, 'input', 'Input', Object.fromEntries(range(1, inputs).map((k) => [k - 1, `Input ${k}`])))],
    compact: ['input'],
    // Not measured.
    dspPercent: 0.2,
  };
}

/**
 * Square matrix mixer sizes with a known block type. Drag Net's palette
 * gives 2 × 2 (0x0801), a template 6 × 6 (0x0817); other sizes are unknown.
 */
export const MATRIX_BLOCK_TYPES: Readonly<Record<number, number>> = { 2: 0x0801, 6: 0x0817 };

/**
 * Matrix mixer N × N. Indexes: 2 … N + 2 are Drag Net's slider view flags
 * (not exposed), then the crosspoints output-major (level, mute), then per
 * input and per output level, solo, mute, invert, then view flags and
 * auto-cancel. Simulator-verified for 2 × 2 and 6 × 6.
 */
export function matrix(size: number, blockType: number): ModuleDef {
  const io = range(1, size);
  const crosspoints = io.flatMap((o) =>
    io.flatMap((i) => {
      const at = size + 3 + 2 * (size * (o - 1) + (i - 1));
      return [
        num(at, `out${o}In${i}Level`, `Out ${o} ← In ${i} level`, MIX_INPUT_LEVEL),
        bool(at + 1, `out${o}In${i}Mute`, `Out ${o} ← In ${i} mute`),
      ];
    }),
  );
  const inputsAt = size + 3 + 2 * size * size;
  const outputsAt = inputsAt + 4 * size;
  const strip = (side: 'input' | 'output', k: number): ParamDef[] => {
    const at = (side === 'input' ? inputsAt : outputsAt) + 4 * (k - 1);
    const name = `${side === 'input' ? 'Input' : 'Output'} ${k}`;
    return [
      num(at, `${side}${k}Level`, `${name} level`, side === 'input' ? MATRIX_INPUT_LEVEL : LEVEL),
      bool(at + 1, `${side}${k}Solo`, `${name} solo`),
      bool(at + 2, `${side}${k}Mute`, `${name} mute`),
      bool(at + 3, `${side}${k}Invert`, `${name} invert`),
    ];
  };
  return {
    blockType,
    name: `Matrix Mix ${size} × ${size}`,
    role: 'mixer',
    evidence: 'simulator',
    params: [
      ...crosspoints,
      ...io.flatMap((k) => strip('input', k)),
      ...io.flatMap((k) => strip('output', k)),
      bool(outputsAt + 4 * size + 2, 'autoCancel', 'Auto-cancel solo'),
    ],
    compact: ['output1Level', 'output2Level'],
    // Not measured.
    dspPercent: 0.25 * size * size,
  };
}

export const MIXERS: readonly ModuleDef[] = [
  ...range(2, MIX_MAX_INPUTS).map(mix),
  ...range(2, MIX_MAX_INPUTS).map(select),
  ...Object.entries(MATRIX_BLOCK_TYPES).map(([size, type]) => matrix(Number(size), type)),
];
