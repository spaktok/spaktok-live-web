# Spaktok Vast.ai A100 operator bridge — 2026-10-31

## Actual status

- Target: owner-rented Vast.ai instance **58577172**, NVIDIA A100 SXM4 80GB (screenshot displayed **Creating / Not running**, so readiness MUST be checked, not assumed).
- The Cloudflare Worker **spaktok-vast-operator** was uploaded and bound to D1 **spaktok-primary** and private R2 **spaktok-private-drafts**. `workers.dev` subdomain enabled.
- D1 migration `migrations/native/0005_vast_remote_control.sql` was applied to the account on 2026-10-31.
- Python outbound agent in `services/forge-gpu/vast_operator_agent.py` is committed on `main`.
- Worker enrollment is an intentionally short, operator-controlled interval, not general registration. The repository's Wrangler template has enrollment DISABLED by default.
- **NOT YET VERIFIED:** agent installed on the new rented instance, real GPU info, model dependencies, terminal access from ChatGPT, Cloudflare Worker-to-agent round trip, queued GLB transfer, CUDA inference, deployment checks.
- The user's temporary browser terminal link is NOT an API/SSH connection for ChatGPT. Never put its token in code, CI, Cloudflare variables, logs, commits or screenshots. Rotate/expire it after initial bootstrap.

## Architecture (no inbound GPU port)

```text
Connected Cloudflare operator API
    | via Cloudflare D1, admin-only
    v
D1 vast_agent_devices / vast_agent_jobs
    ^
    | HTTPS outbound poll every 30 seconds; per-device bearer (SHA256 only in D1)
    |
Vast.ai operator agent ---> local 127.0.0.1:8000 TRELLIS service
    |
    | HTTPS authenticated input/output (SHA256 checked; GLB restricted to 35 MiB)
    v
Cloudflare Worker ---> private R2 prefix vast-private/{input,output}/
```

All job creation and pair approvals are currently performed by the connected account operator via Cloudflare D1 API, not the public Worker. The Worker exposes no shell command, container provisioning, instance management, general upload link, or public asset URLs.

## One-time terminal bootstrap (the owner)

Run on the **rented Vast instance** after its status becomes RUNNING. Does not execute or download AI model weights, perform inference, or incur any additional GPU API charge (Vast rental accrues while running):

```bash
cd /workspace && (test -d spaktok-live-web/.git || git clone --depth 1 https://github.com/spaktok/spaktok-live-web.git) && git -C spaktok-live-web fetch origin main && git -C spaktok-live-web switch main && git -C spaktok-live-web pull --ff-only && python3 spaktok-live-web/services/forge-gpu/vast_operator_agent.py enroll --worker https://spaktok-vast-operator.spaktok.workers.dev
```

The script prints **DEVICE_ID** and **PAIR_CODE**, but never prints its secret bearer token. Secret is saved only as `/workspace/.spaktok-vast-agent/device.json` (mode 0600). It automatically detaches a polling process into `/workspace/.spaktok-vast-agent/poll.log` and returns to the terminal. Do not send `device.json` to anyone.

If the enrollment window has expired, ask the operator to reopen a bounded window, rather than putting a token in the chat.

## Operator pairing (connected Cloudflare account)

1. Receive DEVICE_ID and PAIR_CODE (not the bearer).
2. Using authenticated Cloudflare D1 API, check that exactly one pending record has these matching values and `expires_at > unixepoch()`. Do not approve merely by device ID.
3. Approve **only** that exact device by updating `state='approved'`.
4. Queue an initial read-only `gpu_info` job and poll its status.

Examples of *parameterized* D1 SQL used by an authorized operator:

```sql
SELECT device_id,state,created_at,expires_at
FROM vast_agent_devices
WHERE device_id=? AND pair_code=? AND state='pending' AND expires_at>unixepoch();

UPDATE vast_agent_devices SET state='approved'
WHERE device_id=? AND pair_code=? AND state='pending' AND expires_at>unixepoch();

INSERT INTO vast_agent_jobs
 (id,device_id,action,created_at)
 VALUES (?,?, 'gpu_info', unixepoch());

SELECT id,action,state,result_json,error_code,output_key,output_sha256,output_bytes
FROM vast_agent_jobs WHERE device_id=? ORDER BY created_at DESC LIMIT 20;
```

For paid or private-data operations: do not enqueue `generate_one` without the precise user-authorized source image, `approved_compute=1`, `rights_confirmed=1`, an R2 input key in `vast-private/input/`, the exact SHA256, and a unique output key in `vast-private/output/`. Never reuse an existing output key, and never auto-retry uncertain GPU work. `diagnose_dinov3` also requires `approved_compute=1`.

### Supported actions

| Action | What it really does | GPU cost beyond rental? |
| --- | --- | --- |
| `gpu_info` | queries `nvidia-smi`, checks TRELLIS checkout/env and localhost service | no inference |
| `preflight` | checks existing CUDA + PyTorch compatibility | CUDA smoke test only |
| `diagnose_dinov3` | loads weights and checks segmentation + encoder | yes, must be approved |
| `inspect_glb` | reads private R2 GLB and reports structure, UV, normals, PBR | no inference |
| `finalize_glb` | computes missing normals into a separate private file | CPU processing |
| `generate_one` | single owner-approved image via existing localhost GPU server | yes, must be approved |

## Boundaries / safety

- No public SSH, no arbitrary shell injection, no user-controlled code, no automatic GPU rental, no open batch inference, no autopublish.
- Worker responds only to a device bearer token matched by SHA256 against D1. Device enrollment is temporary and requires separate operator verification.
- Client-generated image content hash is independently verified on the GPU before processing.
- Final GLB's SHA256 is validated on Cloudflare; duplicate private object keys are rejected.
- Leased jobs are intentionally NOT automatically retried after disconnect. Resolve uncertain executions by manual audit.
- The installed Agent is a **restricted job runner**, not a generic remote terminal. Model installation and service startup on a brand-new GPU image can still require an operator-approved setup step after introspection; never claim this is turnkey before CUDA, dependencies, model-license access and the real GPU are proven.
- 35 MiB output limit covers early private GLB tests. Ultra-high-detail assets need a separately designed chunked/R2 presigned transfer and mobile LOD conversion.
- A mesh that merely has PBR material fields is NOT photorealistic; face rig, FACS/blendshapes, hair physics, motion/occlusion, mobile 30/60 FPS and Live capture-stream transport are separate gates.
- The existing `SpaktokStudioFanout` produces private candidate packages for avatar, live, filter, gift and world; it does NOT automatically publish or guarantee working AR attachment.

## Acceptance ladder

1. Confirm the owner's A100 instance is RUNNING, claim/pair the agent, receive a real `gpu_info` result.
2. Review environment and run preflight; do not trigger full inference to diagnose an absent checkout.
3. Verify GPU model loader + DINO conditioning only after explicit compute approval.
4. Send one authorized image via private R2, generate one GLB, upload via the agent, compare SHA256 and inspect GLB structure.
5. Add PBR texture / topology / rigging / LOD/animation optimization and visual QA on actual Android device.
6. Test Live-specific tracking latency, motion stability, segmentation and rendered-output integration before a public release.

**Operator references:** `wrangler.vast-operator.toml`, `services/forge-gpu/test_vast_operator_agent.py`, `docs/SPAKTOK_VAST_A100_TRELLIS2_E2E_20261030.md`.
