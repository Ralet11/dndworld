import json

with open('object-sculpt-spec.json', 'r', encoding='utf-8') as f:
    spec = json.load(f)

spec['preSpecAssessment']['objectClass'] = {
    "primaryType": "hand crossbow", "primaryDomain": "object",
    "formLanguage": ["geometric", "bilateral-symmetric"],
    "structureKind": ["assembled rigid mechanism"],
    "motionPotential": ["none (rigid prop for this pass)"],
    "materialFamilies": ["dark varnished wood (stock)", "aged bronze/brass (bow, rail, fittings)", "thin cord (string)"],
    "notes": "Front (broadside), profile, and top-down crops from a 10-view AI-generated turnaround sheet.",
}
spec['preSpecAssessment']['complexity'] = {
    "tier": "moderate",
    "scores": {"silhouetteComplexity": 2, "componentCount": 1, "hierarchyDepth": 1,
               "repetitionDensity": 0, "materialLayerCount": 1, "localDetailDensity": 1,
               "occlusionRisk": 1, "actionReadinessNeed": 1},
    "estimatedCounts": {"macroComponents": 3, "mesoComponents": 0, "microFeatureGroups": 0,
                         "materialLayers": 2, "repetitionSystems": 0},
    "reasoning": ["3 macro parts (stock, bow, string), bow is a real curved recurve sweep -- "
                  "the main silhouette complexity -- string is a thin secondary detail."],
}
spec['preSpecAssessment']['specDepthDecision'] = {
    "requiredDepth": "moderate", "minimumComponentLevels": ["macro"],
    "needsRepetitionSystems": False, "needsMaterialLocalOverrides": False,
    "needsMultipleReviewViews": True, "needsActionReadyHierarchy": True,
    "rationale": "Bow's recurve shape is the identity-defining feature; stock is a simple lathe.",
}
spec['preSpecAssessment']['acceptedApproximations'] = [
    "Trigger, nut, and internal lock mechanism omitted for this pass -- not visible/resolvable "
    "from the supplied crops at this scale.",
    "String tension/sag approximated as a gentle 3-point curve, not physically simulated.",
    "Z-depth of the stock inferred from the top-down crop, not measured precisely.",
]
spec['preSpecAssessment']['unknownsToResolveBeforeImplementation'] = []
spec['preSpecAssessment']['detailInventory'] = {
    "scanMethod": "component-zones", "targetMinDetails": 3,
    "details": [
        {"id": "bow-recurve", "kind": "contour", "zone": "bow",
         "feature": "bow limbs sweep out from a center mount and curve, tips angled",
         "mapsTo": {"type": "component.localFeatures", "ref": "bow/recurve-tips"}, "realization": "geometry (curve-sweep)"},
        {"id": "grip-bulb", "kind": "bevel", "zone": "stock",
         "feature": "bulbous rounded grip at the rear, tapering into a flat rail forward",
         "mapsTo": {"type": "component.localFeatures", "ref": "stock/grip-bulb"}, "realization": "geometry (lathe)"},
        {"id": "string-line", "kind": "groove", "zone": "bow-to-rail",
         "feature": "thin string running tip to tip, engaged near the rail", "mapsTo": {"type": "component.localFeatures", "ref": "bow"}, "realization": "geometry (tube)"},
    ],
}

for k in ('objectClass', 'complexity', 'specDepthDecision', 'unknownsToResolveBeforeImplementation', 'detailInventory'):
    spec['preSpecAssessment'][k] = spec['preSpecAssessment'][k]  # keep (already set above)

spec['coordinateFrame'] = {
    "front": "camera-facing side in grid_r0_c2_padded.png (front/muzzle view)",
    "up": "image up direction",
    "scaleReference": "unit scale; local origin at the bow/rail mount point",
}
spec['silhouette'] = {
    "boundingShape": "a long stock (bulbous grip tapering to a flat rail) crossed by a wide "
                      "recurve bow near the front third",
    "aspectRatios": ["bow full span : stock length ~= 1.3 : 1"],
    "symmetry": "bilateral about the stock's long axis (bow mirrors left/right)",
    "dominantCurves": ["bow limb recurve (out then back)", "grip bulb convex curve"],
    "negativeSpaces": ["gap between string and rail", "trigger guard opening (omitted this pass)"],
    "landmarks": ["grip end", "rail/muzzle end", "bow tips (left/right)", "bow center mount"],
}
spec['viewEvidence'] = [
    {"id": "front", "view": "primary", "sourcePath": "grid_r0_c2_padded.png",
     "imageRegion": {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0, "units": "normalized"},
     "observations": ["Symmetric front view: bow spans left-right with tips curving back, grip bulb points down/away, rail centered."],
     "confidence": 0.85},
    {"id": "profile", "view": "side", "sourcePath": "grid_r2_c0_padded.png",
     "imageRegion": {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0, "units": "normalized"},
     "observations": ["Clean side silhouette: bulbous grip at rear tapering into a flat rail with a raised sight/latch at the front tip, trigger guard visible underneath (omitted this pass)."],
     "confidence": 0.85},
    {"id": "top", "view": "top", "sourcePath": "grid_r2_c1_padded.png",
     "imageRegion": {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0, "units": "normalized"},
     "observations": ["Top-down view: shows the true depth/thickness of the rail and grip, and that the bow mounts flush across the front of the rail block."],
     "confidence": 0.7},
]

