// What each version of the slider is, and what it added and took out: the text of the reels.
// [version, what it is, added, removed]: changes are against the card before it
export const LOG = [
  ['v1', 'A plain range input. Dragging shows the stitch in a bubble.', ['Stitch preview bubble'], []],
  ['v3', 'The label moves above, and the number sits inside the box.', ['Live number, with decimals'], ['Label inside the box']],
  ['v4', 'The whole box is the slider. It fills up to a handle you pull.', ['Fill and a handle'], ['Track and thumb']],
  ['v6', 'A marker for every value. The most used one is bolder.', ['Markers to snap onto'], []],
  ['v8', 'At rest you see only the fill. Markers fade in on hover.', ['Markers on hover'], ['Markers always showing']],
  ['v10', 'The bubble draws a simple line stitch instead of thread.', ['Line stitch preview'], ['Thread on red cloth']],
  ['v14', 'The stitch moves into the box, so nothing floats over the panel.', ['Stitch beside the number', 'Whole numbers only'], ['Floating bubble']],
  ['v18.2', 'Stitch and number sit together on the left. Drag anywhere, or type.', ['Stitch leads the number'], ['Number on the far right']],
];
