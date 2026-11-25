// Fabric: the cloth to stitch on, picked by how it looks. Each option is a small swatch of the fabric, drawn like the
// renderer's surfaces (lab/editor.js SURFACES), with its name under it: Dot grid (plain cloth with printed dots), Aida
// (a block weave with clear holes), Linen (a fine, uneven weave), Denim (a blue twill). The selected one's fill moves
// with the pill motion. fabricHtml(current) draws the picker; fabricSwatch(key) one swatch.
// Styled by the fabric block of controls.css.

/** [key, name] in picker order */
export const FABRIC_KINDS = [['dots', 'Dot grid'], ['aida', 'Aida'], ['linen', 'Linen'], ['denim', 'Denim']];

const W = 56, H = 36;
// seeded, so a swatch looks the same every time
const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const DRAW = {
  dots: () => {
    let d = '';
    for (let y = 4; y < H; y += 7) for (let x = 4; x < W; x += 7) d += `<circle cx="${x}" cy="${y}" r="0.9"/>`;
    return `<rect width="${W}" height="${H}" fill="#F2EEE6"/><g fill="#8F8A80" fill-opacity=".7">${d}</g>`;
  },
  aida: () => {
    let blocks = '', holes = '';
    for (let y = 0; y < H; y += 5) for (let x = 0; x < W; x += 5) {
      blocks += `<rect x="${x + 0.6}" y="${y + 0.6}" width="3.8" height="3.8" rx="1"/>`;
      holes += `<rect x="${x - 0.5}" y="${y - 0.5}" width="1" height="1"/>`;
    }
    return `<rect width="${W}" height="${H}" fill="#E7E3D8"/><g fill="#F7F5EF">${blocks}</g><g fill="#9C978C" fill-opacity=".55">${holes}</g>`;
  },
  linen: () => {
    const r = rand(11);
    let d = '';
    for (let y = 1; y < H; y += 2) d += `<path d="M0 ${y}H${W}" stroke-opacity="${(0.25 + r() * 0.45).toFixed(2)}" stroke-width="${(0.6 + r() * 0.7).toFixed(2)}"/>`;
    for (let x = 1; x < W; x += 2) d += `<path d="M${x} 0V${H}" stroke-opacity="${(0.15 + r() * 0.35).toFixed(2)}" stroke-width="${(0.5 + r() * 0.6).toFixed(2)}"/>`;
    return `<rect width="${W}" height="${H}" fill="#D9CCB2"/><g stroke="#A8987A">${d}</g>`;
  },
  denim: () => {
    let d = '';
    for (let k = -H; k < W; k += 3) d += `<path d="M${k} ${H}L${k + H} 0"/>`;
    return `<rect width="${W}" height="${H}" fill="#3C5A86"/><g stroke="#6F8DB8" stroke-width="1.1" stroke-opacity=".7">${d}</g>`;
  },
};

/** One fabric drawn as a small swatch */
export const fabricSwatch = (key) => `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${DRAW[key]()}</svg>`;

/** The picker: a swatch and its name for each fabric */
export const fabricHtml = (cur) => `<div class="c-fabrics" role="group" aria-label="Fabric" data-fabric>${FABRIC_KINDS.map(([k, n]) => `<button class="c-reset c-fabric c-focus" data-value="${k}" aria-pressed="${k === cur}"><span class="c-fabric__art">${fabricSwatch(k)}</span><span class="c-fabric__name">${n}</span></button>`).join('')}</div>`;
