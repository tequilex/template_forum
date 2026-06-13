import { describe, it, expect } from "vitest";
import { users, accounts, sessions, verificationTokens, userRole } from "@db/schema";

describe("auth schema shape", () => {
  it("exports users table with required columns", () => {
    const cols = Object.keys(users);
    expect(cols).toEqual(expect.arrayContaining([
      "id", "email", "emailVerified", "username", "name", "image", "bio", "role", "createdAt", "bannedAt",
    ]));
  });

  it("exports accounts table with composite-PK columns", () => {
    const cols = Object.keys(accounts);
    expect(cols).toEqual(expect.arrayContaining([
      "userId", "type", "provider", "providerAccountId",
      "refresh_token", "access_token", "expires_at",
      "token_type", "scope", "id_token", "session_state",
    ]));
  });

  it("exports sessions table", () => {
    const cols = Object.keys(sessions);
    expect(cols).toEqual(expect.arrayContaining(["sessionToken", "userId", "expires"]));
  });

  it("exports verificationTokens table", () => {
    const cols = Object.keys(verificationTokens);
    expect(cols).toEqual(expect.arrayContaining(["identifier", "token", "expires"]));
  });

  it("exports userRole enum with 3 values", () => {
    expect(userRole.enumValues).toEqual(["user", "moderator", "admin"]);
  });
});
