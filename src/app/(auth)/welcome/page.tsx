import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { content } from "@theme/content";
import { setUsername } from "./actions";
import { SubmitButton } from "./SubmitButton";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.username) redirect("/");

  const { err } = await searchParams;
  const errorMsg =
    err === "format" ? content.auth.errorFormat
    : err === "reserved" ? content.auth.errorReserved
    : err === "taken" ? content.auth.errorTaken
    : null;

  return (
    <main className="container mx-auto max-w-sm px-4 py-12">
      <h1 className="font-display text-2xl mb-2">{content.auth.welcomeTitle}</h1>
      <p className="text-muted-foreground mb-6">{content.auth.welcomeHint}</p>
      <form action={setUsername} className="flex flex-col gap-3">
        <input
          name="username"
          type="text"
          autoComplete="off"
          autoFocus
          required
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_\-]{3,20}"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        <SubmitButton>{content.auth.welcomeSubmit}</SubmitButton>
      </form>
    </main>
  );
}
