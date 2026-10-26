import type { AppState, ModuleInfo } from '@rackline/api';

const SELECT_2: ModuleInfo = {
  blockType: 0x0210,
  name: 'Select 1 of 2',
  role: 'mixer',
  evidence: 'simulator',
  params: [
    {
      key: 'input',
      label: 'Input',
      kind: 'enum',
      options: [
        { value: 0, label: 'Input 1' },
        { value: 1, label: 'Input 2' },
      ],
    },
  ],
  compact: ['input'],
};

/**
 * PSX_RCF_FINAL with a Select 1 of 2 per channel at the start of the ANALOG
 * rack, picking analog 1/2 or digital A/B. Lukas's file has no Select yet;
 * this is the layout he would add in Drag Net.
 */
export function withInputSelect(state: AppState): AppState {
  const setup = state.setup;
  if (!setup) return state;
  const ids = [901, 902];
  return {
    ...state,
    setup: {
      ...setup,
      blocks: [...setup.blocks, ...ids.map((id, i) => ({ id, blockType: SELECT_2.blockType, name: `INPUT SELECT ${i === 0 ? 'L' : 'R'}`, channel: 0 }))],
      modules: [...setup.modules, SELECT_2],
      racks: setup.racks.map((r) =>
        r.name !== 'ANALOG'
          ? r
          : {
              ...r,
              channels: r.channels.map((c, i) => ({
                ...c,
                sources: [
                  { kind: 'input' as const, blockId: i === 0 ? 1 : 2 },
                  { kind: 'input' as const, blockId: i === 0 ? 9 : 10 },
                ],
                mixerId: ids[i] ?? 0,
                mixerInputs: [0, 1],
              })),
            },
      ),
    },
    values: { ...state.values, ...Object.fromEntries(ids.map((id) => [String(id), { input: 0 }])) },
  };
}
