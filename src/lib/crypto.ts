import crypto from "crypto";

/**
 * Symmetric encryption for secrets stored at rest (OAuth access/refresh tokens).
 *
 * Key: derived (SHA-256 -> 32 bytes) from a secret. Default is
 * GOOGLE_CLIENT_SECRET because it is guaranteed identical across every
 * environment that shares this database (local + Render use the same Google
 * OAuth client), so both sides can always decrypt what the other wrote —
 * without any extra configuration. An explicit TOKEN_ENCRYPTION_KEY overrides
 * it, but must then be set to the SAME value everywhere.
 *
 * Format: `enc:v1:<iv>:<authTag>:<ciphertext>` (all base64). The version prefix
 * lets `decryptToken` transparently pass through legacy plaintext values, so
 * existing rows keep working until they're migrated/rewritten.
 */
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "insecure-dev-key";
  return crypto.createHash("sha256").update(secret).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/**
 * Decrypts a value produced by encryptToken. Returns legacy plaintext unchanged
 * (backward compatibility) and null if a value looks encrypted but fails to
 * decrypt (tampered / wrong key).
 */
export function decryptToken(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
