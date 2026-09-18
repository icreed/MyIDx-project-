import { z } from "zod";

/**
 * Fail fast on boot rather than at first request. A missing encryption key or
 * JWT secret is a deployment error, not something to default quietly.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  // 32 bytes, base64. Root of the per-user key derivation for vault data.
  ENCRYPTION_MASTER_KEY: z.string().min(44),
  TOTP_ISSUER: z.string().default("MyIDx"),

  SUMSUB_BASE_URL: z.string().url().default("https://api.sumsub.com"),
  SUMSUB_APP_TOKEN: z.string().optional(),
  SUMSUB_SECRET_KEY: z.string().optional(),
  SUMSUB_WEBHOOK_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),

  OAUTH_ISSUER_URL: z.string().url().default("http://localhost:4000"),
  OAUTH_AUTH_CODE_TTL: z.coerce.number().default(600),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const configuration = () => ({
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? 4000),
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  },
  crypto: { masterKey: process.env.ENCRYPTION_MASTER_KEY },
  sumsub: {
    baseUrl: process.env.SUMSUB_BASE_URL,
    appToken: process.env.SUMSUB_APP_TOKEN,
    secretKey: process.env.SUMSUB_SECRET_KEY,
    webhookSecret: process.env.SUMSUB_WEBHOOK_SECRET,
  },
  oauth: {
    issuer: process.env.OAUTH_ISSUER_URL,
    codeTtl: Number(process.env.OAUTH_AUTH_CODE_TTL ?? 600),
  },
});
