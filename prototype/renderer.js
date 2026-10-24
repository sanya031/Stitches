// WebGL2 thread renderer: procedural Aida, instanced two-ply cross-stitch legs, stray fibres.
// World units are fabric squares (one Aida block). y points down, z points at the viewer.

const SHARED = `#version 300 es
precision highp float;
uniform vec2 uCenter;   // camera centre, cells
uniform float uScale;   // device px per cell
uniform vec2 uRes;      // device px
uniform vec3 uLight;    // unit vector towards the light
vec2 proj(vec2 p) { vec2 c = (p - uCenter) * uScale / (uRes * 0.5); return vec2(c.x, -c.y); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
`;

// ---------- fabric: one quad, procedural Aida weave ----------

const FABRIC_VS = SHARED + `
layout(location = 0) in vec2 aCorner;
uniform vec4 uQuad;
out vec2 vP;
void main() { vP = mix(uQuad.xy, uQuad.zw, aCorner); gl_Position = vec4(proj(vP), 0, 1); }
`;

const FABRIC_FS = SHARED + `
in vec2 vP;
uniform vec4 uRect;     // fabric edges, cells
uniform vec3 uLinen;    // sRGB
out vec4 o;

const float BW = 0.41;  // half-width of a thread bundle; holes are what the bundles leave at the corners
float prof(float d) { float t = clamp(d / BW, -1.0, 1.0); return sqrt(1.0 - t * t); }

// Height of the weave. Weft (horizontal) and warp (vertical) bundles of 4 threads
// go over and under in a checkerboard; 'tid' identifies the visible thread for colour variation.
float weave(vec2 p, float thr, out float tid) {
  vec2 c = floor(p), f = p - c - 0.5;
  float s = mod(c.x + c.y, 2.0) < 0.5 ? 1.0 : -1.0;
  float hh = prof(f.y), hv = prof(f.x);
  float ty = clamp((f.y + BW) / (2.0 * BW), 0.0, 0.999) * 4.0;
  float tx = clamp((f.x + BW) / (2.0 * BW), 0.0, 0.999) * 4.0;
  float py = fract(ty) * 2.0 - 1.0, px = fract(tx) * 2.0 - 1.0;
  hh *= mix(1.0, 0.68 + 0.32 * sqrt(1.0 - py * py), thr);
  hv *= mix(1.0, 0.68 + 0.32 * sqrt(1.0 - px * px), thr);
  hh += (vnoise(vec2(p.x * 6.0, p.y * 80.0)) - 0.5) * 0.14 * thr * step(0.001, hh);
  hv += (vnoise(vec2(p.x * 80.0, p.y * 6.0)) - 0.5) * 0.14 * thr * step(0.001, hv);
  float fine = smoothstep(90.0, 260.0, uScale);   // individual fibres, only when they are pixels wide
  hh += (vnoise(vec2(p.x * 18.0, p.y * 320.0)) - 0.5) * 0.08 * fine * step(0.001, hh);
  hv += (vnoise(vec2(p.x * 320.0, p.y * 18.0)) - 0.5) * 0.08 * fine * step(0.001, hv);
  hh *= 0.84 + 0.16 * s * cos(3.14159 * f.x);
  hv *= 0.84 - 0.16 * s * cos(3.14159 * f.y);
  tid = hh > hv ? c.y * 4.0 + floor(ty) : c.x * 4.0 + floor(tx) + 1000.0;
  return max(hh, hv);
}

void main() {
  vec2 lo = uRect.xy, hi = uRect.zw;
  float px = 1.0 / uScale;
  float outside = max(max(lo.x - vP.x, vP.x - hi.x), max(lo.y - vP.y, vP.y - hi.y));
  float inside = 1.0 - smoothstep(-px, px, outside);

  // soft drop shadow of the cloth onto the bench
  vec2 sp = vP - vec2(0.18, 0.26);
  float sd = length(max(max(lo - sp, sp - hi), 0.0));
  float shadow = (1.0 - smoothstep(0.0, 1.1, sd)) * 0.6;

  float weaveD = smoothstep(4.0, 10.0, uScale);   // holes and bundles
  float thr = smoothstep(14.0, 40.0, uScale);    // individual threads and fibres
  float tid, t2;
  float h = weave(vP, thr, tid);
  float e = clamp(1.0 / uScale, 0.0012, 0.01);
  float hx = weave(vP + vec2(e, 0), thr, t2);
  float hy = weave(vP + vec2(0, e), thr, t2);
  const float HS = 0.11;  // bundle height, cells
  vec3 n = normalize(vec3(-(hx - h) / e * HS, -(hy - h) / e * HS, 1.0));
  n = normalize(mix(vec3(0, 0, 1), n, weaveD));

  vec3 lin = toLinear(uLinen) * (0.95 + 0.08 * hash12(vec2(tid, 3.1)) * thr);
  float diff = max(dot(n, uLight), 0.0);
  float ao = mix(0.62, 1.0, smoothstep(0.05, 0.7, h));
  vec3 col = lin * (0.4 + 0.75 * diff) * ao;
  float hole = 1.0 - smoothstep(0.0, 0.14, h);
  col = mix(col, vec3(0.010, 0.009, 0.008), hole);
  vec3 avg = lin * (0.4 + 0.75 * uLight.z) * 0.9;
  col = mix(avg, col, weaveD);

  o = vec4(toSRGB(col), 1.0) * inside + vec4(0, 0, 0, shadow) * (1.0 - inside);
}
`;

