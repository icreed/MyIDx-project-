import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sumsub adapter.
 *
 * Deliberately the only place that knows about Sumsub. Everything upstream deals
 * in VerificationRun, so a second provider becomes a sibling of this class
 * rather than a change across the codebase.
 */
@Injectable()
export class SumsubProvider {
  private readonly logger = new Logger(SumsubProvider.name);

  constructor(private readonly config: ConfigService) {}

  /** Creates an applicant and returns the provider reference plus hosted flow URL. */
  async createApplicant(input: {
    externalUserId: string;
    levelName: string;
    countryCode: string;
  }): Promise<{ providerRef: string; hostedUrl: string }> {
    const body = JSON.stringify({
      externalUserId: input.externalUserId,
      info: { country: input.countryCode },
    });
    const path = `/resources/applicants?levelName=${encodeURIComponent(input.levelName)}`;
    const res = await fetch(`${this.baseUrl()}${path}`, {
      method: "POST",
      headers: { ...this.signedHeaders("POST", path, body), "content-type": "application/json" },
      body,
    });
    if (!res.ok) {
      throw new Error(`sumsub applicant creation failed with ${res.status}`);
    }
    const json = (await res.json()) as { id: string };
    return {
      providerRef: json.id,
      hostedUrl: `${this.baseUrl()}/idensic/l/#/${json.id}`,
    };
  }

  /**
   * Verifies the webhook HMAC. Unsigned or mismatched payloads are dropped:
   * verification outcomes drive billing and access, so they must be authentic.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.config.get<string>("sumsub.webhookSecret");
    if (!secret || !signature) {
      this.logger.warn("rejected sumsub webhook: missing secret or signature");
      return false;
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Maps provider review results onto our own status vocabulary. */
  mapReviewStatus(payload: {
    reviewStatus?: string;
    reviewResult?: { reviewAnswer?: string };
  }): "APPROVED" | "REJECTED" | "PENDING_PROVIDER" | "RETRY_REQUESTED" {
    if (payload.reviewStatus !== "completed") return "PENDING_PROVIDER";
    switch (payload.reviewResult?.reviewAnswer) {
      case "GREEN":
        return "APPROVED";
      case "RED":
        return "REJECTED";
      case "RETRY":
        return "RETRY_REQUESTED";
      default:
        return "PENDING_PROVIDER";
    }
  }

  private baseUrl(): string {
    return this.config.get<string>("sumsub.baseUrl") ?? "https://api.sumsub.com";
  }

  private signedHeaders(method: string, path: string, body: string): Record<string, string> {
    const appToken = this.config.get<string>("sumsub.appToken");
    const secret = this.config.get<string>("sumsub.secretKey");
    if (!appToken || !secret) throw new Error("Sumsub credentials are not configured");
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret)
      .update(ts + method.toUpperCase() + path + body)
      .digest("hex");
    return { "X-App-Token": appToken, "X-App-Access-Ts": ts, "X-App-Access-Sig": signature };
  }
}
