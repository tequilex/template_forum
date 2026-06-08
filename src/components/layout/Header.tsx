import Link from "next/link";
import { Menu } from "lucide-react";
import { content } from "@/theme/content";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/providers/ThemeToggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  const navLinks = [
    { href: "/", label: content.nav.home },
    { href: "/tags", label: content.nav.tags },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-[1200px]">
        <Link href="/" className="font-display text-lg font-semibold text-foreground">
          {content.site.name}
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="default" size="sm" className="hidden md:inline-flex">
            <Link href="/login">{content.nav.login}</Link>
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
                {navLinks.map(l => (
                  <Link key={l.href} href={l.href} className="text-base text-foreground">
                    {l.label}
                  </Link>
                ))}
                <Link href="/login" className="text-base text-foreground">{content.nav.login}</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
