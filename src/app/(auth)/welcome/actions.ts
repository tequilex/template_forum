"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@db/schema";
import { validateUsername } from "@/lib/auth/username";

export async function setUsername(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const raw = String(formData.get("username") ?? "").trim().toLowerCase();
  const validation = validateUsername(raw);
  if (!validation.ok) redirect(`/welcome?err=${validation.reason}`);

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, raw));

  if (existing.length > 0 && existing[0].id !== session.user.id) {
    redirect("/welcome?err=taken");
  }

  await db.update(users).set({ username: raw }).where(eq(users.id, session.user.id));
  redirect("/");
}
