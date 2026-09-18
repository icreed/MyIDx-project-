import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { authenticator } from "otplib";
import type { MfaRequiredAction } from "@myidx/shared";
import { MFA_REQUIRED_ACTIONS } from "@myidx/shared";
import { PrismaService } from "../../prisma/prisma.service.js";
import { EncryptionService } from "../../common/crypto/encryption.service.js";

/**
 * TOTP enrolment and step-up checks.
 *
 * Sensitive actions are gated on a *recent* MFA proof, not merely on a session
 * that once passed MFA, so a stolen long-lived session cannot drain a vault.
 */
@Injectable()
export class MfaService {
  private static readonly STEP_UP_WINDOW_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  /** Generates a TOTP secret and the otpauth URI to render as a QR code. */
  async beginTotpEnrolment(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    const dataKey = await this.userDataKey(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: this.encryption.encryptForUser(secret, dataKey) },
    });
    const issuer = this.config.get<string>("TOTP_ISSUER") ?? "MyIDx";
    return { otpauthUrl: authenticator.keyuri(email, issuer, secret) };
  }

  /** Confirms the first code, which is what actually enables MFA. */
  async confirmTotpEnrolment(userId: string, token: string): Promise<void> {
    if (!(await this.verifyTotp(userId, token))) {
      throw new ForbiddenException("invalid verification code");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaMethods: { set: ["TOTP"] } },
    });
  }

  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecretEnc: true, dataKeyEncrypted: true },
    });
    if (!user?.totpSecretEnc) return false;
    const dataKey = this.encryption.unsealUserDataKey(userId, user.dataKeyEncrypted);
    const secret = this.encryption.decryptForUser(user.totpSecretEnc, dataKey);
    return authenticator.verify({ token, secret });
  }

  static requiresStepUp(action: string): action is MfaRequiredAction {
    return (MFA_REQUIRED_ACTIONS as readonly string[]).includes(action);
  }

  /** Throws unless the session proved MFA inside the step-up window. */
  async assertStepUp(sessionId: string, action: string): Promise<void> {
    if (!MfaService.requiresStepUp(action)) return;
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { mfaSatisfiedAt: true },
    });
    const satisfiedAt = session?.mfaSatisfiedAt?.getTime() ?? 0;
    if (Date.now() - satisfiedAt > MfaService.STEP_UP_WINDOW_MS) {
      throw new ForbiddenException({
        code: "MFA_REQUIRED",
        message: `re-authentication required for ${action}`,
      });
    }
  }

  private async userDataKey(userId: string): Promise<Buffer> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { dataKeyEncrypted: true },
    });
    return this.encryption.unsealUserDataKey(userId, user.dataKeyEncrypted);
  }
}
