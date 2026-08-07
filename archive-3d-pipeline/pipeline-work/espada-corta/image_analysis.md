# Image Analysis — Espada Corta (reference_padded.png)

## Layer 1 — Identification & classification
- Work type: short sword / dagger-length single-handed blade.
- Broad classification: bladed melee weapon.
- primaryDomain: object.
- Confidence: 0.9 (single clean frontal view, no ambiguity on category).

## Layer 2 — Overall form & silhouette
- Bounding volume: elongated cylinder/wedge along a single vertical axis.
- Primitives: blade = tapered extruded profile (double-edged, symmetric taper to point);
  guard = flattened lofted curve (crescent, downturned tips); grip = cylinder with
  periodic ridges (wrapped-cord texture read); pommel = truncated cone/sphere hybrid.
- Symmetry: bilateral about the vertical axis.
- Aspect: blade length ≈ 2.3x grip+guard+pommel combined length.

## Layer 3 — Macro → meso → micro
- Macro: blade, guard, grip, pommel (4 independent parts, butt-joined along one axis).
- Meso: blade has a central fuller/ridge line (raised spine down the centerline);
  grip has a wrapped-cord ridge pattern (repetition system candidate).
- Micro: pommel has a rim bevel at its base; guard has swept, tapered tips (not blunt).

## Layer 4 — Spatial relationships
- <blade, butts-against, guard> (flush contact at the shoulder/ricasso).
- <guard, wraps-around, grip> (guard sits as a crossbar, grip passes through its center).
- <pommel, caps, grip> (pommel attached at the grip's distal end, flush).
- No mid-air/disconnected parts — single-axis stack, straightforward attachment chain.

## Layer 5 — Materials & surface (PBR)
- Blade: metal, mid-high metalness, low-mid roughness (soft specular falloff visible on
  the flats, sharper highlight along the raised centerline spine) — brushed/satin steel,
  not mirror-polished.
- Guard: metal, similar family to blade but slightly warmer tone — could be same steel
  or a bronze accent; distance-based read is uncertain from this crop alone (flagged
  Layer 8).
- Grip: non-metal, high roughness, likely leather-wrapped wood core — matte, fibrous
  normal detail expected at the wrap ridges.
- Pommel: metal, matches guard family.

## Layer 6 — Color & finish
- Blade: neutral steel-gray with warm highlight bounce from the (added, non-diegetic)
  padding — finish: satin.
- Guard/pommel: warm bronze-toned metal, finish: satin/semi-gloss.
- Grip: mid-brown, finish: matte.
- No gradient stops beyond the expected specular falloff on the blade flats.

## Layer 7 — Identity-defining features
- Raised centerline spine/fuller running the full blade length — primary identity feature.
- Crescent guard with downturned, tapered tips (not a straight crossguard).
- Ridged/wrapped grip texture (repetition system: N evenly-spaced wrap ridges).
- No inscriptions, no visible wear/damage — clean, unweathered blade.

## Layer 8 — Uncertainty & single-image limits
- Single frontal view only: cross-section of the blade (flat vs. diamond-section) is
  **undetermined** — inferred diamond-section from the centerline highlight, not confirmed.
- Back face of guard/pommel: **hidden**, assume rotational symmetry (reasonable for a
  turned/cast pommel and a swept guard, but unconfirmed).
- Exact grip wrap-count: **uncertain**, will estimate from visible ridge spacing.
- **Caveat specific to this test run**: the reference was padded with a flat white
  margin purely to pass the reference-admission gate (see project note below) — the
  original production background (warm vignette) was not neutral enough for this
  skill's foreground/background segmentation, so background-adjacent color evidence in
  this analysis should not be trusted as production PBR ground truth.
