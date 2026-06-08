import { content } from "@/theme/content";
import { ThemeToggle } from "@/components/providers/ThemeToggle";

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">{content.site.name}</h1>
        <ThemeToggle />
      </div>
      <p className="text-muted-foreground mt-2">{content.site.tagline}</p>
    </main>
  );
}
