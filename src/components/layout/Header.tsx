import Link from "next/link";
import { Menu } from "lucide-react";
import { content } from "@/theme/content";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/providers/ThemeToggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  // TODO(plan-2): /login переключить на <Link> когда появится auth-роут
  // TODO(plan-4): /tags переключить на <Link> когда появится список тегов
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-[1200px]">
        <Link href="/" className="font-display text-lg font-semibold text-foreground">
          {content.site.name}
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            {content.nav.home}
          </Link>
          <a href="/tags" className="text-sm text-muted-foreground hover:text-foreground">
            {content.nav.tags}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="default" size="sm" className="hidden md:inline-flex">
            <a href="/login">{content.nav.login}</a>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Меню">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle className="sr-only">Меню</SheetTitle>
              <nav className="flex flex-col gap-4 mt-8">
                <Link href="/" className="text-base text-foreground">{content.nav.home}</Link>
                <a href="/tags" className="text-base text-foreground">{content.nav.tags}</a>
                <a href="/login" className="text-base text-foreground">{content.nav.login}</a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
