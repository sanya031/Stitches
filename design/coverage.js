// Coverage: the fabric's count, shown instead of named. A higher count is finer cloth, so on screen (where a square
// keeps its size) the same thread fills more of each square. Each option is that, drawn: a cross whose thread gets
// fuller from left to right; the word and the count are in the tooltip ("Light · 11 count"). A soft-cornered pill
// (icons), moving with the pill motion.
// coverageHtml(count) draws it; the options carry data-value (the count).
import { primitiveSvg } from './icons/primitives.js';

/** [count, word] from the lightest coverage to the fullest */
export const COVERAGE = [[11, 'Light'], [14, 'Regular'], [16, 'Full'], [18, 'Heavy']];
// how thick the drawn thread is for a count: past the real ratio, so the steps read at icon size
const strandsFor = (count) => 2 * (count / 14) ** 2;
let uid = 0;

export const coverageHtml = (cur) => `<div class="c-seg c-seg--soft c-seg--icons c-coverage" role="group" aria-label="Coverage" data-coverage>${COVERAGE.map(([n, w]) => `<button class="c-reset c-seg__opt c-focus" data-value="${n}" aria-label="${w} coverage, ${n} count" data-tip="${w} · ${n} count" aria-pressed="${Number(cur) === n}">${primitiveSvg('stitch-full', { size: 20, frame: 'square', animate: false, id: `cov-${uid++}`, strands: strandsFor(n) })}</button>`).join('')}</div>`;
