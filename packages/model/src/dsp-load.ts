import type { ConfigBlock } from '@rackline/protocol';
import { findModule, peqFilterCount, PEQ_MAX_FILTERS } from './registry/index.js';

/** RPM 26z resource limits (docs/dsp-limits.md). */
export const RPM26Z_LIMITS = { dspPercent: 100, delayBlocks: 10, peqFilters: PEQ_MAX_FILTERS } as const;

export interface DspLoadEstimate {
  /**
   * Sum of the measured per-module costs. Only the Drag Net compiler knows the
   * exact figure: on Lukas's config the estimate is 91 % against 97 %
   * measured, so show it with a margin.
   */
  dspPercent: number;
  delayBlocks: number;
  /** Largest PEQ in the configuration (filters cannot be added live). */
  maxPeqFilters: number;
  /** Blocks of unknown type; their cost is missing from the estimate. */
  unknownBlocks: ConfigBlock[];
}

export function estimateDspLoad(blocks: readonly ConfigBlock[]): DspLoadEstimate {
  const estimate: DspLoadEstimate = { dspPercent: 0, delayBlocks: 0, maxPeqFilters: 0, unknownBlocks: [] };
  for (const block of blocks) {
    const module = findModule(block.blockType);
    if (module === undefined) {
      estimate.unknownBlocks.push(block);
      continue;
    }
    estimate.dspPercent += module.dspPercent;
    estimate.delayBlocks += module.delayBlocks ?? 0;
    estimate.maxPeqFilters = Math.max(estimate.maxPeqFilters, peqFilterCount(block.blockType) ?? 0);
  }
  return estimate;
}
