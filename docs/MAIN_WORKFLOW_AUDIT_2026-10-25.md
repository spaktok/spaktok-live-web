# SpakTok — Main-branch development policy (2026-10-25)

## Repository audit

- PR #1 (brand, payments), #2 (auth hardening), #3 (reels/stories), #4 (AI camera) were already merged into main.
- PR #5 (enhanced color grading/effects) was merged to main on 2026-10-25. Its Vercel preview was READY; GPU/performance evaluation on target phones is still needed.
- PR #6 (experimental D1 public feed) failed its Vercel preview build with
  `NOW_SANDBOX_WORKER_EDGE_FUNCTION_UNSUPPORTED_MODULES` because the Edge bundle references `cloudflare:workers`.
  Do NOT merge PR #6 as-is. Keep Cloudflare-specific bindings behind a separately deployed Worker or a validated Cloudflare-only build boundary.
- The production deployment on main prior to cleanup was READY at commit `917216e2`.

## Main is the source of truth

New, small changes go directly to main per owner's request, without force pushes or rewriting history.
Check deployments after each change. If a change affects auth, billing, media visibility, or
data migrations, validate in a staging environment first.

## Build outputs are not source code

The project previously tracked 133 generated files inside `dist/`, `.vinext/`, and
`.wrangler/`, about 6.1 MB. They are now ignored/removed from the Git tree only;
the build process must recreate them. `public/` contains authored assets and is retained.

## Package managers

Both `bun.lock` and `pnpm-lock.yaml` exist. Vercel deployment logs showed
**`bun install`**, even while pnpm lock was detected, indicating an explicit
install command override. Do not delete either lockfile without confirming
and changing the install command + locking it in CI across Vercel/Cloudflare.
Use reproducible dependency installs rather than updating lockfiles implicitly.

## Cloudflare migration is not yet active

Supabase still backs login and several production APIs. No D1 or R2 production
bindings are configured in the tracked `wrangler.jsonc`. Offline prototype
ZIPs for phases 2–4 must be audited and deployed in isolated staging.
Never remove Supabase until account/data migration and rollback are verified.

## Sanity checklist

- Run `bun install --frozen-lockfile` (in the currently configured Vercel environment)
- Run `bun run test` and `bun run build` with real application environment variables
- Run `bun run cf:build` separately for Cloudflare staging
- Check Vercel production deployment is READY and compare before/after behavior
- Monitor login, feed, comments, chat, checkout and AI camera with test accounts
