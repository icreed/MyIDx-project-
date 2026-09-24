import type { AuthorizeUrlOptions, MyIDxClientOptions, PkcePair, TokenResponse } from "./types.js";
import { MyIDxError } from "./types.js";

export const DEFAULT_ISSUER = "https://api.myidx.io";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generates a PKCE verifier/challenge pair (S256). Authorization code flow with
 * PKCE is mandatory — the implicit flow is not supported by MyIDx.
 */
export async function createPkcePair(): Promise<PkcePair> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const codeVerifier = base64Url(random);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return { codeVerifier, codeChallenge: base64Url(new Uint8Array(digest)) };
}

export function buildAuthorizeUrl(
  options: MyIDxClientOptions,
  authorize: AuthorizeUrlOptions,
): string {
  const url = new URL("/oauth/authorize", options.issuer ?? DEFAULT_ISSUER);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", authorize.scopes.join(" "));
  url.searchParams.set("state", authorize.state);
  url.searchParams.set("code_challenge", authorize.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (authorize.prompt) url.searchParams.set("prompt", authorize.prompt);
  return url.toString();
}

export async function exchangeCode(
  options: MyIDxClientOptions,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const doFetch = options.fetchImpl ?? fetch;
  const issuer = options.issuer ?? DEFAULT_ISSUER;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: options.redirectUri,
    client_id: options.clientId,
    code_verifier: codeVerifier,
  });
  if (options.clientSecret) body.set("client_secret", options.clientSecret);

  const res = await doFetch(new URL("/oauth/token", issuer).toString(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    throw new MyIDxError(detail.error ?? "token exchange failed", res.status, detail.error);
  }
  return (await res.json()) as TokenResponse;
}
