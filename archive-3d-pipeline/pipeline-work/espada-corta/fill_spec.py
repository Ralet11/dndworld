import json

with open('object-sculpt-spec.json', 'r', encoding='utf-8') as f:
    spec = json.load(f)

spec['coordinateFrame'] = {
    "front": "camera-facing side in the reference image",
    "up": "image up direction (+Y = toward blade tip)",
    "scaleReference": "unit scale; local origin (0,0,0) is the grip midpoint — the natural hand-hold point when equipped in a socket"
}

spec['performanceBudget'] = {
    "qualityPriority": "reference-fidelity",
    "targetTriangles": 6000,
    "maxDrawCalls": 6,
    "textureSize": 512,
    "fpsTarget": 60,
    "optimizationPolicy": "Simple hand-prop budget for mobile (many items+characters on screen at once) — see project note: 250000 default triangles is far too high for this use case, reduced to 6000 as a starting cap, revisit after first browser render's actual triangle count."
}

def base_action_profile(pivot_pos, sockets=None):
    return {
        "animationRole": "static-prop-part",
        "pivot": {"mode": "custom", "localPosition": pivot_pos, "axis": [0, 1, 0], "confidence": 0.7},
        "transformChannels": {
            "translate": True, "rotate": True, "scale": True,
            "bend": False, "twist": False, "detach": False,
            "visibility": True, "materialState": True
        },
        "sockets": sockets or [],
        "collider": {"type": "capsule", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": False,
                     "notes": "Simplified capsule proxy along the long axis; not used for gameplay physics in v1, kept for future interaction-pass."},
        "constraints": [],
        "destruction": {"breakable": False, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}
    }

root = {
    "id": "root", "name": "Espada Corta", "level": "macro", "role": "container",
    "importance": 1.0, "confidence": 0.85, "primitive": "group",
    "topologyClass": "assembled-solid",
    "topologyRationale": "Empty organizational root; visible geometry lives entirely in its 4 macro children (blade, guard, grip, pommel).",
    "geometryDescriptor": {"topologyIntent": "no mesh on root", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                            "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a"},
    "parent": None, "attachment": None,
    "dimensions": {"width": 0.13, "height": 1.0, "depth": 0.05, "units": "relative to grip midpoint", "confidence": 0.7},
    "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": base_action_profile([0, 0, 0]),
    "material": None, "materialLayers": [], "deformations": [], "joints": [], "seams": [],
    "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0,
                                            "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""},
    "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"
}

