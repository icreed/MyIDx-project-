import { Body, Controller, Get, Post, Query, Req, UseGuards, VERSION_NEUTRAL } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiTags } from "@nestjs/swagger";
import { OAuthService } from "./oauth.service.js";

@ApiTags("oauth")
@Controller({ path: "oauth", version: VERSION_NEUTRAL })
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  /** Validates the request and returns what the consent screen should display. */
  @Get("authorize")
  authorize(@Query() query: unknown) {
    return this.oauth.prepareConsent(query);
  }

  /** The user approving consent. Returns the code for the redirect. */
  @Post("authorize/approve")
  @UseGuards(AuthGuard("jwt"))
  approve(
    @Req() req: { user: { id: string } },
    @Body()
    body: { client_id: string; scope: string; redirect_uri: string; code_challenge: string },
  ) {
    return this.oauth.issueCode({
      clientId: body.client_id,
      userId: req.user.id,
      scopes: body.scope.split(/[\s,]+/).filter(Boolean),
      redirectUri: body.redirect_uri,
      codeChallenge: body.code_challenge,
    });
  }

  @Post("token")
  token(
    @Body()
    body: {
      grant_type: string;
      code: string;
      client_id: string;
      client_secret?: string;
      redirect_uri: string;
      code_verifier: string;
    },
  ) {
    return this.oauth.exchangeCode({
      code: body.code,
      clientId: body.client_id,
      clientSecret: body.client_secret,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });
  }

  @Get("userinfo")
  @UseGuards(AuthGuard("jwt"))
  userinfo(@Req() req: { user: { id: string }; auth?: { grant: string; scope: string[] } }) {
    return this.oauth.userinfo(req.user.id, req.auth?.grant ?? "", req.auth?.scope ?? []);
  }
}
