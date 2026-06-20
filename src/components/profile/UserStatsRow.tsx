import { content } from "@theme/content";
import { TagBadge } from "@/components/tags/TagBadge";

interface UserStatsRowProps {
  postsCount: number;
  registeredAt: Date;
  topTags: { slug: string; name: string }[];
}

const monthYearFmt = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

export function UserStatsRow({ postsCount, registeredAt, topTags }: UserStatsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-2">
      <span>{content.profile.postsCount(postsCount)}</span>
      <span>·</span>
      <span>{content.profile.registeredSince(monthYearFmt.format(registeredAt))}</span>
      {topTags.length > 0 && (
        <>
          <span>·</span>
          <div className="flex flex-wrap gap-1">
            {topTags.map((t) => (
              <TagBadge key={t.slug} slug={t.slug} name={t.name} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
