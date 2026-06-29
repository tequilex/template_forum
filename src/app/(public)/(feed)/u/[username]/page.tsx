import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content } from "@theme/content";
import { siteConfig } from "@/lib/site-config";
import { auth } from "@/lib/auth";
import { PostList } from "@/components/feed/PostList";
import { UserProfileHeader } from "@/components/profile/UserProfileHeader";
import {
  getUserByUsername,
  getUserProfile,
  getUserFeedPage,
} from "@/server/feed";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbJsonLd } from "@/lib/jsonld";
import { getEnv } from "@/lib/env";

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
  if (!user || !user.username) notFound();

  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  // Заблокированных пользователей публично прячем (404), но админ должен иметь
  // доступ к профилю — иначе разблокировать можно только через прямой SQL.
  if (user.bannedAt && !isAdmin) notFound();

  const [{ postsCount, topTags }, { items, currentPage, totalPages }] = await Promise.all([
    getUserProfile(user.id),
    getUserFeedPage(user.id, page),
  ]);

  if (page > totalPages && items.length === 0 && totalPages > 0) {
    notFound();
  }

  const isOwner = session?.user?.id === user.id;
  const siteUrl = getEnv().NEXTAUTH_URL.replace(/\/$/, "");

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Главная", url: `${siteUrl}/` },
          { name: `@${user.username}`, url: `${siteUrl}/u/${user.username}` },
        ])}
      />
      <UserProfileHeader
        userId={user.id}
        username={user.username}
        name={user.name}
        image={user.image}
        bio={user.bio}
        postsCount={postsCount}
        registeredAt={user.createdAt}
        topTags={topTags}
        isOwner={isOwner}
        isAdmin={isAdmin}
        isBanned={user.bannedAt != null}
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
