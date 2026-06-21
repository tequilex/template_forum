import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function assertAdmin(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/");
  }
  return { userId: session.user.id };
}
