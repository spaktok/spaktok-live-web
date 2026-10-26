# SpakTok Studio 2026 — original filter engine
- 40+ GPU color look presets, grouped into trending/portrait/film/vibe/scene/mono.
- Existing WebGL single-pass shader applies original color and FX parameters in preview and canvas recording.
- Efficient on-device MediaPipe: face tracking only for geometric edits and makeup, background segmentation only when enabled.
- Serialize vision inference (~7–11 FPS); never await AI for GPU draw; release camera when leaving.
- Low-end devices output 960p-height portrait instead of 1280p. Use actual frame time measurements before claiming 60fps.
- Feature parity with CapCut is an aspiration, not an exact recreation or proof of superior latency.
- Live video broadcast is NOT active; do not present local camera preview as a public livestream.
- Do not store face geometry or biometric landmarks on the server.
