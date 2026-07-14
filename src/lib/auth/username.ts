export const RESERVED_USERNAMES = [
  "admin", "administrator", "root", "moderator", "mod",
  "api", "auth", "login", "logout", "welcome", "settings",
  "new", "edit", "p", "u", "t", "tag", "tags",
  "about", "rules", "contacts", "help", "support",
  "null", "undefined", "system", "skelet", "foxgeek",
] as const;

const FORMAT = /^[a-z0-9_-]{3,20}$/;

export type UsernameValidation =
  | { ok: true }
  | { ok: false; reason: "format" | "reserved" };

export function validateUsername(input: string): UsernameValidation {
  if ((RESERVED_USERNAMES as readonly string[]).includes(input)) return { ok: false, reason: "reserved" };
  if (!FORMAT.test(input)) return { ok: false, reason: "format" };
  return { ok: true };
}
