import { BadRequestException, Injectable } from "@nestjs/common";
import type { CreditTxnType } from "@prisma/client";
import { DEFAULT_PRICING } from "@myidx/shared";
import { PrismaService } from "../../prisma/prisma.service.js";

/**
 * Credit ledger.
 *
 * Every movement is an append-only row; `balanceAfter` is written inside the same
 * transaction that decrements the denormalised balance, so the two can be
 * reconciled and a lost update shows up as a mismatch rather than silent drift.
 */
@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPricing() {
    return (await this.prisma.pricingConfig.findUnique({ where: { id: 1 } })) ?? DEFAULT_PRICING;
  }

  getBalance(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    });
  }

  listTransactions(userId: string, take = 50) {
    return this.prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { type: true, delta: true, balanceAfter: true, reason: true, createdAt: true },
    });
  }

  /**
   * Spends credits for a user action. Runs in a transaction with a conditional
   * update so two concurrent spends cannot both pass the balance check.
   */
  async spend(userId: string, reason: string, amount?: number) {
    const pricing = await this.getPricing();
    const cost = amount ?? pricing.creditsPerUserAction;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, creditBalance: { gte: cost } },
        data: { creditBalance: { decrement: cost } },
      });
      if (updated.count === 0) {
        throw new BadRequestException({ code: "INSUFFICIENT_CREDITS", required: cost });
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { creditBalance: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: "SPEND",
          delta: -cost,
          balanceAfter: user.creditBalance,
          reason,
        },
      });

      return { spent: cost, balance: user.creditBalance };
    });
  }

  /** Credits an account after a settled payment or an admin adjustment. */
  async credit(
    userId: string,
    amount: number,
    type: CreditTxnType,
    options: { reason?: string; provider?: "STRIPE" | "PAYPAL" | "PAYSTACK"; providerRef?: string } = {},
  ) {
    if (amount <= 0) throw new BadRequestException("amount must be positive");

    return this.prisma.$transaction(async (tx) => {
      // Idempotency: a provider reference is only ever applied once, so webhook
      // retries cannot double-credit an account.
      if (options.providerRef) {
        const existing = await tx.creditTransaction.findFirst({
          where: { providerRef: options.providerRef },
          select: { id: true, balanceAfter: true },
        });
        if (existing) return { credited: 0, balance: existing.balanceAfter, duplicate: true };
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type,
          delta: amount,
          balanceAfter: user.creditBalance,
          reason: options.reason,
          provider: options.provider,
          providerRef: options.providerRef,
        },
      });

      return { credited: amount, balance: user.creditBalance, duplicate: false };
    });
  }
}
