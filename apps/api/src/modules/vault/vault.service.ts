import { Injectable } from "@nestjs/common";
import type { IdDocumentType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { EncryptionService } from "../../common/crypto/encryption.service.js";
import { CountriesService } from "../countries/countries.service.js";

/**
 * The identity vault.
 *
 * Document numbers and sensitive attributes are encrypted with the owning user's
 * data key before they ever reach the database. Listing returns masked values
 * only; revealing a full number is a separate, MFA-gated, audited read.
 */
@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly countries: CountriesService,
  ) {}

  /** Safe for list views — no plaintext document numbers. */
  listDocuments(userId: string) {
    return this.prisma.identityDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        countryCode: true,
        type: true,
        label: true,
        numberMasked: true,
        issuedAt: true,
        expiresAt: true,
        verified: true,
        createdAt: true,
      },
    });
  }

  async addDocument(
    userId: string,
    input: {
      countryCode: string;
      type: IdDocumentType;
      number: string;
      issuedAt?: string;
      expiresAt?: string;
    },
  ) {
    // The country config decides what is acceptable, not hardcoded branching.
    await this.countries.assertValidDocumentNumber(
      input.countryCode,
      input.type,
      "KYC",
      input.number,
    );
    const idTypes = await this.countries.getIdTypes(input.countryCode, "KYC");
    const label = idTypes.find((t) => t.type === input.type)?.label ?? String(input.type);

    const dataKey = await this.dataKey(userId);
    return this.prisma.identityDocument.create({
      data: {
        userId,
        countryCode: input.countryCode.toUpperCase(),
        type: input.type,
        label,
        numberEncrypted: this.encryption.encryptForUser(input.number, dataKey),
        numberMasked: EncryptionService.mask(input.number),
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
      select: { id: true, label: true, numberMasked: true, verified: true },
    });
  }

  /**
   * Reveals a full document number. Callers must have cleared an MFA step-up;
   * every reveal is written to the audit trail and surfaces as an activity alert.
   */
  async revealDocument(userId: string, documentId: string, ipHash?: string) {
    const doc = await this.prisma.identityDocument.findFirstOrThrow({
      where: { id: documentId, userId },
      select: { id: true, numberEncrypted: true, label: true },
    });
    const dataKey = await this.dataKey(userId);

    await this.prisma.auditEvent.create({
      data: {
        userId,
        actorType: "USER",
        actorId: userId,
        action: "vault.document.view",
        targetType: "IdentityDocument",
        targetId: doc.id,
        ipHash,
      },
    });

    return {
      id: doc.id,
      label: doc.label,
      number: this.encryption.decryptForUser(doc.numberEncrypted, dataKey),
    };
  }

  async deleteDocument(userId: string, documentId: string) {
    await this.prisma.identityDocument.deleteMany({ where: { id: documentId, userId } });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        actorType: "USER",
        actorId: userId,
        action: "vault.document.delete",
        targetType: "IdentityDocument",
        targetId: documentId,
      },
    });
    return { deleted: true };
  }

  async setAttribute(
    userId: string,
    key: string,
    value: string,
    sensitivity: "PUBLIC" | "INTERNAL" | "SENSITIVE" = "SENSITIVE",
  ) {
    const encrypted = sensitivity === "SENSITIVE";
    const dataKey = encrypted ? await this.dataKey(userId) : undefined;
    const payload = {
      sensitivity,
      valuePlain: encrypted ? null : value,
      valueEncrypted: encrypted ? this.encryption.encryptForUser(value, dataKey!) : null,
    };
    return this.prisma.vaultAttribute.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, ...payload },
      update: payload,
      select: { key: true, sensitivity: true, updatedAt: true },
    });
  }

  private async dataKey(userId: string): Promise<Buffer> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { dataKeyEncrypted: true },
    });
    return this.encryption.unsealUserDataKey(userId, user.dataKeyEncrypted);
  }
}
