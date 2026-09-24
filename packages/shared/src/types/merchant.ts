import type { CountryCode } from "./country.js";
import type { IdentityScope } from "./identity.js";

export enum MerchantStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export enum KybStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface Merchant {
  id: string;
  legalName: string;
  tradingName?: string;
  country: CountryCode;
  supportEmail: string;
  status: MerchantStatus;
  kybStatus: KybStatus;
  createdAt: string;
  updatedAt: string;
}

/** An OAuth 2.0 client registered by a merchant for the MyIDx SDK. */
export interface OAuthClient {
  id: string;
  merchantId: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: IdentityScope[];
  /** Hash only — the plaintext secret is shown once at creation. */
  clientSecretHash: string;
  active: boolean;
  createdAt: string;
}

/**
 * A user's standing grant to a merchant. Revocable at any time from the user
 * portal; revocation invalidates outstanding access tokens for that grant.
 */
export interface AccessGrant {
  id: string;
  userId: string;
  merchantId: string;
  clientId: string;
  scopes: IdentityScope[];
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}
