# Supabase-free native auth and D1 database — phase A
The original Supabase project was deleted. Original Auth users and media cannot
be restored without a separately saved backup. **Do not describe this migration
as a transfer of deleted user records.** Account IDs will be new.

## Why D1 and Vercel temporarily?
Use Cloudflare D1 **Free** tier for SQL records. This transitional architecture
calls the official Cloudflare D1 HTTP API from existing Vercel Node routes.
It adds API overhead compared with Workers D1 bindings; migrate to native
Cloudflare Workers binding after credentials and staging are verified.

## Must configure before users can register
1. In Cloudflare Dashboard → Workers & Pages → D1, create a new database
   named `spaktok-primary` (can use Free plan).
2. Run `migrations/native/0001.sql` on the NEW, empty D1 database using
   Cloudflare D1 Console or Wrangler. Do not apply to production Supabase.
3. Create a scoped Cloudflare API token with **D1 Read/Write on that database**.
   Never post this token in chat, browser code, or GitHub.
4. In Vercel project environment settings, set server-only:
   `CLOUDFLARE_ACCOUNT_ID` (32 hexadecimal characters);
   `CLOUDFLARE_D1_DATABASE_ID` (the D1 UUID);
   `CLOUDFLARE_D1_API_TOKEN` (scoped API secret);
   `SPAKTOK_AUTH_PEPPER` (64 random hex chars, generated locally using
     `openssl rand -hex 32`);
   `SPAKTOK_REGISTRATION_CODE` (random secret at least 12 chars; owner invite code).
5. Redeploy. GET `/api/native/auth` must show configured=true with user=null.
   Sign up with a *new* email, strong password and invite code, then sign in.
6. The cookie is HttpOnly/Secure/SameSite=Lax. Sessions are random, their hashes
   stored in D1 and revoked at logout. Passwords use scrypt N=16384 r=8 p=1
   with unique salts plus server pepper. The pepper MUST be backed up securely;
   losing it means all users must reset their passwords.
7. `/api/auth/health` is a legacy Supabase health diagnostic; do not use it for D1.

## Limits and risks
- **Invite-only pilot:** no outbound verification email or password reset yet.
  A typed email is not a verified mailbox. Do not claim email is confirmed.
- Rate limits use 15-minute DB-backed buckets, 24 IP attempts, 12 per email,
  maximum three signups per IP bucket. Cleanup of old buckets is still required.
- D1 Free is limited. No accounts or content exist until the D1 database is
  created, migration executed and Vercel secrets configured.
- This is a temporary Cloudflare D1 HTTP API bridge, not the desired final
  1B-user architecture. API keys must never enter the browser.
- Social, chat, notifications, uploads and payment-dependent workflows
  need separate audit and migration; do not delete database credentials from
  old environments until all routes are free of Supabase references.
- Do not enable open public registration before email verification, anti-abuse,
  account recovery, GDPR deletion/export and operational review.

## Version 2: offline account recovery

Run `migrations/native/0002_recovery.sql` after v1. Sign-up returns a high-entropy
single-use recovery code **one time**; show it to the user before leaving the
signup screen. Its SHA-256 hash, not the plaintext code, is stored in D1.
The account can reset a password with email + recovery code; each use rotates
it and increments `auth_version`, immediately invalidating old sessions.
No email is sent or verified. Losing the password AND recovery code means an
admin identity-verification process is needed (not yet implemented).
Do not share or log recovery codes.

## Limited public beta (October 2026)

Use `SPAKTOK_OPEN_BETA_REGISTRATION=true` in Production only to allow new
accounts without an invitation code. Per-IP rate limits still apply (three
signups per 15-minute bucket), and signups after 100 completed accounts
in the last 24 hours are rejected. The cap is not a transactional admission
counter. No email address is verified or sent; identity ownership is unproven.
For a trusted early pilot only; disable this flag once Turnstile/email
verification are implemented.
