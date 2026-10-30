# Spaktok platform parity & launch-gate audit — 2026-10-30

**Scope:** GitHub `spaktok/spaktok-live-web` default `main` and this PR branch.
The other connected `spaktok/Spaktok` repository is a distinct React Native
codebase; it does not expose the local `apps/native_android` tree described
in earlier planning. This audit cannot claim production Android parity.
No deployment, Cloudflare database migration, paid livestream, payments,
GPU rental, Meta sign-in or secret changes were executed here.

## Competitor baseline (functional, NOT copying trade dress)

Reference docs:
- TikTok LIVE match: https://support.tiktok.com/en/live-gifts-wallet/tiktok-live/live-match
- TikTok youth/account privacy:
  https://support.tiktok.com/en/account-and-privacy/account-privacy-settings/privacy-and-safety-settings-for-users-under-age-18
- Snapchat Spotlight: https://help.snapchat.com/hc/en-us/articles/7012271311892-What-is-Spotlight
- Snapchat chat retention: https://help.snapchat.com/hc/en-gb/articles/7012334940948-When-does-Snapchat-delete-Snaps-and-Chats
- Snapchat screenshot/message symbols:
  https://help.snapchat.com/hc/en-us/articles/7012315702548-What-do-the-icons-on-the-Chat-Screen-mean

| Product | Existing evidence in `main` | Current gap | This PR |
| --- | --- | --- | --- |
| For You / Following reels | `app/api/feed`, `video-feed`, adaptive media, likes, bookmarks | Proven ranking fairness, abusive content filtering, high-load QA, persisted user data saver | **Data saver** now persists locally and disables prefetch |
| Camera and upload | `camera-screen`, R2 upload-initiate with max 20MB / 5 per day | Resumable/chunked uploads, large files, transcode progress, robust native permissions, music rights | Audit only; no deceptive upload claims |
| Stories | `stories-screen`, `story-viewer` | Lifecycle, expiry and abuse controls across deployments | Audit only |
| Messaging and view-once | `chat-screen`, `lib/messaging` | Verify deletion/screenshot semantics, abuse reporting, conversation privacy, E2EE disclosure | Audit only; never claim E2EE |
| Live discovery | `live-grid` uses mockLiveStreams; homepage showed "coming soon" | Real Agora/presence sessions, moderation, broadcast recordings | **New honest LIVE Arena** displays no pretend live audiences |
| Live PK/rounds | `lib/types` has PK models, mock live UI exists | Signed match state, server clocks, host acceptance, abuse controls, score ledger | **Preview controls** for individual/team and 3/5 rounds, no fake results |
| Live gifts and payouts | Mock gift icons/value in old `live-stream` | Server-authoritative ledger, consent, age/payment verification, refunds & payout policies | No monetary operations; release blocker |
| Top ranks | Types and various presentation hints | Genuine period-scoped leaderboard and anti-fraud | **D1 real published-video engagement API + UI**; explicitly NOT gifts ranking |
| Profiles/follow | `native/profile`, follow API | Block/mute, verified audience constraints, reliable deleted profile handling | Rank opens real profiles |
| Discover/search | `native/discover` D1 search, real follows | Ranking controls, hashtags/audio, moderation, discovery safety | Audit only |
| Settings / device | Existing settings with unsupported/privacy switches | Save user preferences, honor data saver beyond current session | **Local preferences + feed prefetch integration** |
| Data access | "Download my data" was placeholder | Complete GDPR access export across processors/logs/messages/payments | **Partial self-service JSON export** with cap, auth/rate-limit, explicit truncation |
| DSA/GDPR / German legal | Some support/legal menu items are placeholders | Real imprint, controller identity, privacy notices, notice/action, appeals, data deletion, youth measures | Launch blockers documented; do not fabricate legal identity |
| AR effects & 3D | Studio components and draft Forge branches | 3D inference validated, rights and moderation, native camera/anchor validation | Deliberately deferred; do not auto-enable |
| Native Android | Local migration plans mentioned in project discussions | Actual connected repo is separate React Native; native project not accessible here | NOT modified in this PR |

