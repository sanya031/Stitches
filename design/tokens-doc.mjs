// Writes design/TOKENS.md from design/tokens.css, so the token reference never drifts from the tokens.
// Run after changing tokens.css:  node design/tokens-doc.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const css = readFileSync(new URL('tokens.css', here), 'utf8');

// every declaration with the comment after it, per block (selector)
const blocks = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
  const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(';').pop().trim();
  // each declaration with the comment after it; a comment on a line of its own (/* Surfaces */) heads those after it
  const decls = [];
  let group = '';
  for (const line of m[2].split('\n')) {
    const g = line.match(/^\s*\/\*\s*([^*]+?)\s*\*\/\s*$/); if (g) { group = g[1].split(':')[0]; continue; }
    for (const d of line.matchAll(/(--[\w-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*\s*(.*?)\s*\*\/)?/g)) decls.push({ name: d[1], value: d[2].trim(), note: d[3] || '', group });
  }
  blocks.push({ sel, decls });
}
const inBlock = (pred) => blocks.filter((b) => pred(b.sel)).flatMap((b) => b.decls);
const all = Object.fromEntries(blocks.flatMap((b) => b.decls).map((d) => [d.name, d.value]));

// palettes: --<name>-<step>: #hex
const palettes = new Map();
for (const d of inBlock((s) => s === ':root')) {
  const m = d.name.match(/^--([a-z]+)-(\d+)$/);
  if (m && /^#/.test(d.value)) { if (!palettes.has(m[1])) palettes.set(m[1], []); palettes.get(m[1]).push([m[2], d.value]); }
}
const ROLE_OF = { terracotta: 'Primary', neutral: 'Neutral', crimson: 'Status (errors only)', ochre: 'Brand', periwinkle: 'Brand', leaf: 'Brand', lilac: 'Brand' };

const light = inBlock((s) => s.includes('[data-theme="light"]'));
const dark = Object.fromEntries(inBlock((s) => s === '[data-theme="dark"]').map((d) => [d.name, d.value]));
// what each role is for, where tokens.css has no comment on the line
const USE = {
  '--surface-bench': 'the ground around the cloth', '--surface-panel': 'the properties panel', '--surface-field': 'fields, selects, split fields',
  '--surface-raised': 'pop-ups, menus, floating bars', '--surface-selected': 'a selected item: tile, pill option, tool, toggle',
  '--text-strong': 'headings, selected labels, values', '--text': 'body text', '--text-muted': 'secondary text, units, placeholders', '--text-disabled': 'disabled text',
  '--icon': 'icons at rest', '--icon-active': 'icons hovered or selected', '--icon-faint': 'decorative, very quiet marks',
  '--border-subtle': 'dividers', '--border': 'field and swatch edges', '--border-strong': 'a field hovered, open or being typed in',
  '--control-track': 'the empty part of a track', '--control-fill': 'a filled track or handle', '--focus': 'the keyboard focus ring (only on :focus-visible)',
  '--accent': 'the primary button, the selected tool, the selection outline', '--accent-hover': 'the accent hovered', '--accent-pressed': 'the accent pressed',
  '--on-accent': 'text and icons on the accent', '--accent-text': 'accent-coloured text, sparingly',
  '--danger': 'error text and edges', '--danger-fill': 'a destructive button', '--danger-hover': 'that button hovered', '--danger-pressed': 'that button pressed',
  '--on-danger': 'text on the danger fill', '--danger-subtle': 'a faint error background',
  '--shadow-float': 'floating bars over the cloth', '--shadow-popover': 'pop-ups, menus, the colour picker', '--shadow-sheet': 'sheets and dialogs',
};
const short = (v) => v.replace(/var\(--([\w-]+)\)/g, '$1');
const hexOf = (v) => { let x = v, n = 0; while (/^var\(--[\w-]+\)$/.test(x) && n++ < 5) x = all[x.slice(4, -1)]; return /^#/.test(x) ? x : ''; };
const cell = (v) => { const h = hexOf(v); return `\`${short(v)}\`${h ? ` ${h}` : ''}`; };

const others = inBlock((s) => s === ':root').filter((d) => !(/^--[a-z]+-\d+$/.test(d.name) && /^#/.test(d.value)) && d.name !== '--primary');
const group = (re) => others.filter((d) => re.test(d.name));
const table = (rows) => ['| Token | Value | Use |', '|---|---|---|', ...rows.map((d) => `| \`${d.name}\` | \`${d.value.replace(/\|/g, '\\|')}\` | ${d.note} |`)].join('\n');
const taken = new Set();
const section = (title, re) => { const rows = group(re).filter((d) => !taken.has(d.name)); rows.forEach((d) => taken.add(d.name)); return rows.length ? `### ${title}\n\n${table(rows)}\n` : ''; };

const out = `# Token reference

Generated from [\`tokens.css\`](tokens.css) by \`node design/tokens-doc.mjs\`. **Don't edit by hand**: change tokens.css, then run the script.
What the tokens are for and the rules for using them are in [DESIGN.md](../DESIGN.md).

Use tokens in CSS as \`var(--name)\`; type tokens as \`font: var(--type-…)\`. Components use **roles** (below), never palette steps.

## Palettes

Tonal, 50 → 950. One OKLCH lightness per step, shared by every palette, so a pair of steps has about the same contrast in any hue. \`--primary\` is \`${short(all['--primary'])}\`.

| Step | ${[...palettes.keys()].join(' | ')} |
|---|${[...palettes.keys()].map(() => '---').join('|')}|
| *Use* | ${[...palettes.keys()].map((p) => `*${ROLE_OF[p] || ''}*`).join(' | ')} |
${[...new Set([...palettes.values()].flat().map(([s]) => s))].sort((a, b) => a - b).map((s) => `| ${s} | ${[...palettes.values()].map((st) => { const v = st.find(([k]) => k === s)?.[1]; return v ? `\`${v}\`` : ''; }).join(' | ')} |`).join('\n')}

## Roles (light and dark)

Light is the default (\`:root\`, \`[data-theme="light"]\`); dark comes from \`[data-theme="dark"]\` or, with no theme set, the system's dark mode.

| Role | Light | Dark | Use |
|---|---|---|---|
${light.map((d, i) => (d.group !== light[i - 1]?.group ? `| **${d.group}** | | | |\n` : '') + `| \`${d.name}\` | ${cell(d.value)} | ${dark[d.name] ? cell(dark[d.name]) : '(same)'} | ${d.note || USE[d.name] || ''} |`).join('\n')}

## Type, space, shape, size, layering, motion

${section('Type', /^--(font|weight|numeric|type)/)}
${section('Space', /^--(space|inline-gap|row-gap|control-padding|panel-padding|section-gap)/)}
${section('Shape', /^--(radius|border-width|focus-)/)}
${section('Size', /^--(target|control-|row-height|icon-|panel-width|toolbar-width|stitch-tile)/)}
${section('Layering', /^--z-/)}
${section('Motion', /^--(motion|tooltip)/)}
${section('Other', /./)}`;

writeFileSync(new URL('TOKENS.md', here), out.replace(/\n{3,}/g, '\n\n'));
console.log('wrote design/TOKENS.md');
