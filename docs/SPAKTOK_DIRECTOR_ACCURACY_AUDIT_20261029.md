# Spaktok AI Director — Accuracy and Verified Actions Audit

Date: 2026-10-29. Branch: `feat/vast-a100-forge-bridge-20261029`,
draft PR #14. **Code is not released to production.**

## The actual accuracy problem

A language model is not a reliable source of execution truth. During
real Cloudflare Llama 3.3 70B tests, it correctly chose the next tool
but hallucinated specialist destinations and once claimed an asset
was "sent" before any dispatch. Previously these could be confused
with a completed task.

A six-case **live provider** spot check (Arabic, German, and staged
observations, text only) returned correct next-tool action for
**6/6 sampled cases**. This is NOT a production accuracy rate, nor
proof of actual GLB delivery. It revealed wrong departments in some
raw model outputs, including missing Live from an Arabic Avatar Live
request and choosing Gift instead of German `Welt`.

## Fixes now committed

1. `requiredAgentAction(request)` implements proof-driven state
   transitions. Examples:
   - Existing GLB + color edit → recolor → inspect modified GLB →
     private SHA256 dispatch → finish.
   - Image + explicit 2.5D → local relief → inspect GLB →
     private dispatch → finish.
   - Image + real 360 → consented private GPU → inspect GLB →
     private dispatch → finish.
   - Inspection-only GLB → inspect → finish, with no automatic sharing.
   - Failed tool → explain/finish; no duplicate paid GPU job or re-edit.
2. The signed server passes the exact `requiredNextTool` in the
   planning context and independently rejects a model-generated tool
   inconsistent with these transitions. Recent history and tool
   observations are bounded and explicitly marked as **untrusted
   data**, not executable instructions.
3. `normalizeAgentDecision` enforces user-explicit destinations,
   including all-studios and exclusions in Arabic/German/English;
   deduplicates LLM targets; clears an irrelevant color field from
   non-recolor actions. German synonyms now cover `Welt`,
   `Geschenk`, `Livestream`, `Filter`, and `alle Bereiche`.
4. Both the server action policy and **actual Three.js GLB material
   editor** recognize German color instructions including
   `Färbe dieses GLB blau` and `Mach das Geschenk silbern`.
5. `creatorClarification` pauses unsupported/ambiguous color edits
   BEFORE any AI inference, GPU call or file operation.
6. The client uses `verifiedDirectorReply`, which reports completion
   only from an audited real GLB, stored private SHA256 manifest, and
   matching successful execution events. It NEVER repeats a
   model-generated "finished" statement as evidence.
7. The online indicator now probes Cloudflare Worker health AND verifies
   that the private Ed25519 signer matches the pinned deployed public
   identity. An environment flag alone is no longer proof of readiness.

## Additional live model calibration (small sample, not statistical accuracy)

Six real Cloudflare Llama 3.3 70B tool-planning prompts returned the
expected **next action** in **6/6** controlled cases:
- Arabic GLB gold+Gift/World → `recolor_asset` (~12.67 neurons)
- Arabic image 2.5D filter → `generate_relief` (~11.92 neurons)
- Arabic Avatar+Live 360 photo → `generate_3d_gpu` (~12.39 neurons)
- Arabic inspect-only → `inspect_asset` (~12.29 neurons)
- German blue World GLB → `recolor_asset` (~12.44 neurons)
- After successful recolor observation → `inspect_asset` (~12.13 neurons).

**But destination accuracy was NOT 6/6.** In particular, raw Llama
omitted `live` in the Avatar+Live case, hallucinated specialists for
an inspect-only case, and chose `gift` for the German World case.
The creator-intent authority and expanded German lexicon are
essential safeguards.

A separate three-prompt trial with `@cf/qwen/qwen3.8-27b` returned
a successful provider HTTP response but did not yield a parseable
structured decision with the constrained 200-token budget used in that
trial, while reporting ~63.7–63.9 neurons per request. A minimal Qwen
diagnostic with a larger/simple response did return JSON. Thus no
conclusive overall model ranking is claimed; Qwen must be evaluated
with its reasoning-token and vision setup before production use.
The main Spaktok text-decision provider remains Llama. There is
**no silent paid fallback**.

The model's output is always treated as a PROPOSAL until validated
against user intent, deterministic safety policy, and real tool QA.
Two very different capabilities must not be conflated: (a) choosing
the correct tool in a controlled test and (b) producing a genuinely
correct 3D result on a user's photo. The latter is not measured here.

