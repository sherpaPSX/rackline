import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ParamInfo } from '@rackline/api';
import { ModuleCard, ToggleButton } from '@rackline/ui-kit';
import { ChannelPicker } from './ChannelPicker.js';
import type { ModuleViewProps } from './GenericModule.js';
import { useLinkedModule } from './linked.js';
import { ParamField } from './ParamControl.js';

/** Inputs × outputs of a matrix-like module, from its crosspoint keys (`out2In3Level`). */
export function gridSize(params: readonly ParamInfo[]): { inputs: number; outputs: number } {
  let inputs = 0;
  let outputs = 0;
  for (const p of params) {
    const m = /^out(\d+)In(\d+)Level$/.exec(p.key);
    if (m) {
      outputs = Math.max(outputs, Number(m[1]));
      inputs = Math.max(inputs, Number(m[2]));
    }
  }
  return { inputs, outputs };
}

const range = (n: number) => Array.from({ length: n }, (_, k) => k + 1);

/** Per-input settings of the auto mixer, as table columns. */
const AUTOMIX_INPUT = [
  ['Threshold', 'Threshold'],
  ['HoldOff', 'Hold-off'],
  ['Priority', 'Priority'],
  ['DuckDepth', 'Duck depth'],
  ['RampBack', 'Ramp-back'],
  ['GateDepth', 'Gate depth'],
] as const;

/**
 * Matrix mixer and auto mixer: outputs as rows, inputs as columns, one cell
 * per crosspoint (on/off + level). Compact form is a dot grid of which
 * crosspoints are on, so the routing reads at a glance.
 */
export function GridModule({ initiallyOpen, module, blockIds, values, rackName, channelNames, title = module.name }: ModuleViewProps) {
  const [open, setOpen] = useState(initiallyOpen ?? false);
  const linked = useLinkedModule(values, blockIds, module.params.map((p) => p.key), channelNames);
  const owner = `${rackName} ${title}`;
  const { inputs, outputs } = gridSize(module.params);
  const automix = module.params.some((p) => p.key.endsWith('Assign'));
  const param = (key: string) => module.params.find((p) => p.key === key);
  const field = (key: string, disabled = false) => {
    const p = param(key);
    return p ? <ParamField param={p} value={linked.value(key)} onChange={(v) => linked.set({ [key]: v })} owner={owner} disabled={disabled} /> : <span />;
  };
  // Matrix stores a mute per crosspoint, the auto mixer an "assigned" flag: both show as On.
  const onKey = (o: number, i: number) => `out${o}In${i}${automix ? 'Assign' : 'Mute'}`;
  const isOn = (o: number, i: number) => (automix ? linked.value(onKey(o, i)) === true : linked.value(onKey(o, i)) !== true);
  const setOn = (o: number, i: number, on: boolean) => linked.set({ [onKey(o, i)]: automix ? on : !on });

  const outCols = automix ? ['Level', ''] : ['Level', '', ''];
  const grid = { '--app-cols': inputs + outCols.length } as CSSProperties;
  const head = (text: string, key: string): ReactNode => (
    <span key={key} className="rl-label app-grid-head">
      {text}
    </span>
  );

  return (
    <ModuleCard
      name={title}
      badge={linked.stereo ? <ChannelPicker linked={linked} owner={owner} /> : undefined}
      expanded={open}
      onExpandedChange={setOpen}
      wide
      summary={
        <div className="app-dots" style={{ '--app-cols': inputs } as CSSProperties} role="img" aria-label={`${owner} routing`}>
          {range(outputs).flatMap((o) => range(inputs).map((i) => <i key={`${o}-${i}`} data-on={isOn(o, i) || undefined} />))}
        </div>
      }
    >
      <div className="app-grid-wrap">
        <div className="app-grid" style={grid} role="group" aria-label={`${owner} crosspoints`}>
          {head('', 'corner')}
          {range(inputs).map((i) => head(`In ${i}`, `in${i}`))}
          {outCols.map((c, k) => head(c, `oc${k}`))}
          {range(outputs).map((o) => [
            head(`Out ${o}`, `out${o}`),
            ...range(inputs).map((i) => (
              <div key={`x${o}-${i}`} className="app-xp" data-off={!isOn(o, i) || undefined}>
                <ToggleButton square pressed={isOn(o, i)} onChange={(on) => setOn(o, i, on)} aria-label={`${owner} Out ${o} from In ${i} on`}>
                  {isOn(o, i) ? '●' : ''}
                </ToggleButton>
                {field(`out${o}In${i}Level`, !isOn(o, i))}
              </div>
            )),
            <div key={`ol${o}`}>{field(`output${o}Level`)}</div>,
            <div key={`om${o}`}>{field(`output${o}Mute`)}</div>,
            ...(automix ? [] : [<div key={`oi${o}`}>{field(`output${o}Invert`)}</div>]),
          ])}
          {!automix && [
            head('In level', 'il'),
            ...range(inputs).map((i) => <div key={`il${i}`}>{field(`input${i}Level`)}</div>),
            ...outCols.map((_, k) => <span key={`ilx${k}`} />),
            head('', 'im'),
            ...range(inputs).map((i) => (
              <div key={`im${i}`} className="app-row">
                {field(`input${i}Mute`)}
                {field(`input${i}Invert`)}
              </div>
            )),
          ]}
        </div>
        {automix && (
          <div className="app-grid" style={{ '--app-cols': AUTOMIX_INPUT.length } as CSSProperties} role="group" aria-label={`${owner} inputs`}>
            {head('', 'corner')}
            {AUTOMIX_INPUT.map(([, label]) => head(label, label))}
            {range(inputs).map((i) => [head(`In ${i}`, `row${i}`), ...AUTOMIX_INPUT.map(([key]) => <div key={`${key}${i}`}>{field(`input${i}${key}`)}</div>)])}
          </div>
        )}
        {automix && (
          <div className="app-row">
            <span className="rl-label">NOM</span>
            {field('nomMode')}
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
