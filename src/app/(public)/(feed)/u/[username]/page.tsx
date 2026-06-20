import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content } from "@theme/content";
import { siteConfig } from "@/lib/site-config";
import { PostList } from "@/components/feed/PostList";
import { UserProfileHeader } from "@/components/profile/UserProfileHeader";
import {
  getUserByUsername,
  getUserProfile,
  getUserFeedPage,
} from "@/server/feed";

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return {};
  return {
    title: `${user.name ?? user.username} — ${siteConfig.name}`,
    description: user.bio ?? `Посты автора @${user.username}`,
  };
}

export default async function UserProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const user = await getUserByUsername(username);
  if (!user || !user.username || user.bannedAt) notFound();

  const [{ postsCount, topTags }, { items, currentPage, totalPages }] = await Promise.all([
    getUserProfile(user.id),
    getUserFeedPage(user.id, page),
  ]);

  if (page > totalPages && items.length === 0 && totalPages > 0) {
    notFound();
  }

  return (
    <>
      <UserProfileHeader
        username={user.username}
        name={user.name}
        image={user.image}
        bio={user.bio}
        postsCount={postsCount}
        registeredAt={user.createdAt}
        topTags={topTags}
      />
      <PostList
        items={items}
        basePath={`/u/${user.username}`}
        currentPage={currentPage}
        totalPages={totalPages}
        emptyMessage={content.empty.userFeed}
      />
    </>
  );
}
