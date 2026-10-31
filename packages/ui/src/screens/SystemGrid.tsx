import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Canvas, ModuleInfo, Setup, Values } from '@rackline/api';
import { EqCurve, IconButton } from '@rackline/ui-kit';
import { peqBands, peqFilters, readPeqBand } from '../curves.js';
import { CrossoverModule } from '../modules/CrossoverModule.js';
import { ModuleView } from '../modules/ModuleView.js';
import { formatParam } from '../params.js';
import { blockById, channelName, inputStrips, moduleOf, outputStrips, rackChannelNames, rackColor, valueOf } from '../racks.js';

/**
 * System as Drag Net draws it: every block at its place on Drag Net's grid,
 * wires between pins. Values only (phase 1): a click on a block opens its
 * editor below the grid; moving blocks and wiring come with the compiler.
 */

/** Pixels per Drag Net grid unit, and a block's size in units (blocks sit 7 units apart). */
const UNIT = 16;
const BLOCK_W = 5;
const BLOCK_H = 5;

/** Key values of a module as short text, e.g. ["−6.0 dB"]. */
function summaryLines(module: ModuleInfo, values: Values, blockId: number): string[] {
  const keys = module.compact.length > 0 ? module.compact : module.params.slice(0, 2).map((p) => p.key);
  return keys.flatMap((key) => {
    const p = module.params.find((x) => x.key === key);
    if (!p || p.kind === 'bool' || p.kind === 'flags' || p.kind === 'enum') return [];
    return [formatParam(p, valueOf(values, blockId, key))];
  });
}

function muted(values: Values, blockId: number): boolean {
  const m = valueOf(values, blockId, 'mute');
  const o = valueOf(values, blockId, 'options');
  return m === true || (typeof o === 'object' && o.mute === true);
}

/** Color of the rack a block belongs to, so the grid shows which blocks form one band. */
function colorOf(setup: Setup, blockId: number): string | undefined {
  const rack = setup.racks.find(
    (r) =>
      r.modules.some((m) => m.blockIds.includes(blockId)) ||
      r.channels.some((c) => c.mixerId === blockId || c.outputIds.includes(blockId)) ||
      r.crossover?.blockIds.some((ids) => ids.includes(blockId)),
  );
  return rack && rackColor(setup, rack.id);
}

function BlockTile({ setup, values, id, selected, onSelect }: { setup: Setup; values: Values; id: number; selected: boolean; onSelect: () => void }) {
  const block = blockById(setup, id);
  const module = moduleOf(setup, id);
  const bands = module ? peqBands(module) : [];
  // The feedback suppressor holds PEQ filters too; its tile shows its settings.
  const curve = module && bands.length > 0 && !module.params.some((p) => p.key === 'freeze');
  return (
    <button
      type="button"
      className="app-tile app-grid-block"
      data-selected={selected || undefined}
      data-muted={muted(values, id) || undefined}
      data-unknown={!module || undefined}
      style={{ '--app-tile-k': colorOf(setup, id) } as CSSProperties}
      onClick={onSelect}
      aria-pressed={selected}
      title={module?.name}
    >
      <span className="app-tile-name">{block?.name ?? `Block ${id}`}</span>
      <span className="app-tile-body">
        {curve ? (
          <EqCurve
            compact
            height={28}
            label={`${block?.name ?? ''} response`}
            lines={[{ id: 'total', filters: peqFilters(bands.map((n) => readPeqBand(module, (k) => valueOf(values, id, k), n))), fill: true }]}
          />
        ) : module ? (
          summaryLines(module, values, id).slice(0, 2).map((t, i) => <span key={i}>{t}</span>)
        ) : (
          <span>Not supported</span>
        )}
      </span>
    </button>
  );
}

/**
 * The editor for a block. Blocks that form one stereo module in the racks
 * (left and right PEQ, a cascaded crossover) open together, linked, so a
 * change goes to both sides as in the rest of the app.
 */
