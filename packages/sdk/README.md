# @myidx/sdk

Merchant integration for **Sign up / sign in / verify with MyIDx**. Implements the
OAuth 2.0 authorization code flow with PKCE (S256). The implicit flow is not supported.

```ts
import { MyIDxClient } from "@myidx/sdk";
import { IdentityScope } from "@myidx/shared";

const client = new MyIDxClient({
  clientId: process.env.MYIDX_CLIENT_ID!,
  clientSecret: process.env.MYIDX_CLIENT_SECRET!, // server-side only
  redirectUri: "https://example.com/callback",
});

// 1. redirect the user
const { url, codeVerifier } = await client.startAuthorization({
  scopes: [IdentityScope.PROFILE_BASIC, IdentityScope.VERIFICATION_STATUS],
  state: crypto.randomUUID(),
});
// persist `codeVerifier` and `state` against the session, then redirect to `url`

// 2. on the callback, verify `state` matches, then exchange
const tokens = await client.completeAuthorization(code, codeVerifier);
const identity = await client.getIdentity(tokens.access_token);
```

`clientSecret` must never reach a browser bundle. For public clients omit it and
rely on PKCE alone.

Users can revoke a grant at any time from their MyIDx portal; once revoked,
outstanding access tokens for that grant stop working, so treat `401` from
`getIdentity` as "consent withdrawn" and re-run the authorization flow.
