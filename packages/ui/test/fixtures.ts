import { readFileSync } from 'node:fs';
import { AppState } from '@rackline/api';

/** The state the core sends for PSX_RCF_FINAL.r26 (see fixtures/README.md), validated by the API schema. */
export function psxState(): AppState {
  const text = readFileSync(new URL('fixtures/psx-rcf-final-state.json', import.meta.url), 'utf8');
  return AppState.parse(JSON.parse(text));
}
