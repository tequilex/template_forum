// Suspense-fallback для /drafts (auth-only ветка того же feed-shell'а).
// Дублирует геометрию (public)/(feed)/loading.tsx: и драфты, и публичная лента
// рендерят одинаковый PostCard, поэтому скелетон один и тот же.
export default function AppFeedLoading() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <article key={i} className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="aspect-[16/9] w-full bg-muted animate-pulse" />
          <div className="p-4 lg:p-5 space-y-3">
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            <div className="flex items-center gap-2 pt-1">
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-40 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
