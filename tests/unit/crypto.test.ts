import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, isEncrypted } from "@/lib/crypto";

// Protects OAuth tokens at rest. A broken roundtrip would lock users out of
// Gmail; a broken passthrough would break existing (pre-encryption) rows.
describe("token encryption", () => {
  it("round-trips a value", () => {
    const secret = "ya29.some-access-token-value";
    const enc = encryptToken(secret);
    expect(enc).not.toBe(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptToken(enc)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("passes legacy plaintext through unchanged (backward compatible)", () => {
    expect(isEncrypted("1//legacy-refresh-token")).toBe(false);
    expect(decryptToken("1//legacy-refresh-token")).toBe("1//legacy-refresh-token");
  });

  it("handles null/undefined safely", () => {
    expect(decryptToken(null)).toBeNull();
    expect(decryptToken(undefined)).toBeNull();
  });

  it("returns null for a tampered ciphertext", () => {
    const enc = encryptToken("secret");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(decryptToken(tampered)).toBeNull();
  });
});
