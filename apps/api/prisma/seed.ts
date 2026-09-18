import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds reference data only — no user records.
 *
 * Country document sets live here as data so that adding a market later is an
 * insert rather than a migration. `providerCode` values map onto Sumsub document
 * types; adjust them against the provider's current catalogue before going live.
 */
const COUNTRIES = [
  {
    code: "NG",
    displayName: "Nigeria",
    kyc: [
      { type: "NATIONAL_ID", label: "NIN slip", providerCode: "ID_CARD", numberPattern: "^\\d{11}$", identity: true },
      { type: "PASSPORT", label: "International passport", providerCode: "PASSPORT", identity: true },
      { type: "DRIVERS_LICENSE", label: "Driver's licence", providerCode: "DRIVERS", identity: true },
      { type: "VOTER_CARD", label: "Permanent voter card", providerCode: "VOTER_CARD", identity: false },
    ],
    kyb: [{ type: "BUSINESS_REGISTRATION", label: "CAC certificate", providerCode: "COMPANY_DOC" }],
  },
  {
    code: "US",
    displayName: "United States",
    kyc: [
      { type: "PASSPORT", label: "Passport", providerCode: "PASSPORT", identity: true },
      { type: "DRIVERS_LICENSE", label: "Driver's license", providerCode: "DRIVERS", identity: true },
      { type: "NATIONAL_ID", label: "State ID", providerCode: "ID_CARD", identity: true },
    ],
    kyb: [{ type: "BUSINESS_REGISTRATION", label: "Articles of incorporation", providerCode: "COMPANY_DOC" }],
  },
  {
    code: "GB",
    displayName: "United Kingdom",
    kyc: [
      { type: "PASSPORT", label: "Passport", providerCode: "PASSPORT", identity: true },
      { type: "DRIVERS_LICENSE", label: "Driving licence", providerCode: "DRIVERS", identity: true },
    ],
    kyb: [{ type: "BUSINESS_REGISTRATION", label: "Companies House certificate", providerCode: "COMPANY_DOC" }],
  },
  {
    code: "KE",
    displayName: "Kenya",
    kyc: [
      { type: "NATIONAL_ID", label: "Huduma / national ID", providerCode: "ID_CARD", identity: true },
      { type: "PASSPORT", label: "Passport", providerCode: "PASSPORT", identity: true },
    ],
    kyb: [{ type: "BUSINESS_REGISTRATION", label: "Certificate of incorporation", providerCode: "COMPANY_DOC" }],
  },
] as const;

async function main(): Promise<void> {
  // Single-row commercial config; defaults match DEFAULT_PRICING in @myidx/shared.
  await prisma.pricingConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      create: { code: country.code, displayName: country.displayName, enabled: true },
      update: { displayName: country.displayName, enabled: true },
    });

    for (const doc of country.kyc) {
      await prisma.countryIdType.upsert({
        where: {
          countryCode_type_scope: {
            countryCode: country.code,
            type: doc.type,
            scope: "KYC",
          },
        },
        create: {
          countryCode: country.code,
          type: doc.type,
          scope: "KYC",
          label: doc.label,
          providerCode: doc.providerCode,
          numberPattern: "numberPattern" in doc ? doc.numberPattern : undefined,
          sufficientForIdentity: "identity" in doc ? doc.identity : false,
        },
        update: { label: doc.label, providerCode: doc.providerCode },
      });
    }

    for (const doc of country.kyb) {
      await prisma.countryIdType.upsert({
        where: {
          countryCode_type_scope: {
            countryCode: country.code,
            type: doc.type,
            scope: "KYB",
          },
        },
        create: {
          countryCode: country.code,
          type: doc.type,
          scope: "KYB",
          label: doc.label,
          providerCode: doc.providerCode,
        },
        update: { label: doc.label, providerCode: doc.providerCode },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
