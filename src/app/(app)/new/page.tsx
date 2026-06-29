import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAuthState, requireOwnPost } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { tags, postTags } from "@db/schema";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

type SearchParams = { id?: string };

// /new?id={postId} — после первого save мы делаем history.replaceState
// в этот URL, чтобы refresh в середине сессии не терял пользовательский
// драфт. Та же страница, тот же route-сегмент → server action auto-refresh
// не пересоздаёт инстанс редактора (в отличие от /edit/[id]).
export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAuthState();
  if (!session) redirect("/login");

  const { id } = await searchParams;
  const db = getDb();

  if (id) {
    const post = await requireOwnPost(id);
    const [availableTags, currentTagIds] = await Promise.all([
      db.select().from(tags).orderBy(tags.name),
      db.select({ tagId: postTags.tagId }).from(postTags).where(eq(postTags.postId, id)).then(rs => rs.map(r => r.tagId)),
    ]);
    return (
      <EditorClient
        initialPostId={post.id}
        initialTitle={post.title}
        initialContent={post.content as never}
        initialTagIds={currentTagIds}
        status={post.status as "draft" | "published" | "archived"}
        availableTags={availableTags}
      />
    );
  }

  // TODO(plan-05): когда тэгов станет больше — unstable_cache с инвалидацией при insert.
  const availableTags = await db.select().from(tags).orderBy(tags.name);

  return (
    <EditorClient
      initialPostId={null}
      initialTitle=""
      initialContent={{ blocks: [] }}
      initialTagIds={[]}
      status="draft"
      availableTags={availableTags}
    />
  );
}
