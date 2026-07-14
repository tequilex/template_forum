import { ImageResponse } from "next/og";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts, users } from "@db/schema";

export const runtime = "nodejs";
export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [row] = await getDb()
    .select({
      title: posts.title,
      pubAt: posts.pubAt,
      username: users.username,
      name: users.name,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(
      eq(posts.slug, slug),
      eq(posts.status, "published"),
      isNull(posts.deletedAt),
      isNull(posts.hiddenByAdminAt),
    ))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  const dateLabel = row.pubAt
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(row.pubAt)
    : "";
  const authorLabel = row.name ?? row.username ?? "Аноним";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "64px",
          fontFamily: "system-ui",
          color: "white",
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, opacity: 0.7 }}>foxgeek</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.15,
              maxHeight: 64 * 1.15 * 3,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {row.title}
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            opacity: 0.7,
            borderTop: "1px solid rgba(255,255,255,0.2)",
            paddingTop: 24,
          }}
        >
          @{authorLabel} · {dateLabel}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
