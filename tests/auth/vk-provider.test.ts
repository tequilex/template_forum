import { describe, it, expect } from "vitest";
import VK, { type VKProfile } from "@/lib/auth/providers/vk";

describe("VK provider", () => {
  const provider = VK({ clientId: "x", clientSecret: "y" });

  it("identifies as 'vk' OAuth", () => {
    expect(provider.id).toBe("vk");
    expect(provider.type).toBe("oauth");
    expect(provider.name).toBe("VK");
  });

  const stubTokens = {} as Parameters<NonNullable<typeof provider.profile>>[1];

  it("maps profile with full payload", () => {
    const raw: VKProfile = {
      user_id: "12345",
      email: "user@example.com",
      first_name: "Иван",
      last_name: "Петров",
      avatar: "https://vk.com/avatar.jpg",
    };
    const mapped = provider.profile!(raw, stubTokens);
    expect(mapped).toEqual({
      id: "12345",
      name: "Иван Петров",
      email: "user@example.com",
      image: "https://vk.com/avatar.jpg",
    });
  });

  it("maps profile when email and avatar are missing", () => {
    const raw: VKProfile = { user_id: "9", first_name: "A", last_name: "B" };
    const mapped = provider.profile!(raw, stubTokens);
    expect(mapped.id).toBe("9");
    expect(mapped.name).toBe("A B");
    expect(mapped.email).toBeNull();
    expect(mapped.image).toBeNull();
  });

  it("requests email scope", () => {
    const auth = provider.authorization;
    const params = typeof auth === "string" ? undefined : auth?.params;
    expect(params?.scope).toContain("email");
  });
});
