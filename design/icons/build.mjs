// Writes svg/<name>.svg for every line icon, sprite.svg (one <symbol> per icon, primitives as p-<name>),
// thread/<name>.svg for the thread-style stitch and fill icons, and primitive/<name>.svg for their clean line versions.
// Run from the repo root: node design/icons/build.mjs
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS, svg } from './icons.js';
import { THREAD_ICONS, threadSvg } from './thread.js';
import { PRIMITIVES, primitiveSvg } from './primitives.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'svg');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith('.svg')) unlinkSync(join(out, f));   // icons removed from the source go too

for (const name of Object.keys(ICONS)) writeFileSync(join(out, `${name}.svg`), svg(name) + '\n');

const symbols = Object.entries(ICONS).map(([name, { body }]) =>
  `  <symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`);
for (const name of Object.keys(PRIMITIVES)) {
  const inner = primitiveSvg(name).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  symbols.push(`  <symbol id="p-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`);
}
writeFileSync(join(here, 'sprite.svg'), `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols.join('\n')}\n</svg>\n`);

const primOut = join(here, 'primitive');
mkdirSync(primOut, { recursive: true });
for (const f of readdirSync(primOut)) if (f.endsWith('.svg')) unlinkSync(join(primOut, f));
for (const name of Object.keys(PRIMITIVES)) writeFileSync(join(primOut, `${name}.svg`), primitiveSvg(name) + '\n');

// thread icons: stitches and fills drawn as real thread, in the default strawberry red
const threadOut = join(here, 'thread');
mkdirSync(threadOut, { recursive: true });
for (const f of readdirSync(threadOut)) if (f.endsWith('.svg')) unlinkSync(join(threadOut, f));
for (const name of Object.keys(THREAD_ICONS)) writeFileSync(join(threadOut, `${name}.svg`), threadSvg(name) + '\n');

console.log(`${Object.keys(ICONS).length} icons → svg/ and sprite.svg; ${Object.keys(THREAD_ICONS).length} thread icons → thread/; ${Object.keys(PRIMITIVES).length} primitives → primitive/`);
