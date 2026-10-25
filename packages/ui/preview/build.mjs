/* global URL, console, Buffer */
// Builds a self-contained preview of the app (fake in-page core with
// PSX_RCF_FINAL.r26) into dist/preview.html, for review as one file.
import { build } from 'vite';
import { mkdtemp, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const out = await mkdtemp(join(tmpdir(), 'rackline-preview-'));
await build({ root: here, base: './', logLevel: 'warn', configFile: join(here, '../vite.config.ts'), build: { outDir: out, emptyOutDir: true } });

const assets = join(out, 'assets');
const files = await readdir(assets);
const read = (suffix) => readFile(join(assets, files.find((f) => f.endsWith(suffix)) ?? ''), 'utf8');
let css = await read('.css');
const js = (await read('.js')).replaceAll('</script', '<\\/script');
// Inline woff2 fonts, drop the woff fallbacks.
css = css.replace(/,\s*url\([^)]+\.woff\)\s*format\("woff"\)/g, '');
for (const f of files.filter((n) => n.endsWith('.woff2'))) {
  const data = (await readFile(join(assets, f))).toString('base64');
  css = css.replaceAll(`url(./${f})`, `url(data:font/woff2;base64,${data})`).replaceAll(`url(/assets/${f})`, `url(data:font/woff2;base64,${data})`);
}
const page = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rackline preview</title><style>${css}</style></head><body><div id="root"></div><script type="module">${js}</script></body></html>`;
await mkdir(join(here, '../dist'), { recursive: true });
await writeFile(join(here, '../dist/preview.html'), page);
console.log(`dist/preview.html ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB`);
