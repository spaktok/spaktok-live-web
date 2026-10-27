# SpakTok LUXA — Visual direction for avatar styles
Date: 2026-10-27
Design references: two user-supplied example portraits in conversation, one glossy masculine 3/4 head and one glossy feminine 3/4 head. **The screenshots are references, not imported 3D meshes.** Don't distribute the uploaded pictures in public repo, and never claim the procedural mesh is extracted from them.

## Shared art direction
Premium semi-realistic editorial avatar, high-resolution sculpted face silhouettes, luminous skin with low-noise soft specular highlight, crisp icy/turquoise iris and cornea, combed glossy jet-black wave hair with specular fibers, delicate cinematic rim lighting, clean white/off-white studio background. A softly stylized face, not a toy sphere and not a photographic scan. Explicit creator selection, no assumption that visual styles dictate biological sex.

### Style A — masculine
Sharper angular jaw and chin, balanced cheekbone height, subtle beard/stubble, thick dark sculpted eyebrows, deep blue eyes, higher quiff/side wave with long flowing locks, luminous warm neutral skin and nuanced lips. Head turns and eye blink/mouth open must preserve geometry without collisions.

### Style B — feminine
Soft tapering sculpted jaw, high glossy cheek and lips, enlarged turquoise detailed irises and clean eyeliner, violet-blue iridescent upper eyelid makeup and outer lashes, pearl shimmer highlights, fine brow arches and coiled vintage wave hair, subtle metal ring detail. User-controlled makeup styles and face features in later editor; never a compulsory beautification score or automatic face classification.

## What is actually shipped in this first code stage
- Two locally selectable 3D preview heads in `lib/filter-engine/reality-avatar-luxe.ts`, with distinct jaw geometry, skin material, blue/turquoise eyes, eyeshadow/lashes, wave sculpt hair, lip models, brow rigs, optional stubble/earrings.
- An independent rig Group per eye including iris and pupil (eye scales as a unit while blinking); upper brows move under `browInnerUp`, mouth Group under `jawOpen`/smile. Whole head receives local MediaPipe pose.
- Editor user interface in `components/spaktok/reality-avatar-studio.tsx` has a manual masculine/feminine style switch, plus existing GLB upload. Changing style explicitly disposes the prior preview and preserves camera permission; no cloud upload of face data.
- Real Three.js geometry, NOT the source portrait image rendered flat and NOT high-fidelity photogrammetry. Hair ribs are still low-poly tubes, facial materials uniform, no physically scanned skin or realistic hair dynamics.

## Required for matching supplied photos rather than approximate procedural style
1. A sculpted, UV-unwrapped **separate professionally authored model** for each look and side/back views, created in Blender/ZBrush or a legally vetted character system.
2. PBR skin shaders with roughness/normal/subsurface maps; layered makeup masks; separate sclera/iris/cornea highlights; hair cards/mesh clumps with anisotropic approximation. Avoid bulky mobile geometry and shader overdraw.
3. At least ~52 ARKit-compatible named face blendshapes or a mapped equivalent; symmetry/brow/blink/mouth/cheek/phoneme QA. Neutral bind pose and size calibration.
4. GLB authoring/export with embedded textures and animations, asset validation and creator-specific customization. Mobile LOD/material atlas and memory limits.
5. Browser local camera testing first, then native Android Kotlin/MediaPipe and Agora outbound track only after performance QA.
6. Source-photo permission and reference licensing; user-provided examples must not be silently copied to production public assets.

## Quality gates
- Compare front, 3/4, profile and top views against art reference.
- Measure realtime animation latency, frame pacing, thermals; test eye blink, jaw speech, smile, eyebrow lift and jaw/eyelid occlusion on phone.
- No forced beautification settings or attractiveness scoring. Preview style is separate from the shape of the actual user's tracked face.
- Preserve previous simpler or imported model as fallback; GLB missing expression rig only receives head pose.
