import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().refine(s => s.startsWith("postgres://") || s.startsWith("postgresql://"), {
    message: "DATABASE_URL must be a Postgres connection string",
  }),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be ≥32 chars"),

  YANDEX_CLIENT_ID: z.string().min(1).optional(),
  YANDEX_CLIENT_SECRET: z.string().min(1).optional(),
  VK_CLIENT_ID: z.string().min(1).optional(),
  VK_CLIENT_SECRET: z.string().min(1).optional(),

  R2_ENDPOINT:          z.string().url().optional(),
  R2_BUCKET:            z.string().min(1).optional(),
  R2_ACCESS_KEY_ID:     z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_PUBLIC_BASE:       z.string().url().optional(),
}).superRefine((v, ctx) => {
  for (const p of ["YANDEX", "VK"] as const) {
    const id = (v as Record<string, string | undefined>)[`${p}_CLIENT_ID`];
    const sec = (v as Record<string, string | undefined>)[`${p}_CLIENT_SECRET`];
    if (!!id !== !!sec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [`${p}_CLIENT_SECRET`],
        message: `${p}_CLIENT_ID and ${p}_CLIENT_SECRET must be set together`,
      });
    }
  }

  const r2Keys = [
    "R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE",
  ] as const;
  const r2Presence = r2Keys.map(k => Boolean((v as Record<string, string | undefined>)[k]));
  const r2All = r2Presence.every(Boolean);
  const r2None = r2Presence.every(p => !p);
  if (!r2All && !r2None) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["R2_BUCKET"],
      message: "R2_* env vars must be all set or all empty",
    });
  }
});

export type Env = z.infer<typeof schema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid env: " + result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return result.data;
}

let cached: Env | null = null;
export function getEnv(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env);
  return cached;
}

export function _resetEnvCacheForTests(): void {
  cached = null;
}
