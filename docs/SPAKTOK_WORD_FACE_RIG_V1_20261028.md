# Spaktok Word • Calibrated Face Rig V1 (2026-10-28)

## Purpose
Spaktok Word now has a local 3D face rig builder inside the **existing** Production Director, not a disconnected demo. It can attach seven named Three.js/glTF morph targets to a manually selected face mesh in an existing GLB. Those targets are understood by `reality-avatar-retarget.ts` and previewed in `/avatar-studio` using local MediaPipe face tracking.

## Workflow
1. Visit `/spaktok-word` and import an original or appropriately licensed **self-contained GLB** (maximum 15MB for interactive rigging). Rodin is one optional upstream 3D geometry source, not a required dependency.
2. Confirm source rights, then open **Face Rig Builder** in the same Production Director.
3. Choose the face-only mesh from the imported hierarchy. An integrated full-body mesh or hair+skin mesh cannot reliably be auto-rigged anatomically; isolate the face first. Mesh must have 120–160,000 vertices, currently be unrigged and have usable nondegenerate X/Y/Z bounds.
4. Choose +Z or -Z orientation. In the camera preview, adjust the normalized eye height, eye spacing, mouth height, front-surface cutoff, and deformation strength manually. Model orientation and face geometry must be confirmed visually.
5. Click **Generate 7 channels**, preview individual eye blinks, jaw opening, corner smiles, eyebrow raise and lip pucker while rotating the head. Sliders do not destructively modify the imported original.
6. Export binary GLB. The exported asset is re-parsed by the existing GLB structural audit before download. If the rigged file is <=15MB, transfer it directly into Avatar Studio to test live expression coefficients.
7. Before public use, audit morphology, UV/PBR, mouth collision, correct eyelid anatomy, mobile FPS/thermals and creator rights. The rigged result is a **draft**, never automatically published or relayed to Agora.

## Explicit technical boundaries
- Seven approximate, localized CPU-generated morph channels; **not** 52 anatomically correct ARKit blendshapes, trained face recognition, facial identity reconstruction, hair simulation or a fully automatic professional auto-rig.
- Default +Z face front and normalized mesh bounding-box calibration; -Z is supported via toggle. Other axis conventions, transforms/bind poses and meshes with pre-existing morphs should be reviewed in specialist authoring tools.
- Geometry is cloned; the original imported BufferGeometry stays unchanged. Only the chosen mesh is modified, preserving the rest of the character. A face mesh combined with hair or clothing may deform badly despite valid geometry.
- A successful structural export does not imply the generated expressions look good. Real QA requires inspecting eyes and lips at multiple head angles and real phone video, including eyelid occlusion.
- Export is local and preserves no mandatory cloud account; original files remain in browser memory until user action.
- Source rights must be reconfirmed in Production Director; provider-generated copies returned to Spaktok Word reset previous source approvals rather than inheriting them.

## Production quality roadmap
1. Landmark-labeled 3D head fitting from multiple views (front, 45°, side); crown/hair separation and neutral bind-pose calibration.
2. GPU or CPU nonrigid deformation on stable face-topology correspondence and artist-supervised retopology; proper 52 facial shapes and phoneme set.
3. Appearance capture: PBR skin subsurface, eye/cornea and hair materials; mobile LOD with 30fps thermal QA.
4. Live camera renderer output plugged into Agora/WebRTC upstream video track, verified synchronization and privacy settings.
5. Operational CI gating: the production build now runs focused Word face rig, GLB import and paid Worker safety regression tests before Next.js compilation.

## Code
- `lib/filter-engine/spaktok-word-face-rig.ts`: pure Three.js morph generation, calibration contract and mesh selection.
- `components/spaktok/spaktok-word-face-rig.tsx`: calibrated preview, export and Avatar Studio handoff.
- `lib/filter-engine/spaktok-word-face-rig.test.ts`: channels, source immutability, mesh limits, opposite Z orientation and guardrails.