## Precision fix: return the model, do not silently distribute it

A creator's request to `اجعل المجسم ذهبيًا` now means:
`recolor_asset` → `inspect_asset` → `present_asset` → `finish`.
The result is a real audited GLB with an inline viewer and download,
but `handoffStored=false` and **zero automatic specialist handoffs**.
Only an explicit distribution instruction enables `dispatch_asset`,
which securely stores and SHA256-verifies the private specialist draft.

Both the Cloudflare Worker tool schema and the server/browser contracts
now support `present_asset`; the deployed Worker was updated with this
tool and its live `/self-test` again confirmed unsigned+forged denial
with zero inference and zero D1 budget debits.

A separate live Llama trial chose `present_asset` and
`dispatch_asset` correctly (2/2 controlled next-step cases,
~12.16 and ~11.38 neurons). However, in the local-only request it
hallucinated `live` as a target despite the user's explicit
`لا ترسله إلى أي قسم`. A local-only result now uses a neutral,
internal World GLB preview profile in the ephemeral manifest and
**never stages World or any other studio**. The chat suppresses
private-studio cards for an unstaged result; tests cover the observed
hallucination and evidence-backed local completion.

**Important scope:** these live inference tests verify *tool selection*,
not full end-to-end browser execution. The newest code and tests are
still NOT verified by a successful production build.

## Actual Vercel build diagnostics and targeted fix

The Vercel preview for commit `3d964c9bc66d` DID run the
`bun run test:word:gate` test suite. The log reported **124 passing,
1 failing** across 21 test files (125 tests total). The single
failure was an error-precedence regression in
`spaktok-director-agent-contract.test.ts`:
the `recolor_asset` action attempted after an already verified
private dispatch was correctly rejected, but the guard reported
`unapproved_material_change` instead of the expected
`dispatch_already_complete`.

The validator now **short-circuits all post-completion actions before**
checking unrelated material/geometry parameters, making the rejection
consistent and avoiding any further editing after private delivery.
Fix commit: `e8672fa3ddf51e6a0c878d66188d0e231ae955f2`.

The test failure diagnosis is verified from Vercel logs; **the
fix has not yet been proved by a successful latest-HEAD Vercel build**.
The project remains a draft PR and production AI is OFF. Any
remaining compile/build issues will only be knowable after a
successful test-gate rerun.

## Tests and acceptance

The agent contract suite currently contains **26 source test cases**
(including older suites plus newly added ones), and there is a separate
five-test `spaktok-director-verified-reply.test.ts` suite. Material and
Arabic/German multilingual tests have also been expanded and included
in the project regression gate.

**These newly written tests have NOT yet passed the latest Vercel CI.**
The last branch status reports `build-rate-limit` for newer commits;
the PR remains a draft and must not be merged merely because the
source code was committed.

### Acceptance gates for a real product

- Build and typecheck latest HEAD with `npm run build` and Vitest
  regression suite. Fix all failures before merging.
- Test against the owner's actual private 2.84MB / 28,379-triangle GLB,
  not just synthetic model observations.
- Confirm the model's suggested steps and tool observations match:
  recolor actually produces new GLB SHA256, inspect confirms UV/normals/
  PBR and textures, dispatch stores the exact verified GLB for the
  requested specialist(s), and the chat shows the actual file.
- Validate Arabic and German negation: e.g. `جميع الأقسام ما عدا اللايف`
  and `alle Bereiche außer Live` must never stage Live.
- Failed material edit must not trigger distribution of the unedited
  model. Paid GPU action must not retry on uncertain errors.
- Run authenticated signed Vercel → Cloudflare Workers AI → browser
  tool → real GLB canary in a private preview. Current staging lacks
  that end-to-end verified execution.
- Verify native Android real-device FPS/memory/thermal, and production
  specialist Rigging, filters, tracking, gifts and Agora individually;
  a validated GLB preview does **not** prove those tasks are complete.

## Important remaining limitations

The free Cloudflare Llama 3.3 70B decision provider used in the
integration is **text-only** and cannot see image contents.
It is therefore not a genuine image-description/vision system yet.
A dedicated opt-in vision model and an end-to-end creator privacy
review are necessary before AI Director can reliably identify objects
from an attached photo. The AI cannot be guaranteed 100% accurate.

Only the real tools actually wired today can be executed. LLM reasoning
does not imply creation of rigged avatars, face tracking, finished
gift animation, multi-angle production geometry, final video or
live broadcasts. These need separate engines and validation.
