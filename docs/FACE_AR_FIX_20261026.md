# Face AR repairs — October 26, 2026
## Root issue
The prior app classified the face model as "tracking" immediately after its
files loaded, even when not a single face was detected. Runtime errors from
detectForVideo were silently discarded. This made user-selected AR masks
appear to do nothing while color filters still worked.

## Applied
- Added Cloudflare public edge cache `spaktok-face-assets.spaktok.workers.dev`
  for the exact MediaPipe 1.0.1 model and WASM versions. Assets are public,
  non-biometric binaries; no face images or video are sent to that endpoint.
- Model loaded != face detected. Only mark `tracking` after actual landmarks.
- Fail visible with specific "no face", "model loading", or "model unavailable".
- Retry CPU backend once if GPU inference fails after successful initialization.
- Retain the existing 10 procedural face masks; do not add color looks.

## QA limitations
An HTTP 200/Next.js build DOES NOT demonstrate real camera tracking.
Manual Android/iOS camera permission and face recognition test is needed. Use
neon glasses first and look for the green "face detected" status.
