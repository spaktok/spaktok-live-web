# Spaktok Forge: large 360° GLB browser-direct GPU bridge

## Why this change is required

Vercel's Node Functions have a **4.5 MB maximum request/response
payload**. Sending a 6MB source photo or returning a 20MB GLB through
`/api/spaktok-forge/gpu` would fail even after paid GPU inference.
That legacy `POST` is now **HTTP 410 disabled** to prevent surprise costs.

New system: **Vercel authenticates and authorizes a small ticket, then
the browser sends the image directly to the operator GPU and receives
up to 35MB GLB directly**. The GPU backend is private in the
authorization sense (HMAC grant, single-use, origin-bound), although
its HTTPS proxy hostname is internet-accessible.

## Exact flow

1. Studio image (PNG/JPEG/WebP, <= 8 MiB) stays in browser until consent.
2. Creator confirms source rights, privacy transfer and GPU cost separately.
3. Browser computes SHA-256 locally using WebCrypto.
4. POST a small JSON metadata request to
   `/api/spaktok-forge/gpu-ticket` (same-origin, authenticated).
5. Vercel checks operator feature flags, exact RunPod host, GPU
   `GET /health`, identity and daily budget limit in D1.
6. After an atomic D1 job reservation, it signs a 120-second HMAC
   one-use ticket: SHA-256, byte size, MIME, origin, nonce, expiry.
7. Browser POSTs *actual* image bytes directly to
   `https://<POD-ID>-8000.proxy.runpod.net/v1/generate`
   using `Authorization: Bearer st1.<claims>.<hmac>`.
8. GPU verifies signature, expiry, `Origin`, no replay, exact
   actual file SHA-256/size/MIME and request length before inference.
9. GPU returns a GLB (max 35MiB) directly to browser, bypassing Vercel.
   Browser bounds streamed bytes and executes a GLB structural audit.
10. Output is **private creator draft**, not an automatic public
    native app asset, Avatar Rig, live broadcast, paid gift or world scene.

This is the initial **single-worker one-hour trial** model.
Its replay ledger is *in memory* and protects only one running process.
If RunPod restarts within a ticket's short validity, the replay state
may reset; for commercial or multi-worker operation, upgrade to
Cloudflare Durable Objects / durable nonce claims verified by the GPU.

## Operator environment (disabled unless explicitly approved)

**On GPU Pod (operator-only secrets):**

```text
FORGE_GPU_TOKEN=<strong random 32+ character secret>
FORGE_GPU_ALLOWED_ORIGIN=https://v0-spaktok-elite-app.vercel.app
HF_TOKEN=<gated Stability model access if needed>
```

Run exactly one `uvicorn` worker. The Python API exposes
`GET /health` and `POST /v1/generate` on port 8000 through a
TLS HTTPS proxy. Accept the model license before requesting weights.

**On Vercel (server-side only, never NEXT_PUBLIC):**

```text
SPAKTOK_FORGE_GPU_ENABLED=true
SPAKTOK_FORGE_GPU_DIRECT_ENABLED=true
SPAKTOK_FORGE_GPU_BROWSER_ORIGIN=https://v0-spaktok-elite-app.vercel.app
SPAKTOK_FORGE_GPU_HOST=<POD-ID>-8000.proxy.runpod.net
SPAKTOK_FORGE_GPU_URL=https://<POD-ID>-8000.proxy.runpod.net/v1/generate
SPAKTOK_FORGE_GPU_TOKEN=<same operator secret>
SPAKTOK_FORGE_GPU_DAILY_LIMIT=1
```

The flags default OFF. This new flow refuses non-RunPod domains,
unencrypted hosts, an origin mismatch, an unhealthy GPU, missing rate
limit / D1 or invalid headers. A GPU may still incur idle rental charges
even with zero application requests; **Important 2026-10-29 correction:** RunPod's old
`--terminate-after` / `--stop-after` flags were never enforced and
were removed in runpodctl v2.12.0. The operator MUST explicitly
**Terminate** the Pod and confirm deletion (or use a separately
verified external deletion scheduler). A one-hour budget is NOT
guaranteed by CLI flags or the GPU D1 quota.
https://github.com/runpod/runpodctl/releases/tag/v2.12.0

**Do not flip any GPU flags to true** until the experimental
Blackwell image has been built, licensed and smoked on hardware.
Neither a working 360° GPU backend nor a completed 35MB RunPod HTTPS
proxy end-to-end transfer has been demonstrated as of this commit.

## Tests

Python CPU-only checks (safe without CUDA and without remote compute):

```bash
cd services/forge-gpu
python -m unittest test_gpu_preflight test_gpu_ticket -v
```

These verify rejection of legacy PyTorch/cu121 on Blackwell, invalid
GPU architecture, expired/replayed-prone ticket claims, bad signature,
wrong origin and excess image size. **Replay admission at the ASGI
middleware boundary and 35MB browser transfer still need real
integration testing**.

Hardware smoke test, only on a paid provider with owner consent:
- Run Python `gpu_preflight.py` and confirm `ok:true`.
- Start SF3D service; `GET /health` must return `ready:true`.
- Try CORS preflight from the exact Spaktok origin.
- Login to Spaktok Word; approve rights, transfer and GPU separately.
- Send an operator-owned image; get nonempty GLB with real textured
  geometry and QA.
- Confirm a second attempt on the same signed nonce is rejected.
- Check actual provider bill before and after `Terminate`.
- Compare output to Rodin on matching authorized source images.
- Disable feature flags immediately after the one-hour trial.

## Production blockers

- Stable Fast 3D CUDA extension compatibility with RTX PRO 6000
  Blackwell and PyTorch 2.8 + cu128 is **not validated**.
- HTTP proxy may have additional request/response limits; live
  multipart and 35MB GLB e2e tests are mandatory.
- In-memory nonce replay ledger is not sufficient for multi-instance
  production; a durable coordinator is required.
- Tokens are browser grants valid up to 120 seconds; guard against
  screenshots/console logs and never cache/retain them.
- Private asset library, per-user Cloudflare R2 storage, native
  Android download manifests, live Agora animation, face rigging,
  World placement/collision, gift store/payment and publication QA
  remain separate work.
- Current generation model does not guarantee Rodin-level fidelity.

## Official evidence

- Vercel payload limits:
  https://vercel.com/docs/functions/limitations
- RunPod Pod lifecycle and `--terminate-after 1h`:
  https://docs.runpod.io/runpodctl/reference/runpodctl-remove-pods
- NVIDIA Blackwell CUDA 12.0 compute capability:
  https://developer.nvidia.com/cuda/gpus
