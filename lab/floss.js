// A floss-style thread palette: 27 colour families in six shades, plus black, white and ecru.
// Names are descriptive ("Rose · dark"), not a manufacturer's numbers.

const FAMILIES = [
  ['Red', 355, 0.72], ['Coral', 8, 0.72], ['Orange', 24, 0.85], ['Apricot', 32, 0.7], ['Gold', 43, 0.8], ['Yellow', 52, 0.85],
  ['Olive', 62, 0.42], ['Lime', 80, 0.6], ['Leaf', 112, 0.45], ['Forest', 140, 0.42], ['Mint', 155, 0.38], ['Teal', 178, 0.55],
  ['Aqua', 190, 0.55], ['Sky', 205, 0.6], ['Blue', 218, 0.6], ['Navy', 228, 0.55], ['Violet', 262, 0.45], ['Lavender', 272, 0.32],
  ['Plum', 300, 0.38], ['Magenta', 322, 0.6], ['Pink', 340, 0.65], ['Rose', 350, 0.42], ['Brown', 22, 0.42], ['Tan', 30, 0.36],
  ['Beige', 38, 0.26], ['Grey', 220, 0.06], ['Warm grey', 30, 0.09]
];
const SHADES = [['very light', 0.88], ['light', 0.76], ['medium', 0.6], ['dark', 0.45], ['very dark', 0.32], ['deepest', 0.2]];

function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

export const FLOSS = [
  ...FAMILIES.flatMap(([name, h, s]) => SHADES.map(([shade, l]) => ({
    name: `${name} · ${shade}`,
    // very light and very dark threads carry less colour
    hex: hsl(h, s * (1 - Math.abs(l - 0.52) * 0.7), l)
  }))),
  { name: 'Black', hex: '#1E1D1C' }, { name: 'White', hex: '#F8F6F0' }, { name: 'Ecru', hex: '#EDE3CC' }
];

/** A darker shade of the same family (outlines look stitched with the neighbouring colour, not black). */
export function darkerShade(index, steps = 2) {
  const n = FAMILIES.length * SHADES.length;
  if (index < n) return Math.floor(index / SHADES.length) * SHADES.length + Math.min(SHADES.length - 1, index % SHADES.length + steps);
  const name = FLOSS[index].name;
  return name === 'Black' ? index : FLOSS.findIndex((f) => f.name === 'Warm grey · medium');
}
