import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service.js";
import { MfaService } from "./mfa.service.js";

/**
 * Users and merchants register through separate endpoints: they collect
 * different data and land in different review workflows.
 */
@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
  ) {}

  @Post("users/register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  registerUser(@Body() body: unknown) {
    return this.auth.registerUser(body);
  }

  @Post("merchants/register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  registerMerchant(@Body() body: unknown) {
    return this.auth.registerMerchant(body);
  }

  // Tight limit: this is the credential-stuffing surface.
  @Post("users/login")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  loginUser(@Body() body: unknown, @Req() req: { headers: Record<string, string | undefined> }) {
    return this.auth.loginUser(body, {
      userAgent: req.headers["user-agent"],
      forwardedFor: req.headers["x-forwarded-for"],
    });
  }

  @Post("merchants/login")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  loginMerchant(@Body() body: unknown) {
    return this.auth.loginMerchant(body);
  }

  @Post("refresh")
  refresh(@Body("refreshToken") refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }

  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  logout(@Body("refreshToken") refreshToken: string) {
    return this.auth.revokeSession(refreshToken);
  }

  @Post("mfa/totp/begin")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  beginTotp(@Req() req: { user: { id: string }; body: { email: string } }) {
    return this.mfa.beginTotpEnrolment(req.user.id, req.body.email);
  }

  @Post("mfa/totp/confirm")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  confirmTotp(@Req() req: { user: { id: string } }, @Body("token") token: string) {
    return this.mfa.confirmTotpEnrolment(req.user.id, token);
  }
}
