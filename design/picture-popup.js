// The picture pop-up: what a picture becomes. Opens from Pattern's Picture field, beside the panel like the colour
// picker. Sections like the panel's, each folding:
//   Image    the picture and what acts on it, one card (thumbnail and name; Crop, Rotate, Compare, Remove as one bar
//            of icons), then Remove background and Add stitches (on: the picture stitched over its pattern; off: the
//            pattern alone, to stitch over yourself)
//   Size     W | H as one split field; drag sideways on a number to change it, a click types in it
//   Colours  Simple / Balanced / Detailed (4, 8, 16), then the picture's own threads as pans: hover one for its cross
//            to fold it into its nearest neighbour, + adds one, dragging across them adds or merges; the palette morphs
//            (new colours split off their nearest, gone ones fold into theirs). Then Dither, then Saturation (starts at
//            130%: averaging a picture's colours into threads pulls them towards grey) and Brightness, stage sliders
//   Tones    Light, Mid, Dark side by side, each a box with only its stitch's drawing; the menu floats over the page
// The conversion is the lab's (lab/picture.js), so the palette and counts are real.
// createPicturePopup(root, { image, name, state, onChange(result), onClose, onAction(name, on), options(), fit }) →
//   options(): more for the conversion (an outline); fit: [cols, rows] the picture may take at most (the canvas)
//   { el, state, result(), thumb(), source() (the picture as cropped), turned() (whole, turned), rebuild(), setPicture(image, name) }.  onAction: 'crop', 'compare' (on or off: a click toggles it, a long press or C shows it while held), 'remove'.
// Styled by the picture-popup block of controls.css.
import { svg } from './icons/icons.js';
import { primitiveSvg } from './icons/primitives.js';
import { pans } from './colour-picker.js';
import { SEG_MOTIONS, createSegMotion, dialDefaults } from './seg-motion.js';
import { samplePicture, convertPicture, TONE_STITCHES } from '../lab/picture.js';
import { createStageSlider, STAGE_SETTINGS } from './stage-slider.js';

const ic = (n) => `<span class="c-ic">${svg(n)}</span>`;
const iconbtn = (n, label, extra = '') => `<button class="c-reset c-iconbtn c-iconbtn--sm c-focus" aria-label="${label}" data-tip="${label}" ${extra}>${ic(n)}</button>`;
const sw = (key, label, on) => `<button class="c-reset c-switch c-focus" role="switch" aria-checked="${on}" data-pp-switch="${key}">${label}<span class="c-seg c-seg--soft" aria-hidden="true">${['Off', 'On'].map((w, i) => `<span class="c-seg__opt" data-label="${w}" aria-pressed="${on === (i === 1)}">${w}</span>`).join('')}</span></button>`;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pillValues = dialDefaults(SEG_MOTIONS.squash.dials);

/** The words for a quick pick of how many colours */
export const COLOUR_WORDS = [[4, 'Simple'], [8, 'Balanced'], [16, 'Detailed']];
/** What a tone can become, by name (the lab's, without its direction marks) */
export const TONES = Object.fromEntries(Object.entries(TONE_STITCHES).filter(([k]) => ['none', 'full', 'half', 'f-tweed', 'rows', 'columns', 'hatch', 'seed'].includes(k)).map(([k, l]) => [k, l.replace(/ \/$/, '')]));
const TONE_ART = { full: 'stitch-full', half: 'stitch-half', 'f-tweed': 'fill-tweed', rows: 'fill-rows', columns: 'fill-columns', hatch: 'fill-hatch', seed: 'fill-seed' };
let uid = 0;
/** A tone's stitch as its drawing (Leave as pattern: the pattern tool's icon) */
export const toneArt = (v, size = 20) => (TONE_ART[v] ? primitiveSvg(TONE_ART[v], { size, id: `pp-${uid++}`, animate: false }) : v === 'none' ? svg('tool-pattern', { size }) : '');
// the palette's morph: a little over the pill's time, a ripple along the row
export const MORPH = { duration: 460, stagger: 18, easing: 'cubic-bezier(.22, 1, .36, 1)' };
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const nearestOf = (hex, list) => { const a = rgbOf(hex); return list.reduce((b, c) => { const d = rgbOf(c.hex).reduce((t, v, i) => t + (v - a[i]) ** 2, 0); return d < b[0] ? [d, c] : b; }, [Infinity, null])[1]; };
const LIMITS = { cols: [10, 140], rows: [10, 120] };

