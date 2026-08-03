import { describe, it, expect } from "vitest";
import { describeUserAgent } from "@/lib/user-agent";

describe("describeUserAgent", () => {
  it("returns a fallback for null/empty", () => {
    expect(describeUserAgent(null)).toBe("מכשיר לא ידוע");
  });

  it("detects iPhone Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(describeUserAgent(ua)).toBe("Safari · iPhone");
  });

  it("detects Chrome on iPhone (CriOS) — not Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0 Mobile/15E148 Safari/604.1";
    expect(describeUserAgent(ua)).toBe("Chrome · iPhone");
  });

  it("detects Chrome on Mac", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    expect(describeUserAgent(ua)).toBe("Chrome · Mac");
  });

  it("detects Chrome on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
    expect(describeUserAgent(ua)).toBe("Chrome · Android");
  });

  it("detects Edge on Windows (not Chrome)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0";
    expect(describeUserAgent(ua)).toBe("Edge · Windows");
  });

  it("detects Firefox on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";
    expect(describeUserAgent(ua)).toBe("Firefox · Windows");
  });
});
