import { z } from "zod";
import { RESERVED_USERNAMES, USERNAME_PATTERN } from "./constants.js";
import { IdentityScope } from "./types/identity.js";

export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code");

export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(USERNAME_PATTERN, "lowercase letters, digits, hyphen or underscore")
  .refine((v) => !RESERVED_USERNAMES.has(v), { message: "username is reserved" });

export const passwordSchema = z
  .string()
  .min(12, "must be at least 12 characters")
  .regex(/[a-z]/, "must contain a lowercase letter")
  .regex(/[A-Z]/, "must contain an uppercase letter")
  .regex(/[0-9]/, "must contain a digit");

export const userRegistrationSchema = z.object({
  username: usernameSchema,
  email: z.string().email(),
  password: passwordSchema,
  country: countryCodeSchema,
});

export const merchantRegistrationSchema = z.object({
  legalName: z.string().min(2).max(200),
  tradingName: z.string().min(2).max(200).optional(),
  country: countryCodeSchema,
  supportEmail: z.string().email(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Present on the second leg of an MFA challenge. */
  otp: z.string().length(6).optional(),
});

export const oauthAuthorizeSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  response_type: z.literal("code"),
  scope: z.string().min(1),
  state: z.string().min(1),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
});

export const scopeListSchema = z
  .string()
  .transform((s) => s.split(/[\s,]+/).filter(Boolean))
  .pipe(z.array(z.nativeEnum(IdentityScope)).min(1));

export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type MerchantRegistrationInput = z.infer<typeof merchantRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OAuthAuthorizeInput = z.infer<typeof oauthAuthorizeSchema>;
