/**
 * Country-agnostic identity primitives.
 *
 * The data model never hardcodes a country's document set. A country is
 * referenced by ISO 3166-1 alpha-2 code and the document types it accepts are
 * resolved at runtime from `CountryIdConfig`, so onboarding a new market is a
 * data change rather than a schema migration.
 */

/** ISO 3166-1 alpha-2, e.g. "NG", "US", "GB". */
export type CountryCode = string;

/** Generic document classes that exist across jurisdictions. */
export enum IdDocumentType {
  PASSPORT = "PASSPORT",
  NATIONAL_ID = "NATIONAL_ID",
  DRIVERS_LICENSE = "DRIVERS_LICENSE",
  VOTER_CARD = "VOTER_CARD",
  RESIDENCE_PERMIT = "RESIDENCE_PERMIT",
  TAX_ID = "TAX_ID",
  UTILITY_BILL = "UTILITY_BILL",
  BANK_STATEMENT = "BANK_STATEMENT",
  BUSINESS_REGISTRATION = "BUSINESS_REGISTRATION",
  OTHER = "OTHER",
}

/** A document type as offered within one specific country. */
export interface CountryIdType {
  /** Generic class this maps onto. */
  type: IdDocumentType;
  /** Local name shown to the user, e.g. "NIN slip", "SSN". */
  label: string;
  /** Provider-specific identifier (e.g. Sumsub idDocType). */
  providerCode?: string;
  /** Regex the document number must satisfy, when well-defined. */
  numberPattern?: string;
  /** Whether the document alone satisfies identity proofing. */
  sufficientForIdentity: boolean;
  /** Whether the document proves address. */
  provesAddress: boolean;
}

export interface CountryIdConfig {
  country: CountryCode;
  displayName: string;
  /** Documents accepted for individual (KYC) flows. */
  kycTypes: CountryIdType[];
  /** Documents accepted for business (KYB) flows. */
  kybTypes: CountryIdType[];
  /** Whether the market is currently enabled. */
  enabled: boolean;
}
