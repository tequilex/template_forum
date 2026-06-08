import { describe, it, expect, vi } from "vitest";
import { checkHealth } from "../src/app/api/health/check";

describe("health check", () => {
  it("returns ok when db query succeeds", async () => {
    const fakeDb = { execute: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) };
    const result = await checkHealth(fakeDb as never);
    expect(result.status).toBe("ok");
    expect(result.db).toBe("ok");
  });

  it("returns degraded when db query fails", async () => {
    const fakeDb = { execute: vi.fn().mockRejectedValue(new Error("conn refused")) };
    const result = await checkHealth(fakeDb as never);
    expect(result.status).toBe("degraded");
    expect(result.db).toBe("error");
  });
});
