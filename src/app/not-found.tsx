import Link from "next/link";
import { requireAuthState } from "@/lib/auth/guard";

export default async function NotFound() {
  await requireAuthState();
  return (
    <main className="container mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-4xl mb-2">404</h1>
      <p className="text-muted-foreground mb-6">Страница не найдена</p>
      <Link href="/" className="text-primary underline">На главную</Link>
    </main>
  );
}
