"""Reapply hand-made fixes to a freshly generated createBallestaModel.ts.
Same pattern as the sword's patch_factory.py: the generator always falls back to a
generic CylinderGeometry for any component with a real attachment endpoint, so the
stock (lathe) and bow (curve-sweep) never get their intended detailed geometry
without this override.
"""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'src/createBallestaModel.ts'
with open(path, encoding='utf-8') as f:
    src = f.read()

# 1) root's fallback box is hardcoded 1x1x1 regardless of spec.dimensions.
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


# 2) stock -- bulbous grip (rear) lathing down into a narrower rail (front), not a
#    plain tapered cylinder. Points are [radius, y], y centered like the cylinder
#    convention (-length/2 .. +length/2).
stock_call = (
    "buildLatheGeometry({"
    '"points": [[0.006,-0.15],[0.030,-0.115],[0.032,-0.085],[0.026,-0.03],'
    '[0.017,0.0],[0.017,0.10],[0.015,0.15]], "segments": 20})'
)
src, _ = patch_component(src, 'stock_1', stock_call, r'buildLatheGeometry\(\{[^}]*\}\)')

# 3) bow -- real recurve: NOT a single smooth arc. The reference shows each limb
#    rising from the low center mount, bulging forward+up at mid-span, then curving
#    back down with the very tip kicking slightly up again -- an undulating S, found
#    by comparing this render against grid_r0_c2.png side by side (see conversation:
#    the first version's single-arc bow was flagged as a concrete mismatch).
bow_call = (
    "buildCurveSweepGeometry({"
    '"spine": [[-0.20,0.005,-0.025],[-0.16,0.028,-0.010],[-0.09,0.022,0.006],'
    '[-0.03,0.005,0.012],[0,-0.005,0.014],[0.03,0.005,0.012],[0.09,0.022,0.006],'
    '[0.16,0.028,-0.010],[0.20,0.005,-0.025]], '
    '"crossSection": {"points": [[-0.007,-0.0035],[0.007,-0.0035],[0.007,0.0035],[-0.007,0.0035]]}, '
    '"closed": false})'
)
src, _ = patch_component(src, 'bow_2', bow_call, r'buildCurveSweepGeometry\(\{.*?\}\)')

# 4) string -- thin tube tip-to-tip, drawn back slightly toward the stock's rail
#    (the reference shows it cocked/strung, not slack). Injected as an extra mesh,
#    same technique as the Glock example's coiled recoil spring: a small tube swept
#    along a hand-authored curve, not part of the spec's componentTree.
STRING_CODE = '''
  // ---- string: hand-added detail, not part of componentTree (see patch_factory.py) ----
  {
    const stringPts = [
      new THREE.Vector3(-0.20, 0.01 + 0.08, -0.020),
      new THREE.Vector3(-0.05, -0.01 + 0.08, 0.03),
      new THREE.Vector3(0, -0.02 + 0.08, 0.05),
      new THREE.Vector3(0.05, -0.01 + 0.08, 0.03),
      new THREE.Vector3(0.20, 0.01 + 0.08, -0.020),
    ];
    const stringCurve = new THREE.CatmullRomCurve3(stringPts, false);
    const stringGeo = new THREE.TubeGeometry(stringCurve, 40, 0.0015, 5, false);
    const stringMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.7, metalness: 0.0 });
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.name = 'string';
    stringMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(stringMesh);
    meshes["string"] = stringMesh;
  }
'''
# 5) center mount block -- the reference shows a distinct angular brass bracket where
#    the bow crosses the stock, not the stock's cylinder just continuing through. A
#    plain box reads as a mounting collar without needing its own componentTree entry.
MOUNT_CODE = '''
  // ---- bow mount block: hand-added, not part of componentTree ----
  {
    const mountGeo = new THREE.BoxGeometry(0.024, 0.036, 0.022).translate(0, 0.08, 0.006);
    const mountMesh = new THREE.Mesh(mountGeo, materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }));
    mountMesh.name = 'mountBlock';
    mountMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(mountMesh);
    meshes["mountBlock"] = mountMesh;
  }
'''

# 6) rail ridge -- a raised track along the top of the rail section the reference
#    shows clearly; the stock's lathe profile is axisymmetric and can't carry a
#    one-sided ridge, so it's added as a thin box riding on the rail's top surface.
RAIL_CODE = '''
  // ---- rail ridge: hand-added, not part of componentTree ----
  {
    const railGeo = new THREE.BoxGeometry(0.006, 0.13, 0.004).translate(0, 0.085, 0.019);
    const railMesh = new THREE.Mesh(railGeo, materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }));
    railMesh.name = 'railRidge';
    railMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(railMesh);
    meshes["railRidge"] = railMesh;
  }
'''

# 7) trigger guard -- completely absent from the first pass despite being one of the
#    most visible features in the profile reference (grid_r2_c0.png): an ornate loop
#    hanging below the neck with a scrolled flourish at the bottom. Swept the same way
#    as the string (tube along a hand-authored curve), on the underside (-Z) opposite
#    the bow's forward bulge.
GUARD_CODE = '''
  // ---- trigger guard: hand-added, not part of componentTree ----
  {
    const guardPts = [
      new THREE.Vector3(0, 0.03, -0.012),
      new THREE.Vector3(0.009, -0.005, -0.028),
      new THREE.Vector3(0.013, -0.035, -0.032),
      new THREE.Vector3(0.005, -0.052, -0.024),
      new THREE.Vector3(-0.008, -0.045, -0.014),
      new THREE.Vector3(-0.006, -0.005, -0.012),
    ];
    const guardCurve = new THREE.CatmullRomCurve3(guardPts, false);
    const guardGeo = new THREE.TubeGeometry(guardCurve, 40, 0.0025, 6, false);
    const guardMesh = new THREE.Mesh(guardGeo, materialMap["bronze-fittings"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }));
    guardMesh.name = 'triggerGuard';
    guardMesh.castShadow = options.castShadow ?? true;
    (nodes["root"] ?? root).add(guardMesh);
    meshes["triggerGuard"] = guardMesh;
  }
'''

marker = 'root.userData.sculptRuntime'
if 'name = \'string\'' not in src:
    idx = src.index(marker)
    extra = STRING_CODE.strip('\n') + '\n\n' + MOUNT_CODE.strip('\n') + '\n\n' + RAIL_CODE.strip('\n') + '\n\n' + GUARD_CODE.strip('\n')
    src = src[:idx] + extra + '\n\n  ' + src[idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)

print('patched:', path)
