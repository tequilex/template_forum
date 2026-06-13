import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Page-level guard. Page-компонент гарантированно перерендеривается на любой
// навигации (Link, прямой URL, refresh). Layout/template — нет (Next кэширует
// shared-сегменты), поэтому проверка должна жить в самих страницах.
export async function requireAuthState() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.bannedAt) redirect("/api/auth/ban-kill");
  if (!session.user.username) redirect("/welcome");
  return session;
}
