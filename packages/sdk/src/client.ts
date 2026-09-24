import type { AuthorizeUrlOptions, MyIDxClientOptions, MyIDxIdentity, TokenResponse } from "./types.js";
import { MyIDxError } from "./types.js";
import { DEFAULT_ISSUER, buildAuthorizeUrl, createPkcePair, exchangeCode } from "./oauth.js";

/**
 * Merchant-side entry point for "Sign up / sign in / verify with MyIDx".
 *
 * Typical server-side usage:
 *   const { codeVerifier, codeChallenge } = await client.startAuthorization();
 *   // persist codeVerifier + state in the session, redirect the user to the url
 *   const tokens = await client.completeAuthorization(code, codeVerifier);
 *   const identity = await client.getIdentity(tokens.access_token);
 */
export class MyIDxClient {
  private readonly options: MyIDxClientOptions;

  constructor(options: MyIDxClientOptions) {
    if (!options.clientId) throw new Error("clientId is required");
    if (!options.redirectUri) throw new Error("redirectUri is required");
    this.options = { ...options, issuer: options.issuer ?? DEFAULT_ISSUER };
  }

  /** Creates PKCE material and the authorize URL to redirect the user to. */
  async startAuthorization(
    authorize: Omit<AuthorizeUrlOptions, "codeChallenge">,
  ): Promise<{ url: string; codeVerifier: string }> {
    const { codeVerifier, codeChallenge } = await createPkcePair();
    const url = buildAuthorizeUrl(this.options, { ...authorize, codeChallenge });
    return { url, codeVerifier };
  }

  /** Exchanges the authorization code for tokens. */
  completeAuthorization(code: string, codeVerifier: string): Promise<TokenResponse> {
    return exchangeCode(this.options, code, codeVerifier);
  }

  /** Reads the identity attributes the user consented to share. */
  async getIdentity(accessToken: string): Promise<MyIDxIdentity> {
    const res = await (this.options.fetchImpl ?? fetch)(
      new URL("/oauth/userinfo", this.options.issuer).toString(),
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new MyIDxError("failed to load identity", res.status);
    }
    return (await res.json()) as MyIDxIdentity;
  }

  /**
   * Starts a verification run for an already-linked user. Billed to the
   * merchant at the configured KYC/KYB unit price.
   */
  async requestVerification(
    accessToken: string,
    input: { kind: "KYC" | "KYB"; country: string; redirectUrl?: string },
  ): Promise<{ verificationId: string; hostedUrl: string }> {
    const res = await (this.options.fetchImpl ?? fetch)(
      new URL("/v1/verifications", this.options.issuer).toString(),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new MyIDxError("failed to start verification", res.status);
    }
    return (await res.json()) as { verificationId: string; hostedUrl: string };
  }
}
