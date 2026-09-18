import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { IdentityScope, oauthAuthorizeSchema } from "@myidx/shared";
import { PrismaService } from "../../prisma/prisma.service.js";

/**
 * OAuth 2.0 authorization server for the MyIDx SDK.
 *
 * Authorization code + PKCE only. Codes are single-use, short-lived, stored
 * hashed, and bound to the client, redirect URI and code challenge that created
 * them. Token issuance additionally re-checks that the user's grant is live, so
 * a revocation takes effect immediately rather than at token expiry.
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Validates an authorize request before the consent screen is rendered. */
  async prepareConsent(query: unknown) {
    const dto = oauthAuthorizeSchema.parse(query);
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: dto.client_id },
      include: { merchant: { select: { legalName: true, tradingName: true, kybStatus: true } } },
    });
    if (!client?.active) throw new UnauthorizedException("unknown client");

    // Exact match: prefix matching on redirect URIs is an open-redirect hazard.
    if (!client.redirectUris.includes(dto.redirect_uri)) {
      throw new BadRequestException("redirect_uri is not registered for this client");
    }

    const requested = dto.scope.split(/[\s,]+/).filter(Boolean);
    const disallowed = requested.filter((s) => !client.allowedScopes.includes(s));
    if (disallowed.length > 0) {
      throw new BadRequestException(`scopes not permitted: ${disallowed.join(", ")}`);
    }

    return {
      client: { clientId: client.clientId, name: client.name },
      merchant: client.merchant,
      scopes: requested as IdentityScope[],
    };
  }

  /** Called after the user approves consent; returns the code to redirect with. */
  async issueCode(input: {
    clientId: string;
    userId: string;
    scopes: string[];
    redirectUri: string;
    codeChallenge: string;
  }): Promise<{ code: string }> {
    const client = await this.prisma.oAuthClient.findUniqueOrThrow({
      where: { clientId: input.clientId },
      select: { id: true, merchantId: true },
    });

    const code = randomBytes(32).toString("base64url");
    const ttl = this.config.get<number>("oauth.codeTtl") ?? 600;

    await this.prisma.$transaction([
      this.prisma.authorizationCode.create({
        data: {
          codeHash: this.hash(code),
          clientId: client.id,
          userId: input.userId,
          scopes: input.scopes,
          redirectUri: input.redirectUri,
          codeChallenge: input.codeChallenge,
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
      }),
      // Record the standing grant so the user can see and revoke it later.
      this.prisma.accessGrant.upsert({
        where: { userId_clientId: { userId: input.userId, clientId: client.id } },
        create: {
          userId: input.userId,
          merchantId: client.merchantId,
          clientId: client.id,
          scopes: input.scopes,
        },
        update: { scopes: input.scopes, revokedAt: null, grantedAt: new Date() },
      }),
    ]);

    return { code };
  }

  async exchangeCode(input: {
    code: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    codeVerifier: string;
  }) {
    const record = await this.prisma.authorizationCode.findUnique({
      where: { codeHash: this.hash(input.code) },
      include: { client: true },
    });
    if (!record) throw new UnauthorizedException("invalid authorization code");

    // Single use: a replayed code is treated as compromise of the whole grant.
    if (record.consumedAt) {
      await this.prisma.accessGrant.updateMany({
        where: { userId: record.userId, clientId: record.clientId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("authorization code was already used");
    }
    if (record.expiresAt < new Date()) throw new UnauthorizedException("authorization code expired");
    if (record.client.clientId !== input.clientId) {
      throw new UnauthorizedException("code was not issued to this client");
    }
    if (record.redirectUri !== input.redirectUri) {
      throw new UnauthorizedException("redirect_uri mismatch");
    }

    // Confidential clients must still present their secret; PKCE is not a substitute.
    if (record.client.clientSecretHash && !input.clientSecret) {
      throw new UnauthorizedException("client_secret is required for this client");
    }
    if (
      input.clientSecret &&
      !(await argon2.verify(record.client.clientSecretHash, input.clientSecret))
    ) {
      throw new UnauthorizedException("invalid client credentials");
    }

    const expected = createHash("sha256").update(input.codeVerifier).digest();
    const provided = Buffer.from(record.codeChallenge, "base64url");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException("PKCE verification failed");
    }

    const grant = await this.prisma.accessGrant.findUnique({
      where: { userId_clientId: { userId: record.userId, clientId: record.clientId } },
      select: { id: true, revokedAt: true },
    });
    if (!grant || grant.revokedAt) throw new UnauthorizedException("consent was revoked");

    await this.prisma.authorizationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: record.userId, actor: "MERCHANT_ON_BEHALF", grant: grant.id, scope: record.scopes },
      { expiresIn: "1h" },
    );

    return {
      access_token: accessToken,
      token_type: "Bearer" as const,
      expires_in: 3600,
      scope: record.scopes.join(" "),
    };
  }

  /** Userinfo, filtered to exactly the scopes the user consented to. */
  async userinfo(userId: string, grantId: string, scopes: string[]) {
    const grant = await this.prisma.accessGrant.findUnique({
      where: { id: grantId },
      select: { revokedAt: true },
    });
    if (!grant || grant.revokedAt) throw new UnauthorizedException("consent was revoked");

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        phone: true,
        countryCode: true,
        profile: { select: { verified: true, verifiedAt: true } },
      },
    });

    const claims: Record<string, unknown> = { sub: user.id, username: user.username };
    if (scopes.includes(IdentityScope.EMAIL)) {
      claims.email = user.email;
      claims.email_verified = user.emailVerified;
    }
    if (scopes.includes(IdentityScope.PHONE)) claims.phone = user.phone;
    if (scopes.includes(IdentityScope.PROFILE_FULL)) claims.country = user.countryCode;
    if (
      scopes.includes(IdentityScope.VERIFICATION_STATUS) ||
      scopes.includes(IdentityScope.KYC_RESULT)
    ) {
      claims.verified = user.profile?.verified ?? false;
      claims.verified_at = user.profile?.verifiedAt?.toISOString();
    }
    return claims;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
