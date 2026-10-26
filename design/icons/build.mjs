// Writes svg/<name>.svg for every icon and sprite.svg (one <symbol> per icon).
// Run from the repo root: node design/icons/build.mjs
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS, svg } from './icons.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'svg');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith('.svg')) unlinkSync(join(out, f));   // icons removed from the source go too

for (const name of Object.keys(ICONS)) writeFileSync(join(out, `${name}.svg`), svg(name) + '\n');

const symbols = Object.entries(ICONS).map(([name, { body }]) =>
  `  <symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`);
writeFileSync(join(here, 'sprite.svg'), `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols.join('\n')}\n</svg>\n`);

console.log(`${Object.keys(ICONS).length} icons → svg/ and sprite.svg`);
