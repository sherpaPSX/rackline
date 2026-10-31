import { useState } from 'react';
import { EqCurve, ModuleCard } from '@rackline/ui-kit';
import { peqBands, peqFilters, readPeqBand } from '../curves.js';
import { ChannelPicker } from './ChannelPicker.js';
import type { ModuleViewProps } from './GenericModule.js';
import { useLinkedModule } from './linked.js';
import { ParamControl } from './ParamControl.js';

const SHORT: Record<string, string> = {
  dynamicLevel: 'Dynamic',
  releaseRate: 'Release',
  maxAttenuation: 'Max cut',
  newFilterWidth: 'Width',
  cycleClear: 'Cycle clr',
  timeoutClear: 'Timeout clr',
  freeze: 'Freeze',
};

/**
 * Feedback suppressor: its notch filters are placed by the device, so they
 * are shown read-only on a curve; the settings are ordinary controls.
 */
export function FeedbackModule({ module, blockIds, values, rackName, channelNames, title = 'Feedback' }: ModuleViewProps) {
  const [open, setOpen] = useState(false);
  const linked = useLinkedModule(values, blockIds, module.params.map((p) => p.key), channelNames);
  const owner = `${rackName} ${title}`;
  const notches = peqBands(module).map((n) => readPeqBand(module, linked.value, n));
  const active = notches.filter((b) => b.on).length;
  const settings = module.params.filter((p) => !/^band\d+/.test(p.key));
  const control = (p: (typeof settings)[number]) => (
    <ParamControl key={p.key} param={p} owner={owner} label={SHORT[p.key]} value={linked.value(p.key)} onChange={(v) => linked.set({ [p.key]: v })} />
  );
  const curve = (compact: boolean) => (
    <EqCurve compact={compact} label={`${owner} notch filters`} lines={[{ id: 'notches', filters: peqFilters(notches), fill: true, color: 'var(--rl-warn)' }]} />
  );
  return (
    <ModuleCard
      name={title}
      badge={linked.stereo ? <ChannelPicker linked={linked} owner={owner} /> : undefined}
      expanded={open}
      onExpandedChange={setOpen}
      wide
      summary={
        <div className="app-stack">
          <div className="app-mini-curve">{curve(true)}</div>
          <span className="app-note">
            {active} of {notches.length} filters set
          </span>
          <div className="app-row">{settings.filter((p) => module.compact.includes(p.key)).map(control)}</div>
        </div>
      }
    >
      <div className="app-peq">
        <div className="app-peq-graph">
          {curve(false)}
          <span className="app-note">
            {active} of {notches.length} filters set by the device
          </span>
        </div>
        <div className="app-fbs-controls">{settings.map(control)}</div>
      </div>
    </ModuleCard>
  );
}
