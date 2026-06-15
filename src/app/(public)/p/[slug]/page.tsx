import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { posts, users, postTags, tags } from "@db/schema";
import { PostBody } from "@/components/posts/PostBody";
import { PostHero } from "@/components/posts/PostHero";
import { PostTags } from "@/components/posts/PostTags";

export const dynamic = "force-dynamic";

type Params = { slug: string };

async function loadPost(slug: string) {
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
      authorUsername: users.username,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
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

export default async function PostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === post.authorId;

  if (post.deletedAt) {
    // TODO(plan-06): true 410 status code via route handler (требует разнесения
    // логики между page.tsx и route.ts). В plan-04 — JSX-разметка "удалён";
    // для индексаторов хватает meta:noindex (нет в sitemap).
    return (
      <main className="container mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl mb-3">Пост удалён</h1>
        <p className="text-muted-foreground">Эта запись была удалена автором.</p>
      </main>
    );
  }

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
      <PostBody html={html} />
      <PostTags tags={postTagsList} />
    </article>
  );
}
