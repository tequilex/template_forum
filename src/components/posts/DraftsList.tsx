import Link from "next/link";
import type { Route } from "next";
import { content } from "@theme/content";

type Item = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "archived" | "published";
  updatedAt: Date;
  coverUrl: string | null;
  hiddenByAdminAt: Date | null;
};

type Props = {
  items: Item[];
  activeTab: "drafts" | "archived";
};

export function DraftsList({ items, activeTab }: Props) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl mb-6">Мои тексты</h1>
      <div className="flex gap-2 mb-6 border-b border-border">
        <TabLink href={{ pathname: "/drafts" }} active={activeTab === "drafts"}>Черновики</TabLink>
        <TabLink href={{ pathname: "/drafts", query: { tab: "archived" } }} active={activeTab === "archived"}>Архив</TabLink>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {activeTab === "drafts" ? "Черновиков пока нет." : "Архив пуст."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(item => {
            // Скрытый админом пост нельзя редактировать (requireOwnPost
            // фильтрует по hiddenByAdminAt IS NULL). Ведём автора на просмотр
            // с плашкой — иначе клик из списка приводит в 404.
            const href = (item.hiddenByAdminAt ? `/p/${item.slug}` : `/edit/${item.id}`) as Route;
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  className="block rounded-md border border-border p-4 hover:bg-accent transition"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{item.title || "(без названия)"}</p>
                    {item.hiddenByAdminAt && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">
                        {content.moderation.hiddenByAdmin}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    обновлено {item.updatedAt.toLocaleString("ru-RU")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type LinkHref = React.ComponentProps<typeof Link>["href"];

function TabLink({ href, active, children }: { href: LinkHref; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm border-b-2 -mb-px ${
        active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
