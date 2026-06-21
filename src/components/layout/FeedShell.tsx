import type { Route } from "next";
import { auth } from "@/lib/auth";
import { LeftNav } from "./LeftNav";
import { BottomNav } from "./BottomNav";
import { RightSidebar } from "./RightSidebar";

export async function FeedShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Авторизованный с username → свой профиль.
  // Авторизованный без username → /welcome (нужно пройти onboarding).
  // Аноним → /login (после логина уйдёт в welcome или на свой профиль).
  const profileHref: Route = session?.user?.username
    ? (`/u/${session.user.username}` as Route)
    : session?.user
      ? ("/welcome" as Route)
      : ("/login" as Route);
  const isAuthed = !!session?.user;

  return (
    <div className="mx-auto max-w-[1200px] w-full">
      {/* min-w-0 на <main>: иначе grid-track распирается по самой широкой ячейке (длинный URL в excerpt). */}
      <div className="lg:grid lg:grid-cols-[200px_1fr_280px] lg:gap-8 lg:px-6">
        <LeftNav
          profileHref={profileHref}
          isAuthed={isAuthed}
          className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:py-6"
        />
        <main className="px-4 lg:px-0 py-6 pb-24 lg:pb-12 min-w-0">{children}</main>
        <RightSidebar className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:py-6" />
      </div>

      <BottomNav
        profileHref={profileHref}
        isAuthed={isAuthed}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30"
      />
    </div>
  );
}
