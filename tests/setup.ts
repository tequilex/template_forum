import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV ??= "test";
env.DATABASE_URL ??= "postgres://app:test@localhost:5432/app";
env.NEXTAUTH_URL ??= "http://localhost:3000";
env.NEXTAUTH_SECRET ??= "x".repeat(32);
