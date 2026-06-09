import { content } from "@/theme/content";

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-[1200px]">
      <h1 className="font-display text-3xl text-foreground">{content.site.name}</h1>
      <p className="text-muted-foreground mt-2 text-base leading-body">{content.site.tagline}</p>
      <p className="mt-8 text-muted-foreground">{content.empty.feed}</p>
    </main>
  );
}
