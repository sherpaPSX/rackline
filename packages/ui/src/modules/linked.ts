import { useState } from 'react';
import type { ParamValue, Values } from '@rackline/api';
import { channelsAgree, valueOf } from '../racks.js';
import { useCoreClient } from '../app/core-context.js';

/** Which channel of a stereo module the controls edit: both (linked), left or right. */
export type ChannelChoice = 'LR' | 'L' | 'R';

export interface LinkedModule {
  /** Blocks of the module, one per channel. */
  blockIds: readonly number[];
  stereo: boolean;
  choice: ChannelChoice;
  setChoice: (choice: ChannelChoice) => void;
  /** L and R hold different values for some of the keys. */
  differ: boolean;
  /** The block whose values the controls show. */
  shownId: number;
  value: (key: string) => ParamValue | undefined;
  /** Set values on the chosen channel(s), as one undo step. */
  set: (patch: Readonly<Record<string, ParamValue>>) => void;
}

/**
 * Stereo modules are edited once for both channels. When L and R already
 * differ (as in a saved setup), the controls start on L so nothing is
 * overwritten by surprise; the engineer links them deliberately.
 */
export function useLinkedModule(values: Values, blockIds: readonly number[], keys: readonly string[]): LinkedModule {
  const client = useCoreClient();
  const stereo = blockIds.length > 1;
  const differ = stereo && !channelsAgree(values, blockIds, keys);
  const [chosen, setChoice] = useState<ChannelChoice | null>(null);
  const choice: ChannelChoice = !stereo ? 'LR' : (chosen ?? (differ ? 'L' : 'LR'));
  const targets = choice === 'LR' ? blockIds : [blockIds[choice === 'L' ? 0 : 1] ?? blockIds[0] ?? 0];
  const shownId = targets[0] ?? 0;
  return {
    blockIds,
    stereo,
    choice,
    setChoice,
    differ,
    shownId,
    value: (key) => valueOf(values, shownId, key),
    set: (patch) =>
      client.setParams(targets.flatMap((blockId) => Object.entries(patch).map(([key, value]) => ({ blockId, key, value })))),
  };
}
