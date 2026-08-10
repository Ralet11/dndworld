import { useEffect, useRef } from 'react';

const EFFECT_TYPE = { fire: 1, ice: 2, acid: 3 };
const VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_time;
uniform float u_type;
uniform float u_scale;
uniform float u_seed;
uniform float u_intensity;
uniform float u_duration;
uniform float u_loop;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32 + u_seed);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + 1.), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  mat2 r = mat2(.8, -.6, .6, .8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03 + 17.1; a *= .5; }
  return v;
}
float lifetime() {
  if (u_loop > .5) return smoothstep(0., .35, u_time);
  return smoothstep(0., .22, u_time) * (1. - smoothstep(max(.4, u_duration - .65), u_duration, u_time));
}

vec4 fireFx(vec2 p, float t) {
  p.y += .12;
  float body = 1. - smoothstep(.08, .58, length(vec2(p.x * 1.35, p.y * .72)));
  body *= smoothstep(-.48, -.05, p.y) * (1. - smoothstep(.08, .68, p.y));
  float wind = sin(p.y * 7. + t * 1.4) * .18;
  float n = fbm(vec2((p.x + wind) * 5.4, p.y * 4. - t * 2.15));
  float flame = smoothstep(.26, .74, body * 1.25 + n * .74 - abs(p.x) * .28);
  float core = smoothstep(.48, .93, flame * (1.18 - max(p.y, 0.) * 1.25));
  vec3 col = mix(vec3(.38, .006, .001), vec3(1., .13, .006), smoothstep(.08, .64, flame));
  col = mix(col, vec3(1., .84, .24), core);
  vec2 cell = floor(vec2((p.x + .65) * 23., (p.y + t * .58) * 18.));
  vec2 uv = fract(vec2((p.x + .65) * 23., (p.y + t * .58) * 18.)) - .5;
  float sparks = step(.91, hash21(cell)) * smoothstep(.13, 0., length(uv)) * smoothstep(-.25, .76, p.y) * (1. - smoothstep(.66, .9, p.y));
  float smoke = fbm(p * 3.2 + vec2(0., -t * .34)) * body * smoothstep(.12, .62, p.y);
  col += sparks * vec3(1., .52, .08) * 2.2 + smoke * vec3(.075, .055, .045);
  return vec4(col, clamp(flame * .9 + sparks + smoke * .16, 0., .93));
}

vec4 iceFx(vec2 p, float t) {
  float r = length(p), a = atan(p.y, p.x);
  float breathe = .47 + sin(t * 1.6) * .018;
  float primary = pow(abs(cos(a * 6. + sin(a * 3.) * .44)), 19.);
  float secondary = pow(abs(cos(a * 11. - .72)), 36.) * .58;
  float shards = (primary + secondary) * (1. - smoothstep(.035, breathe, r));
  float ring = smoothstep(.032, 0., abs(r - breathe * .79));
  float frostNoise = fbm(p * 9. + vec2(t * .025, -t * .035));
  float frost = smoothstep(.51, .79, frostNoise + (breathe - r) * 1.85) * (1. - smoothstep(0., breathe * 1.16, r));
  float glint = pow(max(0., cos(a * 4. - t * 1.8)), 31.) * (1. - smoothstep(.04, .44, r));
  vec3 col = vec3(.12, .58, 1.) * (shards + ring * .72) + vec3(.68, .94, 1.) * (frost * .75 + glint);
  return vec4(col, clamp(shards + ring * .5 + frost * .62 + glint, 0., .9));
}

vec4 acidFx(vec2 p, float t) {
  p.y += .03;
  float r = length(vec2(p.x, p.y * .88));
  float radius = .43 + sin(t * 1.15) * .012;
  float warped = r + (fbm(p * 7.3 - vec2(0., t * .28)) - .5) * .105;
  float pool = 1. - smoothstep(radius - .025, radius + .055, warped);
  float rim = smoothstep(.026, 0., abs(warped - radius));
  vec2 grid = floor((p + .66) * 15.);
  vec2 uv = fract((p + .66) * 15.) - .5;
  float seed = hash21(grid);
  float bubble = step(.63, seed) * smoothstep(.038, .014, abs(length(uv) - (.075 + seed * .14))) * pool;
  float splash = pow(abs(cos(atan(p.y, p.x) * 9. + 1.1)), 29.) * smoothstep(radius * .85, radius * 1.2, r) * (1. - smoothstep(radius * 1.2, radius * 1.95, r));
  float vapor = fbm(p * 5. + vec2(0., -t * .5)) * pool * smoothstep(-.08, .42, p.y);
  vec3 col = vec3(.16, .78, .018) * pool + vec3(.72, 1., .08) * (rim + bubble * 1.45) + vec3(.4, .92, .08) * splash;
  return vec4(col + vapor * vec3(.07, .2, .025), clamp(pool * .6 + rim + bubble + splash * .68 + vapor * .14, 0., .87));
}

