/** Latin-1 text from bytes (chunked, so long inputs don't overflow the call stack). */
export function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x2000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  }
  return text;
}

/** Latin-1 text up to the first NUL byte (or the end). */
export function cString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return latin1(end === -1 ? bytes : bytes.subarray(0, end));
}

/** Bytes of a Latin-1 string. */
export function latin1Bytes(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
}