// ---------- stitch legs: instanced ribbons ----------

const LEG_VS = SHARED + `
layout(location = 0) in vec2 aCorner;  // u along 0..1, side -1/1
layout(location = 1) in vec4 aEnds;    // hole a, hole b
layout(location = 2) in vec4 aCol;     // rgb, seed
layout(location = 3) in vec2 aBow;     // lateral bow, width multiplier
uniform float uWidth, uFar, uShadow;
uniform vec2 uShadowOff;
out vec2 vUV;
out vec3 vCol;
out float vSeed, vLen, vPinch;
flat out vec2 vAxis;
const float PAD = 1.25;   // extra ribbon width so edges can be antialiased in the fragment shader
void main() {
  vec2 a = aEnds.xy, b = aEnds.zw, d = b - a;
  float L = length(d);
  vec2 A = d / L, N = vec2(-A.y, A.x);
  float u = aCorner.x;
  // thread compresses as it dives into a hole; at far zoom legs fatten into a colour blob
  float pinch = mix(mix(0.5, 1.0, smoothstep(0.0, 0.22, min(u, 1.0 - u))), 1.0, uFar);
  float hw = 0.5 * uWidth * aBow.y * mix(1.0, 1.8, uFar) * pinch;
  if (uShadow > 0.5) hw *= 1.35;
  vec2 P = a + d * u + N * aBow.x * 4.0 * u * (1.0 - u) + N * aCorner.y * hw * PAD;
  if (uShadow > 0.5) P += uShadowOff;
  vUV = vec2(u, aCorner.y * PAD);
  vCol = aCol.rgb; vSeed = aCol.a; vLen = L; vPinch = pinch * aBow.y; vAxis = A;
  gl_Position = vec4(proj(P), 0, 1);
}
`;

