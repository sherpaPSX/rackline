import type { ParamValue, Values } from "@rackline/api";
import { channelsAgree, valueOf } from "../racks.js";
import { useCoreClient } from "../app/core-context.js";

export interface LinkedModule {
  /** Blocks of the module, one per channel. */
  blockIds: readonly number[];
  stereo: boolean;
  /** Physical names of the channels, e.g. ["In 1", "In 2"]. */
  names: readonly string[];
  /** The channels hold different values for some of the keys. */
  differ: boolean;
  /** The block whose values the controls show: the first channel. */
  shownId: number;
  value: (key: string) => ParamValue | undefined;
  /** Set values on every channel, as one undo step. */
  set: (patch: Readonly<Record<string, ParamValue>>) => void;
}

/**
 * A module edits all the blocks it is given at once. A linked stereo rack
 * passes both channels; an unlinked rack draws one module per channel
 * (see SystemScreen), so there is no per-module channel choice.
 */
export function useLinkedModule(
  values: Values,
  blockIds: readonly number[],
  keys: readonly string[],
  names: readonly string[] = ["L", "R"],
): LinkedModule {
  const client = useCoreClient();
  const stereo = blockIds.length > 1;
  const shownId = blockIds[0] ?? 0;
  return {
    blockIds,
    stereo,
    names,
    differ: stereo && !channelsAgree(values, blockIds, keys),
    shownId,
    value: (key) => valueOf(values, shownId, key),
    set: (patch) =>
      client.setParams(
        blockIds.flatMap((blockId) =>
          Object.entries(patch).map(([key, value]) => ({
            blockId,
            key,
            value,
          })),
        ),
      ),
  };
}
