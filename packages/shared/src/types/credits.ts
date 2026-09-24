export enum PaymentProvider {
  STRIPE = "STRIPE",
  PAYPAL = "PAYPAL",
  PAYSTACK = "PAYSTACK",
}

export enum CreditTxnType {
  SIGNUP_BONUS = "SIGNUP_BONUS",
  PURCHASE = "PURCHASE",
  SPEND = "SPEND",
  REFUND = "REFUND",
  ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT",
}

/** Append-only ledger entry. Balance is the sum of deltas, never edited in place. */
export interface CreditTransaction {
  id: string;
  userId: string;
  type: CreditTxnType;
  /** Positive credits in, negative credits out. */
  delta: number;
  /** Running balance after this entry, denormalised for fast reads. */
  balanceAfter: number;
  reason?: string;
  createdAt: string;
}

/** Admin-tunable commercial settings; no pricing is hardcoded in app logic. */
export interface PricingConfig {
  signupBonusCredits: number;
  creditsPerUserAction: number;
  merchantKycUnitPrice: number;
  merchantKybUnitPrice: number;
  currency: string;
  updatedAt: string;
}
