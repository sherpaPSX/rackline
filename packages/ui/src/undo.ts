import type { ParamValue } from '@rackline/api';

/** One parameter of one block, before and after a change. */
export interface ParamChange {
  blockId: number;
  key: string;
  before: ParamValue;
  after: ParamValue;
}

interface Entry {
  changes: ParamChange[];
  /** Time of the last change merged into this entry. */
  at: number;
}

/** Moves of the same control closer together than this are one undo step (one fader drag). */
export const UNDO_MERGE_MS = 1000;
const MAX_ENTRIES = 200;

const targets = (changes: readonly ParamChange[]) => changes.map((c) => `${c.blockId}:${c.key}`).join(' ');

/**
 * Undo and redo of value changes made in this window. A drag of one control
 * is merged into one step; linked stereo edits (both channels) are one step.
 */
export class UndoHistory {
  private done: Entry[] = [];
  private undone: Entry[] = [];

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  record(changes: readonly ParamChange[], now: number): void {
    if (changes.length === 0) return;
    this.undone = [];
    const last = this.done.at(-1);
    if (last && now - last.at < UNDO_MERGE_MS && targets(last.changes) === targets(changes)) {
      last.changes = last.changes.map((c, i) => ({ ...c, after: changes[i]?.after ?? c.after }));
      last.at = now;
      return;
    }
    this.done.push({ changes: [...changes], at: now });
    if (this.done.length > MAX_ENTRIES) this.done.shift();
  }

  /** The values to restore, or undefined when there is nothing to undo. */
  undo(): { blockId: number; key: string; value: ParamValue }[] | undefined {
    const entry = this.done.pop();
    if (!entry) return undefined;
    this.undone.push(entry);
    return entry.changes.map((c) => ({ blockId: c.blockId, key: c.key, value: c.before }));
  }

  redo(): { blockId: number; key: string; value: ParamValue }[] | undefined {
    const entry = this.undone.pop();
    if (!entry) return undefined;
    // A redone step must not merge with the next edit.
    this.done.push({ ...entry, at: -Infinity });
    return entry.changes.map((c) => ({ blockId: c.blockId, key: c.key, value: c.after }));
  }

  clear(): void {
    this.done = [];
    this.undone = [];
  }
}
