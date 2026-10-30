# Spaktok first generated GPU asset — owner-controlled private handoff

## Facts observed
- Owner's Vast instance `58332583` successfully executed `SPAKTOK_LOCAL_E2E_SUCCESS`.
- Source was official TRELLIS.2 `T.png`; GLB file is
  `/workspace/spaktok-first.glb` **on Vast's filesystem, not ChatGPT/GitHub**.
- Exact output: 5,343,540 bytes; 1 mesh; 1 material; 2 texture references;
  SHA256 `33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa`.
- User authorized moving this private draft into Spaktok AI / its Studio sections.
- Cloudflare account `Spaktok` has an existing private bucket
  `spaktok-private-drafts` but **NO matching object uploaded as of this PR**.
- Github connection can edit source, Cloudflare connector can inspect account,
  but no currently authorized connector can read arbitrary Vast filesystem paths.
  Do not claim file was uploaded by GitHub edits.

## Private path A — direct GPU → Spaktok Cloudflare R2 upload (preferred to phone)

On the existing Vast instance, use the reviewed uploader:
`services/forge-gpu/push_first_glb_to_spaktok_r2.py`.

1. Operator generates a temporary **standard Cloudflare REST API Bearer token**
   in the dashboard under Profile > API Tokens > Create Custom Token,
   with Account > Workers R2 Storage > Edit on Spaktok account and short expiry.
   This is **NOT** an R2 S3 Access Key/Secret pair. Its permission scope
   is broad across this account: handle carefully and revoke promptly.
2. In Vast Jupyter Terminal:
   ```bash
   conda activate /workspace/trellis2-env
   cd /workspace/spaktok-live-web
   git pull --ff-only
   python services/forge-gpu/push_first_glb_to_spaktok_r2.py --upload-private
   ```
3. The script first validates SHA-256, GLB2 header, and exact byte count,
   then requires operator to type `UPLOAD` and paste the temporary Bearer
   token through `getpass` (not echoed or saved).
4. On success the script PUTs exactly one immutable referenced GLB and one
   JSON *private draft* manifest. Each of five Studio department targets
   references the same object; no duplicated generation or public publication.
5. After success, operator revokes token and shuts down Vast instance if
   no longer required. Independent Cloudflare connector verification of exact
   R2 objects is still required.
6. R2 upload **does not automatically make GLB available to the web app**;
   an authenticated R2 read path and production deployment remain TODO.
   Avoid using the restricted FACE_DRAFTS worker: it accepts only canonical
   face geometry, not arbitrary GLB meshes.

## Private path B — immediate same-browser Studio import (no Cloudflare tokens)

1. Save the GLB to a phone/computer using the JupyterLab file browser.
2. Open the deployed app's `/spaktok-word#ai-director` **after the PR is merged/deployed**.
3. Select `spaktok-first.glb` in the file picker and confirm licensing/rights.
4. Click `استيراد مجسم Vast.ai وتجهيزه للأقسام الخمسة دون GPU`.
   New UI verifies *exact SHA256 + bytes* against the successful pilot,
   checks its GLB mobile preview structure, stores one **local** private
   GLB+manifest in IndexedDB, and creates five private destination drafts.
5. Each section can preview the asset with its own QA blockers; no Agora
   live broadcast, rigging, virtual gifting, app-store publication or public
   user sharing is implied.

## Current release gates

- GitHub draft PR #15 is **not merged**; CI checks previously failed.
- R2 content transfer must be observed, not guessed.
- Server-side secure per-owner R2 retrieval, availability in live deployed
  Spaktok web + native Android app, account/age moderation, licensing,
  rigging, AR camera calibration, gift animation, world collision, mobile
  GPU performance remain unimplemented or unverified.
- In the interim the **local same-browser import is the working target** after
  reviewed code is deployed, not an assertion of cloud fanout readiness.
