import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service.js";

export interface JwtPayload {
  sub: string;
  /** Distinguishes platform users from merchant operators. */
  actor: "USER" | "MERCHANT";
  /** Present when the session has cleared an MFA challenge. */
  mfa?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("jwt.secret"),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.actor === "MERCHANT") {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: payload.sub } });
      if (!merchant || merchant.status === "SUSPENDED") {
        throw new UnauthorizedException("merchant account is not active");
      }
      return { id: merchant.id, actor: "MERCHANT" as const, mfa: payload.mfa ?? false };
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("account is not active");
    }
    return { id: user.id, actor: "USER" as const, mfa: payload.mfa ?? false };
  }
}
