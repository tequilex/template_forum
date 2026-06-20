import { auth } from "@/lib/auth";
import { buildEdgeConfig } from "@/lib/auth/config.edge";
import { getEnv } from "@/lib/env";
import { redirect } from "next/navigation";
import { content } from "@theme/content";
import { ProviderButtons } from "@/components/auth/ProviderButtons";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.bannedAt) redirect("/");
    redirect(session.user.username ? "/" : "/welcome");
  }

  const config = buildEdgeConfig();
  const nextAuthProviders = (config.providers ?? []).flatMap((p) => {
    const id = (p as { id?: string }).id;
    return id ? [id] : [];
  });

  const env = getEnv();
  const vkEnabled = Boolean(env.VK_CLIENT_ID && env.VK_CLIENT_SECRET);
  const hasAny = nextAuthProviders.length > 0 || vkEnabled;

  return (
    <main className="container mx-auto flex max-w-md items-center justify-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="font-display text-2xl text-center mb-2">{content.auth.loginTitle}</h1>
        <p className="text-muted-foreground text-center mb-8">{content.auth.loginSubtitle}</p>
        {hasAny
          ? <ProviderButtons nextAuthProviders={nextAuthProviders} vkEnabled={vkEnabled} />
          : <p className="text-sm text-muted-foreground text-center">{content.auth.noProviders}</p>}
      </div>
    </main>
  );
}
