import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import {
  DEFAULT_PRICING,
  loginSchema,
  merchantRegistrationSchema,
  userRegistrationSchema,
} from "@myidx/shared";
import { PrismaService } from "../../prisma/prisma.service.js";
import { EncryptionService } from "../../common/crypto/encryption.service.js";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  async registerUser(input: unknown) {
    const dto = userRegistrationSchema.parse(input);

    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }] },
      select: { id: true },
    });
    if (clash) throw new ConflictException("email or username is already taken");

    const userId = createHash("sha256").update(randomBytes(32)).digest("hex").slice(0, 25);
    const { sealed } = this.encryption.createUserDataKey(userId);
    const pricing = (await this.prisma.pricingConfig.findUnique({ where: { id: 1 } })) ?? DEFAULT_PRICING;

    // Signup bonus is written as a ledger entry, never as a bare balance bump,
    // so the balance always reconciles against the ledger.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: userId,
          username: dto.username,
          email: dto.email.toLowerCase(),
          passwordHash: await argon2.hash(dto.password, ARGON2_OPTIONS),
          countryCode: dto.country,
          dataKeyEncrypted: sealed,
          creditBalance: pricing.signupBonusCredits,
          profile: { create: {} },
        },
        select: { id: true, username: true, email: true, creditBalance: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId: created.id,
          type: "SIGNUP_BONUS",
          delta: pricing.signupBonusCredits,
          balanceAfter: pricing.signupBonusCredits,
          reason: "signup bonus",
        },
      });

      return created;
    });

    return user;
  }

  async registerMerchant(input: unknown) {
    const dto = merchantRegistrationSchema.parse(input);
    return this.prisma.merchant.create({
      data: {
        legalName: dto.legalName,
        tradingName: dto.tradingName,
        countryCode: dto.country,
        supportEmail: dto.supportEmail.toLowerCase(),
        passwordHash: await argon2.hash(dto.password, ARGON2_OPTIONS),
      },
      select: { id: true, legalName: true, status: true, kybStatus: true },
    });
  }

  async loginUser(input: unknown, context: { userAgent?: string; forwardedFor?: string }) {
    const dto = loginSchema.parse(input);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, passwordHash: true, status: true, mfaEnabled: true },
    });

    // Same failure shape whether the email is unknown or the password is wrong.
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("invalid credentials");
    }
    if (user.status !== "ACTIVE") throw new UnauthorizedException("account is not active");

    if (user.mfaEnabled && !dto.otp) {
      return { mfaRequired: true as const };
    }

    return this.issueSession(user.id, "USER", {
      mfaSatisfied: user.mfaEnabled,
      userAgent: context.userAgent,
      ipHash: context.forwardedFor ? this.hashIp(context.forwardedFor) : undefined,
    });
  }

  async loginMerchant(input: unknown) {
    const dto = loginSchema.parse(input);
    const merchant = await this.prisma.merchant.findFirst({
      where: { supportEmail: dto.email.toLowerCase() },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!merchant || !(await argon2.verify(merchant.passwordHash, dto.password))) {
      throw new UnauthorizedException("invalid credentials");
    }
    if (merchant.status === "SUSPENDED") throw new UnauthorizedException("account is suspended");
    return this.issueSession(merchant.id, "MERCHANT", { mfaSatisfied: false });
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("refresh token is not valid");
    }

    // Rotate on every use so a replayed token is detectable and useless.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(session.userId, "USER", { mfaSatisfied: false });
  }

  async revokeSession(refreshToken: string): Promise<{ revoked: boolean }> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  private async issueSession(
    subjectId: string,
    actor: "USER" | "MERCHANT",
    options: { mfaSatisfied: boolean; userAgent?: string; ipHash?: string },
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: subjectId,
      actor,
      mfa: options.mfaSatisfied,
    });
    const refreshToken = randomBytes(48).toString("base64url");
    const ttlDays = Number((this.config.get<string>("jwt.refreshTtl") ?? "30d").replace("d", ""));

    if (actor === "USER") {
      await this.prisma.session.create({
        data: {
          userId: subjectId,
          refreshTokenHash: this.hashToken(refreshToken),
          userAgent: options.userAgent,
          ipHash: options.ipHash,
          mfaSatisfiedAt: options.mfaSatisfied ? new Date() : null,
          expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
        },
      });
    }

    return { accessToken, refreshToken, tokenType: "Bearer" as const };
  }

  /** Refresh tokens are stored hashed so a database leak cannot resume sessions. */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** IPs are hashed before storage; alerts need correlation, not the raw address. */
  private hashIp(ip: string): string {
    return createHash("sha256").update(ip.split(",")[0]?.trim() ?? ip).digest("hex");
  }
}
