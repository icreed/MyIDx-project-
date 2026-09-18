import { Injectable, Logger } from "@nestjs/common";
import type { IdDocumentType, VerificationScope } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { CreditsService } from "../credits/credits.service.js";
import { SumsubProvider } from "./sumsub.provider.js";

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sumsub: SumsubProvider,
    private readonly credits: CreditsService,
  ) {}

  /**
   * Starts a run. User-initiated runs spend the user's credits; merchant-initiated
   * runs are marked billable and invoiced to the merchant instead.
   */
  async start(input: {
    scope: VerificationScope;
    userId?: string;
    merchantId?: string;
    countryCode: string;
    documentType?: IdDocumentType;
  }) {
    const billable = Boolean(input.merchantId);
    if (!billable && input.userId) {
      await this.credits.spend(input.userId, `verification:${input.scope}`);
    }

    const run = await this.prisma.verificationRun.create({
      data: {
        scope: input.scope,
        userId: input.userId,
        merchantId: input.merchantId,
        countryCode: input.countryCode.toUpperCase(),
        documentType: input.documentType,
        billable,
        status: "AWAITING_DOCUMENTS",
      },
      select: { id: true, status: true },
    });

    const applicant = await this.sumsub.createApplicant({
      externalUserId: run.id,
      levelName: input.scope === "KYB" ? "basic-kyb-level" : "basic-kyc-level",
      countryCode: input.countryCode.toUpperCase(),
    });

    await this.prisma.verificationRun.update({
      where: { id: run.id },
      data: { providerRef: applicant.providerRef, status: "PENDING_PROVIDER" },
    });

    return { verificationId: run.id, hostedUrl: applicant.hostedUrl };
  }

  /**
   * Applies a provider webhook. Signature is verified by the caller; this method
   * is idempotent so provider retries are safe.
   */
  async applyWebhook(payload: {
    applicantId: string;
    reviewStatus?: string;
    reviewResult?: { reviewAnswer?: string; moderationComment?: string };
  }) {
    const run = await this.prisma.verificationRun.findUnique({
      where: { providerRef: payload.applicantId },
      select: { id: true, userId: true, status: true },
    });
    if (!run) {
      this.logger.warn(`webhook for unknown applicant ${payload.applicantId}`);
      return { applied: false };
    }
    if (run.status === "APPROVED" || run.status === "REJECTED") {
      return { applied: false, reason: "already final" };
    }

    const status = this.sumsub.mapReviewStatus(payload);
    const final = status === "APPROVED" || status === "REJECTED";

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationRun.update({
        where: { id: run.id },
        data: {
          status,
          rejectionReason:
            status === "REJECTED" ? payload.reviewResult?.moderationComment : null,
          completedAt: final ? new Date() : null,
        },
      });

      // An approved KYC run is what flips the public "verified" badge.
      if (status === "APPROVED" && run.userId) {
        await tx.profile.update({
          where: { userId: run.userId },
          data: { verified: true, verifiedAt: new Date() },
        });
        await tx.identityDocument.updateMany({
          where: { userId: run.userId },
          data: { verified: true },
        });
      }

      if (run.userId) {
        await tx.auditEvent.create({
          data: {
            userId: run.userId,
            actorType: "SYSTEM",
            action: `verification.${status.toLowerCase()}`,
            targetType: "VerificationRun",
            targetId: run.id,
          },
        });
      }
    });

    return { applied: true, status };
  }

  getRun(id: string) {
    return this.prisma.verificationRun.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        scope: true,
        status: true,
        countryCode: true,
        rejectionReason: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }
}
