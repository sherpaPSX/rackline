import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ModuleInfo, Rack, Setup, Values } from "@rackline/api";
import { EqCurve, IconButton } from "@rackline/ui-kit";
import {
  crossoverBands,
  peqBands,
  peqFilters,
  readPeqBand,
} from "../curves.js";
import { CrossoverModule } from "../modules/CrossoverModule.js";
import { ModuleView } from "../modules/ModuleView.js";
import { formatParam } from "../params.js";
import {
  channelName,
  inputStrips,
  isOutputSelect,
  joinChannels,
  moduleOf,
  outputStrips,
  rackChannelNames,
  rackColor,
  sourceChoice,
  valueOf,
} from "../racks.js";

/**
 * System as a signal map (DriveRack style): each rack is a row of tiles read
 * left to right, a crossover is a tall tile and the racks it feeds stack to
 * its right, outputs end the rows. A tile shows its key values; clicking it
 * opens the module's editor in the panel below the map.
 */

type Selection =
  | { kind: "module"; rackId: string; index: number }
  | { kind: "mixer"; rackId: string }
  | { kind: "generator"; blockId: number }
  | { kind: "crossover"; rackId: string }
  | { kind: "io"; blockIds: number[]; name: string };

const selKey = (s: Selection): string =>
  s.kind === "module"
    ? `m:${s.rackId}:${s.index}`
    : s.kind === "io"
      ? `io:${s.blockIds.join("-")}`
      : s.kind === "generator"
        ? `g:${s.blockId}`
        : `${s.kind}:${s.rackId}`;

interface MapContext {
  setup: Setup;
  values: Values;
  selected: string | null;
  select: (s: Selection) => void;
}

/** Key values of a module as short text lines, e.g. ["−6.0 dB"] or ["4.00 ms"]. */
function summaryLines(
  module: ModuleInfo,
  values: Values,
  blockId: number,
): string[] {
  const keys =
    module.compact.length > 0
      ? module.compact
      : module.params.slice(0, 2).map((p) => p.key);
  return keys.flatMap((key) => {
    const p = module.params.find((x) => x.key === key);
    if (!p || p.kind === "bool" || p.kind === "flags") return [];
    return [formatParam(p, valueOf(values, blockId, key))];
  });
}

function anyFlag(
  values: Values,
  blockIds: readonly number[],
  key: string,
): boolean {
  return blockIds.some((id) => {
    const v = valueOf(values, id, key);
    return v === true || (typeof v === "object" && v.mute === true);
  });
}

function Tile({
  ctx,
  sel,
  name,
  width,
  muted,
  tall,
  color,
  children,
}: {
  ctx: MapContext;
  sel: Selection;
  name: string;
  width?: string | undefined;
  muted?: boolean | undefined;
  tall?: boolean | undefined;
  color?: string | undefined;
  children?: ReactNode;
}) {
  const key = selKey(sel);
  return (
    <button
      type="button"
      className="app-tile"
      data-selected={ctx.selected === key || undefined}
      data-tall={tall || undefined}
      data-muted={muted || undefined}
      style={{ "--app-tile-k": color } as CSSProperties}
      onClick={() => ctx.select(sel)}
      aria-pressed={ctx.selected === key}
    >
      <span className="app-tile-name">{name}</span>
      <span className="app-tile-body">{children}</span>
      {width && <span className="app-tile-width">{width}</span>}
    </button>
  );
}

