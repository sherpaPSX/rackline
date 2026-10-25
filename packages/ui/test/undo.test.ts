import { describe, expect, it } from 'vitest';
import { UNDO_MERGE_MS, UndoHistory } from '../src/index.js';

const change = (before: number, after: number, blockId = 40, key = 'level') => ({ blockId, key, before, after });

describe('UndoHistory', () => {
  it('merges one drag of the same control into one step', () => {
    const h = new UndoHistory();
    h.record([change(0, -1)], 0);
    h.record([change(-1, -2)], 100);
    h.record([change(-2, -3)], 200);
    expect(h.undo()).toEqual([{ blockId: 40, key: 'level', value: 0 }]);
    expect(h.canUndo).toBe(false);
  });

  it('starts a new step after a pause or on another control', () => {
    const h = new UndoHistory();
    h.record([change(0, -1)], 0);
    h.record([change(-1, -2)], UNDO_MERGE_MS + 1);
    h.record([change(5, 6, 17, 'delay')], UNDO_MERGE_MS + 2);
    expect(h.undo()).toEqual([{ blockId: 17, key: 'delay', value: 5 }]);
    expect(h.undo()).toEqual([{ blockId: 40, key: 'level', value: -1 }]);
    expect(h.undo()).toEqual([{ blockId: 40, key: 'level', value: 0 }]);
    expect(h.undo()).toBeUndefined();
  });

  it('redoes what was undone until a new change is made', () => {
    const h = new UndoHistory();
    h.record([change(0, -1), change(0, -1, 41)], 0);
    h.undo();
    expect(h.redo()).toEqual([
      { blockId: 40, key: 'level', value: -1 },
      { blockId: 41, key: 'level', value: -1 },
    ]);
    h.undo();
    h.record([change(0, 3)], 10);
    expect(h.canRedo).toBe(false);
  });

  it('does not merge an edit into a redone step', () => {
    const h = new UndoHistory();
    h.record([change(0, -1)], 0);
    h.undo();
    h.redo();
    h.record([change(-1, -4)], 1);
    expect(h.undo()).toEqual([{ blockId: 40, key: 'level', value: -1 }]);
  });
});
