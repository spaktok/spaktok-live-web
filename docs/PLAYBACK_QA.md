# SpakTok playback QA diagnostics

Open the app with `?perf=1` while signed in, navigate to the video feed,
and watch several videos. A local on-screen HUD displays:

- P75 time from calling `video.play()` until the `playing` event (milliseconds).
- The number of observed starts.
- Counts and aggregate durations of completed `waiting` → `playing` stalls.

The measurements are local to the active feed view and only collected when
`?perf=1`. They are NOT sent to analytics servers, persisted to storage,
or attached to user IDs. This is an engineering diagnostic tool, not a
production-quality time-to-first-decoded-frame measurement.

Test with 4G throttling, low-end Android, iOS Safari, power/data saver, long feeds,
and deliberate packet loss. Compare identical devices/networks with other apps.
Avoid publishing winner claims until independently measured.
