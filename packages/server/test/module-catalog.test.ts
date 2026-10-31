import { readFileSync, writeFileSync } from 'node:fs';
import { AppState } from '@rackline/api';
import { describe, expect, it } from 'vitest';
import { moduleCatalogState } from './module-catalog.js';

/** The UI module gallery loads this file; `UPDATE_CATALOG=1 pnpm test` rewrites it. */
const fixture = new URL('../../ui/test/fixtures/module-catalog-state.json', import.meta.url);

describe('module catalog (UI gallery fixture)', () => {
  const state = moduleCatalogState();
  const json = `${JSON.stringify(state, null, 2)}\n`;

  it('is valid API state', () => {
    expect(AppState.safeParse(state).success).toBe(true);
  });

  it('matches the UI fixture', () => {
    if (process.env.UPDATE_CATALOG) writeFileSync(fixture, json);
    expect(readFileSync(fixture, 'utf8')).toBe(json);
  });
});
