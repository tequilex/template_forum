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

type Params = { id: string };

export default async function EditPostPage({ params }: { params: Promise<Params> }) {
  const session = await requireAuthState();
  if (!session) redirect("/login");

  const { id } = await params;
  const post = await requireOwnPost(id);

  const db = getDb();
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