function ModuleTile({
  ctx,
  rack,
  index,
}: {
  ctx: MapContext;
  rack: Rack;
  index: number;
}) {
  const m = rack.modules[index];
  const module =
    m && ctx.setup.modules.find((x) => x.blockType === m.blockType);
  const first = m?.blockIds[0];
  if (!m || !module || first === undefined) return null;
  const sel: Selection = { kind: "module", rackId: rack.id, index };
  const width =
    m.blockIds.length > 1
      ? joinChannels(rackChannelNames(ctx.setup, rack, ctx.values))
      : undefined;
  const bands = peqBands(module);
  const muted =
    anyFlag(ctx.values, m.blockIds, "mute") ||
    anyFlag(ctx.values, m.blockIds, "options");
  const short = module.name
    .replace(/^Parametric EQ.*/, "PEQ")
    .replace(/ \(\d+\)$/, "");
  return (
    <Tile ctx={ctx} sel={sel} name={short} width={width} muted={muted}>
      {bands.length > 0 ? (
        <EqCurve
          compact
          height={36}
          label={`${rack.name} ${short} response`}
          lines={[
            {
              id: "total",
              filters: peqFilters(
                bands.map((n) =>
                  readPeqBand(module, (k) => valueOf(ctx.values, first, k), n),
                ),
              ),
              fill: true,
            },
          ]}
        />
      ) : (
        summaryLines(module, ctx.values, first).map((t, i) => (
          <span key={i}>{t}</span>
        ))
      )}
    </Tile>
  );
}

