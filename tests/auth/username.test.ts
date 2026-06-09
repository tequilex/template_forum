import { describe, it, expect } from "vitest";
import { validateUsername, RESERVED_USERNAMES } from "@/lib/auth/username";

describe("validateUsername", () => {
  it.each([
    ["alex", true],
    ["alex_92", true],
    ["a-b-c", true],
    ["abc", true],
    ["abcdefghij1234567890", true],
  ])("accepts valid: %s", (input, ok) => {
    expect(validateUsername(input).ok).toBe(ok);
  });

  it.each([
    "ab",
    "abcdefghij12345678901",
    "Alex",
    "alex.dot",
    "alex space",
    "лёша",
    "",
  ])("rejects invalid format: %s", (input) => {
    const r = validateUsername(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("format");
  });

  it("rejects reserved usernames", () => {
    for (const r of RESERVED_USERNAMES) {
      const result = validateUsername(r);
      expect(result.ok, `expected ${r} to be reserved`).toBe(false);
      if (!result.ok) expect(result.reason).toBe("reserved");
    }
  });

  it("RESERVED_USERNAMES is non-empty and contains expected entries", () => {
    expect(RESERVED_USERNAMES.length).toBeGreaterThanOrEqual(10);
    expect(RESERVED_USERNAMES).toEqual(expect.arrayContaining([
      "admin", "root", "api", "login", "logout", "welcome", "settings", "moderator",
    ]));
  });
});
