import type { ParamInfo, Values } from '@rackline/api';
import { ToggleButton } from '@rackline/ui-kit';
import { useCoreClient } from '../app/core-context.js';
import { valueOf } from '../racks.js';

/**
 * Polarity of a band's outputs, shown in its Level module. One button for
 * all outputs while they agree; one per output (named "Ø 5", "Ø 6") when
 * they differ, so nothing is flipped by surprise.
 */
export function OutputPolarity({ param, outputIds, names, values, owner }: {
  param: ParamInfo;
  outputIds: readonly number[];
  names: readonly string[];
  values: Values;
  owner: string;
}) {
  const client = useCoreClient();
  const states = outputIds.map((id) => valueOf(values, id, param.key) === true);
  const agree = states.every((s) => s === states[0]);
  const set = (ids: readonly number[], on: boolean) => client.setParams(ids.map((blockId) => ({ blockId, key: param.key, value: on })));
  return (
    <div className="rl-cell">
      <span className="rl-label">Polarity</span>
      <div className="app-row">
        {agree ? (
          <ToggleButton square pressed={states[0] ?? false} onChange={(on) => set(outputIds, on)} aria-label={`${owner} invert polarity`}>
            Ø
          </ToggleButton>
        ) : (
          outputIds.map((id, i) => {
            const name = (names[i] ?? '').replace(/^Out /, '');
            return (
              <ToggleButton key={id} pressed={states[i] ?? false} onChange={(on) => set([id], on)} aria-label={`${owner} ${names[i] ?? ''} invert polarity`}>
                Ø {name}
              </ToggleButton>
            );
          })
        )}
      </div>
    </div>
  );
}