const LEG_FS = SHARED + `
in vec2 vUV;
in vec3 vCol;
in float vSeed, vLen, vPinch;
flat in vec2 vAxis;
uniform float uWidth, uFar, uShadow;
out vec4 o;

const float COTA = 1.43;   // cot(helix angle): plies twist at ~35 deg to the leg

void main() {
  float u = vUV.x, v = vUV.y, av = abs(v);
  float endD = min(u, 1.0 - u) * vLen;   // distance to the hole, cells
  if (uShadow > 0.5) {
    o = vec4(0, 0, 0, (1.0 - smoothstep(0.1, 1.25, av)) * smoothstep(0.0, 0.2, endD) * 0.45);
    return;
  }
  float aa = fwidth(v) * 1.2;
  float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, av);
  if (cover < 0.002) discard;

  // The leg is a round cord: v is the position across it, zc its height.
  float vc = clamp(v, -0.98, 0.98), zc = sqrt(1.0 - vc * vc);
  float W = uWidth;
  float s = u * vLen;                               // along the leg, cells
  float t = asin(vc) * 0.5 * W * vPinch;            // around the cord surface, cells

  // Two plies: grooves between them run at the helix angle; consecutive segments alternate ply.
  float spacing = 0.87 * W;
  float q = (s - t * COTA) / spacing + vSeed * 13.0;
  float c = fract(q) * 2.0 - 1.0;                   // position across the visible ply segment
  float ply = mod(floor(q), 2.0);
  float bulge = sqrt(max(0.0, 1.0 - c * c));
  float gD = smoothstep(2.5, 7.0, spacing * uScale) * (1.0 - uFar);   // ply detail, fades before it aliases

  // Fibres run along the ply; their striations need ~2px each before they show.
  vec2 Tl = normalize(vec2(COTA, 1.0)), Pl = vec2(-Tl.y, Tl.x);
  float fw = W * 0.04;
  float fn = vnoise(vec2(dot(vec2(s, t), Pl) / fw, dot(vec2(s, t), Tl) / (W * 0.6) + vSeed * 31.0));
  float fD = smoothstep(1.5, 4.0, fw * uScale) * gD;

  vec2 g = normalize(vec2(1.0, -COTA));
  vec3 nL = normalize(vec3(g.x * c * 0.9 * gD, vc * (1.0 - 0.6 * uFar) + g.y * c * 0.9 * gD * zc, zc));
  // Fibre tangent wraps the cord and tilts with the ply's own curvature: this moves the sheen along the twist.
  vec3 T3 = vec3(Tl.x, Tl.y * zc, -Tl.y * vc);
  T3 = normalize(T3 + nL * (c * 0.6 * gD + (fn - 0.5) * 0.35 * fD));

  vec2 A = vAxis, N = vec2(-A.y, A.x);
  vec3 n = vec3(A * nL.x + N * nL.y, nL.z);
  vec3 T = normalize(vec3(A * T3.x + N * T3.y, T3.z));

  vec3 L = uLight, H = normalize(L + vec3(0, 0, 1));
  float ndl = dot(n, L);
  float diff = clamp(ndl * 0.6 + 0.45, 0.0, 1.0);
  float th = dot(T, H), sth = sqrt(max(0.0, 1.0 - th * th));   // Kajiya-Kay
  float spec = (pow(sth, 60.0) * 0.38 + pow(sth, 8.0) * 0.07) * smoothstep(-0.1, 0.3, ndl);
  spec *= mix(1.0, 0.25 + 1.5 * fn, fD) * (1.0 - 0.7 * uFar);

  float ao = mix(1.0, 0.58 + 0.42 * smoothstep(0.0, 0.7, bulge), gD);
  ao *= mix(mix(0.5, 1.0, smoothstep(0.02, 0.26, endD)), 1.0, uFar);
  ao *= mix(0.72, 1.0, mix(zc, 1.0, uFar * 0.7));

  vec3 base = toLinear(vCol) * (1.0 + (ply - 0.5) * 0.07 * gD) * mix(1.0, 0.78 + 0.36 * fn, fD);
  vec3 col = base * diff * ao * 1.1 + spec * mix(vec3(1.0), base * 2.5, 0.3) * ao;
  o = vec4(toSRGB(col) * cover, cover);
}
`;

// ---------- stray fibres: instanced quadratic Bezier hairs ----------

const HAIR_VS = SHARED + `
layout(location = 0) in vec2 aCorner;  // t 0..1, side -1/1
layout(location = 1) in vec4 aP01;
layout(location = 2) in vec4 aP2W;     // p2, width (cells), alpha
layout(location = 3) in vec4 aCol;     // rgb, 1 = loop (both ends anchored)
uniform float uFade;
out float vV, vA;
out vec3 vCol;
out vec2 vT;
void main() {
  float t = aCorner.x;
  vec2 p0 = aP01.xy, p1 = aP01.zw, p2 = aP2W.xy;
  vec2 B = mix(mix(p0, p1, t), mix(p1, p2, t), t);
  vec2 T = normalize((1.0 - t) * (p1 - p0) + t * (p2 - p1) + 1e-6), N = vec2(-T.y, T.x);
  float w = aP2W.z, minW = 1.3 / uScale;   // never thinner than ~1px; fade instead
  float taper = aCol.a > 0.5 ? smoothstep(0.0, 0.2, t) * smoothstep(1.0, 0.8, t) : smoothstep(0.0, 0.2, t) * mix(1.0, 0.3, t);
  vA = aP2W.w * min(1.0, w / minW) * uFade * taper;
  vV = aCorner.y; vCol = aCol.rgb; vT = T;
  gl_Position = vec4(proj(B + N * aCorner.y * max(w, minW) * 0.5), 0, 1);
}
`;

const HAIR_FS = SHARED + `
in float vV, vA;
in vec3 vCol;
in vec2 vT;
out vec4 o;
void main() {
  float a = vA * (1.0 - smoothstep(0.35, 1.0, abs(vV)));
  if (a < 0.003) discard;
  vec3 H = normalize(uLight + vec3(0, 0, 1));
  float th = dot(vec3(vT, 0), H);
  float spec = pow(sqrt(max(0.0, 1.0 - th * th)), 24.0) * 0.35;
  vec3 col = toLinear(vCol) * 1.05 + spec;
  o = vec4(toSRGB(col) * a, a);
}
`;

function compile(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const loc = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i).name;
    loc[name] = gl.getUniformLocation(prog, name);
  }
  // Uniforms a program doesn't use are compiled out; null makes gl.uniform* a no-op.
  return { prog, loc: new Proxy(loc, { get: (o, k) => o[k] ?? null }) };
}

