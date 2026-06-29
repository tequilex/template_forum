import { redirect } from "next/navigation";
import { and, desc, eq, isNull, isNotNull, or } from "drizzle-orm";
import { requireAuthState } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { posts } from "@db/schema";
import { DraftsList } from "@/components/posts/DraftsList";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

type SearchParams = { tab?: string };

export default async function DraftsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAuthState();
  if (!session) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "archived" ? "archived" : "drafts";
  // Скрытые админом published-посты автор видит в табе «Черновики» с плашкой —
  // иначе им негде проявиться в UI (публично 404, в архив их не передвинули).
  const statusCondition = activeTab === "archived"
    ? eq(posts.status, "archived")
    : or(eq(posts.status, "draft"), isNotNull(posts.hiddenByAdminAt));

  const items = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      updatedAt: posts.updatedAt,
      coverUrl: posts.coverUrl,
      hiddenByAdminAt: posts.hiddenByAdminAt,
    })
    .from(posts)
    .where(and(
      eq(posts.authorId, session.user.id),
      isNull(posts.deletedAt),
      statusCondition,
    ))
    .orderBy(desc(posts.updatedAt));

  return <DraftsList items={items as never} activeTab={activeTab} />;
}
