import Link from "next/link";
import { Menu } from "lucide-react";
import { content } from "@theme/content";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/providers/ThemeToggle";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/auth/UserMenu";

export async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-header/95 backdrop-blur supports-[backdrop-filter]:bg-header/90">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-[1200px]">
        <Link href="/" className="font-display text-lg font-semibold text-foreground">
          {content.site.name}
        </Link>

        {/* Навигация Лента/Темы живёт в LeftNav (desktop) и BottomNav (mobile),
         * чтобы не дублировать. В хедере остаётся только лого + theme + profile. */}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user?.username ? (
            <UserMenu username={user.username} name={user.name ?? null} image={user.image ?? null} />
          ) : user ? (
            <Button asChild variant="default" size="sm" className="hidden md:inline-flex">
              <Link href="/welcome">{content.auth.chooseUsername}</Link>
            </Button>
          ) : (
            <Button asChild variant="default" size="sm" className="hidden md:inline-flex">
              <Link href="/login">{content.nav.login}</Link>
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Меню">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle className="sr-only">Меню</SheetTitle>
              {/* Лента/Темы на mobile — это BottomNav. Sheet оставлен только под
               * профиль/логин, чтобы кнопка-гамбургер вела куда-то осмысленное. */}
              <nav className="flex flex-col gap-4 mt-8">
                <SheetClose asChild>
                  {user?.username
                    ? <Link href={`/u/${user.username}`} className="text-base text-foreground">@{user.username}</Link>
                    : user
                      ? <Link href="/welcome" className="text-base text-foreground">{content.auth.chooseUsername}</Link>
                      : <Link href="/login" className="text-base text-foreground">{content.nav.login}</Link>}
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
