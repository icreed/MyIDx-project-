import { IdentityScope } from "./types/identity.js";
import type { PricingConfig } from "./types/credits.js";

/** Defaults seeded on first boot; the admin panel is the source of truth after that. */
export const DEFAULT_PRICING: PricingConfig = {
  signupBonusCredits: 500,
  creditsPerUserAction: 1,
  merchantKycUnitPrice: 100,
  merchantKybUnitPrice: 500,
  currency: "USD",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/** Scopes a merchant may request without manual review. */
export const SELF_SERVE_SCOPES: IdentityScope[] = [
  IdentityScope.PROFILE_BASIC,
  IdentityScope.EMAIL,
  IdentityScope.VERIFICATION_STATUS,
];

/** Scopes that expose regulated data and require an approved KYB. */
export const REVIEWED_SCOPES: IdentityScope[] = [
  IdentityScope.PROFILE_FULL,
  IdentityScope.ADDRESS,
  IdentityScope.PHONE,
  IdentityScope.DOCUMENT_METADATA,
  IdentityScope.KYC_RESULT,
];

/** Actions that must be re-authenticated with MFA regardless of session age. */
export const MFA_REQUIRED_ACTIONS = [
  "vault.document.view",
  "vault.document.delete",
  "grant.create",
  "grant.revoke",
  "account.email.change",
  "account.close",
  "payout.method.change",
] as const;

export type MfaRequiredAction = (typeof MFA_REQUIRED_ACTIONS)[number];

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/;

/** Reserved so they cannot be taken as usernames and shadow real routes. */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "dashboard",
  "docs",
  "help",
  "login",
  "logout",
  "merchant",
  "oauth",
  "settings",
  "signup",
  "support",
  "u",
  "verify",
]);
