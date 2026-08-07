# Material evidence — decision

Ran `extract_pbr_evidence.py` on `reference_padded.png` (material-id `steel-blade`).

Result: `verdict=pass`, `confidence=0.86` (above the 0.7 target threshold), but the
extracted palette (`#1E1007, #140B05, #2F190A, #492A13, #B79368`) is near-black
dark brown — this is the original warm vignette **background** color, not the
blade's actual steel-gray/warm-gold tone observed directly in image_analysis.md
Layer 6 and in the zone-r0c1/r1c1 crops.

**Root cause:** the reference-admission workaround (white padding, see
image_analysis.md Layer 8 caveat and the project decision to proceed with a
patched reference for this test run) got the image past the admission gate,
but the foreground mask used internally by `extract_pbr_evidence.py` still
mixes background-vignette pixels into the "foreground" region it samples
(`foregroundCoverage: 0.54` — roughly half the crop, which is more area than
the actual blade/guard/grip/pommel silhouette occupies). The script's
confidence score measures internal consistency of its own extraction, not
whether the mask is actually the object — so a high confidence number here is
not trustworthy evidence for this particular image.

**Decision:** reject this extraction. `materials[].albedo/palette` in
`object-sculpt-spec.json` keep the hand-authored values from direct visual
inspection (image_analysis.md Layers 5-6), not the extracted palette.

**Implication beyond this test:** this is the same production risk flagged at
the reference-admission step, now demonstrated concretely — the deterministic
confidence gate can pass with materially wrong data when the source image's
background isn't genuinely neutral. A real production pipeline on this art
style would need either a truly neutral source background (not a padding
patch) or a mandatory human/agent visual sanity-check on the extracted
palette before trusting a "pass" verdict, not the confidence score alone.