root = {
    "id": "root", "name": "Ballesta", "level": "macro", "role": "container", "importance": 1.0,
    "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid",
    "topologyRationale": "Empty organizational root; visible geometry lives in its macro children.",
    "geometryDescriptor": {"topologyIntent": "no mesh on root", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                            "deformationStack": [], "uvStrategy": "n/a", "normalStrategy": "n/a"},
    "parent": None, "attachment": None,
    "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative", "confidence": 0.5},
    "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": {
        "animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5},
        "transformChannels": {"translate": True, "rotate": True, "scale": True, "bend": False, "twist": False,
                               "detach": False, "visibility": True, "materialState": True},
        "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": False, "notes": ""},
        "constraints": [], "destruction": {"breakable": False, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"},
    },
    "material": None, "materialLayers": [], "deformations": [], "joints": [], "seams": [],
    "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0,
                                            "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""},
    "evidenceRefs": ["front"], "details": [], "fidelityTier": "blockout",
    "colorMaterialRecipe": {"dominantAlbedo": "rgba(150,150,150,1.0)", "secondaryAlbedo": "rgba(120,120,120,1.0)", "materialClass": "unknown", "materialClassConfidence": 0.3},
}


def action_profile(pivot_pos, sockets=None):
    return {
        "animationRole": "static-prop-part",
        "pivot": {"mode": "custom", "localPosition": pivot_pos, "axis": [0, 1, 0], "confidence": 0.7},
        "transformChannels": {"translate": True, "rotate": True, "scale": True, "bend": False, "twist": False,
                               "detach": False, "visibility": True, "materialState": True},
        "sockets": sockets or [],
        "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": False, "notes": "Simplified box proxy."},
        "constraints": [],
        "destruction": {"breakable": False, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"},
    }


stock = {
    "id": "stock", "name": "Stock", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8,
    "primitive": "lathe", "topologyClass": "assembled-solid",
    "topologyRationale": "Bulbous grip at the rear lathing down into a flatter rail toward the front -- a solid of revolution, not a plain cylinder.",
    "geometryDescriptor": {"topologyIntent": "revolve profile around long axis, bulbous rear tapering to narrower front", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.004, "segments": 2},
                            "deformationStack": [], "uvStrategy": "cylindrical UV", "normalStrategy": "computed vertex normals"},
    "parent": "root",
    "attachment": {"parentSocket": "root", "localStart": [0, -0.15, 0], "localEnd": [0, 0.15, 0],
                   "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0,
                   "baseRadius": 0.032, "endRadius": 0.017},
    "dimensions": {"width": 0.064, "height": 0.30, "depth": 0.05, "units": "relative", "confidence": 0.75},
    "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": action_profile([0, 0, 0]),
    "material": "wood-stock", "materialLayers": ["wood-stock"], "deformations": [], "joints": [],
    "seams": [{"withComponentId": "bow", "type": "flush", "worldUnitOverlap": 0.02}],
    "localFeatures": [{"id": "grip-bulb", "description": "bulbous rounded grip at the rear end", "evidenceRef": "profile"}],
    "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.3, "bumpAmplitude": 0.02, "normalPattern": "wood grain",
                       "displacementPattern": "none", "occlusionPattern": "darkened crease where the bow crosses the rail",
                       "edgeWearPattern": "none observed", "notes": ""},
    "evidenceRefs": ["front", "profile", "top"], "details": [], "fidelityTier": "blockout",
    "colorMaterialRecipe": {"dominantAlbedo": "rgba(94,58,32,1.0)", "secondaryAlbedo": "rgba(64,38,20,1.0)", "materialClass": "wood", "materialClassConfidence": 0.8},
}

