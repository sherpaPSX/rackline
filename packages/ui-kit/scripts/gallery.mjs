/* global URL, console */
// Builds the ui-kit specimen page into one self-contained file: dist/gallery.html
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

const here = new URL('..', import.meta.url).pathname;

const result = await build({
  entryPoints: { gallery: `${here}src/gallery/Gallery.tsx`, styles: `${here}src/styles/index.css` },
  bundle: true,
  minify: true,
  write: false,
  outdir: 'out',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  // Fonts are inlined so the page works offline as one file.
  loader: { '.woff2': 'dataurl', '.woff': 'empty' },
});

const js = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';

const page = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rackline UI kit</title>
<style>${css}</style>
<style>
*{box-sizing:border-box}
body{margin:0;background:var(--rl-bg);color:var(--rl-fg);font:14px var(--rl-font-label);padding-block:var(--rl-s6);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:1000px;margin:0 auto;display:grid;gap:var(--rl-s6)}
main>*{min-width:0}
h1{font-size:22px;font-weight:600;margin:0}
.sub{color:var(--rl-dim);max-width:70ch;line-height:1.45}
h2{font:600 12px var(--rl-font-label);text-transform:uppercase;letter-spacing:.14em;color:var(--rl-dim);margin:0 0 var(--rl-s3);display:flex;gap:var(--rl-s2);align-items:center}
h2::after{content:"";flex:1;height:1px;background:var(--rl-line)}
.rack{background:var(--rl-panel);border:1px solid var(--rl-line);border-radius:var(--rl-radius);padding:var(--rl-s5) var(--rl-s4)}
.note{font-size:13px;color:var(--rl-dim);margin:var(--rl-s2) 0 0}
.row{display:flex;flex-wrap:wrap;gap:var(--rl-s2);align-items:center}
.row.wide{gap:var(--rl-s5) var(--rl-s6);align-items:flex-end}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:var(--rl-s3)}
.swatch{display:grid;gap:var(--rl-s1)}
.swatch i{display:block;height:36px;border-radius:var(--rl-radius);border:1px solid var(--rl-line)}
.typo{display:grid;gap:var(--rl-s3)}
.title{font-size:22px;font-weight:600}
.strips{display:flex;flex-wrap:wrap;gap:var(--rl-s2)}
.strip{display:grid;justify-items:center;gap:var(--rl-s3);padding:var(--rl-s3) var(--rl-s2);background:var(--rl-bg);border:1px solid var(--rl-line);border-top:3px solid;border-radius:var(--rl-radius);width:112px}
.stack{display:grid;gap:var(--rl-s4)}
.mini-curve{width:200px}
.peq-side{display:flex;flex-wrap:wrap;gap:var(--rl-s3) var(--rl-s4);align-items:center}
.peq-side>.rl-eq{flex:1 1 280px;min-width:0}
.peq-controls{display:grid;grid-template-columns:repeat(2,auto);gap:var(--rl-s3) var(--rl-s4);justify-items:center}
.peq-controls>.rl-seg{grid-column:1/-1}
@media (max-width:600px){.peq-controls{grid-template-columns:repeat(3,auto);flex:1;justify-content:space-around}}
.strip-name{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
</style>
</head>
<body><div id="root"></div><script>${js}</script></body>
</html>`;

await mkdir(`${here}dist`, { recursive: true });
await writeFile(`${here}dist/gallery.html`, page);
console.log(`dist/gallery.html ${(page.length / 1024).toFixed(0)} KB`);
