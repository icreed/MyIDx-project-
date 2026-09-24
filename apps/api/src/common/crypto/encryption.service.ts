import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Envelope encryption for vault data.
 *
 * Each user gets a random 32-byte data key. That key is sealed under a key
 * derived from ENCRYPTION_MASTER_KEY via HKDF with the user id as info, so one
 * user's ciphertext cannot be decrypted with another user's sealed key even if
 * rows are swapped. Sensitive columns are then encrypted with the user's data
 * key, meaning a key rotation re-wraps data keys rather than rewriting every row.
 */
@Injectable()
export class EncryptionService {
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>("crypto.masterKey");
    if (!raw) throw new Error("ENCRYPTION_MASTER_KEY is not configured");
    this.masterKey = Buffer.from(raw, "base64");
    if (this.masterKey.length !== 32) {
      throw new Error("ENCRYPTION_MASTER_KEY must decode to exactly 32 bytes");
    }
  }

  /** Mints a new per-user data key, returned sealed for storage. */
  createUserDataKey(userId: string): { dataKey: Buffer; sealed: string } {
    const dataKey = randomBytes(32);
    return { dataKey, sealed: this.seal(dataKey, this.wrappingKey(userId)) };
  }

  unsealUserDataKey(userId: string, sealed: string): Buffer {
    return this.open(sealed, this.wrappingKey(userId));
  }

  /** Encrypts a sensitive value with the user's data key. */
  encryptForUser(plaintext: string, dataKey: Buffer): string {
    return this.seal(Buffer.from(plaintext, "utf8"), dataKey);
  }

  decryptForUser(payload: string, dataKey: Buffer): string {
    return this.open(payload, dataKey).toString("utf8");
  }

  /** Masks a document number down to the last four characters. */
  static mask(value: string): string {
    const tail = value.slice(-4);
    return tail.padStart(Math.min(value.length, 12), "•");
  }

  static constantTimeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /** Derives the per-user wrapping key. Binding to userId is what isolates users. */
  private wrappingKey(userId: string): Buffer {
    return Buffer.from(
      hkdfSync("sha256", this.masterKey, Buffer.from("myidx-vault"), Buffer.from(userId), 32),
    );
  }

  /** iv:tag:ciphertext, each base64. */
  private seal(plaintext: Buffer, key: Buffer): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return [
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      ciphertext.toString("base64"),
    ].join(":");
  }

  private open(payload: string, key: Buffer): Buffer {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed ciphertext");
    const tag = Buffer.from(tagB64, "base64");
    if (tag.length !== TAG_BYTES) throw new Error("malformed auth tag");
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  }
}
