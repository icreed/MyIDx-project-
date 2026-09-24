import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { REVIEWED_SCOPES, SELF_SERVE_SCOPES } from "@myidx/shared";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  getMe(merchantId: string) {
    return this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: {
        id: true,
        legalName: true,
        tradingName: true,
        countryCode: true,
        supportEmail: true,
        status: true,
        kybStatus: true,
        createdAt: true,
      },
    });
  }

  listClients(merchantId: string) {
    return this.prisma.oAuthClient.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      // clientSecretHash is deliberately never selected.
      select: {
        clientId: true,
        name: true,
        redirectUris: true,
        allowedScopes: true,
        active: true,
        createdAt: true,
      },
    });
  }

  /**
   * Registers an OAuth client. The plaintext secret is returned exactly once and
   * only the hash is retained, so a database read cannot impersonate a merchant.
   */
  async createClient(
    merchantId: string,
    input: { name: string; redirectUris: string[]; scopes: string[] },
  ) {
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { kybStatus: true, status: true },
    });
    if (merchant.status !== "ACTIVE") {
      throw new ForbiddenException("merchant account is not active");
    }

    // Regulated scopes stay closed until the merchant's own KYB is approved.
    const needsReview = input.scopes.filter((s) =>
      (REVIEWED_SCOPES as string[]).includes(s),
    );
    if (needsReview.length > 0 && merchant.kybStatus !== "APPROVED") {
      throw new ForbiddenException(
        `an approved KYB is required for: ${needsReview.join(", ")}`,
      );
    }
    const unknown = input.scopes.filter(
      (s) => ![...SELF_SERVE_SCOPES, ...REVIEWED_SCOPES].includes(s as never),
    );
    if (unknown.length > 0) throw new BadRequestException(`unknown scopes: ${unknown.join(", ")}`);

    // https only, and no wildcards: these are exact-match redirect targets.
    for (const uri of input.redirectUris) {
      const parsed = new URL(uri);
      const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (parsed.protocol !== "https:" && !isLocalhost) {
        throw new BadRequestException(`redirect_uri must use https: ${uri}`);
      }
      if (uri.includes("*")) throw new BadRequestException("wildcard redirect URIs are not allowed");
    }

    const clientId = `myidx_${randomBytes(12).toString("hex")}`;
    const clientSecret = randomBytes(32).toString("base64url");

    await this.prisma.oAuthClient.create({
      data: {
        merchantId,
        clientId,
        clientSecretHash: await argon2.hash(clientSecret, { type: argon2.argon2id }),
        name: input.name,
        redirectUris: input.redirectUris,
        allowedScopes: input.scopes,
      },
    });

    return {
      clientId,
      clientSecret,
      warning: "Store this secret now — it cannot be retrieved again.",
    };
  }

  async deactivateClient(merchantId: string, clientId: string) {
    const result = await this.prisma.oAuthClient.updateMany({
      where: { clientId, merchantId },
      data: { active: false },
    });
    if (result.count === 0) throw new BadRequestException("client not found");

    // Deactivating a client withdraws every grant issued under it.
    await this.prisma.accessGrant.updateMany({
      where: { client: { clientId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { deactivated: true };
  }
}
