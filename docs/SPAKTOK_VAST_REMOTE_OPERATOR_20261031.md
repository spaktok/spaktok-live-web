# Spaktok Vast.ai remote GPU operator — 2026-10-31

Status: GitHub main contains the outbound GPU operator, Cloudflare D1 tables and
a deployed Cloudflare Worker. **Not yet paired to a GPU; no inference requested.**
Owner Vast instance observed: `58577172`, A100 SXM4 (80 GiB), on a US host.
The screenshot showed `Creating / Not running`; the new quick-tunnel terminal
URL does not certify GPU readiness and must not be reused as an API credential.

## Scope & security
- No incoming SSH, shell interpreter, public terminal, arbitrary command execution.
- Agent calls `https://spaktok-vast-operator.spaktok.workers.dev` outbound only.
- Generates a 48+ character local secret and stores it mode 0600 under
  `/workspace/.spaktok-vast-agent/device.json`. Never send this file or token.
- Cloudflare holds **only its SHA-256**, D1 device and job records, and private
  `spaktok-private-drafts` R2 objects. Approval/revocation via Cloudflare operator.
- Enrollment defaults disabled; a temporary opening is bounded by
  `VAST_ENROLL_EXPIRES_AT`, at most 30min in this initial private test.
- `DEVICE_ID` and `PAIR_CODE` from enrollment may be given to the operator;
  verify both against D1 before approving. Never approve an unknown device.
- Jobs: `gpu_info`, `preflight`, `diagnose_dinov3`, `inspect_glb`,
  `finalize_glb`, `generate_one`. The latter two paid operations
  (DINOv3 diagnosis / image generation) require explicit operator compute flag;
  generation also requires source rights approval.
- An accepted job is leased once; it is **never automatically retried** on crash
  because a duplicate might cause additional paid GPU time.
- R2 output is private and never replaces an existing object. Raw images and GLB
  results are never included in DB job responses or terminal status logs.

## One-time Vast bootstrap (owner-assisted; no CUDA or model inference)

Paste in the fresh Vast Jupyter terminal, after the instance is RUNNING:

```bash
curl -fsSLo /tmp/spaktok-pair.sh https://raw.githubusercontent.com/spaktok/spaktok-live-web/main/scripts/pair-vast-operator.sh && bash /tmp/spaktok-pair.sh
```

This will clone/fast-forward the public GitHub repo on `main`, run
CPU-only tests, enroll a pending device, and launch outbound polling under
`nohup`. The script does NOT download weights, expose ports or run an inference.

Read back only `DEVICE_ID` and `PAIR_CODE`, never the token file or a
Jupyter/Vast URL containing a login token.

## Operator procedure through connected Cloudflare API

1. Query D1 `vast_agent_devices` for the EXACT matching id and pairing code
   and require state `pending` and `expires_at` in the future.
2. Change state to `approved` for that exact device only.
3. Enqueue exactly one `gpu_info` job with a random UUID and `created_at`
   epoch seconds. Observe `vast_agent_jobs` result and device `last_seen`.
4. If the GPU exists, enqueue one non-inference `preflight` job.
5. Do NOT enqueue `diagnose_dinov3` or `generate_one` until
   the exact model dependencies/rights and an owner-approved compute budget
   are verified on this machine.
6. For an approved image job, upload the 8MiB-max source under
   `vast-private/input/<random-id>` in the existing private R2 bucket;
   store its SHA-256 in D1 and specify new
   `vast-private/output/<random-id>.glb` key. Client re-verifies bytes;
   the Worker verifies GLB v2 header, length and SHA-256 before storage.
7. Operator queries the job result through D1 and securely imports the
   private R2 GLB into Studio. It remains a **draft** pending PBR, normals,
   topology, rigging, expression and mobile live-performance QA.

## Model execution caveat

The current `generate_one` action forwards the image to the **local**
`127.0.0.1:8000` Spaktok Forge GPU service using a local
`FORGE_GPU_TOKEN`. This service, the TRELLIS.2 model and compatible CUDA
environment must be explicitly installed and started on the rented machine
before any generation job. Enrollment alone is *not* GPU readiness.

## Cost, privacy and shutdown

Cloudflare Worker queueing does not stop Vast billing. The rental continues
until the owner stops/destroys their Vast instance from their account.
For the US-hosted GPU, **use synthetic or licensed non-personal samples only**
until the owner validates GDPR cross-border data-transfer consent/safeguards
and model licenses. Avoid transferring EU user faces to a US GPU by default.
Destroy or rotate the previously shared Quick Tunnel terminal token; the
operator bridge does not need access to that terminal tunnel.

Never claim this process equals Rodin/TikTok visual quality or live tracking
until generation succeeds on the real GPU and passes blind visual + Android QA.