function Editor({ setup, values, id }: { setup: Setup; values: Values; id: number }) {
  const strip = [...inputStrips(setup), ...outputStrips(setup)].find((s) => s.blockIds.includes(id));
  if (strip) {
    const module = moduleOf(setup, id);
    return module ? (
      <ModuleView module={module} blockIds={strip.blockIds} values={values} rackName={strip.name} title={strip.name} channelNames={strip.blockIds.map((b) => channelName(setup, b) ?? '')} />
    ) : null;
  }
  for (const rack of setup.racks) {
    const names = rackChannelNames(setup, rack, values);
    const m = rack.modules.find((x) => x.blockIds.includes(id));
    const module = m && setup.modules.find((x) => x.blockType === m.blockType);
    if (m && module) return <ModuleView initiallyOpen module={module} blockIds={m.blockIds} values={values} rackName={rack.name} channelNames={names} />;
    const x = rack.crossover;
    if (x?.blockIds.some((ids) => ids.includes(id))) {
      const modules = (x.blockIds[0] ?? []).map((b) => moduleOf(setup, b)).filter((mi): mi is ModuleInfo => mi !== undefined);
      const colors = x.bands.map((_, band) => {
        const fed = setup.racks.find((r) => r.channels.some((c) => c.sources.some((t) => t.kind === 'band' && t.rackId === rack.id && t.band === band)));
        return fed && rackColor(setup, fed.id);
      });
      return <CrossoverModule initiallyOpen blockIds={x.blockIds} modules={modules} values={values} rackName={rack.name} channelNames={names} bandColors={colors} />;
    }
  }
  const module = moduleOf(setup, id);
  const name = blockById(setup, id)?.name ?? '';
  return module ? <ModuleView initiallyOpen module={module} blockIds={[id]} values={values} rackName={name} title={name} /> : <span className="app-note">This block type is not supported yet.</span>;
}

/** Pin position in px: inputs on the left edge, outputs on the right, spread over the height. */
function pinAt(canvas: Canvas, blockId: number, pin: number, side: 'in' | 'out'): { x: number; y: number } | undefined {
  const b = canvas.blocks.find((x) => x.id === blockId);
  if (!b) return undefined;
  const n = side === 'in' ? b.inputs : b.outputs;
  return { x: (b.x + (side === 'out' ? BLOCK_W : 0)) * UNIT, y: (b.y + (BLOCK_H * (pin + 1)) / (n + 1)) * UNIT };
}

export function SystemGrid({ setup, values, canvas }: { setup: Setup; values: Values; canvas: Canvas }) {
  const [selected, setSelected] = useState<number | null>(null);
  const width = (Math.max(...canvas.blocks.map((b) => b.x)) + BLOCK_W + 2) * UNIT;
  const height = (Math.max(...canvas.blocks.map((b) => b.y)) + BLOCK_H + 2) * UNIT;
  return (
    <div className="app-map-wrap">
      <div className="app-grid-canvas" role="group" aria-label="Signal grid">
        <div className="app-grid-plane" style={{ width, height, '--app-unit': `${UNIT}px` } as CSSProperties}>
          <svg className="app-grid-wires" width={width} height={height} aria-hidden="true">
            {canvas.wires.map((w, i) => {
              const a = pinAt(canvas, w.from.blockId, w.from.pin, 'out');
              const b = pinAt(canvas, w.to.blockId, w.to.pin, 'in');
              if (!a || !b) return null;
              const dx = Math.max(24, Math.abs(b.x - a.x) / 2);
              const lit = selected === w.from.blockId || selected === w.to.blockId;
              return <path key={i} d={`M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`} data-lit={lit || undefined} />;
            })}
          </svg>
          {canvas.blocks.map((b) => (
            <div key={b.id} className="app-grid-slot" style={{ left: b.x * UNIT, top: b.y * UNIT, width: BLOCK_W * UNIT, height: BLOCK_H * UNIT }}>
              <BlockTile setup={setup} values={values} id={b.id} selected={selected === b.id} onSelect={() => setSelected(selected === b.id ? null : b.id)} />
            </div>
          ))}
        </div>
      </div>
      {selected !== null && (
        <div className="app-map-editor">
          <div className="app-map-editor-bar">
            <span className="rl-label">{blockById(setup, selected)?.name}</span>
            <IconButton icon="close" label="Close editor" onClick={() => setSelected(null)} />
          </div>
          <div className="app-map-editor-body">
            <Editor key={selected} setup={setup} values={values} id={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
