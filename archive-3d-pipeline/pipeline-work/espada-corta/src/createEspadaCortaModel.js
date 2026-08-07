import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
function buildExtrudeShape(points, holes) {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
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
function ovalLoop(cx, cy, rx, ry, seg = 24) {
  const loop = [];
  for (let i = 0; i < seg; i += 1) {
    const a = i / seg * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}
function buildExtrudeGeometry(profile) {
  const holes = [...profile.holes ?? [], ...(profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1
  });
}
function buildLatheGeometry(profile) {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}
function buildCurveSweepGeometry(sweep) {
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
    bevelEnabled: false
  });
}
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function readLayerNumber(value, keys, fallback) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const record = value;
    for (const key of keys) {
      if (typeof record[key] === "number") return record[key];
    }
  }
  return fallback;
}
function hexToRgb(hex) {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex) ? "#" + hex.slice(1).split("").map((part) => part + part).join("") : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 9075295;
  return [value >> 16 & 255, value >> 8 & 255, value & 255];
}
function materialPalette(spec) {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === "string");
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...Array.isArray(secondary) ? secondary : []];
  return colors.filter((value) => typeof value === "string" && value.startsWith("#"));
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function smoothCurve(value) {
  return value * value * (3 - 2 * value);
}
function periodicHash(x, y, seed, periodX, periodY) {
  const wrappedX = (x % periodX + periodX) % periodX;
  const wrappedY = (y % periodY + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}
function periodicValueNoise(u, v, seed, periodX, periodY) {
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
function surfaceBands(spec) {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const band = item;
    const frequency = typeof band.frequency === "number" ? band.frequency : 0;
    const amplitude = typeof band.amplitude === "number" ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? "")} ${String(band.role ?? "")}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === "number" ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === "number" ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description)
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false }
  ];
}
function sampleSurface(u, v, bands, seed) {
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
function mixPalette(colors, value) {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix))
  ];
}
function parseRgba(value) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function sampleColorGradient(gradient, u, v) {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: "rgba(138,122,95,1)" }, { offset: 1, color: "rgba(138,122,95,1)" }];
  let t;
  if (gradient.type === "radial") {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(1e-3, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
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
    THREE.MathUtils.lerp(a[2], b[2], mix)
  ];
}
function writePixel(data, offset, red, green, blue) {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}
function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}
function createMapTexture(canvas, colorSpace, spec, options) {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 2,
    typeof repeat[1] === "number" ? repeat[1] : 2
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function referenceMapUrl(spec, channel) {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== "object") return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === "number" ? reference.confidence : typeof reference.estimatedFidelity === "number" ? reference.estimatedFidelity : 0;
  const threshold = typeof reference.targetThreshold === "number" ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== "object") return null;
  const map = maps[channel];
  if (!map || typeof map !== "object") return null;
  const record = map;
  const url = typeof record.url === "string" && record.url.trim() ? record.url : record.path;
  return typeof url === "string" && url.trim() ? url : null;
}
function createLoadedMapTexture(url, colorSpace, spec, options) {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 1,
    typeof repeat[1] === "number" ? repeat[1] : 1
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function makeReferenceTextureSet(spec, options) {
  const albedo = referenceMapUrl(spec, "albedo");
  const roughness = referenceMapUrl(spec, "roughness");
  const height = referenceMapUrl(spec, "height");
  const normal = referenceMapUrl(spec, "normal");
  const ao = referenceMapUrl(spec, "ao");
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: "reference-pixel-extraction"
  };
}
function makeProceduralTextureSet(id, spec, options) {
  if (typeof document === "undefined") return null;
  const qualityFirst = (options.qualityPriority ?? "reference-fidelity") === "reference-fidelity";
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === "number" && Number.isFinite(requested) ? requested : qualityFirst ? 1024 : 512;
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size)
  };
  const contexts = {
    albedo: canvases.albedo.getContext("2d"),
    roughness: canvases.roughness.getContext("2d"),
    height: canvases.height.getContext("2d"),
    normal: canvases.normal.getContext("2d"),
    ao: canvases.ao.getContext("2d")
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size)
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F";
  const colors = (palette.length >= 2 ? palette : [fallback, "#6E614B", "#A08F70"]).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ["base"], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ["variation"], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ["amplitude", "variation"], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ["heightCorrelation"], 0.3));
  const colorGradient = spec.colorGradient;
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
      let color;
      if (colorGradient) {
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
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = (y - 1 + size) % size * size;
    const down = (y + 1) % size * size;
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
      const neighborAverage = (heightField[y * size + left] + heightField[y * size + right] + heightField[up + x] + heightField[down + x]) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data,
        offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255
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
    source: "procedural"
  };
}
function createSculptMaterial(id, spec, options) {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 16777215 : new THREE.Color(typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F"),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ["base"], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ["base"], 0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ["base", "amount"], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ["base"], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ["base", "amount"], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ["base", "value"], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ["base", "amount"], 0)),
    attenuationDistance: Math.max(1e-3, readLayerNumber(spec.attenuationDistance, ["base", "value"], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === "string" ? spec.attenuationColor : "#ffffff"),
    sheen: clamp01(readLayerNumber(spec.sheen, ["base", "amount"], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === "string" ? spec.sheenColor : "#ffffff"),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ["base"], 1)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ["base", "amount"], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ["base", "value"], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ["base", "amount"], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ["rotation"], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ["base"], 1)),
    specularColor: new THREE.Color(typeof spec.specularColor === "string" ? spec.specularColor : "#ffffff"),
    emissive: new THREE.Color(typeof spec.emissive === "string" ? spec.emissive : "#000000"),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ["base"], 1)),
    opacity: clamp01(readLayerNumber(spec.opacity, ["base"], 1)),
    transparent: readLayerNumber(spec.transmission, ["base", "amount"], 0) > 0 || readLayerNumber(spec.opacity, ["base"], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ["cutoff", "alphaTest"], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ["amplitude", "strength"], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ["amplitude", "strength"], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ["envMapIntensity"], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? "flat-fallback";
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}
function readVector3(value, fallback) {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number")) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}
function readNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function makeAttachmentEndpoint(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const record = attachment;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 1e-4) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(5e-3, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(3e-3, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius
  };
}
const SW_LOFT_T = [-1, -0.9, -0.6, -0.2, 0.2, 0.6, 0.9, 1];
function swMix(a, b, t) {
  return a + (b - a) * t;
}
function swOffsetRing(ring, dAt) {
  const n = ring.length;
  const nrm = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return new THREE.Vector2(-dy / l, dx / l);
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const n1 = nrm(ring[(i - 1 + n) % n], p);
    const n2 = nrm(p, ring[(i + 1) % n]);
    const b = new THREE.Vector2(n1.x + n2.x, n1.y + n2.y);
    if (b.lengthSq() < 1e-12) {
      out.push(p.clone());
      continue;
    }
    b.normalize();
    const c = Math.max(0.45, b.dot(n1));
    const d = dAt(p) / c;
    out.push(new THREE.Vector2(p.x + b.x * d, p.y + b.y * d));
  }
  return out;
}
function swSubdivideCap(P, tris, t, zAt, rounds, interior) {
  const key = (a, b) => a < b ? a + "," + b : b + "," + a;
  for (let r = 0; r < rounds; r++) {
    const uses = /* @__PURE__ */ new Map();
    for (const tri of tris) {
      const a = tri[0], b = tri[1], c = tri[2];
      const edges = [[a, b], [b, c], [c, a]];
      for (const e of edges) uses.set(key(e[0], e[1]), (uses.get(key(e[0], e[1])) || 0) + 1);
    }
    const mids = /* @__PURE__ */ new Map();
    const midOf = (a, b) => {
      const k = key(a, b);
      const hit = mids.get(k);
      if (hit !== void 0) return hit;
      const x = (P[a * 3] + P[b * 3]) / 2;
      const y = (P[a * 3 + 1] + P[b * 3 + 1]) / 2;
      const i = P.length / 3;
      const edge = uses.get(k) === 1;
      P.push(x, y, edge ? (P[a * 3 + 2] + P[b * 3 + 2]) / 2 : zAt(x, y, t));
      if (!edge) interior.push(i);
      mids.set(k, i);
      return i;
    };
    const next = [];
    for (const tri of tris) {
      const a = tri[0], b = tri[1], c = tri[2];
      const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }
  return tris;
}
function swFieldNormals(g, zAt, t, interior) {
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const e = 4e-3;
  const s = Math.sign(t);
  for (const i of interior) {
    const x = p.getX(i), y = p.getY(i);
    const fx = (zAt(x + e, y, t) - zAt(x - e, y, t)) / (2 * e);
    const fy = (zAt(x, y + e, t) - zAt(x, y - e, t)) / (2 * e);
    const l = Math.hypot(fx, fy, 1);
    n.setXYZ(i, -s * fx / l, -s * fy / l, s / l);
  }
}
function swLofted(shape, zAt, rollAt) {
  const raw = shape.extractPoints(10);
  const dedupe = (r) => r.length > 1 && r[0].distanceToSquared(r[r.length - 1]) < 1e-12 ? r.slice(0, -1) : r;
  const orient = (r, cw) => THREE.ShapeUtils.isClockWise(r) === cw ? r : r.slice().reverse();
  const contour = orient(dedupe(raw.shape), false);
  const holes = raw.holes.map((h) => orient(dedupe(h), true));
  const rings = [contour, ...holes];
  const perLayer = rings.reduce((a, r) => a + r.length, 0);
  const ringBase = [];
  rings.reduce((a, r) => {
    ringBase.push(a);
    return a + r.length;
  }, 0);
  const capFaces = THREE.ShapeUtils.triangulateShape(contour, holes);
  const P = [];
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
  const front = [], back = [], frontInner = [], backInner = [];
  const shifted = capFaces.map((tri) => [last + tri[0], last + tri[1], last + tri[2]]);
  for (const tri of swSubdivideCap(P, shifted, 1, zAt, 2, frontInner)) front.push(tri[0], tri[1], tri[2]);
  for (const tri of swSubdivideCap(P, capFaces, -1, zAt, 2, backInner)) back.push(tri[2], tri[1], tri[0]);
  const walls = [];
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
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setIndex([...front, ...back, ...walls]);
  g.computeVertexNormals();
  swFieldNormals(g, zAt, 1, frontInner);
  swFieldNormals(g, zAt, -1, backInner);
  return g;
}
function swLerpTable(table, y) {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (y <= table[i][0]) {
      const y0 = table[i - 1][0], v0 = table[i - 1][1], y1 = table[i][0], v1 = table[i][1];
      return swMix(v0, v1, (y - y0) / (y1 - y0));
    }
  }
  return table[table.length - 1][1];
}
const SW_BLADE_WIDTH_TABLE = [[-0.33, 0.02], [-0.2, 0.0235], [-0.02, 0.022], [0.15, 0.015], [0.27, 6e-3], [0.33, 5e-4]];
function swBladeHalf(x, y) {
  const w = swLerpTable(SW_BLADE_WIDTH_TABLE, y);
  if (w < 3e-4) return 4e-4;
  const nx = Math.min(1, Math.abs(x) / w);
  return swMix(6e-3, 7e-4, nx);
}
function swGuardHalf(x) {
  const nx = Math.min(1, Math.abs(x) / 0.075);
  return swMix(0.011, 5e-3, nx);
}
function createEspadaCortaModel(options = {}) {
  const root = new THREE.Group();
  root.name = "Espada Corta";
  root.userData.reconstructionEvidence = { "itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": { "solved": false, "fovDegrees": 40, "aspect": 1, "orientation": { "yaw": 0, "pitch": 0, "roll": 0 }, "positionHint": [0, 0, 3], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review." }, "approximationNotes": [] };
  const materialMap = {};
  materialMap["steel-blade"] = createSculptMaterial(
    "steel-blade",
    { "id": "steel-blade", "name": "Blade steel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#AEA98F", "color": "#AEA98F", "albedo": { "dominant": "#AEA98F", "secondary": ["#C9C4A6", "#7D7A66"], "samplingNotes": "Image-observed local color zones from reference_padded.png; not extracted via PBR script yet (pending material-evidence step)." }, "colorVariation": { "palette": ["#AEA98F", "#C9C4A6", "#7D7A66"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2 }, "textureResolution": 1024, "textureProjection": { "mode": "uv", "repeat": [1, 1], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; keep texture budget low per performanceBudget." }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup" }, { "id": "meso", "frequency": 8, "amplitude": 0.15, "role": "brushing/wrap-ridge relief" }, { "id": "micro", "frequency": 40, "amplitude": 0.05, "role": "highlight breakup under grazing light" }], "roughness": { "base": 0.32, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities/creases, lower on worn/polished edges" }, "metalness": { "base": 0.85, "variation": 0 }, "normal": { "pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken seams between blade/guard/grip/pommel and the grip wrap-ridge valleys." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [{ "id": "fuller-polish", "description": "Lower roughness along the fuller ridge line vs. the flats \u2014 reads as a more worked/polished edge.", "region": "blade centerline", "roughness": 0.22, "evidenceRef": "zone-r0c1" }], "shaderNotes": ["MeshStandardMaterial is sufficient \u2014 no clearcoat/transmission observed.", "Generate albedo/roughness/normal independently; do not alias albedo into roughness."], "notes": "Satin steel, not mirror-polished \u2014 soft specular falloff on the flats, sharper highlight along the fuller." },
    options
  );
  materialMap["bronze-fittings"] = createSculptMaterial(
    "bronze-fittings",
    { "id": "bronze-fittings", "name": "Bronze guard/pommel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#B08D57", "color": "#B08D57", "albedo": { "dominant": "#B08D57", "secondary": ["#8C6A3D", "#D1AC72"], "samplingNotes": "Image-observed local color zones from reference_padded.png; not extracted via PBR script yet (pending material-evidence step)." }, "colorVariation": { "palette": ["#B08D57", "#8C6A3D", "#D1AC72"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2 }, "textureResolution": 1024, "textureProjection": { "mode": "uv", "repeat": [1, 1], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; keep texture budget low per performanceBudget." }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup" }, { "id": "meso", "frequency": 8, "amplitude": 0.15, "role": "brushing/wrap-ridge relief" }, { "id": "micro", "frequency": 40, "amplitude": 0.05, "role": "highlight breakup under grazing light" }], "roughness": { "base": 0.38, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities/creases, lower on worn/polished edges" }, "metalness": { "base": 0.8, "variation": 0 }, "normal": { "pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken seams between blade/guard/grip/pommel and the grip wrap-ridge valleys." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["MeshStandardMaterial is sufficient \u2014 no clearcoat/transmission observed.", "Generate albedo/roughness/normal independently; do not alias albedo into roughness."], "notes": "Warmer-toned metal than the blade; guard and pommel share this material family per image_analysis.md layer 5 (uncertain vs. blade steel from this crop alone, flagged in unknowns)." },
    options
  );
  materialMap["leather-grip"] = createSculptMaterial(
    "leather-grip",
    { "id": "leather-grip", "name": "Leather-wrapped grip", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#5C4530", "color": "#5C4530", "albedo": { "dominant": "#5C4530", "secondary": ["#432F1F", "#71543A"], "samplingNotes": "Image-observed local color zones from reference_padded.png; not extracted via PBR script yet (pending material-evidence step)." }, "colorVariation": { "palette": ["#5C4530", "#432F1F", "#71543A"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2 }, "textureResolution": 1024, "textureProjection": { "mode": "uv", "repeat": [1, 1], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; keep texture budget low per performanceBudget." }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup" }, { "id": "meso", "frequency": 8, "amplitude": 0.15, "role": "brushing/wrap-ridge relief" }, { "id": "micro", "frequency": 40, "amplitude": 0.05, "role": "highlight breakup under grazing light" }], "roughness": { "base": 0.78, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities/creases, lower on worn/polished edges" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken seams between blade/guard/grip/pommel and the grip wrap-ridge valleys." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["MeshStandardMaterial is sufficient \u2014 no clearcoat/transmission observed.", "Generate albedo/roughness/normal independently; do not alias albedo into roughness."], "notes": "Non-metal, matte, fibrous \u2014 wrap ridges carried as real geometry per grip.geometryDescriptor, not painted into the normal map alone (antiShallowSpecRules)." },
    options
  );
  const nodes = { root };
  const meshes = {};
  const sockets = {};
  const colliders = {};
  const destructionGroups = {};
  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Espada Corta__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0, 0, 0);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  }
  node_root_0.userData.sculptComponent = { "id": "root", "name": "Espada Corta", "level": "macro", "role": "container", "importance": 1, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Empty organizational root; visible geometry lives entirely in its 4 macro children (blade, guard, grip, pommel).", "geometryDescriptor": { "topologyIntent": "no mesh on root", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a" }, "parent": null, "attachment": null, "dimensions": { "width": 1e-3, "height": 1e-3, "depth": 1e-3, "units": "relative to grip midpoint", "confidence": 0.5 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": null, "materialLayers": [], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "" }, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(150, 150, 150, 1.0)", "secondaryAlbedo": "rgba(120, 120, 120, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.3 } };
  node_root_0.userData.actionProfile = { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0 ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12) : new THREE.BoxGeometry(1e-3, 1e-3, 1e-3, 1, 1, 1);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["steel-blade"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_root_0.name = "Espada Corta";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = { "id": "root", "name": "Espada Corta", "level": "macro", "role": "container", "importance": 1, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Empty organizational root; visible geometry lives entirely in its 4 macro children (blade, guard, grip, pommel).", "geometryDescriptor": { "topologyIntent": "no mesh on root", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a" }, "parent": null, "attachment": null, "dimensions": { "width": 1e-3, "height": 1e-3, "depth": 1e-3, "units": "relative to grip midpoint", "confidence": 0.5 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": null, "materialLayers": [], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "" }, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(150, 150, 150, 1.0)", "secondaryAlbedo": "rgba(120, 120, 120, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.3 } };
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_root_0);
  const attachment_blade_1 = { "parentSocket": "root", "localStart": [0, 0.14, 0], "localEnd": [0, 0.8, 0], "contactType": "butt", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.022, "endRadius": 3e-3 };
  const endpoint_blade_1 = makeAttachmentEndpoint(attachment_blade_1);
  const node_blade_1 = new THREE.Group();
  node_blade_1.name = "Blade__pivot";
  if (endpoint_blade_1) {
    node_blade_1.position.copy(endpoint_blade_1.start);
    node_blade_1.rotation.set(0, 0, 0);
    node_blade_1.scale.set(1, 1, 1);
  } else {
    node_blade_1.position.set(0, 0.14, 0);
    node_blade_1.rotation.set(0, 0, 0);
    node_blade_1.scale.set(1, 1, 1);
  }
  node_blade_1.userData.sculptComponent = { "id": "blade", "name": "Blade", "level": "macro", "role": "primary-form", "importance": 1, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Flat double-edged taper with a raised centerline fuller \u2014 modeled as an extruded diamond-ish cross-section profile lofted from root (wide) to tip (point), not a simple box, to carry the fuller ridge and taper accurately.", "geometryDescriptor": { "topologyIntent": "lofted extrude along +Y from a flattened-diamond cross-section at the root to a converged point at the tip", "edgeTreatment": { "type": "bevel", "bevelRadius": 4e-3, "segments": 2 }, "deformationStack": ["linear taper (width and thickness both taper root->tip)"], "uvStrategy": "planar UV along the flat faces, seam at the centerline fuller", "normalStrategy": "computed vertex normals; centerline fuller kept as real geometry (not a normal-map fake) since it affects the grazing-light silhouette" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, 0.14, 0], "localEnd": [0, 0.8, 0], "contactType": "butt", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.022, "endRadius": 3e-3 }, "dimensions": { "width": 0.045, "height": 0.66, "depth": 0.012, "units": "relative to grip midpoint", "confidence": 0.8 }, "transform": { "position": [0, 0.14, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.14, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "steel-blade", "materialLayers": ["steel-blade"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "fuller-spine", "description": "raised centerline ridge running the full blade length, splitting the two facets", "evidenceRef": "zone-r0c1" }, { "id": "blade-tip", "description": "symmetric double-edged point converging to a single apex", "evidenceRef": "zone-r0c1" }], "surfaceDetail": { "macroRoughness": 0.3, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "faint brushed-metal linear striation along the length", "displacementPattern": "none beyond the modeled fuller geometry", "occlusionPattern": "slight darkening at the fuller valley", "edgeWearPattern": "none observed \u2014 clean unweathered blade", "notes": "unknown: exact cross-section (flat vs diamond) not confirmed from this single frontal view" }, "evidenceRefs": ["full-object", "zone-r0c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(174, 169, 143, 1.0)", "secondaryAlbedo": "rgba(125, 122, 102, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.85 } };
  node_blade_1.userData.actionProfile = { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.14, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_blade_1);
  nodes["blade"] = node_blade_1;
  const mesh_blade_1Geometry = swLofted(buildExtrudeShape([[0.02, -0.33], [0.0235, -0.2], [0.022, -0.02], [0.015, 0.15], [6e-3, 0.27], [0, 0.33], [-6e-3, 0.27], [-0.015, 0.15], [-0.022, -0.02], [-0.0235, -0.2], [-0.02, -0.33]]), (x, y, t) => t * swBladeHalf(x, y), () => 0);
  const mesh_blade_1 = new THREE.Mesh(
    mesh_blade_1Geometry,
    materialMap["steel-blade"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_blade_1.name = "Blade";
  if (endpoint_blade_1) {
    mesh_blade_1.position.copy(endpoint_blade_1.midpoint);
    mesh_blade_1.quaternion.copy(endpoint_blade_1.quaternion);
  }
  mesh_blade_1.castShadow = options.castShadow ?? true;
  mesh_blade_1.receiveShadow = options.receiveShadow ?? true;
  mesh_blade_1.userData.sculptComponent = { "id": "blade", "name": "Blade", "level": "macro", "role": "primary-form", "importance": 1, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Flat double-edged taper with a raised centerline fuller \u2014 modeled as an extruded diamond-ish cross-section profile lofted from root (wide) to tip (point), not a simple box, to carry the fuller ridge and taper accurately.", "geometryDescriptor": { "topologyIntent": "lofted extrude along +Y from a flattened-diamond cross-section at the root to a converged point at the tip", "edgeTreatment": { "type": "bevel", "bevelRadius": 4e-3, "segments": 2 }, "deformationStack": ["linear taper (width and thickness both taper root->tip)"], "uvStrategy": "planar UV along the flat faces, seam at the centerline fuller", "normalStrategy": "computed vertex normals; centerline fuller kept as real geometry (not a normal-map fake) since it affects the grazing-light silhouette" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, 0.14, 0], "localEnd": [0, 0.8, 0], "contactType": "butt", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.022, "endRadius": 3e-3 }, "dimensions": { "width": 0.045, "height": 0.66, "depth": 0.012, "units": "relative to grip midpoint", "confidence": 0.8 }, "transform": { "position": [0, 0.14, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.14, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "steel-blade", "materialLayers": ["steel-blade"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "fuller-spine", "description": "raised centerline ridge running the full blade length, splitting the two facets", "evidenceRef": "zone-r0c1" }, { "id": "blade-tip", "description": "symmetric double-edged point converging to a single apex", "evidenceRef": "zone-r0c1" }], "surfaceDetail": { "macroRoughness": 0.3, "microRoughness": 0.15, "bumpAmplitude": 0.02, "normalPattern": "faint brushed-metal linear striation along the length", "displacementPattern": "none beyond the modeled fuller geometry", "occlusionPattern": "slight darkening at the fuller valley", "edgeWearPattern": "none observed \u2014 clean unweathered blade", "notes": "unknown: exact cross-section (flat vs diamond) not confirmed from this single frontal view" }, "evidenceRefs": ["full-object", "zone-r0c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(174, 169, 143, 1.0)", "secondaryAlbedo": "rgba(125, 122, 102, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.85 } };
  node_blade_1.add(mesh_blade_1);
  meshes["blade"] = mesh_blade_1;
  colliders["blade"] = { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_blade_1);
  const attachment_guard_2 = { "parentSocket": "root", "localStart": [0, 0.1, 0], "localEnd": [0, 0.14, 0], "contactType": "butt", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.065, "endRadius": 0.05 };
  const endpoint_guard_2 = makeAttachmentEndpoint(attachment_guard_2);
  const node_guard_2 = new THREE.Group();
  node_guard_2.name = "Guard__pivot";
  if (endpoint_guard_2) {
    node_guard_2.position.copy(endpoint_guard_2.start);
    node_guard_2.rotation.set(0, 0, 0);
    node_guard_2.scale.set(1, 1, 1);
  } else {
    node_guard_2.position.set(0, 0.1, 0);
    node_guard_2.rotation.set(0, 0, 0);
    node_guard_2.scale.set(1, 1, 1);
  }
  node_guard_2.userData.sculptComponent = { "id": "guard", "name": "Guard", "level": "macro", "role": "crossbar", "importance": 0.85, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Crescent crossbar with downturned tapered tips \u2014 a lofted curve profile swept and tapered toward each tip, not a straight box crossguard.", "geometryDescriptor": { "topologyIntent": "horizontal loft along local X, curving down toward +/-X extremes, tapering in thickness toward the tips", "edgeTreatment": { "type": "bevel", "bevelRadius": 6e-3, "segments": 3 }, "deformationStack": ["downward bend toward each tip"], "uvStrategy": "planar UV along the sweep", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, 0.1, 0], "localEnd": [0, 0.14, 0], "contactType": "butt", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.065, "endRadius": 0.05 }, "dimensions": { "width": 0.13, "height": 0.04, "depth": 0.018, "units": "relative to grip midpoint", "confidence": 0.8 }, "transform": { "position": [0, 0.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.1, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "blade", "type": "butt", "worldUnitOverlap": 0.02 }, { "withComponentId": "grip", "type": "butt", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "guard-tips", "description": "swept, downturned, tapered tips on both sides (not blunt/straight)", "evidenceRef": "zone-r1c1" }], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.015, "normalPattern": "satin metal micro-facets", "displacementPattern": "none", "occlusionPattern": "darkened crease where guard meets grip", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["full-object", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75 } };
  node_guard_2.userData.actionProfile = { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.1, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_guard_2);
  nodes["guard"] = node_guard_2;
  const mesh_guard_2Geometry = swLofted(buildExtrudeShape([[0, 0.022], [0.018, 6e-3], [0.045, -4e-3], [0.07, -0.014], [0.075, -0.026], [0.055, -0.01], [0.022, -1e-3], [0, -0.018], [-0.022, -1e-3], [-0.055, -0.01], [-0.075, -0.026], [-0.07, -0.014], [-0.045, -4e-3], [-0.018, 6e-3]]), (x, y, t) => t * swGuardHalf(x), () => 0);
  const mesh_guard_2 = new THREE.Mesh(
    mesh_guard_2Geometry,
    materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_guard_2.name = "Guard";
  if (endpoint_guard_2) {
    mesh_guard_2.position.copy(endpoint_guard_2.midpoint);
    mesh_guard_2.quaternion.copy(endpoint_guard_2.quaternion);
  }
  mesh_guard_2.castShadow = options.castShadow ?? true;
  mesh_guard_2.receiveShadow = options.receiveShadow ?? true;
  mesh_guard_2.userData.sculptComponent = { "id": "guard", "name": "Guard", "level": "macro", "role": "crossbar", "importance": 0.85, "confidence": 0.8, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Crescent crossbar with downturned tapered tips \u2014 a lofted curve profile swept and tapered toward each tip, not a straight box crossguard.", "geometryDescriptor": { "topologyIntent": "horizontal loft along local X, curving down toward +/-X extremes, tapering in thickness toward the tips", "edgeTreatment": { "type": "bevel", "bevelRadius": 6e-3, "segments": 3 }, "deformationStack": ["downward bend toward each tip"], "uvStrategy": "planar UV along the sweep", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, 0.1, 0], "localEnd": [0, 0.14, 0], "contactType": "butt", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.065, "endRadius": 0.05 }, "dimensions": { "width": 0.13, "height": 0.04, "depth": 0.018, "units": "relative to grip midpoint", "confidence": 0.8 }, "transform": { "position": [0, 0.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.1, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "blade", "type": "butt", "worldUnitOverlap": 0.02 }, { "withComponentId": "grip", "type": "butt", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "guard-tips", "description": "swept, downturned, tapered tips on both sides (not blunt/straight)", "evidenceRef": "zone-r1c1" }], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.015, "normalPattern": "satin metal micro-facets", "displacementPattern": "none", "occlusionPattern": "darkened crease where guard meets grip", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["full-object", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.75 } };
  node_guard_2.add(mesh_guard_2);
  meshes["guard"] = mesh_guard_2;
  colliders["guard"] = { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_guard_2);
  const attachment_grip_3 = { "parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, 0.1, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.011, "endRadius": 0.011 };
  const endpoint_grip_3 = makeAttachmentEndpoint(attachment_grip_3);
  const node_grip_3 = new THREE.Group();
  node_grip_3.name = "Grip__pivot";
  if (endpoint_grip_3) {
    node_grip_3.position.copy(endpoint_grip_3.start);
    node_grip_3.rotation.set(0, 0, 0);
    node_grip_3.scale.set(1, 1, 1);
  } else {
    node_grip_3.position.set(0, 0, 0);
    node_grip_3.rotation.set(0, 0, 0);
    node_grip_3.scale.set(1, 1, 1);
  }
  node_grip_3.userData.sculptComponent = { "id": "grip", "name": "Grip", "level": "macro", "role": "handle", "importance": 0.7, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Cylinder with a repeated wrap-cord ridge pattern (repetitionSystems.grip-wrap) \u2014 this is the natural hand-hold and equip-socket alignment point.", "geometryDescriptor": { "topologyIntent": "cylinder core with radial ridge loops repeated along +Y per repetitionSystems.grip-wrap", "edgeTreatment": { "type": "chamfer", "bevelRadius": 3e-3, "segments": 8 }, "deformationStack": [], "uvStrategy": "cylindrical UV, V repeats per wrap ridge", "normalStrategy": "computed vertex normals + ridge geometry" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, 0.1, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.011, "endRadius": 0.011 }, "dimensions": { "width": 0.022, "height": 0.21, "depth": 0.022, "units": "relative to grip midpoint", "confidence": 0.8 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [{ "id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0] }], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "leather-grip", "materialLayers": ["leather-grip"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02 }, { "withComponentId": "pommel", "type": "butt", "worldUnitOverlap": 0.02 }], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0.35, "bumpAmplitude": 0.04, "normalPattern": "leather-wrap fiber grain between ridges", "displacementPattern": "wrap ridges are real geometry, not displacement", "occlusionPattern": "darkened valleys between wrap ridges", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(92, 69, 48, 1.0)", "secondaryAlbedo": "rgba(67, 47, 31, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6 } };
  node_grip_3.userData.actionProfile = { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [{ "id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0] }], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_grip_3);
  nodes["grip"] = node_grip_3;
  const mesh_grip_3Geometry = buildLatheGeometry({ "points": [[9e-3, -0.105], [0.0115, -0.095], [95e-4, -0.085], [0.012, -0.06], [0.01, -0.045], [0.0125, -0.02], [0.01, 5e-3], [0.012, 0.03], [95e-4, 0.05], [0.0115, 0.075], [9e-3, 0.105]], "segments": 24 });
  const mesh_grip_3 = new THREE.Mesh(
    mesh_grip_3Geometry,
    materialMap["leather-grip"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_grip_3.name = "Grip";
  if (endpoint_grip_3) {
    mesh_grip_3.position.copy(endpoint_grip_3.midpoint);
    mesh_grip_3.quaternion.copy(endpoint_grip_3.quaternion);
  }
  mesh_grip_3.castShadow = options.castShadow ?? true;
  mesh_grip_3.receiveShadow = options.receiveShadow ?? true;
  mesh_grip_3.userData.sculptComponent = { "id": "grip", "name": "Grip", "level": "macro", "role": "handle", "importance": 0.7, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Cylinder with a repeated wrap-cord ridge pattern (repetitionSystems.grip-wrap) \u2014 this is the natural hand-hold and equip-socket alignment point.", "geometryDescriptor": { "topologyIntent": "cylinder core with radial ridge loops repeated along +Y per repetitionSystems.grip-wrap", "edgeTreatment": { "type": "chamfer", "bevelRadius": 3e-3, "segments": 8 }, "deformationStack": [], "uvStrategy": "cylindrical UV, V repeats per wrap ridge", "normalStrategy": "computed vertex normals + ridge geometry" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, 0.1, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.011, "endRadius": 0.011 }, "dimensions": { "width": 0.022, "height": 0.21, "depth": 0.022, "units": "relative to grip midpoint", "confidence": 0.8 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [{ "id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0] }], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "leather-grip", "materialLayers": ["leather-grip"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02 }, { "withComponentId": "pommel", "type": "butt", "worldUnitOverlap": 0.02 }], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0.35, "bumpAmplitude": 0.04, "normalPattern": "leather-wrap fiber grain between ridges", "displacementPattern": "wrap ridges are real geometry, not displacement", "occlusionPattern": "darkened valleys between wrap ridges", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(92, 69, 48, 1.0)", "secondaryAlbedo": "rgba(67, 47, 31, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6 } };
  node_grip_3.add(mesh_grip_3);
  meshes["grip"] = mesh_grip_3;
  colliders["grip"] = { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_grip_3);
  const socket_grip_hand_hold_0 = new THREE.Object3D();
  socket_grip_hand_hold_0.name = "hand-hold";
  socket_grip_hand_hold_0.position.set(0, 0, 0);
  socket_grip_hand_hold_0.rotation.set(0, 0, 0);
  socket_grip_hand_hold_0.userData.socket = { "id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0] };
  node_grip_3.add(socket_grip_hand_hold_0);
  sockets["grip:hand-hold"] = socket_grip_hand_hold_0;
  const attachment_pommel_4 = { "parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, -0.2, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.015, "endRadius": 2e-3 };
  const endpoint_pommel_4 = makeAttachmentEndpoint(attachment_pommel_4);
  const node_pommel_4 = new THREE.Group();
  node_pommel_4.name = "Pommel__pivot";
  if (endpoint_pommel_4) {
    node_pommel_4.position.copy(endpoint_pommel_4.start);
    node_pommel_4.rotation.set(0, 0, 0);
    node_pommel_4.scale.set(1, 1, 1);
  } else {
    node_pommel_4.position.set(0, -0.11, 0);
    node_pommel_4.rotation.set(0, 0, 0);
    node_pommel_4.scale.set(1, 1, 1);
  }
  node_pommel_4.userData.sculptComponent = { "id": "pommel", "name": "Pommel", "level": "macro", "role": "cap", "importance": 0.5, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Bulbous acorn/teardrop cap with a raised metal rim band at its base \u2014 a lathed/revolved profile, not a plain sphere or cone.", "geometryDescriptor": { "topologyIntent": "revolve a teardrop profile curve around +Y, with a distinct raised ring band at the top (grip-facing) edge", "edgeTreatment": { "type": "bevel", "bevelRadius": 4e-3, "segments": 2 }, "deformationStack": [], "uvStrategy": "spherical UV", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, -0.2, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.015, "endRadius": 2e-3 }, "dimensions": { "width": 0.03, "height": 0.09, "depth": 0.03, "units": "relative to grip midpoint", "confidence": 0.75 }, "transform": { "position": [0, -0.11, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, -0.11, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "grip", "type": "flush", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "pommel-rim-band", "description": "raised metal rim/band at the pommel's grip-facing base, distinct from the teardrop body", "evidenceRef": "zone-r2c1" }], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.01, "normalPattern": "satin metal", "displacementPattern": "none", "occlusionPattern": "darkened crease under the rim band", "edgeWearPattern": "none observed", "notes": "back/underside hidden in this view \u2014 assumed rotationally symmetric" }, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7 } };
  node_pommel_4.userData.actionProfile = { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, -0.11, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_pommel_4);
  nodes["pommel"] = node_pommel_4;
  const mesh_pommel_4Geometry = buildLatheGeometry({ "points": [[4e-3, -0.045], [0.014, -0.02], [0.01, 5e-3], [8e-3, 0.025], [0.016, 0.032], [0.011, 0.045]], "segments": 24 });
  const mesh_pommel_4 = new THREE.Mesh(
    mesh_pommel_4Geometry,
    materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pommel_4.name = "Pommel";
  if (endpoint_pommel_4) {
    mesh_pommel_4.position.copy(endpoint_pommel_4.midpoint);
    mesh_pommel_4.quaternion.copy(endpoint_pommel_4.quaternion);
  }
  mesh_pommel_4.castShadow = options.castShadow ?? true;
  mesh_pommel_4.receiveShadow = options.receiveShadow ?? true;
  mesh_pommel_4.userData.sculptComponent = { "id": "pommel", "name": "Pommel", "level": "macro", "role": "cap", "importance": 0.5, "confidence": 0.75, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Bulbous acorn/teardrop cap with a raised metal rim band at its base \u2014 a lathed/revolved profile, not a plain sphere or cone.", "geometryDescriptor": { "topologyIntent": "revolve a teardrop profile curve around +Y, with a distinct raised ring band at the top (grip-facing) edge", "edgeTreatment": { "type": "bevel", "bevelRadius": 4e-3, "segments": 2 }, "deformationStack": [], "uvStrategy": "spherical UV", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, -0.2, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.015, "endRadius": 2e-3 }, "dimensions": { "width": 0.03, "height": 0.09, "depth": 0.03, "units": "relative to grip midpoint", "confidence": 0.75 }, "transform": { "position": [0, -0.11, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, -0.11, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "grip", "type": "flush", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "pommel-rim-band", "description": "raised metal rim/band at the pommel's grip-facing base, distinct from the teardrop body", "evidenceRef": "zone-r2c1" }], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.01, "normalPattern": "satin metal", "displacementPattern": "none", "occlusionPattern": "darkened crease under the rim band", "edgeWearPattern": "none observed", "notes": "back/underside hidden in this view \u2014 assumed rotationally symmetric" }, "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(176, 141, 87, 1.0)", "secondaryAlbedo": "rgba(140, 106, 61, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.7 } };
  node_pommel_4.add(mesh_pommel_4);
  meshes["pommel"] = mesh_pommel_4;
  colliders["pommel"] = { "type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass." };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_pommel_4);
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1e-3, 1e-3, 1e-3, 1, 1, 1);
    const mat = materialMap["steel-blade"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0, 0, 1).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 5);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 5; i++) {
      const ang = (0 + i * 360 / 5) * Math.PI / 180;
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
  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups };
  root.userData.lookDevTargets = { "qualityPriority": "reference-fidelity", "materialPass": { "albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": { "requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry", "note": "Disabled for this run: automated extraction against the padded test reference produced a background-contaminated palette despite verdict=pass/confidence=0.86 (see material-evidence-decision.md). Material colors below are hand-authored from direct visual inspection (image_analysis.md Layers 5-6) instead." }, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"] }, "lightingPass": { "requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  root.userData.actionReadiness = {
    note: "Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets."
  };
  return root;
}
function createEspadaCortaLookDevLights(mode = "neutral") {
  const lights = new THREE.Group();
  lights.name = "Espada Corta look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === "reference" ? 16773334 : 15922431,
    3554114,
    mode === "grazing" ? 0.28 : mode === "reference" ? 0.72 : 0.85
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === "reference" ? 16764810 : 16774376,
    mode === "grazing" ? 4.2 : mode === "reference" ? 2.6 : 2.15
  );
  if (mode === "grazing") key.position.set(7.5, 1.1, 4);
  else if (mode === "reference") key.position.set(-4.5, 7.5, 5);
  else key.position.set(-4, 6, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -25e-5;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(11060479, mode === "grazing" ? 0.12 : 0.42);
  fill.position.set(4, 3, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(16773572, mode === "grazing" ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{ "role": "key", "description": "Warm-white light from slightly above and in front of the object, primary source of the blade's specular highlight band." }, { "role": "fill", "description": "Low-intensity warm ambient fill, softens shadow falloff on the guard/grip without washing out material contrast." }, { "role": "rim/environment", "description": "Subtle warm bounce along the blade's outer edge, consistent with the vignette's ambient tone (background itself excluded from this test's material read \u2014 see material-evidence-decision.md)." }, { "role": "contact-shadow", "description": "Soft, tight contact shadow directly beneath the pommel/lowest point when placed on a ground plane for standalone-mode preview; not visible in the padded test reference itself (product-icon crop has no ground plane), inferred from standard PBR viewer convention for this asset type." }];
  lights.userData.lookDevTargets = { "qualityPriority": "reference-fidelity", "materialPass": { "albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": { "requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry", "note": "Disabled for this run: automated extraction against the padded test reference produced a background-contaminated palette despite verdict=pass/confidence=0.86 (see material-evidence-decision.md). Material colors below are hand-authored from direct visual inspection (image_analysis.md Layers 5-6) instead." }, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"] }, "lightingPass": { "requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  return lights;
}
function createEspadaCortaEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}
function frameEspadaCortaCamera(camera, object, options = {}) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = camera.fov * Math.PI / 180;
  const distance = maxDim / 2 / Math.tan(fov / 2);
  const az = (options.azimuthDeg ?? 0) * Math.PI / 180;
  const el = (options.elevationDeg ?? 0) * Math.PI / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el)
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
function createEspadaCortaPresentationComposer(renderer, scene, camera, options = {}) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10,
      aperture: options.dofAperture ?? 2e-4,
      maxblur: 0.01
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}
function configureEspadaCortaRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
function createEspadaCortaInspectControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 8;
  controls.autoRotate = false;
  return controls;
}
export {
  configureEspadaCortaRenderer,
  createEspadaCortaEnvironment,
  createEspadaCortaInspectControls,
  createEspadaCortaLookDevLights,
  createEspadaCortaModel,
  createEspadaCortaPresentationComposer,
  frameEspadaCortaCamera
};