void main() {
  vec2 p = v_uv - u_center;
  p.x *= u_resolution.x / u_resolution.y;
  p /= max(.025, u_scale);
  vec4 fx = u_type < 1.5 ? fireFx(p, u_time) : (u_type < 2.5 ? iceFx(p, u_time) : acidFx(p, u_time));
  fx.a *= lifetime() * u_intensity;
  fx.rgb *= mix(.72, 1.28, clamp(u_intensity - .45, 0., 1.));
  outColor = fx;
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  const uniform = name => gl.getUniformLocation(program, name);
  return { gl, program, resolution: uniform('u_resolution'), center: uniform('u_center'), time: uniform('u_time'), type: uniform('u_type'), scale: uniform('u_scale'), seed: uniform('u_seed'), intensity: uniform('u_intensity'), duration: uniform('u_duration'), loop: uniform('u_loop') };
}

function numericSeed(value) {
  return String(value).split('').reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 997, 17) / 37;
}

function vfxSamples(effect, width, height) {
  const start = { x: (Number(effect.x) || 0) * width / 100, y: (Number(effect.y) || 0) * height / 100 };
  const end = {
    x: (Number(effect.end_x ?? effect.x) || 0) * width / 100,
    y: (Number(effect.end_y ?? effect.y) || 0) * height / 100,
  };
  const spacing = Math.max(26, (Number(effect.size) || 170) * .38);
  const along = (from, to, count) => Array.from({ length: count }, (_, index) => {
    const amount = count === 1 ? 0 : index / (count - 1);
    return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
  });
  if (effect.shape === 'line') {
    const count = Math.min(32, Math.max(2, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / spacing) + 1));
    return along(start, end, count);
  }
  if (effect.shape === 'circle') {
    const radius = Math.hypot(end.x - start.x, end.y - start.y);
    const count = Math.min(36, Math.max(8, Math.ceil((Math.PI * 2 * radius) / spacing)));
    return Array.from({ length: count }, (_, index) => {
      const angle = index / count * Math.PI * 2;
      return { x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius };
    });
  }
  if (effect.shape === 'square') {
    const corners = [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }];
    const points = [];
    corners.forEach((corner, index) => {
      const next = corners[(index + 1) % corners.length];
      const count = Math.min(12, Math.max(2, Math.ceil(Math.hypot(next.x - corner.x, next.y - corner.y) / spacing) + 1));
      points.push(...along(corner, next, count).slice(0, -1));
    });
    return points.slice(0, 40);
  }
  return [start];
}

export default function GameBoardVfx({ effects = [] }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !effects.length) return undefined;
    let renderer = rendererRef.current;
    try {
      renderer ||= createRenderer(canvasRef.current);
      rendererRef.current = renderer;
    } catch (error) {
      console.error('No se pudo iniciar el renderer VFX:', error);
      return undefined;
    }
    if (!renderer) return undefined;
    const { gl, program } = renderer;
    let frame = null;
    let stopped = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      if (stopped || !canvasRef.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      const width = Math.max(1, Math.round(canvasRef.current.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvasRef.current.clientHeight * dpr));
      if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.enable(gl.SCISSOR_TEST);
      gl.uniform2f(renderer.resolution, width, height);
      const timestamp = Date.now();
      let hasLiveEffect = false;
      effects.forEach(effect => {
        const type = EFFECT_TYPE[effect.type];
        if (!type) return;
        const duration = Math.max(1, Number(effect.duration) || 8);
        const elapsed = reducedMotion ? Math.min(.9, duration * .4) : Math.max(0, (timestamp - new Date(effect.started_at).getTime()) / 1000);
        if (!effect.loop && elapsed > duration) return;
        hasLiveEffect = true;
        gl.blendFunc(gl.SRC_ALPHA, type === 2 ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(renderer.time, elapsed);
        gl.uniform1f(renderer.type, type);
        gl.uniform1f(renderer.scale, (Math.max(60, Number(effect.size) || 170) * dpr) / height);
        gl.uniform1f(renderer.intensity, Math.max(.45, Math.min(1.45, Number(effect.intensity) || 1)));
        gl.uniform1f(renderer.duration, duration);
        gl.uniform1f(renderer.loop, effect.loop ? 1 : 0);
        const radius = Math.max(60, Number(effect.size) || 170) * dpr;
        vfxSamples(effect, width, height).forEach((sample, index) => {
          gl.uniform2f(renderer.center, sample.x / width, 1 - sample.y / height);
          gl.uniform1f(renderer.seed, numericSeed(effect.id) + index * .73);
          const left = Math.max(0, Math.floor(sample.x - radius));
          const bottom = Math.max(0, Math.floor(height - sample.y - radius));
          const right = Math.min(width, Math.ceil(sample.x + radius));
          const top = Math.min(height, Math.ceil(height - sample.y + radius));
          gl.scissor(left, bottom, Math.max(1, right - left), Math.max(1, top - bottom));
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        });
      });
      gl.disable(gl.SCISSOR_TEST);
      if (hasLiveEffect && !reducedMotion) frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
  }, [effects]);

  return <canvas ref={canvasRef} className="game-board-vfx" aria-hidden="true" />;
}
