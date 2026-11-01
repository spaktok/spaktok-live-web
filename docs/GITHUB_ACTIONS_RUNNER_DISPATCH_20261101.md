# GitHub Actions runner dispatch incident — 2026-11-01 UTC

## Reproducible evidence

Repository: `spaktok/spaktok-live-web` (public; default branch `main`).

- Minimal self-contained workflow: `.github/workflows/runner-diagnostics.yml`.
- Run: https://github.com/spaktok/spaktok-live-web/actions/runs/41348264195
- Tested two independent GitHub-hosted labels: `ubuntu-24.04` and `windows-latest`.
- **Both jobs reached conclusion=FAILURE without any executed steps** (API `steps: null`); the minimal workflow does not invoke the application, dependency installation, or customer secrets.
- Earlier Ubuntu-only run: https://github.com/spaktok/spaktok-live-web/actions/runs/41347798274
- Comprehensive platform run: https://github.com/spaktok/spaktok-live-web/actions/runs/41345552479
- In other failed jobs, `runner_id: 0`, empty `runner_name` and no logs were observed. This strongly suggests the failure is before runner assignment; it is not proof of an account restriction or of a GitHub service-wide incident.
- Production release must remain blocked. Vercel `vercel.json` has `git.deploymentEnabled.main=false`, which does not by itself prevent deliberate manual release.

## GitHub owner checks (requires account settings, not source code)

1. Visit repository Settings -> Actions -> General. Verify Actions is enabled and GitHub-hosted runner usage is not blocked; note any banner saying Actions is disabled at the account/repository level.
2. Review Actions -> Runners and owner/organization policy. This repository uses the normal GitHub-hosted labels, not registered self-hosted runners.
3. Check the Actions usage spending/budget policy without assuming that absence of a billing warning means all runner entitlements are available.
4. Review https://www.githubstatus.com/ for an incident during the exact UTC failure window.
5. If everything looks enabled, open a GitHub Support request with the precise run IDs and request inspection of **pre-job runner dispatch / account Actions entitlement**. Include no secrets or user media.

## Distinguish causes

- If a different repository on the same account can acquire a runner, compare repo-level policy.
- If no repository on the account can start a minimal workflow, investigate account entitlement or platform dispatch.
- If a runner starts and steps appear, collect the first failing step log and debug the source/workflow normally.
- Do not bypass tests, weaken branch protection, or treat Vercel READY as a substitute for CI.

## Acceptance criterion

One fresh minimal Ubuntu run succeeds **with nonempty steps and a real runner identity**, followed by the actual platform, Forge, security and production-build checks on the exact target commit. No production promotion before all gates pass.
