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
