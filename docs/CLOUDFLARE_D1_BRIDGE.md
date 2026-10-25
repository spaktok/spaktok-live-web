# Production D1 bridge — asymmetric request authentication

Cloudflare Worker: `spaktok-d1-bridge`, `https://spaktok-d1-bridge.spaktok.workers.dev`
D1 binding: `DB` → `spaktok-primary` (EU jurisdiction).

Vercel keeps only `SPAKTOK_D1_BRIDGE_SIGNING_KEY` (base64 PKCS#8 Ed25519 PEM),
`SPAKTOK_D1_BRIDGE_URL`, `SPAKTOK_AUTH_PEPPER` and
`SPAKTOK_REGISTRATION_CODE`. It does NOT need a Cloudflare API token.

Cloudflare contains **only the public key** in the bridge Worker. Each Vercel
SQL request includes a signed exact JSON body, Unix seconds, and fresh 128-bit
nonce. The Worker checks Ed25519 signature and 45s clock drift and stores
nonces in a D1 table to prevent replay. Private signing material is never
returned by an HTTP endpoint or committed to Git.

**Security and operational limitations:**
- The bridge offers unrestricted SQL to the holder of the private signing key.
  Treat the Vercel project and signing key as highly privileged. Add SQL-level
  least privilege, rate limits, D1 request budget, audit logs, key rotation,
  and per-route authorizations before public scaling.
- This is a temporary Vercel-to-D1 Worker bridge. Moving the full application
  to native Cloudflare Worker/Binding removes extra network hops and the bridge.
- `SPAKTOK_AUTH_PEPPER` must be backed up before real users create accounts.
  Rotating or losing it invalidates stored password hashes. The invite code
  can be rotated independently; it does not reset account passwords.
- The Worker stores `bridge_nonces`; add a scheduled cleanup of entries older
  than one hour and monitor D1 write usage.
- The legacy Vercel `cloudflare` variable should be removed by an authorized
  administrator and its potentially disclosed token revoked.
- The existing browser-based registration relies on an invitation code; avoid
  open registration without email verification, abuse controls and recovery
  protections.
