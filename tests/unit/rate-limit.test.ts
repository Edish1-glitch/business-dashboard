import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows up to max, then blocks with a retry hint", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k1", 3, 1000).ok).toBe(true);
    const blocked = rateLimit("k1", 3, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("resets after the window passes", () => {
    for (let i = 0; i < 3; i++) rateLimit("k2", 3, 1000);
    expect(rateLimit("k2", 3, 1000).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("k2", 3, 1000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1000);
    expect(rateLimit("a", 3, 1000).ok).toBe(false);
    expect(rateLimit("b", 3, 1000).ok).toBe(true);
  });
});
