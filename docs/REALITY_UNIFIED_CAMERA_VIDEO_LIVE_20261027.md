# SpakTok Reality Unified — Camera, Video and Live Preview
Date: 2026-10-27

## Unified scope
One versioned registry supplies all face accessories, 3D makeup, masks, color looks, post-FX, background effects and beauty options across camera, recorded-video and local live-preview authoring. A shared definition DOES NOT mean a runtime renders every effect identically today.

## Implemented
- Shared appearance profile: Original (identity unchanged), Natural Light, Studio Glow. Reuses actual camera color/beauty state. Face morph is opt-in, bounded, and cannot silently displace a selected GLB effect.
- Camera live-preview starts with an optional lighting look. This is still a LOCAL preview, NOT a broadcast to users.
- Recorded Video Studio supports shared camera color preset identifiers and performs a documented approximation through a Three.js GPU shader, affecting on-screen preview and Canvas capture. Exact shader parity needs further QA.
- Recorded-video 3D layers can attach to forehead, eyes, nose bridge/tip, lip and chin, or stay screen-fixed. Video MediaPipe detection runs locally and stale attachments are hidden; it is still a 2D position attachment, NOT complete head 6DoF or hair/hand occlusion.
- A pure adaptive triangle LOD BUDGET planner degrades with frame rate and tracking loss. It allocates no actual geometry and must not be marketed as rendering a million triangles.
- Contract tests cover mode registry, no unconsented facial change, profile bounds, invalid tracking and optional desktop-only extreme LOD target.

## Why not force a million triangles in each live
The existing MediaPipe model returns an estimated 478 landmarks and 52 expression coefficients when enabled. Interpolating a million triangles does not measure a million original points or reveal hidden pores, detailed anatomy or distorted optics. Rendering cost multiplies with stream participants. Future GPU adaptive tessellation must be benchmarked on actual hardware and should use source-detail signals, not just synthetic subdivisions.

Typical theoretical mesh targets: <=6K low device, <=24K mid, <=96K high, <=240K desktop. The >900K target is available only as a diagnostic plan on an explicitly opted-in fast desktop. Nothing currently creates or draws that geometry.

## Ethical quality constraints
There is no single objective global face beauty standard; avoid age/ethnicity attractiveness scoring, enforced face proportion targets and automatic face identity changes. Light restoration without geometry edits can be an authoring default; anatomy changes, including widening eyes or reshaping jaw or nose, must be off by default and creator-controlled. All tracking landmarks stay on-device.

## Must complete before release
1. Real broadcasting: camera canvas and microphone/speakers -> WebRTC/Agora uplink and monitoring; existing Live UI is local preview/mock.
2. One live face mesh driving multiple overlays, authored GLBs, makeup and video FX together; current face effect state has a single face ID.
3. Same color transform and composition in live/camera/video capture; 6DoF on recorded video; full hand/hair/face occlusion and segmented backgrounds.
4. Correct lens calibration, temporal stabilization and perceptual image restoration; avoid implying arbitrary AI detail is real.
5. Actual low/mid/high Android performance, iOS hardware, orientation, thermal, memory, FPS and preview/export parity testing.
6. Native Kotlin/MediaPipe integration and production streaming; face data privacy and rights.
