import Image from "next/image";
import { UserStatsRow } from "./UserStatsRow";

interface UserProfileHeaderProps {
  username: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  postsCount: number;
  registeredAt: Date;
  topTags: { slug: string; name: string }[];
}

export function UserProfileHeader(props: UserProfileHeaderProps) {
  const { username, name, image, bio, postsCount, registeredAt, topTags } = props;
  const displayName = name ?? username;

  return (
    <header className="flex items-start gap-4 mb-6 pb-4 border-b border-border">
      {image ? (
        <Image
          src={image}
          alt=""
          width={72}
          height={72}
          className="rounded-full shrink-0"
        />
      ) : (
        <div className="w-[72px] h-[72px] rounded-full bg-muted shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold leading-tight">{displayName}</h1>
        <p className="text-sm text-muted-foreground">@{username}</p>
        {bio && <p className="text-sm mt-2 leading-relaxed">{bio}</p>}
        <UserStatsRow postsCount={postsCount} registeredAt={registeredAt} topTags={topTags} />
      </div>
    </header>
  );
}