/** Triangle strip with `steps` segments along t, two vertices (side -1, 1) per step. */
function stripGeometry(steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(i / steps, -1, i / steps, 1);
  return { data: new Float32Array(out), count: (steps + 1) * 2 };
}

function makeVAO(gl, geomBuf, instBuf, layout) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, geomBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  if (instBuf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    const stride = layout.reduce((s, n) => s + n, 0) * 4;
    let off = 0;
    layout.forEach((size, i) => {
      gl.enableVertexAttribArray(i + 1);
      gl.vertexAttribPointer(i + 1, size, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(i + 1, 1);
      off += size * 4;
    });
  }
  gl.bindVertexArray(null);
  return vao;
}

function buffer(gl, data) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
}

export const LEG_FLOATS = 10;   // ends(4) col+seed(4) bow,width(2)
export const HAIR_FLOATS = 12;  // p0 p1(4) p2 width alpha(4) col+loop(4)

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: true });
  if (!gl) return null;

  const fabric = compile(gl, FABRIC_VS, FABRIC_FS);
  const leg = compile(gl, LEG_VS, LEG_FS);
  const hair = compile(gl, HAIR_VS, HAIR_FS);

  const quadBuf = buffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]));
  const quadVAO = makeVAO(gl, quadBuf, null);
  const ribbon = stripGeometry(24);
  const ribbonBuf = buffer(gl, ribbon.data);
  const hairStrip = stripGeometry(12);
  const hairBuf = buffer(gl, hairStrip.data);

  let scene = null;

  function setScene({ fabricRect, linen, threadWidth, under, top, threadHairs, fabricHairs }) {
    const legSet = (arr) => ({ vao: makeVAO(gl, ribbonBuf, buffer(gl, arr), [4, 4, 2]), n: arr.length / LEG_FLOATS });
    const hairSet = (arr) => ({ vao: makeVAO(gl, hairBuf, buffer(gl, arr), [4, 4, 4]), n: arr.length / HAIR_FLOATS });
    scene = {
      fabricRect, linen, threadWidth,
      under: legSet(under), top: legSet(top),
      threadHairs: hairSet(threadHairs), fabricHairs: hairSet(fabricHairs)
    };
  }

  function shared(p, cam) {
    gl.useProgram(p.prog);
    gl.uniform2f(p.loc.uCenter, cam.x, cam.y);
    gl.uniform1f(p.loc.uScale, cam.scale);
    gl.uniform2f(p.loc.uRes, canvas.width, canvas.height);
    gl.uniform3fv(p.loc.uLight, cam.light);
  }

  /** cam: { x, y, scale (device px per cell), cssScale, light: [x,y,z] } */
  function draw(cam) {
    if (!scene) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0x12 / 255, 0x14 / 255, 0x18 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const [x0, y0, x1, y1] = scene.fabricRect;
    shared(fabric, cam);
    gl.uniform4f(fabric.loc.uQuad, x0 - 2, y0 - 2, x1 + 2, y1 + 2);
    gl.uniform4f(fabric.loc.uRect, x0, y0, x1, y1);
    gl.uniform3fv(fabric.loc.uLinen, scene.linen);
    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const drawHairs = (set, fade) => {
      if (fade <= 0.001 || !set.n) return;
      shared(hair, cam);
      gl.uniform1f(hair.loc.uFade, fade);
      gl.bindVertexArray(set.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, hairStrip.count, set.n);
    };
    const s = cam.cssScale;
    const ramp = (lo, hi) => Math.min(1, Math.max(0, (s - lo) / (hi - lo)));
    drawHairs(scene.fabricHairs, ramp(25, 80));

    // Blob-ness at far zoom, in CSS px so it looks the same on any screen.
    const far = 1 - ramp(4, 12);
    shared(leg, cam);
    gl.uniform1f(leg.loc.uWidth, scene.threadWidth);
    gl.uniform1f(leg.loc.uFar, far);
    // shadows fall away from the light; thread sits ~0.07 cells above the cloth
    const [lx, ly, lz] = cam.light;
    gl.uniform2f(leg.loc.uShadowOff, -lx / lz * 0.07, -ly / lz * 0.07);
    for (const set of [scene.under, scene.top]) {
      gl.bindVertexArray(set.vao);
      gl.uniform1f(leg.loc.uShadow, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, ribbon.count, set.n);
      gl.uniform1f(leg.loc.uShadow, 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, ribbon.count, set.n);
    }

    drawHairs(scene.threadHairs, ramp(35, 110));
    gl.bindVertexArray(null);
  }

  return { gl, setScene, draw };
}
