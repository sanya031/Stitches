// The starter piece: three pink calla lilies, drawn here and run through Picture → thread.
// Coordinates are in a 1125 × 2000 frame, scaled to the canvas.

const PINK = '#E27AAA', PINK_SOFT = '#F2BCD3', CREAM = '#F5F1D6', GREEN = '#A7CB6E', STEM = '#6FAE4A';

/** Vertical colour ramp for a spathe: pink rim, blush, cream, green base. */
function spatheFill(x, top, bottom) {
  const g = x.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, PINK);
  g.addColorStop(0.28, PINK_SOFT);
  g.addColorStop(0.62, CREAM);
  g.addColorStop(1, GREEN);
  return g;
}

/**
 * Fine veins fanning up from the base to a row of tips along the rim, clipped to the petal
 * just filled (pass its path as `shape`). They give the satin its direction.
 */
function veins(x, shape, base, from, to, n, bend, colour) {
  x.save();
  shape();
  x.clip();
  x.strokeStyle = colour;
  x.lineWidth = 3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), tx = from[0] + (to[0] - from[0]) * t, ty = from[1] + (to[1] - from[1]) * t;
    x.beginPath();
    x.moveTo(...base);
    x.quadraticCurveTo((base[0] + tx) / 2 + bend * (t - 0.5), (base[1] + ty) / 2, tx, ty);
    x.stroke();
  }
  x.restore();
}

export function drawCallaLilies(width = 450, height = 800) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const x = c.getContext('2d');
  x.scale(width / 1125, height / 2000);
  // transparent background: only the flowers are stitched
  x.lineCap = 'round';
  x.lineJoin = 'round';

  // stems
  const stem = (pts, w) => {
    x.strokeStyle = STEM; x.lineWidth = w;
    x.beginPath(); x.moveTo(...pts[0]); x.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = w * 0.25;
    x.beginPath(); x.moveTo(pts[0][0] - w * 0.2, pts[0][1]); x.bezierCurveTo(pts[1][0] - w * 0.2, pts[1][1], pts[2][0] - w * 0.2, pts[2][1], pts[3][0] - w * 0.2, pts[3][1]); x.stroke();
  };
  stem([[345, 1470], [340, 1650], [350, 1850], [355, 2010]], 62);
  stem([[445, 1740], [440, 1830], [445, 1930], [450, 2010]], 46);
  stem([[630, 1680], [600, 1780], [575, 1900], [560, 2010]], 56);

  // back bud
  x.fillStyle = spatheFill(x, 1180, 1760);
  x.beginPath();
  x.moveTo(440, 1765);
  x.bezierCurveTo(360, 1600, 380, 1330, 520, 1180);
  x.bezierCurveTo(540, 1350, 530, 1600, 470, 1765);
  x.closePath(); x.fill();

  // left lily: outer spathe
  const leftOuter = () => {
    x.beginPath();
    x.moveTo(335, 1490);
    x.bezierCurveTo(220, 1300, 175, 1000, 150, 850);
    x.quadraticCurveTo(80, 780, 25, 700);
    x.bezierCurveTo(60, 560, 330, 470, 470, 430);
    x.quadraticCurveTo(530, 400, 560, 345);
    x.bezierCurveTo(690, 450, 700, 650, 575, 760);
    x.bezierCurveTo(470, 840, 405, 1150, 385, 1490);
    x.closePath();
  };
  x.fillStyle = spatheFill(x, 420, 1480);
  leftOuter(); x.fill();
  veins(x, leftOuter, [350, 1450], [30, 700], [640, 560], 16, -120, 'rgba(205,95,150,0.28)');
  // inside of the cup: pale, glowing
  const glow = x.createRadialGradient(330, 640, 20, 330, 640, 260);
  glow.addColorStop(0, '#FFFDF6'); glow.addColorStop(0.7, '#FBEFF0'); glow.addColorStop(1, 'rgba(250,230,238,0)');
  x.fillStyle = glow;
  x.beginPath();
  x.moveTo(110, 710);
  x.bezierCurveTo(200, 560, 470, 500, 600, 700);
  x.bezierCurveTo(470, 760, 330, 860, 250, 930);
  x.closePath(); x.fill();
  // spadix
  const sp = x.createLinearGradient(320, 0, 375, 0);
  sp.addColorStop(0, '#F6DC4A'); sp.addColorStop(1, '#D8A21E');
  x.fillStyle = sp;
  x.beginPath(); x.ellipse(347, 790, 27, 85, 0.04, 0, Math.PI * 2); x.fill();
  // front fold of the left lily
  const leftFold = () => {
    x.beginPath();
    x.moveTo(240, 960);
    x.bezierCurveTo(330, 860, 470, 770, 610, 725);
    x.bezierCurveTo(520, 900, 420, 1150, 395, 1490);
    x.bezierCurveTo(320, 1300, 265, 1110, 240, 960);
    x.closePath();
  };
  x.fillStyle = spatheFill(x, 700, 1480);
  leftFold(); x.fill();
  veins(x, leftFold, [385, 1480], [240, 960], [610, 725], 14, -80, 'rgba(190,110,140,0.26)');
  x.strokeStyle = '#D9679A'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(240, 960); x.bezierCurveTo(330, 860, 470, 770, 610, 725); x.stroke();
  // tip
  x.strokeStyle = '#7DB24E'; x.lineWidth = 14;
  x.beginPath(); x.moveTo(552, 360); x.quadraticCurveTo(555, 300, 575, 255); x.stroke();

  // right lily: outer spathe
  const rightOuter = () => {
    x.beginPath();
    x.moveTo(615, 1705);
    x.bezierCurveTo(520, 1500, 500, 1220, 515, 1060);
    x.quadraticCurveTo(495, 1020, 490, 1000);
    x.bezierCurveTo(560, 900, 800, 890, 1000, 960);
    x.quadraticCurveTo(1060, 980, 1085, 1015);
    x.quadraticCurveTo(1030, 995, 990, 1012);
    x.bezierCurveTo(850, 1100, 760, 1350, 660, 1705);
    x.closePath();
  };
  x.fillStyle = spatheFill(x, 900, 1700);
  rightOuter(); x.fill();
  // its front fold, a shade lighter
  const rf = x.createLinearGradient(0, 960, 0, 1700);
  rf.addColorStop(0, '#EE9DC2'); rf.addColorStop(0.35, '#F6CFDC'); rf.addColorStop(0.68, CREAM); rf.addColorStop(1, GREEN);
  x.fillStyle = rf;
  const rightFold = () => {
    x.beginPath();
    x.moveTo(560, 1010);
    x.bezierCurveTo(620, 965, 800, 950, 985, 985);
    x.bezierCurveTo(840, 1060, 720, 1300, 655, 1700);
    x.bezierCurveTo(570, 1500, 545, 1230, 560, 1010);
    x.closePath();
  };
  rightFold(); x.fill();
  veins(x, rightFold, [645, 1690], [555, 1015], [990, 985], 16, -100, 'rgba(205,95,150,0.26)');
  x.strokeStyle = '#D9679A'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(490, 1000); x.bezierCurveTo(560, 900, 800, 890, 1000, 960); x.stroke();
  x.strokeStyle = '#7DB24E'; x.lineWidth = 12;
  x.beginPath(); x.moveTo(1050, 985); x.quadraticCurveTo(1080, 990, 1090, 1020); x.stroke();

  return c;
}
