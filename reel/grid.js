// Every version of the strands slider at once, each in its own card: version, slider, what it is, what it added
// (green) and took out (red). A hand per slider; all of them move together: in, scrub up to 4 strands, away;
// then back down to 2, so the end meets the start and the video loops. Plays by itself; with ?record it waits
// for the recorder to call reel.play().
import { createStageSlider } from '../design/stage-slider.js';
import { VERSIONS } from '../design/slider-versions.js';
import { hexOf } from '../design/colour-field.js';
import { createHand, together, sleep } from './hands.js';
import { LOG as SHOW } from './log.js';

// the moves, ms
const T = { hold: 700, approach: 560, hover: 360, press: 140, over: 720, land: 460, release: 760, away: 520 };
const colour = hexOf('--terracotta-500');
const grid = document.getElementById('grid');

const cards = SHOW.map(([v, say, add, cut]) => {
  const def = VERSIONS[v], card = document.createElement('section');
  card.className = 'g-card';
  const diff = [...add.map((t) => `<span class="g-add">+ ${t}</span>`), ...cut.map((t) => `<span class="g-cut">− ${t}</span>`)].join('');
  card.innerHTML = `<span class="g-v">${v}</span><div class="g-slider${(def.layout || 'inline') === 'inline' ? ' g-slider--inline' : ''}"></div><p class="g-say">${say}</p><div class="g-diff">${diff}</div>`;
  grid.append(card);
  createStageSlider(card.querySelector('.g-slider'), { setting: 'strands', colour, style: def.style || 'thread', layout: def.layout || 'inline', editable: !!def.editable, tuning: { ...def.tuning, bubbleSize: Math.min(def.tuning.bubbleSize, 64) } }); // all bubbles open at once here, so each is kept small enough to stay off its neighbours
  return card;
});
const hands = cards.map((c, i) => createHand(c.querySelector('.ss'), i + 1));
// where each hand rests between moves: the card's empty bottom-right corner, clear of the text
const rest = (h, i) => { const r = cards[i].getBoundingClientRect(); return [r.right - 44, r.bottom - 40]; };
hands.forEach((h, i) => h.at(...rest(h, i)));

// one scrub: in, hover, press, past `over`, back to `land`, let go, away
async function scrub(over, land) {
  const grips = hands.map((h) => h.grip());
  await together(hands, (h, i) => [grips[i].x + 22, grips[i].y + 26], T.approach);
  hands.forEach((h) => h.hover(true));
  await together(hands, (h, i) => [grips[i].x, grips[i].y], T.hover / 2);
  await sleep(T.hover / 2);
  hands.forEach((h, i) => h.press(grips[i]));
  await sleep(T.press);
  const xAt = (i, pos) => grips[i].x + (pos - grips[i].pos) * grips[i].step;
  await together(hands, (h, i) => [xAt(i, over), grips[i].y], T.over);
  await together(hands, (h, i) => [xAt(i, land), grips[i].y + 1], T.land);
  hands.forEach((h) => h.release());
  await sleep(T.release);
  hands.forEach((h) => h.hover(false));
  await together(hands, rest, T.away);
}

window.reel = {
  /** one loop: up to 4 strands, then back to 2, starting and ending at rest */
  async play() {
    await sleep(T.hold);
    await scrub(4.45, 3.1);   // stops: 3 = 4 strands
    await sleep(T.hold * 1.6);
    await scrub(0.55, 0.9);   // back to 1 = 2 strands
    await sleep(T.hold);
  },
  /** bubbles that would cover the title or another card */
  clashes() {
    const title = document.querySelector('.g-title').getBoundingClientRect();
    return cards.map((c, i) => {
      const el = c.querySelector('.ss-bubble'), b = el.getBoundingClientRect(), hits = [];
      if (!b.width) return ''; // this version has no bubble
      if (b.top < title.bottom && b.left < title.right) hits.push('title');
      cards.forEach((o, k) => { if (k === i) return; const r = o.getBoundingClientRect(); if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) hits.push(SHOW[k][0]); });
      return hits.length ? `${SHOW[i][0]}: ${hits.join(', ')}` : '';
    }).filter(Boolean);
  },
  values() { return cards.map((c) => c.querySelector('input[type=range]').value); },
  /** text that spills out of its card */
  overflow() { return [...grid.querySelectorAll('.g-say, .g-diff > span')].filter((e) => e.getBoundingClientRect().right > e.closest('.g-card').getBoundingClientRect().right - 23.5 /* the card's padding */ || e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent); },
};
if (!location.search.includes('record')) (async () => { await document.fonts.ready; for (;;) await reel.play(); })();
