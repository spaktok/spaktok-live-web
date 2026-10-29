# Spaktok Private GPU — First Uploaded Real-Asset QA (29 October 2026)

Scope: READ-ONLY QA of files supplied by the project owner in ChatGPT, not
a public asset release. **No GLB, texture, photograph or private model bytes
were uploaded into this public GitHub repository.**

## Verified uploads (owner's original manifest matched independently)

| Attribute | Original | Mobile candidate |
| --- | ---: | ---: |
| File | `spaktok-trellis1-preview.glb` | `spaktok-trellis1-preview-mobile.glb` |
| Size | 2,499,500 bytes | 2,842,496 bytes |
| SHA-256 | `0856ea40a635e04cd6fff862f9acb9fffa2244a74c06f691169b7e8e102647b1` | `21b916f662457d17a18a2a4d1337a3f34f0ec52ad1a96584d83d986621b924ff` |
| Triangles | 28,379 | 28,379 |
| Vertex positions | unchanged | unchanged |
| UV mapping | unchanged | unchanged |
| Normal attributes | absent | present |
| PBR material | 1 | 1 |
| Embedded PNG | 1 | 1 |
| Embedded PNG resolution | 1024 × 1024 | 1024 × 1024 |
| Animations and skins | 0 / 0 | 0 / 0 |
| Structural mobile budget | false | **true** |

Both uploaded GLB hashes independently match the original owner-provided
`spaktok-first-glb-manifest.json`, and raw vertex positions, triangle
indices, UV coordinates and embedded PNG bytes are unchanged between files.
This definitively proves owner data survived export and the CPU
normal-finalization operation.

## Visual and geometric classification

A local CPU software-rendered four-angle preview depicts a wooden garden
trellis/frame with a ladder-like structure and climbing green vines/foliage.
The original prompt/source photograph was not uploaded, so **input-image
fidelity, backside correctness against the photo, and any Rodin comparison
remain unmeasured**.

Geometry AABB (GLB model units, NOT measured real-world meters):
- min: `[-0.442377, -0.499580, -0.214496]`
- max: `[0.435284, 0.496649, 0.212820]`
- extents: approximately `[0.877660, 0.996229, 0.427317]`

Mesh topology audit with positional coincidence normalized to 1e-6
model units:
- Approximately **26 connected position-space components** after merging
  coincident seam vertices. Without seam-welding, vertex-index topology is
  fragmented by UV duplication, so the raw connected-component count is
  NOT a trustworthy measure of independent physical objects.
- **54 edges with >2 incident faces and 26 boundary edges** after coincident
  vertex welding. These are nonmanifold/open features that need inspection.
- Two triangles have negligible area (<1e-12 model square units).
- The producer already reported a nonmanifold mesh-cut warning.

The model is a plausible PRIVATE `world` decorative/environment prop
candidate, not an approved avatar/live/filter/gift asset. The presence
of a mesh, UVs, normals and PBR does not mean suitable collision geometry,
rigging, face tracking, LODs, native Android FPS or true visual accuracy.

## Implementation action

`services/forge-gpu/trellis1_engine.py` now routes **future PREVIEW**
exports through `glb_mobile_finalize.py` in a temporary directory,
ensuring actual output sent to the private creator browser includes
computed vertex normals, UVs, embedded PBR and mobile structural QA.
This runs AFTER GPU inference and texture baking, requires **no second
GPU inference**, and fails closed if geometry/material QA is unsafe.
Offline master profiles are left unmodified.

Unit tests assert the normal-finalizer is invoked once for preview and
never for offline master. Neither the new code nor the general API endpoint
is production certified yet: **GitHub Actions are not passing/verified and
no signed live browser-to-GPU inference session is proven**.

## Remaining acceptance / privacy

- Owner's actual GLB exports are NOW backed up outside Vast in ChatGPT.
- No authenticated private R2 upload or durable D1 asset record yet.
- Asset should remain private; do not commit it to a public repository or
  publish automatically.
- Run real native Android render/memory/thermal tests and inspect topology,
  collision, LOD, scale, image-source rights and visual likeness manually.
- The GPU instance may be Destroyed by its owner after checking for any
  other data needed on the rental. STOP alone may incur persistent storage fees.
