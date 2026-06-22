import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { posts, users, postTags, tags } from "@db/schema";
import { PostBody } from "@/components/posts/PostBody";
import { PostHero } from "@/components/posts/PostHero";
import { PostTags } from "@/components/posts/PostTags";
import { CommentThread } from "@/components/comments/CommentThread";
import { PostAdminMenu } from "@/components/moderation/PostAdminMenu";
import { content } from "@theme/content";

export const dynamic = "force-dynamic";

type Params = { slug: string };

async function loadPost(slug: string) {
  const hiddenBy = alias(users, "hidden_by_user");
  const rows = await getDb()
    .select({
      id: posts.id,
      authorId: posts.authorId,
      title: posts.title,
      slug: posts.slug,
      contentHtml: posts.contentHtml,
      coverUrl: posts.coverUrl,
      status: posts.status,
      pubAt: posts.pubAt,
      deletedAt: posts.deletedAt,
      hiddenByAdminAt: posts.hiddenByAdminAt,
      hiddenByAdminUsername: hiddenBy.username,
      authorUsername: users.username,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(hiddenBy, eq(hiddenBy.id, posts.hiddenByAdminId))
    .where(eq(posts.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

async function loadTags(postId: string) {
  const rows = await getDb()
    .select({ id: tags.id, slug: tags.slug, name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId));
  return rows;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return {};
  if (post.deletedAt) return {};
  if (post.hiddenByAdminAt) return {};
  if (post.status === "draft") return {};
  return {
    title: post.title,
    description: post.title,
    openGraph: {
      title: post.title,
      images: post.coverUrl ? [{ url: post.coverUrl }] : undefined,
    },
  };
}

export default async function PostPage({
  params, searchParams,
}: { params: Promise<Params>; searchParams: Promise<{ cpage?: string }> }) {
  const { slug } = await params;
  const { cpage } = await searchParams;
  const post = await loadPost(slug);
  if (!post) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === post.authorId;
  const isAdmin = session?.user?.role === "admin";

  if (post.deletedAt) notFound();
  // Скрытый админом пост: автор тоже должен иметь возможность открыть и увидеть
  // плашку (иначе из /drafts ведёт в 404). Публично — по-прежнему 404.
  if (post.hiddenByAdminAt && !isAdmin && !isOwner) notFound();
  if (post.status === "draft") notFound();
  if (post.status === "archived" && !isOwner) notFound();

  const html = post.contentHtml ?? "";
  const postTagsList = await loadTags(post.id);

  return (
    <article>
      <PostHero
        title={post.title}
        coverUrl={post.coverUrl}
        authorUsername={post.authorUsername}
        pubAt={post.pubAt}
      />
      {post.status === "archived" && (
        <p className="max-w-[680px] mx-auto px-4 mt-4 text-sm text-muted-foreground italic">
          (Пост в архиве — виден только тебе.)
        </p>
      )}
      {post.hiddenByAdminAt && (isOwner || isAdmin) && (
        <div className="max-w-[680px] mx-auto px-4 mt-4">
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {isAdmin
              ? (post.hiddenByAdminUsername
                  ? content.moderation.hiddenBannerAdmin(post.hiddenByAdminUsername)
                  : content.moderation.hiddenBannerAdminUnknown)
              : content.moderation.hiddenBannerOwner}
          </p>
        </div>
      )}
      {isAdmin && (
        <div className="max-w-[680px] mx-auto px-4 mt-4 flex justify-end">
          <PostAdminMenu
            postId={post.id}
            authorId={post.authorId}
            isHidden={post.hiddenByAdminAt != null}
          />
        </div>
      )}
      <PostBody html={html} />
      <PostTags tags={postTagsList} />
      <div className="max-w-[680px] mx-auto px-4">
        <CommentThread
          postId={post.id}
          postSlug={post.slug}
          page={Number(cpage ?? "1") || 1}
        />
      </div>
    </article>
  );
}
