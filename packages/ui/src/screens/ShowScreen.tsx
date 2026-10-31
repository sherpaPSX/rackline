import type { CSSProperties } from "react";
import type { Setup, Values } from "@rackline/api";
import { Fader, MuteButton, faderScale } from "@rackline/ui-kit";
import { useCoreClient } from "../app/core-context.js";
import { LiveMeters } from "../modules/LiveMeter.js";
import {
  anyMuted,
  bandStrips,
  inputStrips,
  moduleOf,
  valueOf,
} from "../racks.js";

interface StripProps {
  name: string;
  color: string;
  /** Blocks whose `trim` the fader sets and whose `mute` the button sets. */
  blockIds: readonly number[];
  setup: Setup;
  values: Values;
}

/** Fader, meter and mute of one input pair or band. The fader is the blocks' trim, linked across channels. */
function Strip({ name, color, blockIds, setup, values }: StripProps) {
  const client = useCoreClient();
  const module = moduleOf(setup, blockIds[0] ?? -1);
  const trim = module?.params.find((p) => p.key === "trim");
  const meter = module?.meters[0];
  if (trim?.kind !== "number") return null;
  const current = valueOf(values, blockIds[0] ?? -1, "trim");
  const scale = faderScale({
    minDb: trim.min,
    maxDb: trim.max,
    unityPosition: 0.7,
  });
  const setAll = (key: string, value: number | boolean) =>
    client.setParams(blockIds.map((blockId) => ({ blockId, key, value })));
  return (
    <div
      className="app-strip"
      style={{ "--app-strip": color } as CSSProperties}
    >
      <span className="app-strip-name" title={name}>
        {name}
      </span>
      <Fader
        label={`${name} level`}
        valueDb={typeof current === "number" ? current : 0}
        onChange={(db) => setAll("trim", db)}
        scale={scale}
        color={color}
        touch
        meter={meter && <LiveMeters meter={meter} blockIds={blockIds} />}
      />
      <MuteButton
        muted={anyMuted(values, blockIds)}
        onChange={(m) => setAll("mute", m)}
        target={name}
        touch
      />
    </div>
  );
}

/** Show: one fader and mute per input and band, the system EQ. */
export function ShowScreen({
  setup,
  values,
}: {
  setup: Setup;
  values: Values;
}) {
  return (
    <div className="app-screen">
      <section className="app-panel" aria-label="Levels">
        <div className="app-strips">
          {inputStrips(setup).map((s) => (
            <Strip
              key={s.name}
              name={s.name}
              color="var(--rl-dim)"
              blockIds={s.blockIds}
              setup={setup}
              values={values}
            />
          ))}
          <div className="app-strip-gap" aria-hidden="true" />
          {bandStrips(setup).map((b) => (
            <Strip
              key={b.rackId}
              name={b.name}
              color={b.color}
              blockIds={b.outputIds}
              setup={setup}
              values={values}
            />
          ))}
        </div>
      </section>
      <section className="app-panel" aria-label="System EQ">
        <h2 className="app-h2">System EQ</h2>
        <p className="app-note">
          This setup has no system EQ. It is a fixed-frequency PEQ in the System
          rack, added once the layout can be edited.
        </p>
      </section>
    </div>
  );
}