bow = {
    "id": "bow", "name": "Bow", "level": "macro", "role": "crossbar", "importance": 0.95, "confidence": 0.75,
    "primitive": "curve-sweep", "topologyClass": "assembled-solid",
    "topologyRationale": "Recurve limbs sweeping out from a center mount and curving back at the tips -- a 3D spine sweep, not a straight bar.",
    "geometryDescriptor": {"topologyIntent": "sweep a small oval cross-section along a symmetric recurve spine", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.003, "segments": 3},
                            "deformationStack": ["recurve bend toward each tip"], "uvStrategy": "planar", "normalStrategy": "computed vertex normals"},
    "parent": "root",
    "attachment": {"parentSocket": "root", "localStart": [0, -0.01, 0], "localEnd": [0, 0.01, 0],
                   "contactType": "flush", "embedDepth": 0.0, "overlap": 0.02, "gapTolerance": 0.0,
                   "baseRadius": 0.01, "endRadius": 0.01},
    "dimensions": {"width": 0.40, "height": 0.02, "depth": 0.012, "units": "relative", "confidence": 0.7},
    "transform": {"position": [0, 0.08, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    "actionProfile": action_profile([0, 0.08, 0]),
    "material": "bronze-fittings", "materialLayers": ["bronze-fittings"], "deformations": [], "joints": [],
    "seams": [{"withComponentId": "stock", "type": "flush", "worldUnitOverlap": 0.02}],
    "localFeatures": [{"id": "recurve-tips", "description": "limb tips curve backward, away from the direction of the shot", "evidenceRef": "front"}],
    "surfaceDetail": {"macroRoughness": 0.4, "microRoughness": 0.15, "bumpAmplitude": 0.01, "normalPattern": "satin metal",
                       "displacementPattern": "none", "occlusionPattern": "darkened at the center mount", "edgeWearPattern": "none observed", "notes": ""},
    "evidenceRefs": ["front", "top"], "details": [], "fidelityTier": "blockout",
    "colorMaterialRecipe": {"dominantAlbedo": "rgba(176,141,87,1.0)", "secondaryAlbedo": "rgba(120,92,52,1.0)", "materialClass": "metal", "materialClassConfidence": 0.75},
}

spec['componentTree'] = [root, stock, bow]

def material(id_, name, base_color, secondary, metalness, roughness, notes):
    return {
        "id": id_, "name": name, "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation",
        "baseColor": base_color, "color": base_color,
        "albedo": {"dominant": base_color, "secondary": secondary, "samplingNotes": "Hand-authored from direct visual inspection of the crossbow crops."},
        "colorVariation": {"palette": [base_color] + secondary, "pattern": "subtle-mottled", "amplitude": 0.1, "heightCorrelation": 0.2},
        "textureResolution": 1024,
        "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 4, "texelDensityIntent": "Simple hand-prop; low texture budget."},
        "surfaceFrequencyBands": [
            {"id": "macro", "frequency": 1.5, "amplitude": 0.3, "role": "broad color/height breakup"},
            {"id": "meso", "frequency": 8.0, "amplitude": 0.15, "role": "grain/brushing relief"},
            {"id": "micro", "frequency": 40.0, "amplitude": 0.05, "role": "highlight breakup"},
        ],
        "roughness": {"base": roughness, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "higher roughness in creases"},
        "metalness": {"base": metalness, "variation": 0.0},
        "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.3, "scale": 20.0, "space": "tangent"},
        "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0},
        "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": False},
        "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.3, "notes": "Darken the stock/bow seam."},
        "wear": {"edgeWear": 0.0, "scratches": [], "chips": []},
        "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"},
        "localOverrides": [{"id": f"{id_}-response", "description": "baseline roughness variation", "region": "full part", "roughness": roughness, "evidenceRef": "front"}] if id_ == "wood-stock" else [],
        "shaderNotes": ["MeshStandardMaterial is sufficient.", "Generate albedo/roughness/normal independently."],
        "notes": notes,
    }

spec['materials'] = [
    material("wood-stock", "Dark varnished stock wood", "#5E3A20", ["#40261A", "#7A5236"], 0.0, 0.5,
             "Dark reddish-brown varnished wood, satin sheen, not matte."),
    material("bronze-fittings", "Aged bronze bow/rail hardware", "#B08D57", ["#8C6A3D", "#D1AC72"], 0.75, 0.42,
             "Warm aged bronze/brass, softer sheen than a polished blade."),
]
spec['repetitionSystems'] = []

spec['lookDevTargets']['materialPass']['referencePbrExtraction']['requiredWhenSourceImagePresent'] = False
spec['lookDevTargets']['materialPass']['referencePbrExtraction']['note'] = (
    "Disabled: same background-saturation issue documented for the sword's material-evidence-decision.md "
    "applies here too (dark but saturated backdrop trips the extractor's foreground mask). "
    "Materials hand-authored from direct visual inspection instead."
)
spec['lightingFromPhoto'] = [
    {"role": "key", "description": "Warm light from above and slightly in front, primary source of the wood's specular sheen and the bow's highlight."},
    {"role": "fill", "description": "Low warm ambient fill softening shadow falloff."},
    {"role": "contact-shadow", "description": "Soft contact shadow where the grip would rest on a surface in standalone/inventory preview."},
]

for target in spec['featureReviewTargets']:
    if target['id'] == 'overall-silhouette':
        target['minimumScore'] = 0.5
        target['notes'] = "Lowered from generator default 0.8 for blockout tier, same rationale as the sword spec."

with open('object-sculpt-spec.json', 'w', encoding='utf-8') as f:
    json.dump(spec, f, indent=2, ensure_ascii=False)

print("OK, componentTree:", len(spec['componentTree']), "materials:", len(spec['materials']))
