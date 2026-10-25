import { readFileSync } from 'node:fs';

/** Read a real sample from `test/fixtures` (see its README). */
export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
}

export function fixtureText(name: string): string {
  return readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'latin1');
}

/** Bytes from a hex string; spaces are ignored. */
export function hex(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '');
  return Uint8Array.from(clean.match(/../g) ?? [], (b) => parseInt(b, 16));
}

/** A zero-filled packet of `size` bytes starting with `head`. */
export function padded(head: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  out.set(head);
  return out;
}
