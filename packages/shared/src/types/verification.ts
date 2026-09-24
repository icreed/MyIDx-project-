import type { CountryCode, IdDocumentType } from "./country.js";

export enum VerificationKind {
  KYC = "KYC",
  KYB = "KYB",
}

export enum VerificationStatus {
  CREATED = "CREATED",
  AWAITING_DOCUMENTS = "AWAITING_DOCUMENTS",
  PENDING_PROVIDER = "PENDING_PROVIDER",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  RETRY_REQUESTED = "RETRY_REQUESTED",
  EXPIRED = "EXPIRED",
}

export enum VerificationProvider {
  SUMSUB = "SUMSUB",
}

export interface VerificationRun {
  id: string;
  kind: VerificationKind;
  /** Present for KYC runs. */
  userId?: string;
  /** Present for KYB runs, and for merchant-initiated KYC. */
  merchantId?: string;
  country: CountryCode;
  documentType?: IdDocumentType;
  provider: VerificationProvider;
  /** Provider-side applicant id, e.g. Sumsub applicantId. */
  providerRef?: string;
  status: VerificationStatus;
  rejectionReason?: string;
  /** Whether a merchant is billed for this run. */
  billable: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface VerificationWebhookEvent {
  provider: VerificationProvider;
  providerRef: string;
  status: VerificationStatus;
  raw: unknown;
  receivedAt: string;
}
