import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuthState } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { posts } from "@db/schema";
import { DraftsList } from "@/components/posts/DraftsList";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };

export default async function DraftsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAuthState();
  if (!session) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "archived" ? "archived" : "drafts";
  const targetStatus = activeTab === "archived" ? "archived" : "draft";

  const items = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      updatedAt: posts.updatedAt,
      coverUrl: posts.coverUrl,
    })
    .from(posts)
    .where(and(
      eq(posts.authorId, session.user.id),
      isNull(posts.deletedAt),
      eq(posts.status, targetStatus),
    ))
    .orderBy(desc(posts.updatedAt));

  return <DraftsList items={items as never} activeTab={activeTab} />;
}
