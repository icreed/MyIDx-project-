import type { IdentityScope } from "@myidx/shared";

export interface MyIDxClientOptions {
  clientId: string;
  /** Server-side only. Never ship this to a browser bundle. */
  clientSecret?: string;
  redirectUri: string;
  /** Defaults to the MyIDx production issuer. */
  issuer?: string;
  fetchImpl?: typeof fetch;
}

export interface AuthorizeUrlOptions {
  scopes: IdentityScope[];
  state: string;
  codeChallenge: string;
  /** Force the consent screen even when a grant already exists. */
  prompt?: "consent" | "none";
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

export interface MyIDxIdentity {
  sub: string;
  username: string;
  email?: string;
  email_verified?: boolean;
  phone?: string;
  country?: string;
  verified: boolean;
  verified_at?: string;
}

export class MyIDxError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "MyIDxError";
  }
}