export function createPicturePopup(root, { image, name = 'picture', state = {}, onChange = () => {}, onClose = () => {}, onAction = () => {}, options = () => ({}), fit = [140, 120] } = {}) {
  // state: carried over from the last time it was open (pass the returned state back in), so closing loses nothing
  const S = { image, name, rot: 0, crop: { x: 0, y: 0, w: 1, h: 1 }, cols: 70, colours: 8, removed: new Set(), dither: false, saturation: STAGE_SETTINGS.saturation.initial, brightness: STAGE_SETTINGS.brightness.initial, removeBg: true, stitched: true, light: 'half', mid: 'full', dark: 'full', secs: {}, ...state, cropping: false, comparing: false };
  let result = null, thumb = '', menu = null, source = null, turned = null;

  // ─── the picture: turned, cropped, sampled to the grid, converted; colours taken out fold into the nearest left ───
  function rebuild() {
    const s = S.image, r = S.rot % 4, t = document.createElement('canvas');
    t.width = r % 2 ? s.height : s.width; t.height = r % 2 ? s.width : s.height;
    const x = t.getContext('2d'); x.translate(t.width / 2, t.height / 2); x.rotate(r * Math.PI / 2); x.drawImage(s, -s.width / 2, -s.height / 2);
    turned = t;
    const k = S.crop, src = document.createElement('canvas');
    src.width = Math.max(1, Math.round(t.width * k.w)); src.height = Math.max(1, Math.round(t.height * k.h));
    src.getContext('2d').drawImage(t, t.width * k.x, t.height * k.y, src.width, src.height, 0, 0, src.width, src.height);
    const th = document.createElement('canvas'); th.width = th.height = 64;
    const f = Math.max(64 / src.width, 64 / src.height); th.getContext('2d').drawImage(src, (64 - src.width * f) / 2, (64 - src.height * f) / 2, src.width * f, src.height * f);
    thumb = th.toDataURL(); source = src;
    result = convertPicture(samplePicture(src, Math.min(S.cols, fit[0]), fit[1]), { colours: S.colours, removeBg: S.removeBg, bgTolerance: 14, dither: S.dither, saturation: S.saturation / 100, brightness: S.brightness, light: S.light, mid: S.mid, dark: S.dark, lightShare: 0.25, darkShare: 0.2, outline: false, outlineStrength: 0, ...options() });
    if (S.removed.size) {
      const keep = result.palette.filter((p) => !S.removed.has(p.hex));
      if (keep.length) {
        const near = new Map(result.palette.filter((p) => S.removed.has(p.hex)).map((p) => [p.hex, nearestOf(p.hex, keep).hex]));
        const m = (h) => near.get(h) || h;
        for (const [key, h] of result.blocks) result.blocks.set(key, m(h));
        for (const st of result.stitches.values()) st.color = m(st.color);
        for (const reg of result.regions) reg.color = m(reg.color);
        result.palette = keep;
      }
    }
    onChange(result);
  }
  const threads = () => result.palette.filter((p) => !p.outline);

  // ─── drawn ───
  const sec = (key, title, body) => { const open = S.secs[key] !== false; return `<div class="c-panel__section" data-open="${open}"><div class="c-panel__sechead"><button class="c-reset c-section c-focus" aria-expanded="${open}" data-pp-sec="${key}">${title}${ic(open ? 'chevron-down' : 'chevron-right')}</button></div>${body}</div>`; };
  const paletteHtml = () => pans(threads().map((p) => p.hex.toUpperCase()), null, { del: true, add: S.colours < 24 ? 'more' : null }).replace(/Add this colour/g, 'One more colour').replace(/"Remove"/g, '"Merge into its neighbour"');
  const coloursHtml = () => `<div class="c-seg c-seg--soft c-picpop__words" role="group" aria-label="How many colours" data-pp-words>${COLOUR_WORDS.map(([n, l]) => `<button class="c-reset c-seg__opt c-focus" data-pp-colours="${n}" data-label="${l}" data-tip="${n} colours" aria-pressed="${S.colours === n && !S.removed.size}">${l}</button>`).join('')}</div>`
    + `<div class="c-picpop__palette" data-pp-palette data-tip="${threads().length} colours · drag sideways for more or fewer">${paletteHtml()}</div>`;
  function render() {
    root.classList.add('c-popover', 'c-picpop');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Picture');
    root.innerHTML = `<div class="c-picpop__head"><b>Picture</b>${iconbtn('close', 'Close', 'data-pp="close"')}</div>`
      + sec('image', 'Image', `<div class="c-imgcard"><div class="c-imgcard__top"><img src="${thumb}" alt=""><span class="c-picker__imgname">${S.name}</span></div>`
        + `<div class="c-toolbar" role="toolbar" aria-label="Picture tools">${iconbtn('crop', 'Crop', `data-pp="crop" aria-pressed="${S.cropping}"`)}${iconbtn('rotate', 'Rotate', 'data-pp="rotate"')}${iconbtn('compare', 'Compare', `data-pp="compare" aria-pressed="${S.comparing}" data-tip-key="C"`)}${iconbtn('bin', 'Remove picture', 'data-pp="remove"')}</div></div>`
        + sw('removeBg', 'Remove background', S.removeBg) + sw('stitched', 'Add stitches', S.stitched))
      + sec('size', 'Size', `<div class="c-field c-field--split c-field--pair" role="group" aria-label="Size in squares">${[['cols', 'W', result.cols, 'Squares across'], ['rows', 'H', result.rows, 'Squares down']].map(([k, l, v, tip]) => `<label class="c-field__cell c-field__cell--num" data-tip="${tip}" data-pp-scrub="${k}"><span class="c-field__letter" aria-hidden="true">${l}</span><input inputmode="numeric" value="${v}" aria-label="${tip}" data-pp-num="${k}"></label>`).join('')}</div>`)
      + sec('colours', 'Colours', `<div class="c-picpop__colours" data-pp-group>${coloursHtml()}</div>${sw('dither', 'Dither', S.dither)}<div data-pp-stage="saturation"></div><div data-pp-stage="brightness"></div>`)
      + sec('tones', 'Tones', `<div class="c-tones">${[['light', 'Light'], ['mid', 'Mid'], ['dark', 'Dark']].map(([k, l]) => `<div class="c-labelled"><span class="c-label">${l}</span><button class="c-reset c-select c-select--art c-focus" data-pp-tone="${k}" aria-haspopup="true" aria-label="${l}: ${TONES[S[k]]}" data-tip="${TONES[S[k]]}">${toneArt(S[k])}${ic('chevron-down')}</button></div>`).join('')}</div>`);
    root.querySelectorAll('.c-switch .c-seg, [data-pp-words]').forEach((el) => { el._motion = createSegMotion(el, () => pillValues); });
    // Saturation (starts richer than the picture) and Brightness: stage sliders; the palette morphs to the new threads
    root.querySelectorAll('[data-pp-stage]').forEach((host) => { const k = host.dataset.ppStage; createStageSlider(host, { setting: k, initial: S[k], onChange: (v) => { if (v === S[k]) return; morph(() => { S[k] = v; rebuild(); renderPalette(); }); } }); });
  }
  const renderColours = () => { const g = root.querySelector('[data-pp-group]'); if (!g) return; g.innerHTML = coloursHtml(); g.querySelectorAll('[data-pp-words]').forEach((el) => createSegMotion(el, () => pillValues)); };
  const renderPalette = () => { const p = root.querySelector('[data-pp-palette]'); if (p) { p.innerHTML = paletteHtml(); p.dataset.tip = `${threads().length} colours · drag sideways for more or fewer`; } };
  const renderSize = () => { root.querySelector('[data-pp-num="cols"]').value = result.cols; root.querySelector('[data-pp-num="rows"]').value = result.rows; };

  // ─── the palette morphs: what stays glides, a new colour splits off its nearest, a gone one folds into its nearest ───
  function morph(update) {
    const box = root.querySelector('[data-pp-palette]');
    if (!box || still()) { update(); return; }
    const before = [...box.querySelectorAll('.c-pan[data-pk-pick]')].map((el) => ({ hex: el.dataset.pkPick, r: el.getBoundingClientRect() }));
    update();
    const box2 = root.querySelector('[data-pp-palette]'); if (!box2) return;
    const after = [...box2.querySelectorAll('.c-pan[data-pk-pick]')].map((el) => ({ el, hex: el.dataset.pkPick, r: el.getBoundingClientRect() }));
    after.forEach(({ el, hex, r }, i) => {
      const same = before.find((b) => b.hex === hex), from = same || nearestOf(hex, before); if (!from) return;
      const o = { duration: MORPH.duration, easing: MORPH.easing, delay: i * MORPH.stagger, fill: 'backwards' }, sx = from.r.width / r.width;
      (el.closest('.c-panwrap') || el).animate([{ transform: `translate(${from.r.left - r.left}px, ${from.r.top - r.top}px) scale(${same ? sx : sx * 0.6})` }, { transform: 'none' }], o);
      if (!same) el.animate([{ background: from.hex, opacity: 0.6 }, { background: hex, opacity: 1 }], o);
    });
    const at = box2.getBoundingClientRect();
    before.filter((b) => !after.some((a) => a.hex === b.hex)).forEach((b, i) => {
      const to = nearestOf(b.hex, after); if (!to) return;
      const g = document.createElement('span'), r = b.r;
      g.className = 'c-picpop__fold';
      Object.assign(g.style, { left: `${r.left - at.left}px`, top: `${r.top - at.top}px`, width: `${r.width}px`, height: `${r.height}px`, background: b.hex });
      box2.append(g);
      g.animate([{ transform: 'none', opacity: 1, background: b.hex }, { transform: `translate(${to.r.left - r.left}px, ${to.r.top - r.top}px) scale(.4)`, opacity: 0, background: to.hex }], { duration: MORPH.duration, easing: MORPH.easing, delay: i * MORPH.stagger, fill: 'forwards' }).onfinish = () => g.remove();
      setTimeout(() => g.remove(), MORPH.duration + i * MORPH.stagger + 100);
    });
  }
  const setColours = (n) => morph(() => { S.colours = Math.max(2, Math.min(24, n)); S.removed.clear(); rebuild(); renderColours(); });
  // a word picked: its fill moves with the pill motion; only the palette under it redraws
  const pickWords = (n) => morph(() => { S.colours = n; S.removed.clear(); rebuild(); renderPalette(); });

  // ─── numbers: Across sets the size (Down follows the picture's shape); typed, arrow keys (shift for ten) or scrubbed ───
  function setNum(key, v) {
    if (!Number.isFinite(v)) return renderSize();
    const [lo, hi] = LIMITS[key]; v = Math.max(lo, Math.min(hi, Math.round(v)));
    S.cols = key === 'rows' ? Math.max(10, Math.round(v * result.cols / result.rows)) : v;
    rebuild(); renderSize();
  }

  // ─── the Tones menu: floats over the page under its box (above when there's no room), so the pop-up never moves ───
  function closeMenu() { menu?.el.remove(); menu?.btn.classList.remove('is-open'); menu = null; }
  function openMenu(btn) {
    const key = btn.dataset.ppTone; if (menu?.key === key) return closeMenu();
    closeMenu();
    const el = document.createElement('div'), cur = S[key];
    el.className = 'c-menu c-menu--float c-picker__stitchmenu';
    el.innerHTML = Object.entries(TONES).map(([v, l]) => `<button class="c-reset c-menu__item ${v === cur ? 'is-selected' : ''}" data-pp-pick="${v}">${toneArt(v)}${l}${v === cur ? `<span class="c-ic c-menu__end">${svg('check')}</span>` : ''}</button>`).join('');
    document.body.append(el); btn.classList.add('is-open'); menu = { el, btn, key };
    const r = btn.getBoundingClientRect(), w = Math.max(r.width, 184), h = el.offsetHeight, gap = 4, edge = 8;
    el.style.width = `${w}px`;
    el.style.left = `${Math.max(edge, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - edge))}px`;
    el.style.top = `${r.bottom + gap + h <= innerHeight - edge ? r.bottom + gap : Math.max(edge, r.top - gap - h)}px`;
    el.addEventListener('click', (e) => { const p = e.target.closest('[data-pp-pick]'); if (!p) return; S[key] = p.dataset.ppPick; closeMenu(); rebuild(); render(); });
  }

  // ─── events ───
  root.addEventListener('click', (e) => {
    const t = e.target;
    const s = t.closest('[data-pp-switch]');
    if (s) {
      const opt = t.closest('.c-seg__opt'), on = opt ? opt.dataset.label === 'On' : s.getAttribute('aria-checked') !== 'true';
      s.setAttribute('aria-checked', on); s.querySelectorAll('.c-seg__opt').forEach((o, i) => o.setAttribute('aria-pressed', i === (on ? 1 : 0))); s.querySelector('.c-seg')._motion?.select(on ? 1 : 0);
      S[s.dataset.ppSwitch] = on; morph(() => { rebuild(); renderPalette(); });
      return;
    }
    const secBtn = t.closest('[data-pp-sec]'); if (secBtn) { const k = secBtn.dataset.ppSec; S.secs[k] = S.secs[k] === false; render(); return; }
    const words = t.closest('[data-pp-colours]'); if (words) { pickWords(Number(words.dataset.ppColours)); return; }
    const del = t.closest('[data-pk-del]'); if (del) { if (threads().length > 2) morph(() => { S.removed.add(threads().find((q) => q.hex.toUpperCase() === del.dataset.pkDel)?.hex); rebuild(); renderColours(); }); return; }
    if (t.closest('[data-pk-add]')) { setColours(S.colours + 1); return; }
    const tone = t.closest('[data-pp-tone]'); if (tone) { openMenu(tone); return; }
    const act = t.closest('[data-pp]')?.dataset.pp;
    // closing ends what the pop-up started on the cloth: the crop frame and the compare overlay
    if (act === 'close') { compare(false); if (S.cropping) { S.cropping = false; onAction('crop', false); } onClose(); }
    if (act === 'rotate') { S.rot = (S.rot + 1) % 4; S.crop = { x: 1 - S.crop.y - S.crop.h, y: S.crop.x, w: S.crop.h, h: S.crop.w }; rebuild(); render(); }
    if (act === 'crop') { S.cropping = !S.cropping; t.closest('[data-pp]').setAttribute('aria-pressed', S.cropping); onAction('crop', S.cropping); }
    if (act === 'remove') onAction('remove');
  });
  // compare: a click on the button turns it on, another click off; held down (longer than COMPARE_HOLD ms) it shows only
  // while held, as holding C does
  const COMPARE_HOLD = 300;
  const compare = (on) => { if (S.comparing === on) return; S.comparing = on; root.querySelector('[data-pp="compare"]')?.setAttribute('aria-pressed', on); onAction('compare', on); };
  let comparePress = null;
  root.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('[data-pp="compare"]')) return;
    if (S.comparing) { compare(false); comparePress = null; return; }
    compare(true); comparePress = performance.now();
  });
  const compareUp = () => { if (comparePress != null && performance.now() - comparePress > COMPARE_HOLD) compare(false); comparePress = null; };
  const keydown = (e) => {
    const n = e.target.closest?.('[data-pp-num]');
    if (n && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); setNum(n.dataset.ppNum, Number(n.value) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); return; }
    if (n && e.key === 'Enter') { n.blur(); return; }
    if (e.target.closest?.('input')) return;
    if (e.key.toLowerCase() === 'c' && !e.repeat && root.isConnected) compare(true);
    if (e.key === 'Escape' && menu) { e.stopPropagation(); closeMenu(); }
  };
  const keyup = (e) => { if (e.key.toLowerCase() === 'c') compare(false); };
  root.addEventListener('change', (e) => { const n = e.target.closest('[data-pp-num]'); if (n) setNum(n.dataset.ppNum, Number(n.value)); });
  // drag sideways: on a number to scrub it (a step every 4px), across the palette for more or fewer colours (every 16px)
  let drag = null, dragT = 0;
  root.addEventListener('pointerdown', (e) => {
    const num = e.target.closest('[data-pp-scrub]'), pal = e.target.closest('[data-pp-palette]');
    if (num) { const input = num.querySelector('input'); if (document.activeElement === input) return; e.preventDefault(); drag = { kind: 'num', key: num.dataset.ppScrub, input, x: e.clientX, from: Number(input.value), moved: false }; }
    else if (pal && !e.target.closest('[data-pk-del], [data-pk-add]')) drag = { kind: 'pal', x: e.clientX, from: threads().length, moved: false };
  });
  const move = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; if (!drag.moved && Math.abs(dx) < 3) return;
    drag.moved = true; document.body.style.cursor = 'ew-resize';
    if (drag.kind === 'num') { const v = drag.from + Math.round(dx / 4), key = drag.key; drag.input.value = v; clearTimeout(dragT); dragT = setTimeout(() => setNum(key, v), 16); }
    else { const n = Math.max(2, Math.min(24, drag.from + Math.round(dx / 16))); if (n !== S.colours) setColours(n); }
  };
  const up = () => { if (!drag) return; if (drag.kind === 'num' && !drag.moved) { drag.input.focus(); drag.input.select(); } drag = null; document.body.style.cursor = ''; };
  const outside = (e) => { if (menu && !e.target.closest('.c-menu--float') && !e.target.closest('[data-pp-tone]')) closeMenu(); };
  const shift = (e) => { if (menu && !(e.target instanceof Element && e.target.closest('.c-menu--float'))) closeMenu(); };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointerup', compareUp); addEventListener('keydown', keydown, true); addEventListener('keyup', keyup);
  addEventListener('pointerdown', outside, true); addEventListener('scroll', shift, true); addEventListener('resize', closeMenu);

  rebuild(); render();
  return {
    el: root, state: S, result: () => result, thumb: () => thumb, source: () => source, turned: () => turned, rebuild: () => { rebuild(); renderSize(); },
    setPicture(img, nm) { S.image = img; S.name = nm; S.rot = 0; S.crop = { x: 0, y: 0, w: 1, h: 1 }; S.removed.clear(); rebuild(); render(); },
    destroy() {
      closeMenu();
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointerup', compareUp); removeEventListener('keydown', keydown, true); removeEventListener('keyup', keyup);
      removeEventListener('pointerdown', outside, true); removeEventListener('scroll', shift, true); removeEventListener('resize', closeMenu);
    },
  };
}
