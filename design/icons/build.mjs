// Writes svg/<name>.svg for every line icon, sprite.svg (one <symbol> per icon, primitives as p-<name>),
// and, for the thread-style stitch and fill icons and their clean line primitives, three versions each:
// thread/ and primitive/ (single square), thread-patch/ and primitive-patch/ (4 × 4 patch), thread-zoom/ and primitive-zoom/.
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

// Thread icons and primitives, each in three versions: the single square (first frame), the 4 × 4 patch
// (last frame, same square on the grid) and the hover animation between them. The zoom versions must be
// inlined (an <img> shows only the square); hovering an ancestor with class tz-host also plays them.
const writeSet = (dir, names, make) => {
  const out = join(here, dir);
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) if (f.endsWith('.svg')) unlinkSync(join(out, f));
  for (const name of names) writeFileSync(join(out, `${name}.svg`), make(name) + '\n');
};
const threads = Object.keys(THREAD_ICONS), prims = Object.keys(PRIMITIVES);
writeSet('thread', threads, (n) => threadSvg(n));
writeSet('thread-patch', threads, (n) => threadSvg(n, { frame: 'patch', id: `tp-${n}` }));
writeSet('thread-zoom', threads, (n) => threadSvg(n, { frame: 'zoom', id: `tz-${n}` }));
writeSet('primitive', prims, (n) => primitiveSvg(n));
writeSet('primitive-patch', prims, (n) => primitiveSvg(n, { frame: 'patch', id: `pp-${n}` }));
writeSet('primitive-zoom', prims, (n) => primitiveSvg(n, { frame: 'zoom', id: `pz-${n}` }));

console.log(`${Object.keys(ICONS).length} icons → svg/ and sprite.svg; ${threads.length} thread icons and ${prims.length} primitives → square, patch and zoom folders`);
