# DINOv3 ↔ Spaktok Studio ↔ Vast.ai — private transfer design (2026-10-31)

## Verified facts (not projections)

- User's connected Hugging Face account **Yanal1233** can read the gated model
  `facebook/dinov3-vitl16-pretrain-lvd1689m` (confirmed through the connector).
- Its `model.safetensors` is **1,212,559,808 bytes**. The other allowlisted files are
  `config.json` (745), `preprocessor_config.json` (585), and `LICENSE.md` (7503).
- The user's new Vast.ai instance **58584822** has **one A100 80GB**, 125 GiB
  provisioned disk, and is paired to Cloudflare with **device ID
  4aadaa0ded478f75c363e3aa58f0f28e**.
- The existing restricted operator can run GPU preflight and approved fixed setup
  tasks through D1; the TRELLIS.2 source has been fetched and the setup script
  exited zero. A model-load/generation smoke test has **not** succeeded.
- Original poller on Vast.ai has not automatically upgraded after repository
  changes; new code committed on GitHub is not evidence that it is deployed on GPU.
- There is **no HF secret** on `spaktok-dinov3-bridge`. Thus **DINOv3 weights
  have NOT been transferred** by this bridge.

## Implemented (GitHub main + deployed Cloudflare)

- `cloudflare/workers/spaktok-dinov3-bridge.mjs`: Cloudflare Worker
  `https://spaktok-dinov3-bridge.spaktok.workers.dev`.
- `migrations/native/0007_vast_dinov3_grants.sql`: only operator-authorized,
  expiring per-device grant for this one gated model.
- `services/forge-gpu/vast_dinov3_bridge_client.py`: a private, bounded
  downloader, using the existing device secret from
  `/workspace/.spaktok-vast-agent/device.json` but NOT the HF token.
- `services/forge-gpu/test_vast_dinov3_bridge_client.py` plus offline CI checks.
- Cloudflare Worker health was verified through Cloudflare Browser Rendering.
  An unauthenticated request cannot retrieve model weights.

## Activation requirements (not completed)

1. In Hugging Face account Yanal1233, create a **fine-grained read-only user
   token** authorized for the gated model. Confirm that its use is consistent
   with the Meta DINOv3 license. The OAuth credential granted to ChatGPT is
   NOT exported and MUST NOT be used as a server secret.
2. In Cloudflare Dashboard > Compute > Workers & Pages >
   `spaktok-dinov3-bridge` > Settings > Variables and Secrets,
   create an **encrypted secret** named `HF_DINOV3_READ_TOKEN`. Do not paste
   its value into chat, issues, GitHub, or a terminal screenshot.
3. Grant access only to the paired GPU with a short TTL, e.g. a parameterized
   Cloudflare D1 query:
   ```sql
   INSERT INTO vast_model_grants(device_id,model_id,expires_at,enabled,created_at)
   VALUES(?, 'facebook/dinov3-vitl16-pretrain-lvd1689m',
          unixepoch()+7200, 1, unixepoch())
   ON CONFLICT(device_id,model_id)
   DO UPDATE SET expires_at=excluded.expires_at,enabled=1;
   ```
   Never use broad or indefinite model grants.
4. **Run the updated client on the Vast GPU** using a properly connected remote
   execution path (e.g., ChatGPT Work's Cloud Browser with the user's
   authorization). This conversation has no direct terminal execution tool.
   An operator agent `upgrade` command exists in code, but does not remotely
   self-run: pulling GitHub updates and restarting the poller are separate.
5. Once permitted, run `vast_dinov3_bridge_client.py download`, then load
   model locally with `DINOv3ViTModel.from_pretrained(local_dir)`. The
   standard TRELLIS.2 pipeline will need to reference that local folder or
   the official Hugging Face cache to avoid gated downloads during inference.
6. Independently verify the remaining TRELLIS.2 4B weights, its CUDA extensions,
   model load, segmentation, GLB rendering, R2 upload, Android LOD, facial
   rigging and Live/Story tracking. Only then claim that Spaktok Studio is ready.

## Security boundaries

- No arbitrary URLs, repositories or path parameters.
- Only four allowlisted files for the exact DINOv3 model.
- Per-request maximum **8 MiB** with strict byte ranges and Content-Range
  verification, streamed over HTTPS.
- Device uses a separate signed/hashed pairing credential to reach Cloudflare;
  the Hugging Face token is server-side and never forwarded to the device.
- Model files and license remain private; no public redistribution.
- Worker only grants model access while `vast_model_grants` is enabled and not
  expired. Default is denied. Browser-facing health endpoint reveals no secret.
- No user-generated photos should be sent to a US GPU until GDPR/transfer,
  consent, licensing and processing obligations are separately reviewed.
- Download checkpoint size/metadata alone is not sufficient to establish a
  validated SHA-256 hash against the official HF LFS repository. The client
  records its received SHA for later audit, but it is **not a signed upstream
  checksum**; production QA should verify the expected HF commit/sha256.

**Cost:** No A100 rental changes, inference, or checkpoint transfer were
started by creating these files or deploying the Cloudflare Worker. Existing
Vast.ai instance charges continue independently while it is rented.
