import { useState } from "react";
import {
  ConfirmButton,
  EqCurve,
  Knob,
  ModuleCard,
  Select,
  ToggleButton,
} from "@rackline/ui-kit";
import type { EqCurveLine } from "@rackline/ui-kit";
import {
  peqBands,
  peqFilter,
  peqFilters,
  peqHasGain,
  readPeqBand,
} from "../curves.js";
import { formatParam, numberScale } from "../params.js";
import type { NumberParam } from "../params.js";
import { ChannelsBadge } from "./ChannelsBadge.js";
import { EXPANDED_CURVE_H } from "./CrossoverModule.js";
import type { ModuleViewProps } from "./GenericModule.js";
import { useLinkedModule } from "./linked.js";

/** Parametric EQ: compact curve in the chain, curve with draggable bands when expanded. */
export function PeqModule({
  initiallyOpen,
  module,
  blockIds,
  values,
  rackName,
  channelNames,
  title = "PEQ",
}: ModuleViewProps) {
  const [open, setOpen] = useState(initiallyOpen ?? false);
  const [selected, setSelected] = useState(1);
  const numbers = peqBands(module);
  const linked = useLinkedModule(
    values,
    blockIds,
    module.params.map((p) => p.key),
    channelNames,
  );
  const bands = numbers.map((n) => readPeqBand(module, linked.value, n));
  const band = bands.find((b) => b.band === selected) ?? bands[0];
  const owner = `${rackName} ${title}`;
  const param = (key: string) => module.params.find((p) => p.key === key);
  const numberParam = (key: string) => {
    const p = param(key);
    return p?.kind === "number" ? p : undefined;
  };

  const lines: EqCurveLine[] = [
    ...(band?.on
      ? [
          {
            id: "band",
            filters: [peqFilter(band)].flatMap((f) => f ?? []),
            color: "var(--rl-warn)",
            secondary: true,
          },
        ]
      : []),
    { id: "total", filters: peqFilters(bands), fill: true },
  ];

  const knob = (
    key: string,
    label: string,
    p: NumberParam | undefined,
    disabled = false,
  ) =>
    p && (
      <Knob
        size={44}
        label={label}
        value={
          typeof linked.value(key) === "number"
            ? (linked.value(key) as number)
            : p.min
        }
        onChange={(v) => linked.set({ [key]: v })}
        format={(v) => formatParam(p, v)}
        scale={numberScale(p)}
        defaultValue={p.unit === "dB" ? 0 : p.unit === "oct" ? 1 : 1000}
        bipolar={p.unit === "dB"}
        disabled={disabled}
      />
    );

  const typeParam = band && param(`band${band.band}Type`);

  return (
    <ModuleCard
      name={title}
      badge={linked.stereo ? <ChannelsBadge linked={linked} /> : undefined}
      expanded={open}
      onExpandedChange={setOpen}
      wide
      summary={
        <div className="app-mini-curve">
          <EqCurve
            compact
            label={`${owner} response`}
            lines={[{ id: "total", filters: peqFilters(bands), fill: true }]}
          />
        </div>
      }
    >
      <div className="app-peq">
        <div className="app-peq-graph">
          <EqCurve
            height={EXPANDED_CURVE_H}
            label={`${owner} response`}
            lines={lines}
            handles={bands.map((b) => ({
              id: String(b.band),
              freq: b.freq,
              gainDb: peqHasGain(b.typeLabel) ? b.gainDb : 0,
              label: String(b.band),
              name: `Filter ${b.band}`,
              off: !b.on,
            }))}
            selectedId={band ? String(band.band) : undefined}
            onSelect={(id) => setSelected(Number(id))}
            onMove={(id, m) => {
              const b = bands.find((x) => x.band === Number(id));
              linked.set(
                b && peqHasGain(b.typeLabel)
                  ? { [`band${id}Freq`]: m.freq, [`band${id}Gain`]: m.gainDb }
                  : { [`band${id}Freq`]: m.freq },
              );
            }}
          />
          <div className="app-peq-strip">
            <div
              className="app-row"
              role="group"
              aria-label={`${owner} filters on or off`}
            >
              {bands.map((b) => (
                <ToggleButton
                  key={b.band}
                  square
                  pressed={b.on}
                  aria-label={`Filter ${b.band} on`}
                  data-selected={b.band === band?.band || undefined}
                  onChange={(on) => {
                    linked.set({ [`band${b.band}Enable`]: on });
                    setSelected(b.band);
                  }}
                >
                  {b.band}
                </ToggleButton>
              ))}
            </div>
            <ConfirmButton
              label="Flat"
              confirmLabel="Sure?"
              onConfirm={() =>
                linked.set(
                  Object.fromEntries(numbers.map((n) => [`band${n}Gain`, 0])),
                )
              }
            />
          </div>
        </div>
        {band && (
          <div className="app-peq-controls">
            {typeParam?.kind === "enum" && (
              <div className="rl-cell app-span">
                <span className="rl-label">Filter {band.band}</span>
                <Select
                  label={`${owner} filter ${band.band} type`}
                  options={typeParam.options}
                  value={
                    typeof linked.value(typeParam.key) === "number"
                      ? (linked.value(typeParam.key) as number)
                      : 0
                  }
                  onChange={(v) => linked.set({ [typeParam.key]: v })}
                />
              </div>
            )}
            {knob(
              `band${band.band}Freq`,
              "Freq",
              numberParam(`band${band.band}Freq`),
            )}
            {knob(
              `band${band.band}Gain`,
              "Gain",
              numberParam(`band${band.band}Gain`),
              !peqHasGain(band.typeLabel),
            )}
            {knob(
              `band${band.band}Width`,
              "Width",
              numberParam(`band${band.band}Width`),
              band.typeLabel !== "Band",
            )}
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
