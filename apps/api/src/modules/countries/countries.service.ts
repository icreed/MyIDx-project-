import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

/**
 * Resolves which documents a country accepts. Callers must never branch on a
 * country code directly — ask here instead, so enabling a market is a data change.
 */
@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  listEnabled() {
    return this.prisma.country.findMany({
      where: { enabled: true },
      orderBy: { displayName: "asc" },
      select: { code: true, displayName: true },
    });
  }

  async getIdTypes(countryCode: string, scope: "KYC" | "KYB") {
    const country = await this.prisma.country.findFirst({
      where: { code: countryCode.toUpperCase(), enabled: true },
      include: {
        idTypes: {
          where: { scope, enabled: true },
          orderBy: { label: "asc" },
        },
      },
    });
    if (!country) throw new NotFoundException(`country ${countryCode} is not available`);
    return country.idTypes;
  }

  /** Validates a document number against the country-specific pattern, when defined. */
  async assertValidDocumentNumber(
    countryCode: string,
    type: string,
    scope: "KYC" | "KYB",
    value: string,
  ): Promise<void> {
    const types = await this.getIdTypes(countryCode, scope);
    const match = types.find((t) => t.type === type);
    if (!match) throw new NotFoundException(`${type} is not accepted in ${countryCode}`);
    if (match.numberPattern && !new RegExp(match.numberPattern).test(value)) {
      throw new NotFoundException(`document number does not match the format for ${match.label}`);
    }
  }
}
