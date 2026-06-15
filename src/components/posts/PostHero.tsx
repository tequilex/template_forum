import Image from "next/image";

type Props = {
  title: string;
  coverUrl: string | null;
  authorUsername: string | null;
  pubAt: Date | null;
};

export function PostHero({ title, coverUrl, authorUsername, pubAt }: Props) {
  return (
    <header className="max-w-[1200px] mx-auto">
      {coverUrl && (
        <div className="relative w-full aspect-[16/9] mb-6 bg-muted">
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="max-w-[680px] mx-auto px-4">
        <h1 className="font-display text-3xl md:text-5xl leading-tight mb-3">{title}</h1>
        <p className="text-muted-foreground text-sm">
          {authorUsername && (
            <a href={`/u/${authorUsername}`} className="underline-offset-2 hover:underline">
              @{authorUsername}
            </a>
          )}
          {pubAt && (
            <>
              {" · "}
              <time dateTime={pubAt.toISOString()}>
                {pubAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </time>
            </>
          )}
        </p>
      </div>
    </header>
  );
}