blade = {
    "id": "blade", "name": "Blade", "level": "macro", "role": "primary-form",
    "importance": 1.0, "confidence": 0.85, "primitive": "extruded-profile",
    "topologyClass": "tapered-solid-of-revolution-like",
    "topologyRationale": "Flat double-edged taper with a raised centerline fuller — modeled as an extruded diamond-ish cross-section profile lofted from root (wide) to tip (point), not a simple box, to carry the fuller ridge and taper accurately.",
    "geometryDescriptor": {
        "topologyIntent": "lofted extrude along +Y from a flattened-diamond cross-section at the root to a converged point at the tip",
        "edgeTreatment": {"type": "bevel", "bevelRadius": 0.004, "segments": 2},
        "deformationStack": ["linear taper (width and thickness both taper root->tip)"],
        "uvStrategy": "planar UV along the flat faces, seam at the centerline fuller",
        "normalStrategy": "computed vertex normals; centerline fuller kept as real geometry (not a normal-map fake) since it affects the grazing-light silhouette"
    },
    "parent": "root",
    "attachment": {"parentSocket": "root", "localStart": [0, 0.14, 0], "localEnd": [0, 0.80, 0],
                   "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0},
    "dimensions": {"width": 0.045, "height": 0.66, "depth": 0.012, "units": "relative to grip midpoint", "confidence": 0.8},
    "transform": {"position": [0, 0.14, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": base_action_profile([0, 0.14, 0]),
    "material": "steel-blade", "materialLayers": ["steel-blade"], "deformations": [], "joints": [],
    "seams": [{"withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02}],
    "localFeatures": [
        {"id": "fuller-spine", "description": "raised centerline ridge running the full blade length, splitting the two facets", "evidenceRef": "zone-r0c1"},
        {"id": "blade-tip", "description": "symmetric double-edged point converging to a single apex", "evidenceRef": "zone-r0c1"}
    ],
    "surfaceDetail": {"macroRoughness": 0.3, "microRoughness": 0.15, "bumpAmplitude": 0.02,
                       "normalPattern": "faint brushed-metal linear striation along the length",
                       "displacementPattern": "none beyond the modeled fuller geometry", "occlusionPattern": "slight darkening at the fuller valley",
                       "edgeWearPattern": "none observed — clean unweathered blade", "notes": "unknown: exact cross-section (flat vs diamond) not confirmed from this single frontal view"},
    "evidenceRefs": ["full-object", "zone-r0c1"], "details": [], "fidelityTier": "blockout"
}

guard = {
    "id": "guard", "name": "Guard", "level": "macro", "role": "crossbar",
    "importance": 0.85, "confidence": 0.8, "primitive": "lofted-curve",
    "topologyClass": "flattened-lofted-solid",
    "topologyRationale": "Crescent crossbar with downturned tapered tips — a lofted curve profile swept and tapered toward each tip, not a straight box crossguard.",
    "geometryDescriptor": {
        "topologyIntent": "horizontal loft along local X, curving down toward +/-X extremes, tapering in thickness toward the tips",
        "edgeTreatment": {"type": "bevel", "bevelRadius": 0.006, "segments": 3},
        "deformationStack": ["downward bend toward each tip"],
        "uvStrategy": "planar UV along the sweep",
        "normalStrategy": "computed vertex normals"
    },
    "parent": "root",
    "attachment": {"parentSocket": "root", "localStart": [0, 0.10, 0], "localEnd": [0, 0.14, 0],
                   "contactType": "butt", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0},
    "dimensions": {"width": 0.13, "height": 0.04, "depth": 0.018, "units": "relative to grip midpoint", "confidence": 0.8},
    "transform": {"position": [0, 0.10, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": base_action_profile([0, 0.10, 0]),
    "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [],
    "seams": [{"withComponentId": "blade", "type": "butt", "worldUnitOverlap": 0.02}, {"withComponentId": "grip", "type": "butt", "worldUnitOverlap": 0.02}],
    "localFeatures": [
        {"id": "guard-tips", "description": "swept, downturned, tapered tips on both sides (not blunt/straight)", "evidenceRef": "zone-r1c1"}
    ],
    "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.015,
                       "normalPattern": "satin metal micro-facets", "displacementPattern": "none", "occlusionPattern": "darkened crease where guard meets grip",
                       "edgeWearPattern": "none observed", "notes": ""},
    "evidenceRefs": ["full-object", "zone-r1c1"], "details": [], "fidelityTier": "blockout"
}

grip = {
    "id": "grip", "name": "Grip", "level": "macro", "role": "handle",
    "importance": 0.7, "confidence": 0.8, "primitive": "cylinder",
    "topologyClass": "ribbed-cylindrical-solid",
    "topologyRationale": "Cylinder with a repeated wrap-cord ridge pattern (repetitionSystems.grip-wrap) — this is the natural hand-hold and equip-socket alignment point.",
    "geometryDescriptor": {
        "topologyIntent": "cylinder core with radial ridge loops repeated along +Y per repetitionSystems.grip-wrap",
        "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.003, "segments": 8},
        "deformationStack": [], "uvStrategy": "cylindrical UV, V repeats per wrap ridge", "normalStrategy": "computed vertex normals + ridge geometry"
    },
    "parent": "root",
    "attachment": {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, 0.10, 0],
                   "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0},
    "dimensions": {"width": 0.022, "height": 0.21, "depth": 0.022, "units": "relative to grip midpoint", "confidence": 0.8},
    "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": base_action_profile([0, 0, 0], sockets=[
        {"id": "hand-hold", "description": "reference point for how a hand/grip-socket should align on this item; not an equip socket itself (the character model owns grip_right_hand)", "localPosition": [0, 0, 0]}
    ]),
    "material": "leather-grip", "materialLayers": ["leather-grip"], "deformations": [], "joints": [],
    "seams": [{"withComponentId": "guard", "type": "butt", "worldUnitOverlap": 0.02}, {"withComponentId": "pommel", "type": "butt", "worldUnitOverlap": 0.02}],
    "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.8, "microRoughness": 0.35, "bumpAmplitude": 0.04,
                       "normalPattern": "leather-wrap fiber grain between ridges", "displacementPattern": "wrap ridges are real geometry, not displacement",
                       "occlusionPattern": "darkened valleys between wrap ridges", "edgeWearPattern": "none observed", "notes": ""},
    "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout"
}

pommel = {
    "id": "pommel", "name": "Pommel", "level": "macro", "role": "cap",
    "importance": 0.5, "confidence": 0.75, "primitive": "teardrop-solid-of-revolution",
    "topologyClass": "solid-of-revolution",
    "topologyRationale": "Bulbous acorn/teardrop cap with a raised metal rim band at its base — a lathed/revolved profile, not a plain sphere or cone.",
    "geometryDescriptor": {
        "topologyIntent": "revolve a teardrop profile curve around +Y, with a distinct raised ring band at the top (grip-facing) edge",
        "edgeTreatment": {"type": "bevel", "bevelRadius": 0.004, "segments": 2},
        "deformationStack": [], "uvStrategy": "spherical UV", "normalStrategy": "computed vertex normals"
    },
    "parent": "root",
    "attachment": {"parentSocket": "root", "localStart": [0, -0.11, 0], "localEnd": [0, -0.20, 0],
                   "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0},
    "dimensions": {"width": 0.03, "height": 0.09, "depth": 0.03, "units": "relative to grip midpoint", "confidence": 0.75},
    "transform": {"position": [0, -0.11, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": base_action_profile([0, -0.11, 0]),
    "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [],
    "seams": [{"withComponentId": "grip", "type": "flush", "worldUnitOverlap": 0.02}],
    "localFeatures": [
        {"id": "pommel-rim-band", "description": "raised metal rim/band at the pommel's grip-facing base, distinct from the teardrop body", "evidenceRef": "zone-r2c1"}
    ],
    "surfaceDetail": {"macroRoughness": 0.35, "microRoughness": 0.12, "bumpAmplitude": 0.01,
                       "normalPattern": "satin metal", "displacementPattern": "none", "occlusionPattern": "darkened crease under the rim band",
                       "edgeWearPattern": "none observed", "notes": "back/underside hidden in this view — assumed rotationally symmetric"},
    "evidenceRefs": ["full-object", "zone-r2c1"], "details": [], "fidelityTier": "blockout"
}

spec['componentTree'] = [root, blade, guard, grip, pommel]

def material(id_, name, base_color, secondary, metalness, roughness, notes):
    return {
        "id": id_, "name": name, "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation",
        "baseColor": base_color, "color": base_color,
        "albedo": {"dominant": base_color, "secondary": secondary, "samplingNotes": "Image-observed local color zones from reference_padded.png; not extracted via PBR script yet (pending material-evidence step)."},
        "colorVariation": {"palette": [base_color] + secondary, "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2},
        "textureResolution": 512,
        "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; keep texture budget low per performanceBudget."},
        "surfaceFrequencyBands": [
            {"id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup"},
            {"id": "meso", "frequency": 8.0, "amplitude": 0.15, "role": "brushing/wrap-ridge relief"},
            {"id": "micro", "frequency": 40.0, "amplitude": 0.05, "role": "highlight breakup under grazing light"}
        ],
        "roughness": {"base": roughness, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in cavities/creases, lower on worn/polished edges"},
        "metalness": {"base": metalness, "variation": 0.0},
        "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20.0, "space": "tangent"},
        "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0},
        "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": False},
        "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken seams between blade/guard/grip/pommel and the grip wrap-ridge valleys."},
        "wear": {"edgeWear": 0.0, "scratches": [], "chips": []},
        "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"},
        "localOverrides": [],
        "shaderNotes": ["MeshStandardMaterial is sufficient — no clearcoat/transmission observed.", "Generate albedo/roughness/normal independently; do not alias albedo into roughness."],
        "notes": notes
    }

spec['materials'] = [
    material("steel-blade", "Blade steel", "#AEA98F", ["#C9C4A6", "#7D7A66"], 0.85, 0.32,
             "Satin steel, not mirror-polished — soft specular falloff on the flats, sharper highlight along the fuller."),
    material("bronze-fittings", "Bronze guard/pommel", "#B08D57", ["#8C6A3D", "#D1AC72"], 0.8, 0.38,
             "Warmer-toned metal than the blade; guard and pommel share this material family per image_analysis.md layer 5 (uncertain vs. blade steel from this crop alone, flagged in unknowns)."),
    material("leather-grip", "Leather-wrapped grip", "#5C4530", ["#432F1F", "#71543A"], 0.0, 0.78,
             "Non-metal, matte, fibrous — wrap ridges carried as real geometry per grip.geometryDescriptor, not painted into the normal map alone (antiShallowSpecRules).")
]

spec['repetitionSystems'] = [
    {
        "id": "grip-wrap",
        "description": "Evenly spaced cord-wrap ridge loops around the grip cylinder.",
        "parentComponentId": "grip",
        "unitGeometry": "torus-like ridge loop, radius matches grip radius + 0.002",
        "count": 5,
        "spacing": {"mode": "even", "axis": "Y", "start": -0.09, "end": 0.08},
        "variation": {"scale": 0.0, "rotation": 0.0, "note": "uniform — no observed irregularity in the wrap spacing"},
        "confidence": 0.6,
        "evidenceRefs": ["zone-r2c1"],
        "notes": "Exact ridge count is uncertain (image_analysis.md Layer 8) — 5 is an estimate from visible spacing extrapolated across the full grip height; adjust after first browser render against the reference."
    }
]

with open('object-sculpt-spec.json', 'w', encoding='utf-8') as f:
    json.dump(spec, f, indent=2, ensure_ascii=False)

print("OK, componentTree:", len(spec['componentTree']), "materials:", len(spec['materials']))
