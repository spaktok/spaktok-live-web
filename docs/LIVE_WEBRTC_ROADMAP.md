# Low-latency live: WHIP/WHEP transport prepared, NOT enabled

The browser transport `lib/live/webrtc.ts` can use the filtered camera canvas
stream for a WHIP publisher and a WHEP viewer, without a local WebRTC
signaling server. Every endpoint is constrained to Cloudflare Stream domains.
It never creates a live input nor exposes a publisher URL publicly.

Activation requirements (NOT COMPLETE):
1. Authorized Cloudflare Stream subscription and live-input API access.
   The currently connected Cloudflare account returned HTTP 403 for GET
   /stream/live_inputs; there are no verified live inputs available.
2. Per-user authorized live-room creation, short-lived scoped publish
   credentials and abuse/stream moderation controls.
3. Reliable publisher stop/cleanup, viewer auth, rejoin/reconnect policy.
4. Load testing of 5th/95th percentile glass-to-glass latency over mobile
   4G/Wi-Fi; distinguish capture FPS, connection RTT and viewer delay.
5. Consent, privacy and cost ceilings before allowing real live sessions.

As of October 2026, Stream Live WebRTC WHIP/WHEP is generally available
with sub-second target latency but billed for delivery; do NOT claim this
application is faster than TikTok/Snapchat without measured evidence.
See: https://developers.cloudflare.com/stream/webrtc-beta/
