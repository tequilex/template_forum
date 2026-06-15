import { redirect } from "next/navigation";
import { requireAuthState } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { tags } from "@db/schema";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const session = await requireAuthState();
  if (!session) redirect("/login");

  // TODO(plan-05): когда тэгов станет больше — unstable_cache с инвалидацией при insert.
  const availableTags = await getDb().select().from(tags).orderBy(tags.name);

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
