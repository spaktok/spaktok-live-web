# Spaktok Word V1 — unified parallel creative production control plane
Date: 2026-10-27
Primary code: `lib/filter-engine/spaktok-word.ts`
UI: `components/spaktok/spaktok-word-console.tsx`
Routes: `/spaktok-word`, embedded `/reality-studio#spaktok-word`

## Product vision
Spaktok Word is a coordinated, multi-engine production system. One project spans source rights, optional external Rodin image-to-3D, actual GLB geometry, PBR material checks, facial morph rig, head/face anchor, camera preview, recorded video, broadcaster live, and release approval. It is **not** a claim to reproduce the Rodin AI model or run competing photogrammetric GPU inference yet.

## Implemented in V1
- One typed deterministic production dependency graph with 11 independent visible lanes; "ready", "blocked", "waiting", "manual" and "external" are distinct statuses derived from the existing StudioProductionPackage and its verified metrics.
- Actual concurrent local asynchronous file checks: file size/signature/MIME, SHA-256 integrity hash, GLB structural geometry/PBR/rig check OR image resolution decode. Checks are started together; one failure doesn't falsely approve another. Browser `Promise.all` runs independently scheduled asynchronous jobs, not dedicated compute threads nor external GPU jobs.
- The GLB audit result updates the same Production Director metrics, so the existing rights/PBR/morph/placement gates and the new Spaktok Word dashboard stay synchronized in one editor.
- Dedicated `/spaktok-word` route reuses the same Production Director: import image/GLB/OBJ, confirm original/licensed rights, inspect, prepare provider draft and review the complete graph. An inline copy is available directly from Reality Studio for files already selected there.
- Rodin remains a *manual opt-in external source* — no API key in client JavaScript, no automatic photo transfer, no generation charges, no misleading "job finished" state. Users transfer a generated self-contained GLB back to local inspection and optional Avatar Studio handoff. Other providers can later be added behind the same graph contract.
- Public live publishing stays `manual` and final release stays `blocked` until a verified Agora/WebRTC broadcaster, user consent, paid API controls, asset moderation and actual device QA exist.
- Tests for rights gates, invalid rig, 11-lane graph ordering and concurrent asynchronous inspections.

## Architecture
```
             Spaktok Word / Project manifest
                  |
    Source -> Rights Verification
       |                  |
       +------------------+
       |                  |
  Local GLB          Image reference
  structural QA       |           |
       |        Rodin(optional)  Native photo-to-3D(future)
       |                 |       |
       +---------- real GLB <----+
                    |
          +---------+----------+
          |         |          |
      Geometry   PBR/UV    Face Rig/Morph
          +---------+----------+
                    |
            Body / face anchors
                    |
           +--------+----------+
           |        |          |
         Camera    Video   Local Live
                    |
             True broadcaster(future)
                    |
          Final review & release(future)
```
Independent checks can run concurrently; dependent steps cannot start until required outputs pass validation. Real GPU compute scheduling must be implemented via authenticated Cloudflare Workers+Queues/Workflows plus connected GPU provider, private R2 assets and creator-controlled budgets before describing production generation as automated.

## Next production tasks
1. Implement a server-only provider execution adapter (Rodin/other) with explicit creator consent, confidential API credentials, D1 quota and R2 storage, idempotency/retry/cancel, status polling and billing caps.
2. Rig imported facial meshes with real morph target validation, automated retopology plus LOD baking; don't mistake human skeleton rigging for ARKit-52 blendshapes.
3. Fully unify camera/video/live rendering compositors, asset anchoring, avatar animation and skin/eyelid occlusion on native Android.
4. Benchmarks/QA: front+profile 3D geometry, UV seam coverage, per-triangle loss, hair detail, >=30fps phone sustained tracking, accurate audio-video stream parity, rights review and revocable publishing.
5. Production CI and Vercel deploy stability before rollout. No generated 3D from user reference portrait is claimed until a real artifact exists.
