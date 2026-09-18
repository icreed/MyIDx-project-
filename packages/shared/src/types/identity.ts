import type { CountryCode, IdDocumentType } from "./country.js";

/**
 * Sensitivity classification. Anything marked SENSITIVE is stored encrypted at
 * rest with AES-256-GCM under a per-user derived key and is never written to
 * logs or analytics payloads.
 */
export enum DataSensitivity {
  PUBLIC = "PUBLIC",
  INTERNAL = "INTERNAL",
  SENSITIVE = "SENSITIVE",
}

/** A single verified attribute held in the user's identity vault. */
export interface VaultAttribute<T = string> {
  key: string;
  value: T;
  sensitivity: DataSensitivity;
  /** Set once a verification run has confirmed this attribute. */
  verifiedAt?: string;
  /** Verification run that produced it. */
  sourceVerificationId?: string;
}

/** A stored identity document. Raw values live encrypted; only metadata is plain. */
export interface IdentityDocument {
  id: string;
  userId: string;
  country: CountryCode;
  type: IdDocumentType;
  /** Local label resolved from the country config at capture time. */
  label: string;
  /** Last 4 characters only, safe for display. */
  numberMasked: string;
  issuedAt?: string;
  expiresAt?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Scopes a merchant may request over a user's vault via OAuth. */
export enum IdentityScope {
  PROFILE_BASIC = "profile:basic",
  PROFILE_FULL = "profile:full",
  EMAIL = "email",
  PHONE = "phone",
  ADDRESS = "address",
  DOCUMENT_METADATA = "document:metadata",
  VERIFICATION_STATUS = "verification:status",
  KYC_RESULT = "kyc:result",
}
