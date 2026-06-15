import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireAuthState } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { posts } from "@db/schema";

// Dev-only DoD-навигатор. Не для прода — гейтится по NODE_ENV.
export const dynamic = "force-dynamic";

export default async function DevRoutesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const session = await requireAuthState();
  if (!session) redirect("/login");

  const myPosts = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      deletedAt: posts.deletedAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.authorId, session.user.id))
    .orderBy(desc(posts.updatedAt))
    .limit(20);

  const username = session.user.username;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <header>
        <h1 className="font-display text-2xl mb-1">DoD-навигатор</h1>
        <p className="text-sm text-muted-foreground">
          Вошёл как @{username ?? "—"} (id: <code>{session.user.id}</code>). Страница доступна только в dev.
        </p>
      </header>

      <section>
        <h2 className="font-display text-lg mb-3">Базовые роуты</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <Tile href="/" label="/" hint="Главная" />
          <Tile href="/new" label="/new" hint="Создать пост" />
          <Tile href="/drafts" label="/drafts" hint="Мои черновики" />
          <Tile href="/drafts?tab=archived" label="/drafts?tab=archived" hint="Архив" />
          {username && <Tile href={`/u/${username}`} label={`/u/${username}`} hint="Мой профиль" />}
          <Tile href="/welcome" label="/welcome" hint="Onboarding" />
          <Tile href="/login" label="/login" hint="Логин" />
          <Tile href="/api/health" label="/api/health" hint="Health-check" />
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">Мои посты (последние 20)</h2>
        {myPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Постов нет. Открой <a className="underline" href="/new">/new</a> и создай первый.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-md">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium">Edit</th>
                  <th className="px-3 py-2 font-medium">Public</th>
                </tr>
              </thead>
              <tbody>
                {myPosts.map(p => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      {p.title || <span className="text-muted-foreground italic">(без названия)</span>}
                      {p.deletedAt && <span className="ml-2 text-xs text-destructive">deleted</span>}
                    </td>
                    <td className="px-3 py-2"><code>{p.status}</code></td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {p.updatedAt.toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2">
                      <a className="underline" href={`/edit/${p.id}`}>/edit/{p.id.slice(0, 8)}…</a>
                    </td>
                    <td className="px-3 py-2">
                      <a className="underline" href={`/p/${p.slug}`}>/p/{p.slug}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="text-sm text-muted-foreground">
        <h2 className="font-display text-lg mb-3 text-foreground">12 шагов e2e DoD (Task 14.4)</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>/new → title «Опыт работы» + все 7 типов блоков → автосейв → виден в /drafts.</li>
          <li>/drafts → клик → /edit/[id] → данные загрузились → 2 тэга → «Опубликовать» → /p/&lt;slug&gt;.</li>
          <li>Incognito /p/&lt;slug&gt; → 200.</li>
          <li>view-source → og:image = URL обложки.</li>
          <li><code>pnpm db:studio</code> → uploads.post_id = ID поста.</li>
          <li>/edit/[id] → меняем title → slug НЕ меняется (фиксированный).</li>
          <li>Архивировать → confirm → /drafts?tab=archived → /p/&lt;slug&gt; в incognito 404.</li>
          <li>/edit/[id] из архива → «Разархивировать» → /p/&lt;slug&gt; всем 200.</li>
          <li>«Удалить» → typed «удалить» → /drafts → /p/&lt;slug&gt; показывает «Пост удалён».</li>
          <li>Чужой /edit/&lt;id&gt; → 404.</li>
          <li>/new без title → «Опубликовать» → ошибка «Заголовок не может быть пустым».</li>
          <li>/new без тэгов → «Опубликовать» → ошибка «Выбери минимум 1 тэг».</li>
        </ol>
      </section>
    </main>
  );
}

function Tile({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <li>
      <a
        href={href}
        className="block rounded-md border border-border px-3 py-2 hover:bg-accent transition"
      >
        <div className="font-mono text-xs">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </a>
    </li>
  );
}
