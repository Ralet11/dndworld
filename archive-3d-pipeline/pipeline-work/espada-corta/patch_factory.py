"""Reapply the hand-made fixes to a freshly generated createEspadaCortaModel.ts.
Needed after every `generate_threejs_factory.py --pass-id ... --force` call, since
none of these are encoded in the spec.

Profile coordinates for blade/guard/grip/pommel are estimated by hand from
reference.png + the user's detailed visual breakdown (laurel-leaf blade, S-curved
guard with a diamond center block, barrel-shaped ringed grip, teardrop pommel).

The blade and guard use a variable-thickness LOFT (adapted from a technique found
in a full-quality img2threejs example, createGlockGhostProtocolModel.ts:
offsetRing/subdivideCap/fieldNormals/lofted) instead of a constant-depth extrude,
so the blade gets a real raised fuller ridge and the guard's diamond center is
genuinely thicker than its arm tips -- not just wider in the 2D outline.
"""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'src/createEspadaCortaModel.ts'
with open(path, encoding='utf-8') as f:
    src = f.read()

# 1) root's fallback box is hardcoded 1x1x1 regardless of spec.dimensions (root has no
#    attachment endpoint of its own) -- shrink to negligible, root is meant to be an
#    empty organizational pivot, not a visible box.
src = src.replace(
    'new THREE.BoxGeometry(1, 1, 1, 12, 12, 12)',
    'new THREE.BoxGeometry(0.001, 0.001, 0.001, 1, 1, 1)',
)


def patch_component(src, component_id, replacement_call, geometry_fallback_regex):
    var = f"mesh_{component_id}Geometry"
    endpoint = f"endpoint_{component_id}"
    pattern = re.compile(
        rf'const {var} = {endpoint}\s*\n'
        rf'\s*\?\s*new THREE\.CylinderGeometry\([^)]*\)\s*\n'
        rf'\s*:\s*{geometry_fallback_regex};'
    )
    new_src, n = pattern.subn(f'const {var} = {replacement_call};', src)
    if n != 1:
        print(f'WARNING: {component_id} geometry pattern matched {n} times (expected 1) -- check manually', file=sys.stderr)
        return src, n
    return new_src, n


# 2) Variable-thickness loft machinery, injected once before createEspadaCortaModel.
#    Trimmed from the Glock example: no separate front/back/rim materials (all three
#    material groups point at index 0, so callers still pass a single material), no
#    texture projection (planarUV dropped, nothing here uses a map).
LOFT_CODE = '''
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
'''

if 'function swLofted' not in src:
    marker = 'export function createEspadaCortaModel'
    idx = src.index(marker)
    src = src[:idx] + LOFT_CODE.strip('\n') + '\n\n' + src[idx:]

# 3) blade -- laurel-leaf taper with a real raised fuller ridge (swLofted), not a
#    constant-depth flat plate.
blade_call = (
    "swLofted(buildExtrudeShape("
    '[[0.020,-0.33],[0.0235,-0.20],[0.022,-0.02],[0.015,0.15],'
    '[0.006,0.27],[0,0.33],[-0.006,0.27],[-0.015,0.15],[-0.022,-0.02],'
    '[-0.0235,-0.20],[-0.020,-0.33]]), (x,y,t) => t * swBladeHalf(x,y), () => 0)'
)
src, _ = patch_component(src, 'blade_1', blade_call, r'buildExtrudeGeometry\(\{[^}]*\}\)')

# 4) guard -- diamond center genuinely thicker than the arm tips (swLofted), not just
#    wider in the 2D outline.
guard_call = (
    "swLofted(buildExtrudeShape("
    '[[0,0.022],[0.018,0.006],[0.045,-0.004],[0.070,-0.014],'
    '[0.075,-0.026],[0.055,-0.010],[0.022,-0.001],[0,-0.018],'
    '[-0.022,-0.001],[-0.055,-0.010],[-0.075,-0.026],[-0.070,-0.014],'
    '[-0.045,-0.004],[-0.018,0.006]]), (x,y,t) => t * swGuardHalf(x), () => 0)'
)
src, _ = patch_component(src, 'guard_2', guard_call, r'buildCurveSweepGeometry\(\{.*?\}\)')

# 5) grip -- barrel profile (convex, wider in the middle than at the ends) with 5
#    wrap-band ridges, lathed around the long axis (lathe already gives correct 3D
#    shading around the axis, no need for the loft machinery here).
grip_call = (
    "buildLatheGeometry({"
    '"points": [[0.009,-0.105],[0.0115,-0.095],[0.0095,-0.085],[0.012,-0.06],'
    '[0.010,-0.045],[0.0125,-0.02],[0.010,0.005],[0.012,0.03],'
    '[0.0095,0.05],[0.0115,0.075],[0.009,0.105]], "segments": 24})'
)
src, _ = patch_component(src, 'grip_3', grip_call, r'new THREE\.CylinderGeometry\(0\.5, 0\.5, 1, 48, 16\)')

# 6) pommel -- teardrop, wide at the grip-facing top, rounding to a BLUNT (not sharp)
#    point at the bottom.
pommel_call = (
    "buildLatheGeometry({"
    '"points": [[0.004,-0.045],[0.014,-0.020],[0.010,0.005],[0.008,0.025],'
    '[0.016,0.032],[0.011,0.045]], "segments": 24})'
)
src, _ = patch_component(src, 'pommel_4', pommel_call, r'buildLatheGeometry\(\{[^}]*\}\)')

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)

print('patched:', path)
