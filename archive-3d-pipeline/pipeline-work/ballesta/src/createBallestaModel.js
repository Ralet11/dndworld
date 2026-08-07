import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
function createBallestaModel(options = {}) {
  const root = new THREE.Group();
  root.name = "Ballesta";
  root.userData.reconstructionEvidence = { "itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": { "solved": false, "fovDegrees": 40, "aspect": 1, "orientation": { "yaw": 0, "pitch": 0, "roll": 0 }, "positionHint": [0, 0, 3], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review." }, "approximationNotes": [] };
  const materialMap = {};
  materialMap["wood-stock"] = createSculptMaterial(
    "wood-stock",
    { "id": "wood-stock", "name": "Dark varnished stock wood", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#5E3A20", "color": "#5E3A20", "albedo": { "dominant": "#5E3A20", "secondary": ["#40261A", "#7A5236"], "samplingNotes": "Hand-authored from direct visual inspection of the crossbow crops." }, "colorVariation": { "palette": ["#5E3A20", "#40261A", "#7A5236"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2 }, "textureResolution": 1024, "textureProjection": { "mode": "uv", "repeat": [1, 1], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; low texture budget." }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup" }, { "id": "meso", "frequency": 8, "amplitude": 0.15, "role": "grain/brushing relief" }, { "id": "micro", "frequency": 40, "amplitude": 0.05, "role": "highlight breakup" }], "roughness": { "base": 0.5, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in creases" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken the stock/bow seam." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [{ "id": "wood-stock-response", "description": "baseline roughness variation", "region": "full part", "roughness": 0.5, "evidenceRef": "front" }], "shaderNotes": ["MeshStandardMaterial is sufficient.", "Generate albedo/roughness/normal independently."], "notes": "Dark reddish-brown varnished wood, satin sheen, not matte." },
    options
  );
  materialMap["bronze-fittings"] = createSculptMaterial(
    "bronze-fittings",
    { "id": "bronze-fittings", "name": "Aged bronze bow/rail hardware", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#B08D57", "color": "#B08D57", "albedo": { "dominant": "#B08D57", "secondary": ["#8C6A3D", "#D1AC72"], "samplingNotes": "Hand-authored from direct visual inspection of the crossbow crops." }, "colorVariation": { "palette": ["#B08D57", "#8C6A3D", "#D1AC72"], "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2 }, "textureResolution": 1024, "textureProjection": { "mode": "uv", "repeat": [1, 1], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; low texture budget." }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup" }, { "id": "meso", "frequency": 8, "amplitude": 0.15, "role": "grain/brushing relief" }, { "id": "micro", "frequency": 40, "amplitude": 0.05, "role": "highlight breakup" }], "roughness": { "base": 0.42, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in creases" }, "metalness": { "base": 0.75, "variation": 0 }, "normal": { "pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken the stock/bow seam." }, "wear": { "edgeWear": 0, "scratches": [], "chips": [] }, "dirt": { "amount": 0, "cavityBias": 0, "color": "#2F2A22" }, "localOverrides": [], "shaderNotes": ["MeshStandardMaterial is sufficient.", "Generate albedo/roughness/normal independently."], "notes": "Warm aged bronze/brass, softer sheen than a polished blade." },
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
  node_root_0.name = "Ballesta__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0, 0, 0);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  }
  node_root_0.userData.sculptComponent = { "id": "root", "name": "Ballesta", "level": "macro", "role": "container", "importance": 1, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Empty organizational root; visible geometry lives in its macro children.", "geometryDescriptor": { "topologyIntent": "no mesh on root", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a" }, "parent": null, "attachment": null, "dimensions": { "width": 1e-3, "height": 1e-3, "depth": 1e-3, "units": "relative", "confidence": 0.5 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "root", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": null, "materialLayers": [], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "" }, "evidenceRefs": ["front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(150,150,150,1.0)", "secondaryAlbedo": "rgba(120,120,120,1.0)", "materialClass": "unknown", "materialClassConfidence": 0.3 } };
  node_root_0.userData.actionProfile = { "animationRole": "root", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0 ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12) : new THREE.BoxGeometry(1e-3, 1e-3, 1e-3, 1, 1, 1);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["wood-stock"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_root_0.name = "Ballesta";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = { "id": "root", "name": "Ballesta", "level": "macro", "role": "container", "importance": 1, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Empty organizational root; visible geometry lives in its macro children.", "geometryDescriptor": { "topologyIntent": "no mesh on root", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a" }, "parent": null, "attachment": null, "dimensions": { "width": 1e-3, "height": 1e-3, "depth": 1e-3, "units": "relative", "confidence": 0.5 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "root", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": null, "materialLayers": [], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": "" }, "evidenceRefs": ["front"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(150,150,150,1.0)", "secondaryAlbedo": "rgba(120,120,120,1.0)", "materialClass": "unknown", "materialClassConfidence": 0.3 } };
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "" };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_root_0);
  const attachment_stock_1 = { "parentSocket": "root", "localStart": [0, -0.15, 0], "localEnd": [0, 0.15, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.032, "endRadius": 0.017 };
  const endpoint_stock_1 = makeAttachmentEndpoint(attachment_stock_1);
  const node_stock_1 = new THREE.Group();
  node_stock_1.name = "Stock__pivot";
  if (endpoint_stock_1) {
    node_stock_1.position.copy(endpoint_stock_1.start);
    node_stock_1.rotation.set(0, 0, 0);
    node_stock_1.scale.set(1, 1, 1);
  } else {
    node_stock_1.position.set(0, 0, 0);
    node_stock_1.rotation.set(0, 0, 0);
    node_stock_1.scale.set(1, 1, 1);
  }
  node_stock_1.userData.sculptComponent = { "id": "stock", "name": "Stock", "level": "macro", "role": "body", "importance": 1, "confidence": 0.8, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Bulbous grip at the rear lathing down into a flatter rail toward the front -- a solid of revolution, not a plain cylinder.", "geometryDescriptor": { "topologyIntent": "revolve profile around long axis, bulbous rear tapering to narrower front", "edgeTreatment": { "type": "bevel", "bevelRadius": 4e-3, "segments": 2 }, "deformationStack": [], "uvStrategy": "cylindrical UV", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, -0.15, 0], "localEnd": [0, 0.15, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.032, "endRadius": 0.017 }, "dimensions": { "width": 0.064, "height": 0.3, "depth": 0.05, "units": "relative", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "wood-stock", "materialLayers": ["wood-stock"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "bow", "type": "flush", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "grip-bulb", "description": "bulbous rounded grip at the rear end", "evidenceRef": "profile" }], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0.3, "bumpAmplitude": 0.02, "normalPattern": "wood grain", "displacementPattern": "none", "occlusionPattern": "darkened crease where the bow crosses the rail", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["front", "profile", "top"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(94,58,32,1.0)", "secondaryAlbedo": "rgba(64,38,20,1.0)", "materialClass": "wood", "materialClassConfidence": 0.8 } };
  node_stock_1.userData.actionProfile = { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_stock_1);
  nodes["stock"] = node_stock_1;
  const mesh_stock_1Geometry = buildLatheGeometry({ "points": [[6e-3, -0.15], [0.03, -0.115], [0.032, -0.085], [0.026, -0.03], [0.017, 0], [0.017, 0.1], [0.015, 0.15]], "segments": 20 });
  const mesh_stock_1 = new THREE.Mesh(
    mesh_stock_1Geometry,
    materialMap["wood-stock"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_stock_1.name = "Stock";
  if (endpoint_stock_1) {
    mesh_stock_1.position.copy(endpoint_stock_1.midpoint);
    mesh_stock_1.quaternion.copy(endpoint_stock_1.quaternion);
  }
  mesh_stock_1.castShadow = options.castShadow ?? true;
  mesh_stock_1.receiveShadow = options.receiveShadow ?? true;
  mesh_stock_1.userData.sculptComponent = { "id": "stock", "name": "Stock", "level": "macro", "role": "body", "importance": 1, "confidence": 0.8, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Bulbous grip at the rear lathing down into a flatter rail toward the front -- a solid of revolution, not a plain cylinder.", "geometryDescriptor": { "topologyIntent": "revolve profile around long axis, bulbous rear tapering to narrower front", "edgeTreatment": { "type": "bevel", "bevelRadius": 4e-3, "segments": 2 }, "deformationStack": [], "uvStrategy": "cylindrical UV", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, -0.15, 0], "localEnd": [0, 0.15, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.032, "endRadius": 0.017 }, "dimensions": { "width": 0.064, "height": 0.3, "depth": 0.05, "units": "relative", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "wood-stock", "materialLayers": ["wood-stock"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "bow", "type": "flush", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "grip-bulb", "description": "bulbous rounded grip at the rear end", "evidenceRef": "profile" }], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0.3, "bumpAmplitude": 0.02, "normalPattern": "wood grain", "displacementPattern": "none", "occlusionPattern": "darkened crease where the bow crosses the rail", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["front", "profile", "top"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(94,58,32,1.0)", "secondaryAlbedo": "rgba(64,38,20,1.0)", "materialClass": "wood", "materialClassConfidence": 0.8 } };
  node_stock_1.add(mesh_stock_1);
  meshes["stock"] = mesh_stock_1;
  colliders["stock"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_stock_1);
  const attachment_bow_2 = { "parentSocket": "root", "localStart": [0, 0.07, 0], "localEnd": [0, 0.09, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.01, "endRadius": 0.01 };
  const endpoint_bow_2 = makeAttachmentEndpoint(attachment_bow_2);
  const node_bow_2 = new THREE.Group();
  node_bow_2.name = "Bow__pivot";
  if (endpoint_bow_2) {
    node_bow_2.position.copy(endpoint_bow_2.start);
    node_bow_2.rotation.set(0, 0, 0);
    node_bow_2.scale.set(1, 1, 1);
  } else {
    node_bow_2.position.set(0, 0.08, 0);
    node_bow_2.rotation.set(0, 0, 0);
    node_bow_2.scale.set(1, 1, 1);
  }
  node_bow_2.userData.sculptComponent = { "id": "bow", "name": "Bow", "level": "macro", "role": "crossbar", "importance": 0.95, "confidence": 0.75, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Recurve limbs sweeping out from a center mount and curving back at the tips -- a 3D spine sweep, not a straight bar.", "geometryDescriptor": { "topologyIntent": "sweep a small oval cross-section along a symmetric recurve spine", "edgeTreatment": { "type": "chamfer", "bevelRadius": 3e-3, "segments": 3 }, "deformationStack": ["recurve bend toward each tip"], "uvStrategy": "planar", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, 0.07, 0], "localEnd": [0, 0.09, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.01, "endRadius": 0.01 }, "dimensions": { "width": 0.4, "height": 0.02, "depth": 0.012, "units": "relative", "confidence": 0.7 }, "transform": { "position": [0, 0.08, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.08, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "stock", "type": "flush", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "recurve-tips", "description": "limb tips curve backward, away from the direction of the shot", "evidenceRef": "front" }], "surfaceDetail": { "macroRoughness": 0.4, "microRoughness": 0.15, "bumpAmplitude": 0.01, "normalPattern": "satin metal", "displacementPattern": "none", "occlusionPattern": "darkened at the center mount", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["front", "top"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(176,141,87,1.0)", "secondaryAlbedo": "rgba(120,92,52,1.0)", "materialClass": "metal", "materialClassConfidence": 0.75 } };
  node_bow_2.userData.actionProfile = { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.08, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } };
  (nodes["root"] ?? root).add(node_bow_2);
  nodes["bow"] = node_bow_2;
  const mesh_bow_2Geometry = buildCurveSweepGeometry({ "spine": [[-0.2, 5e-3, -0.025], [-0.16, 0.028, -0.01], [-0.09, 0.022, 6e-3], [-0.03, 5e-3, 0.012], [0, -5e-3, 0.014], [0.03, 5e-3, 0.012], [0.09, 0.022, 6e-3], [0.16, 0.028, -0.01], [0.2, 5e-3, -0.025]], "crossSection": { "points": [[-7e-3, -35e-4], [7e-3, -35e-4], [7e-3, 35e-4], [-7e-3, 35e-4]] }, "closed": false });
  const mesh_bow_2 = new THREE.Mesh(
    mesh_bow_2Geometry,
    materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_bow_2.name = "Bow";
  if (endpoint_bow_2) {
    mesh_bow_2.position.copy(endpoint_bow_2.midpoint);
    mesh_bow_2.quaternion.copy(endpoint_bow_2.quaternion);
  }
  mesh_bow_2.castShadow = options.castShadow ?? true;
  mesh_bow_2.receiveShadow = options.receiveShadow ?? true;
  mesh_bow_2.userData.sculptComponent = { "id": "bow", "name": "Bow", "level": "macro", "role": "crossbar", "importance": 0.95, "confidence": 0.75, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Recurve limbs sweeping out from a center mount and curving back at the tips -- a 3D spine sweep, not a straight bar.", "geometryDescriptor": { "topologyIntent": "sweep a small oval cross-section along a symmetric recurve spine", "edgeTreatment": { "type": "chamfer", "bevelRadius": 3e-3, "segments": 3 }, "deformationStack": ["recurve bend toward each tip"], "uvStrategy": "planar", "normalStrategy": "computed vertex normals" }, "parent": "root", "attachment": { "parentSocket": "root", "localStart": [0, 0.07, 0], "localEnd": [0, 0.09, 0], "contactType": "flush", "embedDepth": 0, "overlap": 0.02, "gapTolerance": 0, "baseRadius": 0.01, "endRadius": 0.01 }, "dimensions": { "width": 0.4, "height": 0.02, "depth": 0.012, "units": "relative", "confidence": 0.7 }, "transform": { "position": [0, 0.08, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }, "actionProfile": { "animationRole": "static-prop-part", "pivot": { "mode": "custom", "localPosition": [0, 0.08, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "base" } }, "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [], "seams": [{ "withComponentId": "stock", "type": "flush", "worldUnitOverlap": 0.02 }], "localFeatures": [{ "id": "recurve-tips", "description": "limb tips curve backward, away from the direction of the shot", "evidenceRef": "front" }], "surfaceDetail": { "macroRoughness": 0.4, "microRoughness": 0.15, "bumpAmplitude": 0.01, "normalPattern": "satin metal", "displacementPattern": "none", "occlusionPattern": "darkened at the center mount", "edgeWearPattern": "none observed", "notes": "" }, "evidenceRefs": ["front", "top"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(176,141,87,1.0)", "secondaryAlbedo": "rgba(120,92,52,1.0)", "materialClass": "metal", "materialClassConfidence": 0.75 } };
  node_bow_2.add(mesh_bow_2);
  meshes["bow"] = mesh_bow_2;
  colliders["bow"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Simplified box proxy." };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_bow_2);
  {
    const stringPts = [
      new THREE.Vector3(-0.2, 0.01 + 0.08, -0.02),
      new THREE.Vector3(-0.05, -0.01 + 0.08, 0.03),
      new THREE.Vector3(0, -0.02 + 0.08, 0.05),
      new THREE.Vector3(0.05, -0.01 + 0.08, 0.03),
      new THREE.Vector3(0.2, 0.01 + 0.08, -0.02)
    ];
    const stringCurve = new THREE.CatmullRomCurve3(stringPts, false);
    const stringGeo = new THREE.TubeGeometry(stringCurve, 40, 15e-4, 5, false);
    const stringMat = new THREE.MeshStandardMaterial({ color: 2760728, roughness: 0.7, metalness: 0 });
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.name = "string";
    stringMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(stringMesh);
    meshes["string"] = stringMesh;
  }
  {
    const mountGeo = new THREE.BoxGeometry(0.024, 0.036, 0.022).translate(0, 0.08, 6e-3);
    const mountMesh = new THREE.Mesh(mountGeo, materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
    mountMesh.name = "mountBlock";
    mountMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(mountMesh);
    meshes["mountBlock"] = mountMesh;
  }
  {
    const railGeo = new THREE.BoxGeometry(6e-3, 0.13, 4e-3).translate(0, 0.085, 0.019);
    const railMesh = new THREE.Mesh(railGeo, materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
    railMesh.name = "railRidge";
    railMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(railMesh);
    meshes["railRidge"] = railMesh;
  }
  {
    const guardPts = [
      new THREE.Vector3(0, 0.03, -0.012),
      new THREE.Vector3(9e-3, -5e-3, -0.028),
      new THREE.Vector3(0.013, -0.035, -0.032),
      new THREE.Vector3(5e-3, -0.052, -0.024),
      new THREE.Vector3(-8e-3, -0.045, -0.014),
      new THREE.Vector3(-6e-3, -5e-3, -0.012)
    ];
    const guardCurve = new THREE.CatmullRomCurve3(guardPts, false);
    const guardGeo = new THREE.TubeGeometry(guardCurve, 40, 25e-4, 6, false);
    const guardMesh = new THREE.Mesh(guardGeo, materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
    guardMesh.name = "triggerGuard";
    guardMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(guardMesh);
    meshes["triggerGuard"] = guardMesh;
  }
  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups };
  root.userData.lookDevTargets = { "qualityPriority": "reference-fidelity", "materialPass": { "albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": { "requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry", "note": "Disabled: same background-saturation issue documented for the sword's material-evidence-decision.md applies here too (dark but saturated backdrop trips the extractor's foreground mask). Materials hand-authored from direct visual inspection instead." }, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"] }, "lightingPass": { "requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  root.userData.actionReadiness = {
    note: "Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets."
  };
  return root;
}
function createBallestaLookDevLights(mode = "neutral") {
  const lights = new THREE.Group();
  lights.name = "Ballesta look-dev lights";
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
  lights.userData.lightingFromPhoto = [{ "role": "key", "description": "Warm light from above and slightly in front, primary source of the wood's specular sheen and the bow's highlight. Neutral exposure, no aggressive tone mapping (filmic curve kept subtle)." }, { "role": "fill", "description": "Low warm ambient fill softening shadow falloff." }, { "role": "contact-shadow", "description": "Soft contact shadow where the grip would rest on a surface in standalone/inventory preview." }];
  lights.userData.lookDevTargets = { "qualityPriority": "reference-fidelity", "materialPass": { "albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": { "requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry", "note": "Disabled: same background-saturation issue documented for the sword's material-evidence-decision.md applies here too (dark but saturated backdrop trips the extractor's foreground mask). Materials hand-authored from direct visual inspection instead." }, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"] }, "lightingPass": { "requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  return lights;
}
function createBallestaEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}
function frameBallestaCamera(camera, object, options = {}) {
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
function createBallestaPresentationComposer(renderer, scene, camera, options = {}) {
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
function configureBallestaRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
function createBallestaInspectControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 8;
  controls.autoRotate = false;
  return controls;
}
export {
  configureBallestaRenderer,
  createBallestaEnvironment,
  createBallestaInspectControls,
  createBallestaLookDevLights,
  createBallestaModel,
  createBallestaPresentationComposer,
  frameBallestaCamera
};
