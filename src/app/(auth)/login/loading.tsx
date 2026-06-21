import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { content } from "@theme/content";

// Suspense-fallback для /login: Next.js показывает его сразу после клика по
// ссылке, пока RSC `LoginPage` блокирует на `await auth()`. Геометрия и
// back-link дублируют page.tsx — чтобы между фолбэком и реальной формой не
// было визуальных скачков.
export default function LoginLoading() {
  return (
    <main className="container mx-auto flex min-h-[calc(100vh-14rem)] max-w-md flex-col items-center justify-center px-4 py-12">
      <div className="w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {content.auth.backToHome}
        </Link>
        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl text-center mb-2">{content.auth.loginTitle}</h1>
          <p className="text-muted-foreground text-center mb-8">{content.auth.loginSubtitle}</p>
          <div className="space-y-3" aria-hidden="true">
            <div className="h-11 rounded-md bg-muted animate-pulse" />
            <div className="h-11 rounded-md bg-muted animate-pulse" />
            <div className="h-11 rounded-md bg-muted animate-pulse" />
            <div className="h-11 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}
