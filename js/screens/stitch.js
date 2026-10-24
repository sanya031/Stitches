import { cellsHTML, gridToCells, STRAWBERRY, STRAWBERRY_PALETTE, COUNTED, FREEFORM, icon } from '../thread.js';

const TOOLS = [
  ['stitch', 'Stitch', 'M4 20L18 6M15 3l6 6M18 6l-2-2'],
  ['erase', 'Unpick', 'M5 19l14-14M8 5l11 11M4 12h4'],
  ['select', 'Select', 'M4 4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 9V4'],
  ['pan', 'Pan', 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3'],
  ['mend', 'Mend', 'M4 16c3-6 6 6 9 0s6 6 7 0M4 8h16'],
  ['pick', 'Pick colour', 'M14 4l6 6-9 9H5v-6z']
];

const SKEINS = [
  ['S-321', 'Berry red', '#C8343B'], ['S-817', 'Deep red', '#8E1D24'], ['S-704', 'Leaf green', '#4F8A4B'],
  ['S-3346', 'Moss', '#2F5A35'], ['S-744', 'Seed yellow', '#F2D06B'], ['S-3865', 'Cream', '#F4EEE2'],
  ['S-597', 'Lagoon', '#3E9BA8'], ['S-340', 'Lilac', '#9C8FD3'], ['S-310', 'Ink', '#1C1C20'], ['S-3776', 'Copper', '#B8622B']
];

const WORN = { '5-9': 1, '6-9': 1, '5-10': 1, '4-9': 1, '6-8': 1 };
const CELL = 22;

const pressed = (on) => `aria-pressed="${on ? 'true' : 'false'}"`;

export default {
  title: 'Stitch',
  file: 'strawberry-sampler',
  status: 'saved',
  initial: { tool: 'stitch', stitch: 'full', strands: 2, skein: 'S-321', wear: true, keep: false, zoom: 140 },

  actions: {
    tool: (s, id) => ({ tool: id }),
    stitch: (s, id) => ({ stitch: id }),
    strands: (s, n) => ({ strands: n }),
    skein: (s, code) => ({ skein: code }),
    wear: (s) => ({ wear: !s.wear }),
    keep: (s, v) => ({ keep: v }),
    zoom: (s, d) => ({ zoom: Math.max(50, Math.min(400, s.zoom + d)) })
  },

  render(s) {
    const cells = gridToCells(STRAWBERRY, STRAWBERRY_PALETTE, CELL, s.wear ? WORN : {});
    const tile = ([id, label, d]) => `
      <button class="tile" data-act="stitch" data-arg="${id}" ${pressed(s.stitch === id)}>
        ${icon(d, 26, 2.2)}<span>${label}</span>
      </button>`;

    return `
    <div class="layout">
      <nav class="rail rail-left dock" aria-label="Tools">
        ${TOOLS.map(([id, label, d]) => `
          <button data-act="tool" data-arg="${id}" aria-label="${label}" ${pressed(s.tool === id)}>
            ${icon(d)}<span>${label}</span>
          </button>`).join('')}
      </nav>

      <main class="workspace">
        <div class="meta-bar mono">
          <span>Aida 14 ct · 50 × 35 holes · 9.1 × 6.4 cm</span>
          <span style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-sm" data-act="zoom" data-arg="-20" aria-label="Zoom out">−</button>
            <span style="color:var(--text)">${s.zoom}%</span>
            <button class="btn btn-sm" data-act="zoom" data-arg="20" aria-label="Zoom in">+</button>
          </span>
        </div>

        <div class="stage">
          <div class="cloth aida" style="--cell:${CELL}px;width:770px;height:506px">
            <div class="cells" style="left:242px;top:110px;width:264px;height:264px">${cellsHTML(cells, CELL)}</div>
            ${s.wear ? `
              <div class="rub-ring" aria-hidden="true" style="left:428px;top:204px;width:92px;height:92px"></div>
              <div class="tip" style="left:532px;top:226px"><strong>Rubbing · wear 38%</strong><span>Sheen dulled, fibres lifting</span></div>` : ''}
          </div>
        </div>

        <section aria-label="Thread rack" style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px;padding:16px 24px 18px;border-top:1px solid var(--line);background:#15171C">
          <div style="display:flex;flex-direction:column;gap:4px;min-width:120px">
            <span class="h2">Thread rack</span>
            <span class="dim" style="font-size:12px">4 in this piece</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;flex:1 1 400px">
            ${SKEINS.map(([code, name, hex]) => `
              <button class="skein-btn" data-act="skein" data-arg="${code}" aria-label="${name} ${code}" ${pressed(s.skein === code)}>
                <span class="skein" style="background-color:${hex}"></span>
                <span class="skein-code">${code}</span>
              </button>`).join('')}
            <button class="btn" aria-label="Add thread colour" style="width:46px;height:68px;border-style:dashed;font-size:20px">+</button>
          </div>
        </section>
      </main>

      <aside class="rail rail-right" aria-label="Stitch and thread settings" style="width:320px;max-width:100%">
        <section class="section">
          <div class="row-between"><h2>Counted stitches</h2><span class="dim" style="font-size:12px">snap to holes</span></div>
          <div class="tile-grid">${COUNTED.map(tile).join('')}</div>
          <div class="row-between" style="margin-top:6px"><h2>Freeform stitches</h2><span class="dim" style="font-size:12px">follow a path</span></div>
          <div class="tile-grid">${FREEFORM.map(tile).join('')}</div>
        </section>

        <section class="section">
          <h2>Thread</h2>
          <div style="display:flex;flex-direction:column;gap:8px">
            <span class="muted" style="font-size:12px">Strands</span>
            <div class="seg" role="group" aria-label="Strands" style="grid-template-columns:repeat(6,minmax(0,1fr))">
              ${[1, 2, 3, 4, 5, 6].map((n) => `<button data-act="strands" data-arg="${n}" ${pressed(s.strands === n)}>${n}</button>`).join('')}
            </div>
          </div>
          <label class="slider"><span class="row-between"><span>Sheen</span><span class="val">62</span></span><input type="range" min="0" max="100" value="62"></label>
          <label class="slider"><span class="row-between"><span>Tension</span><span class="val">firm</span></span><input type="range" min="0" max="100" value="70"></label>
          <label class="slider"><span>Fabric</span>
            <select class="select">
              <option>Aida · 14 count</option><option>Aida · 11 count</option><option>Aida · 16 count</option>
              <option>Aida · 18 count</option><option>Evenweave · 28 count</option><option>Linen · 32 count</option>
            </select>
          </label>
        </section>

        <section class="section">
          <div class="row-center">
            <h2>Wear</h2>
            <button class="switch" role="switch" aria-label="Wear" aria-checked="${s.wear}" data-act="wear"></button>
          </div>
          <p class="note">Rubbing over stitches dulls, fuzzes, splits and finally snaps the thread.</p>
          <div class="seg" role="group" aria-label="After rubbing" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <button data-act="keep" data-arg="false" ${pressed(!s.keep)}>Heals slowly</button>
            <button data-act="keep" data-arg="true" ${pressed(s.keep)}>Stays worn</button>
          </div>
        </section>
      </aside>
    </div>

    <footer class="status-bar mono">
      <span>${cells.length} stitches · 3 colours · ~1.4 m floss</span>
      <span>Drag to stitch · hold Space to pan · rub with the cursor to wear</span>
    </footer>`;
  }
};
