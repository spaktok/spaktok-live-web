# Rodin as an optional SpakTok Studio 3D production provider
Date: 2026-10-27. Official sources: https://docs.hyper3d.ai/en and https://hyper3d.ai/features/api

## What's implemented
- Rodin Gen-2.5 quality, Quad/Raw topology, material and output settings are supported in the production cockpit as a downloadable rights-gated **JSON DRAFT**.
- The editor links to the official Rodin workspace. A user must upload any references deliberately in the vendor's website.
- After export, user imports the generated **GLB** to existing SpakTok Reality Studio: geometry and PBR audit -> license checks -> rig & expressions audit -> local handoff to Avatar Studio -> camera/live/video device QA.
- The pure TypeScript module validates submission/status payloads, avoiding the common mistake of treating HTTP 201 with an `error` field as accepted.
- Absolutely no API calls, personal image uploads, generation jobs, bills, secrets, Rodin account access or credits are initiated automatically.

## Vendor API v2 facts / cost and privacy
- Generation: POST /rodin with Bearer auth, multipart repeated images 1–5; a tier explicitly set to Gen-2.5; GLB output. Good candidate for PBR and organic hair shapes, but the output may still be uncanny or not consistent at side/back angles.
- Optional Rigging: POST /rigging creates a skeleton for a confirmed Rodin asset or another supplied model. This **does not promise ARKit 52 face blendshape targets**. Facial rig must be separately tested/retopologized; skeletal rigging and facial morph targets are different representations.
- Asynchronous: generation returns top-level `uuid` and `jobs.subscription_key`. Poll /status with subscription key; call /download with the top-level uuid after *all* jobs are Done. Honor 429 Retry-After and failed jobs.
- Gen-2.5 base from 0.5 credits, higher tiers and 12K textures cost extra. Prices and license terms are provider-controlled; default provider Business tier is listed as supporting API, with monthly pricing subject to change. An estimated base cost is not spending approval.
- Vendor API-specific retention statement says active payload/output retained 7 days and not used for model training; actual deletion/privacy and source-rights must be checked against current terms and user's location.
- **The Rodin workspace URL is not a connected user's account credential.** User must control their own account and should not paste API keys into any SpakTok client-side field or chat.

## Server integration gates before allowing API POST
1. Server-only `RODIN_API_KEY` or Cloudflare Secrets Store, never exposed in JS bundle.
2. Authenticate creator, check project ownership and source rights; collect explicit user approval for external transfer, spending and current privacy/terms, including commercial rights.
3. Idempotency, credit quota and balance check; D1 job ownership/status/task identifiers; cancellation and anti-abuse limits.
4. Private source upload to R2 with direct object ownership, no public bucket exposure; user-controlled deletion and retention.
5. Cloudflare Workflows or a queue for task submission, poll (>=5s first interval, increasing to <=30s) and download. Retry proper 429/5xx with deadlines.
6. Pull provider GLB into private R2 and validate GLB binary, actual normals, UV, PBR maps, morph targets and triangle/draw call counts. Optimize mobile copies; keep original only in private drafts.
7. Explicit final publication review, verified licensing, scanning, versioned CDN and revocation.

## High-quality live avatar after Rodin
Rodin makes candidate 3D **geometry**, not a finished live facial clone. For the user's high-gloss LUXA portraits, maintain two versions: artist/AI high-poly master and optimized mobile LOD. Add UV/texture bake, skeleton plus facial ARKit-compatible morph targets (neutral/blinks/jaw/smile/visemes), blendshape QA, scalp/hair occlusion, lighting calibration, then camera and recorded-video preview. Agora/WebRTC viewer broadcast remains a separate unfinished milestone.
