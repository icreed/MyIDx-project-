import type { CountryCode } from "./country.js";

export enum UserStatus {
  PENDING_EMAIL = "PENDING_EMAIL",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  CLOSED = "CLOSED",
}

export enum MfaMethod {
  TOTP = "TOTP",
  SMS_OTP = "SMS_OTP",
  EMAIL_OTP = "EMAIL_OTP",
}

export interface User {
  id: string;
  /** Drives the public profile URL at /u/:username. */
  username: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  country: CountryCode;
  status: UserStatus;
  mfaEnabled: boolean;
  mfaMethods: MfaMethod[];
  creditBalance: number;
  createdAt: string;
  updatedAt: string;
}

/** The subset of a user that is safe to render at /u/:username. */
export interface PublicProfile {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  country?: CountryCode;
  /** Identity confirmed by a completed verification run. */
  verified: boolean;
  verifiedAt?: string;
  memberSince: string;
}
