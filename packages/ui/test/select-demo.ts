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

const INPUT_SELECT = [901, 902];
const OUTPUT_SELECT = [903, 904];

/**
 * PSX_RCF_FINAL with two Select 1 of 2 pairs, the layout Lukas would add in
 * Drag Net (his file has none yet): one at the start of the ANALOG rack
 * picking analog 1/2 or digital A/B, and one in front of outputs 5/6 picking
 * MF\HF or LF, so Out 5+6 becomes its own rack.
 */
export function withSelects(state: AppState): AppState {
  const setup = state.setup;
  if (!setup) return state;
  const mfhf = setup.racks.find((r) => r.name === 'MF\\HF');
  const lf = setup.racks.find((r) => r.name === 'LF');
  if (!mfhf || !lf) return state;
  const outRack = {
    id: 'rack-903',
    name: 'Out 5+6',
    channels: OUTPUT_SELECT.map((mixerId, channel) => ({
      sources: [
        { kind: 'rack' as const, rackId: mfhf.id, channel },
        { kind: 'rack' as const, rackId: lf.id, channel },
      ],
      mixerId,
      mixerInputs: [0, 1],
      outputIds: mfhf.channels[channel]?.outputIds ?? [],
    })),
    modules: [],
  };
  const blocks = [...INPUT_SELECT.map((id, i) => ['INPUT SELECT', id, i] as const), ...OUTPUT_SELECT.map((id, i) => ['OUT 5/6 SELECT', id, i] as const)];
  return {
    ...state,
    setup: {
      ...setup,
      blocks: [...setup.blocks, ...blocks.map(([name, id, i]) => ({ id, blockType: SELECT_2.blockType, name: `${name} ${i === 0 ? 'L' : 'R'}`, channel: 0 }))],
      modules: [...setup.modules, SELECT_2],
      racks: [...setup.racks, outRack].map((r) =>
        r.id === mfhf.id ? { ...r, channels: r.channels.map((c) => ({ ...c, outputIds: [] })) } : r,
      ).map((r) =>
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
                mixerId: INPUT_SELECT[i] ?? 0,
                mixerInputs: [0, 1],
              })),
            },
      ),
    },
    values: { ...state.values, ...Object.fromEntries([...INPUT_SELECT, ...OUTPUT_SELECT].map((id) => [String(id), { input: 0 }])) },
  };
}