/** One rack: its tiles, then either the racks it feeds (stacked) or its outputs. */
function RackRow({
  ctx,
  rack,
  children,
}: {
  ctx: MapContext;
  rack: Rack;
  children: Rack[];
}) {
  const { setup, values } = ctx;
  const color = rackColor(setup, rack.id);
  const choice = sourceChoice(setup, rack);
  const mixerId = rack.channels[0]?.mixerId;
  const mixer =
    mixerId === undefined || choice ? undefined : moduleOf(setup, mixerId);
  const generators = [
    ...new Set(
      rack.channels.flatMap((c) =>
        c.sources.flatMap((t) => (t.kind === "generator" ? [t.blockId] : [])),
      ),
    ),
  ];
  const crossoverModule =
    rack.crossover && moduleOf(setup, rack.crossover.blockIds[0]?.[0] ?? -1);
  // Outputs fed directly, or through an output Select this rack plays into.
  const selects = setup.racks.filter(
    (r) =>
      isOutputSelect(setup, r) &&
      r.channels.some((c) =>
        c.sources.some((t) => t.kind === "rack" && t.rackId === rack.id),
      ),
  );
  const outputs = outputStrips(setup).filter(
    (s) => s.rackId === rack.id || selects.some((r) => r.id === s.rackId),
  );
  const read = (key: string) =>
    valueOf(values, rack.crossover?.blockIds[0]?.[0] ?? -1, key);
  return (
    <div
      className="app-map-node"
      style={{ "--app-rack": color } as CSSProperties}
    >
      <div className="app-map-chain">
        <div className="app-map-rack">
          <span className="app-map-rack-name">{rack.name}</span>
          <span className="app-map-rack-detail">
            {rack.channels.length > 1 ? "Stereo" : "Mono"}
            {choice &&
              ` · from ${choice.options.find((o) => o.value === valueOf(values, choice.blockIds[0] ?? -1, "input"))?.link.text ?? "?"}`}
          </span>
        </div>
        {generators.map((id) => {
          const g = moduleOf(setup, id);
          return (
            g && (
              <Tile
                key={id}
                ctx={ctx}
                sel={{ kind: "generator", blockId: id }}
                name="Generator"
                muted={anyFlag(values, [id], "mute")}
              >
                {summaryLines(g, values, id).map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </Tile>
            )
          );
        })}
        {mixer && mixerId !== undefined && (
          <Tile ctx={ctx} sel={{ kind: "mixer", rackId: rack.id }} name="Σ Sum">
            {summaryLines(
              { ...mixer, compact: ["outputLevel"] },
              values,
              mixerId,
            ).map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </Tile>
        )}
        {rack.modules.map((_, i) => (
          <ModuleTile key={i} ctx={ctx} rack={rack} index={i} />
        ))}
        {rack.crossover && crossoverModule && (
          <Tile
            ctx={ctx}
            sel={{ kind: "crossover", rackId: rack.id }}
            name="Crossover"
            tall
          >
            {crossoverBands(crossoverModule, read).length > 0 &&
              crossoverModule.params
                .filter(
                  (p) =>
                    p.kind === "number" &&
                    p.unit === "Hz" &&
                    read(p.key.replace(/Freq$/, "Type")) !== 0,
                )
                .map((p) => (
                  <span key={p.key}>{formatParam(p, read(p.key))}</span>
                ))}
            {rack.crossover.blockIds[0] &&
              rack.crossover.blockIds[0].length > 1 && (
                <span className="app-note">
                  {rack.crossover.blockIds[0].length} stages
                </span>
              )}
          </Tile>
        )}
      </div>
      {children.length > 0 ? (
        <div className="app-map-children">
          {children.map((c) => (
            <MapBranch key={c.id} ctx={ctx} rack={c} />
          ))}
        </div>
      ) : (
        outputs.length > 0 && (
          <div className="app-map-outs">
            {outputs.map((o) => {
              const module = moduleOf(setup, o.blockIds[0] ?? -1);
              return (
                <Tile
                  key={o.name}
                  ctx={ctx}
                  sel={{ kind: "io", blockIds: o.blockIds, name: o.name }}
                  name={o.name}
                  muted={anyFlag(values, o.blockIds, "mute")}
                  color={color}
                >
                  {module &&
                    summaryLines(module, values, o.blockIds[0] ?? -1)
                      .slice(0, 1)
                      .map((t, i) => <span key={i}>{t}</span>)}
                </Tile>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function childrenOf(setup: Setup, rack: Rack): Rack[] {
  const racks = setup.racks.filter(
    (r) => r.id !== rack.id && !isOutputSelect(setup, r),
  );
  const feeds = (r: Rack) =>
    r.channels.some((c) =>
      c.sources.some(
        (t) => (t.kind === "rack" || t.kind === "band") && t.rackId === rack.id,
      ),
    );
  const band = (r: Rack) =>
    r.channels[0]?.sources.find((t) => t.kind === "band")?.band ?? -1;
  return racks.filter(feeds).sort((a, b) => band(a) - band(b));
}

function MapBranch({ ctx, rack }: { ctx: MapContext; rack: Rack }) {
  return (
    <RackRow ctx={ctx} rack={rack} children={childrenOf(ctx.setup, rack)} />
  );
}

function Editor({
  sel,
  setup,
  values,
}: {
  sel: Selection;
  setup: Setup;
  values: Values;
}) {
  const rackOf = (id: string) => setup.racks.find((r) => r.id === id);
  switch (sel.kind) {
    case "module": {
      const rack = rackOf(sel.rackId);
      const m = rack?.modules[sel.index];
      const module =
        m && setup.modules.find((x) => x.blockType === m.blockType);
      return rack && m && module ? (
        <ModuleView
          initiallyOpen
          module={module}
          blockIds={m.blockIds}
          values={values}
          rackName={rack.name}
          channelNames={rackChannelNames(setup, rack, values)}
        />
      ) : null;
    }
    case "mixer": {
      const rack = rackOf(sel.rackId);
      const id = rack?.channels[0]?.mixerId;
      const module = id === undefined ? undefined : moduleOf(setup, id);
      return rack && id !== undefined && module ? (
        <ModuleView
          initiallyOpen
          module={module}
          blockIds={[id]}
          values={values}
          rackName={rack.name}
          title="Sum"
        />
      ) : null;
    }
    case "generator": {
      const module = moduleOf(setup, sel.blockId);
      return module ? (
        <ModuleView
          module={module}
          blockIds={[sel.blockId]}
          values={values}
          rackName="Generator"
          title="Generator"
        />
      ) : null;
    }
    case "crossover": {
      const rack = rackOf(sel.rackId);
      const x = rack?.crossover;
      if (!rack || !x) return null;
      const modules = (x.blockIds[0] ?? [])
        .map((id) => moduleOf(setup, id))
        .filter((m): m is ModuleInfo => m !== undefined);
      const colors = x.bands.map((_, band) => {
        const fed = setup.racks.find((r) =>
          r.channels.some((c) =>
            c.sources.some(
              (t) =>
                t.kind === "band" && t.rackId === rack.id && t.band === band,
            ),
          ),
        );
        return fed && rackColor(setup, fed.id);
      });
      return (
        <CrossoverModule
          initiallyOpen
          blockIds={x.blockIds}
          modules={modules}
          values={values}
          rackName={rack.name}
          channelNames={rackChannelNames(setup, rack, values)}
          bandColors={colors}
        />
      );
    }
    case "io": {
      const module = moduleOf(setup, sel.blockIds[0] ?? -1);
      return module ? (
        <ModuleView
          module={module}
          blockIds={sel.blockIds}
          values={values}
          rackName={sel.name}
          title={sel.name}
          channelNames={sel.blockIds.map((id) => channelName(setup, id) ?? "")}
        />
      ) : null;
    }
  }
}

export function SystemMap({ setup, values }: { setup: Setup; values: Values }) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const ctx: MapContext = {
    setup,
    values,
    selected: selected && selKey(selected),
    select: (s) =>
      setSelected(selected && selKey(selected) === selKey(s) ? null : s),
  };
  const roots = setup.racks.filter(
    (r) =>
      !isOutputSelect(setup, r) &&
      !r.channels.some((c) =>
        c.sources.some(
          (t) =>
            (t.kind === "rack" || t.kind === "band") &&
            setup.racks.some((x) => x.id === t.rackId),
        ),
      ),
  );
  // Each root rack starts at the input tile it is fed from.
  const strips = inputStrips(setup);
  const inputIds = (rack: Rack) =>
    new Set(
      rack.channels.flatMap((c) =>
        c.sources.flatMap((t) => (t.kind === "input" ? [t.blockId] : [])),
      ),
    );
  const inputFor = (rack: Rack) =>
    strips.find((s) => s.blockIds.some((id) => inputIds(rack).has(id)));
  // Inputs no root rack can take (also not as a Select choice).
  const unused = strips.filter(
    (s) => !roots.some((r) => s.blockIds.some((id) => inputIds(r).has(id))),
  );
  return (
    <div className="app-map-wrap">
      <div className="app-map" role="group" aria-label="Signal map">
        {roots.map((rack) => {
          const input = inputFor(rack);
          const module = input && moduleOf(setup, input.blockIds[0] ?? -1);
          return (
            <div key={rack.id} className="app-map-root">
              {input && module && (
                <div className="app-map-in">
                  <Tile
                    ctx={ctx}
                    sel={{
                      kind: "io",
                      blockIds: input.blockIds,
                      name: input.name,
                    }}
                    name={input.name}
                    muted={anyFlag(values, input.blockIds, "mute")}
                  >
                    {summaryLines(module, values, input.blockIds[0] ?? -1)
                      .slice(0, 1)
                      .map((t, i) => (
                        <span key={i}>{t}</span>
                      ))}
                  </Tile>
                </div>
              )}
              <MapBranch ctx={ctx} rack={rack} />
            </div>
          );
        })}
        {unused.length > 0 && (
          <div className="app-map-unused">
            <span className="rl-label">Not used</span>
            {unused.map((s) => {
              const module = moduleOf(setup, s.blockIds[0] ?? -1);
              return (
                <Tile
                  key={s.name}
                  ctx={ctx}
                  sel={{ kind: "io", blockIds: s.blockIds, name: s.name }}
                  name={s.name}
                >
                  {module &&
                    summaryLines(module, values, s.blockIds[0] ?? -1)
                      .slice(0, 1)
                      .map((t, i) => <span key={i}>{t}</span>)}
                </Tile>
              );
            })}
          </div>
        )}
      </div>
      {selected && (
        <div className="app-map-editor">
          <div className="app-map-editor-bar">
            <span className="rl-label">Editing</span>
            <IconButton
              icon="close"
              label="Close editor"
              onClick={() => setSelected(null)}
            />
          </div>
          <div className="app-map-editor-body">
            <Editor
              key={selKey(selected)}
              sel={selected}
              setup={setup}
              values={values}
            />
          </div>
        </div>
      )}
    </div>
  );
}
