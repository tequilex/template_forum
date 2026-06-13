import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@db/schema";
import { requireAuthState } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await requireAuthState();
  const { username } = await params;
  const lower = username.toLowerCase();

  const db = getDb();
  const rows = await db
    .select({
      username: users.username,
      name: users.name,
      image: users.image,
      bio: users.bio,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(eq(users.username, lower))
    .limit(1);

  const user = rows[0];
  if (!user || user.bannedAt) notFound();

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-4">
        {user.image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={user.image} alt="" className="h-16 w-16 rounded-full" />
        )}
        <div>
          <h1 className="font-display text-2xl">{user.name ?? user.username}</h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
        </div>
      </div>
      {user.bio && <p className="mt-6 text-foreground">{user.bio}</p>}
    </main>
  );
}
