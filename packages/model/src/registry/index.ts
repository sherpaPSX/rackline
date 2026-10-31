import { analogInput } from "./analog-input.js";
import { analogOutput } from "./analog-output.js";
import { crossover2, crossover3 } from "./crossover.js";
import { delay } from "./delay.js";
import { digitalInput } from "./digital-input.js";
import { agc } from "./agc.js";
import { autoMixer4x4 } from "./auto-mixer.js";
import { ambientNoiseCompensator } from "./ambient-noise.js";
import {
  compressor,
  limiter,
  monoSideChainCompressor,
  stereoSideChainCompressor,
} from "./dynamics.js";
import { feedbackSuppressor } from "./feedback.js";
import { generator } from "./generator.js";
import { graphicEq } from "./geq.js";
import { levelModule } from "./level.js";
import { meter } from "./meter.js";
import { MIXERS } from "./mixer.js";
import { peq, PEQ_MAX_FILTERS } from "./peq.js";
import type { ModuleDef } from "./types.js";

export type {
  Evidence,
  MeterDef,
  ModuleDef,
  ModuleRole,
  ParamDef,
  ParamKind,
} from "./types.js";
export { CROSSOVER_FILTER_TYPES } from "./crossover.js";
export { GEQ_BANDS_HZ } from "./geq.js";
export { PEQ_FILTER_TYPES, PEQ_MAX_FILTERS, peqFilterCount } from "./peq.js";

/** Every known RPM 26z block type. Adding a module type = adding it here. */
export const MODULES: readonly ModuleDef[] = [
  analogInput,
  digitalInput,
  analogOutput,
  levelModule,
  ...MIXERS,
  autoMixer4x4,
  meter,
  delay,
  compressor,
  limiter,
  monoSideChainCompressor,
  stereoSideChainCompressor,
  agc,
  ambientNoiseCompensator,
  ...Array.from({ length: PEQ_MAX_FILTERS }, (_, k) => peq(k + 1)),
  crossover2,
  crossover3,
  graphicEq,
  feedbackSuppressor,
  generator,
];

const byType = new Map(MODULES.map((m) => [m.blockType, m]));

export function findModule(blockType: number): ModuleDef | undefined {
  return byType.get(blockType);
}
