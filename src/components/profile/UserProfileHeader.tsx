import { UserStatsRow } from "./UserStatsRow";
import { WriteButton } from "@/components/post/WriteButton";
import { UserAdminMenu } from "@/components/moderation/UserAdminMenu";
import { Avatar } from "@/components/ui/Avatar";

interface UserProfileHeaderProps {
  userId: string;
  username: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  postsCount: number;
  registeredAt: Date;
  topTags: { slug: string; name: string }[];
  isOwner: boolean;
  isAdmin: boolean;
  isBanned: boolean;
}

export function UserProfileHeader(props: UserProfileHeaderProps) {
  const {
    userId, username, name, image, bio, postsCount, registeredAt, topTags,
    isOwner, isAdmin, isBanned,
  } = props;
  const displayName = name ?? username;

  return (
    <header className="flex items-start gap-4 mb-6 pb-4 border-b border-border">
      <Avatar src={image} name={name} username={username} size={72} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{displayName}</h1>
            <p className="text-sm text-muted-foreground">@{username}</p>
            {isBanned && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive mt-1">
                Заблокирован
              </span>
            )}
          </div>
          {isAdmin && !isOwner && (
            <UserAdminMenu userId={userId} isBanned={isBanned} />
          )}
        </div>
        {bio && <p className="text-sm mt-2 leading-relaxed">{bio}</p>}
        <UserStatsRow postsCount={postsCount} registeredAt={registeredAt} topTags={topTags} />
        {isOwner && (
          <div className="mt-4">
            <WriteButton variant="cta" />
          </div>
        )}
      </div>
    </header>
  );
}
