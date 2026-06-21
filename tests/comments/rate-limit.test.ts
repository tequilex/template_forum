import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkLimit, _resetForTests } from "@/lib/rate-limit";

describe("checkLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetForTests();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("gap: два вызова подряд → второй блок", () => {
    expect(checkLimit("u1", "comment").ok).toBe(true);
    const r = checkLimit("u1", "comment");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("gap-разрешение после wait", () => {
    expect(checkLimit("u2", "comment").ok).toBe(true);
    vi.advanceTimersByTime(11_000);
    expect(checkLimit("u2", "comment").ok).toBe(true);
  });

  it("окно: 20 успешных за час, 21-й — блок", () => {
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(11_000);
      expect(checkLimit("u3", "comment").ok).toBe(true);
    }
    vi.advanceTimersByTime(11_000);
    expect(checkLimit("u3", "comment").ok).toBe(false);
  });
});
