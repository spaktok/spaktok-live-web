# Vast.ai-only GPU bridge for Spaktok Forge / TRELLIS.2

Status: **code-only experimental integration**. Created 2026-10-29.
There is no proof in this repository that the existing Vast.ai instance has
started TRELLIS.2, that inference works, that a TLS hostname is configured,
or that production deployment is enabled. No new GPU rental requested.

## Design

- Single existing operator-owned Vast.ai GPU (not RunPod or another provider).
- No general-purpose shell/terminal API exposed to the AI, browser, or network.
- Operator prepares TRELLIS.2 **once** via Vast SSH/Terminal. The web app
  only creates bounded signed image-to-3D jobs.
- GPU starts an allowlisted Python FastAPI service with TRELLIS.2 loaded.
- A Cloudflare Tunnel publishes a dedicated operator-controlled HTTPS
  hostname, mapping to http://127.0.0.1:8000 on the SAME Vast instance.
  The TLS host must be pinned independently from the URL in Vercel.
- Existing Spaktok GPU ticket route authenticates owner, checks consent,
  enforces one-job/day owner and global D1 quota, checks exact engine in
  /health and issues HMAC 120-second one-use image digest ticket.
- Browser uploads directly to the GPU without Vercel's 4.5 MB body cap.
- GPU checks origin, one-use nonce, MIME, size, SHA256 and token before
  invoking TRELLIS.2. 35 MiB GLB cap and browser GLB structural audit remain.
- Returned GLB stays a private preview. No automatic public asset, rig,
  filter publication, paid gifts, world or live avatar is asserted.

## Operator preflight on the EXISTING Vast instance

Check available GPU **before installing model dependencies**:

```bash
nvidia-smi
python -c "import torch; print(torch.__version__, torch.version.cuda)"
```

Official TRELLIS.2 requires Linux and a CUDA GPU with at least 24 GB VRAM;
validated by its authors on A100/H100, with CUDA Toolkit 12.4 recommended.
Other GPU architectures and toolkit combinations require independent tests.
Reference: https://github.com/microsoft/TRELLIS.2

Once the owner confirms memory/disk, choose an appropriate CUDA environment.
For an Ampere/Hopper machine with supported CUDA 12.4, the **official**
upstream installation path is:

```bash
git clone -b main https://github.com/microsoft/TRELLIS.2.git --recursive
cd TRELLIS.2
. ./setup.sh --new-env --basic --flash-attn --nvdiffrast --nvdiffrec --cumesh --o-voxel --flexgemm
```

This can consume significant running GPU and disk time. On Blackwell GPUs
do not blindly install default torch 2.6.0/cu124; choose a CUDA/PyTorch
build supporting that architecture, and test custom extensions first.

Install API prerequisites **inside the same selected TRELLIS.2 environment**:
```bash
python -m pip install 'fastapi>=0.115,<1' 'uvicorn[standard]>=0.30,<1' 'python-multipart>=0.0.9,<1'
```

After copying/cloning the spaktok-live-web branch into the Vast environment,
set operator-only secrets via its secret manager/environment (NEVER paste
them in chat, GitHub, public logs or screenshots):

```text
TRELLIS2_REPO_DIR=/path/to/TRELLIS.2
FORGE_GPU_TOKEN=[at least 32 random characters, server-side secret]
FORGE_GPU_ALLOWED_ORIGIN=https://<exact-public-spaktok-studio-origin>
SPAKTOK_FORGE_OPERATOR_APPROVED=yes
```

From the root of the Spaktok checkout:
```bash
bash services/forge-gpu/start-vast-trellis2.sh
```

The start script does **not** provision GPU, expose arbitrary terminal
commands, or create a network tunnel. It binds **localhost** only.
It runs CUDA preflight, CPU-unit checks, and then loads TRELLIS.2 at
server startup, potentially downloading model weights (billable instance
time). Startup can fail on missing dependencies, insufficient memory,
or licensing issues; do not keep paying for a failed idle instance.

## Stable HTTPS Cloudflare Tunnel

In your Cloudflare account: create a named Tunnel, and publish an
operator-owned hostname such as `gpu.<YOUR_DOMAIN>` to
`http://127.0.0.1:8000` on the **same Vast instance**. Install/run
`cloudflared` with the tunnel token there (a secret); do not open an
unauthenticated raw public IP:port API and do not use an unstable
`trycloudflare.com` quick tunnel for this integration.

The service uses HMAC-signed upload tickets and origin-bound CORS.
That is not equivalent to network isolation. Before making this public,
add Cloudflare WAF/rate limiting, durable nonce ledger, provenance and
production observability, plus review TLS, GPU host data residency and
privacy disclosures.

Once the TLS hostname and model endpoint pass an OWNER-authorized
private smoke test, configure only server-side Vercel values:

```text
SPAKTOK_FORGE_GPU_ENABLED=false
SPAKTOK_FORGE_GPU_DIRECT_ENABLED=false
SPAKTOK_FORGE_GPU_PROVIDER=vast
SPAKTOK_FORGE_GPU_ENGINE=trellis2
SPAKTOK_FORGE_GPU_BROWSER_ORIGIN=https://<exact-public-spaktok-studio-origin>
SPAKTOK_FORGE_GPU_HOST=gpu.<YOUR_DOMAIN>
SPAKTOK_FORGE_GPU_VAST_HOSTNAME=gpu.<YOUR_DOMAIN>
SPAKTOK_FORGE_GPU_URL=https://gpu.<YOUR_DOMAIN>/v1/generate
SPAKTOK_FORGE_GPU_TOKEN=<same operator-only GPU secret>
SPAKTOK_FORGE_GPU_DAILY_LIMIT=1
```

The existing ticket checker accepts Vast only with:
- exact independently pinned Vast hostname (not RunPod), HTTPS, no custom
  port, no credentials, fragment, URL query, IP address or loopback,
- path exactly `/v1/generate`, no transient `trycloudflare.com` hostname,
- exact origin, configured >=32-character shared HMAC secret and valid D1
  quota, GET /health returning `{"ready":true,"engine":"trellis2"}`.

Both enabled flags are OFF by default; leave OFF until the operator can
validate a paid, private single-image end-to-end test. Do not make these
environment variables `NEXT_PUBLIC_` or package them with the native app.

## Test without renting more GPU

```bash
cd services/forge-gpu
python -m unittest test_trellis2_engine test_gpu_preflight test_gpu_ticket -v
# On a development machine:
npm run test:forge:providers
```

GPU-only readiness check from the terminal:
```bash
curl -fsS http://127.0.0.1:8000/health
```
When the tunnel exists:
```bash
curl -fsS https://gpu.<YOUR_DOMAIN>/health
```

These health checks are not proof of actual GLB, geometry quality, output
size, UV/PBR correctness, Android frame rate or readiness for live. Test
a creator-owned image and verify the private GLB via Spaktok Studio
inspection before broad release. TRELLIS.2 has MIT licensing with some
separately licensed dependencies that need review.

## Billing constraint

Existing Vast.ai rental can bill during setup, download, idle and failed
inference. Spaktok app's D1 quota **does not** terminate or cap Vast rental.
Stop or destroy the instance/volume from the Vast.ai account as intended;
verify charges and provider behavior directly. This branch creates and
stops **zero** paid resources.

## Next production phase (not yet implemented)

Migrate the single-worker in-memory nonce ledger to a durable claim
coordinator, GPU-side job state, private R2 storage, idempotent control
plane, structured error reports, cancel-safe semantics, vendor-side
spend guards and native Android GLB asset manifest. Only then allow a
higher job quota or automatic scaling.
