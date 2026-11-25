// Films a reel page to video: the page plays itself (reel.play(): its own drawn hands drive the sliders), and
// this captures it with Chromium's screencast, headless, and joins the frames with ffmpeg.
//   node reel/record.mjs [page url] [out.mp4] [width] [height]   (the page's size in css px; landscape comes out
//   1920 wide, square and portrait 1080)
// Needs a Chromium browser (CHROME=path, Brave by default) and ffmpeg, and a static server for the page (npx serve . or similar).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const URL_ = process.argv[2] || 'http://127.0.0.1:5181/reel/index.html';
const OUT = resolve(process.argv[3] || 'reel/out/slider-progression.mp4');
const W = Number(process.argv[4] || 400), H = Number(process.argv[5] || 400);
const FRAMES = resolve(OUT.replace(/\.mp4$/, '-frames'));
const CHROME = process.env.CHROME || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'; // any current Chromium
const OUT_W = W > H ? 1920 : 1080; // landscape 1920 wide, square and portrait 1080
const PORT = 9333, SCALE = OUT_W / W;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
const profile = join(FRAMES, '..', 'chrome-profile');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--hide-scrollbars', '--force-color-profile=srgb', '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const frames = [];
try {
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); return; }
    if (msg.method === 'Page.screencastFrame') {
      const { data, metadata, sessionId } = msg.params;
      const file = join(FRAMES, `f${String(frames.length).padStart(5, '0')}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file, t: metadata.timestamp });
      send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  await send('Page.navigate', { url: URL_ + (URL_.includes('?') ? '&' : '?') + 'record' }); // ?record: the page waits for play() instead of looping
  for (let i = 0; i < 100 && !(await evaluate('!!window.reel && document.fonts.status === "loaded"')); i++) await sleep(100);
  await sleep(400);

  await send('Page.startScreencast', { format: 'png', maxWidth: OUT_W, maxHeight: Math.round(H * SCALE), everyNthFrame: 1 });
  await evaluate('reel.play()'); // the page plays itself; this films it
  const values = await evaluate('reel.values?.()');
  if (values) console.log('values each slider ended on:', values.join(' '));
  await send('Page.stopScreencast');
  await sleep(300);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

// frames come only when something changed: each lasts until the next one
const end = frames.at(-1).t + 0.04;
const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
writeFileSync(join(FRAMES, 'list.txt'), list);
mkdirSync(resolve(OUT, '..'), { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(FRAMES, 'list.txt'), '-vf', `fps=60,scale=${OUT_W}:${Math.round(H * SCALE / 2) * 2}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart', OUT]);
console.log(`${frames.length} frames, ${(end - frames[0].t).toFixed(1)}s → ${OUT}`);