## New code in this PR

- `components/spaktok/spaktok-live-hub.tsx`: premium black/indigo visual,
  mobile safe-area, live *local preview*, creator rank and PK round selector.
  Pages distinguish simulated visual design from real stream sessions.
- `app/api/rankings/route.ts`: D1 query reads only `status='published'`
  videos, time-filtered and capped top-30 results. It doesn't invent paid
  battle/gift rank. Anti-fraud is **not yet complete**.
- `app/page.tsx`: routes Live tab to the original arena UI. Camera
  opens in local LIVE mode; no broadcast is started.
- `app/api/account/export/route.ts`: owner-authenticated partial
  JSON export with per-user rate limiting and explicit truncation.
  NOT full GDPR Article 15 production compliance.
- `components/spaktok/settings-screen.tsx`: data export button calls the
  actual endpoint. Device settings persist as local preferences only.
  Server-side private account and 2FA remain disabled, not fake toggles.
- `lib/video/user-playback-preferences.ts` and `video-feed.tsx`: user
  Data Saver preference disables reel prefetch and works across tabs.

## Germany and EU legal gate (before publishing platform)

- German DDG §5 needs visible operator identification and relevant
  contact/registry details for covered commercial digital services.
  DO NOT invent a GmbH, office address, registration number or owner.
  Official law: https://www.gesetze-im-internet.de/ddg/__5.html
- GDPR: provide rights and procedures for access, rectification,
  erasure, portability and other relevant rights, including third-party
  processors and age-appropriate design, not just a button.
  Official: https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en
- DSA: implement reporting/notice-action, accessible contact points,
  reasoned moderation decisions and applicable appeal handling.
  Scope-specific obligations require legal review, including possible
  small/micro-provider exceptions.
  Official: https://digital-strategy.ec.europa.eu/en/faqs/digital-services-act-questions-and-answers
- Coins/gifts: separate ledger and payouts, prohibit arbitrary user
  balance adjustment, vet payment providers, verify creator eligibility
  and platform terms. Never imply cash transfer based on UI-only gifts.
- Music, image rights, minors, app-store privacy disclosures and live
  recording/consent need distinct policy and enforcement work.
- Do not claim the application is legally compliant until counsel
  approves actual operating identity, policies and deployed behavior.

## Ordered execution after this initial slice

**P0 functional/safety (release blockers):**
1. Stand up real stream session lifecycle and verified Agora integration
   behind a feature flag; test interrupt/reconnect, latency and devices.
2. Server-authoritative battle rooms/round clocks, scores, gifts, replay
   resistance, refunds, ledger reconciliation and age restrictions.
3. Moderation reports, notice/action, sanctions, audit trails and appeals.
4. End-to-end upload finalization, R2 private/public scope, media scanning,
   legal ownership and deletion. Native Android smoke tests.
5. Full account data export/deletion pipeline, legal notice and controller
   information verified by the actual operator.

**P1 UX parity:** consistent button disabled/loading/error states; deep links;
camera effects/performance; search/hashtags; message retention controls;
translation and accessibility; creator analytics.
**P2 differentiation:** Spaktok Studio, avatar/AR, 3D live gifts and worlds,
all gated behind original-model licensing, compute budget and user privacy.

## Definition of done

A section is "complete" only when (a) buttons invoke a working authenticated
backend or are visibly disabled, (b) tests pass, (c) native Android is tested
on physical hardware, (d) privacy/legal review is done where relevant,
(e) E2E monitoring and cost caps exist. The source code alone is not
evidence of production readiness.

**Status:** draft engineering tranche, not an assertion that Spaktok
already exceeds TikTok or Snapchat, and not a claim that all features
are completed. Old `live-stream` mocks are still in the repository for
legacy/demo uses; they MUST NOT be mistaken for real production live data.
