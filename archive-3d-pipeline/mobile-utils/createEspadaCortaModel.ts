import * as THREE from 'three';


export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

// Plan 1.3 F.6 — sweep a thin 2D cross-section along a 3D spine so a curved
// form (hooked blade, handle) reads correctly from EVERY camera angle, not just
// the reference angle a flat extrude happens to match. Uses ExtrudeGeometry's
// native extrudePath; bevelEnabled: false keeps sharp tips (same rule as F.5).
function buildCurveSweepGeometry(
  sweep: { spine: [number, number, number][]; crossSection: { points: [number, number][] }; closed?: boolean },
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const cs = sweep.crossSection.points;
  if (cs.length > 0) {
    shape.moveTo(cs[0][0], cs[0][1]);
    for (let i = 1; i < cs.length; i += 1) shape.lineTo(cs[i][0], cs[i][1]);
    shape.closePath();
  }
  const spine = sweep.spine.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = new THREE.CatmullRomCurve3(spine, sweep.closed ?? false);
  return new THREE.ExtrudeGeometry(shape, {
    extrudePath: path,
    steps: Math.max(24, spine.length * 8),
    bevelEnabled: false,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  // React Native/Expo (Hermes) can have a minimal global `document` stub (from some
  // polyfill in the dependency tree) that passes `typeof document === 'undefined'`
  // checks without providing a real Canvas 2D implementation — creating a canvas here
  // then throws deep inside pixel-write helpers instead of failing this check up front.
  // Detect RN directly and skip procedural texture generation there; materials fall
  // back to their flat baseColor (see createSculptMaterial's `textures ?? ...` branch).
  const isReactNative = typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';
  if (isReactNative || typeof document === 'undefined') return null;
  try {
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext && probe.getContext('2d');
    if (!probeCtx || typeof probeCtx.createImageData !== 'function' || !probeCtx.createImageData(1, 1)?.data) {
      return null;
    }
  } catch {
    return null;
  }
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ['base'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Espada Corta
// Sculpt build pass: structural-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
// ---- variable-thickness loft (adapted from createGlockGhostProtocolModel.ts) ----
// A constant-depth extrude cannot carry a raised fuller ridge or a guard that's
// thicker at its diamond center than at its arm tips -- both need Z that varies
// per-point across the shape, not one fixed `depth`. This sweeps a 2D outline
// through ring parameters t in [-1,1] with Z = zAt(x, y, t) at every ring, so the
// cross-section is a real field instead of a slab.
const SW_LOFT_T: number[] = [-1, -0.9, -0.6, -0.2, 0.2, 0.6, 0.9, 1];

function swMix(a: number, b: number, t: number): number { return a + (b - a) * t; }

function swOffsetRing(ring: THREE.Vector2[], dAt: (p: THREE.Vector2) => number): THREE.Vector2[] {
  const n = ring.length;
  const nrm = (a: THREE.Vector2, b: THREE.Vector2) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return new THREE.Vector2(-dy / l, dx / l);
  };
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const n1 = nrm(ring[(i - 1 + n) % n], p);
    const n2 = nrm(p, ring[(i + 1) % n]);
    const b = new THREE.Vector2(n1.x + n2.x, n1.y + n2.y);
    if (b.lengthSq() < 1e-12) { out.push(p.clone()); continue; }
    b.normalize();
    const c = Math.max(0.45, b.dot(n1));
    const d = dAt(p) / c;
    out.push(new THREE.Vector2(p.x + b.x * d, p.y + b.y * d));
  }
  return out;
}

// Subdivide each cap triangle 4-ways `rounds` times, re-sampling zAt at every new
// interior vertex -- without this a bulge in the middle of a cap (the fuller ridge)
// has no vertices to displace and collapses flat between the outline points.
type SwTri = [number, number, number];
type SwZFn = (x: number, y: number, t: number) => number;

function swSubdivideCap(P: number[], tris: SwTri[], t: number, zAt: SwZFn, rounds: number, interior: number[]): SwTri[] {
  const key = (a: number, b: number) => (a < b ? a + ',' + b : b + ',' + a);
  for (let r = 0; r < rounds; r++) {
    const uses = new Map<string, number>();
    for (const tri of tris) {
      const a = tri[0], b = tri[1], c = tri[2];
      const edges: [number, number][] = [[a, b], [b, c], [c, a]];
      for (const e of edges) uses.set(key(e[0], e[1]), (uses.get(key(e[0], e[1])) || 0) + 1);
    }
    const mids = new Map<string, number>();
    const midOf = (a: number, b: number): number => {
      const k = key(a, b);
      const hit = mids.get(k);
      if (hit !== undefined) return hit;
      const x = (P[a * 3] + P[b * 3]) / 2;
      const y = (P[a * 3 + 1] + P[b * 3 + 1]) / 2;
      const i = P.length / 3;
      const edge = uses.get(k) === 1;
      P.push(x, y, edge ? (P[a * 3 + 2] + P[b * 3 + 2]) / 2 : zAt(x, y, t));
      if (!edge) interior.push(i);
      mids.set(k, i);
      return i;
    };
    const next: SwTri[] = [];
    for (const tri of tris) {
      const a = tri[0], b = tri[1], c = tri[2];
      const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }
  return tris;
}

// Overwrite cap-interior normals with the field's analytic gradient. computeVertexNormals
// averages face normals, and ear-clipping hands back slivers whose averaged normal swings
// wildly across a curved field -- the fuller ridge rendered as hard creases without this.
function swFieldNormals(g: THREE.BufferGeometry, zAt: SwZFn, t: number, interior: number[]): void {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const e = 0.004;
  const s = Math.sign(t);
  for (const i of interior) {
    const x = p.getX(i), y = p.getY(i);
    const fx = (zAt(x + e, y, t) - zAt(x - e, y, t)) / (2 * e);
    const fy = (zAt(x, y + e, t) - zAt(x, y - e, t)) / (2 * e);
    const l = Math.hypot(fx, fy, 1);
    n.setXYZ(i, (-s * fx) / l, (-s * fy) / l, s / l);
  }
}

function swLofted(shape: THREE.Shape, zAt: SwZFn, rollAt: (x: number, y: number) => number): THREE.BufferGeometry {
  const raw = shape.extractPoints(10);
  const dedupe = (r: THREE.Vector2[]) => (r.length > 1 && r[0].distanceToSquared(r[r.length - 1]) < 1e-12 ? r.slice(0, -1) : r);
  const orient = (r: THREE.Vector2[], cw: boolean) => (THREE.ShapeUtils.isClockWise(r) === cw ? r : r.slice().reverse());
  const contour = orient(dedupe(raw.shape), false);
  const holes = raw.holes.map((h) => orient(dedupe(h), true));
  const rings = [contour, ...holes];
  const perLayer = rings.reduce((a, r) => a + r.length, 0);
  const ringBase: number[] = [];
  rings.reduce((a, r) => { ringBase.push(a); return a + r.length; }, 0);
  const capFaces = THREE.ShapeUtils.triangulateShape(contour, holes) as unknown as SwTri[];

  const P: number[] = [];
  for (const t of SW_LOFT_T) {
    const k = 1 - Math.sqrt(Math.max(0, 1 - t * t));
    rings.forEach((ring) => {
      const off = swOffsetRing(ring, (p) => rollAt(p.x, p.y) * k);
      for (let i = 0; i < ring.length; i++) {
        P.push(off[i].x, off[i].y, zAt(ring[i].x, ring[i].y, t));
      }
    });
  }

  const last = (SW_LOFT_T.length - 1) * perLayer;
  const front: number[] = [], back: number[] = [], frontInner: number[] = [], backInner: number[] = [];
  const shifted: SwTri[] = capFaces.map((tri) => [last + tri[0], last + tri[1], last + tri[2]]);
  for (const tri of swSubdivideCap(P, shifted, 1, zAt, 2, frontInner)) front.push(tri[0], tri[1], tri[2]);
  for (const tri of swSubdivideCap(P, capFaces, -1, zAt, 2, backInner)) back.push(tri[2], tri[1], tri[0]);
  const walls: number[] = [];
  for (let ti = 0; ti < SW_LOFT_T.length - 1; ti++) {
    const lo = ti * perLayer, hi = (ti + 1) * perLayer;
    rings.forEach((ring, ri) => {
      const o = ringBase[ri];
      for (let j = 0; j < ring.length; j++) {
        const k = (j + 1) % ring.length;
        const a = o + j, b = o + k;
        walls.push(lo + a, lo + b, hi + a, lo + b, hi + b, hi + a);
      }
    });
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setIndex([...front, ...back, ...walls]);
  g.computeVertexNormals();
  swFieldNormals(g, zAt, 1, frontInner);
  swFieldNormals(g, zAt, -1, backInner);
  return g;
}

function swLerpTable(table: number[][], y: number): number {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (y <= table[i][0]) {
      const y0 = table[i - 1][0], v0 = table[i - 1][1], y1 = table[i][0], v1 = table[i][1];
      return swMix(v0, v1, (y - y0) / (y1 - y0));
    }
  }
  return table[table.length - 1][1];
}

// Half-width at each y, matching the blade outline points -- used to find how far a
// given x is from the centerline so the ridge thickness function knows where "center" is.
const SW_BLADE_WIDTH_TABLE: number[][] = [[-0.33, 0.020], [-0.20, 0.0235], [-0.02, 0.022], [0.15, 0.015], [0.27, 0.006], [0.33, 0.0005]];
function swBladeHalf(x: number, y: number): number {
  const w = swLerpTable(SW_BLADE_WIDTH_TABLE, y);
  if (w < 0.0003) return 0.0004;
  const nx = Math.min(1, Math.abs(x) / w);
  // Thick at the centerline (the fuller ridge), thin at the cutting edges -- a "tent"
  // cross-section: two facets meeting at a raised spine, per the reference breakdown
  // ("dos caras facetadas... divididas por la linea oscura del medio").
  return swMix(0.006, 0.0007, nx);
}

function swGuardHalf(x: number): number {
  const nx = Math.min(1, Math.abs(x) / 0.075);
  // Thick at the diamond center block, thinner out at the swept arm tips.
  return swMix(0.011, 0.005, nx);
}

export function createEspadaCortaModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Espada Corta";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["steel-blade"] = createSculptMaterial(
    "steel-blade",
    {"id": "steel-blade", "name": "Blade steel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#AEA98F", "color": "#AEA98F", "albedo": {"dominant": "#AEA98F", "secondary": ["#C9C4A6", "#7D7A66"], "samplingNotes": "Image-observed local color zones from reference_padded.png; not extracted via PBR script yet (pending material-evidence step)."}, "colorVariation": {"palette": ["#AEA98F", "#C9C4A6", "#7D7A66"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; keep texture budget low per performanceBudget."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.15, "role": "brushing/wrap-ridge relief"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.05, "role": "highlight breakup under grazing light"}], "roughness": {"base": 0.32, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities/creases, lower on worn/polished edges"}, "metalness": {"base": 0.85, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken seams between blade/guard/grip/pommel and the grip wrap-ridge valleys."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "fuller-polish", "description": "Lower roughness along the fuller ridge line vs. the flats — reads as a more worked/polished edge.", "region": "blade centerline", "roughness": 0.22, "evidenceRef": "zone-r0c1"}], "shaderNotes": ["MeshStandardMaterial is sufficient — no clearcoat/transmission observed.", "Generate albedo/roughness/normal independently; do not alias albedo into roughness."], "notes": "Satin steel, not mirror-polished — soft specular falloff on the flats, sharper highlight along the fuller."},
    options
  );
  materialMap["bronze-fittings"] = createSculptMaterial(
    "bronze-fittings",
    {"id": "bronze-fittings", "name": "Bronze guard/pommel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#B08D57", "color": "#B08D57", "albedo": {"dominant": "#B08D57", "secondary": ["#8C6A3D", "#D1AC72"], "samplingNotes": "Image-observed local color zones from reference_padded.png; not extracted via PBR script yet (pending material-evidence step)."}, "colorVariation": {"palette": ["#B08D57", "#8C6A3D", "#D1AC72"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; keep texture budget low per performanceBudget."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.15, "role": "brushing/wrap-ridge relief"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.05, "role": "highlight breakup under grazing light"}], "roughness": {"base": 0.38, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities/creases, lower on worn/polished edges"}, "metalness": {"base": 0.8, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken seams between blade/guard/grip/pommel and the grip wrap-ridge valleys."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["MeshStandardMaterial is sufficient — no clearcoat/transmission observed.", "Generate albedo/roughness/normal independently; do not alias albedo into roughness."], "notes": "Warmer-toned metal than the blade; guard and pommel share this material family per image_analysis.md layer 5 (uncertain vs. blade steel from this crop alone, flagged in unknowns)."},
    options
  );
  materialMap["leather-grip"] = createSculptMaterial(
    "leather-grip",
    {"id": "leather-grip", "name": "Leather-wrapped grip", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#5C4530", "color": "#5C4530", "albedo": {"dominant": "#5C4530", "secondary": ["#432F1F", "#71543A"], "samplingNotes": "Image-observed local color zones from reference_padded.png; not extracted via PBR script yet (pending material-evidence step)."}, "colorVariation": {"palette": ["#5C4530", "#432F1F", "#71543A"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; keep texture budget low per performanceBudget."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.15, "role": "brushing/wrap-ridge relief"}, {"id": "micro", "frequency": 40.0, "amplitude": 0.05, "role": "highlight breakup under grazing light"}], "roughness": {"base": 0.78, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities/creases, lower on worn/polished edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken seams between blade/guard/grip/pommel and the grip wrap-ridge valleys."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["MeshStandardMaterial is sufficient — no clearcoat/transmission observed.", "Generate albedo/roughness/normal independently; do not alias albedo into roughness."], "notes": "Non-metal, matte, fibrous — wrap ridges carried as real geometry per grip.geometryDescriptor, not painted into the normal map alone (antiShallowSpecRules)."},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Espada Corta__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Espada Corta", "level": "macro", "role": "container", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Empty organizational root; visible geometry lives entirely in its 4 macro children (blade, guard, grip, pommel).", "geometryDescriptor": {"topologyIntent": "no mesh on root", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative to grip midpoint", "confidence": 0.5}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": null, "materialLayers": [], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(150, 150, 150, 1.0)", "secondaryAlbedo": "rgba(120, 120, 120, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.3}};
  node_root_0.userData.actionProfile = {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(0.001, 0.001, 0.001, 1, 1, 1);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["steel-blade"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Espada Corta";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Espada Corta", "level": "macro", "role": "container", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Empty organizational root; visible geometry lives entirely in its 4 macro children (blade, guard, grip, pommel).", "geometryDescriptor": {"topologyIntent": "no mesh on root", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative to grip midpoint", "confidence": 0.5}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": null, "materialLayers": [], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(150, 150, 150, 1.0)", "secondaryAlbedo": "rgba(120, 120, 120, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.3}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_blade_1 = {"parentSocket": "root", "localStart": [0, 0.14, 0], "localEnd": [0, 0.8, 0], "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.022, "endRadius": 0.003};
  const endpoint_blade_1 = makeAttachmentEndpoint(attachment_blade_1);
  const node_blade_1 = new THREE.Group();
  node_blade_1.name = "Blade__pivot";
  if (endpoint_blade_1) {
    node_blade_1.position.copy(endpoint_blade_1.start);
    node_blade_1.rotation.set(0, 0, 0);
    node_blade_1.scale.set(1, 1, 1);
  } else {
    node_blade_1.position.set(0.0, 0.14, 0.0);
    node_blade_1.rotation.set(0.0, 0.0, 0.0);
    node_blade_1.scale.set(1.0, 1.0, 1.0);
  }
  node_blade_1.userData.sculptComponent = {"id": "blade", "name": "Blade", "level": "macro", "role": "primary-form", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Flat double-edged taper with a raised centerline fuller — modeled as an extruded diamond-ish cross-section profile lofted from root (wide) to tip (point), not a simple box, to carry the fuller ridge and taper accurately.", "geometryDescriptor": {"topologyIntent": "lofted extrude along +Y from a flattened-diamond cross-section at the root to a converged point at the tip", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.004, "segments": 2}, "deformationStack": ["linear taper (width and thickness both taper root->tip)"], "uvStrategy": "planar UV along the flat faces, seam at the centerline fuller", "normalStrategy": "computed vertex normals; centerline fuller kept as real geometry (not a normal-map fake) since it affects the grazing-light silhouette"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, 0.14, 0], "localEnd": [0, 0.8, 0], "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.022, "endRadius": 0.003}, "dimensions": {"width": 0.045, "height": 0.66, "depth": 0.012, "units": "relative to grip midpoint", "confidence": 0.8}, "transform": {"position": [0, 0.14, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0.14, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "steel-blade", "materialLayers": ["steel-blade"], "deformations": [], "joints": [], "seams": [{"withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02}], "localFeatures": [{"id": "fuller-spine", "description": "raised centerline ridge running the full blade length, splitting the two facets", "evidenceRef": "zone-r0c1"}, {"id": "blade-tip", "description": "symmetric double-edged point converging to a single apex", "evidenceRef": "zone-r0c1"}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "faint brushed-metal linear striation along the length", "displacementPattern": "none beyond the modeled fuller geometry", "occlusionPattern": "slight darkening at the fuller valley", "edgeWearPattern": "none observed — clean unweathered blade", "notes": "unknown: exact cross-section (flat vs diamond) not confirmed from this single frontal view"}, "evidenceRefs": ["full-object", "zone-r0c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(174, 169, 143, 1.0)", "secondaryAlbedo": "rgba(125, 122, 102, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.85}};
  node_blade_1.userData.actionProfile = {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0.14, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_blade_1);
  nodes["blade"] = node_blade_1;
  const mesh_blade_1Geometry = swLofted(buildExtrudeShape([[0.020,-0.33],[0.0235,-0.20],[0.022,-0.02],[0.015,0.15],[0.006,0.27],[0,0.33],[-0.006,0.27],[-0.015,0.15],[-0.022,-0.02],[-0.0235,-0.20],[-0.020,-0.33]]), (x,y,t) => t * swBladeHalf(x,y), () => 0);
  const mesh_blade_1 = new THREE.Mesh(
    mesh_blade_1Geometry,
    materialMap["steel-blade"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_blade_1.name = "Blade";
  if (endpoint_blade_1) {
    mesh_blade_1.position.copy(endpoint_blade_1.midpoint);
    mesh_blade_1.quaternion.copy(endpoint_blade_1.quaternion);
  }
  mesh_blade_1.castShadow = options.castShadow ?? true;
  mesh_blade_1.receiveShadow = options.receiveShadow ?? true;
  mesh_blade_1.userData.sculptComponent = {"id": "blade", "name": "Blade", "level": "macro", "role": "primary-form", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Flat double-edged taper with a raised centerline fuller — modeled as an extruded diamond-ish cross-section profile lofted from root (wide) to tip (point), not a simple box, to carry the fuller ridge and taper accurately.", "geometryDescriptor": {"topologyIntent": "lofted extrude along +Y from a flattened-diamond cross-section at the root to a converged point at the tip", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.004, "segments": 2}, "deformationStack": ["linear taper (width and thickness both taper root->tip)"], "uvStrategy": "planar UV along the flat faces, seam at the centerline fuller", "normalStrategy": "computed vertex normals; centerline fuller kept as real geometry (not a normal-map fake) since it affects the grazing-light silhouette"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, 0.14, 0], "localEnd": [0, 0.8, 0], "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.022, "endRadius": 0.003}, "dimensions": {"width": 0.045, "height": 0.66, "depth": 0.012, "units": "relative to grip midpoint", "confidence": 0.8}, "transform": {"position": [0, 0.14, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0.14, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "steel-blade", "materialLayers": ["steel-blade"], "deformations": [], "joints": [], "seams": [{"withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02}], "localFeatures": [{"id": "fuller-spine", "description": "raised centerline ridge running the full blade length, splitting the two facets", "evidenceRef": "zone-r0c1"}, {"id": "blade-tip", "description": "symmetric double-edged point converging to a single apex", "evidenceRef": "zone-r0c1"}], "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "faint brushed-metal linear striation along the length", "displacementPattern": "none beyond the modeled fuller geometry", "occlusionPattern": "slight darkening at the fuller valley", "edgeWearPattern": "none observed — clean unweathered blade", "notes": "unknown: exact cross-section (flat vs diamond) not confirmed from this single frontal view"}, "evidenceRefs": ["full-object", "zone-r0c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(174, 169, 143, 1.0)", "secondaryAlbedo": "rgba(125, 122, 102, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.85}};
  node_blade_1.add(mesh_blade_1);
  meshes["blade"] = mesh_blade_1;
  colliders["blade"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_blade_1);

  const attachment_guard_2 = {"parentSocket": "root", "localStart": [0, 0.1, 0], "localEnd": [0, 0.14, 0], "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.065, "endRadius": 0.05};
  const endpoint_guard_2 = makeAttachmentEndpoint(attachment_guard_2);
  const node_guard_2 = new THREE.Group();
  node_guard_2.name = "Guard__pivot";
  if (endpoint_guard_2) {
    node_guard_2.position.copy(endpoint_guard_2.start);
    node_guard_2.rotation.set(0, 0, 0);
    node_guard_2.scale.set(1, 1, 1);
  } else {
    node_guard_2.position.set(0.0, 0.1, 0.0);
    node_guard_2.rotation.set(0.0, 0.0, 0.0);
    node_guard_2.scale.set(1.0, 1.0, 1.0);
  }
  node_guard_2.userData.sculptComponent = {"id": "guard", "name": "Guard", "level": "macro", "role": "crossbar", "importance": 0.85, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Crescent crossbar with downturned tapered tips — a lofted curve profile swept and tapered toward each tip, not a straight box crossguard.", "geometryDescriptor": {"topologyIntent": "horizontal loft along local X, curving down toward +/-X extremes, tapering in thickness toward the tips", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.006, "segments": 3}, "deformationStack": ["downward bend toward each tip"], "uvStrategy": "planar UV along the sweep", "normalStrategy": "computed vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, 0.1, 0], "localEnd": [0, 0.14, 0], "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.065, "endRadius": 0.05}, "dimensions": {"width": 0.13, "height": 0.04, "depth": 0.018, "units": "relative to grip midpoint", "confidence": 0.8}, "transform": {"position": [0, 0.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0.1, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{"withComponentId": "blade", "type": "butt", "worldUnitOverlap": 0.02}, {"withComponentId": "grip", "type": "butt", "worldUnitOverlap": 0.02}], "localFeatures": [{"id": "guard-tips", "description": "swept, downturned, tapered tips on both sides (not blunt/straight)", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.015, "normalPattern": "satin metal micro-facets", "displacementPattern": "none", "occlusionPattern": "darkened crease where guard meets grip", "edgeWearPattern": "none observed", "notes": ""}, "evidenceRefs": ["full-object", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_guard_2.userData.actionProfile = {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0.1, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_guard_2);
  nodes["guard"] = node_guard_2;
  const mesh_guard_2Geometry = swLofted(buildExtrudeShape([[0,0.022],[0.018,0.006],[0.045,-0.004],[0.070,-0.014],[0.075,-0.026],[0.055,-0.010],[0.022,-0.001],[0,-0.018],[-0.022,-0.001],[-0.055,-0.010],[-0.075,-0.026],[-0.070,-0.014],[-0.045,-0.004],[-0.018,0.006]]), (x,y,t) => t * swGuardHalf(x), () => 0);
  const mesh_guard_2 = new THREE.Mesh(
    mesh_guard_2Geometry,
    materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_guard_2.name = "Guard";
  if (endpoint_guard_2) {
    mesh_guard_2.position.copy(endpoint_guard_2.midpoint);
    mesh_guard_2.quaternion.copy(endpoint_guard_2.quaternion);
  }
  mesh_guard_2.castShadow = options.castShadow ?? true;
  mesh_guard_2.receiveShadow = options.receiveShadow ?? true;
  mesh_guard_2.userData.sculptComponent = {"id": "guard", "name": "Guard", "level": "macro", "role": "crossbar", "importance": 0.85, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Crescent crossbar with downturned tapered tips — a lofted curve profile swept and tapered toward each tip, not a straight box crossguard.", "geometryDescriptor": {"topologyIntent": "horizontal loft along local X, curving down toward +/-X extremes, tapering in thickness toward the tips", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.006, "segments": 3}, "deformationStack": ["downward bend toward each tip"], "uvStrategy": "planar UV along the sweep", "normalStrategy": "computed vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, 0.1, 0], "localEnd": [0, 0.14, 0], "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.065, "endRadius": 0.05}, "dimensions": {"width": 0.13, "height": 0.04, "depth": 0.018, "units": "relative to grip midpoint", "confidence": 0.8}, "transform": {"position": [0, 0.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0.1, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{"withComponentId": "blade", "type": "butt", "worldUnitOverlap": 0.02}, {"withComponentId": "grip", "type": "butt", "worldUnitOverlap": 0.02}], "localFeatures": [{"id": "guard-tips", "description": "swept, downturned, tapered tips on both sides (not blunt/straight)", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.015, "normalPattern": "satin metal micro-facets", "displacementPattern": "none", "occlusionPattern": "darkened crease where guard meets grip", "edgeWearPattern": "none observed", "notes": ""}, "evidenceRefs": ["full-object", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75}};
  node_guard_2.add(mesh_guard_2);
  meshes["guard"] = mesh_guard_2;
  colliders["guard"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_guard_2);

  const attachment_grip_3 = {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, 0.1, 0], "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.011, "endRadius": 0.011};
  const endpoint_grip_3 = makeAttachmentEndpoint(attachment_grip_3);
  const node_grip_3 = new THREE.Group();
  node_grip_3.name = "Grip__pivot";
  if (endpoint_grip_3) {
    node_grip_3.position.copy(endpoint_grip_3.start);
    node_grip_3.rotation.set(0, 0, 0);
    node_grip_3.scale.set(1, 1, 1);
  } else {
    node_grip_3.position.set(0.0, 0.0, 0.0);
    node_grip_3.rotation.set(0.0, 0.0, 0.0);
    node_grip_3.scale.set(1.0, 1.0, 1.0);
  }
  node_grip_3.userData.sculptComponent = {"id": "grip", "name": "Grip", "level": "macro", "role": "handle", "importance": 0.7, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Cylinder with a repeated wrap-cord ridge pattern (repetitionSystems.grip-wrap) — this is the natural hand-hold and equip-socket alignment point.", "geometryDescriptor": {"topologyIntent": "cylinder core with radial ridge loops repeated along +Y per repetitionSystems.grip-wrap", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.003, "segments": 8}, "deformationStack": [], "uvStrategy": "cylindrical UV, V repeats per wrap ridge", "normalStrategy": "computed vertex normals + ridge geometry"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, 0.1, 0], "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.011, "endRadius": 0.011}, "dimensions": {"width": 0.022, "height": 0.21, "depth": 0.022, "units": "relative to grip midpoint", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0]}], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "leather-grip", "materialLayers": ["leather-grip"], "deformations": [], "joints": [], "seams": [{"withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02}, {"withComponentId": "pommel", "type": "butt", "worldUnitOverlap": 0.02}], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.8, "microRoughness": 0.35, "bumpAmplitude": 0.04, "normalPattern": "leather-wrap fiber grain between ridges", "displacementPattern": "wrap ridges are real geometry, not displacement", "occlusionPattern": "darkened valleys between wrap ridges", "edgeWearPattern": "none observed", "notes": ""}, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(92, 69, 48, 1.0)", "secondaryAlbedo": "rgba(67, 47, 31, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6}};
  node_grip_3.userData.actionProfile = {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0]}], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_grip_3);
  nodes["grip"] = node_grip_3;
  const mesh_grip_3Geometry = buildLatheGeometry({"points": [[0.009,-0.105],[0.0115,-0.095],[0.0095,-0.085],[0.012,-0.06],[0.010,-0.045],[0.0125,-0.02],[0.010,0.005],[0.012,0.03],[0.0095,0.05],[0.0115,0.075],[0.009,0.105]], "segments": 24});
  const mesh_grip_3 = new THREE.Mesh(
    mesh_grip_3Geometry,
    materialMap["leather-grip"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_grip_3.name = "Grip";
  if (endpoint_grip_3) {
    mesh_grip_3.position.copy(endpoint_grip_3.midpoint);
    mesh_grip_3.quaternion.copy(endpoint_grip_3.quaternion);
  }
  mesh_grip_3.castShadow = options.castShadow ?? true;
  mesh_grip_3.receiveShadow = options.receiveShadow ?? true;
  mesh_grip_3.userData.sculptComponent = {"id": "grip", "name": "Grip", "level": "macro", "role": "handle", "importance": 0.7, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Cylinder with a repeated wrap-cord ridge pattern (repetitionSystems.grip-wrap) — this is the natural hand-hold and equip-socket alignment point.", "geometryDescriptor": {"topologyIntent": "cylinder core with radial ridge loops repeated along +Y per repetitionSystems.grip-wrap", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.003, "segments": 8}, "deformationStack": [], "uvStrategy": "cylindrical UV, V repeats per wrap ridge", "normalStrategy": "computed vertex normals + ridge geometry"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, 0.1, 0], "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.011, "endRadius": 0.011}, "dimensions": {"width": 0.022, "height": 0.21, "depth": 0.022, "units": "relative to grip midpoint", "confidence": 0.8}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0]}], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "leather-grip", "materialLayers": ["leather-grip"], "deformations": [], "joints": [], "seams": [{"withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02}, {"withComponentId": "pommel", "type": "butt", "worldUnitOverlap": 0.02}], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.8, "microRoughness": 0.35, "bumpAmplitude": 0.04, "normalPattern": "leather-wrap fiber grain between ridges", "displacementPattern": "wrap ridges are real geometry, not displacement", "occlusionPattern": "darkened valleys between wrap ridges", "edgeWearPattern": "none observed", "notes": ""}, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(92, 69, 48, 1.0)", "secondaryAlbedo": "rgba(67, 47, 31, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6}};
  node_grip_3.add(mesh_grip_3);
  meshes["grip"] = mesh_grip_3;
  colliders["grip"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_grip_3);
  const socket_grip_hand_hold_0 = new THREE.Object3D();
  socket_grip_hand_hold_0.name = "hand-hold";
  socket_grip_hand_hold_0.position.set(0.0, 0.0, 0.0);
  socket_grip_hand_hold_0.rotation.set(0, 0, 0);
  socket_grip_hand_hold_0.userData.socket = {"id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0]};
  node_grip_3.add(socket_grip_hand_hold_0);
  sockets["grip:hand-hold"] = socket_grip_hand_hold_0;

  const attachment_pommel_4 = {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, -0.2, 0], "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.015, "endRadius": 0.002};
  const endpoint_pommel_4 = makeAttachmentEndpoint(attachment_pommel_4);
  const node_pommel_4 = new THREE.Group();
  node_pommel_4.name = "Pommel__pivot";
  if (endpoint_pommel_4) {
    node_pommel_4.position.copy(endpoint_pommel_4.start);
    node_pommel_4.rotation.set(0, 0, 0);
    node_pommel_4.scale.set(1, 1, 1);
  } else {
    node_pommel_4.position.set(0.0, -0.11, 0.0);
    node_pommel_4.rotation.set(0.0, 0.0, 0.0);
    node_pommel_4.scale.set(1.0, 1.0, 1.0);
  }
  node_pommel_4.userData.sculptComponent = {"id": "pommel", "name": "Pommel", "level": "macro", "role": "cap", "importance": 0.5, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Bulbous acorn/teardrop cap with a raised metal rim band at its base — a lathed/revolved profile, not a plain sphere or cone.", "geometryDescriptor": {"topologyIntent": "revolve a teardrop profile curve around +Y, with a distinct raised ring band at the top (grip-facing) edge", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.004, "segments": 2}, "deformationStack": [], "uvStrategy": "spherical UV", "normalStrategy": "computed vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, -0.2, 0], "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.015, "endRadius": 0.002}, "dimensions": {"width": 0.03, "height": 0.09, "depth": 0.03, "units": "relative to grip midpoint", "confidence": 0.75}, "transform": {"position": [0, -0.11, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, -0.11, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{"withComponentId": "grip", "type": "flush", "worldUnitOverlap": 0.02}], "localFeatures": [{"id": "pommel-rim-band", "description": "raised metal rim/band at the pommel's grip-facing base, distinct from the teardrop body", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.01, "normalPattern": "satin metal", "displacementPattern": "none", "occlusionPattern": "darkened crease under the rim band", "edgeWearPattern": "none observed", "notes": "back/underside hidden in this view — assumed rotationally symmetric"}, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7}};
  node_pommel_4.userData.actionProfile = {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, -0.11, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pommel_4);
  nodes["pommel"] = node_pommel_4;
  const mesh_pommel_4Geometry = buildLatheGeometry({"points": [[0.004,-0.045],[0.014,-0.020],[0.010,0.005],[0.008,0.025],[0.016,0.032],[0.011,0.045]], "segments": 24});
  const mesh_pommel_4 = new THREE.Mesh(
    mesh_pommel_4Geometry,
    materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pommel_4.name = "Pommel";
  if (endpoint_pommel_4) {
    mesh_pommel_4.position.copy(endpoint_pommel_4.midpoint);
    mesh_pommel_4.quaternion.copy(endpoint_pommel_4.quaternion);
  }
  mesh_pommel_4.castShadow = options.castShadow ?? true;
  mesh_pommel_4.receiveShadow = options.receiveShadow ?? true;
  mesh_pommel_4.userData.sculptComponent = {"id": "pommel", "name": "Pommel", "level": "macro", "role": "cap", "importance": 0.5, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Bulbous acorn/teardrop cap with a raised metal rim band at its base — a lathed/revolved profile, not a plain sphere or cone.", "geometryDescriptor": {"topologyIntent": "revolve a teardrop profile curve around +Y, with a distinct raised ring band at the top (grip-facing) edge", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.004, "segments": 2}, "deformationStack": [], "uvStrategy": "spherical UV", "normalStrategy": "computed vertex normals"}, "parent": "root", "attachment": {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, -0.2, 0], "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0, "baseRadius": 0.015, "endRadius": 0.002}, "dimensions": {"width": 0.03, "height": 0.09, "depth": 0.03, "units": "relative to grip midpoint", "confidence": 0.75}, "transform": {"position": [0, -0.11, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-prop-part", "pivot": {"mode": "custom", "localPosition": [0, -0.11, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{"withComponentId": "grip", "type": "flush", "worldUnitOverlap": 0.02}], "localFeatures": [{"id": "pommel-rim-band", "description": "raised metal rim/band at the pommel's grip-facing base, distinct from the teardrop body", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.01, "normalPattern": "satin metal", "displacementPattern": "none", "occlusionPattern": "darkened crease under the rim band", "edgeWearPattern": "none observed", "notes": "back/underside hidden in this view — assumed rotationally symmetric"}, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7}};
  node_pommel_4.add(mesh_pommel_4);
  meshes["pommel"] = mesh_pommel_4;
  colliders["pommel"] = {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_pommel_4);

  // repetition system: grip-wrap (InstancedMesh, radial, count=5, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(0.001, 0.001, 0.001, 1, 1, 1);
    const mat = materialMap["steel-blade"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 5);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 5; i++) {
      const ang = ((0.0) + (i * 360) / 5) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "grip-wrap";
    parent.add(cluster);
  }

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry", "note": "Disabled for this run: automated extraction against the padded test reference produced a background-contaminated palette despite verdict=pass/confidence=0.86 (see material-evidence-decision.md). Material colors below are hand-authored from direct visual inspection (image_analysis.md Layers 5-6) instead."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

