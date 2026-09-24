# MyIDx

Identity platform. A user verifies their identity once, keeps their documents in an
encrypted vault, and reuses that verification with any business that integrates the
MyIDx SDK — without handing over documents again.

> **Status:** initial scaffold. Structure, data model and the security-critical
> paths (encryption, OAuth, ledger) are in place; screens are placeholders.

## Layout

```
apps/
  api/        NestJS API — auth, vault, OAuth server, verification, credits
  user/       Next.js user portal, incl. public profiles at /u/:username
  merchant/   Next.js merchant portal — OAuth clients, verifications, billing
  admin/      Next.js admin panel — markets, pricing, merchant review, audit
packages/
  shared/     Domain types, zod schemas, constants shared by every app
  sdk/        Published merchant SDK — "Sign up / sign in / verify with MyIDx"
```

## Getting started

Requires Node 20+, pnpm 9, PostgreSQL and Redis.

```bash
pnpm install
cp .env.example .env          # then fill in the blanks
openssl rand -base64 32       # -> ENCRYPTION_MASTER_KEY
pnpm --filter @myidx/api prisma:generate
pnpm --filter @myidx/api exec prisma migrate dev --name init
pnpm dev
```

| App      | URL                   |
| -------- | --------------------- |
| API      | http://localhost:4000 |
| API docs | http://localhost:4000/docs |
| User     | http://localhost:3000 |
| Merchant | http://localhost:3001 |
| Admin    | http://localhost:3002 |

## Design decisions worth knowing

**Country-agnostic by construction.** No table or code path encodes one country's
documents. `Country` and `CountryIdType` rows map local documents (e.g. "NIN slip")
onto generic classes (`NATIONAL_ID`). Launching a market is an insert, not a
migration, and application code asks `CountriesService` rather than branching on a
country code.

**Envelope encryption for the vault.** Each user has a random 32-byte data key,
sealed under a wrapping key derived from `ENCRYPTION_MASTER_KEY` via HKDF with the
user id as `info`. Consequences: ciphertext moved between users is undecryptable,
and rotating the master key re-wraps data keys instead of rewriting every row.
Sensitive columns are suffixed `Encrypted`; only masked values are queryable.

**Revocation is immediate, not eventual.** Access tokens carry a grant id, and
`/oauth/userinfo` re-checks that the grant is live on every call. Revoking consent
takes effect at once rather than when a token happens to expire. Replaying an
authorization code revokes the whole grant, on the assumption that a reused code
means it leaked.

**MFA is step-up, not just login.** Sensitive actions require an MFA proof from
within the last five minutes, so a stolen long-lived session cannot read a vault.

**Money is a ledger.** Credits are append-only rows with `balanceAfter`. Spending
uses a conditional update so concurrent spends cannot both pass the balance check,
and payment `providerRef` values are unique so webhook retries cannot double-credit.

**Logs are deliberately thin.** Prisma query logging is limited to warnings and
errors because statements carry vault ciphertext and identifiers. IP addresses are
hashed before storage.

## Deployment

Railway, with native PostgreSQL and Redis. Each app deploys as its own service from
this monorepo; `railway.json` sets the build and start commands. Set every variable
from `.env.example` in the Railway service before first boot — the API validates its
configuration at startup and exits rather than running half-configured.
